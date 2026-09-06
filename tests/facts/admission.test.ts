import { expect, it } from 'vitest';
import { decode, compare } from '../../src/index.js';
import { causalStanding, causalCone, decodeBody, decodeEnvelope, reconcileAuthority, validateRepair, verifyAndAdmit, PendingSet, RefusalStore, redactCapture } from '../../src/facts/index.js';
import type { FactContext } from '../../src/facts/index.js';
import { factsFixture, value, refused, json, point } from './fixtures.js';

function standing() {
  const f = factsFixture(), root = f.fact();
  const schema = { ...f.schema, standing: 'operator' as const, causallyBound: true, requiredReferences: [root.id], authority: 'conferring' as const };
  const ctx: FactContext = { ...f.ctx, schemas: [schema], facts: [root], grants: [{ factId: root.id, grant: f.g }], folded: { 'machine-a': point(root) } };
  const candidate = f.next(root, { predecessors: { inSegment: root.id, frontier: { 'machine-a': point(root) }, required: [root.id] } }, ctx);
  return { ...f, root, ctx, candidate };
}
it('P2-NF-04 authority-bearing facts refuse channel-attested provenance', () => {
  const f = standing(), attested = f.principal('guest', 'person', true);
  const candidate = f.next(f.root, { principal: attested, provenance: attested.provenance, predecessors: f.candidate.predecessors }, f.ctx);
  expect(() => causalStanding(candidate, f.ctx, true)).toThrow('verified provenance');
});
it('P2-NF-23 a standing kind cannot omit its mandatory named reference', () => {
  const f = standing(), candidate = f.next(f.root, {}, f.ctx); expect(() => causalStanding(candidate, f.ctx, true)).toThrow('missing registry-declared');
});
it('P2-NF-25 unresolved replication references hold, deduplicate, escalate, and never vanish', () => {
  const f = factsFixture(), pending = new PendingSet(2, 1, 10), input = json(f.wire());
  expect(value(pending.hold(input, 'machine-a', 'grant:absent', 0, f.c))).toBe('held');
  expect(value(pending.hold(input, 'machine-a', 'grant:absent', 1, f.c))).toBe('duplicate');
  refused(pending.hold({ other: true }, 'machine-a', 'other', 2, f.c), 'capacity');
  expect(pending.expire(10)[0]?.kind).toBe('pending-expired'); expect(pending.depth).toBe(1); expect(pending.expire(11)).toEqual([]);
  const ready = pending.ready('grant:absent')[0]!; expect(ready.input).toEqual(input); pending.acknowledge(ready.key, ready.key); expect(pending.depth).toBe(0);
});
it('P2-NF-26 appender needs live covering standing', () => { const f = standing(); expect(() => causalStanding(f.candidate, { ...f.ctx, grants: [] }, true)).toThrow(); expect(causalStanding(f.candidate, f.ctx, true).taint).toEqual([]); });
it('P2-NF-27 requester cannot append authority-conferring facts', () => {
  const f = factsFixture(), ctx = { ...f.ctx, schemas: [{ ...f.schema, authority: 'conferring' as const }] };
  expect(() => causalStanding(f.fact({}, ctx), ctx, true)).toThrow('requester cannot');
});
it('P2-NF-28 constitutional fields run the actual part-one decoder with pinned provenance', () => {
  const f = factsFixture(), ctx = { ...f.ctx, schemas: [{ ...f.schema, fields: { value: { kind: 'constitutional' as const, type: 'VerifiedPrincipal' as const } } }] };
  const bad = f.fact({ body: { value: { type: 'VerifiedPrincipal', schemaVersion: 1, id: 'impostor', kind: 'person' } } }, ctx);
  refused(decodeBody(bad, ctx, ctx.decode), 'disagree');
  const good = f.fact({ body: { value: { type: 'VerifiedPrincipal', schemaVersion: 1, id: 'alice', kind: 'person' } } }, ctx);
  expect(value(decodeBody(good, ctx, ctx.decode)).value).toMatchObject({ id: 'alice' });
});
it('P2-NF-28 authority bodies consume action provenance separately from principal identity evidence', () => {
  const f = factsFixture();
  for (const [type, valueInBody, provenance] of [['StandingGrant', f.g, f.g.source], ['Authorization', f.authorization, f.authorization.explicitYes]] as const) {
    const ctx = { ...f.ctx, decode: { ...f.ctx.decode, provenance }, schemas: [{ ...f.schema, fields: { value: { kind: 'constitutional' as const, type } } }] };
    const fact = f.fact({ provenance, body: { value: valueInBody } }, ctx);
    expect(value(decodeBody(fact, ctx, ctx.decode)).value).toEqual(valueInBody);
  }
});
it('P2-NF-30 refusal storage never retains body bytes and coalesces repeated failures', () => {
  const store = new RefusalStore(2, 10, 2);
  const input = { hash: 'abc', reason: 'policy' as const, source: 'peer', byteLength: 42, body: 'sensitive-body' };
  store.record(input, 0); store.record(input, 1);
  expect(JSON.stringify(store.snapshot())).not.toContain('sensitive-body'); expect(store.snapshot().rows[0]?.count).toBe(2);
});
it('P2-NF-31 both local stores refuse absent bounds; saturated refusals retain aggregates', () => {
  expect(() => new RefusalStore(0, 10, 1)).toThrow(); expect(() => new PendingSet(2, 0, 10)).toThrow();
  const store = new RefusalStore(1, 10, 1);
  for (let i = 0; i < 100; i++) store.record({ hash: String(i), source: String(i), reason: 'decode', byteLength: 1 }, i);
  expect(store.snapshot().rows).toHaveLength(1); expect(store.snapshot().aggregates.reduce((n, a) => n + a.count, 0)).toBe(100);
});
it('P2-NF-32 retraction cannot use less standing than the target', () => {
  const f = standing(), schema = { ...f.schema, kind: 'retraction' }, ctx = { ...f.ctx, schemas: [...f.ctx.schemas, schema] };
  const repair = f.next(f.root, { kind: 'retraction', body: { target: f.root.id, reason: 'wrong' } }, ctx);
  expect(() => validateRepair(repair, ctx)).toThrow('less standing');
});
it('P2-NF-33 correction of authority requires original grant standing', () => {
  const f = standing(), schema = { ...f.schema, version: 2, standing: 'delegate' as const }, ctx = { ...f.ctx, schemas: [...f.ctx.schemas, schema] };
  const repair = f.next(f.root, { schemaVersion: 2, body: { corrects: f.root.id } }, ctx); expect(() => validateRepair(repair, ctx)).toThrow('less standing');
});
it('P2-NF-72 P2-NF-75 transitive frontier and epoch edges preserve the same later-revocation verdict', () => {
  const f = standing(), payload = { id: 'rev', grantId: f.g.id, by: f.alice, at: f.now, reason: 'revoked' }, proof = f.proof(payload);
  const revocation = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1, ...payload, source: proof.p }, { ...f.ctx.decode, provenance: proof.p }));
  const bridge = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, predecessors: { inSegment: null, required: [], frontier: { 'machine-a': point(f.candidate) } } });
  for (const epoch of [0, 1]) for (const redundant of [false, true]) {
    const frontier = { ...(epoch ? { 'machine-b': point(bridge) } : {}), ...(redundant ? { 'machine-a': point(f.candidate) } : {}) };
    const rev = f.next(bridge, { segment: { machine: 'machine-b', epoch, position: epoch ? 0 : 1 }, predecessors: { inSegment: epoch ? null : bridge.id, required: [], frontier } });
    const ctx = { ...f.ctx, facts: [f.root, f.candidate, bridge, rev], revocations: [{ factId: rev.id, revocation }], folded: { 'machine-a': point(f.candidate), 'machine-b': point(rev) } };
    expect(causalCone(rev, ctx.facts).map(f => f.id)).toContain(f.candidate.id);
    expect(reconcileAuthority(f.candidate, ctx, ctx.folded)).toEqual({ taint: [], conflicts: [] });
  }
});
it('P2-NF-37 redaction refuses non-operator standing', () => {
  const f = factsFixture(), ctx = { ...f.ctx, schemas: [{ ...f.schema, kind: 'redaction' }] }, fact = f.fact({ kind: 'redaction', body: { reference: 'cap', reason: 'erasure-obligation' } }, ctx);
  refused(redactCapture(fact, { ...ctx, facts: [fact] }, f.clock(1000), 10, []), 'operator standing');
});
it('P2-NF-65 capture byte removal requires a permanently recorded tombstone', () => {
  const f = factsFixture(), ctx = { ...f.ctx, schemas: [{ ...f.schema, kind: 'redaction' }] }, fact = f.fact({ kind: 'redaction', body: { reference: 'cap', reason: 'erasure-obligation' } }, ctx);
  refused(redactCapture(fact, ctx, f.clock(1000), 10, []), 'permanent tombstone');
});
it('P2-NF-66 redaction reason must be on the closed list', () => {
  const f = factsFixture(), ctx = { ...f.ctx, schemas: [{ ...f.schema, kind: 'redaction' }] }, fact = f.fact({ kind: 'redaction', body: { reference: 'cap', reason: 'hide bad results' } }, ctx);
  refused(redactCapture(fact, { ...ctx, facts: [fact] }, f.clock(1000), 10, []), 'closed list');
});
it('P2-NF-67 authorization, conflict and judgment evidence remains protected', () => {
  const f = standing(), schema = { ...f.ctx.schemas[0]!, kind: 'redaction' }, ctx = { ...f.ctx, schemas: [...f.ctx.schemas, schema] };
  const fact = f.next(f.root, { kind: 'redaction', predecessors: f.candidate.predecessors, body: { reference: 'cap', reason: 'erasure-obligation' } }, ctx);
  for (const kind of ['authorization', 'open-conflict', 'unresolved-judgment'] as const) refused(redactCapture(fact, { ...ctx, facts: [f.root, fact] }, f.clock(1000), 10, [{ reference: 'cap', factId: f.root.id, kind }]), 'protected');
});
it('P2-NF-68 a retraction with no reason refuses', () => {
  const f = factsFixture(), root = f.fact(), ctx = { ...f.ctx, facts: [root], schemas: [...f.ctx.schemas, { ...f.schema, kind: 'retraction' }] };
  const repair = f.next(root, { kind: 'retraction', body: { target: root.id } }, ctx); expect(() => validateRepair(repair, ctx)).toThrow('reason');
});
it('P2-NF-72 appender clocks do not select standing; cone revocations override backdating', () => {
  const f = standing(), payload = { id: 'rev', grantId: f.g.id, by: f.alice, at: f.now, reason: 'revoked' }, proof = f.proof(payload);
  const revocation = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1, ...payload, source: proof.p }, { ...f.ctx.decode, provenance: proof.p }));
  const revFact = f.next(f.root, {}, f.ctx), ctx = { ...f.ctx, facts: [f.root, revFact], revocations: [{ factId: revFact.id, revocation }] };
  const candidate = f.next(revFact, { at: f.clock(1), predecessors: { inSegment: revFact.id, frontier: {}, required: [f.root.id] } }, ctx);
  expect(() => causalStanding(candidate, ctx, false)).toThrow('no live');
  expect(causalStanding(f.candidate, f.ctx, false).now.value).toBe(f.ctx.genesis.clock.value);
});
it('P2-NF-77 origin refuses omitting a relevant revocation it already folded', () => {
  const f = standing(), payload = { id: 'rev', grantId: f.g.id, by: f.alice, at: f.now, reason: 'revoked' }, proof = f.proof(payload);
  const revocation = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1, ...payload, source: proof.p }, { ...f.ctx.decode, provenance: proof.p }));
  const revFact = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 } });
  const ctx = { ...f.ctx, facts: [f.root, revFact], revocations: [{ factId: revFact.id, revocation }], folded: { ...f.ctx.folded, 'machine-b': revFact.segment } };
  expect(() => causalStanding(f.candidate, ctx, true)).toThrow('omitted');
  expect(causalStanding(f.candidate, ctx, false).taint).toEqual(['provisional']);
});
it('P2-NF-75 reconciliation clears a provisional mark when the later revocation is causally after the fact', () => {
  const f = standing(), payload = { id: 'rev', grantId: f.g.id, by: f.alice, at: f.now, reason: 'revoked' }, proof = f.proof(payload);
  const revocation = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1, ...payload, source: proof.p }, { ...f.ctx.decode, provenance: proof.p }));
  const revFact = f.next(f.candidate, {}, f.ctx), ctx = { ...f.ctx, facts: [f.root, f.candidate, revFact], revocations: [{ factId: revFact.id, revocation }], folded: { 'machine-a': revFact.segment } };
  expect(reconcileAuthority(f.candidate, ctx, ctx.folded)).toEqual({ taint: [], conflicts: [] });
});
it('reconciliation records a distinct fact/revocation conflict class with deterministic key', () => {
  const f = standing(), payload = { id: 'rev', grantId: f.g.id, by: f.alice, at: f.now, reason: 'revoked' }, proof = f.proof(payload);
  const revocation = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1, ...payload, source: proof.p }, { ...f.ctx.decode, provenance: proof.p }));
  const revFact = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 } });
  const ctx = { ...f.ctx, facts: [f.root, revFact], revocations: [{ factId: revFact.id, revocation }] };
  expect(reconcileAuthority(f.candidate, ctx, ctx.folded).conflicts[0]).toMatchObject({ kind: 'revocation-conflict', key: `revocation:${f.candidate.id}:${revFact.id}` });
});
