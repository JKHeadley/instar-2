import { expect, it } from 'vitest';
import { assessTelegramReplyResponse, renderTelegramDeliveryStatus } from '../../src/conversation/index.js';
import { value } from '../effects/fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';

it('P12-NF-29 P12-NF-34 P12-NF-35 P12-NF-38 P12-NF-48 round17 provider assessment rebuilds without send or settlement replay', () => {
  const fixture = telegramResponseAssessmentFixture();
  const first = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: null,
  }, fixture.dependencies));
  const rebuiltAssessment = fixture.rebuildAssessment();
  const rebuilt = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: first.assessment,
  }, { ...fixture.dependencies, assessment: rebuiltAssessment }));
  const status = value(renderTelegramDeliveryStatus(rebuilt, 'emoji', fixture.dependencies.boundary));

  expect(rebuilt).toEqual(first);
  expect(status).toMatchObject({
    stage: 'provider-accepted', sourceStage: 'response', text: '📨',
    accessibleLabel: 'accepted by platform', legend: 'accepted by platform',
  });
  expect(fixture.telegram.calls.send).toHaveLength(1);
  expect(value(fixture.doorway.inspect()).filter(row => row.record.type === 'EffectSettlement')).toHaveLength(0);
});
