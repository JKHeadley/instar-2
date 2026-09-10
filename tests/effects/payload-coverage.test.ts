import { expect, it } from 'vitest';
// @ts-expect-error Build audit is JavaScript outside pure core.
import { checkEffectCoverage, effectPayloadFixtures } from '../../scripts/check-effect-contracts.mjs';

it('P8-TP-R6-CONTRACT-MAP requires the repaired executable slice-A acceptance fixtures', () => {
  expect(effectPayloadFixtures).toEqual(expect.arrayContaining([
    'P8-TP-R6-FINDING-2', 'P8-TP-R6-FINDING-3', 'P8-TP-R6-DISPATCH-ROUTE',
    'P8-TP-R6-FETCH-MISSING', 'P8-TP-R6-TRANSCRIPT-missing', 'P8-TP-R6-TRANSCRIPT-expired',
    'P8-TP-R7-INTAKE-RECEIPT-COMPLETE', 'P8-TP-R7-PROTECTED-DENIAL-post-text',
    'P8-TP-R7-PROCESS-RESTART-post-text', 'P8-TP-R7-STATUS-SNAPSHOT',
    'P8-TP-R7-OWNER-P4', 'P8-TP-R7-OWNER-P4-PROTECTED-DENIAL', 'P8-TP-R7-OWNER-P5', 'P8-TP-R7-OWNER-P7',
    'P8-TP-R7-REFUSAL-BYTES', 'P8-TP-R7-HISTORICAL-SETTLEMENT-LOSS',
    'P8-TP-R7-LEGACY-ALL-RECORD-MUTATIONS',
  ]));
  expect(effectPayloadFixtures.some((id: string) => id.includes('AGGREGATE'))).toBe(false);
  expect(effectPayloadFixtures.some((id: string) => id.includes('RECOVERY'))).toBe(false);
  expect(() => checkEffectCoverage({ success: true, testResults: [] })).toThrow('missing executed');
});
