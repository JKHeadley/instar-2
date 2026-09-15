import { expect, it } from 'vitest';
import { bootProductionAssembly } from '../../src/assembly/index.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { installProduction, productionComposition } from '../assembly/production-fixture.js';
import { value } from '../facts/fixtures.js';
import { round17ProtectionFixture } from '../operator/round17-protection-fixture.js';

it('V95/V96 P11-NF-10/11/13 production boot exposes protected only for a complete broker receipt', () => {
  for (const [attestation, posture] of [['broker-receipt', 'protected'], ['', 'unprotected']] as const) {
    const owner = round17ProtectionFixture({ attestation });
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
    const view = value(coordinator.handles.surface.protection(owner.probe.operation, owner.probe.subject));
    expect(view.posture).toBe(posture);
    if (posture === 'unprotected') expect(view.uncertainty).toContain('broker-receipt-incomplete-or-inconsistent');
  }
}, 20000);
