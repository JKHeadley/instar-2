// P3 resolves committed owner inputs; implementations/declarations stay owned.
import { execFileSync } from 'node:child_process';
import { canonical } from '../dist/index.js';
import { value } from './register-source.mjs';
import { ownerDocuments } from '../dist/register/owner-contracts.js';

export const ownerManifestPath = 'register-source/owner-references.json';
const hash = input => value(canonical(input)).hash;
export const ownerManifestPaths = [ownerManifestPath, ...['part-four', 'part-five', 'part-seven', 'part-nine', 'part-ten', 'part-twelve', 'preview']
  .map(owner => `register-source/owner-references/${owner}.json`)];
const owned = (namespace, names) => Object.fromEntries(names.map(id => [id, { module: `src/${namespace}/index.ts`, artifact: `src/${namespace}/records.ts` }]));
const closureOwned = Object.fromEntries(['decodeExhaustionRecord', 'decodeUnreachableRunExit']
  .map(id => [id, { module: 'src/rungraph/index.ts', artifact: 'src/rungraph/closure-records.ts' }]));
const partTenFixturePaths = {
  'P10-SI-01': ['tests/assembly/fixed-installation-contract.test.ts'],
  'P10-SI-02': ['tests/assembly/fixed-installation-contract.test.ts'],
  'P10-SI-03': ['tests/assembly/fixed-installation-contract.test.ts'],
  'P10-SI-04': ['tests/assembly/fixed-installation-live.test.ts'],
  'P10-SI-06': ['tests/assembly/fixed-installation-contract.test.ts'],
  'P10-SI-07': ['tests/assembly/fixed-installation-contract.test.ts'],
  'P10-SI-08': ['tests/assembly/fixed-installation-contract.test.ts', 'tests/assembly/fixed-installation-bootstrap.test.ts',
    'tests/assembly/fixed-installation-live.test.ts', 'tests/assembly/fixed-installation-custody.test.ts'],
  'P10-SI-09': ['tests/assembly/fixed-installation-contract.test.ts', 'tests/assembly/fixed-installation-bootstrap.test.ts',
    'tests/assembly/fixed-installation-custody.test.ts'],
  'P10-SI-11': ['tests/assembly/fixed-installation-contract.test.ts', 'tests/assembly/fixed-installation-bootstrap.test.ts',
    'tests/assembly/fixed-installation-custody.test.ts'],
  'P10-SI-12': ['tests/assembly/fixed-installation-contract.test.ts', 'tests/assembly/fixed-installation-bootstrap.test.ts'],
  'P10-SI-13': ['tests/assembly/fixed-installation-live.test.ts'],
  'P10-SI-14': ['tests/assembly/fixed-installation-live.test.ts', 'tests/assembly/fixed-installation-custody.test.ts'],
  'P10-SI-15': ['tests/assembly/fixed-installation-live.test.ts'],
  'P10-SI-16': ['tests/assembly/fixed-installation-bootstrap.test.ts', 'tests/assembly/fixed-installation-live.test.ts'],
  'P10-SI-17': ['tests/rungraph/provider-answer-reply.test.ts'],
  'P10-SI-18': ['tests/assembly/fixed-installation-live.test.ts'],
  'P10-SI-19': ['tests/assembly/fixed-installation-contract.test.ts', 'tests/assembly/fixed-installation-live.test.ts',
    'tests/assembly/fixed-installation-custody.test.ts'],
  'P10-SI-20': ['tests/assembly/fixed-installation-contract.test.ts', 'tests/assembly/fixed-installation-live.test.ts',
    'tests/assembly/fixed-installation-custody.test.ts'],
  'P10-SI-21': ['tests/assembly/fixed-installation-contract.test.ts'],
  'P10-SI-22': ['tests/assembly/fixed-installation-contract.test.ts', 'tests/assembly/fixed-installation-bootstrap.test.ts',
    'tests/assembly/fixed-installation-live.test.ts', 'tests/assembly/fixed-installation-custody.test.ts'],
  'P10-SI-23': ['tests/assembly/fixed-installation-contract.test.ts', 'tests/assembly/fixed-installation-bootstrap.test.ts'],
  'P10-SI-24': ['tests/rungraph/provider-answer-reply.test.ts'],
  'P10-SI-37': ['tests/e2e/fixed-installation-reply.test.ts'],
};
const previewFixturePaths = { 'P9-PREVIEW-step-check-graduation': 'tests/preview/step-check.test.ts',
  'P9-PREVIEW-restore-equality': 'tests/preview/proofs.test.ts' };
