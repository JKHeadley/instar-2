import { expect, it } from 'vitest';
import { round25AssessmentValidityScenarios } from './round25-fixture.js';

it('P12-NF-29 P12-NF-34 round25 renders status only during the assessment validity interval', () => {
  const rows = round25AssessmentValidityScenarios().filter(row => !row.rebuild);
  expect(rows).toHaveLength(3);
  for (const row of rows) {
    expect(row.word.kind, `word:${row.now}`).toBe(row.expected);
    expect(row.emoji.kind, `emoji:${row.now}`).toBe(row.expected);
    if (row.now === 199) {
      expect(row.word.kind === 'Success' ? row.word.value : null).toMatchObject({
        text: 'accepted by platform', accessibleLabel: 'accepted by platform',
      });
      expect(row.emoji.kind === 'Success' ? row.emoji.value : null).toMatchObject({
        text: '📨', accessibleLabel: 'accepted by platform',
      });
    } else {
      expect(row.word.kind === 'Refused' ? row.word.detail : '').toContain('assessment expired');
      expect(row.emoji.kind === 'Refused' ? row.emoji.detail : '').toContain('assessment expired');
      expect(row.word.kind === 'Refused' ? row.word.detail : '').not.toContain('accepted by platform');
      expect(row.emoji.kind === 'Refused' ? row.emoji.detail : '').not.toContain('accepted by platform');
    }
  }
}, 60_000);
