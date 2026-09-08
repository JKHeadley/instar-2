import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { closeGrowthEpisode, createAssemblyRuntime, decodeAdapterConformance, decodeAssemblyRecord, deriveGrowthEpisodes, resolveActivePackage } from '../../src/assembly/index.js';
import type { AssemblyManifest, AssemblyRecordName, GrowthEpisode } from '../../src/assembly/index.js';
import { refused, value } from '../facts/fixtures.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';

function install(f: ReturnType<typeof assemblyRuntimeFixture>) {
  const conformance = value(f.runtime.record('AdapterConformance', assemblyInput('AdapterConformance')));
  const policy = value(f.runtime.record('StoreCustodyPolicy', assemblyInput('StoreCustodyPolicy')));
  const harness = value(f.runtime.record('HarnessObservation', assemblyInput('HarnessObservation')));
  const access = value(f.runtime.record('StorageAccessObservation', assemblyInput('StorageAccessObservation')));
  const rows = value(f.runtime.inspect()); const conformanceFact = rows.find(row => row.record.id === conformance.id)!.fact.id; const policyFact = rows.find(row => row.record.id === policy.id)!.fact.id;
  const harnessFact = rows.find(row => row.record.id === harness.id)!.fact.id; const accessFact = rows.find(row => row.record.id === access.id)!.fact.id;
  const manifest = value(f.runtime.record('AssemblyManifest', { ...assemblyInput('AssemblyManifest'), dependencyFacts: [conformanceFact, policyFact] }));
  const manifestFact = value(f.runtime.inspect()).find(row => row.record.id === manifest.id)!.fact.id;
  const admission = value(f.runtime.record('AssemblyAdmission', { ...assemblyInput('AssemblyAdmission'), manifest: manifest.id,
    conformance: [conformanceFact], isolationEvidence: [harnessFact], custodyEvidence: [accessFact],
    dependencyFacts: [manifestFact, conformanceFact, policyFact] }));
  return { conformance, policy, harness, access, conformanceFact, policyFact, harnessFact, accessFact, manifest, manifestFact, admission };
}

function signed<N extends AssemblyRecordName>(f: ReturnType<typeof assemblyRuntimeFixture>, name: N, overrides: object = {}) {
  const record = value(f.runtime.record(name, { ...assemblyInput(name), ...overrides }));
  const fact = value(f.runtime.inspect()).find(row => row.record.id === record.id)!.fact;
  return { record, fact };
}

function appendConflict(f: ReturnType<typeof assemblyRuntimeFixture>, row: ReturnType<typeof signed>, changes: object) {
  return value(f.spine.append(value(decodeAssemblyRecord(row.record.type, { ...row.record, ...changes }, { ...f.c, validateReferences: false }))));
}

function appendForConsumer<N extends AssemblyRecordName>(f: ReturnType<typeof assemblyRuntimeFixture>, name: N, overrides: object = {}) {
  const record = value(decodeAssemblyRecord(name, { ...assemblyInput(name), ...overrides }, { ...f.c, validateReferences: false }));
  const fact = value(f.spine.append(record)).fact;
  return { record, fact };
}

it('P10-NF-03 P10-NF-04 P10-NF-06 P10-NF-09 P10-NF-12 P10-NF-19 P10-NF-21 P10-NF-40 P10-NF-45 full public ports admit one exact protected scope', () => {
  const f = assemblyRuntimeFixture(); const installed = install(f); const admitted = value(f.runtime.admit(installed.manifest.id, 'scope:ordinary'));
  expect(admitted.id).toBe(installed.admission.id); expect(value(f.runtime.resolve(installed.admission)).admitted).toBe(true);
  f.protection('unprotected'); refused(f.runtime.admit(installed.manifest.id, 'scope:ordinary'), 'independent protection');
});

