/**
 * WorkerRecovery — mechanical session crash/stall recovery. Carried from 1.x
 * `src/monitoring/SessionRecovery.ts` at 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9
 * (PROP-session-stall-recovery) for carryover row 03, and wired behind Part Ten's
 * existing ports:
 *
 *  - The three detectors are observation ports (`detectStall`, `detectErrorLoop`,
 *    `detectCrash`), fed by the harness adapter that owns the transcript. The 1.x
 *    `lsof`-based transcript lookup and tail reads are the adapter's, never the
 *    core's (NF-52; Rule 30). The pure 1.x detector logic over supplied JSONL
 *    entries is carried in stall-detector.ts and crash-detector.ts.
 *  - Transcript truncation (jsonl-truncator) is deliberately not carried: Part Ten
 *    never rewinds a transcript to authorize replay (Rules 4/26/63; a rewound
 *    action can be replayed with unknown effects). The 1.x escalation ladder
 *    (last_exchange → last_successful_tool → n_exchanges_back) is kept as the
 *    recorded strategy and the respawn prompt says so only when a host port
 *    actually performed a rewind.
 *  - Recovery state (attempt counts, cooldowns, the durable context-wall latch)
 *    persists through the host-owned store instead of `.instar/recovery-state.json`.
 *  - The event log is an injected sink instead of `recovery-events.jsonl`; the
 *    EventEmitter is an injected `onEvent` port.
 *  - The 3-second kill-to-respawn settle uses the host's bounded `wait`.
 *  - The in-flight reply race (poll topic history for 7 s at 500 ms) is replaced by
 *    the host's exact send receipts: an injected `inFlightReply` port answers from
 *    durable send intent/receipt, never from an arbitrary sleep (Rules 1/26/63).
 *
 * A fast, deterministic layer that runs BEFORE any model-powered triage.
 * Detects three failure modes without any LLM calls:
 * 1. Tool call stalls (process alive but frozen mid-tool)
 * 2. Crashes (process dead with incomplete JSONL)
 * 3. Error loops (same error repeated 3+ times)
 *
 * Recovery strategy: respawn with a recovery prompt.
 * Escalation ladder: last_exchange → last_successful_tool → n_exchanges_back → alert human.
 */

import type { StallInfo } from './stall-detector.js';
import type { CrashInfo, ErrorLoopInfo } from './crash-detector.js';

// ============================================================================
// Types
// ============================================================================

export type TruncationStrategy = 'last_exchange' | 'last_successful_tool' | 'n_exchanges_back';

export interface SessionRecoveryConfig {
  enabled: boolean;
  /** Max recovery attempts per session before alerting human */
  maxAttempts: number;
  /** Cooldown between recovery attempts (ms) */
  cooldownMs: number;
  /** A context-wall latch older than this forces recovery even when work
   * evidence remains ambiguous. Default: 30 minutes. */
  contextExhaustionDeferralCeilingMs: number;
}

export interface RecoveryAttempt {
  lastAttempt: number;
  count: number;
}

/** A session transcript receipt: resolved only when a path resolved AND statting it succeeded. */
export interface TranscriptProbe {
  readonly resolved: boolean;
  readonly path: string;
  readonly size: number;
  readonly mtime: number;
}

export type TranscriptDelta = 'grew' | 'static' | 'unknown';

/**
 * Compare two probes of the same session over an observation window (1.x transcriptProber).
 *  - `'grew'`    — size or mtime advanced ⇒ the session produced output (WORKING).
 *  - `'static'`  — both probes resolved, same file identity, no growth ⇒ quiet.
 *  - `'unknown'` — either probe unresolved, or the file identity changed ⇒ caller KEEPS.
 */
export function transcriptDelta(baseline: TranscriptProbe, current: TranscriptProbe): TranscriptDelta {
  if (!baseline.resolved || !current.resolved) return 'unknown';
  if (current.path !== baseline.path) return 'unknown';
  if (current.size > baseline.size || current.mtime > baseline.mtime) return 'grew';
  return 'static';
}

function isTranscriptProbe(value: unknown): value is TranscriptProbe {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<TranscriptProbe>;
  return typeof row.resolved === 'boolean'
    && typeof row.path === 'string'
    && typeof row.size === 'number'
    && Number.isFinite(row.size)
    && typeof row.mtime === 'number'
    && Number.isFinite(row.mtime);
}

export interface RecoveryResult {
  recovered: boolean;
  failureType: 'stall' | 'crash' | 'error_loop' | 'context_exhaustion' | null;
  strategy?: TruncationStrategy;
  attemptNumber?: number;
  message: string;
  /** True when the kill was DEFERRED because the work-check found the session
   *  alive and actively producing work (active child processes). The session
   *  was NOT killed and is NOT dead — callers MUST NOT treat this as a failed
   *  recovery of a dead session, and MUST NOT notify the user (a deferral is
   *  the system deciding the session is fine; telling the user it died is a
   *  false death report — the 2026-06-06 "conversation too long" flood). */
  deferred?: boolean;
}

export interface RecoveryEvent {
  timestamp: number;
  failureType: RecoveryResult['failureType'];
  recovered: boolean;
  topicId: number | string;
  sessionName: string;
  attempt: number;
}

/** Durable recovery state; the host store owns atomic persistence. */
export interface WorkerRecoveryState {
  attempts: Record<string, RecoveryAttempt>;
  wedgedSeen: Record<string, { firstSeenAt: number; transcript?: TranscriptProbe }>;
}

