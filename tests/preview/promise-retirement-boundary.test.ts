import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createHostResourceAllocation } from './six-host-resources.js';
// @ts-expect-error Physical owner remains JavaScript.
import { createResourceOwner, RESOURCE_CEILINGS } from '../../scripts/resource-owner.mjs';

it('reproduces why an existing verified cleanup is not an all-descendant retirement witness', async () => {
  const root = mkdtempSync(join(tmpdir(), 'retirement-boundary-')); chmodSync(root, 0o700);
  const before = 'Mon Sep 28 09:29:00 2026', started = 'Mon Sep 28 09:30:00 2026';
  const uid = process.getuid!(); let workerAlive = true;
  const row = (pid: number, ppid: number, time: string) => `${pid} ${ppid} ${pid} ${uid} 4096 0:00 S ${time} fixture`;
  // Exact injected crash cut: worker 201 dies; detached child 202 changes cwd and
  // is adopted by older subreaper 300. No real PID is signalled by this fixture.
  const census = () => [row(process.pid, 1, before), row(300, 1, before), row(202, 300, started),
    ...(workerAlive ? [row(201, process.pid, started)] : [])].join('\n');
  const allocation = createHostResourceAllocation({ root, machine: 'boundary-fixture', ceilings: RESOURCE_CEILINGS,
    incarnation: 'boundary-1', now: () => 1000, monotonic: () => 1000 });
  const owner = createResourceOwner(); let lease: { release(): Promise<{ verified: boolean }> } | undefined;
  try {
    await owner.attach({ ledgerPath: join(root, 'owned-launches.json'), allocation,
      now: () => 1000, monotonic: () => 1000,
      query: async (_file: string, args: string[]) => {
        if (args.includes('-U')) return census();
        if (args.includes('lstart=')) return args.includes('201') ? workerAlive ? started : '' : before;
        if (args.includes('cwd')) return `p202\nn/tmp\n`;
        return null;
      }, signal: () => { throw Error('this test must not signal any process'); } });
    const held = await owner.hold('maintenance', { timeout: 1000 });
    lease = held; await held.attach({ pid: 201, cwd: root });
    workerAlive = false;
    expect(await held.release()).toMatchObject({ verified: true });
    expect(allocation.open()).toHaveLength(0);
    expect(census()).toContain('202 300 202');
  } finally { await lease?.release(); rmSync(root, { recursive: true, force: true }); }
});
