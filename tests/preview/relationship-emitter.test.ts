/**
 * Unit — ReplicatedRecordEmitter (WS2 send-side, the generic journal-backed emitter), carried from 1.x.
 *
 * Proves the emitter's contract in isolation with fakes: the dark gate (no resolved disclosure grant ⇒
 * strict no-op), the degenerate guard (null recordKey ⇒ skip), the `observed` witness order (witness
 * read BEFORE the tick ⇒ observed < hlc), and that a builder/journal throw is a counted no-op (never
 * propagates — the manager's local write must never break because replication did). The 2.0 half
 * binds the seams to the encrypted journal: emits become `relationship-emit` frames with contiguous
 * seq and a monotonic clock that survives reopen, and the journal-driven funnel emits a put for every
 * changed person and a tombstone for every forgotten, corrected or merged-away key.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { rmSync } from 'node:fs';

import { ReplicatedRecordEmitter, createRelationshipEmitter, emitRelationshipChanges, journalEmitSink, journalHlcClock, lastEmittedHlc,
  ownWitness, relationshipKindRegistry, tickAfter, type ReplicatedRecordEmitterClock } from './relationship-emitter.js';
import { RELATIONSHIP_RECORD_KIND, RELATIONSHIP_STORE_KEY, buildRelationshipRecordData, compareHlc, deriveRelationshipRecordKey,
  type HlcTimestamp, type RelationshipRecord } from './relationship-store.js';
import { carryOrigin } from './group-carry.js';
import type { DisclosureVerdict } from './group-disclosure.js';
import { openPreviewJournal } from './journal-test-worker.js';
import { now, key, sealKey, scope, records, authority } from './group-carry-fixture.js';
import { resolveGroupDisclosure } from './group-disclosure.js';
import { peopleWorld, place } from './relationship-carry-fixture.js';
import { journalRelationships } from './relationship-journal.js';

const ORIGIN = carryOrigin(scope);
const resolved = (): DisclosureVerdict => { const p = resolveGroupDisclosure(scope, authority(), now, records, sealKey); if (p.kind !== 'resolved') throw Error(p.reason); return p; };
const refused: DisclosureVerdict = { kind: 'refused', reason: 'no group disclosure grant names this root as source' };

/** A real persistence-free HLC clock — monotonic ticks (1.x HybridLogicalClock.tick). */
function clock(nowMs: () => number = () => Date.now()): ReplicatedRecordEmitterClock {
  let last: HlcTimestamp | undefined;
  return { tick: () => { last = tickAfter(last, nowMs(), ORIGIN); return last; } };
}

interface Captured {
  kind: string;
  data: Record<string, unknown>;
}

function makeEmitter(opts: {
  permission: DisclosureVerdict;
  witness?: HlcTimestamp | undefined;
  clockImpl?: ReplicatedRecordEmitterClock;
}): { emitter: ReplicatedRecordEmitter; captured: Captured[] } {
  const captured: Captured[] = [];
  const emitter = new ReplicatedRecordEmitter({
    journal: { emitReplicatedRecord: (kind, data) => { captured.push({ kind, data }); } },
    clock: opts.clockImpl ?? clock(),
    registry: relationshipKindRegistry,
    origin: ORIGIN,
    permission: () => opts.permission,
    loadWitness: () => opts.witness,
  });
  return { emitter, captured };
}

const SAM: RelationshipRecord = { id: 'person:0', name: 'Sam Ruiz', channels: [{ type: 'name', identifier: 'sam ruiz' }],
  firstInteraction: '2026-06-15T00:00:00.000Z', lastInteraction: '2026-06-15T00:00:00.000Z', interactionCount: 1, themes: ['job'],
  notes: 'job: engineer', significance: 1, recentInteractions: [] };
const RK1 = deriveRelationshipRecordKey(SAM.channels)!;
const PUT_BUILD = (hlc: HlcTimestamp, origin: string, observed: HlcTimestamp | undefined): Record<string, unknown> =>
  buildRelationshipRecordData({ record: SAM, origin, hlc, ...(observed !== undefined ? { observed } : {}) })!;

