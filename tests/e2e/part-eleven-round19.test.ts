import { groundedAssemblyRuntimeFixture, genuineProductionComposition, installProduction } from '../assembly/genuine-production-fixture.js';
import { expect, it } from 'vitest';
import { bootProductionAssembly } from '../../src/assembly/index.js';
import { canonical } from '../../src/index.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { productionComposition } from '../assembly/production-fixture.js';
import { value } from '../facts/fixtures.js';
import { round17ProtectionFixture } from '../operator/round17-protection-fixture.js';

function bootWithReceipt(base: string) {
  const seed = round17ProtectionFixture(), original = seed.receipt;
  const requestDigest = value(canonical({ operation: original.operation, path: original.path, base,
    proposedHash: original.proposedHash, authorization: original.authorization }));
  const owner = round17ProtectionFixture({ base, requestDigest: requestDigest.hash });
  const assembly = groundedAssemblyRuntimeFixture(), installed = installProduction(assembly);
  const composed = genuineProductionComposition(assembly, installed.binding);
  const production = { ...composed,
    surface: { ...owner.surface, id: installed.binding.surface.adapter.implementation },
    challengeVerifier: { id: installed.binding.surface.challengeVerifier.implementation, port: owner.operator.verifier },
    verifiedActIntake: { owner: 'part-four' as const, id: installed.binding.verifiedActIntake.implementation,
      operation: 'admitVerifiedAct' as const, port: owner.operator.port() },
    verification: { id: composed.verification.id, port: owner.verification.runtime },
    verificationClock: { owner: 'part-nine' as const, administration: 'independent' as const,
      id: composed.verificationClock.id, current: () => assembly.success(owner.verification.host.current().clock) },
  };
  const coordinator = value(bootProductionAssembly({ ...assembly.composition, production },
    installed.manifest.id, installed.binding.scope));
  return value(coordinator.handles.surface.protection(owner.probe.operation, owner.probe.subject));
}

it('V77/V78 e2e: production boot never promotes a receipt for a non-current owner base', () => {
  expect(bootWithReceipt('base:1')).toMatchObject({ posture: 'protected', uncertainty: [] });
  expect(bootWithReceipt('base:different')).toMatchObject({
    posture: 'unprotected', effectiveBase: 'base:different', witnessFresh: true, isolationLive: true,
    uncertainty: expect.arrayContaining(['broker-receipt-current-base-mismatch']),
  });
}, 20_000);
