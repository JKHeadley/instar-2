import { expect, it } from 'vitest';
import { runRound10ReviewSources } from '../measurement/a2-round10-review-runner.js';

const summary = runRound10ReviewSources();

for (const [finding, pass] of Object.entries(summary.findings))
  it(`P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read] P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] ${finding} passes the integrated measurement surface`, () => {
    expect(pass).toBe(true);
  });

it('imports all round-ten reviewer controls into the integrated measurement surface', () => {
  expect(summary).toMatchObject({ cases: 26, passed: 26, failed: [] });
});
