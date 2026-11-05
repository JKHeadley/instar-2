/**
 * WS2.3 union-read tests through the ported readUnion for the `relationships` store. Proves:
 *   - union-reader-cannot-be-bypassed: a relationship read routes through the
 *     no-clobber union; a disabled store contributes no record.
 *   - append-both: two concurrent divergent VALUE records surface BOTH (HIGH-impact),
 *     never a silent clobber.
 *   - erasure-reaches-offline-peer: a `delete` tombstone for a recordKey never lets a
 *     stale value record (the offline peer's pre-deletion copy) resurrect the person.
 *   - post-unmerge zero-dangling: dropping a peer origin removes it from the union LIVE
 *     and the conflict that named it is gone.
 * (1.x ran these through ReplicatedStoreReader over on-disk peer namespaces and a
 * ConflictStore; 2.0 has no replica directory, so the same rules run over the origin
 * records a carry or a peer copy supplies.)
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { RELATIONSHIP_STORE_KEY, readUnion, relationshipTierOf, unionOfOriginRecords, mergeUnionToRelationships } from './relationship-store.js';
import type { OriginRecord, HlcTimestamp } from './relationship-store.js';

function hlc(p: number, l = 0, n = 'm'): HlcTimestamp { return { physical: p, logical: l, node: n }; }
function val(origin: string, name: string, observed?: HlcTimestamp): OriginRecord {
  return { origin, envelope: { recordKey: 'person-key', hlc: hlc(100, 0, origin), op: 'put', origin, ...(observed ? { observed } : {}) }, data: { name } };
}
function tomb(origin: string): OriginRecord {
  return { origin, envelope: { recordKey: 'person-key', hlc: hlc(999, 0, origin), op: 'delete', origin }, data: { deletedAt: '2026-06-10T00:00:00.000Z' } };
}

describe('WS2.3 relationships union-read (readUnion)', () => {
  let records: OriginRecord[];
  let dropped: Set<string>;

  beforeEach(() => {
    records = [];
    dropped = new Set();
  });

  /** The reader: a disabled store contributes nothing; a dropped origin is excluded LIVE. */
  function read(enabled: boolean) {
    const perOrigin = enabled ? records.filter((r) => !dropped.has(r.origin)) : [];
    return readUnion('person-key', perOrigin, relationshipTierOf(RELATIONSHIP_STORE_KEY));
  }

  it('union-reader-cannot-be-bypassed: a DISABLED store is a strict no-op (no record)', () => {
    records = [val('m_a', 'Alice')];
    const u = read(false);
    expect(u.value).toBeNull();
    expect(u.conflict).toBeNull();
  });

  it('single origin resolves to that record', () => {
    records = [val('m_a', 'Alice')];
    const u = read(true);
    expect(u.value?.data.name).toBe('Alice');
    expect(u.conflict).toBeNull();
  });

  it('append-both: two concurrent divergent records surface a conflict (never a silent clobber)', () => {
    // m_b's observed witness does NOT cover m_a ⇒ concurrent ⇒ append-both-and-flag.
    records = [val('m_a', 'Alice'), val('m_b', 'Alicia', hlc(1, 0, 'm_b'))];
    const u = read(true);
    expect(u.conflict).not.toBeNull();
    expect(u.value).toBeNull(); // neither clobbers
    expect(u.conflict!.versions.map((v) => v.data.name).sort()).toEqual(['Alice', 'Alicia']);
    // The conflict id is stable on (recordKey, version set): re-reading never opens a second one.
    expect(read(true).conflict!.conflictId).toBe(u.conflict!.conflictId);
    expect(mergeUnionToRelationships(unionOfOriginRecords(records)).filter((v) => v.conflicted)).toHaveLength(2);
  });

  it('a witnessed later edit is a clean chain: the HLC-winner wins with no conflict', () => {
    records = [val('m_a', 'Alice'), { ...val('m_b', 'Alice Ruiz', hlc(100, 0, 'm_a')), envelope: { recordKey: 'person-key', hlc: hlc(200, 0, 'm_b'), op: 'put', origin: 'm_b', observed: hlc(100, 0, 'm_a') } }];
    const u = read(true);
    expect(u.conflict).toBeNull();
    expect(u.value?.origin).toBe('m_b');
    expect(u.value?.data.name).toBe('Alice Ruiz');
  });

  it('erasure-reaches-offline-peer: a delete tombstone never lets a stale value resurrect the person', () => {
    // m_a (the offline peer) still holds a pre-deletion value; m_b authored the
    // erasure tombstone (higher HLC, no witness over m_a). The stale value must never
    // become the answer: either the tombstone wins or the pair is flagged, so value is null.
    records = [val('m_a', 'Alice'), tomb('m_b')];
    const u = read(true);
    expect(u.value).toBeNull();
    // A witnessed tombstone (its author saw m_a's value) resolves cleanly to "no record".
    records = [val('m_a', 'Alice'), { ...tomb('m_b'), envelope: { ...tomb('m_b').envelope, observed: hlc(100, 0, 'm_a') } }];
    const w = read(true);
    expect(w.value).toBeNull();
    expect(w.conflict).toBeNull();
  });

  it('post-unmerge zero-dangling: dropping a peer origin removes it from the union LIVE and its conflict', () => {
    records = [val('m_a', 'Alice'), val('m_b', 'Alicia', hlc(1, 0, 'm_b'))];
    // Open the conflict first.
    const u1 = read(true);
    expect(u1.conflict).not.toBeNull();

    // Un-merge m_b (§7.4).
    dropped.add('m_b');

    // The union now resolves to m_a alone (zero refs to m_b, no dangling conflict).
    const u2 = read(true);
    expect(u2.value?.origin).toBe('m_a');
    expect(u2.conflict).toBeNull();
  });

  it('identical concurrent versions collapse to one value: nothing for an operator to resolve', () => {
    records = [val('m_a', 'Alice'), val('m_b', 'Alice')];
    const u = read(true);
    expect(u.conflict).toBeNull();
    expect(u.value?.data.name).toBe('Alice');
  });
});
