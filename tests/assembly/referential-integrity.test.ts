import { expect, it } from 'vitest';
import { authorAndAppend } from '../../src/facts/index.js';
import { closeGrowthEpisode, decodeAssemblyRecord, resolveActivePackage } from '../../src/assembly/index.js';
import type { AssemblyRecordName, GrowthEpisode } from '../../src/assembly/index.js';
import { privateKey, refused, value } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';

type Runtime = ReturnType<typeof assemblyRuntimeFixture>;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const json = (value: unknown): import('../../src/index.js').Json => JSON.parse(JSON.stringify(value)) as import('../../src/index.js').Json;

function signed<N extends AssemblyRecordName>(f: Runtime, name: N, overrides: object = {}) {
  const record = value(f.runtime.record(name, { ...clone(assemblyInput(name)), ...overrides }));
  const fact = value(f.runtime.inspect()).find(row => row.record.id === record.id)!.fact;
  return { record, fact };
}

function appendForConsumer<N extends AssemblyRecordName>(f: Runtime, name: N, overrides: object = {}) {
  const record = value(decodeAssemblyRecord(name, { ...clone(assemblyInput(name)), ...overrides }, { ...f.c, validateReferences: false }));
  return { record, fact: value(f.spine.append(record)).fact };
}

function evidenceFact(f: Runtime) {
  const bytes = f.captures[f.e.capture.reference]!;
  Object.assign(f.context.captures, { [f.e.capture.reference]: {
    hash: f.e.capture.hash, bytes, byteLength: Buffer.byteLength(bytes), status: 'available',
  } });
  return value(authorAndAppend({ kind: 'astra-source-evidence', schemaVersion: 1, machine: 'machine-a',
    principal: json(f.alice), provenance: json(f.alice.provenance), at: json(f.clock(100)),
    body: { evidence: json(f.e) }, required: [],
  }, f.context, f.store, privateKey)).fact;
}

function installForConsumer(f: Runtime, options: { checkRun?: string; probe?: string } = {}) {
  const conformance = appendForConsumer(f, 'AdapterConformance', options.checkRun ? {
    stageChecks: [{ stage: 'context', checkRun: options.checkRun, positive: ['positive'], negative: ['negative'] }],
  } : {});
  const harness = signed(f, 'HarnessObservation');
  const access = signed(f, 'StorageAccessObservation');
  const manifest = signed(f, 'AssemblyManifest');
  const admission = appendForConsumer(f, 'AssemblyAdmission', {
    conformance: [conformance.fact.id], isolationEvidence: [harness.fact.id], custodyEvidence: [access.fact.id],
    probeEvidence: [options.probe ?? 'probe:1'], dependencyFacts: [manifest.fact.id],
  });
  return { conformance, harness, access, manifest, admission };
}

const episode: GrowthEpisode = { key: 'growth:GrowthPolicy:store:fact', policy: 'GrowthPolicy', scope: 'store:fact',
  state: 'open', ownerRun: 'run:growth', observations: [] };

function admissionInput(f: Runtime, custodyEvidence: readonly string[]) {
  const conformance = signed(f, 'AdapterConformance'); const harness = signed(f, 'HarnessObservation');
  const access = signed(f, 'StorageAccessObservation'); const manifest = signed(f, 'AssemblyManifest');
  return { ...clone(assemblyInput('AssemblyAdmission')), manifest: manifest.record.id, conformance: [conformance.fact.id],
    isolationEvidence: [harness.fact.id], custodyEvidence, probeEvidence: ['probe:1'] };
}

it('repair2 V99 refuses a missing custody reference during signed AssemblyAdmission creation', () => {
  const f = assemblyRuntimeFixture();
  refused(f.runtime.record('AssemblyAdmission', admissionInput(f, ['custody:absent-repair2'])), 'custodyEvidence reference missing');
});

it.each([
  ['V107', 'AdapterConformance', 'contract', 'contract:absent-repair2'],
  ['V113', 'LocalCapabilityPackage', 'priorPackage', 'package:absent-repair2'],
  ['V119', 'GrowthObservation', 'policy', 'policy:absent-repair2'],
] as const)('repair2 %s refuses a missing required semantic reference during signed creation', (_case, name, field, reference) => {
  const f = assemblyRuntimeFixture();
  refused(f.runtime.record(name, { ...clone(assemblyInput(name)), [field]: reference }), 'missing from signed history');
});

