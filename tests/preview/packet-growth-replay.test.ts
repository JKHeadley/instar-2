import { expect, it } from 'vitest';
import { runPacketGrowthReplay } from './packet-growth-replay.js';

it('keeps 500 durable turns while packets use summaries and question-selected recall', () => {
  const result = runPacketGrowthReplay();
  expect(result.durableTurns).toBe(500);
  expect(result.checkpoints.map(item => item.turn)).toEqual([36, 100, 500]);
  expect(result.checkpoints.every(item => item.recall)).toBe(true);
  expect(result.checkpoints.every(item => item.otherAccuracy)).toBe(true);
  expect(result.checkpoints.every(item => !item.otherRecall)).toBe(true);
  expect(result.checkpoints.every(item => item.mode === 'summary-plus-recent')).toBe(true);
  expect(result.checkpoints.every(item => item.history <= 11)).toBe(true);
  expect(result.checkpoints[2]!.bytes).toBeLessThan(20_000);
  process.stdout.write(`packet growth replay: ${JSON.stringify(result)}\n`);
}, 120_000);
