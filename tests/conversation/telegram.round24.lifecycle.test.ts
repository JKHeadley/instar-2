import { expect, it } from 'vitest';
import { assessTelegramReplyResponse, renderTelegramDeliveryStatus } from '../../src/conversation/index.js';
import { value } from '../effects/fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';

it('P12-NF-29 P12-NF-34 P12-NF-35 P12-NF-38 round24 re-resolves status evidence after assessment-runtime rebuild', () => {
  const fixture = telegramResponseAssessmentFixture();
  const first = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: null,
  }, fixture.dependencies));
  const rebuiltDependencies = { ...fixture.dependencies, assessment: fixture.rebuildAssessment() };
  const rebuilt = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: first.assessment,
  }, rebuiltDependencies));
  const effectsBefore = value(fixture.doorway.inspect());
  const verificationBefore = fixture.verification.rows.length;

  expect(value(renderTelegramDeliveryStatus(rebuilt, 'emoji', rebuiltDependencies))).toMatchObject({
    text: '📨', accessibleLabel: 'accepted by platform', legend: 'accepted by platform',
  });
  const mismatched = renderTelegramDeliveryStatus({ ...rebuilt, conversation: 'conversation:never-recorded' },
    'word', rebuiltDependencies);
  expect(mismatched.kind).toBe('Refused');
  expect(value(fixture.doorway.inspect())).toEqual(effectsBefore);
  expect(fixture.verification.rows).toHaveLength(verificationBefore);
  expect(fixture.telegram.calls.send).toHaveLength(1);
});
