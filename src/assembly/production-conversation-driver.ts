import type { ProductionApplication } from './production-application.js';
import { hashBytes } from '../facts/index.js';
import { take } from './boundary.js';

/** R6 `sequential-serving-admission` assumption. This port is deliberately
 * supplied by Six; this module never creates a lease, budget, or admission. */
export interface SequentialServingAdmission {
  readonly owner: 'part-six';
  admitTurn(input: Readonly<{ updateId: number; opening: string; generation: string;
    lease: string }>): 'admitted' | 'already-admitted' | 'exhausted' | 'revoked' | 'generation-changed';
  current(input: Readonly<{ generation: string; lease: string }>): boolean;
}

export interface ConversationFact {
  readonly id: string;
  readonly kind: string;
  readonly body: Readonly<Record<string, unknown>>;
}
export type TurnPhase = 'admitted' | 'grounded' | 'provider-dispatched-unknown'
  | 'provider-dispatched-answered' | 'accepted' | 'reply-dispatched-unknown'
  | 'api-accepted' | 'held';
export interface ConversationTurn {
  readonly updateId: number;
  readonly opening: string;
  readonly providerRun: string | null;
  readonly replyRun: string | null;
  readonly replyPrepared: boolean;
  readonly phase: TurnPhase;
  readonly inboundCapture: string;
  readonly acceptedReply: string | null;
}

const obj = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const str = (value: unknown): string => typeof value === 'string' ? value : '';
const record = (fact: ConversationFact) => obj(fact.body.record);
const idOf = (value: unknown): string => str(obj(value).id);
const safeInteger = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};
const unique = (rows: readonly ConversationFact[], label: string): ConversationFact | undefined => {
  if (rows.length > 1) throw new Error(`conversation-driver: conflicting ${label}`);
  return rows[0];
};

/** Read-only phase fold. Only Four, Five, Six, Seven, and Eight owner facts
 * advance a turn. A lost acknowledgement cannot make a claimed call retryable. */
export function turns(facts: readonly ConversationFact[],
  apiAccepted: (observation: ConversationFact, request: ConversationFact) => boolean = () => false): readonly ConversationTurn[] {
  const byId = new Map(facts.map(fact => [fact.id, fact]));
  if (byId.size !== facts.length) throw new Error('conversation-driver: duplicate fact identity');
  const admitted = facts.filter(fact => fact.kind === 'intake-admitted' && fact.body.binding !== 'none');
  const byUpdate = new Map<number, ConversationFact>();
  for (const fact of admitted) {
    const update = safeInteger(fact.body.eventId);
    if (update === null) throw new Error('conversation-driver: invalid update id');
    const prior = byUpdate.get(update);
    if (prior && prior.id !== fact.id) throw new Error('conversation-driver: duplicate admitted update');
    byUpdate.set(update, fact);
  }
  return [...byUpdate.entries()].sort(([a], [b]) => a - b).map(([updateId, opening]) => {
    const receipt = byId.get(str(opening.body.receipt));
    if (!receipt || receipt.kind !== 'intake-receipt') throw new Error('conversation-driver: durable intake receipt absent');
    const inboundCapture = str(obj(receipt.body.capture).reference);
    if (!inboundCapture) throw new Error('conversation-driver: durable inbound capture absent');
    const runOpening = unique(facts.filter(fact => fact.kind === 'run-opening'
      && idOf(record(fact).opening) === opening.id), 'provider opening');
    const providerRun = runOpening ? str(runOpening.body.run) || str(record(runOpening).id) : null;
    const grounding = providerRun && facts.some(fact => fact.kind === 'session-grounding'
      && record(fact).run === providerRun);
    const request = providerRun && unique(facts.filter(fact => fact.kind === 'judgment-provider-ProviderJudgmentRequest'
      && record(fact).run === providerRun), 'provider request');
    const providerClaims = providerRun ? facts.filter(fact => fact.kind === 'transport-AdmissionReservation'
      && record(fact).run === providerRun && ['dispatch-claimed', 'consumed'].includes(str(record(fact).state))) : [];
    const response = request ? unique(facts.filter(fact => fact.kind === 'judgment-provider-ProviderJudgmentAttemptRecord'
      && record(fact).request === record(request).id && record(fact).phase === 'response-observed'), 'provider response') : undefined;
    const acceptance = request ? unique(facts.filter(fact => fact.kind === 'judgment-provider-ProviderAnswerAcceptance'
      && record(fact).request === record(request).id), 'answer acceptance') : undefined;
    const replyOpening = acceptance ? unique(facts.filter(fact => fact.kind === 'run-opening'
      && idOf(record(fact).opening) === acceptance.id), 'reply opening') : undefined;
    const replyRun = replyOpening ? str(replyOpening.body.run) || str(record(replyOpening).id) : null;
    const replyClaims = replyRun ? facts.filter(fact => fact.kind === 'transport-AdmissionReservation'
      && record(fact).run === replyRun && ['dispatch-claimed', 'consumed'].includes(str(record(fact).state))) : [];
    const replyRequest = replyRun ? unique(facts.filter(fact => fact.kind === 'effect-EffectRequest'
      && record(fact).run === replyRun), 'reply request') : undefined;
    const replyObservation = replyRequest ? facts.find(fact => fact.kind === 'effect-OperationObservation'
      && record(fact).request === record(replyRequest).id && record(fact).stage === 'response') : undefined;
    let phase: TurnPhase = 'admitted';
    if (grounding) phase = 'grounded';
    if (providerClaims.length) phase = 'provider-dispatched-unknown';
    if (response) phase = 'provider-dispatched-answered';
    if (acceptance) phase = 'accepted';
    if (replyClaims.length) phase = 'reply-dispatched-unknown';
    if (replyObservation && replyRequest && apiAccepted(replyObservation, replyRequest)) phase = 'api-accepted';
    if (facts.some(fact => fact.kind === 'intake-stop' || fact.kind === 'intake-stop-signal')) {
      if (phase === 'admitted' || phase === 'grounded' || phase === 'accepted') phase = 'held';
    }
    return Object.freeze({ updateId, opening: opening.id, providerRun, replyRun,
      replyPrepared: !!replyRequest,
      phase, inboundCapture, acceptedReply: acceptance ? str(obj(record(acceptance).capture).reference) || null : null });
  });
}

