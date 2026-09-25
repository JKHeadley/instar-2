/**
 * Context sentinel — the 2.0 port of 1.x CompactionSentinel + ContextWedgeSentinel,
 * reduced to one pure decision over observations.
 *
 * What it guarantees, and how:
 *  - Fresh grounding: when the topic's current grounding differs from the file the
 *    session hook will inject, rewrite the file (cheap, idempotent, always safe).
 *  - Verified re-grounding: a compaction or a (re)spawn opens an episode. The episode
 *    closes only on the owning session's consumption evidence for the matching
 *    reset generation and digest. A hook receipt alone proves only emission.
 *    With no receipt after a grace window, the sentinel asks for ONE bounded re-ground
 *    delivery into an idle session (deferred while it is busy), verified by
 *    owner evidence for that exact operation. Attempts are capped.
 *  - Context wall: an idle pane stuck on "conversation too long" / a thinking-block wedge
 *    is handed to the session driver's own recovery (compact first, fresh respawn second),
 *    at most `maxRecoveries` per unresolved episode, paced by cooldown.
 *  - Everything else (rate limits, policy wedges, a dead session) is signal-only; crash
 *    handling and failure notices belong to port-sentinels.
 *
 * Every action carries a deterministic operation id, so a crash between recording and
 * performing an action can never produce a second, different send for the same attempt.
 * `stopped` suppresses every action.
 */

export type StuckSignature = 'context-too-long' | 'context-wedge' | 'rate-limited' | 'policy-wedge' | null;
export interface GroundedReceipt { readonly at: number; readonly source: string; readonly digest: string; readonly resetId?: string; readonly sessionId?: string | null }
export interface ResetReceipt { readonly at: number; readonly source: string; readonly id: string; readonly sessionId?: string | null }
export interface DeliveryReceipt { readonly at: number; readonly operation: string; readonly lastInboundMessageId: string | null; readonly sessionId?: string | null }
export interface SessionObservation {
  readonly session: string;
  readonly sessionId?: string | null;
  readonly topic: string;
  readonly alive: boolean;
  /** When this session incarnation started — a new incarnation is a respawn. */
  readonly startedAt: number;
  readonly pane: 'idle' | 'busy' | 'unknown';
  readonly stuck: StuckSignature;
  readonly compactions: readonly number[];
  readonly grounded: readonly GroundedReceipt[];
  /** Written by the session owner after it consumes hook output, never by the hook. */
  readonly contextConsumed?: readonly GroundedReceipt[];
  readonly resets?: readonly ResetReceipt[];
  readonly deliveriesConsumed?: readonly DeliveryReceipt[];
  readonly turnsClosed: readonly number[];
}
export interface TopicGroundingStatus {
  readonly topic: string;
  /** Digest of the grounding as it should be now. */
  readonly current: string;
  /** Digest of the grounding file the hook would inject (null: no file yet). */
  readonly file: string | null;
  readonly lastInboundMessageId?: string | null;
}
export type EpisodeKind = 'compact' | 'respawn' | 'clear' | 'resume' | 'context-wall';
export type EpisodeStatus = 'awaiting-receipt' | 'deferring' | 'verifying' | 'recovered' | 'failed' | 'session-gone';
export interface Episode {
  readonly kind: EpisodeKind;
  readonly openedAt: number;
  readonly status: EpisodeStatus;
  readonly attempts: number;
  readonly lastAttemptAt: number | null;
  readonly closedAt: number | null;
  readonly generation?: string;
  readonly expectedDigest?: string;
  readonly sessionId?: string | null;
  readonly lastInboundMessageId?: string | null;
  readonly lastOperation?: string;
}
export interface SessionState {
  readonly session: string;
  readonly topic: string;
  readonly startedAt: number;
  readonly episode: Episode | null;
  readonly recoveries: readonly number[];
  readonly lastSignal: string | null;
}
export interface SentinelState { readonly sessions: readonly SessionState[] }
export type SentinelAction =
  | Readonly<{ kind: 'write-grounding'; topic: string }>
  | Readonly<{ kind: 'reground'; session: string; topic: string; operation: string }>
  | Readonly<{ kind: 'recover-context'; session: string; operation: string }>
  | Readonly<{ kind: 'signal'; session: string; topic: string; event: SentinelEvent; detail: string }>;
export type SentinelEvent = 'grounding-verified' | 'reground-requested' | 'reground-exhausted' | 'context-wall'
  | 'recovery-exhausted' | 'stuck' | 'session-gone' | 'recovered-after-reground';
