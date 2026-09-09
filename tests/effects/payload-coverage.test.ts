import { expect, it } from 'vitest';
// @ts-expect-error Build audit is JavaScript outside pure core.
import { checkEffectCoverage, effectPayloadFixtures } from '../../scripts/check-effect-contracts.mjs';

it('P8-TP-REPAIR-11 contract map requires every repair acceptance fixture', () => {
  const repairs = effectPayloadFixtures.filter((id: string) => id.startsWith('P8-TP-REPAIR-'));
  expect(repairs).toEqual(Array.from({ length: 11 }, (_, index) => `P8-TP-REPAIR-${String(index + 1).padStart(2, '0')}`));
  expect(effectPayloadFixtures.filter((id: string) => /^P8-TP-F\d+-/.test(id))).toEqual([
    'P8-TP-F1-ASSESSMENT-REPLAY', 'P8-TP-F2-P2-STATUS', 'P8-TP-F3-REAL-P', 'P8-TP-F4-EXTERNAL-REFERENCES',
    'P8-TP-F5-PROTECTED-REFUSAL', 'P8-TP-F6-GIT-DESCENDANT', 'P8-TP-F7-MOVE-CARDINALITY',
    'P8-TP-F8-HISTORICAL-CLOCK', 'P8-TP-F9-AGGREGATE-READ', 'P8-TP-F10-OPTIONAL-UNCERTAINTY',
    'P8-TP-F11-CLOSE-APPEND-CUT', 'P8-TP-F12-LEGACY-FIXTURE', 'P8-TP-F13-DEFINITION-PAYLOAD',
  ]);
  expect(() => checkEffectCoverage({ success: true, testResults: [] })).toThrow('missing executed');
});
