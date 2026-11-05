/** Five owns the promise projection. The host persists its enclosing admission/result
 * facts before applying these operations and rebuilds the same projection on replay.
 * Ported from 1.x CommitmentTracker: owner and dependency are separate, one writer,
 * retained closures. The journal already serializes writes; a second CAS queue/store
 * would add no protection. Calendar resolution and authority stay with the adapter. */
export const COMMITMENT_WAITS_ON = ['nothing', 'operator', 'external', 'date'] as const;
export type CommitmentWaitsOn = typeof COMMITMENT_WAITS_ON[number];
export interface AgentPromise<Due> {
  quote: string; action: 'promised' | 'remind' | 'check' | 'follow up' | 'send' | 'tell' | 'update' | 'keep';
  owner: 'agent'; waitsOn: 'next-relevant-reply'; due?: Due;
}
export interface ReplyLoop {
  kind: 'deferral' | 'judgment' | 'promise'; quote: string; waitsOn: CommitmentWaitsOn; deliveryRequest?: string;
}
export interface CommitmentNote<Due> {
  in: 'message' | 'reply'; source: string; quote: string;
  sources?: { source: string; quote: string }[]; agentPromise?: AgentPromise<Due>;
  /** Absent only for legacy records. New admissions require both fields. */
  owner?: 'agent'; waitsOn?: CommitmentWaitsOn; loop?: ReplyLoop['kind'];
  /** Source-bound request; a date or a promise alone grants no send. */
  deliveryRequest?: string;
  /** Exact admitted delegation association, never inferred from a display name.
   * Kept in the existing promise record; closures retain this history. */
  threadline?: { thread: string; edge: string; peer: string; topic: number | null };
}
export interface CommitmentClosure { id: number; source: string; quote: string }
export interface PromiseStore<Due> {
  commitments: CommitmentNote<Due>[];
  closed: Map<number, CommitmentClosure>;
}
/** Stable numeric identities retain the existing journal wire format. Never prune. */
export function createPromiseStore<Due>(): PromiseStore<Due> {
  return { commitments: [], closed: new Map() };
}
/** Admission belongs to the caller's durable fact boundary, not this projection. */
export function recordCommitments<Due>(store: Pick<PromiseStore<Due>, 'commitments'>, notes: readonly CommitmentNote<Due>[]): void {
  store.commitments.push(...notes);
}
export function closeCommitment<Due>(store: PromiseStore<Due>, closure: CommitmentClosure): void {
  store.closed.set(closure.id, closure);
}

/** CommitmentTracker.findByThreadId: only active rows participate. The index
 * is disposable and rebuilt from the retained owner projection after restart. */
const threadIndexes = new WeakMap<object, { count: number; closed: number; active: Map<string, number> }>();
export function findCommitmentByThread<Due>(store: PromiseStore<Due>, thread: string):
  Readonly<{ id: number; note: CommitmentNote<Due> }> | null {
  if (!thread) return null;
  let index = threadIndexes.get(store);
  if (!index || index.count !== store.commitments.length || index.closed !== store.closed.size) {
    const active = new Map<string, number>();
    store.commitments.forEach((note, id) => {
      if (note.threadline && !store.closed.has(id)) active.set(note.threadline.thread, id);
    });
    index = { count: store.commitments.length, closed: store.closed.size, active }; threadIndexes.set(store, index);
  }
  const id = index.active.get(thread), note = id === undefined ? undefined : store.commitments[id];
  return id !== undefined && note?.threadline?.thread === thread && !store.closed.has(id) ? { id, note } : null;
}

/** Origin capture is called only at the durable delegation producer boundary.
 * Like 1.x, an automatic send never overwrites another topic's origin. */
export function recordThreadlineCommitment<Due>(store: PromiseStore<Due>, input: {
  thread: string; edge: string; peer: string; topic: number; source: string; quote: string;
}): void {
  if (![input.thread, input.edge, input.peer, input.source, input.quote].every(value => typeof value === 'string' && value.length > 0)
    || !Number.isSafeInteger(input.topic) || input.topic <= 0) throw Error('commitment: exact delegation origin required');
  const previous = findCommitmentByThread(store, input.thread);
  if (previous) {
    if (previous.note.threadline!.topic !== input.topic || previous.note.threadline!.peer !== input.peer)
      throw Error('commitment: delegation origin or expected peer differs');
    return;
  }
  recordCommitments(store, [{ in: 'reply', source: input.source, quote: input.quote,
    owner: 'agent', waitsOn: 'external', threadline: { thread: input.thread, edge: input.edge, peer: input.peer, topic: input.topic } }]);
}