describe('ReplicatedRecordEmitter — dark gate', () => {
  it('is a STRICT no-op when no disclosure grant names this root as a source (default)', () => {
    const { emitter, captured } = makeEmitter({ permission: refused });
    const result = emitter.emit(RELATIONSHIP_STORE_KEY, RK1, PUT_BUILD);
    expect(captured).toHaveLength(0);
    expect(result).toEqual({ outcome: 'disabled', reason: refused.reason });
    expect(emitter.getStats().storeDisabled).toBe(1);
    expect(emitter.getStats().emitted).toBe(0);
  });

  it('honors a live revocation on the next emit without reconstructing the emitter', () => {
    let permission = resolved();
    const captured: Captured[] = [];
    const emitter = new ReplicatedRecordEmitter({ journal: { emitReplicatedRecord: (kind, data) => { captured.push({ kind, data }); } },
      clock: clock(), registry: relationshipKindRegistry, origin: ORIGIN, permission: () => permission, loadWitness: () => undefined });
    expect(emitter.emit(RELATIONSHIP_STORE_KEY, RK1, PUT_BUILD).outcome).toBe('unconfirmed');
    permission = refused;
    expect(emitter.emit(RELATIONSHIP_STORE_KEY, RK1, PUT_BUILD).outcome).toBe('disabled');
    expect(captured).toHaveLength(1);
  });

  it('emits to the store kind when a grant resolves', () => {
    const { emitter, captured } = makeEmitter({ permission: resolved() });
    emitter.emit(RELATIONSHIP_STORE_KEY, RK1, PUT_BUILD);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.kind).toBe(RELATIONSHIP_RECORD_KIND);
    expect(captured[0]!.data.recordKey).toBe(RK1);
    expect(captured[0]!.data.origin).toBe(ORIGIN);
    expect(emitter.getStats().emitted).toBe(1);
  });
});

describe('ReplicatedRecordEmitter — guards', () => {
  it('skips a null/empty recordKey (no stable identity surface)', () => {
    const { emitter, captured } = makeEmitter({ permission: resolved() });
    emitter.emit(RELATIONSHIP_STORE_KEY, null, PUT_BUILD);
    emitter.emit(RELATIONSHIP_STORE_KEY, '', PUT_BUILD);
    expect(captured).toHaveLength(0);
    expect(emitter.getStats().skipped).toBe(2);
  });

  it('skips an unregistered store', () => {
    const { emitter, captured } = makeEmitter({ permission: resolved() });
    emitter.emit('somethingElse', RK1, PUT_BUILD);
    expect(captured).toHaveLength(0);
    expect(emitter.getStats().skipped).toBe(1);
  });

  it('skips when the builder returns null (degenerate record)', () => {
    const { emitter, captured } = makeEmitter({ permission: resolved() });
    emitter.emit(RELATIONSHIP_STORE_KEY, RK1, () => null);
    expect(captured).toHaveLength(0);
    expect(emitter.getStats().skipped).toBe(1);
  });

  it('CATCHES a builder throw — never propagates, counts an error', () => {
    const { emitter, captured } = makeEmitter({ permission: resolved() });
    expect(() => emitter.emit(RELATIONSHIP_STORE_KEY, RK1, () => { throw new Error('over cap'); })).not.toThrow();
    expect(captured).toHaveLength(0);
    expect(emitter.getStats().errors).toBe(1);
  });

  it('CATCHES a journal throw — never propagates', () => {
    const emitter = new ReplicatedRecordEmitter({
      journal: { emitReplicatedRecord: () => { throw new Error('journal boom'); } },
      clock: clock(),
      registry: relationshipKindRegistry,
      origin: ORIGIN,
      permission: resolved,
      loadWitness: () => undefined,
    });
    expect(() => emitter.emit(RELATIONSHIP_STORE_KEY, RK1, PUT_BUILD)).not.toThrow();
    expect(emitter.getStats().errors).toBe(1);
  });

  it('counts a journal refusal as dropped, with the journal\'s own reason', () => {
    const emitter = new ReplicatedRecordEmitter({
      journal: { emitReplicatedRecord: () => 'rejected:oversize' }, clock: clock(), registry: relationshipKindRegistry,
      origin: ORIGIN, permission: resolved, loadWitness: () => undefined,
    });
    expect(emitter.emit(RELATIONSHIP_STORE_KEY, RK1, PUT_BUILD).outcome).toBe('dropped:rejected:oversize');
    expect(emitter.getStats().dropped).toBe(1);
  });
});

