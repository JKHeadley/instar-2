import { expect, it } from 'vitest';
import { assessTelegramReplyResponse } from '../../src/conversation/index.js';
import { value } from '../effects/fixture.js';
import { telegramResponseAssessmentFixture } from './round17-fixture.js';
import { round19AssessmentCases } from './round19-fixture.js';

it('P12-NF-34 P12-NF-35 round19 permanently executes the independent 14-case assessment matrix', () => {
  let executed = 0;
  for (const assessmentCase of round19AssessmentCases) {
    for (const reuse of [false, true]) {
      const fixture = telegramResponseAssessmentFixture();
      const first = reuse ? value(assessTelegramReplyResponse({
        effect: fixture.effect, claim: 'provider-accepted', existing: null,
      }, fixture.dependencies)) : null;
      const before = fixture.verification.rows.length;
      const result = assessTelegramReplyResponse({
        effect: assessmentCase.mutate(fixture.effect), claim: 'provider-accepted',
        existing: first?.assessment ?? null,
      }, fixture.dependencies);
      executed += 1;
      expect(result.kind, `${assessmentCase.name}:${reuse ? 'reuse' : 'fresh'}`)
        .toBe(assessmentCase.field === null ? 'Success' : 'Refused');
      if (assessmentCase.field !== null) {
        if (result.kind !== 'Refused') throw new Error(`${assessmentCase.name} unexpectedly succeeded`);
        if (assessmentCase.field !== 'observation.id') expect(result.detail).toContain(assessmentCase.field);
        expect(fixture.verification.rows, assessmentCase.name).toHaveLength(before);
      } else {
        expect(fixture.verification.rows.length - before).toBe(reuse ? 0 : 2);
      }
      expect(fixture.telegram.calls.send).toHaveLength(1);
    }
  }
  expect(executed).toBe(14);
}, 60_000);
