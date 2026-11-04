// Rules 60/61: exercise the shipped admission path without launching processes
// or creating host load. These are local slot/reserve proofs, not confinement.
import { afterEach, expect, it, vi } from 'vitest';
// @ts-expect-error The physical host adapter is JavaScript.
import { createResourceOwner, RESOURCE_CEILINGS } from '../../scripts/resource-owner.mjs';

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
