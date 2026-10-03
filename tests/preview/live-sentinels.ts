/** The live runner's sentinel tick (Part 18; plan #402): the context/compaction sentinel (src/awareness/sentinel.ts),
 * the presence sentinel and the promise sentinel (src/sentinels/), each observing the durable journal and nothing else.
 *
 * Each family runs on the runner's existing cycle. A tick that changes a family's decision state appends ONE
 * `sentinel` journal row (its whole new state and its events) BEFORE any effect is requested, so a crash can lose
 * an attempt, never repeat one, and the status surfaces read every decision back from the journal. Effects are the
 * runner's own bounded steps (an ordinary pass, a summary pass, an obligation step); the sentinels hold no send path
 * of their own. A family whose observation or record fails does nothing that tick (silence), and the failure is
 * counted for status. Each family has an off-switch: a disabled family is not observed and records nothing.
 *
 * How the one-shot runner maps onto the context sentinel: the runner holds no long-lived model session, so its one
 * "session" is the journal's conversation context for this launch (a launch is a respawn). Every model call builds
 * its packet from the journal, so the grounding "file" is current by construction and the sentinel never rewrites
 * one. A compaction is a recorded summary moving the frontier past verbatim history. The owner's consumption
 * evidence is an answered call whose recorded packet carried the current summary frontier. A re-ground is an
 * ordinary pass that builds a fresh packet for the open message; a context wall (input too long for its context) is
 * handed to the summary pass, the runner's own compaction. */
import { createHash } from 'node:crypto';
import { decideContext, type GroundedReceipt, type SentinelConfig, type SessionObservation, type StuckSignature } from '../../src/awareness/sentinel.js';
import { decidePresence, type PresenceCause, type PresenceConfig, type PresenceTurn } from '../../src/sentinels/presence.js';
import { decidePromises, type PromiseConfig, type PromiseObservation } from '../../src/sentinels/promise.js';
import { commitmentOpen, commitmentWaitsOn, liveSummaries, openRequests, PRESENCE_NOTE_HOLDS, probeTurn, verifiedOperatorTurn,
  wallEpoch, type JournalRecord, type JournalView, type Turn } from './journal.js';
import { isStopCommand } from './status-command.js';
import { SENTINEL_FAMILIES, type SentinelEventRow, type SentinelFamily, type SentinelView } from './sentinel-record.js';

export const CONTEXT_SESSION = 'journal-context';
export interface LiveSentinelPorts {
  now(): number;
  /** True while a stop or expiry holds: every family records nothing new and requests nothing. */
  stopped(): boolean;
  /** This launch's start: the context sentinel's respawn instant. */
  startedAt: number;
  /** The enabled families (the off-switch); a family not listed is never observed. */
  families: ReadonlySet<SentinelFamily>;
  /** Context re-ground: run an ordinary pass so the open message gets a packet built fresh from the journal. */
  reground(operation: string): void;
  /** Context wall: run the summary pass (the runner's own compaction). */
  recoverContext(operation: string): void;
  /** Presence self-heal: run an ordinary pass for the unanswered message. */
  selfHeal(turn: string): void;
  /** Promise follow-through: run the owner's bounded step for this promise. */
  actOnPromise(id: string): void;
  config?: { context?: Partial<SentinelConfig>; presence?: Partial<PresenceConfig>; promise?: Partial<PromiseConfig> };
}
export interface LiveSentinelReport {
  recorded: SentinelFamily[];
  effects: { family: SentinelFamily; kind: string; subject: string }[];
  failures: { family: SentinelFamily; stage: 'observe' | 'record' | 'effect'; detail: string }[];
}

const settled = (turn: Turn) => turn.intent !== undefined || turn.sent !== undefined || turn.editOf !== undefined
  || turn.held === 'superseded by edit' || turn.groupedInto !== undefined;
const operatorMessages = (view: JournalView) => view.order.filter(turn => verifiedOperatorTurn(view, turn) && !probeTurn(view, turn)
  && turn.requestedAction === undefined && !isStopCommand(turn.text));
const inFlight = (turn: Turn) => turn.reserved && turn.answer === undefined && turn.modelState === undefined;
const frontierDigest = (view: JournalView) => `summary:${liveSummaries(view).reduce<number | null>((max, item) =>
  max === null || item.through > max ? item.through : max, null) ?? 'none'}`;

