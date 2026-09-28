import { expect, it } from 'vitest';
import { round26AssessmentConsumptionBoundaryScenarios } from './round26-fixture.js';

it('P12-NF-29 P12-NF-34 round26 renders status within the synchronous assessment guard', () => {
  const rows = round26AssessmentConsumptionBoundaryScenarios(false, 'status', 'emoji');
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect(row.actual.kind).toBe(row.expected);
    expect(row.ownerCurrentConsumption.kind).toBe(row.expected);
    expect(row.trace.indexOf('verification.inspectCurrent')).toBeLessThan(row.trace.indexOf('consumeCurrent:start'));
    expect(row.appended).toBe(0);
    expect(row.providerCalls).toBe(1);
    expect(row.settlements).toBe(0);
    if (row.advance) {
      expect(row.actual.kind === 'Refused' ? row.actual.detail : '').toContain('assessment expired');
    } else {
      expect(row.actual.kind === 'Success' ? row.actual.value : null).toMatchObject({
        text: '📨', accessibleLabel: 'accepted by platform', legend: 'accepted by platform',
      });
      expect(row.trace).toContain('consumeCurrent:consumer');
    }
  }
}, 60_000); // two full assessment scenarios; ~6s alone, over 10s under full-suite load
