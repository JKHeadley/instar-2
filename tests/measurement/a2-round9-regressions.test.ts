import { describe, expect, it } from 'vitest';
import { runRound9ReviewSources } from './a2-round9-review-runner.js';

describe('Part 16 A2a round-nine independent review regressions', () => {
  const summary = runRound9ReviewSources();

  it('P16-NF-33 [behavior:burn-hysteresis] F1 retains omitted unavailable events as population debt', () => {
    expect(summary.findings.F1).toBe(true);
  });

  it('P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] F2 re-derives the prior recovery vote', () => {
    expect(summary.findings.F2).toBe(true);
  });

  it('P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] F3 uses the fresh byte-equal aggregate witness', () => {
    expect(summary.findings.F3).toBe(true);
  });

  it('P16-NF-33 [behavior:burn-hysteresis] F4 refuses both overflowing burn-sum orders', () => {
    expect(summary.findings.F4).toBe(true);
  });

  it('re-executes every imported round-nine reviewer case', () => {
    expect(summary).toMatchObject({ cases: 39, passed: 39, failed: [],
      findings: { F1: true, F2: true, F3: true, F4: true } });
  });
});
