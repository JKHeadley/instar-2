import { expect, it } from 'vitest';
// @ts-expect-error Build audit is JavaScript outside pure core.
import { checkEffectCoverage, effectPayloadFixtures } from '../../scripts/check-effect-contracts.mjs';

it('P8-TP-REPAIR-11 contract map requires every repair acceptance fixture', () => {
  const repairs = effectPayloadFixtures.filter((id: string) => id.startsWith('P8-TP-REPAIR-'));
  expect(repairs).toEqual(Array.from({ length: 11 }, (_, index) => `P8-TP-REPAIR-${String(index + 1).padStart(2, '0')}`));
  expect(() => checkEffectCoverage({ success: true, testResults: [] })).toThrow('missing executed');
});
