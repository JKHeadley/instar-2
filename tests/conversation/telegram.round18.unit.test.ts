import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { assessTelegramReplyResponse, renderTelegramDeliveryStatus } from '../../src/conversation/index.js';
import { value } from '../effects/fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';

it('P12-NF-29 P12-NF-34 round18 renders one bounded status from two concordant Evidence records', () => {
  const fixture = telegramResponseAssessmentFixture();
  fixture.effects.evidence.push(value(decode('Evidence', fixture.effects.evidenceInput({
    id: 'evidence:second-valid-witness',
    claim: { subject: fixture.observation.operation, predicate: 'operation-occurred',
      value: { digest: fixture.request.digest } },
    source: 'probe', observedAt: fixture.effects.clock(100), freshFor: 100,
    capture: fixture.observation.capture, strength: 'proof',
  }), fixture.effects.ctx.decode)));
  const acceptance = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: null,
  }, fixture.dependencies));
  expect(acceptance.evidence).toHaveLength(2);
  expect(value(renderTelegramDeliveryStatus(acceptance, 'word', fixture.effects.host.boundary))).toMatchObject({
    text: 'accepted by platform', sourceStage: 'response', observation: fixture.observation.id,
  });
});
