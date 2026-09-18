import { groundedAssemblyRuntimeFixture, genuineProductionComposition, installProduction } from '../assembly/genuine-production-fixture.js';
import { expect, it } from 'vitest';
import { bootProductionAssembly } from '../../src/assembly/index.js';
import { refused, value } from '../facts/fixtures.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { appendProductionBindingFacts, assertDependencyRoster, productionBindingSet,
  productionComposition } from '../assembly/production-fixture.js';

it('P10-NF-03 P10-NF-04 P10-NF-40 P10-NF-45 P10-NF-51 P10-NF-52 [P10-SEAM-04] the full public assembly boot returns one coordinator with every owner handle', () => {
  const f = groundedAssemblyRuntimeFixture(); const binding = productionBindingSet(); assertDependencyRoster(binding);
  const installed = installProduction(f, binding); const production = genuineProductionComposition(f, binding);
  const coordinator = value(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, binding.scope));
  expect(coordinator).toMatchObject({ owner: 'part-ten', scope: binding.scope, admission: { id: installed.admission.id, disposition: 'active' } });
  expect(Object.keys(coordinator.handles)).toEqual([
    'persistence', 'harnesses', 'model', 'intake', 'run', 'lease', 'judgment', 'effect', 'verification', 'verificationClock', 'surface',
    'challengeVerifier', 'folds', 'replay', 'minimalResponder', 'dependencyAdmission', 'dependencies', 'lifecycle', 'deliveryWitness',
  ]);
  expect(coordinator.handles.folds.map(row => row.id)).toEqual(binding.minimalPlane.folds.map(row => row.projection));
  expect(Object.keys(coordinator.handles.dependencies)).toEqual(binding.dependencies.map(row => row.name));
  expect(coordinator.references).toHaveLength(24);
  expect(coordinator.references.every(row => row.completeness === 'complete')).toBe(true);
  expect(coordinator.handles.intake.operation).toBe('admitVerifiedAct');
  expect(coordinator.handles.replay.sourceOnly).toBe(true);
  expect(coordinator.handles.minimalResponder.budgets).toEqual(binding.minimalResponder.budgets);
});

it('P10-NF-04 P10-NF-05 P10-NF-52 P10-NF-53 [P10-SEAM-05] missing, wrong-kind, or live-unavailable required production bindings refuse', () => {
  const missing = assemblyRuntimeFixture(); const missingInstalled = installProduction(missing);
  refused(bootProductionAssembly(missing.composition, missingInstalled.manifest.id, missingInstalled.binding.scope), 'bindings are unavailable');

  const wrong = assemblyRuntimeFixture(); const base = productionBindingSet();
  appendProductionBindingFacts(wrong, base);
  const wrongBinding = { ...base, dependencies: base.dependencies.map(row => row.name === 'route'
    ? { ...row, fact: { ...row.fact, expectedKind: 'clock-source' } } : row) };
  const wrongInstalled = installProduction(wrong, wrongBinding, { uncheckedManifest: true });
  refused(bootProductionAssembly({ ...wrong.composition, production: productionComposition(wrong, wrongBinding) },
    wrongInstalled.manifest.id, wrongBinding.scope), 'wrong signed kind');

  const unavailable = assemblyRuntimeFixture(); const unavailableInstalled = installProduction(unavailable);
  const live = productionComposition(unavailable, unavailableInstalled.binding);
  const unavailableProduction = { ...live, dependencyAdmission: { ...live.dependencyAdmission,
    admit: (input: Parameters<typeof live.dependencyAdmission.admit>[0]) => {
      if (input.name === 'replication-peer') throw new Error('replicated(1) peer acknowledgement unavailable');
      return live.dependencyAdmission.admit(input);
    } } };
  refused(bootProductionAssembly({ ...unavailable.composition, production: unavailableProduction },
    unavailableInstalled.manifest.id, unavailableInstalled.binding.scope), 'peer acknowledgement unavailable');

  const falsePeer = { ...live, dependencyAdmission: { ...live.dependencyAdmission,
    admit: (input: Parameters<typeof live.dependencyAdmission.admit>[0]) => input.name === 'replication-peer'
      ? unavailable.success({ name: 'replication-peer', reference: input.fact.id, provider: 'peer:fixture', current: true,
        replicas: 0, distinctPeer: false } as any)
      : live.dependencyAdmission.admit(input) } };
  refused(bootProductionAssembly({ ...unavailable.composition, production: falsePeer },
    unavailableInstalled.manifest.id, unavailableInstalled.binding.scope), 'replicated(1)');
}, 30_000);

it('P10-NF-21 P10-NF-45 P10-NF-53 [P10-SEAM-06] boot rechecks actual witness separation instead of trusting manifest identities', () => {
  const f = assemblyRuntimeFixture(); const binding = productionBindingSet(); const installed = installProduction(f, binding);
  const production = productionComposition(f, binding);
  const colliding = { ...production, requesterIdentity: production.deliveryWitness.identity };
  refused(bootProductionAssembly({ ...f.composition, production: colliding }, installed.manifest.id, binding.scope),
    'witness must be distinct');

  const effectCollision = { ...production, effectAdapterIdentity: production.deliveryWitness.identity };
  refused(bootProductionAssembly({ ...f.composition, production: effectCollision }, installed.manifest.id, binding.scope),
    'witness must be distinct');
});
