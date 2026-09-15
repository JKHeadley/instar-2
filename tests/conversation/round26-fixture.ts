import { assessTelegramReplyResponse, renderTelegramDeliveryStatus } from '../../src/conversation/index.js';
import type { TelegramDeliveryStatusForm } from '../../src/conversation/index.js';
import type { EffectAssessmentInput, EffectAssessmentPort, EffectAssessmentView } from '../../src/effects/index.js';
import { decode } from '../../src/index.js';
import type { OwnedReference, Result } from '../../src/index.js';
import { value } from '../effects/fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';

export interface Round26AssessmentConsumptionBoundaryResult {
  readonly rebuilt: boolean;
  readonly path: 'assessment' | 'status';
  readonly advance: boolean;
  readonly expected: Result<unknown>['kind'];
  readonly actual: Result<unknown>;
  readonly ownerCurrentConsumption: Result<unknown>;
  readonly trace: readonly string[];
  readonly appended: number;
  readonly providerCalls: number;
  readonly settlements: number;
}

function tracedAssessment(owner: EffectAssessmentPort, trace: string[]): EffectAssessmentPort {
  return Object.freeze({
    owner: 'part-nine' as const,
    assess(input: EffectAssessmentInput) {
      return owner.assess(input);
    },
    read(reference: OwnedReference<'part-nine', 'VerificationAssessment'>, input: EffectAssessmentInput) {
      return owner.read(reference, input);
    },
    consumeCurrent<T>(reference: OwnedReference<'part-nine', 'VerificationAssessment'>,
      input: EffectAssessmentInput, consumer: (current: EffectAssessmentView) => T): Result<T> {
      trace.push('consumeCurrent:start');
      const result = owner.consumeCurrent(reference, input, current => {
        trace.push('consumeCurrent:consumer');
        return consumer(current);
      });
      trace.push(`consumeCurrent:return:${result.kind}`);
      return result;
    },
  });
}

/** Permanent import of rereview24's expiry-during-history-read reproduction and valid control. */
export function round26AssessmentConsumptionBoundaryScenarios(
  rebuilt: boolean, path: 'assessment' | 'status', form: TelegramDeliveryStatusForm = 'word',
): readonly Round26AssessmentConsumptionBoundaryResult[] {
  const rows: Round26AssessmentConsumptionBoundaryResult[] = [];
  for (const advance of [false, true]) {
    const fixture = telegramResponseAssessmentFixture();
    const evidence = fixture.effects.evidence.find(row => row.id === 'evidence:telegram-response:matching');
    if (!evidence) throw new Error('matching response evidence missing');
    const longEvidence = value(decode('Evidence', { ...evidence, freshFor: 1000 }, fixture.effects.ctx.decode));
    fixture.effects.evidence.splice(fixture.effects.evidence.indexOf(evidence), 1, longEvidence);

    const initial = value(assessTelegramReplyResponse({
      effect: fixture.effect, claim: 'provider-accepted', existing: null,
    }, fixture.dependencies));
    fixture.effects.time(199);
    const trace: string[] = [];
    const owner = rebuilt ? fixture.rebuildAssessment() : fixture.dependencies.assessment;
    const assessment = tracedAssessment(owner, trace);
    const dependencies = {
      ...fixture.dependencies,
      assessment,
      verification: {
        ...fixture.dependencies.verification,
        inspectCurrent() {
          trace.push('verification.inspectCurrent');
          if (advance) {
            fixture.effects.time(200);
            trace.push('clock:200');
          }
          return fixture.dependencies.verification.inspectCurrent();
        },
      },
    };
    const before = fixture.verification.rows.length;
    const actual: Result<unknown> = path === 'assessment'
      ? assessTelegramReplyResponse({
        effect: fixture.effect, claim: 'provider-accepted', existing: initial.assessment,
      }, dependencies)
      : renderTelegramDeliveryStatus(initial, form, dependencies);
    owner.read(initial.assessment, fixture.effect);
    const ownerCurrentConsumption: Result<unknown> = owner.consumeCurrent(
      initial.assessment, fixture.effect, current => current,
    );

    rows.push({
      rebuilt, path, advance, expected: advance ? 'Refused' : 'Success', actual,
      ownerCurrentConsumption, trace,
      appended: fixture.verification.rows.length - before,
      providerCalls: fixture.telegram.calls.send.length,
      settlements: value(fixture.doorway.inspect()).filter(row => row.record.type === 'EffectSettlement').length,
    });
  }
  return rows;
}
