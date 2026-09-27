import { expect, it } from 'vitest';
import { runRecallSet } from './recall-benchmark.js';

// Baseline is the measured 200-turn packet recall from the offline benchmark.
it('keeps the 200-turn packet recall at its measured baseline', async () => {
  const result = await runRecallSet(200);
  expect(result.recall).toBeGreaterThanOrEqual(1);
  expect(result.precision).toBe(1);
  expect(result.summaries).toBeGreaterThan(0);
  expect(result.cases.every(item => item.historyMode === 'summary-plus-recent')).toBe(true);
  expect(result.cases.find(item => item.id === 'corrected')?.answer).toContain('6194');
  expect(result.cases.find(item => item.id === 'forgotten')?.answer).toBe('UNKNOWN');
  // Timing fields must name their measured phase, including the probe-only per-case timer.
  expect(result).toHaveProperty('historyBuildNonModelMs');
  expect(result).not.toHaveProperty('nonModelMs');
  expect(result.cases.every(item => 'probePreparationMs' in item && !('packetMs' in item))).toBe(true);
}, 120_000);
