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
