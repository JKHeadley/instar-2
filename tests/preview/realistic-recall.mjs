import { writeFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { runRealisticRecall } from './realistic-recall.ts';

const output = process.argv[2];
if (!output || !isAbsolute(output)) throw Error('usage: realistic-recall.mjs /ABSOLUTE/OFFLINE_RESULT.json');
const result = await runRealisticRecall();
const byCause = Object.fromEntries(['selection', 'summary loss', 'correction chain', 'pronoun', 'date']
  .map(cause => [cause, result.misses.filter(item => item.missCause === cause).map(item => item.id)]));
writeFileSync(output, `${JSON.stringify({ schemaVersion: 1, method: 'offline replayed-journal packet visibility; no model answer quality',
  ...result, missesByCause: byCause }, null, 2)}\n`);
process.stdout.write(`${result.turns} turns, ${result.questions} questions: ${result.neededPresent}/${result.positiveCases} needed present, ${result.staleAbsent}/${result.exclusionCases} stale absent, ${result.misses.length} misses\n`);
