// Occam cuts #1-#5: a store keeps each fact's status from when it was derived and derives only new
// facts' statuses. The full prepareSnapshot is the ORACLE: after every step of every sequence below
// (append, concurrent revocation, capture loss, policy change, tamper) the store's snapshot must equal
// a full rebuild byte for byte. The sweep holds the same comparison and refuses a divergence.
import { expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { causalCone, conflictFactSchema, createFactStore, decodeEnvelope, factId, hashBytes, prepareSnapshot, registerOwnedBody, signEnvelope } from '../../src/facts/index.js';
import { causalIndex, historyOf } from '../../src/facts/admission.js';
import type { FactContext, FactEnvelope, FactSchema, OwnedShape, SegmentStoragePort } from '../../src/facts/index.js';
import { canonical, decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { factsFixture, point, privateKey, publicKey, refused, value } from './fixtures.js';

const text = { kind: 'text', maxLength: 80 } as const;
const shape: OwnedShape = { kind: 'object', fields: { type: text, schemaVersion: { kind: 'integer' }, run: text } };
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function setup() {
  const f = factsFixture();
  let refuseOrigin = false, originDecodes = 0, historicalDecodes = 0;
  const owned = value(registerOwnedBody({ name: 'StatusProbe', owner: 'part-five', currentVersion: 1,
    versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {},
    decodeCurrent: (input, context) => {
      if (context.mode === 'origin') { originDecodes++; if (refuseOrigin) return { ok: false, detail: 'probe refuses', reason: 'decode' }; }
      else historicalDecodes++;
      return { ok: true, value: input };
    } }, shape, f.c));
  const cap = 'cap:evidence', capBytes = 'captured evidence bytes';
  const schemas: FactSchema[] = [
    f.schema, conflictFactSchema(f.scope),
    { ...f.schema, kind: 'grant', fields: { grant: { kind: 'constitutional', type: 'StandingGrant' } } },
    { ...f.schema, kind: 'revoke', fields: { rev: { kind: 'constitutional', type: 'Revocation' } } },
    { ...f.schema, kind: 'work', standing: 'delegate', causallyBound: true },
    { ...f.schema, kind: 'captured', fields: { identity: text, evidence: { kind: 'capture' } } },
    { ...f.schema, kind: 'owned', fields: { identity: text, intent: { kind: 'constitutional', type: 'Intent' }, probe: { kind: 'owned', owner: 'part-five', name: 'StatusProbe' } } },
  ];
  const ctx: Mutable<FactContext> = { ...f.ctx, schemas, ownedBodies: [owned],
    captures: { [cap]: { hash: hashBytes(capBytes), bytes: capBytes, byteLength: capBytes.length, status: 'available' } } };
  const rows: string[] = [];
  const storage: SegmentStoragePort = { owner: 'part-ten', read: () => rows.map(r => JSON.parse(r) as unknown),
    append: bytes => { rows.push(bytes); return f.success({ kind: 'local-durable' as const }); } };
  // Conflicts are recorded as signed facts, exactly as in production.
  const observer = f.principal('conflict-observer', 'system');
  const conflictAppender = { owner: 'part-ten' as const, machine: 'machine-a', principal: observer, provenance: observer.provenance,
    clock: () => f.now, sign: (wire: Json) => f.success(signEnvelope(wire, privateKey)) };
  const store = createFactStore(ctx, storage, { conflictAppender });
  let grantFact: FactEnvelope | undefined, n = 0;
  // Decoding an Intent registers its subject in the shared decode context (a policy change), so
  // every Intent is decoded before the store is first read.
  const intents = Array.from({ length: 400 }, (_, i) => value(decode('Intent', f.intentInput({ id: `i${i}` }), f.ctx.decode)));
  function append(kind: string, overrides: Record<string, unknown> = {}, machine = 'machine-a'): FactEnvelope {
    const head = value(store.read()).filter(fact => fact.machine === machine).at(-1), i = n++;
    const intent = intents[i];
    const body: Record<string, Json | object> = kind === 'grant' ? { grant: f.g }
      : kind === 'captured' ? { identity: `c${i}`, evidence: { reference: cap, hash: hashBytes(capBytes) } }
      : kind === 'owned' ? { identity: `o${i}`, intent: intent!, probe: { type: 'StatusProbe', schemaVersion: 1, run: `run:${i}` } }
      : { identity: `n${i}`, amount: '10' };
    const wire = f.wire({ kind, body, segment: { machine, epoch: 0, position: head ? head.segment.position + 1 : 0 },
      prevInSegment: head ? head.contentHash : ctx.genesis.hash, provenance: kind === 'grant' ? f.g.source : f.alice.provenance,
      predecessors: { inSegment: head?.id ?? null, frontier: {}, required: kind === 'work' && grantFact ? [grantFact.id] : [] }, ...overrides }, ctx);
    const fact = value(store.append(wire, { peer: machine })).fact;
    if (kind === 'grant') grantFact = fact;
    return fact;
  }
  function revoke(): FactEnvelope {
    // A revocation concurrent with machine-a's later work: it causally follows only the grant.
    const payload = { id: 'r-1', grantId: f.g.id, by: f.alice, at: f.now, reason: 'revoked' }, proof = f.proof(payload);
    const rev = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1, ...payload, source: proof.p }, { ...f.ctx.decode, now: f.now, provenance: proof.p }));
    return append('revoke', { body: { rev }, provenance: proof.p, predecessors: { inSegment: null, frontier: {}, required: [grantFact!.id] } }, 'machine-b');
  }
  const bytes = (entries: unknown) => value(canonical(entries)).bytes;
  /** The store's (incremental) snapshot must equal a full rebuild over the same facts, byte for byte. */
  function matchesOracle() {
    const incremental = value(store.readForProjection());
    const oracle = value(prepareSnapshot(value(store.read()), ctx));
    expect(incremental.entries.length).toBe(value(store.read()).length);
    expect(bytes(incremental.entries)).toBe(bytes(oracle.entries));
    return incremental;
  }
  const statusOf = (id: string) => matchesOracle().entries.find(e => e.fact.id === id)!;
  return { f, ctx, rows, store, append, revoke, matchesOracle, statusOf, bytes,
    refuseOrigin: (on: boolean) => { refuseOrigin = on; }, originDecodes: () => originDecodes, historicalDecodes: () => historicalDecodes };
}

