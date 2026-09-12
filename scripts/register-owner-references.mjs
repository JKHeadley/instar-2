// P3 resolves committed owner inputs; implementations/declarations stay owned.
import { execFileSync } from 'node:child_process';
import { canonical } from '../dist/index.js';
import { value } from './register-source.mjs';
import { ownerDocuments } from '../dist/register/owner-contracts.js';
import { resolveOwnerReferenceIdentity } from '../dist/register/index.js';

export const ownerManifestPath = 'register-source/owner-references.json';
export const ownerEnrollmentPath = 'register-source/owner-enrollments.json';
const hash = input => value(canonical(input)).hash;
export const ownerManifestPaths = [ownerManifestPath, ...['part-four', 'part-five'].map(owner => `register-source/owner-references/${owner}.json`)];
const owned = (namespace, names) => Object.fromEntries(names.map(id => [id, { module: `src/${namespace}/index.ts`, artifact: `src/${namespace}/records.ts` }]));
const closureOwned = Object.fromEntries(['decodeExhaustionRecord', 'decodeUnreachableRunExit']
  .map(id => [id, { module: 'src/rungraph/index.ts', artifact: 'src/rungraph/closure-records.ts' }]));
const contracts = {
  'part-fourteen': { decoders: {},
    fixture: id => id === 'P14-NF-50',
    probe: id => /^sentinel-holders\.(?:package-loop-policy|guard-posture\.loop-policy|silent-stop|session-watchdog|helper-watchdog|orphaned-work|clean-worktree-reclamation|framework-prompt|context-wedge|compaction|presence|promise|dated-check-in-reminder|crash-loop|budget-overrun|moving-worker-silence|stranded-conversation|session-reaper|process-population-reaper|guard-posture)\.probe$/.test(id),
    test: (kind, path) => kind === 'fixture' ? path === 'tests/e2e/sentinel-holders.test.ts' : path === 'tests/sentinel-holders/core.test.ts' },
  'part-five': { decoders: { ...owned('rungraph', ['decodeRun', 'decodeRunStep', 'decodeRunTransition', 'decodeRunExit',
    'decodeSessionGrounding']), ...closureOwned },
    fixture: id => id === 'P5-NF-54' || id === 'P5-SEAM-RC-R10-F3-ADDITIVE-REGISTRATION', probe: id => id === 'P5-NF-55',
    test: (kind, path) => kind === 'fixture'
      ? path === 'tests/rungraph/governance.test.ts' || path === 'tests/rungraph/closure-registration-additivity.test.ts'
      : path === 'tests/rungraph/scope.test.ts' },
  'part-four': { decoders: { ...owned('intake', ['intakeDedupDefinition', 'intakeWorkRegistration', 'intakeStopRegistration']),
    'decode:Provenance': { module: 'src/index.ts', artifact: 'src/decode/decode.ts', symbol: 'decode' },
    'decode:VerifiedPrincipal': { module: 'src/index.ts', artifact: 'src/decode/decode.ts', symbol: 'decode' },
    readProjection: { module: 'src/projections/index.ts', artifact: 'src/projections/fold.ts', requires: 'intakeDedupDefinition' },
    authorAndAppend: { module: 'src/facts/index.ts', artifact: 'src/facts/store.ts', requires: 'intakeWorkRegistration' },
    'createFactStore.append': { module: 'src/facts/index.ts', artifact: 'src/facts/store.ts', symbol: 'createFactStore', requires: 'intakeWorkRegistration' } },
    fixture: id => /^P4-NF-(0[1-9]|1[0-9]|2[0-9])$/.test(id), probe: id => id === 'P4-NF-29',
    test: (_kind, path) => /^tests\/intake\/[a-z][a-z0-9-]*\.test\.ts$/.test(path) },
};
const exact = (v, keys) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k)) || keys.some(k => !Object.hasOwn(v, k)))
    throw new Error('invalid owner reference manifest fields');
};
export function retainedOwnerEnrollments(input) {
  const raw = input.sources[ownerEnrollmentPath];
  if (raw === undefined) return [];
  const value = JSON.parse(raw); exact(value, ['schemaVersion', 'enrollments']);
  if (value.schemaVersion !== 1 || !Array.isArray(value.enrollments)) throw new Error('invalid owner enrollment ledger');
  const seen = new Set();
  return value.enrollments.map(row => {
    row = resolveOwnerReferenceIdentity(row);
    if (seen.has(row.part) || seen.has(row.owner) || seen.has(row.manifest.path)) throw new Error('duplicate retained owner enrollment');
    seen.add(row.part); seen.add(row.owner); seen.add(row.manifest.path); return row;
  });
}
export function loadOwnerReferences(root, input, enrollments = []) {
  const result = { references: [], catalog: { fixtures: [], probes: [] }, decoders: [], documents: [], artifacts: {} };
  const seen = new Set();
  const merged = enrollments.map(resolveOwnerReferenceIdentity);
  const enrolledPaths = merged.map(row => row.manifest.path);
  if (new Set([...ownerManifestPaths, ...enrolledPaths]).size !== ownerManifestPaths.length + enrolledPaths.length)
    throw new Error('owner enrollment duplicates a closed owner manifest');
  const admittedPaths = [...ownerManifestPaths, ...enrolledPaths];
  for (const path of Object.keys(input.sources)) if (path.startsWith('register-source/owner-references/') && !admittedPaths.includes(path))
    throw new Error('unknown owner manifest path ' + path);
  for (const manifestPath of admittedPaths) {
  const enrollment = merged.find(row => row.manifest.path === manifestPath);
  const raw = input.sources[manifestPath];
  if (raw === undefined) {
    if (enrollment) throw new Error('missing governed owner enrollment manifest ' + manifestPath);
    continue;
  }
  const manifest = JSON.parse(raw);
  exact(manifest, ['schemaVersion', 'owner', 'fixtures', 'probes', 'decoders', 'documents']);
  if (enrollment && (hash(manifest) !== enrollment.manifest.hash || manifest.owner !== enrollment.owner))
    throw new Error('governed owner enrollment differs from committed manifest');
  if (manifest.schemaVersion !== 1 || typeof manifest.owner !== 'string' || !Object.hasOwn(contracts, manifest.owner) && !enrollment)
    throw new Error('unknown reference owner/version');
  if (manifestPath !== ownerManifestPath && manifestPath !== `register-source/owner-references/${manifest.owner}.json`)
    throw new Error('owner manifest path disagrees with declared owner');
  if (seen.has(manifest.owner)) throw new Error('duplicate owner manifest'); seen.add(manifest.owner);
  const contract = contracts[manifest.owner];
  if (!contract) throw new Error('enrolled owner has no closed artifact contract');
  for (const field of ['fixtures', 'probes', 'decoders', 'documents']) if (!Array.isArray(manifest[field])) throw new Error('owner reference list required');
  if (enrollment && (manifest.decoders.length || manifest.documents.length))
    throw new Error('new per-part enrollment admits fixture/probe evidence only');
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
