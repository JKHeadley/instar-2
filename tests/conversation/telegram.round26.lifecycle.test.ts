import { expect, it } from 'vitest';
import { round26AssessmentConsumptionBoundaryScenarios } from './round26-fixture.js';

it('P12-NF-29 P12-NF-34 P12-NF-35 P12-NF-38 P12-NF-48 round26 rebuilt owner keeps assessment use synchronous', () => {
  const rows = [
    ...round26AssessmentConsumptionBoundaryScenarios(true, 'assessment'),
    ...round26AssessmentConsumptionBoundaryScenarios(true, 'status'),
  ];
  expect(rows).toHaveLength(4);
  for (const row of rows) {
    const label = `${row.path}:${row.advance ? 'expires' : 'valid'}`;
    expect(row.actual.kind, label).toBe(row.expected);
    expect(row.ownerCurrentConsumption.kind, label).toBe(row.expected);
    expect(row.trace.indexOf('verification.inspectCurrent'), label)
      .toBeLessThan(row.trace.indexOf('consumeCurrent:start'));
    expect(row.appended, label).toBe(0);
    expect(row.providerCalls, label).toBe(1);
    expect(row.settlements, label).toBe(0);
    if (row.advance) {
      expect(row.actual.kind === 'Refused' ? row.actual.detail : '', label).toContain('assessment expired');
    } else {
      expect(row.actual.kind, label).toBe('Success');
      expect(row.trace, label).toContain('consumeCurrent:consumer');
    }
  }
}, 120_000);
