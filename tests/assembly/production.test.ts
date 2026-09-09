import { expect, it } from 'vitest';
import { bootProductionAssembly, decodeAssemblyManifest, inspectProductionAssemblyBindings } from '../../src/assembly/index.js';
import { requiredMinimalDependencies } from '../../src/operator/index.js';
import { refused, value } from '../facts/fixtures.js';
import { assemblyInput } from './fixture.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';
import { installProduction, productionBindingSet, productionComposition, productionPublicPorts } from './production-fixture.js';

const clone = <T>(input: T): T => JSON.parse(JSON.stringify(input)) as T;

it('P10-NF-01 P10-NF-04 P10-NF-51 P10-NF-52 P10-NF-53 [P10-SEAM-01] the manifest declares all seven production binding groups as a closed additive contract', () => {
  const f = assemblyRuntimeFixture(); const binding = productionBindingSet();
  const manifest = { ...assemblyInput('AssemblyManifest'), publicPorts: productionPublicPorts(binding.scope), productionBindings: [binding] };
  const context = { ...f.c, validateReferences: false };
  const decoded = value(decodeAssemblyManifest(manifest, context));
  expect(Object.keys(decoded.productionBindings![0]!).sort()).toEqual([
    'scope', 'surface', 'verifiedActIntake', 'minimalPlane', 'minimalResponder', 'dependencies', 'lifecycle', 'deliveryWitness',
  ].sort());
  expect(decoded.productionBindings![0]!.minimalPlane.folds).toHaveLength(6);
  expect(decoded.productionBindings![0]!.dependencies.map(row => row.name)).toEqual(requiredMinimalDependencies);

  const missing = clone(manifest) as any; delete missing.productionBindings[0].verifiedActIntake;
  refused(decodeAssemblyManifest(missing, context), 'missing field');
  const wrongOperation = clone(manifest) as any; wrongOperation.productionBindings[0].verifiedActIntake.operation = 'receive';
  refused(decodeAssemblyManifest(wrongOperation, context), 'admitVerifiedAct');
  const missingFold = clone(manifest) as any; missingFold.productionBindings[0].minimalPlane.folds.pop();
  refused(decodeAssemblyManifest(missingFold, context), 'six minimal-plane');
});

it('P10-NF-21 P10-NF-45 P10-NF-53 [P10-SEAM-02] the platform witness identity cannot equal requester, surface, or effect adapter', () => {
  const f = assemblyRuntimeFixture(); const binding = productionBindingSet();
  for (const collision of [binding.deliveryWitness.requester, binding.surface.adapter.implementation, binding.deliveryWitness.effectAdapter]) {
    const changed = clone(binding) as any; changed.deliveryWitness.identity = collision;
    refused(decodeAssemblyManifest({ ...assemblyInput('AssemblyManifest'), publicPorts: productionPublicPorts(binding.scope),
      productionBindings: [changed] }, f.c), 'delivery witness/requester/surface/effect identities');
  }
});

it('P11-V31 resolves the conversation-route role by its fixed signed-history kind, never the manifest caller\'s expectedKind', () => {
  const f = assemblyRuntimeFixture(), base = productionBindingSet();
  const clock = base.dependencies.find(row => row.name === 'clock')!;
  const binding = { ...base, dependencies: base.dependencies.map(row => row.name === 'route'
    ? { ...row, fact: clock.fact } : row) };
  const installed = installProduction(f, binding);
  refused(bootProductionAssembly({ ...f.composition, production: productionComposition(f, binding) },
    installed.manifest.id, binding.scope), 'conversation-route');
});

it('P10-NF-05 P10-NF-52 P10-NF-54 [P10-SEAM-03] a resolvable partial binding is retained as partial and never promoted into boot handles', () => {
  const f = assemblyRuntimeFixture();
  const partial = value(f.runtime.record('GrowthObservation', { ...assemblyInput('GrowthObservation'), id: 'binding:partial-source',
    completion: 'incomplete', sampleCount: 0, timeouts: 1 }));
  const base = productionBindingSet();
  const binding = { ...base, dependencies: base.dependencies.map(row => row.name === 'local-facts'
    ? { ...row, fact: { reference: partial.id, expectedKind: 'assembly-GrowthObservation', required: true as const } } : row) };
  const installed = installProduction(f, binding);
  const composition = { ...f.composition, production: productionComposition(f, binding) };
  const resolved = value(inspectProductionAssemblyBindings(composition, installed.manifest.id, binding.scope));
  expect(resolved.find(row => row.name === 'dependency:local-facts')).toMatchObject({ completeness: 'partial', missing: [] });
  const stored = value(f.runtime.inspect()).find(row => row.record.id === installed.manifest.id);
  if (stored?.record.type !== 'AssemblyManifest') throw new Error('production manifest not retained');
  expect(stored.record.productionBindings![0]!.dependencies.find(row => row.name === 'local-facts')!.fact.reference).toBe(partial.id);
  refused(bootProductionAssembly(composition, installed.manifest.id, binding.scope), 'honestly partial');
});

it('P11-V40 R4 every required confirmation operation must be callable before production boot', () => {
  const names = ['render', 'pending', 'challenge', 'confirm', 'binding', 'protection', 'stopChallenge', 'stop'] as const;
  for (const name of names) {
    const f = assemblyRuntimeFixture(); const binding = productionBindingSet(); const installed = installProduction(f, binding);
    const production = productionComposition(f, binding);
    const surface = { ...production.surface, [name]: undefined };
    refused(bootProductionAssembly({ ...f.composition, production: { ...production, surface } as typeof production },
      installed.manifest.id, binding.scope), `OperatorSurfacePort.${name}`);
  }
}, 60_000);
