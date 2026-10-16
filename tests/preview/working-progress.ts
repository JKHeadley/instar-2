/** Rule 87: deadlines are relative to durable intake, never a fresh allowance on restart. */
export const WORKING_LIVENESS = 'Still here; your answer is not ready yet.';
export const WORKING_PROGRESS_CAP = 4;
export const WORKING_SILENCE_MS = 120_000;
export const WORKING_PROGRESS_FRESH_MS = 10_000;
export const workingProgressDue = (acceptedAt: number, ordinal: number): number =>
  acceptedAt + (ordinal === 0 ? 120_000 : ordinal === 1 ? 300_000 : 600_000 * (ordinal - 1));
export interface WorkingActivity {
  /** Exact admitted tool occurrence; a single step is never announced twice. */
  step: string;
  text: string;
  observedAt: number;
}
export interface WorkingProgress extends WorkingActivity { ordinal: number; at: number; sent?: number }
export function currentWorkingActivity(activity: WorkingActivity | null | undefined, now: number): activity is WorkingActivity {
  return !!activity && typeof activity.step === 'string' && activity.step.length > 0 && activity.step.length <= 256
    && typeof activity.text === 'string' && activity.text.trim().length > 0 && activity.text.length <= 280
    && !/[\r\n]/u.test(activity.text) && Number.isSafeInteger(activity.observedAt)
    && activity.observedAt <= now && now - activity.observedAt <= WORKING_PROGRESS_FRESH_MS;
}
