import { expect, it } from 'vitest';
import { checkpoint, foldProjection, readProjection, rebuildProjection, restoreCheckpoint, signCheckpoint, verifyRebuild } from '../../src/projections/index.js';
import type { ProjectionDefinition, ProjectionGeneration } from '../../src/projections/index.js';
import type { Json } from '../../src/index.js';
import type { FactEnvelope, OwnedShape } from '../../src/facts/index.js';
import { prepareSnapshot, registerOwnedBody } from '../../src/facts/index.js';
import { factsFixture, value, refused, point, privateKey, publicKey } from '../facts/fixtures.js';

// The bounded, data-only path selector (slice-two-gap.md, Option 1). Parts five/six/seven/
// eight place their record under a single `record` field, so a fold could not key on an
// operation id, a settlement outcome or a judgment resolution. This fixture registers an
// owner-shaped fact whose body is `{ record: {...} }` and folds it by `record.<field>`.
const txt = { kind: 'text', maxLength: 80 } as const;
const OWNER = 'part-six', NAME = 'Record';
// The owned decoder requires the record to name its type and schema version, exactly as
// six/seven/eight records do; the fold keys on the domain fields underneath.
const recordShape: OwnedShape = { kind: 'object', fields: {
  type: txt, schemaVersion: { kind: 'integer' },
  operation: txt, amount: txt, outcome: txt, resolution: txt,
  inner: { kind: 'object', fields: { leaf: txt }, optional: ['leaf'] },
}, optional: ['operation', 'amount', 'outcome', 'resolution', 'inner'] };

function pathFixture() {
  const f = factsFixture();
  const registration = value(registerOwnedBody({ name: NAME, owner: OWNER, currentVersion: 1,
    versions: { 1: { validate: (v: Json) => ({ ok: true as const, value: v }) } }, migrations: {},
    decodeCurrent: (input: Json) => ({ ok: true as const, value: input }) }, recordShape, f.c));
  const recordSchema = { kind: 'owner-record', version: 1, fields: { record: { kind: 'owned' as const, owner: OWNER, name: NAME } },
    machineScope: 'shared' as const, standing: 'requester' as const, action: 'work', scope: f.scope,
    causallyBound: false, requiredReferences: [], authority: 'none' as const };
  const ctx = { ...f.ctx, schemas: [f.schema, recordSchema], ownedBodies: [registration] };
  // A fact carrying an owner record under `record`, on a chosen machine/segment/clock.
  const rec = (record: Record<string, unknown>, over: Record<string, unknown> = {}): FactEnvelope =>
    f.fact({ kind: 'owner-record', body: { record: { type: NAME, schemaVersion: 1, ...record } }, ...over }, ctx);
  const onB = { machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 } };
  const def = (decision: Record<string, unknown>): ProjectionDefinition => ({ id: 'p', class: 'informational', stalenessBound: 100,
    retention: 'all-identities', decisions: { 'owner-record': decision } } as unknown as ProjectionDefinition);
  const gen = (heads: Record<string, FactEnvelope>): ProjectionGeneration => ({ reference: f.ctx.decode.register.generation,
    kinds: ['owner-record'], lineages: Object.fromEntries(Object.entries(heads).map(([m, h]) => [m, { head: point(h), observedAt: 100, closed: false }])) });
  const snapshot = (facts: FactEnvelope[]) => value(prepareSnapshot(facts, ctx));
  const fold = (facts: FactEnvelope[], d: ProjectionDefinition, g: ProjectionGeneration) => foldProjection(d, snapshot(facts), g, f.c);
  return { ...f, ctx, rec, onB, def, gen, snapshot, fold };
}

it('P2-NF-53 a six/eight-shaped operation id under record folds as an exact accumulation over a bounded path', () => {
  const f = pathFixture();
  const a = f.rec({ operation: 'op:1', amount: '20' });
  const b = f.rec({ operation: 'op:1', amount: '10' }, f.onB);
  const def = f.def({ kind: 'folds', identity: 'record.operation', value: 'record.amount', merge: 'additive' });
  const view = value(f.fold([a, b], def, f.gen({ 'machine-a': a, 'machine-b': b })));
  // Keyed on the nested operation id, the nested amounts sum — the exact case the gap named.
  expect(view.values['owner-record:op:1']).toBe('30');
  // A 3-segment identity path resolves too (record.inner.leaf).
  const c = f.rec({ inner: { leaf: 'k9' }, amount: '5' });
  const deep = f.def({ kind: 'folds', identity: 'record.inner.leaf', value: 'record.amount', merge: 'additive' });
  expect(value(f.fold([c], deep, f.gen({ 'machine-a': c }))).values['owner-record:k9']).toBe('5');
});

