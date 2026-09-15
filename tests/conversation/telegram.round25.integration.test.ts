import { expect, it } from 'vitest';
import { round25AssessmentValidityScenarios } from './round25-fixture.js';

it('P12-NF-29 P12-NF-34 P12-NF-35 round25 permanently executes all six assessment-validity scenarios', () => {
  const rows = round25AssessmentValidityScenarios();
  expect(rows).toHaveLength(6);
  for (const row of rows) {
    const label = `${row.rebuild ? 'rebuilt' : 'original'}:${row.now}`;
    expect(row.reuse.kind, `reuse:${label}`).toBe(row.expected);
    expect(row.word.kind, `word:${label}`).toBe(row.expected);
    expect(row.emoji.kind, `emoji:${label}`).toBe(row.expected);
    expect(row.ownerCurrentConsumption.kind, `owner:${label}`).toBe(row.expected);
    expect(row.appendedDuringReuseAndRender, label).toBe(0);
    expect(row.providerCalls, label).toBe(1);
    expect(row.settlements, label).toBe(0);
    if (row.now >= 200) {
      for (const result of [row.reuse, row.word, row.emoji, row.ownerCurrentConsumption]) {
        expect(result.kind === 'Refused' ? result.detail : '', label).toContain('assessment expired');
      }
    }
  }
}, 120_000);