/** The context sentinel's one observation of this launch's conversation context. */
export function contextObservation(view: JournalView, startedAt: number): { observation: SessionObservation; current: string; lastInbound: string | null } {
  const messages = operatorMessages(view), open = messages.filter(turn => !settled(turn) && turn.limited === undefined);
  const last = messages.at(-1);
  const stuck: StuckSignature = last?.noticeClass === 'too-long-input' ? 'context-too-long' : null;
  const consumed: GroundedReceipt[] = view.order.flatMap(turn => turn.grounding && turn.reservedAt !== undefined && turn.modelState === 'complete'
    ? (['startup', 'compact'] as const).map(source => ({ at: turn.reservedAt!, source, sessionId: null,
      digest: `summary:${turn.grounding!.summaryThrough ?? 'none'}` })) : []);
  return {
    observation: { session: CONTEXT_SESSION, sessionId: null, topic: CONTEXT_SESSION, alive: true, startedAt,
      // The worker exists only while a message is open: no open message means nothing to ground into (deferred).
      // A context wall with nothing running is idle: the summary pass disturbs no call.
      pane: open.some(inFlight) ? 'busy' : open.length || stuck ? 'idle' : 'unknown', stuck,
      compactions: liveSummaries(view).map(item => item.at), grounded: [], contextConsumed: consumed, turnsClosed: [] },
    current: frontierDigest(view), lastInbound: (open.at(-1) ?? last)?.id ?? null,
  };
}

/** Why each admitted operator message is (or is not) still unanswered. */
export function presenceTurns(view: JournalView): PresenceTurn[] {
  return operatorMessages(view).map(turn => {
    if (settled(turn)) return { id: turn.id, receivedAt: turn.at, answered: true, cause: 'unknown' as const };
    const cause: PresenceCause = turn.limited !== undefined || turn.noticeClass !== undefined || turn.heldNoticeIntent !== undefined
      || turn.heldNoticeCoveredBy !== undefined ? 'own-notice'
      : turn.modelState === 'uncertain' ? 'unknown'
        : turn.held !== undefined ? PRESENCE_NOTE_HOLDS.has(turn.held) ? 'held-check'
          : turn.held === 'memory correction pending' ? 'waiting-operator' : turn.held === 'call cap' || turn.held === 'reply cap' ? 'own-notice' : 'unknown'
          : inFlight(turn) ? 'in-flight' : 'unpicked';
    return { id: turn.id, receivedAt: turn.at, answered: false, cause };
  });
}

const requestId = (item: { source: string; quote: string; when: string }) =>
  `request:${createHash('sha256').update(JSON.stringify([item.source, item.quote, item.when])).digest('hex').slice(0, 16)}`;
/** Open promises that carry an absolute due instant: agent promises with a date, and dated operator requests. */
export function promiseObservations(view: JournalView): PromiseObservation[] {
  const found: PromiseObservation[] = [];
  view.commitments.forEach((note, id) => {
    const due = note.agentPromise?.due;
    if (!due?.day || !commitmentOpen(view, id)) return;
    const work = view.obligationWork[`commitment:${id}`];
    const definite = work && work.inFlight === undefined && work.outcome !== undefined && work.outcome !== 'uncertain' && work.outcome !== 'failed';
    found.push({ id: `commitment:${id}`, owner: note.owner ?? 'agent', dueAt: wallEpoch(due.day, due.time ?? '09:00', due.zone),
      actedAt: definite ? work.last : null, waitsOn: commitmentWaitsOn(view, id) ?? 'undeclared' });
  });
  for (const item of openRequests(view)) if (item.day)
    found.push({ id: requestId(item), owner: 'agent', dueAt: wallEpoch(item.day, item.time ?? '09:00', item.zone), actedAt: null, waitsOn: 'date' });
  return found;
}

const clip = (text: string) => Buffer.byteLength(text) <= 480 ? text : `${Buffer.from(text).subarray(0, 477).toString('utf8').replace(/�+$/u, '')}…`;

