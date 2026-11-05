/**
 * Correction loop: route and verify (carryover row 32; 1.x `src/monitoring/CorrectionLoopDriver.ts` at
 * 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9, spec §3.6/§3.7/§3.8).
 *
 *   capture (journal) → ledger records → gate (analyzer) → ROUTE (this) → VERIFY (this).
 *
 * The 1.x headline safety property, "the loop can never change the agent's policy or mint a proposal on its
 * own", was enforced by construction: the driver's injected capabilities were exactly addAction,
 * createInitiative, feedbackLoopbackPost, recordPreference and attentionRoute, and a regex downgraded a
 * policy-relaxation learning from recordPreference to the attention queue.
 *
 * In 2.0 the property is stronger and needs no injected capability list, because the loop has ONE route and it
 * applies nothing (Part 21 §11; Rules 4, 10, 24, 57, 86, 116):
 *  - Application is the owners' and is immediate. A `prefer` memory change is a standing style the preference
 *    owner carries on every packet from the message that stated it; a memory failure teaches recall from its
 *    first occurrence (Part 21 §16). "Current explicit instructions are honored through their owners without
 *    waiting to recur", so nothing here waits for four restatements before a preference counts.
 *  - ROUTE presents a gate-crossing cluster, at most `maxRoutesPerTick` per pass with the overflow carried
 *    open, to the judgment owner: the retrospective review's recurrence duty, as `correctionCandidates` in its
 *    packet. Whether the recurrence deserves root-cause work is the mind's call (Rule 25); the candidate grants
 *    nothing and no wording decides its destination, so the 1.x regex policy filter has nothing to downgrade.
 *    The presentation is durable on the pass's own reservation row, which is the route's acted-on event.
 *  - VERIFY is a projection over the same journal (no tick, no OCC, no cluster transaction: there is one writer
 *    and it already wrote). A presented cluster watches a fresh window of the kind's length (7 days for a
 *    preference, 14 for an infra-gap). Any member key recurring inside the window reopens the whole cluster
 *    with a fresh window, at most `maxReopens` times, then `inconclusive`. Silence is never success: with no
 *    recurrence the cluster is `verified` only when the recorded packet grounding shows the guidance was
 *    actually carried to the model in the window (1.x accepted disk presence; Part 21 §11 retires that). Answers
 *    given in the window that never carried it are `inconclusive`; no answer in the window is `unknown`.
 */
import { createHash } from 'node:crypto';
import { redact } from '../../src/recall/redact.js';
import type { JournalView, Turn } from './journal.js';
import { correctionOccurrences, correctionRecords, type CorrectionKind, type CorrectionOccurrence,
  type CorrectionRecord } from './correction-ledger.js';
import { analyzeCorrections, DEFAULT_CORRECTION_GATES, type CorrectionGates, type GateVerdict } from './correction-analyzer.js';
import { captureWindow } from './correction-capture.js';

export type CorrectionStatus =
  | 'open'         // recorded, not yet presented past the recurrence gate
  | 'acted-on'     // presented to the judgment owner; verify window open
  | 'verified'     // no routed cluster member recurred AND the guidance was carried in the window
  | 'inconclusive' // recurred past maxReopens, or silence with answers that never carried the guidance
  | 'reopened'     // a routed cluster member recurred; re-watching (bounded by maxReopens)
  | 'unknown';     // the window closed with no answer in it: no relevant opportunity, nothing to conclude

/** Verify-window (preference path), default 7 days. */
export const DEFAULT_VERIFY_WINDOW_DAYS_PREFERENCE = 7;
/** Verify-window (infra-gap path), default 14 days. */
export const DEFAULT_VERIFY_WINDOW_DAYS_INFRA_GAP = 14;
/** Max reopens before terminal `inconclusive` (default 2). */
export const DEFAULT_MAX_REOPENS = 2;
/** Max clusters presented per pass (spec §10 Slice-2 NEW-5). Overflow stays `open` and is re-evaluated next pass. */
export const DEFAULT_MAX_ROUTES_PER_TICK = 5;
/** Bound on the lesson text a candidate carries to the judgment owner. */
export const CANDIDATE_LEARNING_CHARS = 300;
/** Bound on the occurrence refs a candidate lists (the first and the latest). */
export const CANDIDATE_OCCURRENCE_REFS = 8;
/** The look-back the judgment owner is shown for the latest occurrence: the restatement and the reply before it. */
export const CANDIDATE_CONTEXT_TURNS = 2;
export const CANDIDATE_CONTEXT_CHARS = 200;

