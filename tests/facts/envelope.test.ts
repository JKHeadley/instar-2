import { describe, expect, it } from 'vitest';
import { decodeEnvelope, extendsChain, preimage, signEnvelope, validateSchemas, decodeBody, verifyAndAdmit, clockKey, verifyHistory, compromisedKeyConflicts, receiveReplication, PendingSet } from '../../src/facts/index.js';
import { canonical, consumeResult } from '../../src/index.js';
import { factsFixture, value, clone, refused, privateKey } from './fixtures.js';

describe('fact envelope boundary', () => {
  const missing = (key: string) => { const f = factsFixture(), v = clone(f.wire()) as Record<string, unknown>; delete v[key]; return decodeEnvelope(v, f.ctx); };
  it('P2-NF-01 principal is required', () => { expect(refused(missing('principal'))).toContain('missing'); });
  it('P2-NF-02 content-derived names cannot become principals', () => { const f = factsFixture(); refused(decodeEnvelope(f.wire({ principal: 'Alice' }), f.ctx), 'principal'); });
  it('P2-NF-03 a bare registry id is not a principal', () => { const f = factsFixture(); refused(decodeEnvelope(f.wire({ principal: { id: 'alice' } }), f.ctx), 'principal'); });
  it('P2-NF-05 any changed body breaks the canonical hash', () => {
    const f = factsFixture(), v = clone(f.wire()) as Record<string, unknown>; v.body = { identity: 'one', amount: '11' };
    refused(decodeEnvelope(v, f.ctx), 'content hash'); expect(value(decodeEnvelope(f.wire(), f.ctx)).body).toEqual({ identity: 'one', amount: '10' });
  });
  it('P2-NF-06 absent and empty causal fields have different preimages', () => {
    const f = factsFixture(), v = clone(f.wire()) as Record<string, unknown>; const absent = { ...v }; delete absent.predecessors;
    expect(preimage(absent).hash).not.toBe(preimage({ ...v, predecessors: {} }).hash);
  });
  it('P2-NF-07 authentic signature is required', () => { const f = factsFixture(); refused(decodeEnvelope({ ...(f.wire() as object), signature: '0'.repeat(128) }, f.ctx), 'signature'); });
  it('P2-NF-08 a signing key must belong to the named machine', () => { const f = factsFixture(); refused(decodeEnvelope(f.wire(), { ...f.ctx, keys: f.ctx.keys.filter(k => k.machine !== 'machine-a') }), 'signing owner'); });
  it('P2-NF-09 next fact must extend the held hash head', () => {
    const f = factsFixture(), a = f.fact(), b = f.next(a, { prevInSegment: f.ctx.genesis.hash });
    expect(() => extendsChain(b, { ...f.ctx, facts: [a] })).toThrow('gap or fork');
  });
  it('P2-NF-10 a second fact at an occupied position refuses', () => {
    const f = factsFixture(), a = f.fact(), b = f.fact({ body: { identity: 'two', amount: '3' } });
    expect(() => extendsChain(b, { ...f.ctx, facts: [a] })).toThrow('id already');
    refused(decodeEnvelope(f.wire({ id: 'different-id' }), f.ctx), 'namespace');
  });
  it('P2-NF-11 replication refuses segments owned by a different peer', () => { const f = factsFixture(); refused(verifyAndAdmit(f.wire(), 'machine-b', f.ctx), 'does not own'); });
  it('P2-NF-12 a stream with a positional gap refuses', () => {
    const f = factsFixture(), a = f.fact(), b = f.next(a, { segment: { machine: 'machine-a', epoch: 0, position: 2 } });
    expect(() => extendsChain(b, { ...f.ctx, facts: [a] })).toThrow('gap');
  });
  it('P2-NF-13 origin append cannot reuse an existing identity', () => { const f = factsFixture(), a = f.fact(); expect(() => extendsChain(a, { ...f.ctx, facts: [a] })).toThrow('id already'); });
  it('P2-NF-14 cross-machine id collision refuses at decode', () => { const f = factsFixture(); refused(decodeEnvelope(f.wire({ id: 'machine-b:0:0' }), f.ctx), 'namespace'); });
  it('P2-NF-17 secret shape is screened before envelope parsing', () => {
    const f = factsFixture(); const result = decodeEnvelope({ body: 'sk-' + 'A'.repeat(25) }, f.ctx);
    expect(consumeResult(result, { Success: () => '', Refused: r => r.reason })).toBe('policy');
  });
  it('P2-NF-18 secret-valued schemas refuse', () => { const f = factsFixture(); const schema = { ...f.schema, fields: { token: { kind: 'secret' } } }; refused(validateSchemas([schema as never], f.ctx), 'secret-valued'); });
  it('P2-NF-19 free-text fields must have an explicit finite clamp', () => { const f = factsFixture(); refused(validateSchemas([{ ...f.schema, fields: { note: { kind: 'text', maxLength: Infinity } } }], f.ctx)); });
  it('P2-NF-20 unregistered kind refuses', () => { const f = factsFixture(); refused(decodeEnvelope(f.wire({ kind: 'unknown' }), f.ctx), 'unknown kind'); });
  it('P2-NF-21 unknown schema version refuses at origin', () => { const f = factsFixture(); refused(decodeEnvelope(f.wire({ schemaVersion: 2 }), f.ctx), 'schema version'); });
  it('P2-NF-22 integrity checks use as-appended bytes before schema lookup', () => {
    const f = factsFixture(), v = clone(f.wire()) as Record<string, unknown>; v.schemaVersion = 999;
    refused(decodeEnvelope(v, f.ctx), 'hash mismatch');
    refused(decodeEnvelope(signEnvelope(v, privateKey), f.ctx), 'schema version');
  });
  it('P2-NF-21 replication holds an authentic future schema while a forged future frame refuses', () => {
    const f = factsFixture(), future = f.wire({ schemaVersion: 2 }), pending = new PendingSet(2, 2, 100);
    expect(value(receiveReplication(future, 'machine-a', f.ctx, pending, 100))).toEqual({ kind: 'held', dependency: 'schema:note:2' });
    expect(pending.depth).toBe(1);
    refused(receiveReplication({ ...(future as object), signature: '0'.repeat(128) }, 'machine-a', f.ctx, pending, 101), 'signature');
    expect(pending.depth).toBe(1);
  });
  it('P2-NF-22 forward migration runs after integrity and preserves original bytes', () => {
    const f = factsFixture(), original = f.fact(), before = preimage(original).hash;
    const ctx = { ...f.ctx, schemas: [f.schema, { ...f.schema, version: 2 }], migrations: [{ kind: 'note', from: 1, to: 2, migrate: (body: import('../../src/index.js').Json) => body }] };
    expect(value(decodeBody(original, ctx, ctx.decode)).amount).toBe('10'); expect(preimage(original).hash).toBe(before);
  });
  it('P2-NF-24 non-genesis facts require their in-segment predecessor', () => { const f = factsFixture(); refused(decodeEnvelope(f.wire({ segment: { machine: 'machine-a', epoch: 0, position: 1 } }), f.ctx), 'predecessor'); });
  it('P2-NF-61 machine-local fact schemas refuse', () => { const f = factsFixture(); refused(validateSchemas([{ ...f.schema, machineScope: 'machine-local' } as never], f.ctx), 'machine-local'); });
  it('P2-NF-64 a capture must resolve with matching actual bytes', () => {
    const f = factsFixture(), ctx = { ...f.ctx, schemas: [{ ...f.schema, fields: { capture: { kind: 'capture' as const } } }] };
    const fact = f.fact({ body: { capture: { reference: 'missing', hash: f.artifact } } }, ctx);
    refused(decodeBody(fact, ctx, ctx.decode), 'does not resolve');
  });
  it('P2-NF-69 key windows are causal positions, never the fact clock', () => {
    const f = factsFixture(), ctx = { ...f.ctx, keys: f.ctx.keys.map(k => ({ ...k, from: { epoch: 1, position: 0 } })) };
    refused(decodeEnvelope(f.wire({ at: f.clock(1) }), ctx), 'key position');
  });
  it('P2-NF-70 compromised-key suffix is refused for quarantine; earlier history verifies', () => {
    const f = factsFixture(), a = f.fact(), ctx = { ...f.ctx, keys: f.ctx.keys.map(k => ({ ...k, compromisedAt: { epoch: 0, position: 1 } })) };
    expect(value(decodeEnvelope(a, ctx)).id).toBe(a.id);
    refused(decodeEnvelope(f.next(a), ctx), 'compromised-key');
    expect(compromisedKeyConflicts([a, f.next(a)], ctx).map(c => c.kind)).toEqual(['compromised-key']);
  });
  it('P2-NF-16 boot verifies the suffix and full sweep catches corruption beneath the durable watermark', () => {
    const f = factsFixture(), a = f.fact(), b = f.next(a), c = f.next(b);
    const initial = value(verifyHistory([a, b], f.ctx, 'sweep'));
    expect(value(verifyHistory([a, b, c], f.ctx, 'boot', initial.watermarks)).checked).toBe(1);
    const changed = { ...a, body: { identity: 'altered', amount: '999' } };
    expect(value(verifyHistory([changed, b, c], f.ctx, 'boot', initial.watermarks)).checked).toBe(1);
    refused(verifyHistory([changed, b, c], f.ctx, 'sweep'), 'hash mismatch');
    refused(verifyHistory([a, b, { ...c, body: { changed: true } }], f.ctx, 'boot', initial.watermarks), 'hash mismatch');
  });
  it('all untrusted boundary inputs are total, including getters and cycles', () => {
    const f = factsFixture(), cycle: Record<string, unknown> = {}; cycle.self = cycle;
    for (const input of [null, undefined, 1, Symbol('x'), cycle, { get id() { throw new Error('getter ran'); } }]) expect(() => refused(decodeEnvelope(input, f.ctx))).not.toThrow();
  });
  it('fixed-width fold clock bytes order negative and positive instants', () => {
    const f = factsFixture(); expect([100, -1, 0].map(x => clockKey(f.clock(x))).sort()).toEqual([-1, 0, 100].map(x => clockKey(f.clock(x))));
  });
});
