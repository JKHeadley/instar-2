// P3 resolves committed owner inputs; implementations/declarations stay owned.
import { execFileSync } from 'node:child_process';
import { canonical } from '../dist/index.js';
import { value } from './register-source.mjs';
import { ownerDocuments } from '../dist/register/owner-contracts.js';

export const ownerManifestPath = 'register-source/owner-references.json';
const hash = input => value(canonical(input)).hash;
export const ownerManifestPaths = [ownerManifestPath, ...['part-four', 'part-five'].map(owner => `register-source/owner-references/${owner}.json`)];
const owned = (namespace, names) => Object.fromEntries(names.map(id => [id, { module: `src/${namespace}/index.ts`, artifact: `src/${namespace}/records.ts` }]));
const contracts = {
  'part-five': { decoders: owned('rungraph', ['decodeRun', 'decodeRunStep', 'decodeRunTransition', 'decodeRunExit', 'decodeSessionGrounding']),
    fixture: id => id === 'P5-NF-54', probe: id => id === 'P5-NF-55',
    test: (kind, path) => path === (kind === 'fixture' ? 'tests/rungraph/governance.test.ts' : 'tests/rungraph/scope.test.ts') },
  'part-four': { decoders: { ...owned('intake', ['intakeDedupDefinition', 'intakeWorkRegistration', 'intakeStopRegistration', 'intakeVerifiedActRegistration']),
    scheduledIntakeWorkRegistration: { module: 'src/intake/scheduled-a/index.ts', artifact: 'src/intake/scheduled-records.ts' },
    'decode:Provenance': { module: 'src/index.ts', artifact: 'src/decode/decode.ts', symbol: 'decode' },
    'decode:VerifiedPrincipal': { module: 'src/index.ts', artifact: 'src/decode/decode.ts', symbol: 'decode' },
    readProjection: { module: 'src/projections/index.ts', artifact: 'src/projections/fold.ts', requires: 'intakeDedupDefinition' },
    authorAndAppend: { module: 'src/facts/index.ts', artifact: 'src/facts/store.ts', requires: 'intakeWorkRegistration' },
    'createFactStore.append': { module: 'src/facts/index.ts', artifact: 'src/facts/store.ts', symbol: 'createFactStore', requires: 'intakeWorkRegistration' } },
    fixture: id => /^P4-(?:NF-(?:0[1-9]|1[0-9]|2[0-9])|VA-0[1-9]|ST-(?:0[1-9]|[1-8][0-9]|90)|PRESERVE-0[1-3])$/.test(id), probe: id => id === 'P4-NF-29',
    test: (_kind, path) => /^tests\/(?:intake\/[a-z][a-z0-9-]*|(?:integration|e2e)\/intake-scheduled(?:-repair(?:[6-9]|10|11|12|13|14|15))?)\.test\.ts$/.test(path) },
};
const exact = (v, keys) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k)) || keys.some(k => !Object.hasOwn(v, k)))
    throw new Error('invalid owner reference manifest fields');
};
export function loadOwnerReferences(root, input) {
  const result = { references: [], catalog: { fixtures: [], probes: [] }, decoders: [], documents: [], artifacts: {} };
  const seen = new Set();
  for (const path of Object.keys(input.sources)) if (path.startsWith('register-source/owner-references/') && !ownerManifestPaths.includes(path))
    throw new Error('unknown owner manifest path ' + path);
  for (const manifestPath of ownerManifestPaths) {
  const raw = input.sources[manifestPath]; if (raw === undefined) continue;
  const manifest = JSON.parse(raw);
  exact(manifest, ['schemaVersion', 'owner', 'fixtures', 'probes', 'decoders', 'documents']);
  if (manifest.schemaVersion !== 1 || typeof manifest.owner !== 'string' || !Object.hasOwn(contracts, manifest.owner)) throw new Error('unknown reference owner/version');
  if (manifestPath !== ownerManifestPath && manifestPath !== `register-source/owner-references/${manifest.owner}.json`)
    throw new Error('owner manifest path disagrees with declared owner');
  if (seen.has(manifest.owner)) throw new Error('duplicate owner manifest'); seen.add(manifest.owner);
  const contract = contracts[manifest.owner];
  for (const field of ['fixtures', 'probes', 'decoders', 'documents']) if (!Array.isArray(manifest[field])) throw new Error('owner reference list required');
  const artifact = (a, path) => {
    exact(a, ['path', 'hash']);
    if (a.path !== path || !input.files.includes(path)) throw new Error('wrong-owner or missing artifact: ' + path);
    const content = execFileSync('git', ['-C', root, 'show', `${input.commit}:${path}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (hash(content) !== a.hash) throw new Error('reference artifact hash differs: ' + path);
    result.artifacts[path] = content;
  };
  const unique = (rows, name) => {
    if (rows.some(r => !r || typeof r.id !== 'string' || !r.id)) throw new Error('owner reference id must be a nonempty string');
    if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('duplicate owner ' + name);
  };
  for (const kind of ['fixture', 'probe']) {
    const rows = manifest[kind + 's']; unique(rows, kind);
    for (const row of rows) {
      exact(row, kind === 'fixture' ? ['id', 'stage', 'artifact'] : ['id', 'cadence', 'execution', 'artifact']);
      if (!contract[kind](row.id) || (kind === 'fixture' ? row.stage !== 'build' : row.execution !== 'ci' || !Number.isFinite(row.cadence) || row.cadence <= 0))
        throw new Error('unknown owner fixture/probe or invalid CI cadence');
      if (!contract.test(kind, row.artifact?.path)) throw new Error('wrong-owner inspection artifact');
      artifact(row.artifact, row.artifact.path);
      result.catalog[kind + 's'].push(row); result.references.push({ provider: kind, id: row.id });
    }
  }
  unique(manifest.decoders, 'decoder');
  for (const row of manifest.decoders) {
    exact(row, ['id', 'module', 'artifact']);
    if (!Object.hasOwn(contract.decoders, row.id)) throw new Error('unknown owner decoder ' + row.id);
    const binding = contract.decoders[row.id];
    if (binding.requires && !manifest.decoders.some(r => r.id === binding.requires)) throw new Error('owner consumer requires ' + binding.requires);
    artifact(row.module, binding.module); artifact(row.artifact, binding.artifact);
    result.decoders.push({ ...row, ...(binding.symbol ? { symbol: binding.symbol } : {}) }); result.references.push({ provider: 'decoder', id: row.id });
  }
  unique(manifest.documents, 'document');
  for (const row of manifest.documents) {
    exact(row, ['id', 'artifact']);
    const binding = Object.hasOwn(ownerDocuments, row.id) && ownerDocuments[row.id];
    if (!binding || binding.owner !== manifest.owner) throw new Error('unknown owner governed document');
    artifact(row.artifact, binding.location); result.documents.push({ ...row, declarationPath: binding.declarationPath });
  }
  }
  return result;
}
export function mergeOwnerReferences(workflow, owner) {
  const merge = (a, b, key) => {
    const result = [...a];
    for (const row of b) {
      const previous = result.find(r => key(r) === key(row));
      if (previous && hash(previous) !== hash(row)) throw new Error('conflicting committed reference ' + key(row));
      if (!previous) result.push(row);
    }
    return result;
  };
  return { ...workflow,
    references: merge(workflow.references ?? [], owner.references, r => r.provider + ':' + r.id),
    catalog: { sentinels: [], semanticReviews: [], ...workflow.catalog,
      fixtures: merge(workflow.catalog?.fixtures ?? [], owner.catalog.fixtures, r => r.id),
      probes: merge(workflow.catalog?.probes ?? [], owner.catalog.probes, r => r.id) } };
}
