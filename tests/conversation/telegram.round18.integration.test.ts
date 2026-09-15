import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { assessTelegramReplyResponse } from '../../src/conversation/index.js';
import type { EffectAssessmentInput, OperationObservation } from '../../src/effects/index.js';
import { refused, value } from '../effects/fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';

function changedObservations(fixture: ReturnType<typeof telegramResponseAssessmentFixture>,
  change: (row: OperationObservation) => OperationObservation): EffectAssessmentInput {
  return { ...fixture.effect, observations: fixture.effect.observations.map(row =>
    row.stage === 'response' ? change(row) : row) };
}

it('P12-NF-34 P12-NF-35 round18 refuses unrecorded response observation and claim identities', () => {
  const fixture = telegramResponseAssessmentFixture();
  const first = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: null,
  }, fixture.dependencies));
  const before = fixture.verification.rows.length;
  for (const mutate of [
    (fixture: ReturnType<typeof telegramResponseAssessmentFixture>) => changedObservations(fixture,
      row => ({ ...row, id: 'observation:never-recorded' })),
    (fixture: ReturnType<typeof telegramResponseAssessmentFixture>): EffectAssessmentInput => ({
      ...fixture.effect,
      claim: 'claim:never-recorded',
      observations: fixture.effect.observations.map(row => ({ ...row, claim: 'claim:never-recorded' })),
    }),
  ]) {
    refused(assessTelegramReplyResponse({
      effect: mutate(fixture), claim: 'provider-accepted', existing: first.assessment,
    }, fixture.dependencies));
    expect(fixture.verification.rows).toHaveLength(before);
  }
}, 30_000);

it('P12-NF-34 P12-NF-35 round18 refuses malformed response version and wake', () => {
  for (const change of [
    (row: OperationObservation) => ({ ...row, schemaVersion: 99 }) as unknown as OperationObservation,
    (row: OperationObservation) => ({ ...row, wake: 'not-a-response-wake' }),
  ]) {
    const fixture = telegramResponseAssessmentFixture();
    refused(assessTelegramReplyResponse({
      effect: changedObservations(fixture, change), claim: 'provider-accepted', existing: null,
    }, fixture.dependencies));
  }
}, 30_000);

it('P12-NF-29 P12-NF-34 P12-NF-35 round18 retains two concordant response Evidence records', () => {
  const fixture = telegramResponseAssessmentFixture();
  fixture.effects.evidence.push(value(decode('Evidence', fixture.effects.evidenceInput({
    id: 'evidence:second-valid-witness',
    claim: {
      subject: fixture.observation.operation,
      predicate: 'operation-occurred',
      value: { digest: fixture.request.digest },
    },
    source: 'probe', observedAt: fixture.effects.clock(100), freshFor: 100,
    capture: fixture.observation.capture, strength: 'proof',
  }), fixture.effects.ctx.decode)));
  const acceptance = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: null,
  }, fixture.dependencies));
  expect(new Set(acceptance.evidence)).toEqual(new Set([
    'evidence:telegram-response:matching', 'evidence:second-valid-witness',
  ]));
  const assessment = value(fixture.verification.runtime.inspectCurrent()).find(row =>
    row.fact.id === acceptance.assessment.id && row.record.type === 'VerificationAssessment');
  expect(assessment?.record.type).toBe('VerificationAssessment');
  if (!assessment || assessment.record.type !== 'VerificationAssessment') throw new Error('assessment missing');
  expect(assessment.record.captureStatuses).toHaveLength(2);
  expect(assessment.record.captureStatuses.every(row => row.reference === fixture.observation.capture.reference
    && row.status === 'available')).toBe(true);
});
