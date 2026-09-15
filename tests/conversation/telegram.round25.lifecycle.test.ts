import { expect, it } from 'vitest';
import { round25AssessmentValidityScenarios } from './round25-fixture.js';

it('P12-NF-29 P12-NF-34 P12-NF-35 P12-NF-38 round25 rebuilt readers preserve the half-open deadline', () => {
  const rows = round25AssessmentValidityScenarios().filter(row => row.rebuild);
  expect(rows).toHaveLength(3);
  expect(rows.map(row => [row.now, row.reuse.kind, row.word.kind, row.emoji.kind])).toEqual([
    [199, 'Success', 'Success', 'Success'],
    [200, 'Refused', 'Refused', 'Refused'],
    [201, 'Refused', 'Refused', 'Refused'],
  ]);
  expect(rows.every(row => row.appendedDuringReuseAndRender === 0
    && row.providerCalls === 1 && row.settlements === 0)).toBe(true);
}, 60_000);
