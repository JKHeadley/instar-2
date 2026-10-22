import { boundary, ensure, freeze, take } from './boundary.js';
import { createConversationSessionPort } from './production-conversation-session.js';
import type { ConversationSessionConfig, ConversationSessionPort, ConversationState } from './production-conversation-session.js';
import type { HarnessAdapterPort, HarnessInputDelivery } from './contracts.js';
import type { SessionWorkEdge, SessionWorkEdgeClose, SessionWorkRequest } from './production-session-work.js';
import type { Result } from '../index.js';

export interface ConversationTopicsState {
  readonly version: 1; readonly kind: 'topics'; readonly conversation: string;
  readonly edge: SessionWorkEdge | null; readonly reserved: boolean;
  readonly topics: Readonly<Record<string, ConversationState>>;
  readonly legacy?: ConversationState; readonly legacyImported?: boolean;
  readonly allowanceEpoch?: number;
  readonly allowanceDeadline?: number;
  readonly renewal?: SessionWorkEdgeClose | null;
}
export interface ConversationTopicsConfig extends Omit<ConversationSessionConfig, 'store' | 'createAdapter'> {
  readonly topicConfig?: (topic: string) => Pick<ConversationSessionConfig, 'io' | 'resources' | 'authorized' | 'currentAuthority' | 'createAdapter' | 'prepareTurn'>;
  /** Host measurements, injected: no ambient host I/O in the coordinator. */
  readonly capacity?: () => Promise<Readonly<{ admit: boolean; memoryPressure: boolean }>>;
  readonly maxSessions: number;
  readonly idleMs: number;
  readonly topicOf: (operation: string) => string;
  readonly store: { load(): ConversationTopicsState | ConversationState | null; save(state: ConversationTopicsState): void };
  readonly createAdapter: (topic: string, resolve: (operation: string) => HarnessInputDelivery | undefined) => HarnessAdapterPort<2>;
}

/** Rules 46/60/75/96: topic-local custody and workers, one installation reservation.
 * The existing host owns FIFO, duplicates, recovery and process replacement. This
 * coordinator only bounds live workers and atomically shares their allowance. */