it('P2-NF-51 P2-NF-56 an eight-shaped settlement outcome folds by record path: singleton winner, concurrent writers conflict', () => {
  const f = pathFixture();
  const a = f.rec({ operation: 'op:1', outcome: 'happened' });
  const def = f.def({ kind: 'folds', identity: 'record.operation', value: 'record.outcome', merge: 'exclusive-singleton' });
  // Positive: a single writer to the nested identity presents its nested outcome.
  expect(value(f.fold([a], def, f.gen({ 'machine-a': a }))).values['owner-record:op:1']).toBe('happened');
  // Neighbour: concurrent writers to the same nested identity are a conflict, no winner.
  const c = f.rec({ operation: 'op:1', outcome: 'did-not-happen' }, f.onB);
  const conflicted = value(f.fold([a, c], def, f.gen({ 'machine-a': a, 'machine-b': c })));
  expect(conflicted.values).toEqual({}); expect(conflicted.conflicts).toHaveLength(1);
  refused(readProjection(conflicted, { ...def, class: 'authority-answering' }, f.now, f.c), 'conflicted');
});

it('P2-NF-51 a seven-shaped judgment resolution folds as a set-union under a record path', () => {
  const f = pathFixture();
  const a = f.rec({ operation: 'op:1', resolution: 'granted' });
  const b = f.rec({ operation: 'op:1', resolution: 'noted' }, f.onB);
  const def = f.def({ kind: 'folds', identity: 'record.operation', value: 'record.resolution', merge: 'set-union' });
  const view = value(f.fold([a, b], def, f.gen({ 'machine-a': a, 'machine-b': b })));
  expect(view.values['owner-record:op:1']).toEqual(['granted', 'noted']);
  // Order-invariant: swapping the concurrent inputs yields the identical view.
  expect(value(f.fold([b, a], def, f.gen({ 'machine-a': a, 'machine-b': b })))).toEqual(view);
});

it('P2-NF-48 P2-NF-50 the path selector refuses by neighbour: depth exceeded, non-object mid-path, missing leaf, empty identity', () => {
  const f = pathFixture();
  const a = f.rec({ operation: 'op:1', amount: '5' });
  const g = f.gen({ 'machine-a': a });
  // Depth exceeded (4 segments): a bounded closed language refuses the malformed DEFINITION
  // before folding — not a poison fact, a definition-validity refusal like the merge class.
  refused(f.fold([a], f.def({ kind: 'folds', identity: 'record.inner.leaf.x', value: 'record.amount', merge: 'additive' }), g), 'segments');
  // An empty mid-segment (record..amount) is equally a malformed definition.
  refused(f.fold([a], f.def({ kind: 'folds', identity: 'record..amount', value: 'record.amount', merge: 'additive' }), g), 'segments');
  // A non-object mid-path (record.operation is a string) resolves to nothing → poison fact,
  // quarantined without wedging, exactly as a missing top-level field is today.
  const nonObject = value(f.fold([a], f.def({ kind: 'folds', identity: 'record.operation.sub', value: 'record.amount', merge: 'additive' }), g));
  expect(nonObject.conflicts[0]?.kind).toBe('poison-fact'); expect(nonObject.values).toEqual({});
  // A missing leaf → poison fact.
  const missing = value(f.fold([a], f.def({ kind: 'folds', identity: 'record.nope', value: 'record.amount', merge: 'additive' }), g));
  expect(missing.conflicts[0]?.kind).toBe('poison-fact');
  // A path resolving to an empty-string identity → poison fact (still must satisfy nonempty).
  const empty = f.rec({ operation: '', amount: '5' });
  const emptyView = value(f.fold([empty], f.def({ kind: 'folds', identity: 'record.operation', value: 'record.amount', merge: 'additive' }), f.gen({ 'machine-a': empty })));
  expect(emptyView.conflicts[0]?.kind).toBe('poison-fact');
});

