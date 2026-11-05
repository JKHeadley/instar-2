/**
 * Correction ledger: the distilled, scrubbed correction/preference records (carryover row 32; 1.x
 * `src/monitoring/CorrectionLedger.ts` at 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9, spec §3.4).
 *
 * What is carried from 1.x unchanged: the record identity (`kind:normalizedLearningHash`, so a recurring lesson
 * collapses to ONE record whose occurrence count grows, and message volume can never manufacture support), the
 * stop-word normalization whose hash stability is a unit-tested invariant, the UTC day bucket that is CODE-derived
 * (never model-set), the deterministic-weight provenance field the recurrence gate keys on, the distinct
 * day/topic/session counts over the occurrence log, and the API view that serves no raw `learning` text.
 *
 * What changes in 2.0, and why (Rules 2, 7, 32, 113, 116; Part 21 §11 "corrections retain the lifecycle"):
 *  - There is no second store. 1.x kept its own SQLite file beside the conversation, so the ledger and the
 *    conversation could disagree and a ledger write could fail open ("a write error logs + drops"). Here every
 *    occurrence is a projection over rows the durable journal already holds: a validated `prefer` memory change,
 *    or a recorded memory failure (an operator correction of the agent's own reply, or an "I told you" reminder).
 *    Equal journal prefixes yield equal records on every machine; nothing is machine-local (Rule 113).
 *  - Capture is not optional and nothing is evicted. 1.x pruned the forensic occurrence table to 200 rows per key
 *    inside the insert transaction, so a lifetime count could exceed the retained detail. Rule 7 forbids deleting
 *    what the agent knows: every occurrence stays in the record, and a READER that wants a working set takes one
 *    bounded page (`occurrencePage`) whose omission is reported as capacity applied as designed (Rule 40).
 *  - The code-determined provenance is the verified principal, not a keyword weight. 1.x set
 *    `deterministicWeight` from a Layer-0 word classifier; here an occurrence qualifies when its trigger is an
 *    accepted message from the verified operator (Rules 10, 28), and the weight constant keeps 1.x's threshold so
 *    the recurrence policy reads the same.
 *  - `llm_confidence` is omitted. 1.x stored the distiller's confidence as advisory only (it never admitted a
 *    record on its own). 2.0 has no separate distill call: the lesson is the memory change the answer model
 *    proposed and the journal validated on the answer path, which is accepted or refused, never scored.
 *  - A session is a context reset. 1.x counted Claude Code session ids so a preference had to recur across real
 *    context resets, not just across topics. The journal's context resets are its rolling-summary frontiers, so
 *    the session of an occurrence is its recorded grounding frontier, never a later summary.
 *  - Lifecycle fields (status, route, verify window, reopen count) are not stored on the record. They are derived
 *    from the same journal in `correction-loop-driver.ts`, so there is no in-place state to lose or to replay
 *    differently (Part 21 §11: "change in-place state into append-only observations with rebuildable views").
 */
import { createHash } from 'node:crypto';
import { redact } from '../../src/recall/redact.js';
import type { JournalView, Turn } from './journal.js';
import { memoryFailures } from './memory-learning.js';

// ── Types ─────────────────────────────────────────────────────────────

/** The distilled kind. Code-derived from the recorded memory mode or failure signal; no model output can widen it. */
export type CorrectionKind = 'infra-gap' | 'user-preference' | 'noise';

/** Which durable journal signal produced an occurrence. */
export type CorrectionSignal = 'preference' | 'operator-correction' | 'operator-reminded';

/** One operator occurrence of a lesson: the forensic row 1.x kept in `correction_occurrences`. */
export interface CorrectionOccurrence {
  dedupeKey: string;
  kind: CorrectionKind;
  signal: CorrectionSignal;
  /** The verified operator turn that stated the preference, corrected the agent, or reminded it. */
  trigger: string;
  update: number;
  /** epoch ms of the trigger's intake (code-derived, never model-set). */
  detectedAt: number;
  /** UTC date bucket (YYYY-MM-DD), code-derived from detectedAt. */
  dayBucket: string;
  topicId: number | null;
  /** The context-reset epoch (rolling-summary frontier) the occurrence falls in. */
  sessionId: string | null;
  /** Layer-0 provenance: LEARNING_DETERMINISTIC_THRESHOLD for a verified operator turn, else 0. */
  deterministicWeight: number;
  /** For an infra-gap: the journal message the learning loop teaches recall to carry (the fact's source, or the
   * reminder itself when the original could not be resolved). Delivery evidence is read against it. */
  target?: string;
}

