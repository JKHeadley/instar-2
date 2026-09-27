import { writeFileSync } from 'node:fs';
import { runRecallSet } from './recall-benchmark.ts';

const output = process.argv[2];
if (!output) throw Error('usage: node --loader ./scripts/slice-ts-loader.mjs tests/preview/recall-benchmark.mjs ABSOLUTE_OUTPUT.json');
const sets = [];
for (const turns of [200, 1000, 2000]) {
  const result = await runRecallSet(turns);
  sets.push(result);
  process.stdout.write(`${turns}: recall=${result.recall} precision=${result.precision} packetMean=${result.packetBytesMean} historyBuildNonModelMs=${result.historyBuildNonModelMs}\n`);
}
writeFileSync(output, `${JSON.stringify({ schemaVersion: 1,
  method: 'offline packet visibility; deterministic packet-only answer stub',
  timingScope: {
    historyBuildNonModelMs: 'Per-turn fixture append, memory worker and forced summaries inside the history loop; stub execution subtracted. Excludes channel import, final summary, journal reopen/replay and later question runs.',
    probePreparationMs: 'Read-only worker.probe for one later question. Excludes that question\'s intake, actual model packet construction and drain.',
  }, sets }, null, 2)}\n`);
