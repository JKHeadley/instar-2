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