it('P10-NF-05 P10-NF-07 P10-NF-25 P10-NF-27 P10-NF-37 P10-NF-38 a record-reported pass cannot override a conflicting signed dependency', () => {
  const f = assemblyRuntimeFixture(); const installed = install(f);
  // Bypass the convenience recorder to model a validly signed concurrent fact
  // arriving from replication. The consumer must detect it from history.
  value(f.spine.append(value(decodeAdapterConformance({ ...installed.conformance, id: 'conflicting-conformance',
    artifact: installed.conformance.artifact, platform: installed.conformance.platform, mode: installed.conformance.mode,
    disposition: 'failed', limitations: ['negative fixture failed'] }, { ...f.c, validateReferences: false }))));
  const verdict = value(f.runtime.resolve(installed.manifest)); expect(verdict.admitted).toBe(false); expect(verdict.conflicts[0]).toMatchObject({ kind: 'immutable-disagreement' });
  refused(f.runtime.admit(installed.manifest.id, 'scope:ordinary'), 'conflicting signed facts');
});

it('P10-NF-08 P10-NF-20 P10-NF-26 P10-NF-28 P10-NF-30 P10-NF-33 P10-NF-43 P10-NF-55 P10-NF-56 P10-NF-57 missing referenced history remains owned uncertainty and never becomes replay permission', () => {
  const f = assemblyRuntimeFixture(); const installed = install(f);
  const absent = 'machine-z:0:999';
  // The signed-creation boundary refuses before append because the required
  // predecessor is absent from live history.
  refused(f.runtime.record('AssemblyAdmission', { ...assemblyInput('AssemblyAdmission'), id: 'admission:missing', incarnation: 'incarnation:missing',
    manifest: installed.manifest.id, conformance: [installed.conformanceFact], isolationEvidence: [installed.harnessFact],
    custodyEvidence: [installed.accessFact], dependencyFacts: [installed.manifestFact, absent] }), 'dependencyFacts reference missing');
  expect(value(f.runtime.inspect()).filter(row => row.record.type === 'AssemblyAdmission')).toHaveLength(1);
});

it('P10-NF-16 P10-NF-48 P10-NF-50 P10-NF-51 P10-NF-52 P10-NF-53 P10-NF-54 scoped loss inhibits the affected admission without rewriting the manifest', () => {
  const f = assemblyRuntimeFixture(); const installed = install(f); f.stop();
  refused(f.runtime.admit(installed.manifest.id, 'scope:ordinary'), 'stopped assembly');
  const manifests = value(f.runtime.inspect()).filter((row): row is typeof row & { record: AssemblyManifest } => row.record.type === 'AssemblyManifest');
  expect(manifests).toHaveLength(1); expect(manifests[0]!.record.manifestDigest).toBe(installed.manifest.manifestDigest);
});

it('repair1 V170-V185 V261 admission re-resolves named evidence content, tuple, freshness, and signed conflicts', () => {
  const f = assemblyRuntimeFixture(); const installed = install(f);
  appendConflict(f, { record: installed.conformance, fact: value(f.runtime.inspect()).find(row => row.fact.id === installed.conformanceFact)!.fact }, { disposition: 'failed' });
  refused(f.runtime.admit(installed.manifest.id, 'scope:ordinary'), 'conflicting signed facts');

  const missing = assemblyRuntimeFixture(); const clean = install(missing);
  appendForConsumer(missing, 'AssemblyAdmission', { id: 'admission:missing-isolation', incarnation: 'incarnation:missing', priorAdmission: clean.admission.id,
    predecessors: [value(missing.runtime.inspect()).find(row => row.record.id === clean.admission.id)!.fact.id],
    conformance: [clean.conformanceFact], isolationEvidence: ['machine-z:0:999'], custodyEvidence: [clean.accessFact], dependencyFacts: [clean.manifestFact] });
  refused(missing.runtime.admit(clean.manifest.id, 'scope:ordinary'), 'missing');

  const expired = assemblyRuntimeFixture(); const expiredInstall = install(expired); expired.time(1001);
  refused(expired.runtime.admit(expiredInstall.manifest.id, 'scope:ordinary'), 'expired');
});