export interface SentinelConfig {
  readonly graceMs: number;
  readonly verifyMs: number;
  readonly maxRegrounds: number;
  readonly recoveryCooldownMs: number;
  readonly maxRecoveries: number;
  readonly maxActionsPerTick: number;
  /** Receipts from two hooks racing at the same SessionStart may be a few ms out of order. */
  readonly receiptSkewMs: number;
  /** An incarnation first observed older than this is adopted, not treated as a fresh respawn. */
  readonly respawnWindowMs: number;
}
export const defaultSentinelConfig: SentinelConfig = Object.freeze({
  graceMs: 60_000, verifyMs: 180_000, maxRegrounds: 2, recoveryCooldownMs: 600_000, maxRecoveries: 2, maxActionsPerTick: 4,
  receiptSkewMs: 10_000, respawnWindowMs: 1_800_000,
});

const open = (status: EpisodeStatus) => status === 'awaiting-receipt' || status === 'deferring' || status === 'verifying';

export function decideContext(input: Readonly<{
  now: number; stopped: boolean; state: SentinelState; observations: readonly SessionObservation[];
  groundings: readonly TopicGroundingStatus[]; config?: Partial<SentinelConfig>;
}>): Readonly<{ state: SentinelState; actions: readonly SentinelAction[] }> {
  const config = { ...defaultSentinelConfig, ...input.config };
  const actions: SentinelAction[] = [];
  let budget = input.stopped ? 0 : config.maxActionsPerTick;
  let writeBudget = input.stopped ? 0 : config.maxActionsPerTick;
  const act = (action: SentinelAction): boolean => {
    if (action.kind === 'signal') { actions.push(action); return true; }
    if (action.kind === 'write-grounding') { if (writeBudget <= 0) return false; writeBudget--; actions.push(action); return true; }
    if (budget <= 0) return false;
    budget--; actions.push(action); return true;
  };
  // Freshness first: the file is what every future SessionStart injects.
  for (const row of input.groundings) if (row.current !== row.file) act({ kind: 'write-grounding', topic: row.topic });

  const prior = new Map(input.state.sessions.map(row => [row.session, row]));
  const next: SessionState[] = [];
  for (const seen of input.observations) {
    const was = prior.get(seen.session);
    const inherited = input.state.sessions.find(old => old.topic === seen.topic && old.session !== seen.session && old.recoveries.length);
    let row: SessionState = was && was.startedAt === seen.startedAt ? was
      : { session: seen.session, topic: seen.topic, startedAt: seen.startedAt, episode: null,
        recoveries: was?.recoveries ?? inherited?.recoveries ?? [], lastSignal: null };
    const signal = (event: SentinelEvent, detail: string) => {
      const key = `${event}:${row.episode?.openedAt ?? row.startedAt}:${row.episode?.attempts ?? 0}`;
      if (row.lastSignal === key) return;
      act({ kind: 'signal', session: seen.session, topic: seen.topic, event, detail });
      row = { ...row, lastSignal: key };
    };
    const setEpisode = (episode: Episode) => { row = { ...row, episode }; };
    const closeEpisode = (status: EpisodeStatus) => {
      if (row.episode) setEpisode({ ...row.episode, status, closedAt: input.now });
    };

    if (!seen.alive) {
      if (row.episode && open(row.episode.status)) { closeEpisode('session-gone'); signal('session-gone', 'session exited during a context episode'); }
      next.push(row); continue;
    }

    const current = input.groundings.find(g => g.topic === seen.topic);
    const lastReset = [...(seen.resets ?? [])].filter(r => r.at >= seen.startedAt
      && (seen.sessionId == null || r.sessionId == null || r.sessionId === seen.sessionId))
      .sort((a, b) => b.at - a.at)[0];
    const lastCompaction = seen.compactions.filter(at => at >= seen.startedAt
      && !(seen.resets ?? []).some(r => r.source === 'compact' && Math.abs(r.at - at) <= config.receiptSkewMs))
      .reduce((a, b) => Math.max(a, b), -Infinity);
    const episodeFor = (kind: EpisodeKind, openedAt: number, generation?: string, sessionId?: string | null): Episode => ({
      kind, openedAt, status: 'awaiting-receipt', attempts: 0, lastAttemptAt: null, closedAt: null,
      ...(generation ? { generation } : {}), ...((sessionId ?? seen.sessionId) !== undefined ? { sessionId: sessionId ?? seen.sessionId } : {}),
      ...(current ? { expectedDigest: current.current, lastInboundMessageId: current.lastInboundMessageId ?? null } : {}),
    });
    if (!row.episode) {
      const fresh = input.now - seen.startedAt <= config.respawnWindowMs;
      setEpisode({ ...episodeFor('respawn', seen.startedAt), status: fresh ? 'awaiting-receipt' : 'recovered', closedAt: fresh ? null : input.now });
    }
    if (lastReset && (lastReset.at > row.episode!.openedAt || lastReset.id !== row.episode!.generation
      && lastReset.at === row.episode!.openedAt))
      setEpisode(episodeFor(lastReset.source === 'compact' ? 'compact' : lastReset.source === 'clear' ? 'clear'
        : lastReset.source === 'resume' ? 'resume' : 'respawn', lastReset.at, lastReset.id, lastReset.sessionId));
    if (lastCompaction > row.episode!.openedAt)
      setEpisode(episodeFor('compact', lastCompaction));

    const episode = row.episode!;
    if (open(episode.status)) {
      const source = episode.kind === 'respawn' ? 'startup' : episode.kind;
      const receipt = (seen.contextConsumed ?? []).find(g => g.digest === episode.expectedDigest && g.source === source
        && (!episode.generation ? g.at >= episode.openedAt : g.resetId === episode.generation)
        && (episode.sessionId == null || g.sessionId === episode.sessionId));
      const processed = episode.lastOperation && (seen.deliveriesConsumed ?? []).some(d => d.operation === episode.lastOperation
        && d.at >= episode.openedAt && d.lastInboundMessageId === (episode.lastInboundMessageId ?? null)
        && (episode.sessionId == null || d.sessionId === episode.sessionId));
      if (receipt) {
        closeEpisode('recovered'); row = { ...row, recoveries: [] };
        signal('grounding-verified', `${episode.kind}: session owner consumed ${receipt.digest} (${receipt.source})`);
      } else if (processed) {
        closeEpisode('recovered'); row = { ...row, recoveries: [] };
        signal('recovered-after-reground', `${episode.kind}: session owner confirmed the specific delivery`);
      } else if (input.now - episode.openedAt >= config.graceMs
        && (episode.lastAttemptAt === null || input.now - episode.lastAttemptAt >= config.verifyMs)) {
        if (episode.attempts >= config.maxRegrounds) {
          closeEpisode('failed'); signal('reground-exhausted', `${episode.kind}: no grounding receipt after ${episode.attempts} re-ground(s)`);
        } else if (seen.pane !== 'idle' || seen.stuck) {
          if (episode.status !== 'deferring') setEpisode({ ...episode, status: 'deferring' });
        } else {
          const attempt = episode.attempts + 1;
          // Retry the same owner-deduped operation after uncertainty; a fresh reset gets a fresh generation.
          const operation = `awareness-reground:${seen.session}:${episode.kind}:${episode.generation ?? episode.openedAt}`;
          if (act({ kind: 'reground', session: seen.session, topic: seen.topic, operation })) {
            setEpisode({ ...episode, status: 'verifying', attempts: attempt, lastAttemptAt: input.now, lastOperation: operation });
            signal('reground-requested', `${episode.kind}: no grounding receipt; re-ground attempt ${attempt}`);
          }
        }
      }
    }

    // Context wall: hand an idle, walled session to the driver's own bounded recovery.
    if (seen.stuck === 'context-too-long' || seen.stuck === 'context-wedge') {
      const attempts = row.recoveries;
      if (seen.pane === 'idle' && attempts.length < config.maxRecoveries
        && (attempts.length === 0 || input.now - attempts[attempts.length - 1]! >= config.recoveryCooldownMs)) {
        const operation = `awareness-recover:${seen.session}:${attempts.length + 1}:${input.now}`;
        if (act({ kind: 'recover-context', session: seen.session, operation })) {
          row = { ...row, recoveries: [...attempts, input.now] };
          signal('context-wall', `${seen.stuck}: requested driver context recovery`);
        }
      } else if (attempts.length >= config.maxRecoveries) {
        signal('recovery-exhausted', `${seen.stuck}: ${attempts.length} recoveries without verified recovery`);
      }
    } else if (seen.stuck) {
      signal('stuck', `${seen.stuck}: signal only`);
    }
    next.push(row);
  }
  // Sessions no longer observed are retained only while they hold an open episode (bounded state).
  for (const row of input.state.sessions)
    if (!next.some(n => n.session === row.session) && row.episode && open(row.episode.status)) next.push(row);
  return Object.freeze({ state: Object.freeze({ sessions: next }), actions });
}
