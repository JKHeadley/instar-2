/** Allowance observation only (Rules 13, 52, 75, 86). Reservations, including UNKNOWN liability,
 * are the allowance's units. Five minutes of second buckets bounds memory independently of traffic. */
export interface BurnState {
  historyFrom?: number; buckets: [number, number][]; episode: number; active: boolean;
  /** First observed reservation; absent in old compact snapshots until another reservation. */
  observedFrom?: number;
  notice?: { episode: number; text: string; sent?: number };
  /** Prior consumed intents and receipts survive replacement of the current episode notice. */
  priorNotices?: { episode: number; sent?: number }[];
}
export interface BurnView { calls: number; limits: { maxCalls: number }; clockFloor: number; burn?: BurnState }
export const BURN_WINDOW_MS = 300_000, BURN_HORIZON_MINUTES = 30;
export function recordBurnCalls(view: BurnView, at: number, calls: number): void {
  if (calls <= 0) return;
  const burn = view.burn ??= { buckets: [], episode: 0, active: false, historyFrom: view.calls > calls ? at : 0 };
  burn.observedFrom ??= at;
  const second = Math.floor(at / 1000);
  // An old completed burst cannot warm a new one after an idle window.
  const previous = burn.buckets.at(-1)?.[0];
  if (previous !== undefined && second - previous > BURN_WINDOW_MS / 1000) burn.observedFrom = at;
  burn.buckets = burn.buckets.filter(([s]) => s > second - 300);
  const last = burn.buckets.at(-1);
  if (last?.[0] === second) last[1] += calls; else burn.buckets.push([second, calls]);
}
export function burnObservation(view: BurnView, now: number) {
  const second = Math.floor(Math.max(now, view.clockFloor) / 1000);
  const count = (view.burn?.buckets ?? []).reduce((n, [s, calls]) => n + (s > second - 300 && s <= second ? calls : 0), 0);
  const perMinute = count / 5, capRemaining = Math.max(0, view.limits.maxCalls - view.calls);
  const shedRemaining = Math.max(0, Math.ceil(view.limits.maxCalls * 0.75) - view.calls);
  const minutesToCap = capRemaining === 0 ? 0 : perMinute ? capRemaining / perMinute : null;
  const minutesToShed = shedRemaining === 0 ? 0 : perMinute ? shedRemaining / perMinute : null;
  const next = minutesToCap;
  return { available: view.burn !== undefined || view.calls === 0, callsPerHour: perMinute * 60, windowMinutes: 5, horizonMinutes: BURN_HORIZON_MINUTES,
    partialHistory: (view.burn?.historyFrom ?? 0) > 0 && now < view.burn!.historyFrom! + BURN_WINDOW_MS,
    minutesToCap, minutesToShed, active: count > 0 && capRemaining > 0 && next !== null && next <= BURN_HORIZON_MINUTES,
    episode: view.burn?.episode ?? 0, recordedActive: view.burn?.active ?? false };
}
/** A startup burst is a projection, not yet evidence for an interrupting rate warning.
 * Keep historical frame validation/status unchanged; this guards only new dispatches. */
export function burnNoticeReady(view: BurnView, now: number): boolean {
  return view.burn?.observedFrom !== undefined && now >= view.burn.observedFrom + BURN_WINDOW_MS
    && !burnObservation(view, now).partialHistory && burnObservation(view, now).active;
}
export function burnStatus(view: BurnView, now: number): string {
  if (!view.burn && view.calls > 0) return 'Call rate: recent reservation history is unavailable; observation is warming up. No exhaustion forecast yet.';
  const b = burnObservation(view, now), minutes = (n: number | null) => n === null ? 'no current rate' : `${Math.ceil(n)} min`;
  return `Call rate: ${b.callsPerHour} reserved attempts/hour (last 5 min${b.partialHistory ? '; partial history' : ''}). At this rate: cap ${minutes(b.minutesToCap)}; scheduled-work shed ${minutes(b.minutesToShed)}. ${b.active ? 'Allowance may run short within 30 min.' : 'No rate warning.'}`;
}