export interface SessionRecoveryDeps {
  /** Check if a session's worker process is alive */
  isSessionAlive: (sessionName: string) => boolean;
  /**
   * Kill a session — for kill-to-respawn paths this routes through the host's
   * exact retirement (close admission, confirmed stop, lease release) so a
   * bounce is never reported as a disappearance and lands in the durable record.
   * Implementations may be async; callers `await` the result.
   */
  killSession: (sessionName: string) => void | Promise<void>;
  /**
   * P1/P2 cross-check (UNIFIED-SESSION-LIFECYCLE §P0 #8): does the session have
   * active child processes? A stall reading on a process that is still producing
   * real work is almost always a false read — keep the session and let the next
   * tick re-evaluate. Undefined ⇒ check is skipped.
   */
  hasActiveProcesses?: (sessionName: string) => boolean;
  /**
   * Session-specific transcript receipt used by context-wall recovery. Growth
   * is positive proof of work; a static transcript is proof that helper-process
   * existence alone must not veto recovery.
   */
  probeTranscript?: (sessionName: string) => TranscriptProbe;
  /** Deterministic clock seam for latch ceilings and tests. */
  now: () => number;
  /** The host's bounded wait (the 3-second kill-to-respawn settle). */
  wait: (ms: number) => Promise<void>;
  /** Respawn a session for a topic, optionally with a recovery prompt */
  respawnSession: (topicId: number | string, sessionName?: string, recoveryPrompt?: string) => Promise<void>;
  /** Capture terminal output for a session (needed for context exhaustion detection) */
  captureSessionOutput?: (sessionName: string, lines: number) => string | null;
  /** The adapter's context-wall classifier over captured output (1.x detectContextExhaustion). */
  detectContextExhaustion?: (output: string) => { matched: boolean; pattern: string | null };
  /** Respawn a session fresh (no --resume) for context exhaustion recovery */
  respawnSessionFresh?: (topicId: number | string, sessionName?: string, recoveryPrompt?: string) => Promise<void>;
  /**
   * Non-destructive context-wall escalation: compact a session genuinely stuck
   * at the context wall and verify the wall cleared. This PRESERVES the
   * conversation — the rung tried BEFORE the destructive fresh respawn. Resolves
   * `{ cleared: true }` when the wall is gone after compaction, `{ cleared:
   * false, reason }` when compaction itself fails or times out — in which case
   * recovery falls through to the fresh respawn. Undefined ⇒ the rung is skipped.
   */
  attemptCompaction?: (sessionName: string, topicId: number | string) => Promise<{ cleared: boolean; reason?: string }>;
  /**
   * The exact reply the dying session already sent after `detectedAt`, from the
   * host's durable send receipts, so the fresh session can avoid duplicating it.
   * Absent ⇒ no reply is assumed; an unknown send stays with the host's own
   * uncertainty handling, never a guessed "nothing landed".
   */
  inFlightReply?: (topicId: number | string, detectedAt: number) => Promise<string | null>;
  /** Observation ports for the three mechanical failure modes (adapter-owned reads). */
  detectStall?: (sessionName: string) => StallInfo | null;
  detectErrorLoop?: (sessionName: string) => ErrorLoopInfo | null;
  detectCrash?: (sessionName: string) => CrashInfo | null;
  /** Transcript rewind, when a host actually provides one. Absent: no rewind, the prompt says so. */
  truncate?: (sessionName: string, strategy: TruncationStrategy, exchanges?: number) => void;
  /** Durable recovery state. */
  store: { load(): WorkerRecoveryState | null; save(state: WorkerRecoveryState): void };
  /** Recovery event sink (1.x recovery-events.jsonl). */
  logEvent?: (event: RecoveryEvent) => void;
  /** Lifecycle event port (1.x EventEmitter). */
  onEvent?: (name: string, payload: Record<string, unknown>) => void;

  // ── Part D: double-dispatch recovery gate (docs/specs/ownership-follows-live-work.md) ──
  // Injected primitives that let `checkAndRecover` consult per-topic ownership
  // BEFORE re-running a recovery locally, so a machine that no longer owns a topic
  // FORWARDS to the owner instead of double-dispatching the same inbound. All
  // optional — when absent (or `ownershipFollowsLiveWork()` resolves false) the
  // gate is a strict no-op and the existing recovery logic runs unchanged. The
  // decision logic lives in `checkAndRecover` so both sides of every ownership
  // state are unit-testable here.

  /** The gate flag. False / absent ⇒ gate is a no-op. */
  ownershipFollowsLiveWork?: () => boolean;
  /**
   * The topic's owner machine id, or null when no record / released. MAY THROW
   * (registry unreadable); the gate treats a throw as the fail-OPEN
   * registry-unknown branch (re-run locally + telemetry), distinct from a
   * reachability throw (which names a peer → withhold).
   */
  ownerOfTopic?: (topicId: number | string) => string | null;
  /** This machine's mesh id (null when single-machine / not yet resolved). */
  selfMachineId?: () => string | null;
  /**
   * Is the (peer) owner machine reachable right now? MAY THROW / be
   * indeterminate → the gate treats that as the UNREACHABLE-peer branch
   * (withhold the local re-run; the record NAMES a peer, so we don't
   * double-dispatch) — NOT the fail-open registry-unknown branch.
   */
  isOwnerReachable?: (owner: string) => boolean;
  /**
   * Forward the topic's ALREADY-DURABLE pending inbound through the existing
   * route drain (FIFO, never a fabricated message). Returns the count forwarded
   * + a `nonePending` flag (true ⇒ nothing to serve; the gate withholds the local
   * respawn and emits no forward). Ordering + exactly-once are the queue drain's +
   * the per-event-id ledger's responsibility — the gate adds neither.
   */
  forwardPendingInboundViaRoute?: (topicId: number | string) => Promise<{ forwarded: number; nonePending: boolean }>;
  /**
   * Emit ONE neutral observational telemetry row for the fail-OPEN /
   * reachability-unknown branches so the fail-open tradeoff is MEASURED, not
   * assumed. Best-effort; a throw never affects the recovery decision.
   */
  emitRecoveryGateTelemetry?: (row: {
    kind: 'recovery-gate-registry-unknown' | 'recovery-gate-reachability-unknown';
    topicId: number | string;
    decision: 're-run-local' | 'withhold';
    reason: string;
  }) => void;
}

