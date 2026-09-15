import { expect, it } from 'vitest';
import { assessTelegramReplyResponse } from '../../src/conversation/index.js';
import { value } from '../effects/fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';
import { round19AssessmentCases } from './round19-fixture.js';

it('P12-NF-34 P12-NF-35 P12-NF-38 round19 rebuild re-resolves owner records before reusing acceptance', () => {
  for (const assessmentCase of round19AssessmentCases.filter(row => row.field?.startsWith('request.')
    || row.field?.startsWith('reservation.'))) {
    const fixture = telegramResponseAssessmentFixture();
    const first = value(assessTelegramReplyResponse({
      effect: fixture.effect, claim: 'provider-accepted', existing: null,
    }, fixture.dependencies));
    const beforeVerification = fixture.verification.rows.length;
    const beforeEffects = value(fixture.doorway.inspect());
    const result = assessTelegramReplyResponse({
      effect: assessmentCase.mutate(fixture.effect), claim: 'provider-accepted', existing: first.assessment,
    }, { ...fixture.dependencies, assessment: fixture.rebuildAssessment() });
    expect(result.kind, assessmentCase.name).toBe('Refused');
    if (result.kind !== 'Refused') throw new Error(`${assessmentCase.name} unexpectedly succeeded`);
    expect(result.detail, assessmentCase.name).toContain(assessmentCase.field);
    expect(fixture.verification.rows, assessmentCase.name).toHaveLength(beforeVerification);
    expect(value(fixture.doorway.inspect()), assessmentCase.name).toEqual(beforeEffects);
    expect(fixture.telegram.calls.send, assessmentCase.name).toHaveLength(1);
  }
}, 60_000);