export function createConversationTopicsPort(config: ConversationTopicsConfig): Result<ConversationSessionPort> {
  return boundary('ConversationTopics', null, config.context, () => {
    ensure(Number.isSafeInteger(config.maxSessions) && config.maxSessions >= 1 && config.maxSessions <= 16, 'bounded topic session cap required');
    ensure(Number.isSafeInteger(config.idleMs) && config.idleMs >= 1 && config.idleMs <= config.deadlineMs, 'bounded topic idle lifetime required');
    const loaded = config.store.load();
    let state: ConversationTopicsState = loaded && !('kind' in loaded) ? {
      version: 1, kind: 'topics', conversation: loaded.conversation, edge: loaded.edge,
      reserved: loaded.reserved, topics: {}, legacy: loaded, legacyImported: false,
    } : loaded ?? { version: 1 as const, kind: 'topics' as const, conversation: config.conversation,
      edge: null, reserved: false, topics: {} };
    ensure(state.version === 1 && state.kind === 'topics' && state.conversation === config.conversation,
      'topic custody identity differs');
    ensure(!state.legacy || state.legacy.version === 1 && Array.isArray(state.legacy.inputs)
      && Number.isSafeInteger(state.legacy.spent) && state.legacy.spent >= 0, 'legacy custody malformed');
    ensure(!state.edge || state.reserved && state.edge.budget.calls === config.maxCalls, 'topic reservation interrupted or allowance changed');
    ensure(Number.isSafeInteger(state.allowanceEpoch ?? 0) && (state.allowanceEpoch ?? 0) >= 0,
      'allowance epoch malformed');
    ensure(state.allowanceDeadline === undefined || Number.isSafeInteger(state.allowanceDeadline) && state.allowanceDeadline > 0,
      'allowance lifetime malformed');
    ensure(!state.renewal || state.edge && state.renewal.id === `${state.edge.id}:renew`
      && state.renewal.edge === state.edge.id && state.renewal.calls === config.maxCalls
      && state.renewal.reserved === config.maxCalls, 'allowance renewal intent malformed');
    const persist = (patch: Partial<ConversationTopicsState>) => {
      const next = freeze({ ...state, ...patch }); config.store.save(next); state = next;
    };
    const parentDeadline = () => Math.min(config.allowanceDeadline, state.allowanceDeadline ?? config.allowanceDeadline,
      state.edge?.budget.deadline ?? config.allowanceDeadline);
    const spent = () => Object.values(state.topics).reduce((sum, row) => sum + row.spent,
      state.allowanceEpoch ? 0 : state.legacy?.spent ?? 0);
    ensure(spent() <= config.maxCalls, 'shared topic allowance exceeded');
    const hosts = new Map<string, ConversationSessionPort>();
    const active = new Set<string>();
    const busy = new Map<string, number>();
    const touched = new Map<string, number>();
    let stopped = false, recovered = false;
    let admission = Promise.resolve();
    const cleanupInhibited = () => Object.values(state.topics).some(row => row.idleCleanup?.inhibited);
    const idleCandidates = () => (cleanupInhibited() ? [] : [...active])
      .filter(key => !busy.get(key)).sort((a, b) => (touched.get(a) ?? 0) - (touched.get(b) ?? 0));
    const reclaim = async () => {
      // Bounded by maxSessions. One refusal must not hide another eligible worker.
      for (const topic of idleCandidates()) {
        if (cleanupInhibited()) return false;
        if (!busy.get(topic) && await hosts.get(topic)!.retireIdle('pressure')) return true;
      }
      return false;
    };
    let wake: (() => void) | null = null;
    const notify = () => { const resolve = wake; wake = null; resolve?.(); };
    const hostFor = (topic: string): ConversationSessionPort => {
      ensure(/^(?:main|[1-9][0-9]{0,15})$/u.test(topic), 'exact topic identity required');
      const existing = hosts.get(topic); if (existing) return existing;
      ensure(Object.keys(state.topics).length < 4096 || topic in state.topics, 'topic custody capacity reached');
      const local = config.topicConfig?.(topic);
      const io = local?.io ?? config.io, resources = local?.resources ?? config.resources;
      const result = createConversationSessionPort({ ...config, ...local, batchWaiting: true, conversation: `${config.conversation}:${topic}`, allowanceDeadline: parentDeadline(),
        stopped: () => stopped || config.stopped(),
        prepareTurn: async input => (local?.prepareTurn ?? config.prepareTurn)?.(input) ?? true,
        store: { load: () => state.topics[topic] ?? null, save: next => {
          ensure(spent() - (state.topics[topic]?.spent ?? 0) + next.spent <= config.maxCalls, 'installation call allowance exhausted');
          persist({ topics: { ...state.topics, [topic]: next } });
        } },
        createAdapter: local?.createAdapter ?? (resolve => config.createAdapter(topic, resolve)),
        append: record => {
          if (record.type === 'SessionWorkEdge' && !record.drawsOn) {
            if (!state.edge) {
              const edge = { ...record, id: `${config.conversation}:allowance${state.allowanceEpoch ? `:${state.allowanceEpoch}` : ''}`, child: config.conversation };
              persist({ edge }); config.append(edge); persist({ reserved: true });
            }
            ensure(state.reserved, 'shared reservation interrupted; reconciliation required');
            config.append({ ...record, topic, parent: state.edge!.id, drawsOn: state.edge!.id });
          } else config.append(record.type === 'SessionWorkEdge' ? { ...record, topic } : record);
        },
        io: { ...io,
          // All calls are durably charged by the existing dispatch checkpoint. A
          // directory-wide transcript count would charge other topics a second time.
          modelCalls: () => state.topics[topic]?.spent ?? 0,
          prepareAdmission: (claim, edge) => {
            const remaining = config.maxCalls - spent(); ensure(remaining > 0, 'installation call allowance exhausted');
            return io.prepareAdmission(claim, { ...edge, topic, budget: { ...edge.budget, calls: Math.min(edge.budget.calls, remaining) } });
          } },
        resources: { admit: async () => {
          const acquire = async () => {
            while (active.size >= config.maxSessions && !stopped && !config.stopped()) {
              if (cleanupInhibited()) return null;
              if (idleCandidates().length) {
                if (await reclaim()) continue;
                return null; // Confirmation/grace keeps this input queued without dispatch.
              }
              await Promise.race([new Promise<void>(resolve => { wake = resolve; }), config.io.wait(config.pollMs)]);
              ensure(config.now() < parentDeadline(), 'parent lifetime exhausted');
            }
            ensure(!stopped && !config.stopped() && config.authorized(), 'topic dispatch stopped or grant unavailable');
            let lease = await resources.admit();
            if (!lease) {
              // The installation resource owner may have a tighter ceiling (or
              // another work family using it). Reclaim one idle topic and retry once.
              if (await reclaim()) lease = await resources.admit();
            }
            if (!lease) return null;
            // Physical admission can wait too. Measure after its final retry,
            // before this lease becomes a worker. Resident turns keep their context.
            if (config.capacity) {
              let admitted = false;
              try {
                let room = await config.capacity();
                if (room.memoryPressure && await reclaim()) room = await config.capacity();
                admitted = room.admit;
              } finally {
                if (!admitted) ensure(await lease.release(), 'unlaunched resource release unconfirmed');
              }
              if (!admitted) return null;
            }
            const held = lease;
            active.add(topic);
            return { attach: held.attach, release: async () => {
              const released = await held.release(); if (released) { active.delete(topic); notify(); } return released;
            } };
          };
          const pending = admission.then(acquire);
          admission = pending.then(() => {}, () => {}); return pending;
        } },
      });
      const host = take(result); hosts.set(topic, host); return host;
    };
    // Reopen all recorded hosts before admitting new work: retire old process
    // identities first, including topics that have not received another message.
    let recovery: Promise<void> | null = null;
    const recover = () => recovery ??= (async () => {
      if (state.legacy && !state.legacyImported) {
        // Upgrade the existing encrypted snapshot in place, never create a fresh
        // allowance beside it. Retire its exact worker before splitting queues.
        const legacy = take(createConversationSessionPort({ ...config,
          store: { load: () => state.legacy!, save: next => persist({ legacy: next }) },
          createAdapter: resolve => config.createAdapter('main', resolve),
          io: { ...config.io, modelCalls: () => state.legacy!.spent },
        }));
        ensure(await legacy.retireIdle(), 'legacy worker retirement unconfirmed');
        const old = state.legacy!, topics: Record<string, ConversationState> = {};
        for (const input of old.inputs) {
          const topic = config.topicOf(input.request.operation);
          ensure(/^(?:main|[1-9][0-9]{0,15})$/u.test(topic), 'legacy input topic unavailable');
          const prior = topics[topic] ?? { ...old, conversation: `${config.conversation}:${topic}`,
            epoch: 0, worker: null, claim: null, incarnation: null, authority: null,
            deadline: 0, turns: 0, inputs: [], spent: 0, claimCalls: 0, close: null };
          const unresolved = input.state === 'dispatching' || input.state === 'accepted';
          topics[topic] = { ...prior, inputs: [...prior.inputs, unresolved ? { ...input, state: 'settled',
            outcome: { state: 'uncertain', detail: 'legacy host interrupted; no automatic replay', edge: old.edge?.id ?? 'no-edge', child: null } } : input] };
        }
        // Retain the original inputs and charges as the migration evidence.
        persist({ topics, legacyImported: true });
      }
      for (const topic of Object.keys(state.topics)) {
        const host = hostFor(topic); ensure(await host.retireIdle(), 'prior topic retirement unconfirmed');
      }
      recovered = true;
    })();
    let renewing: Promise<void> | null = null;
    const renewIfIdle = (): Promise<void> => {
      if (renewing) return renewing;
      if (!state.edge || spent() !== config.maxCalls || [...busy.values()].some(count => count > 0)
        || stopped || config.stopped() || !config.authorized() || config.now() >= parentDeadline()
        || cleanupInhibited()) return Promise.resolve();
      renewing = (async () => {
        // Fence every old admission before clearing its counters. Custody and epoch
        // identities survive; no dispatched or uncertain input is replayed.
        for (const host of hosts.values()) if (!await host.retireIdle()) return;
        if (stopped || config.stopped() || !config.authorized() || config.now() >= parentDeadline()) return;
        for (const host of hosts.values()) await host.close();
        if (stopped || config.stopped() || !config.authorized() || config.now() >= parentDeadline()) return;
        const edge = state.edge!;
        const pending = state.renewal;
        if (!pending) persist({ renewal: { type: 'SessionWorkEdgeClose', schemaVersion: 1,
          id: `${edge.id}:renew`, edge: edge.id, child: null, state: 'complete',
          detail: 'Exhausted allowance retired; topic custody retained for renewal.', evidence: edge.id,
          resultBytes: null, closedAt: config.now(), calls: spent(), reserved: config.maxCalls } });
        // An interrupted append is reconciled against the durable journal, never
        // inferred from an in-memory flag. Closing does not refund spent calls.
        if (pending) ensure(config.recoveryEdges, 'allowance renewal needs journal reconciliation');
        const recorded = pending ? config.recoveryEdges!().find(row => row.id === pending.id) : undefined;
        if (recorded) ensure(JSON.stringify(recorded) === JSON.stringify(pending), 'allowance renewal evidence differs');
        else config.append(state.renewal!);
        const topics = Object.fromEntries(Object.entries(state.topics).map(([topic, row]) => {
          const { halt, ...retained } = row;
          return [topic, { ...retained, edge: null, reserved: false, spent: 0, claimCalls: 0, close: null,
            ...(halt && halt.reason !== 'calls' ? { halt } : {}) }];
        }));
        persist({ topics, edge: null, reserved: false, renewal: null, allowanceDeadline: parentDeadline(),
          allowanceEpoch: (state.allowanceEpoch ?? 0) + 1 });
        hosts.clear();
      })().finally(() => { renewing = null; });
      return renewing;
    };
    const runBatch = async (requests: readonly SessionWorkRequest[]) => {
      ensure(requests.length > 0 && requests.every(request => config.topicOf(request.operation) === config.topicOf(requests[0]!.operation)), 'batch must name one topic');
      await recover();
      await renewIfIdle();
      const topic = config.topicOf(requests[0]!.operation), host = hostFor(topic);
      busy.set(topic, (busy.get(topic) ?? 0) + 1);
      try { return await host.runBatch(requests); }
      finally { busy.set(topic, busy.get(topic)! - 1); touched.set(topic, config.now()); notify(); }
    };
    const run = async (request: SessionWorkRequest) => (await runBatch([request]))[0]!;
    const maintain = async () => {
      await recover();
      if (config.stopped() || config.now() >= parentDeadline()) { await close(); return; }
      await renewIfIdle();
      for (const topic of Object.keys(state.topics)) hostFor(topic);
      const pressured = config.capacity && (await config.capacity()).memoryPressure;
      if (pressured) await reclaim();
      // A queued worker needs a slot or resource lease. Its admission below owns
      // pressure assessment; ordinary expiry must not reset that confirmation.
      const waitingForWorker = Object.entries(state.topics).some(([topic, row]) =>
        !active.has(topic) && row.inputs.some(input => input.state === 'queued'));
      for (const [topic, host] of hosts) if (!pressured && !waitingForWorker && !busy.get(topic)) {
        if (!cleanupInhibited() && active.has(topic) && config.now() - (touched.get(topic) ?? 0) >= config.idleMs)
          await host.retireIdle('idle');
      }
      // Pending queues survive restart. Run in parallel so one busy topic cannot
      // starve another, with physical admission still capped above.
      const maintainHost = async ([topic, host]: [string, ConversationSessionPort]) => {
        if (busy.get(topic)) return;
        busy.set(topic, 1);
        try { await host.maintain(); } finally { busy.set(topic, busy.get(topic)! - 1); notify(); }
      };
      // Finish idle account maintenance before queued hosts assess those workers for reclamation.
      // Otherwise a harmless idle maintenance promise looks busy on every admission retry.
      const idleHosts = [...hosts].filter(([topic]) => !state.topics[topic]?.inputs.some(input => input.state === 'queued'));
      for (const entry of idleHosts) await maintainHost(entry);
      await Promise.all([...hosts].filter(([topic]) => state.topics[topic]?.inputs.some(input => input.state === 'queued')).map(maintainHost));
    };
    const close = async () => {
      stopped = true; notify(); await renewing; await recover();
      const results = await Promise.all([...hosts.values()].map(host => host.close()));
      return results.find(row => row?.state === 'uncertain') ?? results.find(row => row !== null) ?? null;
    };
    return Object.freeze({ owner: 'part-eight' as const,
      available: () => !stopped && !config.stopped() && config.authorized() && config.now() < parentDeadline(),
      run, runBatch, maintain, close,
      idleCleanupStatus: () => {
        const rows = Object.values(state.topics);
        const lost = rows.filter(row => !row.worker && row.idleCleanup?.lastClosure).length;
        const inhibited = rows.some(row => row.idleCleanup?.inhibited);
        return [...(lost ? [`Idle cleanup: ${lost} warm worker(s) closed; the next message needs a worker start. Conversation history and accepted messages are retained.`] : []),
          ...(inhibited ? ['Idle cleanup is paused after an unconfirmed closure; capacity release is uncertain and needs repair.'] : [])];
      },
      collect: async (operation: string) => {
        await recover();
        const topic = config.topicOf(operation);
        if (!state.topics[topic]) return null;
        return hostFor(topic).collect(operation);
      },
      reserveCall: (claim: string, ordinal: number) => {
        ensure(recovered && spent() < config.maxCalls, 'installation call allowance exhausted or host recovering');
        const topic = Object.keys(state.topics).find(key => state.topics[key]!.claim === claim);
        ensure(topic !== undefined, 'unknown topic claim'); hostFor(topic!).reserveCall(claim, ordinal);
      },
      retireIdle: async () => {
        if ([...busy.values()].some(count => count > 0)) return false;
        for (const host of hosts.values()) if (!await host.retireIdle()) return false;
        return true;
      },
    });
  });
}
