import { expect, it } from 'vitest';
import { activationGaps, adapterStimulusClasses, convergenceEligible, decodeVerificationRecord,
  outcomeWindowStatus, reportContradictsActual, reviewDisclosureAllowed, supervisionCoverage } from '../../src/verification/index.js';
import { factsFixture, value } from '../facts/fixtures.js';
import { verificationInput } from './fixture.js';

it('P9-NF-08 P9-NF-11 supervision coverage distinguishes missing/unavailable/validated and refuses recursion', () => {
  expect(supervisionCoverage(['admit', 'effect', 'model-call'], [
    { boundary: 'admit', state: 'validated', attempt: 'a1', resolution: 'r1', operation: 'o1', recursivelySupervisesOwnCall: false },
    { boundary: 'effect', state: 'unavailable', attempt: 'a2', resolution: '', operation: 'o2', recursivelySupervisesOwnCall: false },
    { boundary: 'model-call', state: 'validated', attempt: 'a3', resolution: 'r3', operation: 'o3', recursivelySupervisesOwnCall: true },
  ])).toEqual([
    { boundary: 'admit', state: 'validated', references: ['a1', 'o1', 'r1'] },
    { boundary: 'effect', state: 'unavailable', references: ['a2', 'o2'] },
    { boundary: 'model-call', state: 'recursive-refused', references: ['a3', 'o3', 'r3'] },
  ]);
  expect(supervisionCoverage(['missing'], [])[0]!.state).toBe('missing');
});

it('P9-NF-17 P9-NF-19 P9-NF-21 adapter proof matrix covers all live stimulus classes without upgrading channel attestation', () => {
  expect(adapterStimulusClasses.map(row => row.id)).toEqual(['conversation', 'signed-webhook', 'scheduler', 'agent-transport',
    'harness', 'model', 'persistence-vault', 'effect-adapter', 'operator-surface']);
  expect(adapterStimulusClasses.find(row => row.id === 'conversation')).toMatchObject({ authentication: 'channel-attested' });
  expect(adapterStimulusClasses.every(row => row.limit.length > 0)).toBe(true);
});

it('P9-NF-27 review reader access never implies provider disclosure', () => {
  const plan = verificationInput('VerificationPlan');
  expect(reviewDisclosureAllowed(plan, 'reviewer', null)).toBe(true);
  expect(reviewDisclosureAllowed(plan, 'reviewer', 'unapproved-provider')).toBe(false);
  expect(reviewDisclosureAllowed(plan, 'stranger', null)).toBe(false);
});

it('P9-NF-31 P9-NF-32 same-subject refusal contradicts paid-success while an honest capacity report remains distinct', () => {
  const actual = { operation: 'payment:1', result: 'refused' as const, subject: 'requested-payment' };
  expect(reportContradictsActual({ ...actual, result: 'success' }, actual)).toBe(true);
  expect(reportContradictsActual({ operation: 'loop:1', result: 'success', subject: 'capacity-applied' }, actual)).toBeNull();
  expect(reportContradictsActual(actual, actual)).toBe(false);
});

it('P9-NF-29 P9-NF-33 P9-NF-37 failed semantic review stays incomplete and convergence requires an independent reviewer', () => {
  const record = verificationInput('RetrospectiveReviewRecord');
  expect(convergenceEligible(record, 'artifact-author')).toBe(true);
  expect(convergenceEligible(record, record.reviewer)).toBe(false);
  const incomplete = value(decodeVerificationRecord('RetrospectiveReviewRecord', { ...record, closure: 'incomplete' }, factsFixture().c));
  expect(convergenceEligible(incomplete, 'artifact-author')).toBe(false);
});

it('P9-NF-41 outcomes outside the original half-open observation window are late, never retroactive success', () => {
  const grade = verificationInput('Grade');
  expect(outcomeWindowStatus(grade, 10)).toBe('within-window');
  expect(outcomeWindowStatus(grade, 19)).toBe('within-window');
  expect(outcomeWindowStatus(grade, 20)).toBe('late');
  expect(outcomeWindowStatus(grade, null)).toBe('missing');
});

it('P9-NF-03 P9-NF-07 P9-NF-60 P9-NF-63 activation requires actual arms, bounds and all three executable tiers', () => {
  const f = factsFixture(); const plan = verificationInput('VerificationPlan');
  expect(activationGaps(plan)).toContain('live-probe-arm');
  const activated = value(decodeVerificationRecord('VerificationPlan', { ...plan,
    arms: [...plan.arms, { ...plan.arms[0], id: 'probe', kind: 'probe', fixture: 'P9-NF-18' }] }, f.c));
  expect(activationGaps(activated)).toEqual([]);
});
