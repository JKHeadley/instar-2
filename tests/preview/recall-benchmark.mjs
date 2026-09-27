import { writeFileSync } from 'node:fs';
import { runRecallSet } from './recall-benchmark.ts';

const output = process.argv[2];
if (!output) throw Error('usage: node --loader ./scripts/slice-ts-loader.mjs tests/preview/recall-benchmark.mjs ABSOLUTE_OUTPUT.json');
const sets = [];
for (const turns of [200, 1000, 2000]) {
  const result = await runRecallSet(turns);
  sets.push(result);
  process.stdout.write(`${turns}: recall=${result.recall} precision=${result.precision} packetMean=${result.packetBytesMean} nonModelMs=${result.nonModelMs}\n`);
}
writeFileSync(output, `${JSON.stringify({ schemaVersion: 1, method: 'offline packet visibility; deterministic packet-only answer stub', sets }, null, 2)}\n`);
