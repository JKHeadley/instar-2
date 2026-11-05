import { expect, it } from 'vitest';
import { decidePromises, defaultPromiseConfig, type PromiseObservation } from '../../src/sentinels/promise.js';

const R = defaultPromiseConfig.reportAfterMs;
const promise = (over: Partial<PromiseObservation> = {}): PromiseObservation =>
  ({ id: 'commitment:0', owner: 'agent', dueAt: 1000, actedAt: null, waitsOn: 'date', ...over });

it('leaves a promise alone until its due instant, then asks the owner to act once', () => {
  expect(decidePromises({ now: 999, stopped: false, promises: [promise()], state: {} }).actions).toEqual([]);
  const due = decidePromises({ now: 1000, stopped: false, promises: [promise()], state: {} });
  expect(due.actions.map(action => action.kind)).toEqual(['work', 'signal']);
  expect(decidePromises({ now: 1001, stopped: false, promises: [promise()], state: due.state }).actions).toEqual([]);
});

it('reports a still-unacted promise once after the window, and records action when it lands', () => {
  const asked = decidePromises({ now: 1000, stopped: false, promises: [promise()], state: {} }).state;
  expect(decidePromises({ now: 1000 + R - 1, stopped: false, promises: [promise()], state: asked }).actions).toEqual([]);
  const reported = decidePromises({ now: 1000 + R, stopped: false, promises: [promise()], state: asked });
  expect(reported.actions[0]).toMatchObject({ kind: 'report', id: 'commitment:0' });
  expect(reported.state['commitment:0']?.outcome).toBe('reported');
  const acted = decidePromises({ now: 1000 + R + 5, stopped: false, promises: [promise({ actedAt: 1000 + R + 4 })], state: reported.state });
  expect(acted.actions).toEqual([expect.objectContaining({ event: 'acted' })]);
});

it('counts only a result at or after the due instant as acting on it', () => {
  const early = decidePromises({ now: 1000, stopped: false, promises: [promise({ actedAt: 999 })], state: {} });
  expect(early.actions[0]).toEqual({ kind: 'work', id: 'commitment:0' });
  const onTime = decidePromises({ now: 1000, stopped: false, promises: [promise({ actedAt: 1000 })], state: {} });
  expect(onTime.actions).toEqual([expect.objectContaining({ event: 'acted' })]);
});

it('reports an operator-owned or externally blocked promise as waiting, never as agent work', () => {
  for (const over of [{ owner: 'operator' as const }, { waitsOn: 'operator' }, { waitsOn: 'external' }]) {
    const out = decidePromises({ now: 1000, stopped: false, promises: [promise(over)], state: {} });
    expect(out.actions.map(action => action.kind)).toEqual(['report', 'signal']);
    expect(out.state['commitment:0']?.outcome).toBe('waiting');
  }
});

it('closes a promise that leaves the open population, and does nothing while stopped', () => {
  const asked = decidePromises({ now: 1000, stopped: false, promises: [promise()], state: {} }).state;
  const gone = decidePromises({ now: 2000, stopped: false, promises: [], state: asked });
  expect(gone.actions).toEqual([expect.objectContaining({ event: 'closed' })]);
  expect(gone.state['commitment:0']?.closedAt).toBe(2000);
  expect(decidePromises({ now: 5000, stopped: true, promises: [promise()], state: {} })).toEqual({ state: {}, actions: [] });
  expect(decidePromises({ now: 5000, stopped: false, promises: [promise({ dueAt: Number.NaN })], state: {} }).actions).toEqual([]);
});

it('keeps a known promise open when its next due time is future or temporarily unknown', () => {
  const asked = decidePromises({ now: 1000, stopped: false, promises: [promise()], state: {} }).state;
  for (const dueAt of [9000, Number.NaN]) {
    const observed = decidePromises({ now: 2000, stopped: false, promises: [promise({ dueAt })], state: asked });
    expect(observed.state['commitment:0']?.closedAt).toBeNull();
    expect(observed.actions).toEqual([]);
  }
});

it('starts a new due episode for continued work, but never repeats an unchanged slot after replay', () => {
  const asked = decidePromises({ now: 1000, stopped: false, promises: [promise()], state: {} }).state;
  const acted = decidePromises({ now: 2000, stopped: false, promises: [promise({ actedAt: 2000 })], state: asked }).state;
  const continued = promise({ dueAt: 5000, actedAt: 2000 });
  const next = decidePromises({ now: 5000, stopped: false, promises: [continued], state: JSON.parse(JSON.stringify(acted)) });
  expect(next.actions[0]).toEqual({ kind: 'work', id: 'commitment:0' });
  expect(decidePromises({ now: 5001, stopped: false, promises: [continued], state: next.state }).actions).toEqual([]);
});

it('a recorded dependency wait is waiting even after a definite step, and clears on resumed work', () => {
  const waiting = decidePromises({ now: 2000, stopped: false,
    promises: [promise({ waitsOn: 'external', actedAt: 2000 })], state: {} });
  expect(waiting.state['commitment:0']?.outcome).toBe('waiting');
  const resumed = decidePromises({ now: 3000, stopped: false,
    promises: [promise({ actedAt: 3000 })], state: waiting.state });
  expect(resumed.state['commitment:0']?.outcome).toBe('acted');
  expect(resumed.state['commitment:0']?.reportedAt).toBeNull();
});

it('dependency clearance requests work even when that same slot was previously reported overdue', () => {
  const asked = decidePromises({ now: 1000, stopped: false, promises: [promise()], state: {} }).state;
  const overdue = decidePromises({ now: 1000 + R, stopped: false, promises: [promise()], state: asked }).state;
  const waiting = decidePromises({ now: 2000 + R, stopped: false, promises: [promise({ waitsOn: 'operator' })], state: overdue });
  expect(waiting.state['commitment:0']?.outcome).toBe('waiting');
  const resumed = decidePromises({ now: 3000 + R, stopped: false, promises: [promise()], state: waiting.state });
  expect(resumed.actions[0]).toEqual({ kind: 'work', id: 'commitment:0' });
});

it('adopts the slot of an older already-reported row without replaying its action, then rearms a later slot', () => {
  const state = { 'commitment:0': { dueSeenAt: 1000, workRequestedAt: 1000, reportedAt: 2000,
    closedAt: null, outcome: 'reported' as const } };
  const migrated = decidePromises({ now: 3000, stopped: false, promises: [promise()], state });
  expect(migrated.actions).toEqual([]);
  expect(migrated.state['commitment:0']?.dueAt).toBe(1000);
  const later = decidePromises({ now: 5000, stopped: false, promises: [promise({ dueAt: 5000 })], state: migrated.state });
  expect(later.actions[0]).toEqual({ kind: 'work', id: 'commitment:0' });
});