it('P2-NF-57 P2-NF-58 single-segment paths are the top-level degenerate; pathed checkpoints resume and rebuild byte-equal', () => {
  const f = pathFixture();
  // Degenerate: a single-segment path is byte-identical to top-level field access. A plain
  // note folded with identity 'identity'/value 'amount' behaves exactly as before.
  const note = f.fact({ body: { identity: 'one', amount: '7' } }, f.ctx);
  const noteDef = { id: 'n', class: 'informational', stalenessBound: 100, retention: 'all-identities',
    decisions: { note: { kind: 'folds', identity: 'identity', value: 'amount', merge: 'additive' } } } as unknown as ProjectionDefinition;
  const noteGen = { reference: f.ctx.decode.register.generation, kinds: ['note'], lineages: { 'machine-a': { head: point(note), observedAt: 100, closed: false } } };
  expect(value(foldProjection(noteDef, f.snapshot([note]), noteGen, f.c)).values['note:one']).toBe('7');
  // Checkpoint over a prefix, then incremental resume of a suffix, both under a record path.
  const a = f.rec({ operation: 'op:1', amount: '20' }, { at: f.clock(90) });
  const b = f.rec({ operation: 'op:1', amount: '10' }, { at: f.clock(110),
    segment: { machine: 'machine-a', epoch: 0, position: 1 }, prevInSegment: a.contentHash, predecessors: { inSegment: a.id, frontier: {}, required: [] } });
  const def = f.def({ kind: 'folds', identity: 'record.operation', value: 'record.amount', merge: 'additive' });
  const gen = f.gen({ 'machine-a': b });
  const prefix = checkpoint(value(f.fold([a], def, gen)));
  const rebuilt = value(rebuildProjection(def, f.snapshot([a, b]), gen, f.c, [prefix], 1));
  expect(rebuilt.folded).toBe(1); expect(rebuilt.view.values['owner-record:op:1']).toBe('30');
  // The incremental resume is byte-identical to a genesis fold at the same vector.
  const genesis = checkpoint(value(f.fold([a, b], def, gen)));
  expect(value(verifyRebuild(genesis, checkpoint(rebuilt.view), f.c))).toBe('equal');
});

// --- REPAIR1 (astra R1): a Proxy/coercing selector cannot execute callbacks or evade the bound ---
it('P2-NF-49 P2-NF-50 a Proxy/coercing selector is refused without invoking split or coercing a segment (identity and value)', () => {
  const f = pathFixture();
  const a = f.rec({ operation: 'one', amount: '20' });
  const g = f.gen({ 'machine-a': a });
  for (const role of ['identity', 'value'] as const) {
    for (const mode of ['strings', 'coercing-segments', 'depth-switch'] as const) {
      let splits = 0, coercions = 0;
      // A selector whose `split` is a callback that can return coercing objects, or two
      // segments for validation and four for resolution — the validate-two/resolve-four
      // neighbour. Establishing a primitive string first refuses it before any of this runs.
      const selector = new Proxy({ length: 1 }, { get(t, key, r) {
        if (key === 'split') return () => { splits++;
          const segs = mode === 'depth-switch' && splits > 1 ? ['record', 'inner', 'extra', 'leaf'] : ['record', role === 'identity' ? 'operation' : 'amount'];
          return mode === 'coercing-segments' ? segs.map(name => ({ length: 1, [Symbol.toPrimitive]() { coercions++; return name; } })) : segs;
        };
        return Reflect.get(t, key, r);
      } }) as unknown as string;
      const decision = role === 'identity'
        ? { kind: 'folds' as const, identity: selector, value: 'record.amount', merge: 'additive' as const }
        : { kind: 'folds' as const, identity: 'record.operation', value: selector, merge: 'additive' as const };
      refused(f.fold([a], f.def(decision), g), 'primitive string');
      expect(splits).toBe(0); expect(coercions).toBe(0);
    }
  }
});

