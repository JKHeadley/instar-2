import { assessTelegramReplyResponse, renderTelegramDeliveryStatus } from '../../src/conversation/index.js';
import { decode } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { value } from '../effects/fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';

export interface Round25AssessmentValidityResult {
  readonly rebuild: boolean;
  readonly now: 199 | 200 | 201;
  readonly expected: Result<unknown>['kind'];
  readonly reuse: Result<unknown>;
  readonly word: Result<unknown>;
  readonly emoji: Result<unknown>;
  readonly ownerCurrentConsumption: Result<unknown>;
  readonly appendedDuringReuseAndRender: number;
  readonly providerCalls: number;
  readonly settlements: number;
}

/** Permanent import of rereview23's six assessment-validity scenarios. */
export function round25AssessmentValidityScenarios(): readonly Round25AssessmentValidityResult[] {
  const rows: Round25AssessmentValidityResult[] = [];
  for (const rebuild of [false, true]) for (const now of [199, 200, 201] as const) {
    const fixture = telegramResponseAssessmentFixture();
    const evidence = fixture.effects.evidence.find(row => row.id === 'evidence:telegram-response:matching');
    if (!evidence) throw new Error('matching response evidence missing');
    const longEvidence = value(decode('Evidence', { ...evidence, freshFor: 1000 }, fixture.effects.ctx.decode));
    fixture.effects.evidence.splice(fixture.effects.evidence.indexOf(evidence), 1, longEvidence);

    const initial = value(assessTelegramReplyResponse({
      effect: fixture.effect, claim: 'provider-accepted', existing: null,
    }, fixture.dependencies));
    fixture.effects.time(now);
    const dependencies = {
      ...fixture.dependencies,
      assessment: rebuild ? fixture.rebuildAssessment() : fixture.dependencies.assessment,
    };
    const before = fixture.verification.rows.length;
    const reuse = assessTelegramReplyResponse({
      effect: fixture.effect, claim: 'provider-accepted', existing: initial.assessment,
    }, dependencies);
    const word = renderTelegramDeliveryStatus(initial, 'word', dependencies);
    const emoji = renderTelegramDeliveryStatus(initial, 'emoji', dependencies);
    dependencies.assessment.read(initial.assessment, fixture.effect);
    const ownerCurrentConsumption = dependencies.assessment.consumeCurrent(
      initial.assessment, fixture.effect, current => current,
    );

    rows.push({
      rebuild, now, expected: now < 200 ? 'Success' : 'Refused', reuse, word, emoji,
      ownerCurrentConsumption,
      appendedDuringReuseAndRender: fixture.verification.rows.length - before,
      providerCalls: fixture.telegram.calls.send.length,
      settlements: value(fixture.doorway.inspect()).filter(row => row.record.type === 'EffectSettlement').length,
    });
  }
  return rows;
}
