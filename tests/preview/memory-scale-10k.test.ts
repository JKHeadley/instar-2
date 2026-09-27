import { expect, it } from 'vitest';
import { runMemoryScale10k } from './memory-scale-10k.js';

it('recalls 10,000 saved facts across 300 people and topics within offline bounds', async () => {
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
}, 180_000);
