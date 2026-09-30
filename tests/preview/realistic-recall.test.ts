import { expect, it } from 'vitest';
import { conversation, scenes } from './realistic-recall-fixture.js';
import { runRealisticRecall } from './realistic-recall.js';

it('keeps current facts and excludes stale facts in a varied 300-turn diary', async () => {
  expect(conversation()).toHaveLength(300);
  expect(new Set(conversation()).size).toBe(300);
  expect(scenes).toHaveLength(30);
  expect(new Set(scenes.map(scene => scene.topic))).toEqual(new Set(['errand', 'family', 'work', 'date']));
  expect(scenes.filter(scene => scene.old)).toHaveLength(5);
  expect(scenes.filter(scene => scene.forget)).toHaveLength(2);
  const result = await runRealisticRecall();
  expect(result.questions).toBe(60);
  expect(result.memoryChanges).toBe(7);
  expect(result.summaries).toBeGreaterThan(10);
  expect(result.cases.every(item => item.historyMode === 'summary-plus-recent')).toBe(true);
  expect(result.cases.every(item => item.packetBytes <= 24000)).toBe(true);
  expect(result.positiveCases).toBe(56);
  expect(result.neededPresent).toBe(56);
  expect(result.exclusionCases).toBe(14);
  expect(result.staleAbsent).toBe(14);
  expect(result.misses).toEqual([]);
}, 120_000);