const contracts = {
  'part-five': { decoders: { ...owned('rungraph', ['decodeRun', 'decodeRunStep', 'decodeRunTransition', 'decodeRunExit',
    'decodeSessionGrounding']), ...closureOwned,
    ...Object.fromEntries(['decodeInstalledRunGovernanceReferenceAtOrigin', 'decodeHistoricalInstalledRunGovernanceReference']
      .map(id => [id, { module: 'src/rungraph/index.ts', artifact: 'src/rungraph/installed-governance.ts' }])) },
    fixture: id => ['P5-NF-54', 'P5-NF-54-PARTIAL', 'P5-SEAM-RC-R10-F3-ADDITIVE-REGISTRATION'].includes(id)
      || ['P10-SI-01', 'P10-SI-02', 'P10-SI-10', 'P10-SI-19', 'P10-SI-20', 'P10-SI-23'].includes(id),
    probe: id => ['P5-NF-55', 'P5-NF-55-PARTIAL'].includes(id),
    test: (id, kind, path) => kind === 'fixture'
      ? ['P5-NF-54', 'P5-NF-54-PARTIAL'].includes(id) && path === 'tests/rungraph/governance.test.ts'
        || id === 'P5-SEAM-RC-R10-F3-ADDITIVE-REGISTRATION' && path === 'tests/rungraph/closure-registration-additivity.test.ts'
        || id.startsWith('P10-SI-') && path === 'tests/rungraph/installed-governance.test.ts'
      : ['P5-NF-55', 'P5-NF-55-PARTIAL'].includes(id) && path === 'tests/rungraph/scope.test.ts' },
  'part-four': { decoders: { ...owned('intake', ['intakeDedupDefinition', 'intakeWorkRegistration', 'intakeStopRegistration', 'intakeVerifiedActRegistration']),
    'decode:Provenance': { module: 'src/index.ts', artifact: 'src/decode/decode.ts', symbol: 'decode' },
    'decode:VerifiedPrincipal': { module: 'src/index.ts', artifact: 'src/decode/decode.ts', symbol: 'decode' },
    readProjection: { module: 'src/projections/index.ts', artifact: 'src/projections/fold.ts', requires: 'intakeDedupDefinition' },
    authorAndAppend: { module: 'src/facts/index.ts', artifact: 'src/facts/store.ts', requires: 'intakeWorkRegistration' },
    'createFactStore.append': { module: 'src/facts/index.ts', artifact: 'src/facts/store.ts', symbol: 'createFactStore', requires: 'intakeWorkRegistration' } },
    fixture: id => /^P4-(?:NF-(?:0[1-9]|1[0-9]|2[0-9])|VA-0[1-9])$/.test(id) || id === 'P4-NF-14-PARTIAL',
    probe: id => id === 'P4-NF-29',
    test: (_id, _kind, path) => /^tests\/intake\/[a-z][a-z0-9-]*\.test\.ts$/.test(path) },
  'part-seven': { decoders: {
    ...Object.fromEntries(['decodeProviderAnswerAcceptanceAtOrigin', 'decodeHistoricalProviderAnswerAcceptance',
      'decodeCapturedProviderDecision'].map(id => [id, { module: 'src/judgment/index.ts', artifact: 'src/judgment/provider-path.ts' }])),
  }, fixture: () => false, probe: () => false, test: () => false },
  'part-nine': { decoders: {
    ...Object.fromEntries(['decodeVerificationRecord', 'decodeVerificationRecordAtOrigin', 'decodeHistoricalVerificationRecord']
      .map(id => [id, { module: 'src/verification/index.ts', artifact: 'src/verification/records.ts' }])),
  },
    fixture: id => ['P9-NF-64', 'P9-NF-65', 'P9-NF-66'].includes(id) || Object.hasOwn(previewFixturePaths, id),
    // The live runner's proof plans (tests/preview/proofs.ts), executed in CI through the real launcher.
    probe: id => /^P9-PREVIEW-[a-z][a-z-]*$/.test(id) && !Object.hasOwn(previewFixturePaths, id),
    test: (id, kind, path) => kind === 'fixture' ? ['P9-NF-64', 'P9-NF-65', 'P9-NF-66'].includes(id)
      && path === 'tests/verification/provider-response-assessment.test.ts' || previewFixturePaths[id] === path
      : path === 'tests/preview/proofs-launcher.test.ts' },
  'part-ten': { decoders: {
    ...Object.fromEntries(['decodeInstallationSelectionAtOrigin', 'decodeHistoricalInstallationSelection']
      .map(id => [id, { module: 'src/assembly/index.ts', artifact: 'src/assembly/installation-selection.ts' }])),
    ...Object.fromEntries(['decodeProductionSignerReferenceAtOrigin', 'decodeHistoricalProductionSignerReference']
      .map(id => [id, { module: 'src/assembly/index.ts', artifact: 'src/assembly/production-signer-reference.ts' }])),
  },
    fixture: id => Object.hasOwn(partTenFixturePaths, id),
    probe: () => false,
    test: (id, kind, path) => kind === 'fixture' && (partTenFixturePaths[id] ?? []).includes(path) },
  'part-twelve': { decoders: {},
    capture: (id, path) => ['P12-TELEGRAM-REPLY-CAPTURE', 'P12-SLACK-ENVELOPE-CAPTURE'].includes(id) && path.startsWith('tests/conversation/fixtures/'),
    fixture: id => id === 'P12-NF-19' || id === 'P12-NF-28',
    probe: () => false,
    test: (id, kind, path) => kind === 'fixture' && (
      id === 'P12-NF-19' && path === 'tests/conversation/slack-preparation.test.ts'
      || id === 'P12-NF-28' && path === 'tests/conversation/slack-reply-hold.test.ts') },
  // The shipped preview runner: its own gate/inspection tests and its reader captures.
  preview: { decoders: {},
    capture: (id, path) => /^PREVIEW-CAPTURE-[A-Z0-9-]+$/.test(id) && /^tests\/(?:preview\/fixtures|fixtures\/provider-failure)\/[^/]+$/.test(path),
    fixture: id => /^PREVIEW-[A-Z0-9-]+$/.test(id) && !id.startsWith('PREVIEW-CAPTURE-'), probe: () => false,
    test: (id, kind, path) => kind === 'fixture' && (/^tests\/preview\/[a-z0-9-]+\.test\.ts$/.test(path)
      // The provider-result parser's test on the preview's genuine Claude capture.
      || id === 'PREVIEW-PROVIDER-FAILURE-ON-CAPTURE' && path === 'tests/assembly/provider-failure.test.ts') },
};
const exact = (v, keys) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k)) || keys.some(k => !Object.hasOwn(v, k)))
    throw new Error('invalid owner reference manifest fields');
};
export function loadOwnerReferences(root, input) {
  const result = { references: [], catalog: { fixtures: [], probes: [] }, decoders: [], documents: [], captures: [], artifacts: {} };
  const seen = new Set();
  for (const path of Object.keys(input.sources)) if (path.startsWith('register-source/owner-references/') && !ownerManifestPaths.includes(path))
    throw new Error('unknown owner manifest path ' + path);
  for (const manifestPath of ownerManifestPaths) {
  const raw = input.sources[manifestPath]; if (raw === undefined) continue;
  const manifest = JSON.parse(raw);
  exact(manifest, ['schemaVersion', 'owner', 'fixtures', 'probes', 'decoders', 'documents', ...Object.hasOwn(manifest, 'captures') ? ['captures'] : []]);
  if (manifest.schemaVersion !== 1 || typeof manifest.owner !== 'string' || !Object.hasOwn(contracts, manifest.owner)) throw new Error('unknown reference owner/version');
  if (manifestPath !== ownerManifestPath && manifestPath !== `register-source/owner-references/${manifest.owner}.json`)
    throw new Error('owner manifest path disagrees with declared owner');
  if (seen.has(manifest.owner)) throw new Error('duplicate owner manifest'); seen.add(manifest.owner);
  const contract = contracts[manifest.owner];
  for (const field of ['fixtures', 'probes', 'decoders', 'documents']) if (!Array.isArray(manifest[field])) throw new Error('owner reference list required');
  const artifact = (a, path) => {
    exact(a, ['path', 'hash']);
    if (a.path !== path || !input.files.includes(path)) throw new Error('wrong-owner or missing artifact: ' + path);
    const content = input.show ? input.show(path) : execFileSync('git', ['-C', root, 'show', `${input.commit}:${path}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
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
      if (!contract.test(row.id, kind, row.artifact?.path)) throw new Error('wrong-owner inspection artifact');
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
  // Rule 36: the bytes a parser is tested against, and whether they were captured or typed.
  const captures = manifest.captures ?? []; if (!Array.isArray(captures)) throw new Error('owner reference list required');
  unique(captures, 'capture');
  for (const row of captures) {
    exact(row, ['id', 'origin', 'source', 'artifact']);
    if (!contract.capture?.(row.id, row.artifact?.path) || !['captured', 'synthetic'].includes(row.origin) || typeof row.source !== 'string' || !row.source)
      throw new Error('unknown owner capture, origin or source ' + row.id);
    artifact(row.artifact, row.artifact.path);
    result.captures.push(row); result.references.push({ provider: 'fixture', id: row.id, kind: 'captured-bytes' });
    result.catalog.fixtures.push({ id: row.id, stage: 'build', artifact: row.artifact });
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
