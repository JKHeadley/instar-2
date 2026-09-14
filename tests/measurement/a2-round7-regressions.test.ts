import { describe, expect, it } from 'vitest';
import { round7Cases } from './a2-round7-review-cases.js';

function label(name: string): string {
  if (name.startsWith('freshness:'))
    return 'P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read] P16-NF-36 [behavior:deterministic-historical-presentation]';
  if (name.startsWith('malformed:'))
    return 'P16-NF-04 [behavior:evidence-quantity-binding]';
  return 'P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read]';
}

describe('Part 16 A2a round-seven independent review regressions', () => {
  it('imports all five exposing reviewer expectations with their acceptance controls', () => {
    expect(round7Cases).toHaveLength(9);
  });

  for (const reviewCase of round7Cases) {
    it(`${label(reviewCase.name)} ${reviewCase.name}`, () => {
      expect(reviewCase.pass,
        JSON.stringify(reviewCase.actual ?? reviewCase.exception, null, 2)).toBe(true);
    });
  }
});