/**
 * Part D decision (docs/specs/ownership-follows-live-work.md). The MIXED safe
 * direction, named honestly per ownership state:
 *  - `proceed`   → re-run locally (owner === self, or null/released, or the
 *    fail-OPEN registry-unknown branch — re-running cannot double-dispatch when
 *    nobody else owns it, and a dead conversation is a worse failure than a rare
 *    double-reply on an UNKNOWN-ownership registry blip).
 *  - `forward`   → owner is a REACHABLE peer: do NOT re-run; forward to the owner.
 *  - `withhold`  → owner is an UNREACHABLE peer (incl. reachability throw): the
 *    record names a peer, so withhold the local re-run; the message rides the
 *    durable inbound queue / forward path (bounded by that queue's TTL +
 *    loss-notice — never an unbounded hold, never a silent strand).
 */
export type OwnershipRecoveryDecision = 'proceed' | 'forward' | 'withhold';

// ============================================================================
// SessionRecovery Class
// ============================================================================

export class SessionRecovery {
  private config: SessionRecoveryConfig;
  private deps: SessionRecoveryDeps;
  private recoveryAttempts: Map<string, RecoveryAttempt> = new Map();
  /** Durable memory that the existing context detector matched for a topic.
   * The timestamp supplies the bounded-deferral ceiling; the optional probe is
   * the prior observation used to prove transcript growth. */
  private contextWedgedSeen = new Map<string, {
    firstSeenAt: number;
    transcript?: TranscriptProbe;
  }>();

  constructor(config: Partial<SessionRecoveryConfig>, deps: SessionRecoveryDeps) {
    this.config = {
      enabled: config.enabled ?? true,
      maxAttempts: config.maxAttempts ?? 3,
      cooldownMs: config.cooldownMs ?? 15 * 60 * 1000,
      contextExhaustionDeferralCeilingMs:
        config.contextExhaustionDeferralCeilingMs ?? 30 * 60 * 1000,
    };
    this.deps = deps;
    this.loadState();
  }

  private emit(name: string, payload: Record<string, unknown>): void {
    try { this.deps.onEvent?.(name, payload); } catch { /* @silent-fallback-ok — an event listener never endangers recovery */ }
  }

  /**
   * Check a session for mechanical failures and attempt recovery.
   * Should be called from the session monitor before any model triage.
   *
   * @returns RecoveryResult — if recovered is true, caller should skip model triage
   */
  async checkAndRecover(
    topicId: number | string,
    sessionName: string,
  ): Promise<RecoveryResult> {
    if (!this.config.enabled) {
      return { recovered: false, failureType: null, message: 'Recovery disabled' };
    }

    // ── Part D: double-dispatch recovery gate (ownership-follows-live-work) ──────
    // BEFORE any recovery sub-path respawns/re-injects, consult per-topic ownership.
    // A `forward`/`withhold` decision means another machine owns this topic (or its
    // owner is briefly unreachable) — re-running here would double-dispatch the same
    // inbound. Strict no-op when the flag is OFF / deps absent (legacy behavior).
    const ownershipDecision = this.decideOwnershipForRecovery(topicId);
    if (ownershipDecision === 'forward') {
      // Reachable peer owns the topic: do NOT recover locally — forward the topic's
      // pending inbound through the route (which re-resolves the live owner at
      // dispatch). No pending inbound ⇒ nothing to serve; the leftover idle session
      // is converged by the existing reaper/reconciler.
      let forwarded = 0;
      let nonePending = true;
      try {
        const r = await this.deps.forwardPendingInboundViaRoute?.(topicId);
        if (r) { forwarded = r.forwarded; nonePending = r.nonePending; }
      } catch { /* @silent-fallback-ok — forward is best-effort; the route's own ledger owns delivery + exactly-once */ }
      return {
        recovered: false,
        failureType: null,
        message: nonePending
          ? `Recovery skipped — topic ${topicId} owned by a reachable peer and no pending inbound to forward`
          : `Recovery forwarded — topic ${topicId} owned by a reachable peer; ${forwarded} pending inbound routed to the owner`,
      };
    }
    if (ownershipDecision === 'withhold') {
      // Unreachable peer owns the topic (incl. reachability-throw): WITHHOLD the
      // local re-run. The message is NOT lost — it rides the existing durable inbound
      // queue / forward path; if the owner stays dark the ownership reconciler +
      // failover (force-claim on death evidence) eventually move ownership.
      return {
        recovered: false,
        failureType: null,
        message: `Recovery withheld — topic ${topicId} owned by an unreachable peer; the message rides the durable inbound queue (not re-run locally to avoid double-dispatch)`,
      };
    }
    // ownershipDecision === 'proceed' → fall through to today's recovery logic.

    const processAlive = this.deps.isSessionAlive(sessionName);

    // 1. Check for context exhaustion (process alive but conversation too long)
    // This runs FIRST and doesn't need JSONL — it scans terminal output directly.
    // A session at the "conversation too long" prompt is alive and not stalled,
    // it just can't accept any more input without hitting the same error.
    if (processAlive && this.deps.captureSessionOutput && this.deps.detectContextExhaustion) {
      const tmuxOutput = this.deps.captureSessionOutput(sessionName, 50);
      let matchedPattern: string | null = null;
      if (tmuxOutput) {
        const contextCheck = this.deps.detectContextExhaustion(tmuxOutput);
        if (contextCheck.matched) {
          this.markContextWedgedSeen(topicId);
          matchedPattern = contextCheck.pattern;
        }
      }
      if (matchedPattern || this.hasContextWedgedSeen(topicId)) {
        const result = await this.recoverFromContextExhaustion(topicId, sessionName, matchedPattern);
        if (result.recovered) this.clearContextWedgedSeen(topicId);
        this.logEvent(result, topicId, sessionName);
        return result;
      }
    }

    // 2. The adapter-owned detectors (the 1.x JSONL lookup lives there). Absent ⇒
    // skip recovery rather than risk reading the wrong session's transcript.
    if (!this.deps.detectStall && !this.deps.detectErrorLoop && !this.deps.detectCrash) {
      return { recovered: false, failureType: null, message: 'No JSONL found' };
    }

    // 3. Check for stall (process alive but frozen)
    if (processAlive) {
      const stall = this.deps.detectStall?.(sessionName) ?? null;
      if (stall) {
        const result = await this.recoverFromStall(topicId, sessionName, stall);
        this.logEvent(result, topicId, sessionName);
        return result;
      }
    }

    // 4. Check for error loop (can happen with alive OR dead process)
    const errorLoop = this.deps.detectErrorLoop?.(sessionName) ?? null;
    if (errorLoop) {
      const result = await this.recoverFromErrorLoop(topicId, sessionName, errorLoop);
      this.logEvent(result, topicId, sessionName);
      return result;
    }

    // 5. Check for crash (process dead with incomplete state)
    if (!processAlive) {
      const crash = this.deps.detectCrash?.(sessionName) ?? null;
      if (crash) {
        const result = await this.recoverFromCrash(topicId, sessionName, crash);
        this.logEvent(result, topicId, sessionName);
        return result;
      }
    }

    return { recovered: false, failureType: null, message: 'No mechanical failure detected' };
  }

