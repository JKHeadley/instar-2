/**
 * RevivalQueue — the durable, ordered queue of mid-work lost workers awaiting
 * revival. Carried from 1.x `src/monitoring/ResumeQueue.ts` at
 * 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9 (reap-notify spec R2.2/R2.3, parts
 * of R2.9/R2.10) for carryover row 03, and wired behind Part Ten's existing
 * ports:
 *
 *  - Persistence is the host-owned durable store the conversation already
 *    uses (`ConversationSessionStore` discipline: atomic, durable before
 *    return, corrupt state throws and never looks empty). The 1.x temp → fsync
 *    → rename → fsync-dir discipline lives in that host store
 *    (scripts/conversation-host-store.mjs), not here. In-memory authoritative
 *    with a SYNCHRONOUS persist on every mutation, as in 1.x.
 *  - Single-writer is ENFORCED by the existing conversation ownership fence
 *    (tests/preview/conversation-owner.ts: exclusive per conversation, refused
 *    across machines, inhibited when the authority is unusable), so the 1.x
 *    pid/hostname lockfile, its stale-lock reclaim and the FD1–FD5 foreign-host
 *    auto-heal are not carried. Rules 32/63/113.
 *  - Time is the injected clock (`now`), as numbers of milliseconds; the core
 *    boundary reaches no ambient clock (NF-52).
 *  - The 1.x dry-run fleet posture is not carried: this route ships reviewed and
 *    live, a dark safety feature guards nothing (Rules 73/76), and the register's
 *    own status field is the posture.
 *
 * Eligibility (R2.2) is stricter than midWork: terminal + autonomous +
 * (≥1 strong signal, OR topic-bound with ≥2 distinct weak signals); jobs
 * must opt in (`resumeOnReap:true`, default false); sessions with neither a
 * topic binding nor a jobSlug are excluded at enqueue; operator kills
 * excluded by default; watchdog stuck-kills and topic-moved closeouts never
 * queue. The resurrection LEDGER (keyed on stable identity
 * `topicId ?? jobSlug ?? tmuxSession`, tombstones surviving dequeue, 24h
 * reset window) caps kill-resume-kill loops at `maxResurrections`.
 */

import { evidenceEligible, clampWorkEvidence } from './work-evidence.js';

export type ResumePriorityClass = 'interactive' | 'job' | 'other';

export type ResumeEntryStatus =
  | 'queued'
  | 'starting'
  | 'respawned'
  | 'failed'
  | 'cancelled'
  | `invalidated:${string}`
  | `gave-up:${string}`;

export interface ResumeQueueEntry {
  id: string;
  /** Milliseconds since the epoch, from the injected clock. */
  queuedAt: number;
  /** TTL re-anchor on an operator requeue (R2.10); TTL keys on max(queuedAt, requeuedAt). */
  requeuedAt?: number | undefined;
  /** Stable identity: topicId ?? jobSlug ?? tmuxSession (R2.3). */
  stableKey: string;
  sessionName: string;
  tmuxSession: string;
  topicId?: number | string;
  /** Threadline conversation recovered after an unbound warm worker is reaped. */
  threadId?: string;
  /** Canonical inbound message whose processing must be retried. */
  threadlineMessageId?: string;
  /** Conversation-resume UUID snapshot at enqueue time (R2.6 revalidates). */
  resumeUuid?: string;
  jobSlug?: string;
  cwd: string;
  worktreePath?: string;
  priorityClass: ResumePriorityClass;
  reason: string;
  workEvidence: string[];
  attempts: number;
  status: ResumeEntryStatus;
  lastAttemptAt?: number | undefined;
  /** Backoff hold between attempts (R2.9). */
  nextAttemptAt?: number | undefined;
  /** Milliseconds of operator-pause time excluded from this entry's TTL clock. */
  frozenMs?: number | undefined;
  /** TTL expiry under sustained pressure carries this marker (R2.9). */
  pressureStarved?: boolean | undefined;
}

/** Tombstone ledger row — survives dequeue (R2.9 resurrection cap). */
export interface ResurrectionTombstone {
  stableKey: string;
  resurrections: number;
  windowStartAt: number;
  lastResumeAt?: number | undefined;
}

export interface ResumeQueueConfig {
  maxAttempts: number;
  maxResurrections: number;
  entryTtlHours: number;
  maxQueueSize: number;
  includeOperatorKills: boolean;
}

