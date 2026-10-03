import { expect, it } from 'vitest';
import { decidePresence, defaultPresenceConfig, type PresenceTurn } from '../../src/sentinels/presence.js';

const T = defaultPresenceConfig.thresholdMs, H = defaultPresenceConfig.healWindowMs;
const turn = (cause: PresenceTurn['cause'], answered = false): PresenceTurn => ({ id: 'telegram:1:update:7', receivedAt: 0, answered, cause });

it('does nothing before the threshold and asks for one self-heal at it', () => {
  expect(decidePresence({ now: T - 1, stopped: false, turns: [turn('held-check')], state: {} }).actions).toEqual([]);
  const at = decidePresence({ now: T, stopped: false, turns: [turn('held-check')], state: {} });
  expect(at.actions.map(action => action.kind)).toEqual(['self-heal', 'signal']);
  expect(at.state['telegram:1:update:7']).toMatchObject({ healAt: T, noteDueAt: null, closedAt: null });
});

it('marks a holding note due only after the self-heal window, never from the timer alone', () => {
  const healed = decidePresence({ now: T, stopped: false, turns: [turn('unpicked')], state: {} }).state;
  expect(decidePresence({ now: T + H - 1, stopped: false, turns: [turn('unpicked')], state: healed }).actions).toEqual([]);
  const due = decidePresence({ now: T + H, stopped: false, turns: [turn('unpicked')], state: healed });
  expect(due.actions[0]).toEqual({ kind: 'note-due', turn: 'telegram:1:update:7', cause: 'unpicked' });
  expect(due.state['telegram:1:update:7']?.noteDueAt).toBe(T + H);
  // Once due, nothing repeats.
  expect(decidePresence({ now: T + 10 * H, stopped: false, turns: [turn('unpicked')], state: due.state }).actions).toEqual([]);
});

it('fails toward silence for causes a note cannot state truthfully', () => {
  for (const cause of ['in-flight', 'waiting-operator', 'own-notice', 'unknown'] as const) {
    const first = decidePresence({ now: T + 10 * H, stopped: false, turns: [turn(cause)], state: {} });
    expect(first.actions).toEqual([expect.objectContaining({ kind: 'signal', event: 'unanswered-observed' })]);
    expect(first.state['telegram:1:update:7']).toMatchObject({ healAt: null, noteDueAt: null });
    expect(decidePresence({ now: T + 20 * H, stopped: false, turns: [turn(cause)], state: first.state }).actions).toEqual([]);
  }
});

it('closes on the answer and records whether it followed the self-heal or the note', () => {
  const healed = decidePresence({ now: T, stopped: false, turns: [turn('held-check')], state: {} }).state;
  const closed = decidePresence({ now: T + 1, stopped: false, turns: [turn('held-check', true)], state: healed });
  expect(closed.actions).toEqual([expect.objectContaining({ event: 'answered-after-heal' })]);
  expect(closed.state['telegram:1:update:7']?.closedAt).toBe(T + 1);
  const due = decidePresence({ now: T + H, stopped: false, turns: [turn('held-check')], state: healed }).state;
  expect(decidePresence({ now: T + H + 1, stopped: false, turns: [turn('held-check', true)], state: due }).actions)
    .toEqual([expect.objectContaining({ event: 'answered-after-note' })]);
});

it('requests nothing while stopped and keeps its state bounded', () => {
  expect(decidePresence({ now: T * 9, stopped: true, turns: [turn('held-check')], state: {} })).toEqual({ state: {}, actions: [] });
  const many = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`t${index}`,
    { firstSeenAt: 0, cause: 'unpicked' as const, healAt: 0, noteDueAt: null, closedAt: index }]));
  expect(Object.keys(decidePresence({ now: T, stopped: false, turns: [], state: many }).state)).toHaveLength(defaultPresenceConfig.keepClosed);
});