export interface CorrectionRecord {
  id: string;
  dedupeKey: string;
  kind: CorrectionKind;
  occurrenceCount: number;
  /** Latest occurrence (ISO). */
  detectedAt: string;
  /** Scrubbed distilled lesson: the operator's own exact clause, credential-redacted. INTERNAL-ONLY, never served. */
  learning: string;
  /** UTC date bucket of the latest occurrence. */
  dayBucket: string;
  /** The strongest provenance seen for this key. */
  deterministicWeight: number;
  topicId: number | null;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
  /** One per occurrence: 1.x bumped the version on every upsert. */
  version: number;
  /** Every occurrence, oldest first. Never pruned (Rule 7). */
  occurrences: CorrectionOccurrence[];
}

/** The shape a status surface may serve: `learning`, `sessionId` and the occurrence detail stripped. */
export interface CorrectionRecordApiView {
  id: string;
  dedupeKey: string;
  kind: CorrectionKind;
  occurrenceCount: number;
  detectedAt: string;
  dayBucket: string;
  deterministicWeight: number;
  topicId: number | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ListCorrectionFilter {
  kind?: CorrectionKind;
  sinceMs?: number;
  /** Upper-bound (exclusive): detectedAt < beforeMs (keyset pagination). */
  beforeMs?: number;
  limit?: number;
}

/** 1.x pruned the forensic log to this many rows per key. 2.0 keeps every row and pages READS at this bound. */
export const DEFAULT_MAX_OCCURRENCES_PER_KEY = 200;
/** The Layer-0 weight an occurrence must reach to count toward the gate (1.x HumanAsDetectorLog). In 2.0 the
 * weight is the verified principal: an accepted message from the verified operator carries exactly this. */
export const LEARNING_DETERMINISTIC_THRESHOLD = 3;
/** Bound on the stored lesson text (1.x `scrubSecrets(learning).slice(0, 2000)`). */
export const LEARNING_TEXT_CHARS = 2000;

/**
 * Stop-words stripped before hashing so semantically-identical learnings phrased
 * differently collapse to ONE dedupeKey. Conservative + deterministic — the hash
 * stability is a unit-tested invariant.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'to', 'of', 'in', 'on', 'for', 'with', 'and', 'or', 'but', 'i', 'you',
  'me', 'my', 'your', 'it', 'this', 'that', 'please', 'just', 'always',
  'when', 'do', "don't", 'dont', "i'd", 'id', 'would', 'should', 'so',
  'at', 'by', 'as', 'from', 'into', 'about', 'prefer', 'rather',
]);

// ── Identity (carried) ────────────────────────────────────────────────

/**
 * Canonical normalization of a distilled learning before hashing: lowercase,
 * strip punctuation, collapse whitespace, drop stop-words, sort the remaining
 * tokens. Two semantically-identical learnings phrased differently collapse to
 * the SAME hash. Stability is a unit-tested invariant (spec §3.4).
 */
export function normalizeLearning(learning: string): string {
  const tokens = String(learning)
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
  return tokens.sort().join(' ');
}

/** SHA-256 over the canonical normalized form. */
export function normalizedLearningHash(learning: string): string {
  return createHash('sha256').update(normalizeLearning(learning)).digest('hex');
}

/** Deterministic dedupe key: `kind:normalizedLearningHash` (spec §3.4). */
export function dedupeKey(kind: CorrectionKind, learning: string): string {
  return `${kind}:${normalizedLearningHash(learning)}`;
}

/** UTC day bucket (YYYY-MM-DD), code-derived from an ISO timestamp or epoch ms. */
export function dayBucketOf(isoOrMs: string | number): string {
  const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
  return d.toISOString().slice(0, 10);
}

// ── Occurrences from the journal (2.0) ────────────────────────────────

/** Only the grounding recorded for this occurrence can establish its context reset. Later summaries cannot. */
export function correctionSession(view: JournalView, update: number): string | null {
  const grounding = view.order.find(turn => turn.update === update)?.grounding;
  if (grounding === undefined || grounding.summaryThrough !== null && !Number.isSafeInteger(grounding.summaryThrough)) return null;
  return `frontier:${String(grounding.summaryThrough)}`;
}

/** The code-determined provenance of a trigger: a verified operator message reaches the gate threshold. */
export const correctionWeight = (turn: Turn, operator: (item: Turn) => boolean) =>
  turn.accepted && operator(turn) ? LEARNING_DETERMINISTIC_THRESHOLD : 0;

/**
 * Every operator occurrence the journal records, oldest first: each validated `prefer` memory change is one
 * occurrence of a user-preference lesson, and each recorded memory failure is one occurrence of an infra-gap
 * lesson (the fact the agent should have known). One trigger contributes at most one occurrence per key, so two
 * signals from one message cannot manufacture support (decision C32-1104-2).
 */
export function correctionOccurrences(view: JournalView, operator: (item: Turn) => boolean): CorrectionOccurrence[] {
  return occurrencesWithLearning(view, operator).map(item => item.row);
}

/** The occurrences with the exact operator clause each one stated, which only the record fold reads. */
function occurrencesWithLearning(view: JournalView, operator: (item: Turn) => boolean): { row: CorrectionOccurrence; learning: string }[] {
  const rows: { row: CorrectionOccurrence; learning: string }[] = [];
  const seen = new Set<string>();
  const push = (kind: CorrectionKind, learning: string, trigger: Turn, signal: CorrectionSignal, target?: string) => {
    const key = dedupeKey(kind, learning);
    if (seen.has(`${key}\0${trigger.id}`)) return;
    seen.add(`${key}\0${trigger.id}`);
    rows.push({ learning, row: { dedupeKey: key, kind, signal, trigger: trigger.id, update: trigger.update, detectedAt: trigger.at,
      dayBucket: dayBucketOf(trigger.at), topicId: trigger.thread ?? null, sessionId: correctionSession(view, trigger.update),
      deterministicWeight: correctionWeight(trigger, operator), ...(target === undefined ? {} : { target }) } });
  };
  for (const change of view.memory) {
    if (change.mode !== 'prefer') continue;
    const trigger = view.turns.get(change.trigger);
    if (trigger) push('user-preference', change.quote, trigger, 'preference');
  }
  for (const failure of memoryFailures(view, operator)) {
    const trigger = view.turns.get(failure.trigger);
    if (!trigger) continue;
    const target = failure.truth.source ?? (failure.cause === 'source-unresolved' ? failure.trigger : undefined);
    push('infra-gap', failure.truth.quote, trigger, failure.signal, target);
  }
  return rows.sort((a, b) => a.row.detectedAt - b.row.detectedAt || a.row.update - b.row.update);
}

/** One record per dedupe key (the 1.x dedupe-upsert, as a fold over the occurrences). The lesson text is the
 * latest occurrence's exact operator clause, credential-redacted and bounded. */
export function correctionRecords(view: JournalView, operator: (item: Turn) => boolean): CorrectionRecord[] {
  const rows = occurrencesWithLearning(view, operator);
  const learning = new Map(rows.map(item => [`${item.row.dedupeKey}\0${item.row.trigger}`, item.learning]));
  return recordsOf(rows.map(item => item.row), latest =>
    redact(learning.get(`${latest.dedupeKey}\0${latest.trigger}`) ?? '').text.slice(0, LEARNING_TEXT_CHARS));
}

/** Fold occurrences into records. Exposed so a test can fold explicit rows the way the journal fold does. */
export function recordsOf(occurrences: readonly CorrectionOccurrence[], learning: (latest: CorrectionOccurrence) => string): CorrectionRecord[] {
  const byKey = new Map<string, CorrectionOccurrence[]>();
  for (const row of occurrences) byKey.set(row.dedupeKey, [...byKey.get(row.dedupeKey) ?? [], row]);
  return [...byKey.entries()].map(([key, rows]) => {
    const first = rows[0]!, latest = rows[rows.length - 1]!;
    return { id: key, dedupeKey: key, kind: first.kind, occurrenceCount: rows.length,
      detectedAt: new Date(latest.detectedAt).toISOString(), learning: learning(latest), dayBucket: latest.dayBucket,
      deterministicWeight: Math.max(...rows.map(row => row.deterministicWeight)), topicId: latest.topicId, sessionId: latest.sessionId,
      createdAt: new Date(first.detectedAt).toISOString(), updatedAt: new Date(latest.detectedAt).toISOString(),
      version: rows.length, occurrences: rows };
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

// ── Reads (carried semantics) ─────────────────────────────────────────

export const getRecord = <R extends CorrectionRecord>(records: readonly R[], id: string): R | null => records.find(record => record.id === id) ?? null;
export const getByDedupeKey = <R extends CorrectionRecord>(records: readonly R[], key: string): R | null => records.find(record => record.dedupeKey === key) ?? null;

/** 1.x `list`: newest detection first, default 100, at most 1000. Lifecycle status filtering lives with the lifecycle. */
export function listRecords(records: readonly CorrectionRecord[], filter: ListCorrectionFilter = {}): CorrectionRecord[] {
  const limit = filter.limit && filter.limit > 0 ? Math.min(filter.limit, 1000) : 100;
  return records.filter(record => (!filter.kind || record.kind === filter.kind)
    && (!filter.sinceMs || Date.parse(record.detectedAt) >= filter.sinceMs)
    && (!filter.beforeMs || Date.parse(record.detectedAt) < filter.beforeMs))
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt) || a.id.localeCompare(b.id)).slice(0, limit);
}

/**
 * Distinct calendar days, topics and sessions for one key or an analyzer-time cluster, over the complete
 * occurrence list. `qualifying` only counts occurrences whose deterministicWeight ≥ threshold (the
 * code-determined provenance filter — nothing the model wrote can admit a record to the gate on its own).
 * Where no occurrence is retained for a key the counts are zero, biasing toward non-promotion.
 */
export function distinctCounts(occurrences: readonly CorrectionOccurrence[], dedupeKeyOrKeys: string | readonly string[],
  weightThreshold = 0): { distinctDays: number; distinctTopics: number; distinctSessions: number; qualifyingOccurrences: number } {
  const keys = new Set(typeof dedupeKeyOrKeys === 'string' ? [dedupeKeyOrKeys] : dedupeKeyOrKeys);
  const rows = occurrences.filter(row => keys.has(row.dedupeKey) && row.deterministicWeight >= weightThreshold);
  return { distinctDays: new Set(rows.map(row => row.dayBucket)).size,
    distinctTopics: new Set(rows.filter(row => row.topicId !== null).map(row => row.topicId)).size,
    distinctSessions: new Set(rows.filter(row => row.sessionId !== null).map(row => row.sessionId)).size, qualifyingOccurrences: rows.length };
}

/** A bounded working set over one record's occurrences: the newest `limit`, with the omission counted rather
 * than erased (Rule 40: capacity applied as designed is a success, and Rule 7: nothing was deleted). */
export function occurrencePage(record: CorrectionRecord, limit = DEFAULT_MAX_OCCURRENCES_PER_KEY):
  { rows: CorrectionOccurrence[]; omitted: number } {
  const keep = Math.max(1, limit);
  return { rows: record.occurrences.slice(-keep), omitted: Math.max(0, record.occurrences.length - keep) };
}

/** Strip `learning` (raw distilled text), the session and the occurrence detail: the ONLY shape a status
 * surface may serve (spec §3.4). The quoted texts stay in the journal, which the inspection surface reads. */
export function toApiView(record: CorrectionRecord): CorrectionRecordApiView {
  const { learning: _internalLearning, sessionId: _internalSession, occurrences: _internalRows, ...rest } = record;
  void _internalLearning; void _internalSession; void _internalRows;
  return { ...rest };
}
