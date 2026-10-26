/** The live runner's sentinel record (Part 18; Rules 2, 9, 41, 42): one durable journal row per sentinel tick that
 * changed something. It carries the family's whole new decision state and the events that tick produced, so a
 * replay rebuilds exactly what each sentinel decided and why, and the status surfaces read it from the journal.
 * Nothing here decides anything; the pure decisions live in src/awareness/sentinel.ts and src/sentinels/. */
import type { SessionActivityObservation } from '../../src/assembly/production-session-driver.js';
import type { SentinelState } from '../../src/awareness/sentinel.js';
import type { PresenceState } from '../../src/sentinels/presence.js';
import type { PromiseState } from '../../src/sentinels/promise.js';

export type SentinelFamily = 'context' | 'presence' | 'promise';
export const SENTINEL_FAMILIES: readonly SentinelFamily[] = Object.freeze(['context', 'presence', 'promise']);
export interface SentinelEventRow { event: string; subject: string; detail: string; operation?: string }
export interface WorkSilenceState {
  progress: string | null; lastProgressAt: number; observedAt: number;
  activity?: SessionActivityObservation['activity'];
  state: 'observing' | 'stalled' | 'waiting' | 'unknown' | 'action-needed'; detail: string;
}
export type WorkSilenceView = Record<string, WorkSilenceState>;
export type SentinelRecord = { kind: 'sentinel'; family: SentinelFamily; events: SentinelEventRow[];
  context?: SentinelState; presence?: PresenceState; promise?: PromiseState; work?: WorkSilenceView; at: number };
export interface SentinelView {
  work?: WorkSilenceView;
  context: SentinelState | null; presence: PresenceState; promise: PromiseState;
  /** The most recent events across the three families, oldest first (bounded). */
  events: (SentinelEventRow & { family: SentinelFamily; at: number })[];
  /** Ticks that recorded a change, per family; and when each family last recorded one. */
  counts: Record<SentinelFamily, number>; last: Partial<Record<SentinelFamily, number>>;
}
export const SENTINEL_EVENTS_KEPT = 40;
const MAX_EVENTS_PER_ROW = 32, MAX_FIELD_BYTES = 512, MAX_ROW_BYTES = 65_536;

const short = (value: unknown, optional = false) => optional && value === undefined
  || typeof value === 'string' && Buffer.byteLength(value) <= MAX_FIELD_BYTES;
const time = (value: unknown) => value === null || Number.isSafeInteger(value) && (value as number) >= 0;
const record = (value: unknown): value is Record<string, Record<string, unknown>> => typeof value === 'object' && value !== null
  && !Array.isArray(value) && Object.values(value).every(entry => typeof entry === 'object' && entry !== null && !Array.isArray(entry));

