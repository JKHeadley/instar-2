// Build adapter: git/files/clock stay outside the pure core. Rules 26/69/78/84/90.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonical, consumeResult, decode } from '../dist/index.js';
import { decodeShape } from '../dist/register/index.js';
import { shippedInventory } from './register-inventory.mjs';

export const value = result => consumeResult(result, { Success: value => value, Refused: refusal => { throw new Error(refusal.detail); } });
export const bytes = input => value(canonical(input)).bytes;
// A sidecar does not get to author declaredBy. Resolve its adjacent source and
// literal core construct through the same symbol-aware sweep used by the gates.
export function bindColocatedDeclarations(sources, constructs) {
  return sources.map(source => {
    if (!isDeclarationSource(source.path)) return source;
    const path = source.path.replace(/\.(?:declarations|parser)\.json$/, '.ts');
    const matches = constructs.filter(c => c.path === path && c.id === source.declaration.id && c.kind === source.declaration.kind);
    if (matches.length > 1) throw new Error(`P3-NF-19: ambiguous colocated construct ${source.declaration.id}`);
    // Keep a phantom's actual JSON provenance: downstream load-bearing pairing
    // and governed-state checks must refuse it, not pair by id across files.
    return matches.length === 1 ? { ...source, path, symbol: matches[0].symbol } : source;
  });
}
// One git process reads every candidate blob at the pinned commit (the inventory walk
// would otherwise spawn one `git show` per shipped file).
function readBlobs(root, commit, paths) {
  const out = execFileSync('git', ['-C', root, 'cat-file', '--batch'], { input: paths.map(p => `${commit}:${p}`).join('\n') + '\n', maxBuffer: 512 * 1024 * 1024 });
  const blobs = new Map(); let at = 0;
  for (const path of paths) {
    const eol = out.indexOf(10, at); const header = out.toString('utf8', at, eol).split(' ');
    if (header[1] !== 'blob') throw new Error(`P3-NF-23: ${path} is not a blob at ${commit}`);
    const size = Number(header[2]); blobs.set(path, out.toString('utf8', eol + 1, eol + 1 + size)); at = eol + 2 + size;
  }
  return blobs;
}
// Declarations live in code-adjacent sidecars; parser declarations use their own suffix.
export const isDeclarationSource = path => path.endsWith('.declarations.json') || path.endsWith('.parser.json');
export function readCommit(root, commit) {
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (!/^[a-f0-9]{40}$/.test(commit) || git(['rev-parse', '--verify', `${commit}^{commit}`]).trim() !== commit) throw new Error('source commit is not an exact commit id');
  if (git(['rev-parse', '--is-shallow-repository']).trim() !== 'false') throw new Error('P3-NF-23: shallow checkout refuses');
  const files = git(['ls-tree', '-r', '--name-only', commit]).trim().split('\n');
  const selected = files.filter(p => ['docs/01-the-rules.md', 'docs/02-the-register.md', 'docs/03-the-glossary.md', 'docs/07-the-declarations.md', 'register-source/bootstrap-shape.json'].includes(p)
    || p.startsWith('docs/rules/') && p.endsWith('.md') || isDeclarationSource(p) || p.startsWith('register-source/') && p.endsWith('.json'));
  for (const required of ['docs/01-the-rules.md', 'docs/02-the-register.md', 'docs/03-the-glossary.md', 'register-source/bootstrap-shape.json'])
    if (!selected.includes(required)) throw new Error(`P3-NF-23: missing source ${required}`);
  const cache = readBlobs(root, commit, files.filter(p => /\.(?:ts|mts|mjs|js|json|md)$/.test(p)));
  const show = p => { if (!cache.has(p)) cache.set(p, git(['show', `${commit}:${p}`])); return cache.get(p); };
  const sources = Object.fromEntries(selected.sort().map(p => [p, show(p).replaceAll('\r\n', '\n')]));
  // The wiring scan covers what ships: built src plus every launcher's runtime closure.
  const inventory = shippedInventory(files, show);
  const code = Object.fromEntries(inventory.files.map(p => [p, show(p)]));
  return { commit, sources, files, code, inventory, show };
}
export function bootstrapDeclarations(documents, shape) {
  const sources = []; const glossary = documents['docs/03-the-glossary.md'];
  const terms = [];
  // Repository replay converts approved Markdown revisions from pinned sources.
  // Runtime anchoring is separate; after it, references are data, not typography parsing.
  for (const match of glossary.matchAll(/^\*\*([A-Z][A-Za-z -]+)\.\*\* ([^\n]*(?:\n(?!\n|\*\*)[^\n]+)*)/gm)) {
    const name = match[1].toLowerCase();
    if (['definition', 'used by', 'test', 'what it excludes', 'what this includes', 'consequence of the definition'].includes(name)) continue;
    if (!terms.some(t => t.name === name)) terms.push({ name, definition: match[2], kind: name === 'standing' || name === 'operator' ? 'standing' : 'noun' });
  }
  for (const [key, name] of [['critical', 'critical'], ['significant', 'significant'], ['userFacing', 'user-facing'], ['irreversible', 'irreversible']]) {
    const heading = name === 'user-facing' ? 'User-facing' : name[0].toUpperCase() + name.slice(1);
    const section = glossary.split(`### ${heading}\n`)[1]?.split('\n### ')[0];
    const definition = section?.match(/\*\*Definition\.\*\* ([\s\S]*?)(?:\n\n|$)/)?.[1];
    if (!definition) throw new Error(`approved adjective ${name} has no definition`);
    terms.push({ name, kind: 'adjective', definition, derivedFrom: shape.derivedFrom[key] });
  }
  for (const line of glossary.split('\n')) {
    const match = line.match(/^\| `(consequence|reversibility|reach|surface|repeats)` \| (.*?) \| (.*?) \|$/);
    if (match) terms.push({ name: match[1], kind: 'field', definition: match[2], allowedValues: match[3].split(' · ').map(v => v.trim()) });
  }
  for (const match of (documents['docs/07-the-declarations.md'] ?? '').matchAll(/^\| \*\*([^*]+)\*\* \| (noun|field|standing) \| (.+) \|$/gm))
    if (!terms.some(t => t.name === match[1])) terms.push({ name: match[1], kind: match[2], definition: match[3] });
  const id = name => `term:${name.replaceAll(' ', '-')}`;
  const declaration = (id, kind, requiredFacts, extra = {}) => ({ type: 'Declaration', schemaVersion: 1, id, kind, status: 'live', requiredFacts, standards: [], holds: [], ...extra });
  for (const t of terms) sources.push({ path: 'docs/03-the-glossary.md', symbol: id(t.name), declaration: declaration(id(t.name), 'terms', { ...t, termRefs: [] }) });
  const rules = documents['docs/01-the-rules.md']; let group = '';
  for (const line of rules.split('\n')) {
    if (line.startsWith('### ')) group = line;
    if (!/^\| \d+ \|/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map(s => s.trim());
    if (cells.length !== 4) throw new Error('rule row must have exactly four fields');
    const number = Number(cells[0]); const name = cells[1]; let statement = cells[2];
    for (const [path, article] of Object.entries(documents)) if (path.startsWith(`docs/rules/${number}-`)) statement += `\n\n${article.trim()}`;
    const statementLower = statement.toLowerCase(); const termRefs = terms.filter(t => statementLower.includes(t.name)).map(t => id(t.name)).sort();
    const requiredFacts = { number, name, statement, held: group.includes('mind') ? 'mind' : group.includes('Free') ? 'shape' : 'script',
      parent: 'root', rootReason: 'Bootstrap source declares no structural parent; no parent inferred from prose.', termRefs, checkDescription: cells[3] };
    sources.push({ path: 'docs/01-the-rules.md', symbol: `rule:${number}`, declaration: declaration(`rule:${number}`, 'rules', requiredFacts) });
  }
  const numbers = sources.filter(s => s.declaration.kind === 'rules').map(s => s.declaration.requiredFacts.number);
  if (!numbers.length || new Set(numbers).size !== numbers.length) throw new Error('empty or duplicate rule inventory');
  for (const [path, content] of Object.entries(documents)) if (isDeclarationSource(path)) {
    const declared = JSON.parse(content); if (!Array.isArray(declared)) throw new Error('declaration source must be an array');
    for (const d of declared) sources.push({ path, symbol: d.id, declaration: d });
  }
  return sources;
}
export function buildContext(shapeInput, sources, commit, instant = Date.now()) {
  const entries = [...new Set(['types.decode', 'register.decode', 'register.generator', 'local-build', 'build-machine', ...sources.map(s => s.declaration.id)])];
  const register = { generation: { owner: 'part-three', name: 'RegisterGeneration', id: `bootstrap:${commit}` }, entries,
    producers: ['register.generator'], methods: ['local-build'], actions: {}, subjects: { clock: ['unix-ms'] },
    sites: { 'types.decode': 'closed', 'register.decode': 'closed' }, keys: {}, allowRedelegation: false, conflictStanding: { ordinary: 'delegate', authority: 'operator' } };
  const captures = {}; const types = { register, preserved: `git:${commit}`, captures };
  const now = value(decode('Measurement', { type: 'Measurement', schemaVersion: 1, subject: { kind: 'clock', instance: 'build-machine' }, value: instant, unit: 'unix-ms', at: instant, by: 'register.generator' }, types));
  const record = value(canonical({ principal: { id: 'register-builder', kind: 'system' }, recordType: 'build-input', payload: { commit } }));
  captures[record.hash] = record.bytes;
  const provenance = value(decode('Provenance', { type: 'Provenance', schemaVersion: 1, adapter: 'local-build', method: 'local-build',
    record: { reference: record.hash, hash: record.hash }, verifiedAt: now, machine: 'build-machine', evidence: { kind: 'channel', authenticated: true } }, types));
  const boundary = { site: 'register.decode', preserved: `git:${commit}`, register };
  const shape = value(decodeShape(shapeInput, boundary));
  return { ...boundary, types, shape, provenance, source: { path: 'register-source/bootstrap-shape.json', symbol: 'bootstrap' } };
}
