import { groundedAssemblyRuntimeFixture, genuineProductionComposition, installProduction } from './genuine-production-fixture.js';
import { expect, it } from 'vitest';
import { bootProductionAssembly } from '../../src/assembly/index.js';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { assemblyRuntimeFixture } from './round8-extended-fixture.js';
import { productionBindingSet, productionComposition } from './production-fixture.js';

const accepted = <T>(result: Result<T>) => consumeResult(result, {
  Success: () => true, Refused: () => false,
});

it('V70 P11-NF-49 P11-NF-51 a blank platform cannot satisfy the required production delivery witness binding', () => {
  const f = assemblyRuntimeFixture(), original = productionBindingSet();
  const binding = { ...original, deliveryWitness: { ...original.deliveryWitness, platform: '' } };
  const installed = installProduction(f, binding), production = productionComposition(f, binding);
  expect(accepted(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, binding.scope))).toBe(false);
});

it('V71 P11-NF-49 P11-NF-51 a named platform remains an accepted production delivery witness binding', () => {
  const f = groundedAssemblyRuntimeFixture(), binding = productionBindingSet();
  const installed = installProduction(f, binding), production = genuineProductionComposition(f, binding);
  expect(accepted(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, binding.scope))).toBe(true);
});