it('repair2 V100 refuses a wrong-kind custody reference during signed AssemblyAdmission creation', () => {
  const f = assemblyRuntimeFixture(); const wrong = signed(f, 'GrowthPolicy');
  refused(f.runtime.record('AssemblyAdmission', admissionInput(f, [wrong.fact.id])), 'custodyEvidence reference has wrong signed record kind');
});

it.each([
  ['V108', 'AdapterConformance', 'contract', 'GrowthObservation'],
  ['V114', 'LocalCapabilityPackage', 'priorPackage', 'GrowthObservation'],
  ['V120', 'GrowthObservation', 'policy', 'AssemblyManifest'],
] as const)('repair2 %s refuses a wrong-kind required semantic reference during signed creation', (_case, name, field, wrongName) => {
  const f = assemblyRuntimeFixture(); const wrong = signed(f, wrongName);
  refused(f.runtime.record(name, { ...clone(assemblyInput(name)), [field]: wrong.fact.id }), 'wrong signed record kind');
});

it('repair2 F20 withdraws admission for a missing named probe regardless of identifier spelling', () => {
  const f = assemblyRuntimeFixture(); installForConsumer(f, { probe: 'probe:absent-repair2' });
  refused(f.runtime.admit('AssemblyManifest', 'scope:ordinary'), 'missing');
});

it('repair2 F21 withdraws admission for a missing named check run regardless of identifier spelling', () => {
  const f = assemblyRuntimeFixture(); installForConsumer(f, { checkRun: 'check-run:absent-repair2' });
  refused(f.runtime.admit('AssemblyManifest', 'scope:ordinary'), 'missing');
});

it('repair2 F22 withdraws package availability for a missing named prior package', () => {
  const f = assemblyRuntimeFixture(); const pkg = appendForConsumer(f, 'LocalCapabilityPackage', { priorPackage: 'package:absent-repair2' });
  signed(f, 'PackageTransition', { package: pkg.record.namespace, manifestDigest: pkg.record.contentDigest, observedArtifactDigest: pkg.record.contentDigest });
  refused(resolveActivePackage(pkg.record.namespace, value(f.runtime.inspectCurrent()), f.c), 'missing');
});

it('repair2 F23 prevents closure for a missing named measurement', () => {
  const f = assemblyRuntimeFixture(); const observation = appendForConsumer(f, 'GrowthObservation', { measurements: ['measurement:absent-repair2'] });
  refused(closeGrowthEpisode(episode, observation.record, f.c), 'measurement:absent-repair2');
});

it('repair2 F24 rejects generic signed Evidence as a GrowthPolicy during history resolution', () => {
  const f = assemblyRuntimeFixture(); const evidence = evidenceFact(f);
  const observation = appendForConsumer(f, 'GrowthObservation', { policy: evidence.id });
  const verdict = value(f.runtime.resolve(observation.record));
  expect(verdict.admitted).toBe(false); expect(verdict.conflicts[0]?.detail).toContain('GrowthPolicy');
});

it('repair2 F29 withdraws admission when a GrowthPolicy substitutes for a check run', () => {
  const f = assemblyRuntimeFixture(); const wrong = signed(f, 'GrowthPolicy'); installForConsumer(f, { checkRun: wrong.fact.id });
  refused(f.runtime.admit('AssemblyManifest', 'scope:ordinary'), 'CheckRunRecord');
});

it('repair2 F30 withdraws admission when a GrowthPolicy substitutes for probe evidence', () => {
  const f = assemblyRuntimeFixture(); const wrong = signed(f, 'GrowthPolicy'); installForConsumer(f, { probe: wrong.fact.id });
  refused(f.runtime.admit('AssemblyManifest', 'scope:ordinary'), 'ProbeRecord');
});

it('repair2 F31 prevents closure when StoreCustodyPolicy substitutes for a Measurement', () => {
  const f = assemblyRuntimeFixture(); const wrong = signed(f, 'StoreCustodyPolicy');
  const observation = appendForConsumer(f, 'GrowthObservation', { measurements: [wrong.fact.id] });
  refused(closeGrowthEpisode(episode, observation.record, f.c), 'Measurement');
});