it('P2-OCC-01 every append leaves the running statuses byte-equal to a full rebuild', () => {
  const s = setup();
  for (const kind of ['grant', 'note', 'work', 'captured', 'owned', 'work', 'note', 'owned']) { s.append(kind); s.matchesOracle(); }
  // Unchanged reads return the same issued snapshot; an append derives only the new status.
  const first = value(s.store.readForProjection());
  expect(value(s.store.readForProjection())).toBe(first);
  const owned = s.matchesOracle().entries.filter(e => e.fact.kind === 'owned');
  expect(owned.every(e => e.constitutional.length === 1)).toBe(true);
});

it('P2-OCC-02 a concurrent revocation re-derives the earlier facts that rely on the grant', () => {
  const s = setup();
  s.append('grant'); const work = s.append('work'); s.append('note');
  const before = s.statusOf(work.id);
  expect(before.conflicts).toEqual([]);
  s.revoke();
  const after = s.statusOf(work.id);
  expect(value(s.store.read()).some(fact => fact.kind === 'conflict-record')).toBe(true);
  // The earlier status changed (so the rebuild trigger is load-bearing), and matches the oracle.
  expect(after.conflicts.map(c => c.kind)).toEqual(['revocation-conflict']);
  expect(after.taint).toEqual(['contested']);
  // Machine-a's next fact follows the recorded conflict, so it has seen the revocation.
  s.append('note'); s.matchesOracle();
  expect(value(s.store.readForProjection()).entries.find(e => e.fact.id === work.id)!.conflicts.map(c => c.kind)).toEqual(['revocation-conflict']);
});

it('P2-OCC-03 capture loss re-derives earlier statuses; recovery re-derives them back', () => {
  const s = setup();
  s.append('grant'); const captured = s.append('captured'); s.append('note');
  expect(s.statusOf(captured.id).taint).toEqual([]);
  const available = s.ctx.captures['cap:evidence']!;
  (s.ctx.captures as Record<string, unknown>)['cap:evidence'] = { ...available, bytes: null, status: 'expired' };
  expect(s.statusOf(captured.id).taint).toEqual(['evidence-unavailable']);
  s.append('captured'); s.matchesOracle();
  (s.ctx.captures as Record<string, unknown>)['cap:evidence'] = available;
  expect(s.statusOf(captured.id).taint).toEqual([]);
});