export interface CorrectionLoopOptions {
  gates?: CorrectionGates;
  verifyWindowDaysPreference?: number;
  verifyWindowDaysInfraGap?: number;
  maxReopens?: number;
  maxRoutesPerTick?: number;
}

/** A cluster the retrospective was handed, as its reservation row records it (the durable route event). */
export interface PresentedCorrection { id: string; kind: CorrectionKind; keys: string[] }

export interface CorrectionLifecycleRecord extends CorrectionRecord {
  status: CorrectionStatus;
  routedVia?: 'retrospective';
  verifyWindowStart?: string;
  verifyWindowEnd?: string;
  /** Durable identity shared by every record presented as one analyzer cluster. */
  routeClusterId?: string;
  reopenCount: number;
  /** The separately stated reason for the status (Rule 108). */
  basis: string;
}

/** Stable lifecycle identity for one routed analyzer-time cluster. */
export function correctionRouteClusterId(kind: CorrectionKind, clusterDedupeKeys: readonly string[]): string {
  const identity = `${kind}\0${[...clusterDedupeKeys].sort().join('\0')}`;
  return `corr-cluster:${createHash('sha256').update(identity).digest('hex')}`;
}

/** Every cluster a recorded retrospective reservation presented, oldest first, with the pass and its time. */
export function presentedCorrections(view: JournalView): (PresentedCorrection & { pass: number; at: number })[] {
  return view.retroPasses.flatMap(pass => (pass.corrections ?? []).map(item => ({ ...item, pass: pass.pass, at: pass.at })));
}

const windowDaysFor = (kind: CorrectionKind, options: CorrectionLoopOptions) => kind === 'user-preference'
  ? options.verifyWindowDaysPreference ?? DEFAULT_VERIFY_WINDOW_DAYS_PREFERENCE
  : options.verifyWindowDaysInfraGap ?? DEFAULT_VERIFY_WINDOW_DAYS_INFRA_GAP;

/** Did any durable member key log an occurrence inside [start, end)? End-bounded: a complete observation population. */
const recurredWithin = (occurrences: readonly CorrectionOccurrence[], keys: ReadonlySet<string>, start: number, end: number) =>
  occurrences.some(row => keys.has(row.dedupeKey) && row.detectedAt >= start && row.detectedAt < end);

/** What the recorded packet groundings say about guidance delivery inside the window: carried, never carried
 * although answers were given, or no answer at all. Older rows without the preference list read as not carried. */
function deliveryWithin(view: JournalView, operator: (item: Turn) => boolean, kind: CorrectionKind,
  members: readonly CorrectionOccurrence[], start: number, end: number): 'delivered' | 'not-delivered' | 'no-answer' {
  const answered = view.order.filter(turn => turn.accepted && operator(turn) && turn.at >= start && turn.at < end
    && turn.modelState === 'complete' && turn.grounding !== undefined);
  if (!answered.length) return 'no-answer';
  const wanted = new Set(kind === 'user-preference' ? members.map(row => row.trigger)
    : members.flatMap(row => row.target === undefined ? [] : [row.target]));
  const carried = answered.some(turn => {
    const grounding = turn.grounding!;
    const shown = kind === 'user-preference' ? grounding.preferences ?? []
      : [...grounding.history, ...grounding.recalled, ...grounding.memoryCandidates];
    return shown.some(id => wanted.has(id));
  });
  return carried ? 'delivered' : 'not-delivered';
}

