import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRegister, generationOf, renderRegister, resolveTerms, invariantCoverage, implementedInvariants } from '../dist/register/index.js';
import { bootstrapDeclarations, buildContext, readCommit, value, bytes } from './register-source.mjs';

export function build(root, commit) {
  const input = readCommit(root, commit);
  const shapeInput = JSON.parse(input.sources['register-source/bootstrap-shape.json']);
  const sources = bootstrapDeclarations(input.sources, shapeInput);
  const context = buildContext(shapeInput, sources, commit);
  value(invariantCoverage(context.shape, implementedInvariants, context));
  const extract = { type: 'ChainExtract', schemaVersion: 1, vector: { owner: 'part-two', name: 'FactPositionVector', id: 'genesis:empty-extract' }, rows: [] };
  const register = value(generateRegister({ commit, complete: true, sources, extract, instances: {} }, context));
  const generation = value(generationOf(register, context));
  const terms = value(resolveTerms(register, context));
  const outputs = value(renderRegister(register, generation, terms, null, context));
  return { input, register, generation, outputs, metrics: { entries: register.entries.length, rules: register.entries.filter(e => e.declaration.kind === 'rules').length,
    terms: register.entries.filter(e => e.declaration.kind === 'terms').length, warnings: terms.warnings.length } };
}
export function run(args, root = process.cwd()) {
  const check = args.includes('--check'); const ci = args.indexOf('--commit'); const outIndex = args.indexOf('--out');
  const output = resolve(root, outIndex < 0 ? 'generated' : args[outIndex + 1]);
  const manifest = resolve(output, 'source.json');
  const commit = ci < 0 ? (existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).commit
    : execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()) : args[ci + 1];
  const result = build(root, commit);
  // A stale pin must never hide a changed rule or shape in the working tree.
  const tracked = execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8' }).trim().split('\n');
  const live = tracked.filter(p => Object.hasOwn(result.input.sources, p) || p.startsWith('docs/rules/') && p.endsWith('.md') || p.endsWith('.declarations.json')).sort();
  if (JSON.stringify(live) !== JSON.stringify(Object.keys(result.input.sources).sort())) throw new Error('P3-NF-23: source roster changed; regenerate from a new source commit');
  for (const [path, content] of Object.entries(result.input.sources)) if (readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n') !== content)
    throw new Error(`P3-NF-01: source pin trails ${path}; commit source changes and regenerate`);
  const files = { 'register.json': result.outputs.register, 'rules.md': result.outputs.ruleBook, 'glossary.md': result.outputs.glossary,
    'capabilities.md': result.outputs.capabilities, 'coverage.md': result.outputs.coverage, 'shape.json': bytes(result.register.shape) + '\n',
    'source.json': JSON.stringify({ commit, generation: result.generation.id, authority: 'shape-only' }, null, 2) + '\n' };
  if (!check) mkdirSync(output, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    const path = resolve(output, name);
    if (check) { if (!existsSync(path) || readFileSync(path, 'utf8') !== text) throw new Error(`P3-NF-01/P3-NF-09: generated ${name} differs`); }
    else writeFileSync(path, text);
  }
  console.log(JSON.stringify({ generation: result.generation.id, commit, ...result.metrics, check, authority: 'shape-only' }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