/** Exact Bot API acknowledgement. The returned message must echo the prepared
 * text and target; a local send return or an unrelated response is insufficient. */
export function exactTelegramApiAcceptance(observation: ConversationFact, request: ConversationFact,
  facts: readonly ConversationFact[], capture: (reference: string) => string,
  target: Readonly<{ chatId: string; messageThreadId: number | null }>): boolean {
  const observed = record(observation), requested = record(request);
  if (observed.stage !== 'response' || observed.request !== requested.id) return false;
  const cap = obj(observed.capture);
  const reference = str(cap.reference), hash = str(cap.hash);
  const message = facts.find(fact => fact.kind === 'effect-OutboundMessage'
    && record(fact).id === requested.message);
  if (!message || !reference || !hash) return false;
  try {
    const bytes = capture(reference);
    if (hashBytes(bytes) !== hash) return false;
    const response = obj(JSON.parse(bytes)), result = obj(response.result);
    return response.ok === true && safeInteger(result.message_id) !== null
      && Number(result.message_id) > 0 && String(obj(result.chat).id) === target.chatId
      && (target.messageThreadId === null || result.message_thread_id === target.messageThreadId)
      && result.text === record(message).text;
  } catch { return false; }
}

export interface ContextItem { readonly updateId: number; readonly inboundCapture: string;
  readonly acceptedReply: string | null; readonly pending: boolean }
/** R5 sampler assumption until its owner port lands. The caller must fetch and
 * verify capture bytes; these references never confer permission to read them. */
export function buildConversationContext(all: readonly ConversationTurn[], current: ConversationTurn,
  bytes: (reference: string) => string, maxTurns: number, maxBytes: number): readonly ContextItem[] {
  const selected = all.filter(turn => turn.updateId <= current.updateId);
  if (selected.length > maxTurns) throw new Error('conversation-driver: context turn bound');
  let length = 0;
  return selected.map(turn => {
    length += Buffer.byteLength(bytes(turn.inboundCapture));
    if (turn.acceptedReply) length += Buffer.byteLength(bytes(turn.acceptedReply));
    if (length > maxBytes) throw new Error('conversation-driver: context byte bound');
    return { updateId: turn.updateId, inboundCapture: turn.inboundCapture,
      acceptedReply: turn.acceptedReply, pending: turn.phase === 'provider-dispatched-unknown' };
  });
}

