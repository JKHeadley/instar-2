import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { assessTelegramReplyResponse } from '../../src/conversation/index.js';
import { value } from '../effects/fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';

it('P12-NF-34 P12-NF-35 round18 rebuild retains both concordant Evidence ids without effect replay', () => {
  const fixture = telegramResponseAssessmentFixture();
  fixture.effects.evidence.push(value(decode('Evidence', fixture.effects.evidenceInput({
    id: 'evidence:second-valid-witness',
    claim: { subject: fixture.observation.operation, predicate: 'operation-occurred',
      value: { digest: fixture.request.digest } },
    source: 'probe', observedAt: fixture.effects.clock(100), freshFor: 100,
    capture: fixture.observation.capture, strength: 'proof',
  }), fixture.effects.ctx.decode)));
  const before = value(fixture.doorway.inspect());
  const first = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: null,
  }, fixture.dependencies));
  const rebuilt = value(assessTelegramReplyResponse({
    effect: fixture.effect, claim: 'provider-accepted', existing: first.assessment,
  }, { ...fixture.dependencies, assessment: fixture.rebuildAssessment() }));
  expect(rebuilt).toEqual(first);
  expect(new Set(rebuilt.evidence)).toEqual(new Set([
    'evidence:telegram-response:matching', 'evidence:second-valid-witness',
  ]));
  expect(value(fixture.doorway.inspect())).toEqual(before);
});