describe('ReplicatedRecordEmitter — observed witness (§7.2)', () => {
  it('omits observed on the first write (no prior witness)', () => {
    const { emitter, captured } = makeEmitter({ permission: resolved(), witness: undefined });
    emitter.emit(RELATIONSHIP_STORE_KEY, RK1, PUT_BUILD);
    expect(captured[0]!.data.observed).toBeUndefined();
  });

  it('supplies the prior witness AND ticks strictly after it (observed < hlc)', () => {
    const prior: HlcTimestamp = { physical: 1000, logical: 0, node: 'private-conversation-peer' };
    // A clock seeded so its first tick is strictly after `prior`.
    const c = clock(() => 2000);
    const { emitter, captured } = makeEmitter({ permission: resolved(), witness: prior, clockImpl: c });
    emitter.emit(RELATIONSHIP_STORE_KEY, RK1, PUT_BUILD);
    const observed = captured[0]!.data.observed as HlcTimestamp;
    const hlc = captured[0]!.data.hlc as HlcTimestamp;
    expect(observed).toEqual(prior);
    // The witness is read BEFORE the tick, so the emitted hlc is strictly greater.
    expect(compareHlc(hlc, observed)).toBeGreaterThan(0);
  });

  it('an explicit observed:null replaces the witness read (the after-the-fact writer never saw peers)', () => {
    const { emitter, captured } = makeEmitter({ permission: resolved(), witness: { physical: 5, logical: 0, node: 'x' } });
    emitter.emit(RELATIONSHIP_STORE_KEY, RK1, PUT_BUILD, { observed: null });
    expect(captured[0]!.data.observed).toBeUndefined();
  });
});

describe('ReplicatedRecordEmitter — construction guards', () => {
  it('throws on a null/no-op seam (wiring-integrity)', () => {
    expect(() => new ReplicatedRecordEmitter({
      // @ts-expect-error intentional null seam
      journal: null, clock: clock(), registry: relationshipKindRegistry, origin: ORIGIN, permission: resolved, loadWitness: () => undefined,
    })).toThrow(/journal/);
    expect(() => new ReplicatedRecordEmitter({
      journal: { emitReplicatedRecord: () => {} }, clock: clock(), registry: relationshipKindRegistry, origin: '',
      permission: resolved, loadWitness: () => undefined,
    })).toThrow(/origin/);
    expect(() => new ReplicatedRecordEmitter({
      // @ts-expect-error intentional non-function gate
      journal: { emitReplicatedRecord: () => {} }, clock: clock(), registry: relationshipKindRegistry, origin: ORIGIN, permission: true, loadWitness: () => undefined,
    })).toThrow(/permission/);
  });
});

// ---------------------------------------------------------------------------
// 2.0 — the encrypted journal as own-stream, clock and witness
// ---------------------------------------------------------------------------

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const world = async () => { const dir = place('relationship-emitter-'); dirs.push(dir); return peopleWorld(dir); };

describe('tickAfter (1.x HybridLogicalClock.tick)', () => {
  it('never runs behind the wall clock or the previous tick, and breaks a same-millisecond tie with the logical counter', () => {
    expect(tickAfter(undefined, 1000, ORIGIN)).toEqual({ physical: 1000, logical: 0, node: ORIGIN });
    expect(tickAfter({ physical: 1000, logical: 0, node: ORIGIN }, 1000, ORIGIN)).toEqual({ physical: 1000, logical: 1, node: ORIGIN });
    expect(tickAfter({ physical: 1000, logical: 7, node: ORIGIN }, 900, ORIGIN)).toEqual({ physical: 1000, logical: 8, node: ORIGIN });
    expect(tickAfter({ physical: 1000, logical: 7, node: ORIGIN }, 1001, ORIGIN)).toEqual({ physical: 1001, logical: 0, node: ORIGIN });
  });
});