export interface ConversationDriverOperations {
  /** Reads the owners' signed projection; conflicts and taint must fail closed. */
  facts(): readonly ConversationFact[];
  pollOnce(): Promise<void> | void;
  ground(turn: ConversationTurn, context: readonly ContextItem[]): Promise<void> | void;
  /** Invoke guard again at the final physical call edge, after any async prep. */
  dispatchProvider(turn: ConversationTurn, guard: () => void): Promise<void> | void;
  acceptAndPrepareReply(turn: ConversationTurn): Promise<void> | void;
  dispatchReply(turn: ConversationTurn, guard: () => void): Promise<void> | void;
  capture(reference: string): string;
  apiAccepted(observation: ConversationFact, request: ConversationFact,
    facts: readonly ConversationFact[]): boolean;
  readonly admission: SequentialServingAdmission;
  readonly generation: string;
  readonly lease: string;
  readonly expiresAt: number;
  readonly maxContextTurns: number;
  readonly maxContextBytes: number;
  readonly replyLimit: number;
  readonly errorLimit: number;
  readonly totalErrorLimit: number;
  readonly now: () => number;
  readonly stopped: () => boolean;
}
export type StepResult = 'advanced' | 'idle' | 'stopped' | 'bound';

/** Exactly one step at a time, including when callers invoke step concurrently. */
export function createConversationStepper(operations: ConversationDriverOperations) {
  for (const [name, value] of Object.entries({ maxContextTurns: operations.maxContextTurns,
    maxContextBytes: operations.maxContextBytes, replyLimit: operations.replyLimit,
    errorLimit: operations.errorLimit, totalErrorLimit: operations.totalErrorLimit })) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`conversation-driver: invalid ${name}`);
  }
  let busy = false;
  let consecutiveErrors = 0;
  let totalErrors = 0;
  const stop = () => operations.stopped() || operations.now() >= operations.expiresAt
    || consecutiveErrors >= operations.errorLimit || totalErrors >= operations.totalErrorLimit;
  const currentFacts = () => operations.facts();
  const gate = (facts: readonly ConversationFact[], reply = false): StepResult | null => {
    if (stop() || facts.some(fact => fact.kind === 'intake-stop' || fact.kind === 'intake-stop-signal')) return 'stopped';
    if (!operations.admission.current({ generation: operations.generation, lease: operations.lease })) return 'bound';
    if (reply && turns(facts).filter(turn =>
      turn.phase === 'reply-dispatched-unknown' || turn.phase === 'api-accepted').length >= operations.replyLimit) return 'bound';
    return null;
  };
  const requireGate = (reply = false) => {
    const reason = gate(currentFacts(), reply);
    if (reason) throw new Error(`conversation-driver: ${reason}`);
  };
  const step = async (): Promise<StepResult> => {
    if (busy) return 'bound';
    busy = true;
    try {
      let facts = currentFacts();
      const blocked = gate(facts);
      if (blocked) return blocked;
      const all = turns(facts, (observation, request) => operations.apiAccepted(observation, request, facts));
      const turn = all.find(candidate => ['admitted', 'grounded', 'provider-dispatched-answered', 'accepted'].includes(candidate.phase));
      if (!turn) return 'idle';
      if (turn.phase === 'admitted') {
        const context = buildConversationContext(all, turn, operations.capture,
          operations.maxContextTurns, operations.maxContextBytes);
        const admitted = operations.admission.admitTurn({ updateId: turn.updateId, opening: turn.opening,
          generation: operations.generation, lease: operations.lease });
        if (admitted !== 'admitted' && admitted !== 'already-admitted') return 'bound';
        await operations.ground(turn, context);
      } else if (turn.phase === 'grounded') {
        facts = currentFacts(); const denied = gate(facts); if (denied) return denied;
        await operations.dispatchProvider(turn, () => requireGate());
      } else if (turn.phase === 'provider-dispatched-answered') {
        await operations.acceptAndPrepareReply(turn);
      } else if (!turn.replyPrepared) {
        await operations.acceptAndPrepareReply(turn);
      } else {
        facts = currentFacts(); const denied = gate(facts, true); if (denied) return denied;
        await operations.dispatchReply(turn, () => requireGate(true));
      }
      consecutiveErrors = 0;
      return 'advanced';
    } catch (error) {
      consecutiveErrors++; totalErrors++;
      throw error;
    } finally { busy = false; }
  };
  return Object.freeze({ step, stopped: stop, errors: () => ({ consecutiveErrors, totalErrors }),
    noteError: () => { consecutiveErrors++; totalErrors++; },
    noteSuccess: () => { consecutiveErrors = 0; } });
}