it('repair1 V190-V198 V224-V225 V241-V243 package activation resolves foundations from a fresh causal head', () => {
  const f = assemblyRuntimeFixture();
  const missing = appendForConsumer(f, 'LocalCapabilityPackage', { priorPackage: 'machine-z:0:999' });
  signed(f, 'PackageTransition', { package: missing.record.namespace, observedArtifactDigest: missing.record.contentDigest, manifestDigest: missing.record.contentDigest });
  refused(resolveActivePackage(missing.record.namespace, value(f.runtime.inspectCurrent()), f.c), 'missing');

  const clean = assemblyRuntimeFixture(); const old = signed(clean, 'LocalCapabilityPackage');
  const oldStep = signed(clean, 'PackageTransition', { package: old.record.namespace, observedArtifactDigest: old.record.contentDigest, manifestDigest: old.record.contentDigest });
  const oldRows = value(clean.runtime.inspectCurrent());
  appendConflict(clean, old, { sourceDigest: `sha256:${'a'.repeat(64)}` });
  refused(resolveActivePackage(old.record.namespace, oldRows, clean.c), 'conflicted');

  const successors = assemblyRuntimeFixture(); const first = signed(successors, 'LocalCapabilityPackage');
  const firstStep = signed(successors, 'PackageTransition', { package: first.record.namespace, observedArtifactDigest: first.record.contentDigest, manifestDigest: first.record.contentDigest });
  const next = signed(successors, 'LocalCapabilityPackage', { id: 'package:v2', version: '2.0.0', contentDigest: `sha256:${'a'.repeat(64)}`,
    priorPackage: first.fact.id, predecessors: [first.fact.id], dependencyFacts: [first.fact.id] });
  signed(successors, 'PackageTransition', { id: 'transition:v2', package: next.record.namespace, observedArtifactDigest: next.record.contentDigest,
    manifestDigest: next.record.contentDigest, predecessors: [firstStep.fact.id], dependencyFacts: [next.fact.id, firstStep.fact.id], operation: 'operation:switch:2', claim: 'claim:switch:2' });
  expect(value(resolveActivePackage(next.record.namespace, value(successors.runtime.inspectCurrent()), successors.c)).id).toBe(next.record.id);
  const activeHead = value(successors.runtime.inspect()).find(row => row.record.id === 'transition:v2')!.fact.id;
  signed(successors, 'PackageTransition', { id: 'transition:retired', package: next.record.namespace, from: 'active', to: 'retired',
    predecessors: [activeHead], dependencyFacts: [activeHead], operation: 'operation:retire', claim: 'claim:retire' });
  refused(resolveActivePackage(next.record.namespace, value(successors.runtime.inspectCurrent()), successors.c), 'active package transition');
});

it('repair1 V200-V208 V227-V228 growth closure resolves signed policy/measurements and computes numeric breaches', () => {
  const f = assemblyRuntimeFixture(); const policy = signed(f, 'GrowthPolicy');
  const partial = signed(f, 'GrowthObservation', { id: 'partial', policy: policy.record.id, completion: 'incomplete', sampleCount: 0, timeouts: 1 });
  const derived = appendForConsumer(f, 'GrowthObservation', { id: 'derived', policy: policy.record.id, measurements: [partial.fact.id], predecessors: [partial.fact.id], dependencyFacts: [partial.fact.id] });
  expect(value(f.runtime.resolve(derived.record))).toMatchObject({ admitted: false, completeness: 'partial' });
  const episode: GrowthEpisode = { key: `growth:${policy.record.id}:store:fact`, policy: policy.record.id, scope: 'store:fact', state: 'open', ownerRun: 'run:growth', observations: [] };
  refused(closeGrowthEpisode(episode, derived.record, f.c), 'partial');
  refused(closeGrowthEpisode(episode, assemblyInput('GrowthObservation'), f.c), 'absent from signed history');

  const mislabeled = { ...assemblyInput('GrowthObservation'), id: 'mislabeled', policy: policy.record.id,
    comparisons: [{ ...assemblyInput('GrowthObservation').comparisons[0]!, value: 50, threshold: 100, result: 'within' as const }] };
  const signedMislabeled = signed(f, 'GrowthObservation', mislabeled);
  refused(closeGrowthEpisode(episode, signedMislabeled.record, f.c), 'signed policy threshold');
  expect(value(deriveGrowthEpisodes(policy.record, [mislabeled as unknown as typeof derived.record], [], f.c))[0]?.state).toBe('open');
});