export const DEFAULT_RESUME_QUEUE_CONFIG: ResumeQueueConfig = {
  maxAttempts: 3,
  maxResurrections: 2,
  entryTtlHours: 24,
  maxQueueSize: 50,
  includeOperatorKills: false,
};

const RESURRECTION_WINDOW_MS = 24 * 3600_000;
const REASON_CAP = 500;

export interface RevivalQueueState {
  version: 1;
  paused: boolean;
  pausedAt?: number | undefined;
  pauseReason?: string | undefined;
  entries: ResumeQueueEntry[];
  tombstones: ResurrectionTombstone[];
}

export interface EnqueueDecision {
  enqueued: boolean;
  /** Why not (audit vocabulary). */
  why?: string | undefined;
  entry?: ResumeQueueEntry;
}

export interface ResumeCandidateInput {
  sessionName: string;
  tmuxSession: string;
  topicId?: number | string | null;
  threadId?: string;
  threadlineMessageId?: string;
  jobSlug?: string;
  jobResumeOptIn?: boolean;
  resumeUuid?: string | null;
  cwd: string;
  worktreePath?: string;
  reason: string;
  disposition: 'terminal' | 'recovery-bounce';
  origin: 'operator' | 'autonomous';
  workEvidence: string[];
  /**
   * Age-limit kill only: the session was seen working after it passed its age
   * limit. It lived and worked a full lifetime since any earlier resume, so this
   * re-reap is not a kill-resume-kill loop: the resurrection ledger restarts
   * instead of counting it (2026-09-30 18:14Z, topic 52075: a coordinator that
   * worked five hours after its last revival was refused by the cap).
   */
  seenWorkingPastAgeLimit?: boolean;
}

/** The host-owned durable store slice this queue persists into. A corrupt record must
 * throw from `load`, never look empty: a silently reset ledger would drop the loop brake. */
export interface RevivalQueueStore {
  load(): RevivalQueueState | null;
  save(state: RevivalQueueState): void;
}

export interface ResumeQueueDeps {
  store: RevivalQueueStore;
  /** Decision-transition audit sink. */
  audit?: (event: Record<string, unknown>) => void;
  /** Aggregated attention surface (ONE rolling item — the caller dedupes). */
  raiseAggregated?: (kind: string, detail: string) => void;
  now: () => number;
}

/** Lay optional config over defaults without letting an `undefined` erase a default
 * (1.x mergeDefaults: an explicit `key: undefined` from an omitted operator field must not spin a timer). */
function mergeDefaults<D extends object>(defaults: D, override?: Partial<D>): D {
  const out = { ...defaults } as Record<string, unknown>;
  for (const [key, value] of Object.entries(override ?? {})) if (value !== undefined) out[key] = value;
  return out as D;
}

/** Pure eligibility classifier (R2.2) — exported for tests. */
export function classifyEligibility(
  input: ResumeCandidateInput,
  cfg: Pick<ResumeQueueConfig, 'includeOperatorKills'>,
): { eligible: boolean; why?: string } {
  if (input.disposition !== 'terminal') return { eligible: false, why: 'not-terminal' };
  if (input.origin === 'operator' && !cfg.includeOperatorKills) {
    return { eligible: false, why: 'operator-kill' };
  }
  // A stuck session is not interrupted work; resuming recreates the wedge —
  // watchdog escalation owns that recovery (R2.1).
  if (input.reason === 'watchdog-stuck') return { eligible: false, why: 'watchdog-kill' };
  // Post-transfer closeouts: the conversation continues on the owning machine.
  if (input.reason.startsWith('topic moved')) return { eligible: false, why: 'topic-moved' };
  const topicBound = input.topicId != null;
  const threadBound = !!input.threadId && !!input.threadlineMessageId;
  if (!topicBound && !input.jobSlug && !threadBound) return { eligible: false, why: 'no-resume-path' };
  if (!topicBound && input.jobSlug && !input.jobResumeOptIn) {
    return { eligible: false, why: 'job-not-opted-in' };
  }
  if (!evidenceEligible(input.workEvidence, topicBound)) {
    return { eligible: false, why: 'insufficient-evidence' };
  }
  return { eligible: true };
}

export class ResumeQueue {
  private readonly deps: ResumeQueueDeps;
  private readonly cfg: ResumeQueueConfig;
  private readonly now: () => number;
  private state: RevivalQueueState = { version: 1, paused: false, entries: [], tombstones: [] };
  private seq = 0;
  private started = false;