/**
 * Every record with its lifecycle, derived from the occurrences and the recorded presentations. A record that
 * was never presented is `open`. A presented cluster is evaluated window by window up to `now`; the status is
 * the state of the latest window.
 */
export function correctionLifecycle(view: JournalView, operator: (item: Turn) => boolean, now: number,
  options: CorrectionLoopOptions = {}): CorrectionLifecycleRecord[] {
  const occurrences = correctionOccurrences(view, operator);
  const records = correctionRecords(view, operator);
  const presented = presentedCorrections(view);
  const maxReopens = options.maxReopens ?? DEFAULT_MAX_REOPENS;
  return records.map(record => {
    // The latest presentation of this key: a lesson that recurred after a settled window is re-presented as a new cycle.
    const cluster = [...presented].reverse().find(item => item.keys.includes(record.dedupeKey));
    if (!cluster) return { ...record, status: 'open' as const, reopenCount: 0, basis: 'not yet past the recurrence gate' };
    const keys = new Set(cluster.keys), members = occurrences.filter(row => keys.has(row.dedupeKey));
    const days = windowDaysFor(cluster.kind, options);
    let start = cluster.at, reopenCount = 0;
    let status: CorrectionStatus = 'acted-on', basis = `presented to the retrospective on pass ${String(cluster.pass)}; watching ${String(days)}d`;
    for (;;) {
      const end = start + days * 86400_000;
      if (now < end) { if (reopenCount) { status = 'reopened'; basis = `recurred — reopened (${String(reopenCount)}/${String(maxReopens)}), watching ${String(days)}d more`; } break; }
      if (recurredWithin(occurrences, keys, start, end)) {
        if (reopenCount >= maxReopens) { status = 'inconclusive'; basis = `recurred after ${String(reopenCount)} reopens — terminal inconclusive`; break; }
        reopenCount++; start = end; continue;
      }
      const delivery = deliveryWithin(view, operator, cluster.kind, members, start, end);
      status = delivery === 'delivered' ? 'verified' : delivery === 'no-answer' ? 'unknown' : 'inconclusive';
      basis = delivery === 'delivered' ? 'no recurrence + guidance carried in a recorded packet — verified'
        : delivery === 'no-answer' ? 'no recurrence but no answer in the window — no relevant opportunity'
          : 'no recurrence but no recorded packet carried the guidance — inconclusive (silence ≠ effective)';
      break;
    }
    const end = start + days * 86400_000;
    // A settled cluster is not the end of the lesson: a member recurring after its last window is a fresh open
    // record for the gate (Rule 24: the recurrence is the bug), never an occurrence nobody reads (Rule 2).
    if ((status === 'verified' || status === 'inconclusive' || status === 'unknown') && members.some(row => row.detectedAt >= end))
      return { ...record, status: 'open' as const, reopenCount: 0, routeClusterId: cluster.id, basis: `recurred after ${status}; open for re-presentation` };
    return { ...record, status, routedVia: 'retrospective' as const, verifyWindowStart: new Date(start).toISOString(),
      verifyWindowEnd: new Date(end).toISOString(), routeClusterId: cluster.id, reopenCount, basis };
  });
}

/** One row of the judgment owner's packet: a gate-crossing cluster with its recorded support. Data, never an instruction. */
export interface CorrectionCandidate {
  id: string;
  kind: CorrectionKind;
  keys: string[];
  /** The representative lesson, credential-redacted and bounded. */
  learning: string;
  support: number;
  days: number;
  sessions: number;
  /** `turn:` refs of the first and latest occurrences (bounded), which the review may cite. */
  occurrences: string[];
  /** The latest restatement with the reply just before it, bounded. */
  context: { fromUser: boolean; text: string }[];
}

/**
 * ROUTE: the crossed clusters not yet presented, bounded per pass. Overflow stays open and is counted. The
 * refs are the occurrence turns, so a finding that cites them cites records the journal holds.
 */