export function createLiveSentinels(journal: { readonly view: JournalView; append(row: JournalRecord): void }, ports: LiveSentinelPorts) {
  const failures = { context: 0, presence: 0, promise: 0 } as Record<SentinelFamily, number>;
  const stopped = () => ports.stopped() || journal.view.stop !== null || ports.now() >= journal.view.expires;
  const tick = (): LiveSentinelReport => {
    const report: LiveSentinelReport = { recorded: [], effects: [], failures: [] };
    const now = ports.now(), halted = stopped();
    for (const family of SENTINEL_FAMILIES) {
      if (!ports.families.has(family)) continue;
      const prior: SentinelView | undefined = journal.view.sentinels;
      let next: { state: unknown; events: SentinelEventRow[]; effects: (() => void)[]; labels: { kind: string; subject: string }[] };
      try {
        if (family === 'context') {
          const seen = contextObservation(journal.view, ports.startedAt);
          const decision = decideContext({ now, stopped: halted, state: prior?.context ?? { sessions: [] }, observations: [seen.observation],
            groundings: [{ topic: CONTEXT_SESSION, current: seen.current, file: seen.current, lastInboundMessageId: seen.lastInbound }],
            ...(ports.config?.context ? { config: ports.config.context } : {}) });
          const events: SentinelEventRow[] = [], effects: (() => void)[] = [], labels: { kind: string; subject: string }[] = [];
          for (const action of decision.actions) {
            if (action.kind === 'signal') events.push({ event: action.event, subject: action.session, detail: clip(action.detail) });
            else if (action.kind === 'reground') {
              events.push({ event: 'reground', subject: action.session, detail: 'ordinary pass requested for a fresh packet', operation: action.operation });
              effects.push(() => ports.reground(action.operation)); labels.push({ kind: 'reground', subject: action.session });
            } else if (action.kind === 'recover-context') {
              events.push({ event: 'recover-context', subject: action.session, detail: 'summary pass requested', operation: action.operation });
              effects.push(() => ports.recoverContext(action.operation)); labels.push({ kind: 'recover-context', subject: action.session });
            }
          }
          next = { state: decision.state, events, effects, labels };
        } else if (family === 'presence') {
          const decision = decidePresence({ now, stopped: halted, turns: presenceTurns(journal.view), state: prior?.presence ?? {},
            ...(ports.config?.presence ? { config: ports.config.presence } : {}) });
          const events: SentinelEventRow[] = [], effects: (() => void)[] = [], labels: { kind: string; subject: string }[] = [];
          for (const action of decision.actions) {
            if (action.kind === 'signal') events.push({ event: action.event, subject: action.turn, detail: clip(action.detail) });
            else if (action.kind === 'self-heal') { effects.push(() => ports.selfHeal(action.turn)); labels.push({ kind: 'self-heal', subject: action.turn }); }
            // The holding note is the owner's own infrastructure answer: the recorded due mark is what makes it eligible.
            else labels.push({ kind: 'note-due', subject: action.turn });
          }
          next = { state: decision.state, events, effects, labels };
        } else {
          const decision = decidePromises({ now, stopped: halted, promises: promiseObservations(journal.view), state: prior?.promise ?? {},
            ...(ports.config?.promise ? { config: ports.config.promise } : {}) });
          const events: SentinelEventRow[] = [], effects: (() => void)[] = [], labels: { kind: string; subject: string }[] = [];
          for (const action of decision.actions) {
            if (action.kind === 'signal') events.push({ event: action.event, subject: action.id, detail: clip(action.detail) });
            else if (action.kind === 'work') { effects.push(() => ports.actOnPromise(action.id)); labels.push({ kind: 'work', subject: action.id }); }
            else labels.push({ kind: 'report', subject: action.id });
          }
          next = { state: decision.state, events, effects, labels };
        }
      } catch (error) {
        failures[family]++;
        report.failures.push({ family, stage: 'observe', detail: clip(error instanceof Error ? error.message : 'unknown') });
        continue;
      }
      const before = family === 'context' ? prior?.context ?? { sessions: [] } : family === 'presence' ? prior?.presence ?? {} : prior?.promise ?? {};
      if (!next.events.length && !next.effects.length && JSON.stringify(before) === JSON.stringify(next.state)) continue;
      try {
        journal.append({ kind: 'sentinel', family, events: next.events.slice(0, 32), [family]: next.state, at: now } as JournalRecord);
      } catch (error) {
        // Unrecorded means unperformed: nothing is requested on a decision the journal does not hold.
        failures[family]++;
        report.failures.push({ family, stage: 'record', detail: clip(error instanceof Error ? error.message : 'unknown') });
        continue;
      }
      report.recorded.push(family);
      next.labels.forEach(label => report.effects.push({ family, ...label }));
      for (const effect of next.effects) {
        try { effect(); } catch (error) {
          failures[family]++;
          report.failures.push({ family, stage: 'effect', detail: clip(error instanceof Error ? error.message : 'unknown') });
        }
      }
    }
    return report;
  };
  return { tick, failures: () => ({ ...failures }) };
}