it('P2-OCC-04 a schema migration (policy change) re-derives every earlier status', () => {
  const s = setup();
  s.append('grant'); const note = s.append('note'); s.append('work');
  expect(s.statusOf(note.id).body).toEqual({ identity: 'n1', amount: '10' });
  s.ctx.schemas = [...s.ctx.schemas, { ...s.f.schema, version: 2, optional: ['label'], fields: { ...s.f.schema.fields, label: text } }];
  s.ctx.migrations = [{ kind: 'note', from: 1, to: 2, migrate: body => ({ ...(body as Record<string, Json>), label: 'migrated' }) }];
  expect(s.statusOf(note.id).body).toEqual({ identity: 'n1', amount: '10', label: 'migrated' });
  s.append('note'); s.matchesOracle();
});

it('P2-OCC-05 tampered, truncated or reordered storage refuses; the restored history matches the oracle', () => {
  const s = setup();
  s.append('grant'); s.append('note'); s.append('work'); s.matchesOracle();
  const original = [...s.rows];
  const restore = () => { s.rows.splice(0, s.rows.length, ...original); value(s.store.sweep()); s.matchesOracle(); };
  s.rows[1] = s.rows[1]!.replace('"amount":"10"', '"amount":"11"');
  refused(s.store.readForProjection(), 'prefix changed'); refused(s.store.sweep(), 'hash mismatch');
  restore();
  s.rows.splice(0, s.rows.length, ...original.slice(0, 2));
  refused(s.store.readForProjection(), 'truncated');
  restore();
  s.rows.splice(0, s.rows.length, original[1]!, original[0]!, original[2]!);
  refused(s.store.readForProjection(), 'prefix changed');
  restore();
});

it('P2-OCC-06 an owned decoder that reads live state is re-run, never retained', () => {
  const s = setup();
  s.append('grant'); const owned = s.append('owned'); s.append('note');
  expect(s.statusOf(owned.id).constitutional).toHaveLength(1);
  // The owned decoder's live answer changes with no policy change and no revocation. An ordinary
  // note is appended BEFORE the next read: the running snapshot must drop the old constitutional
  // value exactly as the full rebuild does.
  s.refuseOrigin(true);
  s.append('note');
  expect(s.statusOf(owned.id).constitutional).toHaveLength(0);
  value(s.store.sweep()); s.matchesOracle();
  // Both sides: when the decoder accepts again, the next derivation restores the value.
  s.refuseOrigin(false);
  s.append('note');
  expect(s.statusOf(owned.id).constitutional).toHaveLength(1);
  value(s.store.sweep());
});

it('P2-OCC-08 the sweep refuses running statuses that a full rebuild contradicts (a forgotten trigger)', () => {
  const s = setup();
  const label = (name: string) => ({ kind: 'note', from: 1, to: 2, migrate: (body: Json) => ({ ...(body as Record<string, Json>), label: name }) });
  s.ctx.schemas = [...s.ctx.schemas, { ...s.f.schema, version: 2, optional: ['label'], fields: { ...s.f.schema.fields, label: text } }];
  s.ctx.migrations = [label('first')];
  s.append('grant'); const note = s.append('note'); s.append('work');
  expect(s.statusOf(note.id).body).toEqual({ identity: 'n1', amount: '10', label: 'first' });
  value(s.store.sweep()); // positive neighbour: agreement passes
  s.matchesOracle();
  // An input no rebuild trigger names changes: the migration list is edited in place, so its
  // identity (the only thing the running snapshot compares) is unchanged. Only the oracle notices.
  (s.ctx.migrations as unknown as unknown[])[0] = label('second');
  expect(value(s.store.readForProjection()).entries.find(e => e.fact.id === note.id)!.body).toEqual({ identity: 'n1', amount: '10', label: 'first' });
  refused(s.store.sweep(), 'differ from a full rebuild');
  // Published the supported way (a new migration list), every path re-derives and agrees.
  s.ctx.migrations = [...s.ctx.migrations];
  expect(s.statusOf(note.id).body).toEqual({ identity: 'n1', amount: '10', label: 'second' });
  value(s.store.sweep());
});

