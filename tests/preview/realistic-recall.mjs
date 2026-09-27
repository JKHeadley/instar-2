import { writeFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { runRealisticRecall } from './realistic-recall.ts';

const output = process.argv[2];
if (!output || !isAbsolute(output)) throw Error('usage: realistic-recall.mjs /ABSOLUTE/OFFLINE_RESULT.json');
const result = await runRealisticRecall();
const byScenarioCategory = Object.fromEntries(['named question', 'reworded follow-up', 'correction chain', 'pronoun', 'date']
  .map(category => [category, result.misses.filter(item => item.scenarioCategory === category).map(item => item.id)]));
const byObservation = Object.fromEntries(['needed clause absent', 'stale clause present']
  .map(observation => [observation, result.misses.filter(item => item.observedMiss === observation).map(item => item.id)]));
writeFileSync(output, `${JSON.stringify({ schemaVersion: 2, method: 'offline replayed-journal packet visibility; no model answer quality',
  diagnosticScope: 'observedMiss reports packet inclusion/exclusion; scenarioCategory labels the fixture, not a diagnosed cause. Narrower causal attribution is unmeasured.',
  ...result, missesByObservation: byObservation, missesByScenarioCategory: byScenarioCategory }, null, 2)}\n`);
process.stdout.write(`${result.turns} turns, ${result.questions} questions: ${result.neededPresent}/${result.positiveCases} needed present, ${result.staleAbsent}/${result.exclusionCases} stale absent, ${result.misses.length} misses\n`);
