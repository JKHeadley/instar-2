/** Binds src/commitments to the owner journal, on the runner's own cycle: the live-side adapter for
 * CommitmentTracker, PromiseBeacon and the check-in reconciler.
 *
 * - Durable state is journal frames (commitment-record.ts); no file, no second store (Rule 116).
 * - There is no process timer. `after`/`every` enqueue on a due list that `tick()` drains, so a stop, a lost
 *   ownership or an expiry stops everything by not ticking, and a restart re-arms from durable anchors (Rules 55, 63).
 * - A reply promise stays the journal's. Each open note is mirrored one way under `commitment:<id>`: the journal's
 *   closure closes the mirror, the mirror never closes the note (Rules 33, 83).
 * - Sending goes through the `send` port only (commitment-send.ts binds it to the outbound boundary). Without one, every
 *   send is a definite refusal and retained as such. The bound runner observes without pushing: a date or
 *   heartbeat supplies no delivery contract (Part 18 §6, Rule 87). Separate requested replies stay with Five/Eight.
 * - What a tick starts settles inside the same admitted job: `tick` requests `settle` as one of its steps. */
import { CommitmentTracker, type Commitment, type CommitmentStore, type CommitmentTrackerConfig } from '../../src/commitments/CommitmentTracker.js';
import { PromiseBeacon, type PromiseBeaconConfig, type ReviveRequest, type ReviveResult } from '../../src/commitments/PromiseBeacon.js';
import { CheckInReminderReconciler, checkInSendId, type CheckInReminderPassReport } from '../../src/commitments/CheckInReminderReconciler.js';
import { LlmQueue } from '../../src/commitments/LlmQueue.js';
import { ProxyCoordinator } from '../../src/commitments/ProxyCoordinator.js';
import type { CommitmentTrackerPorts, ConfigWatchPort, DeliveryOutcome } from '../../src/commitments/ports.js';
import { commitmentOpen, commitmentWaitsOn, type JournalRecord, type JournalView } from './journal.js';
import { COMMITMENT_STORE_GENERATION, commitmentSendTarget, emptyCommitmentStore, type CommitmentStoreRecord } from './commitment-record.js';
import type { CommitmentDoorway, CommitmentSendAdmission } from './commitment-send.js';

const forward = { generation: COMMITMENT_STORE_GENERATION, additive: true } as const;
const MAX_ROWS_PER_FRAME = 32, MAX_TEXT = 2048, MAX_TIMERS_PER_TICK = 32;
/** One reminder pass per five minutes, the 1.x job's schedule. */
export const CHECK_IN_PASS_MS = 300_000;
/** Read back from the journal alone, for the status surfaces. */
export function commitmentStoreReport(view: JournalView) {
  const store = view.commitmentStore;
  if (!store) return null;
  const rows = store.order.map(id => store.rows[id]!), open = rows.filter(row => ['pending', 'verified', 'violated'].includes(row.status));
  return { tracked: rows.length, open: open.length, waiting: open.filter(row => (row.blockedOn ?? 'none') !== 'none').length,
    atRisk: open.filter(row => row.atRisk).length, paused: open.filter(row => row.beaconPaused).length,
    violated: open.filter(row => row.status === 'violated').map(row => row.id),
    checkInsUnsettled: open.filter(row => row.checkInReminderSendStartedAt).map(row => checkInSendId(row.id)),
    checkInsFailed: rows.filter(row => row.checkInReminderFailedAt).map(row => row.id), lastSweep: store.ledger.at(-1) ?? null,
    sends: { attempts: store.sends.length, delivered: store.sends.filter(send => send.sent !== undefined).length,
      refused: store.sends.filter(send => view.sendOutcomes.find(item => item.target === commitmentSendTarget(send.ordinal))?.outcome === 'refused').length,
      unsettled: store.sends.filter(send => send.sent === undefined && view.sendOutcomes.find(item => item.target === commitmentSendTarget(send.ordinal))?.outcome !== 'refused').map(send => send.logicalSendId),
      refusedBeforeIntent: store.refusals, lastRefusal: store.lastRefusal } };
}
const clamp = (text: string) => text.length <= MAX_TEXT ? text : `${text.slice(0, MAX_TEXT - 1)}…`;
export const mirrorKey = (id: number) => `commitment:${id}`;

