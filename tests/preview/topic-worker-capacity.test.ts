import { expect, it } from 'vitest';
// @ts-expect-error host adapter is JavaScript
import { createTopicWorkerCapacity } from '../../scripts/topic-worker-capacity.mjs';
import { CONVERSATION_SESSION_LIMITS } from '../../src/assembly/production-conversation-session.js';

it.each([
  [12, 4, true, false], [11, 4, false, false],
  [80, 1, false, true], [80, 2, true, false], [80, 0, false, true],
])('sampled idle %s and free GiB %s produce admission %s and memory pressure %s', async (idle, free, admit, memoryPressure) => {
  let ticks = 0;
  const capacity = createTopicWorkerCapacity(CONVERSATION_SESSION_LIMITS, {
    cpus: () => [{ times: { idle: ticks * Number(idle), user: ticks * (100 - Number(idle)) } }],
    freemem: () => Number(free) * 1024 ** 3, totalmem: () => 16 * 1024 ** 3,
    wait: async () => { ticks++; },
  });
  expect(await capacity()).toEqual({ admit, memoryPressure });
});

it('unknown observations retain queued admission without pretending memory pressure', async () => {
  const capacity = createTopicWorkerCapacity(CONVERSATION_SESSION_LIMITS, { cpus: () => { throw Error('unavailable'); } });
  expect(await capacity()).toEqual({ admit: false, memoryPressure: false });
});

it('a zero CPU interval is unknown and a proportional memory reserve holds on large hosts', async () => {
  const io = { cpus: () => [{ times: { idle: 1, user: 0 } }], wait: async () => {},
    freemem: () => 4 * 1024 ** 3, totalmem: () => 64 * 1024 ** 3 };
  expect(await createTopicWorkerCapacity(CONVERSATION_SESSION_LIMITS, io)()).toEqual({ admit: false, memoryPressure: true });
});

// Exercise the actual host owner's count gate, without starting a child or CPU load.
it('the host owner admits eight topic leases and preserves the ninth slot for answers', async () => {
  // @ts-expect-error host owner is JavaScript
  const { createResourceOwner } = await import('../../scripts/resource-owner.mjs');
  const owner = createResourceOwner();
  const leases = [];
  try {
    for (let index = 0; index < 8; index++) {
      const lease = await owner.hold('maintenance', { timeout: 1, stopped: () => false });
      expect(lease).not.toBeNull(); leases.push(lease!);
    }
    expect(await owner.hold('maintenance', { timeout: 1, stopped: () => false })).toBeNull();
    const answer = await owner.hold('answer', { timeout: 1, stopped: () => false });
    expect(answer).not.toBeNull(); leases.push(answer!);
    expect(await owner.hold('answer', { timeout: 1, stopped: () => false })).toBeNull();
  } finally { for (const lease of leases) await lease.release(); }
});