// --- REPAIR1 (astra R2): pathed checkpoint resume applies genesis poison semantics exactly ---
it('P2-NF-48 P2-NF-57 P2-NF-58 pathed resume quarantines a poison suffix like genesis, byte-equal, incl. signed restore', () => {
  const f = pathFixture();
  const def = f.def({ kind: 'folds', identity: 'record.operation', value: 'record.amount', merge: 'additive' });
  const authority = { ...def, class: 'authority-answering' as const };
  for (const bad of [{ operation: '', amount: '3' }, { amount: '3' }, { operation: 'one' }, { operation: 'one', amount: 'NaN' }]) {
    const a = f.rec({ operation: 'one', amount: '20' }, { at: f.clock(90) });
    const b = f.rec(bad, { at: f.clock(110), segment: { machine: 'machine-a', epoch: 0, position: 1 },
      prevInSegment: a.contentHash, predecessors: { inSegment: a.id, frontier: {}, required: [] } });
    const g = f.gen({ 'machine-a': b });
    const genesis = value(f.fold([a, b], def, g));
    const cp = checkpoint(value(f.fold([a], def, g)));
    // Genesis keeps the good prefix row and records poison for the suffix; an authority read
    // refuses. Resume (budget 2 for two rows) must reproduce that view byte-for-byte.
    expect(genesis.values).toEqual({ 'owner-record:one': '20' });
    expect(genesis.conflicts[0]?.kind).toBe('poison-fact');
    refused(readProjection(genesis, authority, f.now, f.c));
    const resumed = value(rebuildProjection(def, f.snapshot([a, b]), g, f.c, [cp], 2));
    expect(value(verifyRebuild(checkpoint(genesis), checkpoint(resumed.view), f.c))).toBe('equal');
    refused(readProjection(resumed.view, authority, f.now, f.c));
    // The same holds through the public signed-checkpoint restore seam.
    const cert = signCheckpoint(cp, 'p2-cache', privateKey);
    const restored = value(restoreCheckpoint(JSON.parse(JSON.stringify(cert)), f.snapshot([a, b]), f.c, [{ id: 'p2-cache', publicKey }]));
    const restoredResume = value(rebuildProjection(def, f.snapshot([a, b]), g, f.c, [restored], 2));
    expect(value(verifyRebuild(checkpoint(genesis), checkpoint(restoredResume.view), f.c))).toBe('equal');
    refused(readProjection(restoredResume.view, authority, f.now, f.c));
  }
});

// --- REPAIR1 (astra R2, shared path): the same resume fix covers the pre-existing TOP-LEVEL
// single-segment defect that also reproduces on main. ---
it('P2-NF-48 P2-NF-58 the shared resume path also quarantines a top-level single-segment poison suffix, byte-equal', () => {
  const f = pathFixture();
  const noteDef = { id: 'n', class: 'informational', stalenessBound: 100, retention: 'all-identities',
    decisions: { note: { kind: 'folds', identity: 'identity', value: 'amount', merge: 'additive' } } } as unknown as ProjectionDefinition;
  const a = f.fact({ body: { identity: 'one', amount: '20' }, at: f.clock(90) }, f.ctx);
  const b = f.fact({ body: { identity: '', amount: '3' }, at: f.clock(110), segment: { machine: 'machine-a', epoch: 0, position: 1 },
    prevInSegment: a.contentHash, predecessors: { inSegment: a.id, frontier: {}, required: [] } }, f.ctx);
  const g = { reference: f.ctx.decode.register.generation, kinds: ['note'], lineages: { 'machine-a': { head: point(b), observedAt: 100, closed: false } } };
  const genesis = value(foldProjection(noteDef, f.snapshot([a, b]), g, f.c));
  const cp = checkpoint(value(foldProjection(noteDef, f.snapshot([a]), g, f.c)));
  const resumed = value(rebuildProjection(noteDef, f.snapshot([a, b]), g, f.c, [cp], 2));
  expect(genesis.values).toEqual({ 'note:one': '20' }); expect(genesis.conflicts[0]?.kind).toBe('poison-fact');
  expect(resumed.view.conflicts[0]?.kind).toBe('poison-fact');
  expect(value(verifyRebuild(checkpoint(genesis), checkpoint(resumed.view), f.c))).toBe('equal');
});
