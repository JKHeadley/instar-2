import { expect, it } from 'vitest';
import { bootProductionAssembly } from '../../src/assembly/index.js';
import type { AssemblyProductionCoordinator } from '../../src/assembly/index.js';
import { consumeResult } from '../../src/index.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { installProduction, productionBindingSet, productionComposition } from '../assembly/production-fixture.js';
import { value } from '../facts/fixtures.js';
import { round17ProtectionFixture } from '../operator/round17-protection-fixture.js';

it.each([
  ['V34', { requestDigest: 'sha256:ec4f4867aab7956d84387a390eb63ddcf74f9d78803c1ebd306dfba45467ae89' }],
  ['V35', { authorization: 'authorization:other' }],
  ['V36', { base: 'base:other' }],
] as const)('%s integration: current Part Nine evidence cannot protect a contradictory broker receipt', (_case, patch) => {
  expect(round17ProtectionFixture(patch).protection()).toMatchObject({ posture: 'unprotected', brokerReceipt: null,
    uncertainty: expect.arrayContaining(['broker-receipt-incomplete-or-inconsistent']) });
});

it.each([
  ['V77', 'generation:fixture', true],
  ['V78', 'generation:other', false],
] as const)('%s P11-NF-33/36/38/42/49 compares the register handle with the owner current generation',
  (_case, generation, accepted) => {
    const fixture = assemblyRuntimeFixture(), binding = productionBindingSet();
    const installed = installProduction(fixture, binding), base = productionComposition(fixture, binding);
    const production = { ...base, dependencyAdmission: { ...base.dependencyAdmission,
      admit(input: Parameters<typeof base.dependencyAdmission.admit>[0]) {
        const handle = value(base.dependencyAdmission.admit(input));
        return fixture.success(input.name === 'register' ? { ...handle, generation } : handle);
      },
    } };
    let detail = '';
    const result = consumeResult<AssemblyProductionCoordinator, boolean>(bootProductionAssembly({ ...fixture.composition, production },
      installed.manifest.id, binding.scope), {
      Success: () => true,
      Refused: refusal => { detail = refusal.detail; return false; },
    });
    expect(result).toBe(accepted);
    if (!result) {
      expect(detail).toContain('generation:other');
      expect(detail).toContain('generation:fixture');
    }
  });