  /** Remember only that the unchanged detector has already matched this topic. */
  markContextWedgedSeen(topicId: number | string): void {
    if (this.contextWedgedSeen.has(String(topicId))) return;
    this.contextWedgedSeen.set(String(topicId), { firstSeenAt: this.now() });
    this.saveState();
  }

  /** Mechanical read seam for the session monitor; this makes no recovery decision. */
  hasContextWedgedSeen(topicId: number | string): boolean {
    return this.contextWedgedSeen.has(String(topicId));
  }

  /** Explicit manual-intervention seam; successful recovery uses this same clear. */
  clearContextWedgedSeen(topicId: number | string): void {
    if (!this.contextWedgedSeen.delete(String(topicId))) return;
    this.saveState();
  }

  /** First detector observation, exposed for honest status surfaces/tests. */
  getContextWedgedFirstSeenAt(topicId: number | string): number | null {
    return this.contextWedgedSeen.get(String(topicId))?.firstSeenAt ?? null;
  }

  /**
   * Part D decision logic (docs/specs/ownership-follows-live-work.md). Resolves the
   * per-topic ownership state into a recovery direction. The safe direction is
   * MIXED and named honestly per state (NOT uniformly fail-closed):
   *  - owner === self / null / released → `proceed` (re-run locally; no competing
   *    owner can double-dispatch, and NOT re-running would silently drop the recovery).
   *  - owner === reachable peer → `forward` (the owner serves it; double-dispatch avoided).
   *  - owner === unreachable peer (incl. `isOwnerReachable` THROW / indeterminate) →
   *    `withhold` (the record NAMES a peer, so the safe direction is no-double-dispatch).
   *  - `ownerOf` THROWS / registry unreadable → `proceed` — **fail-OPEN, labeled as
   *    such** + a `recovery-gate-registry-unknown` telemetry row: we have NO owner
   *    evidence at all, and a dead conversation is a worse failure than a rare
   *    double-reply. (A *persistent* registry failure degrades to the OLD
   *    double-dispatch-prone behavior — an already-broken state, not a new regression.)
   */
  private decideOwnershipForRecovery(topicId: number | string): OwnershipRecoveryDecision {
    // Flag OFF / deps absent → strict no-op (legacy behavior: always proceed).
    if (!this.deps.ownershipFollowsLiveWork || !this.deps.ownershipFollowsLiveWork()) return 'proceed';
    if (!this.deps.ownerOfTopic || !this.deps.selfMachineId) return 'proceed';

    const self = this.deps.selfMachineId();
    if (!self) return 'proceed'; // single-machine / mesh id not resolved → no peer can own it

    let owner: string | null;
    try {
      owner = this.deps.ownerOfTopic(topicId);
    } catch {
      // ownerOf THREW / registry unreadable → FAIL-OPEN (re-run locally), labeled
      // as such + measured. We have NO owner evidence (distinct from a reachability
      // throw, where the record DID name a peer). A registry read error is rare +
      // transient; a recovery path that silently does nothing on a blip is the worse
      // failure (a dead conversation). The fleet-promotion gate reads this count.
      try {
        this.deps.emitRecoveryGateTelemetry?.({
          kind: 'recovery-gate-registry-unknown',
          topicId,
          decision: 're-run-local',
          reason: 'ownerOf threw / registry unreadable — fail-open to conversation continuity',
        });
      } catch { /* @silent-fallback-ok — telemetry is observability; never affects the decision */ }
      return 'proceed';
    }

    if (owner === null) return 'proceed'; // released / never-seen → no competing owner
    if (owner === self) return 'proceed'; // we own it → re-run is correct (today's behavior)

    // owner is a PEER. Reachable → forward; unreachable / indeterminate → withhold.
    let reachable: boolean;
    try {
      reachable = this.deps.isOwnerReachable ? this.deps.isOwnerReachable(owner) : false;
    } catch {
      // isOwnerReachable THREW / indeterminate for a PEER-owned record → treat as the
      // UNREACHABLE-peer branch (withhold), NOT a local re-run: the record NAMES a
      // peer, so the safe direction is no-double-dispatch (distinct from the
      // ownerOf-throw case above where we had no owner evidence at all). Measured.
      try {
        this.deps.emitRecoveryGateTelemetry?.({
          kind: 'recovery-gate-reachability-unknown',
          topicId,
          decision: 'withhold',
          reason: 'isOwnerReachable threw / indeterminate for a peer-owned record — withhold (record names a peer)',
        });
      } catch { /* @silent-fallback-ok — telemetry is observability; never affects the decision */ }
      return 'withhold';
    }
    return reachable ? 'forward' : 'withhold';
  }