describe('journal seams', () => {
  it('appends accepted records as contiguous relationship-emit frames, validated by the store schema first, and refuses a foreign kind, an oversize or a malformed record', async () => {
    const w = await world();
    const sink = journalEmitSink(w.source, () => now);
    const c = journalHlcClock(w.source.view, () => now, ORIGIN);
    expect(sink.emitReplicatedRecord('learning-record', PUT_BUILD(c.tick(), ORIGIN, undefined))).toBe('rejected:kind');
    expect(sink.emitReplicatedRecord(RELATIONSHIP_RECORD_KIND, { ...PUT_BUILD(c.tick(), ORIGIN, undefined), name: '<script>' + 'x'.repeat(70_000) })).toBe('rejected:oversize');
    expect(sink.emitReplicatedRecord(RELATIONSHIP_RECORD_KIND, { ...PUT_BUILD(c.tick(), ORIGIN, undefined), interactionCount: 'two' })).toBe('rejected:schema');
    expect(sink.emitReplicatedRecord(RELATIONSHIP_RECORD_KIND, { ...PUT_BUILD(c.tick(), ORIGIN, undefined), origin: '/test/private' })).toBe('rejected:schema');
    expect(w.source.view.relationshipEmits).toHaveLength(0);
    expect(sink.emitReplicatedRecord(RELATIONSHIP_RECORD_KIND, PUT_BUILD(c.tick(), ORIGIN, undefined))).toBe('accepted');
    expect(sink.emitReplicatedRecord(RELATIONSHIP_RECORD_KIND, PUT_BUILD(c.tick(), ORIGIN, lastEmittedHlc(w.source.view)))).toBe('accepted');
    expect(w.source.view.relationshipEmits.map(emit => emit.seq)).toEqual([1, 2]);
    expect(w.source.view.relationshipEmits.every(emit => emit.recordKey === RK1 && emit.op === 'put')).toBe(true);
    // A clock that does not move past the previous emit is refused by the journal (one writer, one order).
    expect(sink.emitReplicatedRecord(RELATIONSHIP_RECORD_KIND, PUT_BUILD(w.source.view.relationshipEmits[0]!.hlc, ORIGIN, undefined))).toBe('rejected:refused');
    // The witness is the newest HLC this root emitted for the key; none for an unknown key.
    expect(ownWitness(w.source.view)(RELATIONSHIP_STORE_KEY, RK1)).toEqual(w.source.view.relationshipEmits[1]!.hlc);
    expect(ownWitness(w.source.view)(RELATIONSHIP_STORE_KEY, 'other')).toBeUndefined();
    // The clock and the stream survive close/reopen: the next tick is after the last emitted HLC.
    w.source.close();
    const reopened = openPreviewJournal(w.path, key);
    expect(reopened.view.relationshipEmits).toHaveLength(2);
    expect(compareHlc(journalHlcClock(reopened.view, () => 0, ORIGIN).tick(), reopened.view.relationshipEmits[1]!.hlc)).toBeGreaterThan(0);
    reopened.close(); w.destination.close();
  });

  it('a forum root and a carried root refuse relationship-emit frames: only the private predecessor emits', async () => {
    const w = await world();
    const sink = journalEmitSink(w.destination, () => now);
    expect(sink.emitReplicatedRecord(RELATIONSHIP_RECORD_KIND, PUT_BUILD(tickAfter(undefined, now, ORIGIN), ORIGIN, undefined))).toBe('rejected:refused');
    expect(w.destination.view.relationshipEmits).toHaveLength(0);
    w.source.close(); w.destination.close();
  });
});