  constructor(deps: ResumeQueueDeps, cfg?: Partial<ResumeQueueConfig>) {
    this.deps = deps;
    this.cfg = mergeDefaults(DEFAULT_RESUME_QUEUE_CONFIG, cfg);
    this.now = deps.now;
  }

  config(): ResumeQueueConfig {
    return { ...this.cfg };
  }

  isPaused(): boolean {
    return this.state.paused;
  }

  /**
   * Load the durable state under the existing ownership fence. A corrupt store
   * throws here (Rules 26/40/42: refuse malformed state and preserve it) rather
   * than starting an empty queue that has silently lost its resurrection ledger.
   */
  start(): boolean {
    this.load();
    this.reconcileStartingEntries();
    this.started = true;
    return true;
  }

  stop(): void {
    this.started = false;
  }

  private load(): void {
    const parsed = this.deps.store.load();
    if (parsed == null) return;
    if (parsed && parsed.version === 1 && Array.isArray(parsed.entries)) {
      // The host store may hand back a frozen record; the queue mutates its own copy.
      this.state = structuredClone({
        version: 1,
        paused: !!parsed.paused,
        pausedAt: parsed.pausedAt,
        pauseReason: parsed.pauseReason,
        entries: parsed.entries,
        tombstones: Array.isArray(parsed.tombstones) ? parsed.tombstones : [],
      });
      return;
    }
    throw new Error('revival queue state unrecognized; preserved for reconciliation');
  }

  /** Persist through the host store: durable before return, never partially visible. */
  private persist(): void {
    this.deps.store.save(structuredClone(this.state));
  }

  private audit(event: Record<string, unknown>): void {
    try {
      this.deps.audit?.({ ts: this.now(), ...event });
    } catch {
      /* @silent-fallback-ok — the audit sink never endangers the queue; the
         decision the audit row describes still happened and is persisted. */
    }
  }

  /** Boot reconciliation half 1 (R2.4): `starting` found at load = failed attempt. */
  private reconcileStartingEntries(): void {
    let changed = false;
    for (const entry of this.state.entries) {
      if (entry.status === 'starting') {
        entry.attempts += 1;
        entry.status = entry.attempts >= this.cfg.maxAttempts ? 'gave-up:max-attempts' : 'queued';
        entry.nextAttemptAt = undefined;
        this.audit({ event: 'boot-reconcile-starting', id: entry.id, attempts: entry.attempts, status: entry.status });
        changed = true;
      }
    }
    if (changed) this.persist();
  }

  /**
   * Boot reconciliation half 2 (R2.4): recent reap-log midWork terminal
   * autonomous entries with no queue entry AND no tombstone are re-enqueued —
   * closing the crash window where an enqueue's persist was lost. The caller
   * supplies reconstruction (session records, resume map) — a candidate that
   * cannot be reconstructed is skipped (the next re-reap recreates it).
   */
  reconcileFromReapLog(candidates: ResumeCandidateInput[]): number {
    let enqueued = 0;
    for (const candidate of candidates) {
      const stableKey = this.stableKeyFor(candidate);
      const known =
        this.state.entries.some((e) => e.stableKey === stableKey) ||
        this.state.tombstones.some((t) => t.stableKey === stableKey);
      if (known) continue;
      const decision = this.considerEnqueue(candidate, { source: 'boot-reconcile' });
      if (decision.enqueued) enqueued++;
    }
    return enqueued;
  }

  private stableKeyFor(input: { topicId?: number | string | null; threadId?: string; jobSlug?: string; tmuxSession: string }): string {
    if (input.topicId != null) return `topic:${input.topicId}`;
    if (input.threadId) return `thread:${input.threadId}`;
    if (input.jobSlug) return `job:${input.jobSlug}`;
    return `tmux:${input.tmuxSession}`;
  }

