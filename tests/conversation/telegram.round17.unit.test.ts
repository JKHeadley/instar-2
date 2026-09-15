import { expect, it } from 'vitest';
import { assessTelegramReplyResponse, renderTelegramDeliveryStatus } from '../../src/conversation/index.js';
import type { TelegramProviderAcceptance } from '../../src/conversation/index.js';
import { refused, value } from '../effects/fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';

it('P12-NF-29 P12-NF-34 P12-NF-35 round17 word and emoji status retain only provider acceptance', () => {
  const fixture = telegramResponseAssessmentFixture();
  const acceptance = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: null,
  }, fixture.dependencies));
  const word = value(renderTelegramDeliveryStatus(acceptance, 'word', fixture.dependencies.boundary));
  const emoji = value(renderTelegramDeliveryStatus(acceptance, 'emoji', fixture.dependencies.boundary));

  expect(word).toMatchObject({
    stage: 'provider-accepted', sourceStage: 'response', form: 'word',
    text: 'accepted by platform', accessibleLabel: 'accepted by platform', legend: 'accepted by platform',
  });
  expect(emoji).toMatchObject({
    stage: 'provider-accepted', sourceStage: 'response', form: 'emoji',
    text: '📨', accessibleLabel: 'accepted by platform', legend: 'accepted by platform',
  });
  expect(emoji.assessment).toEqual(word.assessment);
  expect(emoji.observation).toBe(word.observation);

  const promoted = { ...acceptance, stage: 'human-read' } as unknown as TelegramProviderAcceptance;
  refused(renderTelegramDeliveryStatus(promoted, 'emoji', fixture.dependencies.boundary),
    'source-bounded provider-acceptance assessment');
});
