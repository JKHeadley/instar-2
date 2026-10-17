import { expect, it } from 'vitest';
import { decideProactiveCompaction, defaultSentinelConfig } from '../../src/awareness/sentinel.js';
const observation = { now: 1_800_000, stopped: false, idle: true, pressure: true, lastAttemptAt: null };
it('compacts at idle pressure without an opt-in flag', () => {
  expect(decideProactiveCompaction(observation)).toBe('compact');
});
it.each([
  [{ stopped: true }, 'stopped'], [{ idle: false }, 'busy'], [{ pressure: false }, 'below-threshold'],
  [{ lastAttemptAt: observation.now }, 'cooldown'], [{ lastAttemptAt: observation.now + 1 }, 'cooldown'],
  [{ lastAttemptAt: observation.now - defaultSentinelConfig.recoveryCooldownMs + 1 }, 'cooldown'],
  [{ lastAttemptAt: observation.now - defaultSentinelConfig.recoveryCooldownMs }, 'compact'],
] as const)('holds the exact negative neighbour %j', (patch, result) => {
  expect(decideProactiveCompaction({ ...observation, ...patch })).toBe(result);
});
