import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { bootProductionAssembly } from '../../src/assembly/index.js';
import { assemblyRuntimeFixture } from '../assembly/round8-extended-fixture.js';
import { installProduction, productionBindingSet, productionComposition } from '../assembly/production-fixture.js';
import { operatorFixture } from '../operator/fixture.js';
import { productionOperatorSlice } from '../operator/production-slice-fixture.js';
import { refused, value } from '../intake/fixtures.js';
// @ts-expect-error The production slice is an executable JavaScript boundary.
import { bootProductionSliceAssembly, sliceConfig } from '../../scripts/slice-assembly.mjs';

beforeEach(() => new Promise<void>(resolve => setImmediate(resolve)));
afterEach(() => new Promise<void>(resolve => setImmediate(resolve)));

it('rereview6 V78 missing durable route fact refuses production boot', () => {
  const f = assemblyRuntimeFixture(), binding = productionBindingSet(), installed = installProduction(f, binding);
  const production = productionComposition(f, binding);
  const index = f.raw.findIndex((row: any) => row.kind === 'conversation-route');
  expect(index).toBeGreaterThanOrEqual(0);
  f.raw.splice(index, 1);
  refused(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, binding.scope));
});

it('rereview6 V79 unavailable challenge verifier method refuses production boot', () => {
  const f = assemblyRuntimeFixture(), binding = productionBindingSet(), installed = installProduction(f, binding);
  const production = productionComposition(f, binding);
  production.challengeVerifier.port.verify = null as never;
  refused(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, binding.scope), 'verify');
});

it('R8-F2 verification current-clock wiring is mandatory at production boot', () => {
  const f = assemblyRuntimeFixture(), binding = productionBindingSet(), installed = installProduction(f, binding);
  const production = productionComposition(f, binding);
  production.verificationClock.current = null as never;
  refused(bootProductionAssembly({ ...f.composition, production }, installed.manifest.id, binding.scope),
    'AssemblyVerificationClockPort.current');
});

it('rereview6 V80 fresh independently verified stop remains usable during a binding conflict', () => {
  const f = operatorFixture();
  f.bind();
  f.bind({ sender: 'another', identityEpoch: 'other' });
  const surface = f.surface();
  const challenge = value(surface.stopChallenge({ operator: 'alice', scope: f.f.scope }));
  const stop = value(surface.stop({ challenge, proof: 'independent', scope: f.f.scope }));
  expect(stop.owner).toBe('part-two');
  expect(f.stopped).toHaveLength(1);
});

async function delivery(change: 'clean' | 'missing' | 'wrong-stage' | 'wrong-operation' | 'stale') {
  const f = productionOperatorSlice();
  const observe = f.production.deliveryWitness.observe;
  f.production.deliveryWitness.observe = (operation => {
    const receipt = observe(operation);
    if (change === 'missing') f.verification.setEvidence([]);
    if (change === 'stale') f.verification.time(1000);
    if (change === 'wrong-stage') return f.assembly.success({ ...value(receipt) as object, stage: 'reader-read' });
    if (change === 'wrong-operation') return f.assembly.success({ ...value(receipt) as object, operation: 'other-operation' });
    return receipt;
  }) as typeof observe;
  if (change === 'clean') {
    const report = await f.runtime.drive();
    expect(report.independentlyWitnessedResult.stage).toBe('service-applied');
    expect(f.runtime.service.journal().applications).toHaveLength(1);
    return;
  }
  await expect(f.runtime.drive()).rejects.toThrow('unwitnessed');
  expect(f.runtime.service.journal().applications).toHaveLength(1);
}

it('R8-F2 rereview6 V81 fresh current delivery evidence is accepted', () => delivery('clean'), 120_000);
it('R8-F2 rereview6 V82 missing current delivery evidence is refused', () => delivery('missing'), 120_000);
it('R8-F2 rereview6 V83 changed delivery stage is refused', () => delivery('wrong-stage'), 120_000);
it('R8-F2 rereview6 V84 changed operation identity is refused', () => delivery('wrong-operation'), 120_000);
it('R8-F2 rereview6 V85 stale evidence is refused at Part Nine current time', () => delivery('stale'), 120_000);

it('R8-F3 rereview6 V86 clean durable reboot uses its recorded current clock and retains one witnessed reply', async () => {
  const home = mkdtempSync(join(tmpdir(), 'p11-r8-v86-')), config = sliceConfig({ profile: 'reply' });
  const boot = bootProductionSliceAssembly({ home, config, restartRecovery: true });
  value(boot.coordinator.handles.lifecycle.cut('route'));
  const before = await boot.drive();
  expect(boot.service.journal().applications).toHaveLength(0);
  expect(before.preservedInput).toBeTruthy();
  expect(before.obligations).toContainEqual(expect.objectContaining({ operation: 'prerequisite:route',
    state: 'owned-pending-prerequisite-outage', owner: 'part-ten' }));
  value(boot.coordinator.handles.lifecycle.recover('route'));
  const after = await boot.drive();
  expect(after.preservedInput).toEqual(before.preservedInput);
  expect(after.externalApplications).toHaveLength(1);
  expect(after.independentlyWitnessedResult.stage).toBe('service-applied');
  const reboot = bootProductionSliceAssembly({ home, config, restartRecovery: true });
  const restarted = await reboot.drive();
  expect(restarted.externalApplications).toHaveLength(1);
  expect(restarted.outbound.operation).toBe(after.outbound.operation);
  expect(restarted.independentlyWitnessedResult.stage).toBe('service-applied');
}, 300_000);
