import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { createAssemblyRuntime, createAssemblySpine } from '../../src/assembly/index.js';
import { privateKey, value } from '../facts/fixtures.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
// @ts-expect-error The physical file adapter is an executable JavaScript boundary.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';

it('P10-NF-04 P10-NF-06 P10-NF-08 P10-NF-12 P10-NF-19 P10-NF-29 P10-NF-30 P10-NF-33 P10-NF-40 P10-NF-42 P10-NF-43 P10-NF-45 P10-NF-51 P10-NF-52 P10-NF-54 P10-NF-55 lifecycle restarts the production assembly from durable signed facts and re-resolves every dependency', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p10-assembly-'));
  const seed = assemblyRuntimeFixture(f => createTransportFileStorage(directory, <T>(run: () => T) => f.success(run())));
  const conformance = value(seed.runtime.record('AdapterConformance', assemblyInput('AdapterConformance')));
  const policy = value(seed.runtime.record('StoreCustodyPolicy', assemblyInput('StoreCustodyPolicy')));
  let rows = value(seed.runtime.inspect()); const conformanceFact = rows.find(row => row.record.id === conformance.id)!.fact.id; const policyFact = rows.find(row => row.record.id === policy.id)!.fact.id;
  const manifest = value(seed.runtime.record('AssemblyManifest', { ...assemblyInput('AssemblyManifest'), dependencyFacts: [conformanceFact, policyFact] }));
  const manifestFact = value(seed.runtime.inspect()).find(row => row.record.id === manifest.id)!.fact.id;
  value(seed.runtime.record('AssemblyAdmission', { ...assemblyInput('AssemblyAdmission'), manifest: manifest.id, conformance: [conformanceFact], dependencyFacts: [manifestFact, conformanceFact, policyFact] }));
  expect(value(seed.runtime.admit(manifest.id, 'scope:ordinary')).disposition).toBe('active');

  // Recreate the Part Two store, Part Ten spine and assembly service; no issued
  // in-memory view or caller-reported status survives the process boundary.
  const restartedStore = createFactStore(seed.context, seed.storage); const restartedSpine = createAssemblySpine(seed.host, { context: seed.context, privateKey }, restartedStore);
  const restarted = createAssemblyRuntime({ ...seed.composition, spine: restartedSpine });
  rows = value(restarted.inspect()); expect(rows.map(row => row.record.type)).toEqual(['AdapterConformance', 'StoreCustodyPolicy', 'AssemblyManifest', 'AssemblyAdmission']);
  expect(value(restarted.admit(manifest.id, 'scope:ordinary')).id).toBe('AssemblyAdmission');
}, 30_000);

it('P10-NF-20 P10-NF-26 P10-NF-28 P10-NF-32 P10-NF-35 P10-NF-36 P10-NF-38 P10-NF-44 P10-NF-46 P10-NF-47 P10-NF-48 P10-NF-49 P10-NF-50 P10-NF-53 P10-NF-56 P10-NF-57 lifecycle preserves exact observations and refuses duplicate immutable content after restart', () => {
  const f = assemblyRuntimeFixture(); value(f.runtime.record('GrowthPolicy', assemblyInput('GrowthPolicy'))); value(f.runtime.record('GrowthObservation', assemblyInput('GrowthObservation')));
  expect(value(f.runtime.inspect()).map(row => row.record.type)).toEqual(['GrowthPolicy', 'GrowthObservation']);
  const replay = value(f.runtime.record('GrowthObservation', assemblyInput('GrowthObservation'))); expect(replay.id).toBe('GrowthObservation');
  const changed = { ...assemblyInput('GrowthObservation'), sampleCount: 0, denominator: 0, completion: 'incomplete', timeouts: 1 };
  expect(() => value(f.runtime.record('GrowthObservation', changed))).toThrow(/divergent canonical content/);
});
