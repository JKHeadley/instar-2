import { expect, it } from 'vitest';
import { assessTelegramReplyResponse } from '../../src/conversation/index.js';
import type { EffectAssessmentInput, OperationObservation } from '../../src/effects/index.js';
import { refused, value } from '../effects/fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';

it('P12-NF-34 P12-NF-35 round17 exact Telegram response reaches the landed Part Nine assessment and not settlement', () => {
  const fixture = telegramResponseAssessmentFixture();
  const acceptance = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: null,
  }, fixture.dependencies));
  expect(acceptance).toMatchObject({
    stage: 'provider-accepted', sourceStage: 'response', operation: fixture.observation.operation,
    account: fixture.observation.account, conversation: fixture.observation.conversation,
    digest: fixture.observation.digest, observation: fixture.observation.id,
    unsupported: ['human-delivered', 'human-read'],
  });
  expect(acceptance.evidence).toEqual(['evidence:telegram-response:matching']);
  const assessment = value(fixture.verification.runtime.inspectCurrent()).find(row =>
    row.fact.id === acceptance.assessment.id && row.record.type === 'VerificationAssessment');
  expect(assessment?.record.type).toBe('VerificationAssessment');
  if (!assessment || assessment.record.type !== 'VerificationAssessment') throw new Error('assessment missing');
  expect(assessment.record.predicates.map(row => [row.predicate, row.verdict])).toEqual([
    ['occurrence', 'satisfied'], ['non-occurrence', 'contradicted'],
    ['quiescence', 'insufficient'], ['charge', 'insufficient'],
  ]);
  expect(value(fixture.doorway.inspect()).filter(row => row.record.type === 'EffectSettlement')).toHaveLength(0);
  refused(fixture.doorway.settle(fixture.observation.operation), 'assessor unavailable');
});

it('P12-NF-34 P12-NF-35 round17 mismatched, unwitnessed, unsupported-stage and human claims refuse', () => {
  for (const evidence of ['missing', 'wrong-digest'] as const) {
    const fixture = telegramResponseAssessmentFixture(evidence);
    refused(assessTelegramReplyResponse({
      effect: fixture.effect, claim: 'provider-accepted', existing: null,
    }, fixture.dependencies));
  }

  for (const mutate of [
    (input: EffectAssessmentInput): EffectAssessmentInput => ({ ...input, observations: input.observations.map(row =>
      row.stage === 'response' ? { ...row, account: `${row.account}:other` } as OperationObservation : row) }),
    (input: EffectAssessmentInput): EffectAssessmentInput => ({ ...input, observations: input.observations.map(row =>
      row.stage === 'response' ? { ...row, digest: `sha256:${'0'.repeat(64)}` } as OperationObservation : row) }),
    (input: EffectAssessmentInput): EffectAssessmentInput => ({ ...input, observations: input.observations.map(row =>
      row.stage === 'response' ? { ...row, capture: { ...row.capture, hash: `sha256:${'0'.repeat(64)}` } } as OperationObservation : row) }),
  ]) {
    const fixture = telegramResponseAssessmentFixture();
    refused(assessTelegramReplyResponse({
      effect: mutate(fixture.effect), claim: 'provider-accepted', existing: null,
    }, fixture.dependencies));
  }

  const unsupported = telegramResponseAssessmentFixture();
  const noResponse = { ...unsupported.effect, observations: unsupported.effect.observations.map(row =>
    row.stage === 'response' ? { ...row, stage: 'lookup' as const } as OperationObservation : row) };
  refused(assessTelegramReplyResponse({
    effect: noResponse, claim: 'provider-accepted', existing: null,
  }, unsupported.dependencies), 'one exact response-stage observation');

  for (const claim of ['human-delivered', 'human-read'] as const) {
    const fixture = telegramResponseAssessmentFixture();
    refused(assessTelegramReplyResponse({ effect: fixture.effect, claim, existing: null }, fixture.dependencies),
      'cannot establish human delivery or read');
  }
}, 30_000);
