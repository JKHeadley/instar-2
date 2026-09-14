import { expect, it } from 'vitest';
import { runRound9ReviewSources } from '../measurement/a2-round9-review-runner.js';

const summary = runRound9ReviewSources();

for (const [finding, pass] of Object.entries(summary.findings))
  it(`P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] ${finding} passes the integrated measurement surface`, () => {
    expect(pass).toBe(true);
  });

it('imports all round-nine reviewer controls into the integrated measurement surface', () => {
  expect(summary).toMatchObject({ cases: 39, passed: 39, failed: [] });
});
