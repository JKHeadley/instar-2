import { expect, it } from 'vitest';
import { assessTelegramReplyResponse, renderTelegramDeliveryStatus } from '../../src/conversation/index.js';
import type { TelegramProviderAcceptance } from '../../src/conversation/index.js';
import { value } from '../effects/fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';
import { round24UnwitnessedStatuses } from './round24-fixture.js';

it('P12-NF-28 P12-NF-34 P12-NF-35 round24 compares the complete stored operation definition before assessment', () => {
  const fixture = telegramResponseAssessmentFixture();
  const equivalent = JSON.parse(JSON.stringify(fixture.dependencies.definition));
  const accepted = assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: null,
  }, { ...fixture.dependencies, definition: equivalent });
  expect(accepted.kind).toBe('Success');

  const before = fixture.verification.rows.length;
  const changed = assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted',
    existing: value(accepted).assessment,
  }, { ...fixture.dependencies, definition: { ...equivalent, maxBytes: equivalent.maxBytes - 1 } });
  expect(changed.kind).toBe('Refused');
  expect(changed.kind === 'Refused' ? changed.detail : '').toContain('definition.maxBytes');
  expect(fixture.verification.rows).toHaveLength(before);
  expect(fixture.telegram.calls.send).toHaveLength(1);
});

it('P12-NF-29 P12-NF-34 P12-NF-35 round24 refuses each missing or mismatched durable status identity', () => {
  const fixture = telegramResponseAssessmentFixture();
  const accepted = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: null,
  }, fixture.dependencies));
  const cases: ReadonlyArray<readonly [string, TelegramProviderAcceptance]> = [
    ['assessment', { ...accepted, assessment: { ...accepted.assessment, id: 'fact:never-recorded' } }],
    ['observation', { ...accepted, observation: 'observation:never-recorded' }],
    ['evidence', { ...accepted, evidence: ['evidence:never-recorded'] }],
    ['account', { ...accepted, account: 'account:never-recorded' }],
    ['conversation', { ...accepted, conversation: 'conversation:never-recorded' }],
    ['operation', { ...accepted, operation: 'operation:never-recorded' }],
    ['digest', { ...accepted, digest: `sha256:${'0'.repeat(64)}` }],
  ];
  for (const [name, input] of cases) {
    const result = renderTelegramDeliveryStatus(input, 'word', fixture.dependencies);
    expect(result.kind, name).toBe('Refused');
    expect(result.kind === 'Refused' ? result.detail : '', name).not.toContain('accepted by platform');
  }
  expect(fixture.telegram.calls.send).toHaveLength(1);
});

it('P12-NF-29 P12-NF-34 round24 refuses unwitnessed word and emoji statuses without evidentiary wording', () => {
  const results = round24UnwitnessedStatuses();
  expect(results).toHaveLength(2);
  for (const result of results) {
    expect(result.kind).toBe('Refused');
    expect(result.kind === 'Refused' ? result.detail : '').not.toContain('accepted by platform');
  }
});
