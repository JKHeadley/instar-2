/** The durable record of the commitment and beacon modules (src/commitments): one journal frame per
 * write, carrying the changed rows. The projection is the only store; a snapshot carries it verbatim, a
 * replay rebuilds it and replication ships the frames like any other. Nothing here decides anything. */
import type { Commitment } from '../../src/commitments/CommitmentTracker.js';
import type { ForwardDeclaration } from './journal.js';

export const COMMITMENT_STORE_GENERATION = 7;
const MAX_FRAME_BYTES = 65_536, LEDGER_KEPT = 16;
export type CommitmentStoreRecord = { kind: 'commitment-store'; forward: ForwardDeclaration; at: number;
  rows?: Commitment[]; meta?: { replicationSeq?: number; storeIncarnation?: string; drops?: Record<string, { request: number; clear: number }> };
  highWater?: number; rules?: string | null; hot?: { id: string; value: unknown }[]; aggregates?: { topic: number; value: unknown }[];
  ledger?: Record<string, unknown> };
export interface CommitmentStoreView {
  /** Frames applied; the host rebuilds from this view when another owner advanced it. */
  frames: number;
  rows: Record<string, Commitment>; order: string[];
  replicationSeq?: number; storeIncarnation?: string; drops?: Record<string, { request: number; clear: number }>;
  highWater: number | null; rules: string | null;
  hot: Record<string, unknown>; aggregates: Record<string, unknown>;
  /** The latest sweep dispositions (Rule 9: what a stale-item sweep decided, readable). */
  ledger: Record<string, unknown>[];
}
export const emptyCommitmentStore = (): CommitmentStoreView => ({ frames: 0, rows: {}, order: [], highWater: null, rules: null, hot: {}, aggregates: {}, ledger: [] });

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
  return view;
}
