import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error Physical qualification adapter.
import { decodeVerdict, extractReply, tokenUsage } from '../../scripts/setup-qualification.mjs';

it('replays the real Linux model bytes and preserves the failed qualification', () => {
  const report = JSON.parse(readFileSync(new URL('../qualification/evidence/linux-x86_64-2026-10-25.json', import.meta.url), 'utf8'));
  expect(report.pass).toBe(false);
  expect(report.independentAssessment.state).toBe('pending');
  expect(report.ownerEvidence.coverage.installedPreparationRun).toBe(false);
  expect(report.trials.length).toBeGreaterThan(0);
  for (const trial of report.trials) {
    const task = report.ownerEvidence.cases.find((row: { id: string }) => row.id === trial.case);
    if (trial.disposition === 'observed') {
      expect(decodeVerdict(extractReply(trial.output), task)).toEqual(trial.verdict);
      expect(tokenUsage(trial.diagnostics)).toEqual(trial.usage);
      expect(trial.raw.cgroup.controls['memory.max']).toBe('2147483648');
      expect(trial.raw.cgroup.controls['memory.swap.max']).toBe('0');
      expect(trial.raw.resources.cleanup).toBe('verified');
    }
    expect(trial.seven.calls).toBe(1);
    expect(trial.usage.charge).toBe(0);
  }
  // Real output, not a synthetic approval: Markdown wrappers are refused unchanged.
  expect(report.trials.some((row: { output: string; verdict: { disposition: string } }) =>
    row.output.includes('```json') && row.verdict.disposition === 'hold')).toBe(true);
  expect(report.computedNumericalBar.rejectedPositiveNeighbors).toBeGreaterThan(0);
});