export type CommitmentSend = (topicId: number, text: string, identity: { logicalSendId: string; source: string }) => Promise<DeliveryOutcome>;
export interface CommitmentHostPorts {
  now(): number;
  /** The host's local minutes-of-day and human date, for quiet hours and the check-in text. */
  minutesOfDay(ms: number): number;
  formatWhen(ms: number): string;
  /** A read only: whether a promised file now exists on the owner's host. */
  fileExists(path: string): boolean;
  config: ConfigWatchPort;
  /** Absent: nothing may be sent; each attempt is a definite refusal (grant-free default). */
  send?: CommitmentSend;
  /** The original send's receipt: true delivered, false definitely not, undefined unknown. */
  resolveDelivery?(logicalSendId: string): Promise<boolean | undefined>;
  /** The beacon's held send: only its exact receipt settles it. */
  resolveOriginDelivery?(operationId: string): Promise<boolean>;
  /** Whether any commitment send is granted now. Absent: only an explicit beacon option turns output on. */
  sendGranted?(): boolean;
  /** Whether this topic may be sent to now. */
  sendAdmits?(topicId: number): boolean;
  generateStatusLine?(promiseText: string, recentOutput: string): Promise<string>;
  /** The owning session's recent output, where it has any; the one-shot runner has none. */
  captureSessionOutput?(session: string): string | null;
  getSessionForTopic?(topicId: number): string | null;
  isSessionAlive?(session: string): boolean;
  /** Act on a lost owning session through the owner's bounded step; never a second session of its own. */
  requestRevive?(request: ReviveRequest): Promise<ReviveResult>;
  raiseAttention?(id: string, detail: string): void;
  log(...parts: unknown[]): void;
  options?: {
    tracker?: Partial<Pick<CommitmentTrackerConfig, 'autoExpiry' | 'operatorWait' | 'originMachineId'>>;
    beacon?: Partial<Pick<PromiseBeaconConfig, 'userOutputEnabled' | 'quietHours' | 'escalation' | 'agentOwnedFollowthrough' | 'looksActivelyWorking' | 'getSessionEpoch'>>;
    checkIns?: { enabled: boolean; dryRun: boolean };
  };
}

/** The runner's binding: the host's send, receipt and status ports on the worker's doorways, under the effect policy. */
export function createBoundCommitmentHost(journal: Parameters<typeof createCommitmentHost>[0], ports: Omit<CommitmentHostPorts, 'send' | 'resolveDelivery' | 'resolveOriginDelivery' | 'sendGranted' | 'sendAdmits' | 'generateStatusLine'>,
  worker: { commitmentDoorway(admit: CommitmentSendAdmission): CommitmentDoorway }, grant: { admit: CommitmentSendAdmission; any(): boolean }) {
  const doorway = worker.commitmentDoorway(grant.admit);
  return createCommitmentHost(journal, { ...ports, send: doorway.send, resolveDelivery: doorway.resolveDelivery, resolveOriginDelivery: doorway.resolveOrigin,
    // The carried heartbeat/check-in text is observational. Explicit replies use Five's
    // source-bound requested-result path; eligible notices need a separate producer contract.
    sendGranted: () => false, sendAdmits: () => false, generateStatusLine: doorway.statusLine });
}

