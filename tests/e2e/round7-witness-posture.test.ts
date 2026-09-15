import { expect, it } from 'vitest';
import { value } from '../fixtures.js';
import { productionOperatorSlice } from '../operator/production-slice-fixture.js';

it('R7-F2 rereview5 V66/V67 result agrees with Part Nine posture before and after exact evidence removal', async () => {
  const complete = productionOperatorSlice(); const completeObserve = complete.production.deliveryWitness.observe;
  let completePosture: string | undefined;
  complete.production.deliveryWitness.observe = (operation => {
    const witnessed = completeObserve(operation);
    completePosture = value(complete.verification.runtime.posture('VerificationPlan', complete.verification.clock(100))).posture;
    return witnessed;
  }) as typeof completeObserve;
  expect((await complete.runtime.drive()).independentlyWitnessedResult.stage).toBe('service-applied');
  expect(completePosture).toBe('healthy');

  const missing = productionOperatorSlice(); const missingObserve = missing.production.deliveryWitness.observe;
  let beforeRemoval: string | undefined, afterRemoval: string | undefined;
  missing.production.deliveryWitness.observe = (operation => {
    const witnessed = missingObserve(operation);
    beforeRemoval = value(missing.verification.runtime.posture('VerificationPlan', missing.verification.clock(100))).posture;
    missing.verification.setEvidence([]);
    afterRemoval = value(missing.verification.runtime.posture('VerificationPlan', missing.verification.clock(100))).posture;
    return witnessed;
  }) as typeof missingObserve;
  await expect(missing.runtime.drive()).rejects.toThrow('unwitnessed');
  expect(beforeRemoval).toBe('healthy');
  expect(afterRemoval).toBe('unknown');
  expect(missing.runtime.service.journal().applications).toHaveLength(1);
}, 120000);
