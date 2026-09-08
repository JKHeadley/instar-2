import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createAssemblyRuntime, decodeAdapterConformance } from '../../src/assembly/index.js';
import type { AdapterConformance, AssemblyManifest } from '../../src/assembly/index.js';
import { refused, value } from '../facts/fixtures.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';

function install(f: ReturnType<typeof assemblyRuntimeFixture>) {
  const conformance = value(f.runtime.record('AdapterConformance', assemblyInput('AdapterConformance')));
  const policy = value(f.runtime.record('StoreCustodyPolicy', assemblyInput('StoreCustodyPolicy')));
  const rows = value(f.runtime.inspect()); const conformanceFact = rows.find(row => row.record.id === conformance.id)!.fact.id; const policyFact = rows.find(row => row.record.id === policy.id)!.fact.id;
  const manifest = value(f.runtime.record('AssemblyManifest', { ...assemblyInput('AssemblyManifest'), dependencyFacts: [conformanceFact, policyFact] }));
  const manifestFact = value(f.runtime.inspect()).find(row => row.record.id === manifest.id)!.fact.id;
  const admission = value(f.runtime.record('AssemblyAdmission', { ...assemblyInput('AssemblyAdmission'), manifest: manifest.id,
    conformance: [conformanceFact], dependencyFacts: [manifestFact, conformanceFact, policyFact] }));
  return { conformance, policy, conformanceFact, policyFact, manifest, manifestFact, admission };
}

it('P10-NF-03 P10-NF-04 P10-NF-06 P10-NF-09 P10-NF-12 P10-NF-19 P10-NF-21 P10-NF-40 P10-NF-45 full public ports admit one exact protected scope', () => {
  const f = assemblyRuntimeFixture(); const installed = install(f); const admitted = value(f.runtime.admit(installed.manifest.id, 'scope:ordinary'));
  expect(admitted.id).toBe(installed.admission.id); expect(value(f.runtime.resolve(installed.admission)).admitted).toBe(true);
  f.protection('unprotected'); refused(f.runtime.admit(installed.manifest.id, 'scope:ordinary'), 'independent protection');
});

it('P10-NF-05 P10-NF-07 P10-NF-25 P10-NF-27 P10-NF-37 P10-NF-38 a record-reported pass cannot override a conflicting signed dependency', () => {
  const f = assemblyRuntimeFixture(); const installed = install(f);
  const conflicting: AdapterConformance = value(f.runtime.record('AdapterConformance', { ...assemblyInput('AdapterConformance'), id: 'other-conformance', contract: 'other-contract', mode: 'other-mode' }));
  // Bypass the convenience recorder to model a validly signed concurrent fact
  // arriving from replication. The consumer must detect it from history.
  value(f.spine.append(value(decodeAdapterConformance({ ...conflicting, id: 'conflicting-conformance', contract: installed.conformance.contract,
    artifact: installed.conformance.artifact, platform: installed.conformance.platform, mode: installed.conformance.mode,
    disposition: 'failed', limitations: ['negative fixture failed'] }, f.c))));
  const verdict = value(f.runtime.resolve(installed.manifest)); expect(verdict.admitted).toBe(false); expect(verdict.conflicts[0]).toMatchObject({ kind: 'immutable-disagreement' });
  refused(f.runtime.admit(installed.manifest.id, 'scope:ordinary'), 'conflicting signed facts');
});

it('P10-NF-08 P10-NF-20 P10-NF-26 P10-NF-28 P10-NF-30 P10-NF-33 P10-NF-43 P10-NF-55 P10-NF-56 P10-NF-57 missing referenced history remains owned uncertainty and never becomes replay permission', () => {
  const f = assemblyRuntimeFixture(); const installed = install(f);
  const absent = 'machine-z:0:999';
  // A decoded candidate can claim success, but it cannot be appended because the
  // part-two causal boundary cannot resolve the required signed predecessor.
  refused(f.runtime.record('AssemblyAdmission', { ...assemblyInput('AssemblyAdmission'), id: 'admission:missing', incarnation: 'incarnation:missing',
    manifest: installed.manifest.id, conformance: [installed.conformanceFact], dependencyFacts: [installed.manifestFact, absent] }), 'dangling causal reference');
  expect(value(f.runtime.inspect()).filter(row => row.record.type === 'AssemblyAdmission')).toHaveLength(1);
});

it('P10-NF-16 P10-NF-48 P10-NF-50 P10-NF-51 P10-NF-52 P10-NF-53 P10-NF-54 scoped loss inhibits the affected admission without rewriting the manifest', () => {
  const f = assemblyRuntimeFixture(); const installed = install(f); f.stop();
  refused(f.runtime.admit(installed.manifest.id, 'scope:ordinary'), 'stopped assembly');
  const manifests = value(f.runtime.inspect()).filter((row): row is typeof row & { record: AssemblyManifest } => row.record.type === 'AssemblyManifest');
  expect(manifests).toHaveLength(1); expect(manifests[0]!.record.manifestDigest).toBe(installed.manifest.manifestDigest);
});