  /**
   * The enqueue decision (R2.2 + R2.3 + R2.9 resurrection cap). Audited on
   * every outcome.
   */
  considerEnqueue(input: ResumeCandidateInput, opts?: { source?: string }): EnqueueDecision {
    if (!this.started) return { enqueued: false, why: 'queue-off' };

    const verdict = classifyEligibility(input, this.cfg);
    if (!verdict.eligible) {
      this.audit({ event: 'enqueue-skipped', why: verdict.why, session: input.sessionName, source: opts?.source });
      return { enqueued: false, why: verdict.why };
    }

    const stableKey = this.stableKeyFor(input);

    // Dedupe on stable identity: one open entry per topic/job/session.
    const open = this.state.entries.find(
      (e) => e.stableKey === stableKey && (e.status === 'queued' || e.status === 'starting'),
    );
    if (open) {
      this.audit({ event: 'enqueue-skipped', why: 'duplicate-open-entry', stableKey, source: opts?.source });
      return { enqueued: false, why: 'duplicate-open-entry' };
    }

    // Resurrection cap (R2.9): a re-reap AFTER a successful resume within the
    // window increments the ledger; at the cap the enqueue is refused LOUDLY —
    // the most diagnostic event this feature produces (P14).
    const tombstone = this.tombstoneFor(stableKey);
    if (tombstone?.lastResumeAt) {
      const windowFresh = this.now() - tombstone.windowStartAt < RESURRECTION_WINDOW_MS;
      if (input.seenWorkingPastAgeLimit) {
        // The revived session worked past its whole age limit — not a loop.
        // Restart the ledger; later re-reaps are counted from here.
        tombstone.resurrections = 0;
        tombstone.windowStartAt = this.now();
        this.audit({ event: 'resurrection-ledger-reset', why: 'worked-past-age-limit', stableKey, source: opts?.source });
      } else if (!windowFresh) {
        // The prior resume is outside the 24h window — stale history, not a
        // kill-resume-kill loop. Reset the ledger; this re-reap starts fresh.
        tombstone.resurrections = 0;
        tombstone.windowStartAt = this.now();
      } else {
        tombstone.resurrections += 1;
      }
      if (windowFresh && tombstone.resurrections >= this.cfg.maxResurrections) {
        this.persist();
        this.audit({ event: 'resurrection-cap', stableKey, resurrections: tombstone.resurrections });
        this.deps.raiseAggregated?.(
          'resurrection-cap',
          `${stableKey} was reaped again after ${tombstone.resurrections} resume(s) in 24h — ` +
          `not resuming it again automatically (something keeps killing it). Message the topic to bring ` +
          `it back, or ask me to retry it.`,
        );
        return { enqueued: false, why: 'resurrection-cap' };
      }
    }

    // Bound (R2.3): overflow drops the oldest LOW-priority entry into the
    // aggregated surface — never silently.
    const openEntries = this.state.entries.filter((e) => e.status === 'queued' || e.status === 'starting');
    if (openEntries.length >= this.cfg.maxQueueSize) {
      const dropOrder: ResumePriorityClass[] = ['other', 'job', 'interactive'];
      let dropped: ResumeQueueEntry | undefined;
      for (const cls of dropOrder) {
        dropped = openEntries.filter((e) => e.priorityClass === cls).sort((a, b) => a.queuedAt - b.queuedAt)[0];
        if (dropped) break;
      }
      if (dropped) {
        dropped.status = 'gave-up:overflow';
        this.audit({ event: 'overflow-drop', id: dropped.id, stableKey: dropped.stableKey });
        this.deps.raiseAggregated?.(
          'overflow',
          `The resume queue hit its cap (${this.cfg.maxQueueSize}); the oldest low-priority entry ` +
          `(${dropped.sessionName}) was dropped.`,
        );
      }
    }

    const entry: ResumeQueueEntry = {
      id: `rq-${this.now().toString(36)}-${(this.seq++).toString(36)}`,
      queuedAt: this.now(),
      stableKey,
      sessionName: input.sessionName,
      tmuxSession: input.tmuxSession,
      ...(input.topicId != null ? { topicId: input.topicId } : {}),
      ...(input.threadId ? { threadId: input.threadId } : {}),
      ...(input.threadlineMessageId ? { threadlineMessageId: input.threadlineMessageId } : {}),
      ...(input.resumeUuid ? { resumeUuid: input.resumeUuid } : {}),
      ...(input.jobSlug ? { jobSlug: input.jobSlug } : {}),
      cwd: input.cwd,
      ...(input.worktreePath ? { worktreePath: input.worktreePath } : {}),
      priorityClass: input.topicId != null || input.threadId ? 'interactive' : input.jobSlug ? 'job' : 'other',
      reason: input.reason.slice(0, REASON_CAP),
      workEvidence: clampWorkEvidence(input.workEvidence),
      attempts: 0,
      status: 'queued',
    };
    this.state.entries.push(entry);
    this.persist();
    this.audit({
      event: 'enqueued',
      id: entry.id,
      stableKey,
      priorityClass: entry.priorityClass,
      midWorkEvidence: entry.workEvidence,
      source: opts?.source,
    });
    return { enqueued: true, entry };
  }

  private tombstoneFor(stableKey: string): ResurrectionTombstone | undefined {
    return this.state.tombstones.find((t) => t.stableKey === stableKey);
  }

