import { expect, it } from 'vitest';
import { shouldRunScheduledPriority } from '../../src/scheduled/index.js';

it('ports the priority brake and holds low and medium at unknown usage', () => {
  const priorities = ['low', 'maintenance', 'medium', 'high', 'critical'] as const;
  for (const [level, allowed] of [
    ['normal', ['medium', 'high', 'critical']],
    ['elevated', ['high', 'critical']],
    ['critical', ['critical']],
    ['shutdown', []],
    ['unknown', ['high', 'critical']],
  ] as const) for (const priority of priorities)
    expect(shouldRunScheduledPriority(priority, level)).toBe(allowed.includes(priority as never));
});


it('shares a bounded crash window across failure classes without erasing pressure on success', async () => {
  const { recordScheduledCrash } = await import('../../src/scheduled/shedding.js');
  const policy = { threshold: 3, windowMs: 100 };
  let state = recordScheduledCrash(null, { at: 0, kind: 'failure' }, policy);
  state = recordScheduledCrash(state, { at: 1, kind: 'success' }, policy);
  state = recordScheduledCrash(state, { at: 2, kind: 'spawn-refused' }, policy);
  state = recordScheduledCrash(state, { at: 100, kind: 'hung' }, policy);
  expect(state.pausedAt).toBe(100);
  expect(state.failures.map(row => row.kind)).toEqual(['failure', 'spawn-refused', 'hung']);
  expect(recordScheduledCrash(state, { at: 1000, kind: 'success' }, policy)).toEqual(state);
});

it('excludes shedding, cancellation, no-work and uncertainty; expires only failures outside the window', async () => {
  const { recordScheduledCrash } = await import('../../src/scheduled/shedding.js');
  const policy = { threshold: 2, windowMs: 100 };
  let state = recordScheduledCrash(null, { at: 0, kind: 'failure' }, policy);
  for (const kind of ['capacity-applied', 'cancelled', 'no-work', 'uncertain', 'success'] as const)
    state = recordScheduledCrash(state, { at: 1, kind }, policy);
  expect(state.failures).toHaveLength(1);
  state = recordScheduledCrash(state, { at: 101, kind: 'rapid-exit' }, policy);
  expect(state.pausedAt).toBeNull();
  expect(state.failures).toEqual([{ at: 101, kind: 'rapid-exit' }]);
  expect(() => recordScheduledCrash(state, { at: 100, kind: 'failure' }, policy)).toThrow();
  expect(() => recordScheduledCrash(state, { at: 102, kind: 'failure' }, { ...policy, threshold: 0 })).toThrow();
});