it('P2-OCC-09 machines named like Object.prototype properties keep their signed history', () => {
  const f = factsFixture();
  const names = ['constructor', 'toString', '__proto__'];
  const ctx: FactContext = { ...f.ctx, keys: [...f.ctx.keys, ...names.map(machine => ({ id: `${machine}-key`, machine, publicKey, from: { epoch: 0, position: 0 } }))],
    decode: { ...f.ctx.decode, register: { ...f.ctx.decode.register, keys: { ...f.ctx.decode.register.keys,
      ...Object.fromEntries(names.map(machine => [`${machine}-key`, { algorithm: 'ed25519' as const, owner: machine, publicKey, methods: ['fact-envelope'], adapters: ['host'] }])) } } } };
  const make = (machine: string, position: number, prev: FactEnvelope | undefined, frontier: Record<string, unknown> = {}): FactEnvelope => {
    const segment = { machine, epoch: 0, position };
    return value(decodeEnvelope(signEnvelope({ type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind: 'note', schemaVersion: 1, at: f.now,
      machine, principal: f.alice, provenance: f.alice.provenance, segment, prevInSegment: prev ? prev.contentHash : ctx.genesis.hash,
      predecessors: { inSegment: prev?.id ?? null, frontier, required: [] }, body: { identity: `${machine}:${position}`, amount: '10' } }, privateKey), ctx));
  };
  for (const machine of names) {
    const m0 = make(machine, 0, undefined), m1 = make(machine, 1, m0);
    const a0 = make('machine-a', 0, undefined);
    const frontier: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    frontier[machine] = point(m1);
    const a1 = make('machine-a', 1, a0, frontier), facts = [m0, m1, a0, a1], index = causalIndex(facts);
    expect(Object.keys(a1.predecessors.frontier)).toEqual([machine]);
    // The index answers by position (no fallback) and agrees with the walk.
    expect(index.frontierOf(a1)).toBeDefined();
    const inHistory = historyOf(a1, facts, index);
    expect([inHistory(m0.id), inHistory(m1.id), inHistory(a0.id), inHistory(a1.id)]).toEqual([m0, m1, a0, undefined]);
    expect(index.coneSize(a1)).toBe(causalCone(a1, facts).length);
    expect(index.coneSize(a1)).toBe(3);
    // Head identity names the machine's head, so a history that stops earlier differs.
    expect(index.coneHeads(a1)).toEqual([a0.contentHash, m1.contentHash].sort());
    const early: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    early[machine] = point(m0);
    const b1 = make('machine-a', 1, a0, early);
    expect(index.coneHeads(b1)).toEqual([a0.contentHash, m0.contentHash].sort());
    expect(index.coneSize(b1)).toBe(causalCone(b1, [m0, m1, a0, b1]).length);
  }
});

function history(size: number) {
  const s = setup();
  s.append('grant');
  const kinds = ['note', 'work', 'owned', 'captured'];
  while (s.rows.length < size) s.append(kinds[s.rows.length % kinds.length]!);
  value(s.store.readForProjection());
  const decodes: number[] = [], live: number[] = [], times: number[] = [];
  function turn() {
    const count = s.historicalDecodes(), origin = s.originDecodes(), started = performance.now();
    s.append('owned'); value(s.store.readForProjection()); value(s.store.readForProjection());
    times.push(performance.now() - started); decodes.push(s.historicalDecodes() - count);
    // The live owned decode is re-run for every owned fact on each derivation, plus the append's own.
    live.push(s.originDecodes() - origin - value(s.store.read()).filter(f => f.kind === 'owned').length);
  }
  return { turn, decodes, live, times };
}

it('P2-OCC-07 per-turn work tracks the new facts, not the history size', () => {
  // Each history runs its turns in turn (two live stores interleaved share decode state and change
  // the counts). The fastest turn is each side's cost with the least outside interference: a load
  // spike only ever slows a turn, and a median of five turns once read 3.2x on a busy gate host.
  const small = history(50);
  for (let i = 0; i < 9; i++) small.turn();
  const large = history(200);
  for (let i = 0; i < 9; i++) large.turn();
  // Deterministic: a turn derives the new fact's full status once, whatever the history size
  // (historical decodes of earlier facts are kept); only the live owned decode is linear.
  expect(large.decodes).toEqual(small.decodes);
  expect(large.live).toEqual(small.live);
  // Ratio bound, not seconds: 4x the history costs under 3x per turn (measured ~1.8x; the kept
  // per-read storage comparison is linear). Re-deriving every status per turn measured ~3.4x here.
  expect(Math.min(...large.times) / Math.min(...small.times)).toBeLessThan(3);
}, 120_000);