/** Explicit operator binding changes routing, never authority or completion. */
export function bindThreadlineCommitment<Due>(store: PromiseStore<Due>, thread: string, topic: number): void {
  if (!Number.isSafeInteger(topic) || topic <= 0) throw Error('commitment: exact topic required');
  const found = findCommitmentByThread(store, thread);
  if (found) found.note.threadline!.topic = topic;
}
/** A declaration in the same reply augments the existing promise, never opens a second loop. */
export function recordReplyLoop<Due>(store: PromiseStore<Due>, source: string, loop: ReplyLoop): void {
  const note = store.commitments.find(item => item.in === 'reply' && item.source === source && item.quote === loop.quote);
  if (!note) recordCommitments(store, [{ in: 'reply', source, quote: loop.quote, owner: 'agent', waitsOn: loop.waitsOn, loop: loop.kind,
    ...(loop.deliveryRequest === undefined ? {} : { deliveryRequest: loop.deliveryRequest }) }]);
  else {
    if (note.agentPromise && !note.agentPromise.due && note.waitsOn === undefined)
      Object.assign(note, { owner: 'agent', waitsOn: loop.waitsOn, loop: loop.kind });
    if (loop.deliveryRequest !== undefined) note.deliveryRequest = loop.deliveryRequest;
  }
}

/** Exact durable work facts; a result is distinct from its confirmed delivery. */
export interface PromiseWork {
  last: number; lastSlot: number; inFlight?: number; recoveryHeld?: boolean;
  outcome?: string; waitsOn?: 'operator' | 'external'; turnsSeen?: number;
  failureClass?: string; formatFailures?: number; withheld?: { at: number };
  report?: { delivered?: string; boundTo?: string };
}
export interface PromiseScheduleInput {
  id: number; openedAt: number; sentAt?: number; waitsOn?: CommitmentWaitsOn;
  dueAt: number | null; deliveryRequested: boolean; nextOperatorAt: number | null;
  work: PromiseWork | undefined;
}
export interface ScheduledPromise {
  key: string; kind: 'commitment'; id: number; slot: number;
  inFlight: boolean; awaitingDelivery: boolean; deliveryUnknown: boolean;
}
export const OBLIGATION_FORMAT_RETRY_MS = 2 * 60_000, OBLIGATION_FORMAT_RETRIES = 2;
export const promiseRetryDelay = (work: PromiseWork, revisit: number): number => work.failureClass === 'malformed'
  && (work.formatFailures ?? 0) <= OBLIGATION_FORMAT_RETRIES ? Math.min(revisit, OBLIGATION_FORMAT_RETRY_MS) : revisit;

/** PromiseBeacon's durable-anchor scheduling, with the existing 2.0 uncertainty floor.
 * This selects work only. A timer never closes a promise or authorizes a send. */
export function schedulePromise(input: PromiseScheduleInput, revisit: number): ScheduledPromise | null {
  const { work } = input;
  const pending = work?.report !== undefined && work.report.delivered === undefined;
  const attachable = pending && work!.report!.boundTo === undefined;
  const resume = work?.waitsOn !== undefined && work.inFlight === undefined ? work.waitsOn === 'operator'
    ? Math.max(work.lastSlot + 1, work.outcome === 'uncertain' ? work.last + revisit : 0, input.nextOperatorAt ?? Infinity)
    : work.last + revisit : undefined;
  const first = input.dueAt ?? (input.waitsOn === 'nothing' && input.deliveryRequested ? input.sentAt ?? input.openedAt
    : input.waitsOn !== undefined ? input.openedAt + revisit : undefined);
  const noAccount = work?.outcome === 'uncertain' || work?.outcome === 'failed';
  const rework = work?.withheld !== undefined && work.inFlight === undefined && !pending
    ? Math.max(work.lastSlot + 1, noAccount ? work.last + promiseRetryDelay(work, revisit) : work.withheld.at) : undefined;
  if (work?.inFlight === undefined && first === undefined && resume === undefined && rework === undefined && !pending) return null;
  return { key: `commitment:${input.id}`, kind: 'commitment', id: input.id,
    slot: work?.recoveryHeld ? Infinity : work?.inFlight ?? rework ?? resume
      ?? Math.max(first ?? Infinity, work ? work.last + promiseRetryDelay(work, revisit) : first ?? Infinity),
    inFlight: work?.inFlight !== undefined, awaitingDelivery: attachable, deliveryUnknown: pending && !attachable };
}
