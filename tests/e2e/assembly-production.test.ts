import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { bootProductionAssembly, createAssemblySpine } from '../../src/assembly/index.js';
import type { AssemblyProductionCoordinator } from '../../src/assembly/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { privateKey, refused, value } from '../facts/fixtures.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { installProduction, productionComposition } from '../assembly/production-fixture.js';
// @ts-expect-error The physical file adapter is an executable JavaScript boundary.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';

function handleIdentity(coordinator: AssemblyProductionCoordinator) {
  return {
    admission: coordinator.admission.id,
    surface: coordinator.handles.surface.id,
    verifier: coordinator.handles.challengeVerifier.id,
    intake: coordinator.handles.intake.id,
    run: coordinator.handles.run.id,
    lease: coordinator.handles.lease.id,
    judgment: coordinator.handles.judgment.id,
    effect: coordinator.handles.effect.id,
    verification: coordinator.handles.verification.id,
    folds: coordinator.handles.folds.map(row => `${row.id}:${row.implementation}`),
    replay: coordinator.handles.replay.id,
    responder: coordinator.handles.minimalResponder.id,
    lifecycle: [coordinator.handles.lifecycle.cutId, coordinator.handles.lifecycle.recoveryId],
    witness: [coordinator.handles.deliveryWitness.id, coordinator.handles.deliveryWitness.identity],
    references: coordinator.references.map(row => `${row.name}:${row.reference}:${row.completeness}`),
  };
}

it('P10-NF-06 P10-NF-08 P10-NF-40 P10-NF-45 P10-NF-51 P10-NF-52 P10-NF-54 [P10-SEAM-07] durable restart recovers the same production handles after a deterministic mid-admission cut', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p10-production-'));
  const seed = assemblyRuntimeFixture(f => createTransportFileStorage(directory, <T>(run: () => T) => f.success(run())));
  const installed = installProduction(seed); const firstProduction = productionComposition(seed, installed.binding);
  const first = value(bootProductionAssembly({ ...seed.composition, production: firstProduction }, installed.manifest.id, installed.binding.scope));
  const expected = handleIdentity(first);

  value(first.handles.lifecycle.cut('route'));
  refused(bootProductionAssembly({ ...seed.composition, production: firstProduction }, installed.manifest.id, installed.binding.scope),
    'deterministic prerequisite cut: route');
  value(first.handles.lifecycle.recover('route'));

  const restartedStore = createFactStore(seed.context, seed.storage);
  const restartedSpine = createAssemblySpine(seed.host, { context: seed.context, privateKey }, restartedStore);
  const restartedProduction = productionComposition(seed, installed.binding);
  const restarted = value(bootProductionAssembly({ ...seed.composition, spine: restartedSpine, production: restartedProduction },
    installed.manifest.id, installed.binding.scope));
  expect(handleIdentity(restarted)).toEqual(expected);
  expect(restarted.references.every(row => row.completeness === 'complete')).toBe(true);

  const collision = { ...restartedProduction, requesterIdentity: restartedProduction.deliveryWitness.identity };
  const before = refused(bootProductionAssembly({ ...seed.composition, production: collision }, installed.manifest.id, installed.binding.scope),
    'witness must be distinct');
  const after = refused(bootProductionAssembly({ ...seed.composition, spine: restartedSpine, production: collision },
    installed.manifest.id, installed.binding.scope), 'witness must be distinct');
  expect(after).toBe(before);
}, 30_000);