describe('emitRelationshipChanges (the 1.x save funnel, driven from the journal)', () => {
  it('emits a put per person, nothing on an unchanged projection, a put on a new attribute, and a tombstone on a forget', async () => {
    const w = await world();
    const emitter = createRelationshipEmitter(w.source, { now: () => now, origin: ORIGIN, permission: resolved });
    const first = emitRelationshipChanges(w.source, emitter, now, ORIGIN);
    expect(first.puts).toHaveLength(2); expect(first.deletes).toEqual([]);
    expect(w.source.view.relationshipEmits.map(emit => emit.op)).toEqual(['put', 'put']);
    expect(emitRelationshipChanges(w.source, emitter, now + 1, ORIGIN)).toMatchObject({ puts: [], deletes: [], results: [] });
    // A new attribute changes Ana's store fields: one put, with the prior emit as witness.
    w.source.view.personAttributes.push({ name: 'Ana Lima', attribute: 'job', value: 'architect', status: 'current', source: w.ids.ana, quote: 'architect' });
    const second = emitRelationshipChanges(w.source, emitter, now + 2, ORIGIN);
    const anaKey = deriveRelationshipRecordKey([{ type: 'name', identifier: 'ana lima' }])!;
    expect(second.puts).toEqual([anaKey]);
    const ana = w.source.view.relationshipEmits.at(-1)!;
    expect(ana.data.notes).toBe('city: Lisbon; job: architect');
    expect(ana.data.observed).toEqual(w.source.view.relationshipEmits.find(emit => emit.recordKey === anaKey)!.hlc);
    // The operator forgets the Ana mention: her key gets a tombstone; nothing of her travels afterwards.
    w.source.view.memory.push({ mode: 'forget', source: w.ids.ana, trigger: w.ids.ana, quote: 'Ana Lima' });
    const third = emitRelationshipChanges(w.source, emitter, now + 3, ORIGIN);
    expect(third.deletes).toEqual([anaKey]); expect(third.puts).toEqual([]);
    expect(w.source.view.relationshipEmits.at(-1)).toMatchObject({ op: 'delete', recordKey: anaKey });
    expect(JSON.stringify(w.source.view.relationshipEmits.at(-1)!.data)).not.toContain('Ana');
    expect(emitter.getStats()).toMatchObject({ emitted: 4, skipped: 0, errors: 0, dropped: 0 });
    w.source.close(); w.destination.close();
  });

  it('a corrected merge confirmation splits the person: a put per standing name and a tombstone for the merged key', async () => {
    const w = await world();
    const emitter = createRelationshipEmitter(w.source, { now: () => now, origin: ORIGIN, permission: resolved });
    emitRelationshipChanges(w.source, emitter, now, ORIGIN);
    const merged = deriveRelationshipRecordKey([{ type: 'name', identifier: 'sam ruiz' }, { type: 'name', identifier: 'sam' }])!;
    expect(w.source.view.relationshipEmits.some(emit => emit.recordKey === merged)).toBe(true);
    w.source.view.memory.push({ mode: 'correct', source: w.ids.confirm, trigger: w.ids.confirm, quote: 'Actually, Sam Ruiz and Sam are the same person.', replacement: 'They are different people.' });
    const split = emitRelationshipChanges(w.source, emitter, now + 1, ORIGIN);
    expect(split.deletes).toEqual([merged]);
    expect(split.puts.sort()).toEqual([deriveRelationshipRecordKey([{ type: 'name', identifier: 'sam' }])!, deriveRelationshipRecordKey([{ type: 'name', identifier: 'sam ruiz' }])!].sort());
    expect(journalRelationships(w.source.view, now).map(item => item.record.name).sort()).toEqual(['Ana Lima', 'Sam', 'Sam Ruiz']);
    w.source.close(); w.destination.close();
  });

  it('is dark without a grant: the projection changes, nothing is written, the reason is kept', async () => {
    const w = await world();
    const emitter = createRelationshipEmitter(w.source, { now: () => now, origin: ORIGIN, permission: () => refused });
    const result = emitRelationshipChanges(w.source, emitter, now, ORIGIN);
    expect(result.puts).toEqual([]);
    expect(result.results.every(item => item.outcome === 'disabled' && item.reason === refused.reason)).toBe(true);
    expect(w.source.view.relationshipEmits).toHaveLength(0);
    expect(emitter.getStats().storeDisabled).toBe(2);
    w.source.close(); w.destination.close();
  });
});