/** Throws when a row could not have been written by the live runner's sentinel tick. */
export function checkSentinelRecord(row: SentinelRecord, turnExists: (id: string) => boolean): void {
  const bad = () => { throw Error('preview journal: sentinel record refused'); };
  if (!SENTINEL_FAMILIES.includes(row.family) || !Number.isSafeInteger(row.at) || row.at < 0 || !Array.isArray(row.events)
    || row.events.length > MAX_EVENTS_PER_ROW || Buffer.byteLength(JSON.stringify(row)) > MAX_ROW_BYTES) bad();
  for (const event of row.events)
    if (!event || !short(event.event) || !short(event.subject) || !short(event.detail) || !short(event.operation, true)) bad();
  const own = { context: row.context, presence: row.presence, promise: row.promise };
  for (const family of SENTINEL_FAMILIES) if ((own[family] !== undefined) !== (family === row.family)) bad();
  if (row.work !== undefined) {
    if (row.family !== 'presence' || !record(row.work)) bad();
    for (const [id, entry] of Object.entries(row.work!))
      if (!short(id) || !(entry.progress === null || short(entry.progress)) || !short(entry.detail)
        || ![entry.lastProgressAt, entry.observedAt].every(value => value !== null && time(value))
        || entry.activity !== undefined && !['active', 'idle', 'indeterminate', 'unknown'].includes(entry.activity)
        || entry.lastProgressAt > entry.observedAt || entry.observedAt > row.at
        || !['observing', 'stalled', 'waiting', 'unknown', 'action-needed'].includes(entry.state)) bad();
  }
  if (row.family === 'context') {
    const state = row.context as { sessions?: unknown } | undefined;
    if (!state || !Array.isArray(state.sessions) || state.sessions.length > 64) bad();
  }
  if (row.family === 'presence') {
    if (!record(row.presence)) bad();
    for (const [id, entry] of Object.entries(row.presence!)) {
      // Part 18 §6: a holding note is due only after a recorded self-heal request, never from a timer alone.
      if (!turnExists(id) || ![entry.firstSeenAt, entry.healAt, entry.noteDueAt, entry.closedAt].every(time)
        || entry.noteDueAt !== null && (entry.healAt === null || entry.noteDueAt < entry.healAt)) bad();
    }
  }
  if (row.family === 'promise') {
    if (!record(row.promise)) bad();
    for (const [id, entry] of Object.entries(row.promise!))
      if (!short(id) || ![entry.dueSeenAt, entry.workRequestedAt, entry.reportedAt, entry.closedAt].every(time)
        || !['open', 'acted', 'reported', 'waiting', 'closed'].includes(entry.outcome as string)) bad();
  }
}

export function applySentinelRecord(current: SentinelView | undefined, row: SentinelRecord): SentinelView {
  const view: SentinelView = current ?? { context: null, presence: {}, promise: {}, events: [],
    counts: { context: 0, presence: 0, promise: 0 }, last: {} };
  if (row.work) view.work = row.work;
  if (row.context) view.context = row.context;
  if (row.presence) view.presence = row.presence;
  if (row.promise) view.promise = row.promise;
  view.events = [...view.events, ...row.events.map(event => ({ ...event, family: row.family, at: row.at }))].slice(-SENTINEL_EVENTS_KEPT);
  view.counts = { ...view.counts, [row.family]: view.counts[row.family] + 1 };
  view.last = { ...view.last, [row.family]: row.at };
  return view;
}

/** True while the presence sentinel has marked this message's holding note due and it is still unanswered. */
export const presenceNoteDue = (view: SentinelView | undefined, turn: string): boolean => {
  const entry = view?.presence[turn];
  return entry !== undefined && entry.noteDueAt !== null && entry.closedAt === null;
};

/** Rules 7/9/13: decisions and events stay whole. Repeated observations keep the last
 * 100 per family; the snapshot retains the exact family counts, latest times and state.
 * Work's observedAt is proof of looking, not a decision. Unknown/waiting observations
 * reset lastProgressAt on every tick without asserting progress: summarize those resets
 * too. Active/stalled progress clocks and all state/detail/activity changes stay whole. */
export const SENTINEL_OBSERVATIONS_KEPT = 100;
export function retainedSentinelEvidence(rows: readonly SentinelRecord[]): Set<SentinelRecord> {
  const kept = new Set<SentinelRecord>();
  const last = new Map<SentinelFamily, string>();
  const repeated = new Map<SentinelFamily, SentinelRecord[]>();
  for (const row of rows) {
    const state = JSON.stringify({ state: row[row.family], ...(row.work === undefined ? {} : {
      work: Object.fromEntries(Object.entries(row.work).map(([id, { observedAt: _observedAt, lastProgressAt, ...decision }]) =>
        [id, { ...decision, ...(['unknown', 'waiting'].includes(decision.state) ? {} : { lastProgressAt }) }])),
    }) });
    if (row.events.length || state !== last.get(row.family)) kept.add(row);
    else {
      const recent = repeated.get(row.family) ?? [];
      recent.push(row);
      if (recent.length > SENTINEL_OBSERVATIONS_KEPT) recent.shift();
      repeated.set(row.family, recent);
    }
    last.set(row.family, state);
  }
  for (const recent of repeated.values()) for (const row of recent) kept.add(row);
  return kept;
}
