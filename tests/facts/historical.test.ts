import { expect, it } from 'vitest';
import { decodeEnvelope, decodeHistoricalBody, receiveReplication, PendingSet, causalStanding, hashBytes } from '../../src/facts/index.js';
import { canonical, decode, readHistorical } from '../../src/index.js';
import { factsFixture, refused, value } from './fixtures.js';

it('P2-NF-28 historical action provenance stays separate from identity provenance', () => {
  const f = factsFixture();
  const principal = f.principal('requester', 'person', true);
  const ctx = { ...f.ctx, decode: { ...f.ctx.decode, principals: [principal] } };
  const decoded = value(decodeEnvelope(f.wire({ principal, provenance: principal.provenance }), ctx, 'replication'));
  expect(decoded.provenance.class).toBe('channel-attested');
  refused(decodeEnvelope(f.wire({ principal, provenance: f.alice.provenance }), ctx, 'replication'), 'actor mismatch');
  const provenance = f.g.source;
  const action = value(decodeEnvelope(f.wire({ provenance }), f.ctx, 'replication'));
  expect(action.provenance).toEqual(provenance);
  expect(action.principal.provenance).toEqual(f.alice.provenance);
});

it('P2-NF-25 P2-NF-62 a reordered segment holds then verifies after its predecessor arrives', () => {
  const f = factsFixture(), first = f.fact(), second = f.next(first);
  const pending = new PendingSet(20, 10, 1000);
  const held = value(receiveReplication(second, 'machine-a', f.ctx, pending, 10));
  expect(held.kind).toBe('held');
  expect(value(receiveReplication(first, 'machine-a', f.ctx, pending, 11)).kind).toBe('verified');
  const accepted = value(receiveReplication(second, 'machine-a', { ...f.ctx, facts: [first] }, pending, 12));
  expect(accepted.kind).toBe('verified');
});

it('historical Evidence carries tombstoned, expired and missing status', () => {
  const f = factsFixture();
  const schema = { ...f.schema, fields: { evidence: { kind: 'constitutional' as const, type: 'Evidence' as const } } };
  for (const status of ['tombstoned', 'expired', 'missing'] as const) {
    const ctx = { ...f.ctx, schemas: [schema], captures: { 'capture:evidence': { hash: f.e.capture.hash, bytes: null, byteLength: 0, status } } };
    const fact = value(decodeEnvelope(f.wire({ body: { evidence: f.e } }), ctx, 'replication'));
    const body = value(decodeHistoricalBody(fact, ctx, f.ctx.decode));
    expect(body.taint).toEqual(['evidence-unavailable']);
    expect(body.fields.evidence).toMatchObject({ mode: 'historical', captureStatus: status });
  }
});

it('P2-NF-28 historical authority body cannot substitute its own action provenance', () => {
  const f = factsFixture();
  const ctx = { ...f.ctx, schemas: [{ ...f.schema, fields: { grant: { kind: 'constitutional' as const, type: 'StandingGrant' as const } } }] };
  const fact = value(decodeEnvelope(f.wire({ body: { grant: f.g } }), ctx, 'replication'));
  refused(decodeHistoricalBody(fact, ctx, ctx.decode), 'body authority provenance');
});

it('P2-NF-72 historical-only standing consumes actual origin wrappers with causal time, not testimony or live brands', () => {
  const f = factsFixture(), grant = f.grant({ id: 'historical-grant', expiresAt: 200 });
  const root = value(decodeEnvelope(f.wire({ provenance: grant.source, body: { grant } }), f.ctx, 'replication'));
  const bytes = value(canonical(root)).bytes, reference = 'origin:grant';
  const hc = { ...f.ctx.decode, principals: [], grants: [], captures: { ...f.ctx.decode.captures, [reference]: bytes }, now: f.now };
  const historical = value(readHistorical('StandingGrant', grant, { origin: { owner: 'part-two', name: 'FactEnvelope', id: root.id }, capture: { reference, hash: hashBytes(bytes) }, machineKeyId: 'machine-a-key', path: ['body', 'grant'] }, hc));
  const schema = { ...f.schema, standing: 'operator' as const, causallyBound: true };
  const ctx = { ...f.ctx, decode: hc, schemas: [schema], facts: [root], grants: [], historicalGrants: [{ factId: root.id, grant: historical }] };
  const candidate = f.next(root, { at: f.clock(1), predecessors: { inSegment: root.id, frontier: {}, required: [root.id] } });
  expect(causalStanding(candidate, ctx, false).now.value).toBe(100);
  expect(() => causalStanding(candidate, { ...ctx, genesis: { ...ctx.genesis, clock: f.clock(200) } }, false)).toThrow('no live');
  const payload = { id: 'r-historical', grantId: grant.id, by: f.alice, at: f.clock(150), reason: 'revoked' }, proof = f.proof(payload);
  const rev = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1, ...payload, source: proof.p }, { ...f.ctx.decode, now: f.now, provenance: proof.p }));
  const revFact = value(decodeEnvelope(f.wire({ segment: { machine: 'machine-a', epoch: 0, position: 1 }, provenance: proof.p, prevInSegment: root.contentHash, predecessors: { inSegment: root.id, frontier: {}, required: [root.id] }, body: { rev } }), f.ctx, 'replication'));
  const revBytes = value(canonical(revFact)).bytes, revReference = 'origin:rev';
  const hr = value(readHistorical('Revocation', rev, { origin: { owner: 'part-two', name: 'FactEnvelope', id: revFact.id }, capture: { reference: revReference, hash: hashBytes(revBytes) }, machineKeyId: 'machine-a-key', path: ['body', 'rev'] }, { ...hc, history: [historical], captures: { ...hc.captures, ...f.ctx.decode.captures, [revReference]: revBytes } }));
  const after = f.next(revFact, { at: f.clock(1), predecessors: { inSegment: revFact.id, frontier: {}, required: [root.id] } });
  expect(() => causalStanding(after, { ...ctx, facts: [root, revFact], historicalRevocations: [{ factId: revFact.id, revocation: hr }] }, false)).toThrow('no live');
});
