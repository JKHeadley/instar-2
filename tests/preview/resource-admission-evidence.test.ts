// Rules 60/61: exercise the shipped admission path without launching processes
// or creating host load. These are local slot/reserve proofs, not confinement.
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHostResourceAllocation } from './six-host-resources.js';
import { afterEach, expect, it, vi } from 'vitest';
// @ts-expect-error The physical host adapter is JavaScript.
import { createResourceOwner, RESOURCE_CEILINGS } from '../../scripts/resource-owner.mjs';
// @ts-expect-error Physical inventory module is JavaScript.
import { loadTenOwner } from '../../scripts/process-inventory.mjs';

afterEach(() => vi.useRealTimers());

it('PREVIEW-RESOURCE-ADMISSION keeps the answer reserve, caps all slots and drains waiting maintenance', async () => {
  vi.useFakeTimers();
  const owner = createResourceOwner({ ...RESOURCE_CEILINGS,
    aggregate: { ...RESOURCE_CEILINGS.aggregate, launches: 2 }, reserveLaunches: 1 });
  const signal = vi.fn();
  await owner.attach({ query: async () => null, signal, now: () => Date.now(), monotonic: () => Date.now() });
  const first = await owner.hold('maintenance', { timeout: 1000 });
  expect(first).not.toBeNull();
  const pending = owner.hold('maintenance', { timeout: 1000 });
  expect(owner.snapshot().waiting).toHaveLength(1);
  const answer = await owner.hold('answer', { timeout: 1000 });
  expect(answer).not.toBeNull();
  expect(owner.snapshot().active).toHaveLength(2);
  const over = owner.hold('answer', { timeout: 100 });
  await vi.advanceTimersByTimeAsync(100);
  expect(await over).toBeNull();
  expect(owner.snapshot().counters.refusedCapacity).toBe(1);
  await answer.release();
  // One maintenance lease still occupies its entire allowance.
  expect(owner.snapshot().waiting).toHaveLength(1);
  await first.release();
  const resumed = await pending;
  expect(resumed).not.toBeNull();
  await resumed.release();
  expect(owner.snapshot()).toMatchObject({ active: [], waiting: [], peak: { launches: 2 } });
  expect(signal).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('PREVIEW-RESOURCE-ADMISSION preserves a priority refusal until recovery and honors stop while queued', async () => {
  vi.useFakeTimers();
  let allowed = false;
  let stopped = false;
  const priorityGate = vi.fn(() => allowed);
  const owner = createResourceOwner();
  await owner.attach({ query: async () => null, signal: () => { throw Error('no process belongs to this test'); },
    priorityGate, now: () => Date.now(), monotonic: () => Date.now() });
  const pending = owner.hold('maintenance', { timeout: 1000 });
  const cancelled = owner.hold('maintenance', { timeout: 1000, stopped: () => stopped });
  await vi.advanceTimersByTimeAsync(100);
  expect(owner.snapshot()).toMatchObject({ active: [], waiting: [expect.anything(), expect.anything()] });
  expect(priorityGate).toHaveBeenCalledWith('medium', 'normal');
  stopped = true;
  await vi.advanceTimersByTimeAsync(100);
  expect(await cancelled).toBeNull();
  allowed = true;
  await vi.advanceTimersByTimeAsync(100);
  const resumed = await pending;
  expect(resumed).not.toBeNull();
  await resumed.release();
  expect(owner.snapshot()).toMatchObject({ active: [], waiting: [], counters: { admitted: 1 } });
  expect(vi.getTimerCount()).toBe(0);
});

it('the resource owner reports measured host CPU deltas, preserving first-sample and reset uncertainty', async () => {
  let now = 1000, user = 100, idle = 100;
  const owner = createResourceOwner();
  await owner.attach({ query: async () => null, signal: () => { throw Error('observation cannot signal'); },
    now: () => now, cpuTimes: () => [{ user, idle, sys: 0, nice: 0, irq: 0 }] });
  expect(owner.hostObservation()).toMatchObject({ state: 'unknown', busyFraction: null });
  now += 1000; user += 10; idle += 90;
  expect(owner.hostObservation()).toMatchObject({ state: 'available', busyFraction: .1, intervalMs: 1000, basis: 'host-cpu-time-delta' });
  now += 1000; user += 90; idle += 10;
  expect(owner.hostObservation()).toMatchObject({ state: 'pressured', busyFraction: .9 });
  now += 1000; user = 0;
  expect(owner.hostObservation()).toMatchObject({ state: 'unknown', busyFraction: null });
  expect(owner.snapshot().hostCpu.state).toBe('unknown');
  expect(owner.sessionProgress(`instar20-${'a'.repeat(24)}:501:1000`)).toEqual({ descendantCpuSeconds: null, mainProcessActive: null });
});

it('session progress reuses the complete owned inventory and never treats a reused or stale root as work', async () => {
  await loadTenOwner();
  vi.useFakeTimers();
  let now = 1000, cpu = '00:01', start = 'Thu Nov 5 05:00:00 2026', gone = false;
  const uid = process.getuid?.() ?? 1000;
  const owner = createResourceOwner({ ...RESOURCE_CEILINGS, sampleMs: 1000 });
  const query = async (_file: string, args: string[]) => {
    if (args.includes('lstart=')) return gone ? '' : start;
    if (args.includes('-U')) return gone ? '' : `501 1 501 ${uid} 1024 ${cpu} S ${start} fixture\n`;
    return null;
  };
  await owner.attach({ query, signal: vi.fn(), now: () => now, monotonic: () => now });
  const held = await owner.hold('maintenance', { timeout: 10000 });
  await held.attach({ pid: 501, cwd: '/tmp' });
  const identity = `instar20-${'a'.repeat(24)}:501:1000`;
  now += 1000; await vi.advanceTimersByTimeAsync(1000);
  expect(owner.sessionProgress(identity)).toMatchObject({ descendantCpuSeconds: 1, mainProcessActive: null });
  now += 1000; cpu = '00:03'; await vi.advanceTimersByTimeAsync(1000);
  expect(owner.sessionProgress(identity)).toMatchObject({ descendantCpuSeconds: 3, mainProcessActive: true });
  now += 11000;
  expect(owner.sessionProgress(identity).descendantCpuSeconds).toBeNull();
  start = 'Thu Nov 5 05:05:00 2026'; await vi.advanceTimersByTimeAsync(1000);
  expect(owner.sessionProgress(identity).descendantCpuSeconds).toBeNull();
  gone = true; await held.release();
  expect(vi.getTimerCount()).toBe(0);
});


it('long-indeterminate slot exclusion keeps the real Six debit and requires its durable exact root record', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stale-retained-exposure-'));
  let gone = false, now = 1000;
  const owner = createResourceOwner();
  const allocation = createHostResourceAllocation({ root, machine: 'machine:stale-fixture', ceilings: RESOURCE_CEILINGS,
    incarnation: 'stale-fixture', now: () => now, monotonic: () => now });
  try {
    await owner.attach({ ledgerPath: join(root, 'launches.json'), allocation, now: () => now,
      query: async (_file: string, args: string[]) => args.includes('lstart=') && !gone ? 'Thu Nov 5 05:00:00 2026' : '',
      signal: () => { throw Error('fixture observes only'); } });
    const held = await owner.hold('maintenance', { timeout: 10000 });
    await held.attach({ pid: 501, cwd: root });
    const identity = `instar20-${'a'.repeat(24)}:501:1000`;
    expect(owner.retainedSessionExposure(identity)).toBe(true);
    expect(owner.retainedSessionExposure(`instar20-${'a'.repeat(24)}:502:1000`)).toBe(false);
    expect(allocation.open()).toHaveLength(1);
    // Merely classifying the old slot does not return any resource capacity.
    expect(owner.retainedSessionExposure(identity)).toBe(true);
    expect(allocation.open()).toHaveLength(1);
    gone = true; now++;
    expect(await held.release()).toMatchObject({ verified: true });
    expect(allocation.open()).toHaveLength(0);
    expect(owner.retainedSessionExposure(identity)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
