/** The durable record of the commitment and beacon modules (src/commitments): one journal frame per
 * write, carrying the changed rows. The projection is the only store; a snapshot carries it verbatim, a
 * replay rebuilds it and replication ships the frames like any other. Nothing here decides anything. */
import type { Commitment } from '../../src/commitments/CommitmentTracker.js';
import type { ForwardDeclaration } from './journal.js';
import type { OutboundProvenance } from './outbound-provenance.js';

export const COMMITMENT_STORE_GENERATION = 7;
const MAX_FRAME_BYTES = 65_536, LEDGER_KEPT = 16;
export type CommitmentStoreRecord = { kind: 'commitment-store'; forward: ForwardDeclaration; at: number;
  rows?: Commitment[]; meta?: { replicationSeq?: number; storeIncarnation?: string; drops?: Record<string, { request: number; clear: number }> };
  highWater?: number; rules?: string | null; hot?: { id: string; value: unknown }[]; aggregates?: { topic: number; value: unknown }[];
  ledger?: Record<string, unknown>;
  /** A send refused before any intent existed: nothing reached the transport. */
  refusal?: { logicalSendId: string; reason: string } };
/** A commitment send's durable signed intent, before the transport; its attempt is `commitment-send:<ordinal>`. */
export type CommitmentSendIntentRecord = { kind: 'commitment-send-intent'; forward: ForwardDeclaration; ordinal: number;
  logicalSendId: string; text: string; chat: string; thread: number; grant: string; effectGrant: string; provenance: OutboundProvenance; at: number };
/** The exact receipt of one attempt. Only this makes it delivered. */
export type CommitmentSendSentRecord = { kind: 'commitment-send-sent'; forward: ForwardDeclaration; ordinal: number; message: number; at: number };
/** A status line's model call, reserved against the journal's call cap before it starts. */
export type CommitmentStatusReserveRecord = { kind: 'commitment-status-reserve'; forward: ForwardDeclaration; ordinal: number; at: number };
export type CommitmentStatusSettledRecord = { kind: 'commitment-status-settled'; forward: ForwardDeclaration; ordinal: number;
  state: 'complete' | 'failed' | 'unknown'; usage?: { inputTokens: number | null; outputTokens: number | null; charge: null; inputComplete?: true }; at: number };
export interface CommitmentSendRow { ordinal: number; logicalSendId: string; text: string; thread: number; effectGrant: string; at: number; sent?: number; sentAt?: number }
export interface CommitmentStoreView {
  /** Frames applied; the host rebuilds from this view when another owner advanced it. */
  frames: number;
  rows: Record<string, Commitment>; order: string[];
  replicationSeq?: number; storeIncarnation?: string; drops?: Record<string, { request: number; clear: number }>;
  highWater: number | null; rules: string | null;
  hot: Record<string, unknown>; aggregates: Record<string, unknown>;
  /** The latest sweep dispositions (Rule 9: what a stale-item sweep decided, readable). */
  ledger: Record<string, unknown>[];
  /** Every send attempt in order. The reply cap bounds it, because each attempt spends one reply. */
  sends: CommitmentSendRow[];
  refusals: number; lastRefusal: { logicalSendId: string; reason: string; at: number } | null;
  /** Status-line calls started, and those without a settled result (their charge stays UNKNOWN). */
  statusCalls: number; statusOpen: number[];
}
export const emptyCommitmentStore = (): CommitmentStoreView => ({ frames: 0, rows: {}, order: [], highWater: null, rules: null, hot: {}, aggregates: {}, ledger: [],
  sends: [], refusals: 0, lastRefusal: null, statusCalls: 0, statusOpen: [] });
export const commitmentSendTarget = (ordinal: number) => `commitment-send:${String(ordinal)}`;
export const commitmentStatusId = (ordinal: number) => `commitment-status:${String(ordinal)}`;

