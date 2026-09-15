import { expect, it } from 'vitest';
import { round26AssessmentConsumptionBoundaryScenarios } from './round26-fixture.js';

it('P12-NF-34 P12-NF-35 P12-NF-38 round26 refuses expiry during the final history read', () => {
  const rows = round26AssessmentConsumptionBoundaryScenarios(false, 'assessment');
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
        stage: 'provider-accepted', sourceStage: 'response',
      });
      expect(row.trace).toContain('consumeCurrent:consumer');
    }
  }
}, 60_000);
