// Rule 40 on the live path: trimming to a designed bound is a success carrying
// the applied bound (the constitutional Capacity), never a degradation or error.
// Inability to admit work (a hold, a too-long notice) stays a separate outcome.
import { capacityApplied, consumeCapacity, consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import type { PacketDrop } from './journal.js';

export type CapacityView = Readonly<{ outcome: 'success'; capacity: 'none' }
  | { outcome: 'success'; capacity: 'applied'; bound: string; action: string }>;
const view = <T>(result: Result<T>): CapacityView => consumeResult(result, {
  Success: (_value, capacity) => consumeCapacity<CapacityView>(capacity, {
    none: () => ({ outcome: 'success', capacity: 'none' }),
    applied: (bound, action) => ({ outcome: 'success', capacity: 'applied', bound, action }) }),
  Refused: refused => { throw Error(`capacity: ${refused.detail}`); } });

/** The context packet kept within its byte bound by dropping optional evidence. */
export function packetCapacity(dropped: readonly PacketDrop[] | undefined, limitBytes: number): CapacityView | null {
  if (dropped === undefined) return null;
  return view(dropped.length
    ? capacityApplied(dropped, `context-bytes:${limitBytes}`, `kept the packet within bound by omitting ${dropped.length} optional item(s)`)
    : capacityApplied(dropped, '', ''));
}
/** The journal rewritten into a verified snapshot once it passed its size threshold (lossless). */
export function journalCapacity(compacted: boolean, thresholdBytes: number): CapacityView {
  return view(compacted
    ? capacityApplied(true, `journal-bytes:${thresholdBytes}`, 'compacted the append log into a verified snapshot; no record dropped')
    : capacityApplied(false, '', ''));
}
