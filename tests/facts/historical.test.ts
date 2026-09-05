import { expect, it } from 'vitest';
import { decodeEnvelope, decodeHistoricalBody, receiveReplication, PendingSet } from '../../src/facts/index.js';
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

it.skip('P2-NF-72 SKIPPED: standalone historical-only standing requires P1 grantLiveness to consume origin-verified HistoricalRead grants/revocations; its current public parameters accept only live branded values', () => {});
