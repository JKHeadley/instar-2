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
