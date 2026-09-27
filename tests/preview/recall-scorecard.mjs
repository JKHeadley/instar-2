import { writeFileSync } from 'node:fs';
import { runRecallScorecard } from './recall-scorecard.ts';

const output = process.argv[2];
if (!output?.startsWith('/')) throw Error('usage: node --loader ./scripts/slice-ts-loader.mjs tests/preview/recall-scorecard.mjs ABSOLUTE_OUTPUT.json');
const result = await runRecallScorecard();
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ overall: result.overall, categories: result.categories })}\n`);