  /**
   * Public read of the resurrection count for a topic — the SAME stable key the
   * queue's own cap uses. The AutonomousLivenessReconciler reads this to UNIFY
   * its redie give-up bound with the queue's resurrection cap (spec §"Loop
   * brake"): a reconciler-respawned session is marked midWork, so a later reaper
   * kill is revived by the queue under ITS cap; counting that toward the
   * reconciler's redie counter makes the two paths share ONE effective give-up
   * bound. Read-only; never mutates. 0 when no tombstone exists.
   */
  resurrectionCountForTopic(topicId: number | string): number {
    return this.tombstoneFor(`topic:${topicId}`)?.resurrections ?? 0;
  }

  /** Record a successful resume (drainer, after spawn verification). */
  recordResumeSuccess(stableKey: string): void {
    let tombstone = this.tombstoneFor(stableKey);
    if (!tombstone) {
      tombstone = {
        stableKey,
        resurrections: 0,
        windowStartAt: this.now(),
      };
      this.state.tombstones.push(tombstone);
    }
    tombstone.lastResumeAt = this.now();
    this.persist();
  }

  /** Ordered open entries: interactive → job → other, FIFO inside each (R2.5). */
  nextCandidates(): ResumeQueueEntry[] {
    const order: Record<ResumePriorityClass, number> = { interactive: 0, job: 1, other: 2 };
    return this.state.entries
      .filter((e) => e.status === 'queued')
      .sort(
        (a, b) =>
          order[a.priorityClass] - order[b.priorityClass] || a.queuedAt - b.queuedAt,
      );
  }

  list(): ResumeQueueEntry[] {
    return [...this.state.entries];
  }

  get(id: string): ResumeQueueEntry | undefined {
    return this.state.entries.find((e) => e.id === id);
  }

  /** State-transition helpers (each persists + audits the TRANSITION). */
  transition(id: string, status: ResumeEntryStatus, extra?: Partial<ResumeQueueEntry>): boolean {
    const entry = this.get(id);
    if (!entry) return false;
    const from = entry.status;
    entry.status = status;
    if (extra) Object.assign(entry, extra);
    this.persist();
    this.audit({ event: 'transition', id, from, to: status, attempts: entry.attempts });
    return true;
  }

  /** Operator/API cancel (an explicit per-topic stop cancels that topic's entries — R2.7). */
  cancel(id: string): boolean {
    const entry = this.get(id);
    if (!entry || (entry.status !== 'queued' && entry.status !== 'starting')) return false;
    return this.transition(id, 'cancelled');
  }

  cancelByTopic(topicId: number | string): number {
    let n = 0;
    for (const entry of this.state.entries) {
      if (entry.topicId === topicId && (entry.status === 'queued' || entry.status === 'starting')) {
        this.transition(entry.id, 'cancelled');
        n++;
      }
    }
    return n;
  }

  /**
   * Requeue clamps (R2.10): eligible from gave-up:* ONLY — never `cancelled`
   * (an operator stop) and refused while paused (callers enforce the 409).
   * Resets attempts and RE-ANCHORS the TTL clock while preserving the original
   * queuedAt for the R2.6 operator-stop / job-ran-since checks. Requeueing a
   * gave-up:resurrection-cap entry grants exactly ONE audited override.
   */
  requeue(id: string): { ok: boolean; why?: string } {
    if (this.state.paused) return { ok: false, why: 'queue-paused' };
    const entry = this.get(id);
    if (!entry) return { ok: false, why: 'not-found' };
    if (!entry.status.startsWith('gave-up:')) return { ok: false, why: 'not-gave-up' };
    if (entry.status === 'gave-up:resurrection-cap') {
      // The requeue itself IS the one audited override (it bypasses the
      // considerEnqueue cap check); the next re-reap re-caps (R2.10).
      this.audit({ event: 'resurrection-override-granted', stableKey: entry.stableKey, id });
    }
    entry.attempts = 0;
    entry.requeuedAt = this.now();
    entry.nextAttemptAt = undefined;
    entry.pressureStarved = false;
    return this.transition(id, 'queued') ? { ok: true } : { ok: false, why: 'transition-failed' };
  }