export interface ConversationDriverOptions extends Omit<ConversationDriverOperations, 'facts' | 'apiAccepted'> {
  readonly telegramTarget: Readonly<{ chatId: string; messageThreadId: number | null }>;
  readonly maxCycles: number;
  readonly baseBackoffMs: number;
  readonly maxBackoffMs: number;
  /** Ten host scheduler ports; core does not read ambient time or timers. */
  readonly yieldBoundary: () => Promise<void>;
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly signal?: AbortSignal;
  readonly diagnostic?: (record: Readonly<{ reason: 'UNKNOWN'; phase: 'DRAIN' | 'POLL';
    consecutiveErrors: number; totalErrors: number; backoffMs: number }>) => void;
}
const backoff = async (ms: number, options: ConversationDriverOptions, stopped: () => boolean) => {
  const until = options.now() + ms;
  while (!stopped() && options.now() < until)
    await options.sleep(Math.min(100, until - options.now()));
};

/** The host's run method can call this directly after installed boot. All
 * physical actions are passed in through owner-bound operations. */
export async function runConversationDriver(application: ProductionApplication,
  options: ConversationDriverOptions): Promise<void> {
  if (!application?.owners?.composition || options.admission.owner !== 'part-six')
    throw new Error('conversation-driver: installed owner binding absent');
  if (!Number.isSafeInteger(options.maxCycles) || options.maxCycles <= 0
    || !Number.isSafeInteger(options.baseBackoffMs) || options.baseBackoffMs <= 0
    || !Number.isSafeInteger(options.maxBackoffMs) || options.maxBackoffMs < options.baseBackoffMs)
    throw new Error('conversation-driver: invalid loop bounds');
  const facts = (): readonly ConversationFact[] => {
    const projection = take(application.owners.composition.spine.store.readForProjection());
    if (projection.entries.some(entry => entry.taint.length || entry.conflicts.length))
      throw new Error('conversation-driver: owner projection tainted or conflicted');
    return projection.entries.map(entry => entry.fact as ConversationFact);
  };
  const driver = createConversationStepper({ ...options, facts,
    apiAccepted: (observation, request, rows) => exactTelegramApiAcceptance(
      observation, request, rows, options.capture, options.telegramTarget),
    stopped: () => !!options.signal?.aborted || options.stopped() });
  const stopped = () => !!options.signal?.aborted || driver.stopped()
    || facts().some(fact => fact.kind === 'intake-stop' || fact.kind === 'intake-stop-signal');
  for (let cycle = 0; cycle < options.maxCycles && !stopped(); cycle++) {
    let phase: 'DRAIN' | 'POLL' = 'DRAIN';
    try {
      while (!stopped()) {
        await options.yieldBoundary();
        if (await driver.step() !== 'advanced') break;
        await options.yieldBoundary();
      }
      if (stopped()) break;
      phase = 'POLL';
      await options.pollOnce();
      driver.noteSuccess();
      await options.yieldBoundary();
    } catch {
      if (phase === 'POLL') driver.noteError();
      const errors = driver.errors();
      const backoffMs = stopped() ? 0 : Math.min(options.maxBackoffMs,
        options.baseBackoffMs * 2 ** Math.min(errors.consecutiveErrors - 1, 8));
      options.diagnostic?.({ reason: 'UNKNOWN', phase, ...errors, backoffMs });
      if (backoffMs) await backoff(backoffMs, options, stopped);
    }
  }
}
