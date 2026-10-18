import { expect, it } from 'vitest';
import { conversation, scenes } from './realistic-recall-fixture.js';
import { REALISTIC_RECALL_LIMIT, runRealisticRecall } from './realistic-recall.js';

it('keeps current facts and excludes stale facts in a varied 300-turn diary', async () => {
  expect(conversation()).toHaveLength(300);
  expect(new Set(conversation()).size).toBe(300);
  expect(scenes).toHaveLength(30);
  expect(new Set(scenes.map(scene => scene.topic))).toEqual(new Set(['errand', 'family', 'work', 'date']));
  expect(scenes.filter(scene => scene.old)).toHaveLength(5);
  expect(scenes.filter(scene => scene.forget)).toHaveLength(2);
  const result = await runRealisticRecall();
  expect(result.questions).toBe(61);
  expect(result.memoryChanges).toBe(7);
  expect(result.summaries).toBeGreaterThan(10);
  expect(result.cases.every(item => item.historyMode === 'summary-plus-recent')).toBe(true);
  expect(result.cases.every(item => item.packetBytes <= REALISTIC_RECALL_LIMIT)).toBe(true);
  expect(result.positiveCases).toBe(57);
  expect(result.neededPresent).toBe(57);
  expect(result.exclusionCases).toBe(14);
  expect(result.staleAbsent).toBe(14);
  expect(result.misses).toEqual([]);
  // The recorded paraphrase (proof room two, 2026-10-02): no word of the question is in the fact, and no writer's
  // terms are lent to it here. The first packet misses it; the one lookup, with the real model's recorded search
  // phrases, brings the original message in among 300 unrelated diary turns.
  const recorded = result.cases.find(item => item.scenarioCategory === 'recorded paraphrase')!;
  expect(recorded.firstPacketPresent).toBe(false);
  expect(recorded.lookup).toEqual(['hut code', 'rake shed number', 'shed combination', 'rake hut lock', 'tool shed code', 'hut key code']);
  expect(recorded.neededPresent).toBe(true);
}, 120_000);
