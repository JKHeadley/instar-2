import { expect, it } from 'vitest';
import { assessTelegramReplyResponse } from '../../src/conversation/index.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';
import { round19AssessmentCases } from './round19-fixture.js';

it('P12-NF-34 P12-NF-35 round19 refuses every malformed owner record before assessment', () => {
  for (const assessmentCase of round19AssessmentCases.filter(row => row.field?.startsWith('request.')
    || row.field?.startsWith('reservation.'))) {
    const fixture = telegramResponseAssessmentFixture();
    const before = fixture.verification.rows.length;
    const result = assessTelegramReplyResponse({
      effect: assessmentCase.mutate(fixture.effect), claim: 'provider-accepted', existing: null,
    }, fixture.dependencies);
    expect(result.kind, assessmentCase.name).toBe('Refused');
    if (result.kind !== 'Refused') throw new Error(`${assessmentCase.name} unexpectedly succeeded`);
    expect(result.detail, assessmentCase.name).toContain(assessmentCase.field);
    expect(fixture.verification.rows, assessmentCase.name).toHaveLength(before);
    expect(fixture.telegram.calls.send, assessmentCase.name).toHaveLength(1);
  }
}, 30_000);