export function createCommitmentHost(journal: { readonly view: JournalView; append(row: JournalRecord): void }, ports: CommitmentHostPorts) {
  const stored = () => journal.view.commitmentStore ?? emptyCommitmentStore();
  const append = (fields: Omit<CommitmentStoreRecord, 'kind' | 'forward' | 'at'>) => {
    journal.append({ kind: 'commitment-store', forward, at: ports.now(), ...fields });
    writes++;
  };
  let writes = 0;
  type Due = { due: number; run: () => void; every?: number };
  const due = new Set<Due>();
  const timers = {
    after(ms: number, run: () => void) { const item: Due = { due: ports.now() + ms, run }; due.add(item); return { cancel: () => { due.delete(item); } }; },
    every(ms: number, run: () => void) { const item: Due = { due: ports.now() + ms, run, every: ms }; due.add(item); return { cancel: () => { due.delete(item); } }; },
  };
  const clock = { now: ports.now, iso: (ms: number) => new Date(ms).toISOString(), parse: (iso: string) => Date.parse(iso) };
  const trackerPorts: CommitmentTrackerPorts = {
    clock, timers, fileExists: ports.fileExists, log: ports.log, degraded: event => ports.log('[commitments]', event.feature, event.reason),
    store: {
      load() {
        const view = journal.view.commitmentStore;
        if (!view) return null;
        return { version: 2, lastModified: clock.iso(ports.now()), commitments: view.order.map(id => structuredClone(view.rows[id]!)),
          ...(view.replicationSeq === undefined ? {} : { replicationSeq: view.replicationSeq }),
          ...(view.storeIncarnation === undefined ? {} : { storeIncarnation: view.storeIncarnation }),
          ...(view.drops === undefined ? {} : { blockerEpisodeDropBuckets: view.drops }) };
      },
      save(store, changed) {
        try {
          const meta = { ...(store.replicationSeq === undefined ? {} : { replicationSeq: store.replicationSeq }),
            ...(store.storeIncarnation === undefined ? {} : { storeIncarnation: store.storeIncarnation }),
            ...(store.blockerEpisodeDropBuckets === undefined ? {} : { drops: store.blockerEpisodeDropBuckets }) };
          for (let at = 0; at === 0 || at < changed.length; at += MAX_ROWS_PER_FRAME)
            append({ rows: changed.slice(at, at + MAX_ROWS_PER_FRAME).map(row => structuredClone(row)), meta });
          return { state: 'committed' };
        } catch { return { state: 'failed', errorClass: 'journal-refused' }; }
      },
      readHighWater: () => stored().highWater,
      // The journal's own chain is the rewind authority; the frames already carry the sequence.
      writeHighWater() {},
    },
    behavioralRules: {
      exists: () => stored().rules !== null,
      write(content) { append({ rules: content }); },
      remove() { if (stored().rules !== null) append({ rules: null }); },
    },
    expiryLedger: { append(row) { append({ ledger: row }); } },
  };
  /** Work started on a tick; `settle` holds the admitted job open until it ends. */
  const inFlight = new Set<Promise<unknown>>();
  const track = <T>(work: Promise<T>): Promise<T> => {
    const held = work.then(() => {}, () => {}).finally(() => { inFlight.delete(held); });
    inFlight.add(held);
    return work;
  };
  const deliver = async (topicId: number, text: string, opts: { logicalSendId: string }): Promise<DeliveryOutcome> => {
    const outcome = await track(ports.send
      ? ports.send(topicId, text, { logicalSendId: opts.logicalSendId, source: 'commitments' })
      : Promise.resolve<DeliveryOutcome>({ delivered: false, outcome: 'not-delivered', reason: 'no-send-grant', standDown: true, definite: true }));
    if (outcome.outcome === 'not-delivered' && outcome.reason === 'no-send-grant')
      try { append({ refusal: { logicalSendId: opts.logicalSendId, reason: outcome.reason } }); } catch { /* the caller's result still says it */ }
    return outcome;
  };

  const build = () => {
    const tracker = new CommitmentTracker({ ports: trackerPorts, liveConfig: ports.config, ...ports.options?.tracker });
    const llmQueue = new LlmQueue({ clock, timers });
    const beacon = new PromiseBeacon({
      commitmentTracker: tracker, llmQueue, proxyCoordinator: new ProxyCoordinator(ports.now),
      ports: { clock: { ...clock, minutesOfDay: ports.minutesOfDay }, timers, log: ports.log, degraded: event => ports.log('[beacon]', event.feature, event.reason),
        state: {
          loadHot: id => stored().hot[id] ?? null,
          saveHot(id, value) { append({ hot: [{ id, value: structuredClone(value) }] }); },
          loadAggregate: topic => stored().aggregates[String(topic)] ?? null,
          saveAggregate(topic, value) { append({ aggregates: [{ topic, value: structuredClone(value) }] }); },
          aggregateTopics: () => Object.keys(stored().aggregates).map(Number),
        } },
      // The runner's sessions are one-shot; there is no frame to capture or hold open.
      captureSessionOutput: session => ports.captureSessionOutput?.(session) ?? null, getSessionForTopic: topic => ports.getSessionForTopic?.(topic) ?? null,
      isSessionAlive: session => ports.isSessionAlive?.(session) ?? false,
      sendMessage: async (topicId, text) => { const outcome = await deliver(topicId, text, { logicalSendId: `beacon:${topicId}` });
        if (!outcome.delivered) throw Error(outcome.outcome); },
      deliverMessage: (topicId, text, opts) => deliver(topicId, text, opts),
      ...(ports.requestRevive ? { requestRevive: ports.requestRevive } : {}),
      ...(ports.raiseAttention ? { raiseAttention: ports.raiseAttention } : {}),
      ...(ports.resolveOriginDelivery ? { resolveOriginDelivery: ports.resolveOriginDelivery } : {}),
      ...(ports.sendAdmits ? { ownsConversation: ports.sendAdmits } : {}),
      ...(ports.generateStatusLine ? { generateStatusLine: (promise: string, output: string) => ports.generateStatusLine!(promise, output) } : {}),
      ...ports.options?.beacon,
      // Read at each send, so a grant added or withdrawn takes effect without a restart.
      get userOutputEnabled() { return ports.sendGranted ? ports.sendGranted() : ports.options?.beacon?.userOutputEnabled === true; },
    });
    const checkIns = new CheckInReminderReconciler({
      tracker, log: line => ports.log(line),
      time: { ...clock, formatWhen: ports.formatWhen },
      ...(ports.resolveDelivery ? { resolveDelivery: ports.resolveDelivery } : {}),
      ...(ports.sendAdmits ? { admits: ports.sendAdmits } : {}),
      send: async (topicId, text, identity) => {
        const outcome = await deliver(topicId, text, { logicalSendId: identity.logicalSendId });
        if (outcome.delivered || outcome.outcome === 'already-delivered-recently') return 'delivered';
        // A typed refusal sent nothing; anything else may have reached the person.
        if (outcome.outcome === 'not-delivered' && (outcome.definite || outcome.standDown || outcome.permanent || outcome.reason === 'no-send-grant')) throw Error(outcome.reason);
        return 'unknown';
      },
    }, ports.options?.checkIns ?? { enabled: true, dryRun: false });
    return { tracker, beacon, checkIns, frames: stored().frames };
  };
  let live = build(), started = false;
  let lastCheckInPass: CheckInReminderPassReport | null = null;
  let passing: Promise<CheckInReminderPassReport> | null = null, passCancel: { cancel(): void } | null = null;
  const runCheckIns = (): Promise<CheckInReminderPassReport> => passing ??= track(live.checkIns.runPass()).then(report => { lastCheckInPass = report; return report; }).finally(() => { passing = null; });
  const start = () => { live.tracker.start(); live.beacon.start(); started = true;
    passCancel?.cancel();
    // Once on the first tick, so a restart settles what it can at once, then at the 1.x cadence.
    const pass = () => { void runCheckIns().catch(error => ports.log('[check-in]', (error as Error).message)); };
    passCancel = ports.sendGranted ? timers.every(CHECK_IN_PASS_MS, pass) : null;
    if (ports.sendGranted) timers.after(0, pass); };

  /** One way, from the owner's notes. Open and agent-owned gets a mirror; a closed note closes it. */
  const mirrorPromises = () => {
    const { view } = journal;
    view.commitments.forEach((note, id) => {
      const key = mirrorKey(id), active = live.tracker.getActive().find(row => row.externalKey === key);
      if (!commitmentOpen(view, id)) {
        if (active) live.tracker.withdraw(active.id, `journal closure: ${view.closed.get(id)?.quote ?? 'closed'}`);
        return;
      }
      if (note.owner === undefined || note.waitsOn === undefined) return;
      const waits = commitmentWaitsOn(view, id);
      const blockedOn = waits === 'operator' ? 'user-input' as const : waits === 'external' ? 'external' as const : 'none' as const;
      if (active) { if (active.blockedOn !== blockedOn) live.tracker.transitionState(active.id, { blockedOn }); return; }
      if (live.tracker.getAll().some(row => row.externalKey === key)) return;
      const topicId = view.turns.get(note.source)?.thread;
      live.tracker.record({ externalKey: key, type: 'one-time-action', verificationMethod: 'manual', userRequest: clamp(note.quote),
        agentResponse: clamp(note.quote), source: 'agent', owner: 'agent', blockedOn, beaconEnabled: topicId !== undefined,
        ...(topicId === undefined ? {} : { topicId }), beaconCreatedBySource: 'api-loopback' });
    });
  };

  let tickFailures = 0;
  const tick = (): { ran: number; failures: string[] } => {
    const failures: string[] = [];
    // A stop or expiry holds everything; the rows stay and resume with the next admitted owner (floor: stop).
    if (journal.view.stop !== null || ports.now() >= journal.view.expires) return { ran: 0, failures };
    // Another owner advanced the journal while this one stood by: its rows win, rebuild from them.
    if (stored().frames !== live.frames + writes) {
      if (started) { live.tracker.stop(); live.beacon.stop(); }
      due.clear(); writes = 0; live = build();
      if (started) start();
    }
    if (!started) start();
    try { mirrorPromises(); } catch (error) { failures.push(`mirror: ${(error as Error).message}`); }
    const ready = [...due].filter(item => item.due <= ports.now()).sort((a, b) => a.due - b.due).slice(0, MAX_TIMERS_PER_TICK);
    for (const item of ready) {
      if (item.every === undefined) due.delete(item); else item.due = ports.now() + item.every;
      try { const started = (item.run as () => unknown)(); if (started instanceof Promise) void track(started).catch(() => {}); }
      catch (error) { failures.push((error as Error).message); }
    }
    tickFailures += failures.length;
    return { ran: ready.length, failures };
  };
  const report = () => ({ ...commitmentStoreReport(journal.view), health: live.tracker.getHealth(), tickFailures, checkIns: lastCheckInPass });
  /** Holds the admitted job open until everything this host started has ended. */
  const settle = async () => { while (inFlight.size) await Promise.all(inFlight); };
  return { tick, settle, report, tracker: () => live.tracker, beacon: () => live.beacon,
    runCheckIns, stop() { live.tracker.stop(); live.beacon.stop(); due.clear(); } };
}
export type { Commitment, CommitmentStore };