/** The sentinels' pull-surface report, read from the journal (status command, the runner's status). */
export function sentinelReport(view: JournalView, families: ReadonlySet<SentinelFamily> | null = null) {
  const sentinels = view.sentinels;
  const session = sentinels?.context?.sessions.find(row => row.session === CONTEXT_SESSION) ?? null;
  const presence = Object.entries(sentinels?.presence ?? {}), promise = Object.entries(sentinels?.promise ?? {});
  return {
    ...(families ? { enabled: SENTINEL_FAMILIES.filter(family => families.has(family)) } : {}),
    recordedTicks: sentinels?.counts ?? { context: 0, presence: 0, promise: 0 },
    lastRecorded: sentinels?.last ?? {},
    context: session ? { episode: session.episode ? { kind: session.episode.kind, status: session.episode.status,
      attempts: session.episode.attempts, openedAt: session.episode.openedAt, closedAt: session.episode.closedAt } : null,
    recoveries: session.recoveries.length } : null,
    presence: { watching: presence.filter(([, entry]) => entry.closedAt === null).length,
      selfHealRequested: presence.filter(([, entry]) => entry.closedAt === null && entry.healAt !== null && entry.noteDueAt === null).length,
      holdingNoteDue: presence.filter(([, entry]) => entry.closedAt === null && entry.noteDueAt !== null).map(([id]) => id) },
    promise: { workRequested: promise.filter(([, entry]) => entry.closedAt === null && entry.workRequestedAt !== null && entry.reportedAt === null).length,
      overdueReported: promise.filter(([, entry]) => entry.closedAt === null && entry.outcome === 'reported').map(([id]) => id),
      waiting: promise.filter(([, entry]) => entry.closedAt === null && entry.outcome === 'waiting').map(([id]) => id),
      acted: promise.filter(([, entry]) => entry.outcome === 'acted').length },
    events: (sentinels?.events ?? []).slice(-10),
  };
}

/** Plain lines for the operator's status reply; empty until a sentinel records something. */
export function sentinelStatusLines(view: JournalView): string[] {
  if (!view.sentinels) return [];
  const report = sentinelReport(view), episode = report.context?.episode;
  return [
    `Sentinels: context ${episode ? `${episode.kind} episode ${episode.status}` : 'no episode'}; presence watching ${report.presence.watching} unanswered (${report.presence.holdingNoteDue.length} holding note${report.presence.holdingNoteDue.length === 1 ? '' : 's'} due); promises ${report.promise.overdueReported.length} overdue reported, ${report.promise.waiting.length} waiting on someone else, ${report.promise.workRequested} with work requested.`,
  ];
}

/** The runner's one ordinary job (Rule 15): ordinary work runs beside the poll loop, one job at a time, never awaited
 * by it. A failed job backs off exponentially (capped at five minutes) and eight consecutive failures latch the error
 * that ends the run for the host supervisor (Rule 55). With two machines, work starts only while the peer is current. */
export function createOrdinaryLane(ports: { elapsed(): number; peerCurrent(): boolean; after(): unknown }) {
  let job: Promise<void> | null = null, error: unknown = null, failures = 0, retryAt = 0;
  const admissible = () => job === null && ports.elapsed() >= retryAt && ports.peerCurrent();
  const submit = (run: () => Promise<unknown>): boolean => {
    if (!admissible()) return false;
    job = run().then(() => { failures = 0; }, failed => {
      failures++;
      retryAt = ports.elapsed() + Math.min(300_000, 1000 * 2 ** Math.min(failures - 1, 9));
      if (failures >= 8) error ??= failed;
    }).then(() => { ports.after(); }).finally(() => { job = null; });
    return true;
  };
  return { admissible, submit, settle: async () => { await job; }, error: () => error };
}
export type OrdinaryLane = ReturnType<typeof createOrdinaryLane>;

/** One runner cycle's ordinary job with the sentinels riding it (plan #402). The tick runs only while the lane would
 * admit work right now, and every step it requests (pushed into `requested` by its ports, after its record) runs inside
 * that same admitted job, after the cycle's drain. A lane that is busy, backing off or waiting on the peer defers the
 * tick: nothing is recorded, so nothing counts as an attempted recovery or a failed self-heal. A failed drain still lets
 * the requested steps run, and then fails the job (its backoff unchanged). Returns whether the job was admitted. */
export function sentinelCycle(lane: OrdinaryLane, input: { tick(): void; requested: (() => Promise<unknown>)[];
  drain(): Promise<unknown>; after(): Promise<unknown> }): boolean {
  if (!lane.admissible()) return false;
  try { input.tick(); } catch { /* silence: a failed tick requests nothing beyond what it recorded */ }
  const steps = input.requested.splice(0);
  return lane.submit(async () => {
    let failure: { error: unknown } | null = null;
    try { await input.drain(); } catch (error) { failure = { error }; }
    for (const step of steps) try { await step(); } catch { /* the sentinel observes the outcome on its next tick */ }
    if (failure) throw failure.error;
    await input.after();
  });
}
