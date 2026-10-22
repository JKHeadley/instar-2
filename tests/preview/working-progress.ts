/** Rule 87: deadlines are relative to durable intake, never a fresh allowance on restart. */
export const WORKING_RATE_LIMIT = 'The model service is limiting requests. Your message is saved; Instar is waiting briefly before continuing.';
export const WORKING_CONNECTION = 'The model request is being retried. Your message is saved; Instar is waiting for those attempts to finish.';
export const WORKING_LIVENESS = 'Still here; your answer is not ready yet.';
export const WORKING_PROGRESS_CAP = 4;
export const WORKING_SILENCE_MS = 120_000;
export const WORKING_PROGRESS_FRESH_MS = 10_000;
export const workingProgressDue = (acceptedAt: number, ordinal: number): number =>
  acceptedAt + (ordinal === 0 ? 120_000 : ordinal === 1 ? 300_000 : 600_000 * (ordinal - 1));
export interface WorkingActivity {
  /** Exact admitted tool occurrence or durable recovery episode; announced at most once. */
  step: string;
  /** Exact adapter recovery observation; no provider text or account identity. */
  wait?: 'rate-limit' | 'connection';
  text: string;
  observedAt: number;
}
export interface WorkingProgress extends WorkingActivity { ordinal: number; at: number; sent?: number; speaker?: 'agent' | 'infrastructure' }
export function currentWorkingActivity(activity: WorkingActivity | null | undefined, now: number): activity is WorkingActivity {
  return !!activity && (activity.wait === undefined || activity.wait === 'rate-limit' || activity.wait === 'connection') && typeof activity.step === 'string' && activity.step.length > 0 && activity.step.length <= 256
    && typeof activity.text === 'string' && activity.text.trim().length > 0 && activity.text.length <= 280
    && !/[\r\n]/u.test(activity.text) && Number.isSafeInteger(activity.observedAt)
    && activity.observedAt <= now && now - activity.observedAt <= WORKING_PROGRESS_FRESH_MS;
}

export const workingProgressText = (activity: WorkingActivity): string =>
  activity.wait === 'rate-limit' ? WORKING_RATE_LIMIT : activity.wait === 'connection' ? WORKING_CONNECTION : WORKING_LIVENESS;
