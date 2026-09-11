/** Additive Part Four seam: an unreadable pending-input inventory is never an empty queue. */
export interface PendingInputCustodyReader {
  readonly owner: 'part-four';
  enumerate(): readonly string[];
}

export type PendingInputCustodyView = Readonly<
  | { state: 'readable'; pending: readonly string[]; permitsNextAction: boolean; reason: string }
  | { state: 'unknown'; pending: readonly string[]; permitsNextAction: false; reason: string }
>;

export function inspectPendingInputCustody(
  reader: PendingInputCustodyReader,
  retainedPending: readonly string[],
): PendingInputCustodyView {
  if (reader.owner !== 'part-four') throw new Error('pending-input custody requires its Part Four owner');
  const retained = Object.freeze([...new Set(retainedPending)]);
  try {
    const enumerated = Object.freeze([...new Set(reader.enumerate())]);
    const pending = Object.freeze([...new Set([...retained, ...enumerated])]);
    return Object.freeze({ state: 'readable' as const, pending, permitsNextAction: pending.length === 0,
      reason: pending.length ? 'durable pending input remains owned' : 'owner enumeration established an empty pending set' });
  } catch (error) {
    return Object.freeze({ state: 'unknown' as const, pending: retained, permitsNextAction: false,
      reason: `pending-input enumeration failed; retained custody remains pending: ${error instanceof Error ? error.message : 'unknown error'}` });
  }
}
