import { expect, it } from 'vitest';
// @ts-expect-error host adapter is JavaScript
import { createTopicWorkerCapacity, parseVmStatAvailable } from '../../scripts/topic-worker-capacity.mjs';
import { CONVERSATION_SESSION_LIMITS } from '../../src/assembly/production-conversation-session.js';

it.each([
  [12, 4, true, false], [11, 4, false, false],
  [80, 1, false, true], [80, 2, true, false], [80, 0, false, true],
])('sampled idle %s and free GiB %s produce admission %s and memory pressure %s', async (idle, free, admit, memoryPressure) => {
  let ticks = 0;
  const capacity = createTopicWorkerCapacity(CONVERSATION_SESSION_LIMITS, {
    cpus: () => [{ times: { idle: ticks * Number(idle), user: ticks * (100 - Number(idle)) } }],
    availableMemory: () => Number(free) * 1024 ** 3, totalmem: () => 16 * 1024 ** 3,
    wait: async () => { ticks++; },
  });
  expect(await capacity()).toMatchObject({ admit, memoryPressure });
});

it('unknown observations retain queued admission without pretending memory pressure', async () => {
  const capacity = createTopicWorkerCapacity(CONVERSATION_SESSION_LIMITS, { cpus: () => { throw Error('unavailable'); } });
  expect(await capacity()).toMatchObject({ admit: false, memoryPressure: false });
});

it('a zero CPU interval is unknown and a proportional memory reserve holds on large hosts', async () => {
  const io = { cpus: () => [{ times: { idle: 1, user: 0 } }], wait: async () => {},
    availableMemory: () => 4 * 1024 ** 3, totalmem: () => 64 * 1024 ** 3 };
  expect(await createTopicWorkerCapacity(CONVERSATION_SESSION_LIMITS, io)()).toMatchObject({ admit: false, memoryPressure: true });
});

