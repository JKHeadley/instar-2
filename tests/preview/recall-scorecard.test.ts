import { expect, it } from 'vitest';
import { runRecallScorecard } from './recall-scorecard.js';

it('scores live-shaped recall from replayed model packets', async () => {
  const result = await runRecallScorecard();
  expect(result.cases).toHaveLength(9);
  expect(result.summaries).toBeGreaterThan(0);
  expect(result.cases.every(item => item.historyMode === 'summary-plus-recent')).toBe(true);
  expect(result.cases.every(item => item.packetBytes <= 12000)).toBe(true);
  expect(result.cases.filter(item => !item.pass)).toEqual([]);
  expect(result.cases.find(item => item.id === 'first-marker')?.evidenceSurfaces).toContain('recalled');
  expect(result.cases.find(item => item.id === 'latest-marker')?.evidenceSurfaces).toContain('recalled');
}, 120_000);
