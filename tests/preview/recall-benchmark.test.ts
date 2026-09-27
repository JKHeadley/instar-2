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
  const byId = new Map(result.cases.map(item => [item.id, item]));
  for (const id of ['sam-ambiguous', 'sam-accounting', 'sam-neighbour', 'john-ambiguous', 'jon-design', 'john-legal']) {
    expect(byId.get(id)?.containsWanted, id).toBe(true);
    expect(byId.get(id)?.historyMode, id).toBe('summary-plus-recent');
  }
  for (const id of ['sam-ambiguous', 'john-ambiguous']) {
    expect(byId.get(id)?.answer.match(/\?/gu), id).toHaveLength(1);
  }
  expect(byId.get('sam-accounting')?.answer).toContain('blue budget');
  expect(byId.get('sam-neighbour')?.answer).toContain('red ladder');
  expect(byId.get('jon-design')?.answer).toContain('amber cover');
  expect(byId.get('john-legal')?.answer).toContain('green contract');
  // Timing fields must name their measured phase, including the probe-only per-case timer.
  expect(result).toHaveProperty('historyBuildNonModelMs');
  expect(result).not.toHaveProperty('nonModelMs');
  expect(result.cases.every(item => 'probePreparationMs' in item && !('packetMs' in item))).toBe(true);
}, 120_000);