export function correctionCandidates(view: JournalView, operator: (item: Turn) => boolean, now: number,
  options: CorrectionLoopOptions = {}): { candidates: CorrectionCandidate[]; overflow: number; refs: string[] } {
  const occurrences = correctionOccurrences(view, operator);
  const open = correctionLifecycle(view, operator, now, options).filter(record => record.status === 'open');
  const { crossed } = analyzeCorrections(open, occurrences, options.gates ?? DEFAULT_CORRECTION_GATES, now);
  const limit = options.maxRoutesPerTick && options.maxRoutesPerTick > 0 ? options.maxRoutesPerTick : DEFAULT_MAX_ROUTES_PER_TICK;
  const ordered = [...crossed].sort((a, b) => a.record.createdAt.localeCompare(b.record.createdAt) || a.record.id.localeCompare(b.record.id));
  const candidates = ordered.slice(0, limit).map(verdict => candidateOf(view, operator, occurrences, verdict));
  return { candidates, overflow: Math.max(0, ordered.length - limit), refs: candidates.flatMap(item => [item.id, ...item.occurrences]) };
}

function candidateOf(view: JournalView, operator: (item: Turn) => boolean, occurrences: readonly CorrectionOccurrence[],
  verdict: GateVerdict): CorrectionCandidate {
  const keys = new Set(verdict.clusterDedupeKeys);
  const rows = occurrences.filter(row => keys.has(row.dedupeKey));
  const half = Math.floor(CANDIDATE_OCCURRENCE_REFS / 2);
  const cited = rows.length <= CANDIDATE_OCCURRENCE_REFS ? rows : [...rows.slice(0, half), ...rows.slice(-half)];
  const latest = rows[rows.length - 1];
  const context = latest === undefined ? [] : captureWindow(view, operator, latest.trigger, CANDIDATE_CONTEXT_TURNS)
    .map(turn => ({ fromUser: turn.fromUser, text: turn.text.slice(0, CANDIDATE_CONTEXT_CHARS) }));
  return { id: `correction:${correctionRouteClusterId(verdict.record.kind, verdict.clusterDedupeKeys).slice('corr-cluster:'.length, 'corr-cluster:'.length + 16)}`,
    kind: verdict.record.kind, keys: [...verdict.clusterDedupeKeys].sort(),
    learning: redact(verdict.record.learning).text.slice(0, CANDIDATE_LEARNING_CHARS),
    support: verdict.qualifyingOccurrences, days: verdict.distinctDays, sessions: verdict.distinctSessions,
    occurrences: [...new Set(cited.map(row => `turn:${row.trigger}`))], context };
}

/** The runner's read-only status block: records by kind and status, candidates waiting, overflow (Rule 39). */
export function correctionReport(view: JournalView, operator: (item: Turn) => boolean, now: number, options: CorrectionLoopOptions = {}) {
  const lifecycle = correctionLifecycle(view, operator, now, options);
  const count = <K extends string>(key: (record: CorrectionLifecycleRecord) => K) => lifecycle.reduce((total, record) =>
    ({ ...total, [key(record)]: (total[key(record)] ?? 0) + 1 }), {} as Partial<Record<K, number>>);
  const routed = correctionCandidates(view, operator, now, options);
  return { records: lifecycle.length, occurrences: lifecycle.reduce((total, record) => total + record.occurrenceCount, 0),
    byKind: count(record => record.kind), byStatus: count(record => record.status),
    candidates: routed.candidates.length, overflow: routed.overflow };
}

/** One short clause for the operator's pull status line. */
export function correctionStatusClause(view: JournalView, operator: (item: Turn) => boolean, now: number): string {
  const report = correctionReport(view, operator, now);
  if (!report.records) return 'corrections: none recorded';
  const watching = (report.byStatus['acted-on'] ?? 0) + (report.byStatus.reopened ?? 0);
  return `corrections: ${String(report.records)} lesson${report.records === 1 ? '' : 's'} (${String(report.occurrences)} occurrence${report.occurrences === 1 ? '' : 's'})`
    + `, ${String(report.candidates)} recurring for review, ${String(watching)} watched, ${String(report.byStatus.verified ?? 0)} verified`;
}
