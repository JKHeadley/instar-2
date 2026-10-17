import type { ScheduledPriority } from './contracts.js';

export type ScheduledUsageLevel = 'normal' | 'elevated' | 'critical' | 'shutdown' | 'unknown';

/** Pure 1.x priority brake. Unknown usage preserves room for urgent work only. */
export function shouldRunScheduledPriority(priority: ScheduledPriority, usage: ScheduledUsageLevel): boolean {
  if (usage === 'shutdown') return false;
  if (usage === 'critical') return priority === 'critical';
  if (usage === 'elevated' || usage === 'unknown') return priority === 'high' || priority === 'critical';
  return priority === 'medium' || priority === 'high' || priority === 'critical';
}

export type ScheduledCrashKind = 'failure' | 'spawn-refused' | 'hung' | 'rapid-exit'
  | 'success' | 'no-work' | 'cancelled' | 'capacity-applied' | 'uncertain';
export interface ScheduledCrashPolicy { threshold: number; windowMs: number }
export interface ScheduledCrashObservation { at: number; kind: ScheduledCrashKind }
export interface ScheduledCrashState {
  policy: ScheduledCrashPolicy;
  lastAt: number;
  failures: readonly ScheduledCrashObservation[];
  pausedAt: number | null;
}

/** Rules 55/61: one bounded population, including mixed failure classes. The owner persists the result
 * before another launch. A pause never expires or heals itself; only the owner's manual resume clears it.
 * No-work, expected shedding, cancellation and unresolved effects are not evidence of a crash. */
export function recordScheduledCrash(state: ScheduledCrashState | null, observation: ScheduledCrashObservation,
  policy: ScheduledCrashPolicy): ScheduledCrashState {
  if (!Number.isSafeInteger(policy.threshold) || policy.threshold < 1 || policy.threshold > 100
    || !Number.isSafeInteger(policy.windowMs) || policy.windowMs < 1 || policy.windowMs > 86400000
    || !Number.isSafeInteger(observation.at) || observation.at < 0)
    throw Error('invalid crash window');
  if (state && (state.policy.threshold !== policy.threshold || state.policy.windowMs !== policy.windowMs
    || !Number.isSafeInteger(state.lastAt) || observation.at < state.lastAt
    || !Array.isArray(state.failures) || state.failures.length > policy.threshold
    || state.failures.some(row => !Number.isSafeInteger(row.at) || row.at < 0 || row.at > state.lastAt
      || !['failure', 'spawn-refused', 'hung', 'rapid-exit'].includes(row.kind))
    || (state.pausedAt !== null && (!Number.isSafeInteger(state.pausedAt) || state.pausedAt > state.lastAt))))
    throw Error('invalid or changed crash state');
  if (state?.pausedAt !== null && state?.pausedAt !== undefined) return state;
  const failures = (state?.failures ?? []).filter(row => observation.at - row.at <= policy.windowMs);
  if (['failure', 'spawn-refused', 'hung', 'rapid-exit'].includes(observation.kind)) failures.push(observation);
  return { policy: { ...policy }, lastAt: observation.at, failures,
    pausedAt: failures.length >= policy.threshold ? observation.at : null };
}