  /**
   * Queue-global pause (R2.7): entries keep their states; TTLs freeze.
   *
   * First-writer-wins. The 1.x "upgrade an auto-resumable emergency pause into a
   * deliberate halt" rule existed only because 1.x could auto-clear a stale
   * emergency pause; Part Ten never clears a pause on its own (Rules 4/93: a
   * directive holds until superseded or done; stop is never weakened by
   * elapsed time), so every pause is already the deliberate kind.
   */
  pause(reason: string): void {
    if (this.state.paused) return;
    this.state.paused = true;
    this.state.pausedAt = this.now();
    this.state.pauseReason = reason;
    this.persist();
    this.audit({ event: 'paused', reason });
  }

  /** Explicit unpause lever (R2.7) — accumulates the pause into frozenMs. */
  unpause(): void {
    if (!this.state.paused) return;
    const pausedMs = this.state.pausedAt !== undefined ? this.now() - this.state.pausedAt : 0;
    for (const entry of this.state.entries) {
      if (entry.status === 'queued' || entry.status === 'starting') {
        entry.frozenMs = (entry.frozenMs ?? 0) + pausedMs;
      }
    }
    this.state.paused = false;
    this.state.pausedAt = undefined;
    this.state.pauseReason = undefined;
    this.persist();
    this.audit({ event: 'unpaused', pausedMs });
  }

  pauseInfo(): { paused: boolean; pausedAt?: number | undefined; reason?: string | undefined } {
    return { paused: this.state.paused, pausedAt: this.state.pausedAt, reason: this.state.pauseReason };
  }

  /**
   * TTL sweep (R2.9): INCIDENT-AGE semantics — wall clock since
   * max(queuedAt, requeuedAt), minus operator-pause freeze, NOT frozen by
   * pressure. Expiries under sustained pressure carry the pressure-starved
   * marker so a day-long overload reads differently from ordinary staleness.
   * No sweep while paused (an operator pause must not silently expire the queue).
   */
  expireTtl(pressureCalm: boolean): ResumeQueueEntry[] {
    if (this.state.paused) return [];
    const expired: ResumeQueueEntry[] = [];
    const ttlMs = this.cfg.entryTtlHours * 3600_000;
    for (const entry of this.state.entries) {
      if (entry.status !== 'queued') continue;
      const anchor = entry.requeuedAt ?? entry.queuedAt;
      const ageMs = this.now() - anchor - (entry.frozenMs ?? 0);
      if (ageMs > ttlMs) {
        entry.pressureStarved = !pressureCalm;
        entry.status = 'gave-up:ttl';
        expired.push(entry);
        this.audit({ event: 'ttl-expired', id: entry.id, pressureStarved: entry.pressureStarved, ageMs });
      }
    }
    if (expired.length > 0) this.persist();
    return expired;
  }

  /** Snapshot for the pull surface (R2.10). */
  snapshot(): {
    paused: boolean;
    pauseReason?: string | undefined;
    entries: ResumeQueueEntry[];
    tombstones: ResurrectionTombstone[];
  } {
    return {
      paused: this.state.paused,
      pauseReason: this.state.pauseReason,
      entries: this.list(),
      tombstones: [...this.state.tombstones],
    };
  }

  /** OWNERSHIP predicate — true when a queued entry exists for this tmux
   *  session, REGARDLESS of pause state. Intentionally paused-BLIND: a paused
   *  queue still OWNS its frozen entries (the drainer skips them precisely
   *  because they are paused), so the double-spawn coordination guard must read
   *  THIS to keep deferring to the queue while paused — flipping it false during
   *  a pause would let an escalation re-spawn a revive the queue was meant to own.
   *  (honest-session-state-surfaces Finding (c): do NOT add a paused check here.) */
  hasLiveQueuedEntryFor(tmuxSession: string): boolean {
    if (!this.started) return false;
    return this.state.entries.some(
      (e) => e.tmuxSession === tmuxSession && (e.status === 'queued' || e.status === 'starting'),
    );
  }

  /** CLAIMABILITY predicate — true when a queued entry exists AND the queue
   *  is NOT paused, i.e. a revival will actually happen soon. Feeds the
   *  user-facing "A restart is queued — I'll bring it back" copy: while the
   *  queue is paused (e.g. an emergency stop) the entry will NOT revive until
   *  the queue resumes, so the claim would be a promise the queue cannot
   *  currently keep. Distinct from hasLiveQueuedEntryFor (ownership), which the
   *  double-spawn guard reads and which stays true while paused.
   *  (honest-session-state-surfaces Finding (c).) */
  hasClaimableQueuedEntryFor(tmuxSession: string): boolean {
    return this.hasLiveQueuedEntryFor(tmuxSession) && !this.isPaused();
  }
}