  /**
   * Log a recovery event to the host's event sink for observability.
   */
  logEvent(result: RecoveryResult, topicId: number | string, sessionName: string): void {
    const entry: RecoveryEvent = {
      timestamp: this.now(),
      failureType: result.failureType,
      recovered: result.recovered,
      topicId,
      sessionName,
      attempt: result.attemptNumber ?? 1,
    };
    try {
      this.deps.logEvent?.(entry);
    } catch { // @silent-fallback-ok — event logging is best-effort observability
      // Can't write — skip
    }
  }

  /**
   * Aggregate recovery stats from recorded events since a given timestamp.
   */
  static getStats(events: readonly RecoveryEvent[], sinceMs: number): {
    attempts: { stall: number; crash: number; errorLoop: number; contextExhaustion: number };
    successes: { stall: number; crash: number; errorLoop: number; contextExhaustion: number };
  } {
    const stats = {
      attempts: { stall: 0, crash: 0, errorLoop: 0, contextExhaustion: 0 },
      successes: { stall: 0, crash: 0, errorLoop: 0, contextExhaustion: 0 },
    };

    for (const entry of events) {
      if (entry.timestamp < sinceMs) continue;

      const key = entry.failureType === 'error_loop' ? 'errorLoop'
        : entry.failureType === 'stall' ? 'stall'
        : entry.failureType === 'crash' ? 'crash'
        : entry.failureType === 'context_exhaustion' ? 'contextExhaustion'
        : null;
      if (!key) continue;

      stats.attempts[key]++;
      if (entry.recovered) stats.successes[key]++;
    }

    return stats;
  }

  // ============================================================================
  // Recovery Methods
  // ============================================================================

  /**
   * Shared kill-to-respawn entry (UNIFIED-SESSION-LIFECYCLE §P0 #8).
   *  - P1/P2 cross-check first: if the session has active child processes the
   *    session is doing real work and the "stall/crash" reading is almost
   *    certainly stale — defer this recovery attempt, let the next tick re-read.
   *  - Otherwise route through the dep's killSession (the host's exact
   *    retirement, so a bounce is not a disappearance and lands in the record).
   *
   *  @returns `'killed'` on a kill we performed; `'deferred-still-working'`
   *           when the work-check vetoed the kill.
   */
  private async killForRecovery(
    sessionName: string,
    options: { bypassChildProcessVeto?: boolean } = {},
  ): Promise<'killed' | 'deferred-still-working'> {
    if (
      !options.bypassChildProcessVeto
      && this.deps.hasActiveProcesses
      && this.deps.hasActiveProcesses(sessionName)
    ) {
      this.emit('recovery:deferred', { sessionName, reason: 'active child processes — the stall reading is unreliable while the process is producing work' });
      return 'deferred-still-working';
    }
    await this.deps.killSession(sessionName);
    return 'killed';
  }

