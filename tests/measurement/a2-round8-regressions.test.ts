import { describe, expect, it } from 'vitest';
import { round8Cases } from './a2-round8-review-cases.js';

describe('Part 16 A2a round-eight independent review regressions', () => {
  it('imports the three exposing reviewer expectations and their acceptance controls', () => {
    expect(round8Cases).toHaveLength(8);
  });

  for (const reviewCase of round8Cases) {
    it(`P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] ${reviewCase.name}`, () => {
      expect(reviewCase.pass,
        JSON.stringify(reviewCase.actual ?? reviewCase.exception, null, 2)).toBe(true);
    });
  }
});
