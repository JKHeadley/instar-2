import { describe, expect, it } from 'vitest';
import { runRound10ReviewSources } from './a2-round10-review-runner.js';

describe('Part 16 A2a round-ten independent review regressions', () => {
  const summary = runRound10ReviewSources();

  it('P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] F1 re-derives every recovery vote at the current clock', () => {
    expect(summary.findings.F1).toBe(true);
  });

  it('P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read] F2 retains incompatible occurrence clocks as a contradiction', () => {
    expect(summary.findings.F2).toBe(true);
  });

  it('P16-NF-33 [behavior:burn-hysteresis] F3 refuses an inexactly representable baseline median', () => {
    expect(summary.findings.F3).toBe(true);
  });

  it('re-executes every imported round-ten reviewer case', () => {
    expect(summary).toMatchObject({ cases: 26, passed: 26, failed: [],
      findings: { F1: true, F2: true, F3: true } });
  });
});