  private async recoverFromStall(
    topicId: number | string,
    sessionName: string,
    stall: StallInfo,
  ): Promise<RecoveryResult> {
    const key = `stall:${stall.sessionUuid || sessionName}`;

    if (!this.shouldAttempt(key)) {
      return {
        recovered: false,
        failureType: 'stall',
        message: `Stall recovery exhausted or in cooldown for ${sessionName}`,
      };
    }

    const attemptNumber = this.recordAttempt(key);

    this.emit('recovery:stall', { topicId, sessionName, stall, attemptNumber });

    // Kill and respawn (stalls don't need truncation — just resume)
    if ((await this.killForRecovery(sessionName)) === 'deferred-still-working') {
      return {
        recovered: false, failureType: 'stall', attemptNumber, deferred: true,
        message: `Stall recovery deferred for ${sessionName} — work-check found active children; the JSONL "stall" reading is unreliable while the process is producing work`,
      };
    }

    await this.deps.wait(3000);

    const recoveryPrompt = this.buildStallRecoveryPrompt(stall);

    try {
      await this.deps.respawnSession(topicId, sessionName, recoveryPrompt);
      return {
        recovered: true,
        failureType: 'stall',
        attemptNumber,
        message: `Recovered from stall (${stall.lastToolName}, attempt ${attemptNumber})`,
      };
    } catch (err) { // @silent-fallback-ok — recovery code; returning recovered:false IS the degradation signal
      return {
        recovered: false,
        failureType: 'stall',
        attemptNumber,
        message: `Stall recovery respawn failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Recover from context exhaustion ("conversation too long").
   *
   * Unlike stall/crash recovery which resumes, context exhaustion means the
   * ENTIRE conversation is too large. Recovery strategy: compact in place when
   * the host can, otherwise kill the session and respawn FRESH with the
   * conversation history as the context seed.
   */
  private async recoverFromContextExhaustion(
    topicId: number | string,
    sessionName: string,
    matchedPattern: string | null,
  ): Promise<RecoveryResult> {
    const key = `context:${sessionName}`;

    if (!this.shouldAttempt(key)) {
      return {
        recovered: false,
        failureType: 'context_exhaustion',
        message: `Context exhaustion recovery exhausted or in cooldown for ${sessionName}`,
      };
    }

    // Context-wall work is measured from the session's transcript, not from
    // helper-process existence. MCP/browser/SSH children can remain alive at a
    // hard wall while the model produces nothing.
    const latch = this.contextWedgedSeen.get(String(topicId))
      ?? { firstSeenAt: this.now() };
    this.contextWedgedSeen.set(String(topicId), latch);
    const latchAgeMs = Math.max(0, this.now() - latch.firstSeenAt);
    const ceilingReached =
      latchAgeMs >= this.config.contextExhaustionDeferralCeilingMs;

    const currentProbe = this.deps.probeTranscript?.(sessionName);
    const priorProbe = latch.transcript;
    if (currentProbe) {
      latch.transcript = currentProbe;
      this.saveState();
    }
    const growth = currentProbe && priorProbe
      ? transcriptDelta(priorProbe, currentProbe)
      : 'unknown';

    // With the production transcript seam, only positive transcript growth
    // proves work. The first/unresolved observation defers safely, but spends
    // ZERO recovery attempts. The durable ceiling prevents ambiguity from
    // becoming an infinite wait. Legacy callers without the seam retain their
    // old child-process check until they are upgraded.
    const legacyBusyWithoutProbe =
      !this.deps.probeTranscript
      && (this.deps.hasActiveProcesses?.(sessionName) ?? false);
    if (!ceilingReached && (growth === 'grew' || growth === 'unknown' && (
      this.deps.probeTranscript !== undefined || legacyBusyWithoutProbe
    ))) {
      return {
        recovered: false,
        failureType: 'context_exhaustion',
        deferred: true,
        message: growth === 'grew'
          ? `Context-exhaustion recovery deferred for ${sessionName} — its transcript is still growing`
          : `Context-exhaustion recovery deferred for ${sessionName} — waiting for a second transcript observation`,
      };
    }

    // A deferral is not an attempt. Count only after the evidence gate has
    // authorized an actual compaction/kill recovery action.
    const attemptNumber = this.recordAttempt(key);

    this.emit('recovery:context_exhaustion', {
      topicId,
      sessionName,
      matchedPattern,
      attemptNumber,
      latchAgeMs,
      ceilingReached,
      transcriptGrowth: growth,
    });

    // ── Rung 1: non-destructive compaction (preserves the conversation) ──
    // Before killing the session and losing the conversation, try the escalation
    // the wall itself asks for. If compaction clears the wall the conversation
    // survives; if it fails (too long to even compact) or times out, we fall
    // through to the destructive fresh respawn — never worse than the prior behavior.
    if (this.deps.attemptCompaction) {
      try {
        const compaction = await this.deps.attemptCompaction(sessionName, topicId);
        if (compaction.cleared) {
          this.emit('recovery:context_compacted', { topicId, sessionName, attemptNumber });
          return {
            recovered: true,
            failureType: 'context_exhaustion',
            attemptNumber,
            message: `Recovered via compaction — conversation preserved${matchedPattern ? ` (pattern: "${matchedPattern}", attempt ${attemptNumber})` : ` (attempt ${attemptNumber})`}`,
          };
        }
        // compaction.cleared === false → fall through to the destructive respawn.
      } catch {
        // @silent-fallback-ok — compaction is best-effort; fall through to respawn.
      }
    }

    // Record detection moment so the host's send receipts can identify any
    // in-flight agent reply that lands AFTER this point.
    const detectedAt = this.now();

    // ── Rung 2: kill + fresh respawn (conversation lost) ──
    // Reached only when compaction was unavailable, declined, or could not clear
    // the wall. The session is stuck at the "conversation too long" prompt and a
    // fresh start is the only remaining recovery.
    if ((await this.killForRecovery(sessionName, {
      // Transcript evidence already made the context-wall decision. A helper
      // process must not re-veto it here.
      bypassChildProcessVeto: this.deps.probeTranscript !== undefined || ceilingReached,
    })) === 'deferred-still-working') {
      return {
        recovered: false, failureType: 'context_exhaustion', attemptNumber, deferred: true,
        message: `Context-exhaustion recovery deferred for ${sessionName} — work-check found active children`,
      };
    }

    // The exact reply the dying session already sent, from the host's durable send
    // receipts (never an arbitrary poll), so the fresh session does not repeat it.
    const inFlightReply = await this.waitForInFlightReply(topicId, detectedAt);

    const baseRecoveryPrompt =
      `[RECOVERY] Your previous session hit the context window limit — the conversation became too long ` +
      `for the model to process. The session was killed and restarted FRESH with thread history. ` +
      `You are NOT resuming the old conversation — this is a clean start with the recent message history ` +
      `loaded as context. Continue helping the user from where the conversation left off.`;

    const recoveryPrompt = sanitizeForPrompt(
      inFlightReply
        ? `${baseRecoveryPrompt}\n\n` +
          `IMPORTANT: Your previous session had ALREADY SENT this reply to the user before it was restarted — ` +
          `do NOT repeat any part of it. Acknowledge the restart to the user, then continue from where the reply left off:\n\n` +
          `<previous_reply>\n${inFlightReply}\n</previous_reply>`
        : baseRecoveryPrompt
    );

    // Use respawnSessionFresh if available (no --resume), otherwise fall back to normal respawn
    const respawnFn = this.deps.respawnSessionFresh || this.deps.respawnSession;

    try {
      await respawnFn(topicId, sessionName, recoveryPrompt);
      return {
        recovered: true,
        failureType: 'context_exhaustion',
        attemptNumber,
        message: inFlightReply
          ? `Recovered from context exhaustion with in-flight reply captured (pattern: "${matchedPattern}", attempt ${attemptNumber}) — fresh session knows what was already sent`
          : `Recovered from context exhaustion (pattern: "${matchedPattern}", attempt ${attemptNumber}) — fresh session spawned`,
      };
    } catch (err) { // @silent-fallback-ok — recovery code; returning recovered:false IS the degradation signal
      return {
        recovered: false,
        failureType: 'context_exhaustion',
        attemptNumber,
        message: `Context exhaustion recovery respawn failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * After a context-exhausted session is killed, an in-flight reply it was
   * generating may already have been sent. The host's durable send intent and
   * receipt records answer this exactly; the 1.x 7-second poll of topic history
   * at 500 ms is not carried, because an elapsed sleep cannot establish that no
   * duplicate send happened (Rules 1/26/63).
   *
   * Purpose: pass the captured reply into the recovery prompt so the fresh
   * session does not re-answer a question the dying session already answered.
   */
  private async waitForInFlightReply(topicId: number | string, detectedAt: number): Promise<string | null> {
    if (!this.deps.inFlightReply) {
      // No send-receipt source — keep the legacy 3s settle so the kill lands
      // before the fresh respawn; no reply is assumed either way.
      await this.deps.wait(3000);
      return null;
    }
    try {
      const text = await this.deps.inFlightReply(topicId, detectedAt);
      return text && text.trim().length > 0 ? text : null;
    } catch { return null; /* best effort — the host's own uncertainty handling owns an unreadable receipt */ }
  }

  private async recoverFromCrash(
    topicId: number | string,
    sessionName: string,
    crash: CrashInfo,
  ): Promise<RecoveryResult> {
    const key = `crash:${crash.sessionUuid || sessionName}`;

    if (!this.shouldAttempt(key)) {
      return {
        recovered: false,
        failureType: 'crash',
        message: `Crash recovery exhausted or in cooldown for ${sessionName}`,
      };
    }

    const attemptNumber = this.recordAttempt(key);
    const strategy = this.pickTruncationStrategy(attemptNumber);

    this.emit('recovery:crash', { topicId, sessionName, crash, attemptNumber, strategy });

    // Rewind only through a host port that actually performs one; the core never rewinds.
    let rewound = false;
    if (this.deps.truncate) {
      try {
        this.deps.truncate(sessionName, strategy, strategy === 'n_exchanges_back' ? 3 : undefined);
        rewound = true;
      } catch (err) { // @silent-fallback-ok — recovery code; returning recovered:false IS the degradation signal
        return {
          recovered: false,
          failureType: 'crash',
          strategy,
          attemptNumber,
          message: `JSONL truncation failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // Kill (might already be dead) and respawn
    if ((await this.killForRecovery(sessionName)) === 'deferred-still-working') {
      return {
        recovered: false, failureType: 'crash', attemptNumber, deferred: true,
        message: `Crash recovery deferred for ${sessionName} — work-check found active children (the JSONL "crashed" reading conflicts with a running process)`,
      };
    }
    await this.deps.wait(3000);

    const recoveryPrompt = this.buildCrashRecoveryPrompt(crash, strategy, rewound);

    try {
      await this.deps.respawnSession(topicId, sessionName, recoveryPrompt);
      return {
        recovered: true,
        failureType: 'crash',
        strategy,
        attemptNumber,
        message: `Recovered from crash (${strategy}, attempt ${attemptNumber})`,
      };
    } catch (err) { // @silent-fallback-ok — recovery code; returning recovered:false IS the degradation signal
      return {
        recovered: false,
        failureType: 'crash',
        strategy,
        attemptNumber,
        message: `Crash recovery respawn failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private async recoverFromErrorLoop(
    topicId: number | string,
    sessionName: string,
    loop: ErrorLoopInfo,
  ): Promise<RecoveryResult> {
    const key = `loop:${loop.sessionUuid || sessionName}`;

    if (!this.shouldAttempt(key)) {
      return {
        recovered: false,
        failureType: 'error_loop',
        message: `Error loop recovery exhausted or in cooldown for ${sessionName}`,
      };
    }

    const attemptNumber = this.recordAttempt(key);
    // Error loops need more aggressive truncation
    const strategy: TruncationStrategy = attemptNumber <= 1 ? 'last_exchange' : 'last_successful_tool';

    this.emit('recovery:error_loop', { topicId, sessionName, loop, attemptNumber, strategy });

    let rewound = false;
    if (this.deps.truncate) {
      try {
        this.deps.truncate(sessionName, strategy);
        rewound = true;
      } catch (err) { // @silent-fallback-ok — recovery code; returning recovered:false IS the degradation signal
        return {
          recovered: false,
          failureType: 'error_loop',
          strategy,
          attemptNumber,
          message: `JSONL truncation failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // Kill and respawn
    if ((await this.killForRecovery(sessionName)) === 'deferred-still-working') {
      return {
        recovered: false, failureType: 'error_loop', attemptNumber, deferred: true,
        message: `Error-loop recovery deferred for ${sessionName} — work-check found active children`,
      };
    }
    await this.deps.wait(3000);

    const recoveryPrompt = this.buildErrorLoopRecoveryPrompt(loop, strategy, rewound);

    try {
      await this.deps.respawnSession(topicId, sessionName, recoveryPrompt);
      return {
        recovered: true,
        failureType: 'error_loop',
        strategy,
        attemptNumber,
        message: `Recovered from error loop (${loop.loopCount}x "${loop.failingPattern.slice(0, 50)}", attempt ${attemptNumber})`,
      };
    } catch (err) { // @silent-fallback-ok — recovery code; returning recovered:false IS the degradation signal
      return {
        recovered: false,
        failureType: 'error_loop',
        strategy,
        attemptNumber,
        message: `Error loop recovery respawn failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ============================================================================
  // Recovery Prompt Builders
  // ============================================================================

  private buildStallRecoveryPrompt(stall: StallInfo): string {
    return sanitizeForPrompt(
      `[RECOVERY] Your previous session stalled while running tool "${stall.lastToolName}" ` +
      `(stalled for ${Math.round(stall.stallDurationMs / 1000)}s). ` +
      `The session was automatically restarted. ` +
      `Continue where you left off — the tool call that stalled has been discarded.`
    );
  }

  private buildCrashRecoveryPrompt(crash: CrashInfo, strategy: TruncationStrategy, rewound: boolean): string {
    const errorDetail = crash.errorMessage
      ? ` Error: "${crash.errorMessage.slice(0, 200)}"`
      : crash.lastToolName
        ? ` Last tool: "${crash.lastToolName}"`
        : '';
    return sanitizeForPrompt(
      `[RECOVERY] Your previous session crashed (${crash.errorType}).${errorDetail} ` +
      (rewound
        ? `The conversation was rewound using strategy "${strategy}" and the session was restarted. ` +
          `Some recent messages may be missing. `
        : `The session was restarted without rewinding the conversation. `) +
      `Continue where you left off — avoid repeating ` +
      `the action that caused the crash.`
    );
  }

  private buildErrorLoopRecoveryPrompt(loop: ErrorLoopInfo, strategy: TruncationStrategy, rewound: boolean): string {
    return sanitizeForPrompt(
      `[RECOVERY] Your previous session was stuck in an error loop — ` +
      `the same error repeated ${loop.loopCount} times: "${loop.failingPattern.slice(0, 100)}". ` +
      (loop.failingCommand ? `Failing command: "${loop.failingCommand.slice(0, 100)}". ` : '') +
      (rewound
        ? `The conversation was rewound using strategy "${strategy}" and the session was restarted. `
        : `The session was restarted without rewinding the conversation. `) +
      `Try a DIFFERENT approach — the previous one kept failing.`
    );
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private pickTruncationStrategy(attemptNumber: number): TruncationStrategy {
    if (attemptNumber <= 1) return 'last_exchange';
    if (attemptNumber <= 2) return 'last_successful_tool';
    return 'n_exchanges_back';
  }

  private shouldAttempt(key: string): boolean {
    const prior = this.recoveryAttempts.get(key);
    if (!prior) return true;
    if (this.now() - prior.lastAttempt < this.config.cooldownMs) return false;
    if (prior.count >= this.config.maxAttempts) return false;
    return true;
  }

  private recordAttempt(key: string): number {
    const prior = this.recoveryAttempts.get(key);
    const count = (prior?.count || 0) + 1;
    this.recoveryAttempts.set(key, { lastAttempt: this.now(), count });
    this.saveState();
    return count;
  }

  /**
   * Load recovery state from the host store. Prevents infinite kill-respawn loops
   * across host restarts by preserving attempt counts and cooldowns.
   */
  private loadState(): void {
    const data = this.deps.store.load();
    if (!data) return;
    if (data.attempts && typeof data.attempts === 'object') {
      for (const [key, value] of Object.entries(data.attempts)) {
        const attempt = value as RecoveryAttempt;
        if (attempt.lastAttempt && attempt.count) {
          this.recoveryAttempts.set(key, attempt);
        }
      }
    }
    if (data.wedgedSeen && typeof data.wedgedSeen === 'object') {
      for (const [topic, seen] of Object.entries(data.wedgedSeen)) {
        if (seen && typeof seen === 'object') {
          const row = seen as { firstSeenAt?: unknown; transcript?: unknown };
          const firstSeenAt = Number(row.firstSeenAt);
          if (!Number.isFinite(firstSeenAt) || firstSeenAt <= 0) continue;
          const transcript = isTranscriptProbe(row.transcript)
            ? row.transcript
            : undefined;
          this.contextWedgedSeen.set(topic, transcript ? { firstSeenAt, transcript } : { firstSeenAt });
        }
      }
    }
  }

  /**
   * Persist recovery state so it survives host restarts.
   */
  private saveState(): void {
    try {
      const data: Record<string, RecoveryAttempt> = {};
      // Only persist entries less than 1 hour old
      const ONE_HOUR = 60 * 60 * 1000;
      for (const [key, entry] of Array.from(this.recoveryAttempts.entries())) {
        if (this.now() - entry.lastAttempt < ONE_HOUR) {
          data[key] = entry;
        }
      }

      const wedgedSeen: WorkerRecoveryState['wedgedSeen'] = {};
      for (const [topicId, state] of this.contextWedgedSeen) {
        wedgedSeen[topicId] = state;
      }
      this.deps.store.save({ attempts: data, wedgedSeen });
    } catch { // @silent-fallback-ok — state persistence is best-effort; in-memory state still works
      // Can't save — in-memory state still works for this process lifetime
    }
  }

  private now(): number {
    return this.deps.now();
  }

  /**
   * Clean up old recovery tracking entries. (The 1.x `.bak` transcript cleanup is
   * not carried: no transcript backups are made because no transcript is rewound.)
   */
  cleanup(): void {
    const ONE_HOUR = 60 * 60 * 1000;
    for (const [key, entry] of Array.from(this.recoveryAttempts.entries())) {
      if (this.now() - entry.lastAttempt > ONE_HOUR) {
        this.recoveryAttempts.delete(key);
      }
    }
  }
}

// ============================================================================
// Standalone Utilities
// ============================================================================

/**
 * Sanitize text for injection into a recovery prompt.
 * Strips control characters, Unicode directional overrides, and truncates.
 */
export function sanitizeForPrompt(text: string, maxLength: number = 2000): string {
  return text
    // Strip Unicode directional overrides and invisible characters (CVE-class attack vector)
    .replace(/[​-‏‪-‮⁠-⁩﻿]/g, '')
    // Strip ASCII control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize Unicode to NFC
    .normalize('NFC')
    // Truncate
    .slice(0, maxLength);
}
