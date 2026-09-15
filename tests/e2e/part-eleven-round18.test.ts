import { expect, it } from 'vitest';
import { bootProductionAssembly } from '../../src/assembly/index.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { installProduction, productionComposition } from '../assembly/production-fixture.js';
import { value } from '../facts/fixtures.js';
import { productionOperatorSlice } from '../operator/production-slice-fixture.js';
import { round17ProtectionFixture } from '../operator/round17-protection-fixture.js';

it.each([
  ['V34', { requestDigest: 'sha256:ec4f4867aab7956d84387a390eb63ddcf74f9d78803c1ebd306dfba45467ae89' }],
  ['V35', { authorization: 'authorization:other' }],
  ['V36', { base: 'base:other' }],
] as const)('%s e2e: the public production coordinator exposes contradictory broker evidence as unprotected',
  (_case, patch) => {
    const owner = round17ProtectionFixture(patch);
    const assembly = assemblyRuntimeFixture(), installed = installProduction(assembly);
    const base = productionComposition(assembly, installed.binding);
    const production = { ...base,
      surface: { ...owner.surface, id: installed.binding.surface.adapter.implementation },
      challengeVerifier: { id: installed.binding.surface.challengeVerifier.implementation, port: owner.operator.verifier },
      verifiedActIntake: { owner: 'part-four' as const, id: installed.binding.verifiedActIntake.implementation,
        operation: 'admitVerifiedAct' as const, port: owner.operator.port() },
      verification: { id: base.verification.id, port: owner.verification.runtime },
      verificationClock: { owner: 'part-nine' as const, administration: 'independent' as const,
        id: base.verificationClock.id, current: () => assembly.success(owner.verification.host.current().clock) },
    };
    const coordinator = value(bootProductionAssembly({ ...assembly.composition, production },
      installed.manifest.id, installed.binding.scope));
    expect(value(coordinator.handles.surface.protection(owner.probe.operation, owner.probe.subject)))
      .toMatchObject({ posture: 'unprotected', brokerReceipt: null,
        uncertainty: expect.arrayContaining(['broker-receipt-incomplete-or-inconsistent']) });
  });

it('V79 P11-NF-33/36/38/42/49 re-resolves the owner generation before dispatch and owns the outage', async () => {
  const fixture = productionOperatorSlice(), original = fixture.production.dependencyAdmission.admit;
  fixture.production.dependencyAdmission.admit = (input => {
    const handle = value(original(input));
    return fixture.assembly.success(input.name === 'register' ? { ...handle, generation: 'generation:other' } : handle);
  }) as typeof original;
  const report = await fixture.runtime.drive();
  expect(fixture.runtime.service.journal().applications).toHaveLength(0);
  expect(report.externalApplications).toHaveLength(0);
  expect(report.preservedInput).toBeTruthy();
  expect(report.obligations).toContainEqual(expect.objectContaining({
    state: 'owned-pending-prerequisite-outage', owner: 'part-ten', blocker: 'register',
  }));
  expect(report.steps).toContainEqual(expect.objectContaining({ step: 'prerequisites', state: 'refused',
    detail: expect.stringMatching(/generation:other.*generation:fixture/) }));
  expect(report.independentlyWitnessedResult.stage).toBe('not-reached');
}, 120_000);
