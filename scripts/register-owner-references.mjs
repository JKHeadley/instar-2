// P3 resolves committed owner inputs; implementations/declarations remain P5's.
import { execFileSync } from 'node:child_process';
import { canonical } from '../dist/index.js';
import { value } from './register-source.mjs';

export const ownerManifestPath = 'register-source/owner-references.json';
const hash = input => value(canonical(input)).hash;
const decoders = new Set(['decodeRun', 'decodeRunStep', 'decodeRunTransition', 'decodeRunExit', 'decodeSessionGrounding']);
const exact = (v, keys) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k)) || keys.some(k => !Object.hasOwn(v, k)))
    throw new Error('invalid owner reference manifest fields');
};
export function loadOwnerReferences(root, input) {
  const raw = input.sources[ownerManifestPath];
  const result = { references: [], catalog: { fixtures: [], probes: [] }, decoders: [], documents: [], artifacts: {} };
  if (raw === undefined) return result;
  const manifest = JSON.parse(raw);
  exact(manifest, ['schemaVersion', 'owner', 'fixtures', 'probes', 'decoders', 'documents']);
  if (manifest.schemaVersion !== 1 || manifest.owner !== 'part-five') throw new Error('unknown reference owner/version');
  for (const field of ['fixtures', 'probes', 'decoders', 'documents']) if (!Array.isArray(manifest[field])) throw new Error('owner reference list required');
  const artifact = (a, path) => {
    exact(a, ['path', 'hash']);
    if (a.path !== path || !input.files.includes(path)) throw new Error('wrong-owner or missing artifact: ' + path);
    const content = execFileSync('git', ['-C', root, 'show', `${input.commit}:${path}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (hash(content) !== a.hash) throw new Error('reference artifact hash differs: ' + path);
    result.artifacts[path] = content;
  };
  const unique = (rows, name) => { if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('duplicate owner ' + name); };
  for (const [kind, id, path] of [['fixture', 'P5-NF-54', 'tests/rungraph/governance.test.ts'], ['probe', 'P5-NF-55', 'tests/rungraph/scope.test.ts']]) {
    const rows = manifest[kind + 's']; unique(rows, kind);
    for (const row of rows) {
      exact(row, kind === 'fixture' ? ['id', 'stage', 'artifact'] : ['id', 'cadence', 'execution', 'artifact']);
      if (row.id !== id || (kind === 'fixture' ? row.stage !== 'build' : row.execution !== 'ci' || !Number.isFinite(row.cadence) || row.cadence <= 0))
        throw new Error('unknown owner fixture/probe or invalid CI cadence');
      artifact(row.artifact, path);
      result.catalog[kind + 's'].push(row); result.references.push({ provider: kind, id });
    }
  }
  unique(manifest.decoders, 'decoder');
  for (const row of manifest.decoders) {
    exact(row, ['id', 'module', 'artifact']);
    if (!decoders.has(row.id)) throw new Error('unknown owner decoder ' + row.id);
    artifact(row.module, 'src/rungraph/index.ts'); artifact(row.artifact, 'src/rungraph/records.ts');
    result.decoders.push(row); result.references.push({ provider: 'decoder', id: row.id });
  }
  unique(manifest.documents, 'document');
  for (const row of manifest.documents) {
    exact(row, ['id', 'artifact']);
    if (row.id !== 'rungraph.contract') throw new Error('unknown owner governed document');
    artifact(row.artifact, 'docs/09-the-run-graph.md'); result.documents.push(row);
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