/** Throws when a row could not have been written by the commitment host. */
export function checkCommitmentStoreRecord(row: CommitmentStoreRecord): void {
  const bad = (): never => { throw Error('preview journal: commitment store record refused'); };
  if (row.forward?.additive !== true || row.forward.generation !== COMMITMENT_STORE_GENERATION
    || !Number.isSafeInteger(row.at) || row.at < 0 || Buffer.byteLength(JSON.stringify(row)) > MAX_FRAME_BYTES) bad();
  for (const item of row.rows ?? []) if (typeof item?.id !== 'string' || !item.id || typeof item.status !== 'string'
    || !Number.isSafeInteger(item.version)) bad();
  for (const item of row.hot ?? []) if (typeof item?.id !== 'string' || !item.id) bad();
  for (const item of row.aggregates ?? []) if (!Number.isSafeInteger(item?.topic)) bad();
  if (row.highWater !== undefined && !Number.isSafeInteger(row.highWater)) bad();
  if (row.rules !== undefined && row.rules !== null && typeof row.rules !== 'string') bad();
  if (row.refusal !== undefined && (typeof row.refusal.logicalSendId !== 'string' || typeof row.refusal.reason !== 'string')) bad();
}
const forwardOk = (forward: ForwardDeclaration | undefined) => forward?.additive === true && forward.generation === COMMITMENT_STORE_GENERATION;
export function checkCommitmentSendIntent(view: { genesis: { chat: string; grant: string }; stop: unknown; expires: number; replies: number; limits: { maxReplies: number };
  commitmentStore?: CommitmentStoreView; sendOutcomes: readonly { target: string; outcome: string }[] }, row: CommitmentSendIntentRecord): void {
  const sends = view.commitmentStore?.sends ?? [];
  // The no-duplicate floor, held on replay too: another attempt only after each earlier one definitely reached nobody.
  const open = sends.filter(item => item.logicalSendId === row.logicalSendId).some(item => item.sent !== undefined
    || view.sendOutcomes.find(outcome => outcome.target === commitmentSendTarget(item.ordinal))?.outcome !== 'refused');
  if (!forwardOk(row.forward) || open || row.ordinal !== sends.length || view.stop || row.at >= view.expires || view.replies >= view.limits.maxReplies
    || row.chat !== view.genesis.chat || row.grant !== view.genesis.grant || !Number.isSafeInteger(row.thread) || row.thread <= 0
    || typeof row.logicalSendId !== 'string' || !row.logicalSendId || row.logicalSendId.length > 256
    || typeof row.effectGrant !== 'string' || !row.effectGrant || !row.provenance
    || typeof row.text !== 'string' || !row.text.trim() || Buffer.byteLength(row.text) > 4096)
    throw Error('preview journal: commitment send intent refused');
}
export function applyCommitmentSendIntent(current: CommitmentStoreView | undefined, row: CommitmentSendIntentRecord): CommitmentStoreView {
  const view = current ?? emptyCommitmentStore();
  view.sends.push({ ordinal: row.ordinal, logicalSendId: row.logicalSendId, text: row.text, thread: row.thread, effectGrant: row.effectGrant, at: row.at });
  return view;
}
export function applyCommitmentSendReceipt(view: { commitmentStore?: CommitmentStoreView; sendOutcomes: readonly { target: string; outcome: string }[] }, row: CommitmentSendSentRecord): void {
  const send = view.commitmentStore?.sends[row.ordinal];
  if (!forwardOk(row.forward) || !send || send.sent !== undefined || !Number.isSafeInteger(row.message) || row.message <= 0
    || view.sendOutcomes.some(item => item.target === commitmentSendTarget(row.ordinal) && item.outcome === 'refused'))
    throw Error('preview journal: commitment send receipt refused');
  send.sent = row.message; send.sentAt = row.at;
}
export function applyCommitmentStatusReserve(current: CommitmentStoreView | undefined, row: CommitmentStatusReserveRecord): CommitmentStoreView {
  const view = current ?? emptyCommitmentStore();
  if (!forwardOk(row.forward) || row.ordinal !== view.statusCalls) throw Error('preview journal: commitment status reservation refused');
  view.statusCalls++; view.statusOpen.push(row.ordinal);
  return view;
}
export function applyCommitmentStatusSettled(view: CommitmentStoreView | undefined, row: CommitmentStatusSettledRecord): void {
  if (!forwardOk(row.forward) || !view?.statusOpen.includes(row.ordinal) || !['complete', 'failed', 'unknown'].includes(row.state))
    throw Error('preview journal: commitment status result refused');
  view.statusOpen = view.statusOpen.filter(item => item !== row.ordinal);
}

export function applyCommitmentStoreRecord(current: CommitmentStoreView | undefined, row: CommitmentStoreRecord): CommitmentStoreView {
  const view = current ?? emptyCommitmentStore();
  view.frames++;
  for (const item of row.rows ?? []) {
    if (view.rows[item.id] === undefined) view.order.push(item.id);
    view.rows[item.id] = item;
  }
  if (row.meta) {
    if (row.meta.replicationSeq !== undefined) { view.replicationSeq = row.meta.replicationSeq; view.highWater = Math.max(view.highWater ?? 0, row.meta.replicationSeq); }
    if (row.meta.storeIncarnation !== undefined) view.storeIncarnation = row.meta.storeIncarnation;
    if (row.meta.drops !== undefined) view.drops = row.meta.drops;
  }
  if (row.highWater !== undefined) view.highWater = row.highWater;
  if (row.rules !== undefined) view.rules = row.rules;
  for (const item of row.hot ?? []) view.hot[item.id] = item.value;
  for (const item of row.aggregates ?? []) view.aggregates[String(item.topic)] = item.value;
  if (row.ledger) view.ledger = [...view.ledger, row.ledger].slice(-LEDGER_KEPT);
  if (row.refusal) { view.refusals++; view.lastRefusal = { ...row.refusal, at: row.at }; }
  return view;
}
