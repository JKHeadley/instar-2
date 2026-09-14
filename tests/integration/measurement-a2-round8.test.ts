import { expect, it } from 'vitest';
import { round8Cases } from '../measurement/a2-round8-review-cases.js';

it('P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] round-eight current-support cases pass through real owner machinery', () => {
  expect(round8Cases).toHaveLength(8);
  expect(round8Cases.filter(candidate => !candidate.pass),
    JSON.stringify(round8Cases, null, 2)).toEqual([]);
});
