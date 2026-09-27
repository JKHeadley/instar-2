import { expect, it } from 'vitest';
import { runMemoryScale10k } from './memory-scale-10k.js';
// Scale evidence: run with INSTAR_PREVIEW_SCALE=1 for journal, retrieval or compaction changes and
// release validation; ordinary edits skip it (README "Scale checks").
const scale = process.env.INSTAR_PREVIEW_SCALE === '1';

it.runIf(scale)('recalls 10,000 saved facts across 300 people and topics within offline bounds', async () => {
  const result = await runMemoryScale10k();
  process.stdout.write(`memory scale 10k: ${JSON.stringify(result)}\n`);
  expect(result.facts).toBe(10000);
  expect(result.people + result.topics).toBe(300);
  expect(result.packetSelectionAccuracy).toBe(1);
  expect(result.recallAccuracy).toBe(1);
  expect(result.packetBytesMax).toBeLessThanOrEqual(24000);
  expect(result.probeP95Ms).toBeLessThan(500);
  expect(result.turnP95Ms).toBeLessThan(250);
  expect(result.replayMs).toBeLessThan(5000);
}, 360_000); // The asserted latency bounds above are the contract; seeding 2000 turns took 159-176 s under suite load.