// Rule 36: real bytes from the Studio, 2026-11-07 07:44, during a refused worker wait: raw free pages 1.2 GiB
// on a 64 GiB host, 12.7 GiB reclaimable. os.freemem() reported the first number and the reserve needs 6.4 GiB.
const STUDIO_VM_STAT = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                    79904.
Pages active:                                 854094.
Pages inactive:                               833713.
Pages speculative:                             18269.
Pages throttled:                                   0.
Pages wired down:                             447987.
Pages purgeable:                                 142.
`;
const reclaimedTo = (pages: number) => STUDIO_VM_STAT.replace('833713', String(pages));

it('macOS available memory counts reclaimable pages, as a raw free-page count cannot', () => {
  expect(parseVmStatAvailable(STUDIO_VM_STAT)).toBe((79904 + 833713 + 142) * 16384);
  expect(() => parseVmStatAvailable('vm_stat: unavailable')).toThrow();
});

it.each([
  [STUDIO_VM_STAT, { admit: true, memoryPressure: false }],
  [reclaimedTo(100000), { admit: false, memoryPressure: true }],
])('real vm_stat bytes decide memory pressure on both sides', async (bytes, expected) => {
  let ticks = 0;
  const capacity = createTopicWorkerCapacity(CONVERSATION_SESSION_LIMITS, {
    cpus: () => [{ times: { idle: ticks * 80, user: ticks * 20 } }], wait: async () => { ticks++; },
    availableMemory: () => parseVmStatAvailable(bytes), totalmem: () => 64 * 1024 ** 3,
  });
  expect(await capacity()).toMatchObject(expected);
});

it('a refusal leaves one record of its reason per change, and admission clears it', async () => {
  let ticks = 0, idle = 5, memory = 32;
  const lines: string[] = [];
  const capacity = createTopicWorkerCapacity(CONVERSATION_SESSION_LIMITS, {
    cpus: () => [{ times: { idle: ticks * idle, user: ticks * (100 - idle) } }], wait: async () => { ticks++; },
    availableMemory: () => memory * 1024 ** 3, totalmem: () => 64 * 1024 ** 3,
  }, (line: string) => lines.push(line));
  await capacity(); await capacity();
  expect(lines).toEqual(['worker capacity refused: CPU idle below floor']);
  memory = 1; await capacity();
  idle = 80; memory = 32; await capacity(); idle = 5; await capacity();
  expect(lines).toEqual(['worker capacity refused: CPU idle below floor', 'worker capacity refused: available memory below reserve',
    'worker capacity refused: CPU idle below floor']);
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

// Group U regressed after f692c56a: four answers no longer saturate the nine-slot owner.
// Hold leases explicitly so the boundary is tested without timing, child processes or host load.
it('pins the shipped Rule 60 vector and reaches and holds both launch and answer-reserve boundaries', async () => {
  // @ts-expect-error host owner is JavaScript
  const { RESOURCE_CEILINGS, createResourceOwner } = await import('../../scripts/resource-owner.mjs');
  expect(RESOURCE_CEILINGS).toMatchObject({
    launch: { memoryBytes: 18 * 1024 ** 3, processCount: 288, handleCount: null, cpuMilliseconds: null },
    aggregate: { memoryBytes: 18 * 1024 ** 3, processCount: 288, launches: 9 }, reserveLaunches: 1,
  });
  for (const ceiling of [9, 2]) {
    const owner = createResourceOwner({ ...RESOURCE_CEILINGS,
      aggregate: { ...RESOURCE_CEILINGS.aggregate, launches: ceiling } });
    const leases = [];
    const hold = (work: string) => owner.hold(work, { timeout: 1, stopped: () => false });
    try {
      for (let index = 0; index < ceiling - 1; index++) {
        const lease = await hold('answer');
        expect(lease).not.toBeNull(); leases.push(lease!);
      }
      expect(await hold('maintenance')).toBeNull();
      expect(owner.snapshot().active).toHaveLength(ceiling - 1);
      const answer = await hold('answer');
      expect(answer).not.toBeNull(); leases.push(answer!);
      expect(await hold('answer')).toBeNull();
      expect(owner.snapshot().active).toHaveLength(ceiling);
      expect(owner.snapshot().peak.launches).toBe(ceiling);
    } finally { for (const lease of leases) await lease.release(); }
    expect(owner.snapshot().active).toHaveLength(0);
    const maintenance = await hold('maintenance');
    try {
      expect(maintenance).not.toBeNull();
      expect(owner.snapshot().active).toHaveLength(1);
    } finally { await maintenance?.release(); }
  }
});

it.each([3, 37, 58, 50, 31, 49, 30, 22, 26, 11, 23, 14, 41, 52, 13, 18, 11, 10, 24, 7, 20, 22, 25, 21, 24, 5, 27, 20, 44, 46, 10])('operator admission ignores CPU idle %s (Studio sequence in builder brief, 2026-11-12 12:41)', async idle => {
  let ticks = 0;
  const capacity = createTopicWorkerCapacity(CONVERSATION_SESSION_LIMITS, {
    cpus: () => [{ times: { idle: ticks * idle, user: ticks * (100 - idle) } }],
    wait: async () => { ticks++; }, availableMemory: () => 8 * 1024 ** 3, totalmem: () => 16 * 1024 ** 3,
  });
  expect(await capacity(true)).toMatchObject({ admit: true, memoryPressure: false });
});

it('operator admission never consults CPU and still refuses unknown or pressured memory', async () => {
  let free = 8 * 1024 ** 3;
  const capacity = createTopicWorkerCapacity(CONVERSATION_SESSION_LIMITS, {
    cpus: () => { throw Error('CPU must not decide operator admission'); },
    availableMemory: () => free, totalmem: () => 16 * 1024 ** 3,
  });
  expect(await capacity(true)).toMatchObject({ admit: true });
  free = 0; expect(await capacity(true)).toMatchObject({ admit: false, memoryPressure: true });
  free = NaN; expect(await capacity(true)).toMatchObject({ admit: false, memoryPressure: false });
});

it.each([[3, false], [40, true]])('background CPU %s is measured across one second', async (idle, admit) => {
  let ticks = 0; const waits: number[] = [];
  const capacity = createTopicWorkerCapacity(CONVERSATION_SESSION_LIMITS, {
    cpus: () => [{ times: { idle: ticks * Number(idle), user: ticks * (100 - Number(idle)) } }],
    wait: async (ms: number) => { waits.push(ms); ticks++; }, availableMemory: () => 8 * 1024 ** 3, totalmem: () => 16 * 1024 ** 3,
  });
  expect(await capacity(false)).toMatchObject({ admit }); expect(waits).toEqual([1000]);
});
