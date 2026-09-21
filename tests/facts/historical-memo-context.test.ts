// GRANT M3-E: the historical-body memo fingerprint may be amortized over verified-immutable
// components, but every consumed input still invalidates it exactly as the full canonical
// fingerprint did. Each case warms the memo, changes one input at unchanged collection sizes
// and unchanged generation labels, and compares the warm result with a cold decode.
import { expect, it } from 'vitest';
import { decodeEnvelope, decodeHistoricalBody, registerOwnedBody } from '../../src/facts/index.js';
import type { FactContext, OwnedShape } from '../../src/facts/index.js';
import { factsFixture, value } from './fixtures.js';

const text = { kind: 'text', maxLength: 100 } as const;
const policy: OwnedShape = { kind: 'object', fields: { type: text, schemaVersion: { kind: 'integer' }, run: text,
  steps: { kind: 'array', maxLength: 10, items: { kind: 'object', fields: { id: text, state: text } } }, capture: { kind: 'capture' } } };
function setup() {
  const f = factsFixture(), hash = f.capture('memo evidence', 'memo:capture');
  let calls = 0;
  const register = (name = 'RunTransition') => value(registerOwnedBody({ name, owner: 'part-five', currentVersion: 1,
    versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {},
    decodeCurrent: input => { calls++; return { ok: true, value: input }; } }, policy, f.c));
  const registration = register();
  const ctx: FactContext = { ...f.ctx, schemas: [{ ...f.schema, fields: { transition: { kind: 'owned' as const, owner: 'part-five', name: 'RunTransition' } } }],
    ownedBodies: [registration], captures: { 'memo:capture': { hash, bytes: 'memo evidence' as string | null, byteLength: 13, status: 'available' as 'available' | 'expired' } } };
  const record = { type: 'RunTransition', schemaVersion: 1, run: 'run:1', steps: [{ id: 'step:1', state: 'pending' }], capture: { reference: 'memo:capture', hash } };
  const fact = value(decodeEnvelope(f.wire({ body: { transition: record } }), ctx));
  return { ...f, ctx, record, fact, register, calls: () => calls };
}
/** A cold decode: an equivalent fresh envelope object under a fresh owner registration (a new
 * registration identity is one of the retained memo guards, so no cached body can be reused). */
function cold(f: ReturnType<typeof setup>, context: FactContext, decoder = context.decode) {
  const fresh = JSON.parse(JSON.stringify(f.fact)) as typeof f.fact;
  const rebound: FactContext = { ...context, ownedBodies: [f.register()] };
  return decodeHistoricalBody(fresh, rebound, decoder);
}
/** Decode through the warm memo and cold; both must agree. */
function warmAndCold(f: ReturnType<typeof setup>, context: FactContext, decoder = context.decode) {
  const warm = value(decodeHistoricalBody(f.fact, context, decoder));
  const reference = value(cold(f, context, decoder));
  expect(warm.fields).toEqual(reference.fields); expect(warm.taint).toEqual(reference.taint);
  return warm;
}

it('P2-M3E-01 an unchanged context reuses the verified historical decode', () => {
  const f = setup();
  value(decodeHistoricalBody(f.fact, f.ctx, f.ctx.decode)); const calls = f.calls();
  value(decodeHistoricalBody(f.fact, f.ctx, f.ctx.decode)); expect(f.calls()).toBe(calls);
  // Equal-content replacement objects are the permitted neighbour: same bytes, new identities, still a hit.
  const replaced: FactContext = { ...f.ctx, schemas: JSON.parse(JSON.stringify(f.ctx.schemas)), keys: JSON.parse(JSON.stringify(f.ctx.keys)),
    captures: JSON.parse(JSON.stringify(f.ctx.captures)), decode: { ...f.ctx.decode, register: JSON.parse(JSON.stringify(f.ctx.decode.register)) } };
  value(decodeHistoricalBody(f.fact, replaced, replaced.decode)); expect(f.calls()).toBe(calls);
});

it.each([
  ['register contents', (ctx: FactContext): FactContext => ({ ...ctx, decode: { ...ctx.decode, register: { ...ctx.decode.register,
    sites: { ...ctx.decode.register.sites, [ctx.site]: ctx.decode.register.sites[ctx.site] === 'open' ? 'closed' : 'open' } } } })],
  ['schema contents', (ctx: FactContext): FactContext => ({ ...ctx, schemas: ctx.schemas.map((schema, i) => i === 0 ? { ...schema, fields: { ...schema.fields, extra: { kind: 'text' as const, maxLength: 1 } } } : schema) })],
  ['key contents', (ctx: FactContext): FactContext => ({ ...ctx, keys: ctx.keys.map((key, i) => i === 0 ? { ...key, machine: 'machine-z' } : key) })],
  ['capture bytes', (ctx: FactContext): FactContext => ({ ...ctx, captures: { 'memo:capture': { ...ctx.captures['memo:capture']!, bytes: 'memo evidenc3' } } })],
  ['decoder context base', (ctx: FactContext): FactContext => ({ ...ctx, decode: { ...ctx.decode, currentBase: 'base:other' } })],
])('P2-M3E-02 a warm memo misses when %s change at unchanged sizes and labels', (_name, change) => {
  const f = setup();
  value(decodeHistoricalBody(f.fact, f.ctx, f.ctx.decode)); const calls = f.calls();
  const changed = change(f.ctx);
  expect(changed.schemas.length).toBe(f.ctx.schemas.length); expect(changed.keys.length).toBe(f.ctx.keys.length);
  expect(changed.decode.register.generation).toEqual(f.ctx.decode.register.generation);
  const result = decodeHistoricalBody(f.fact, changed, changed.decode);
  // Either the decoder ran again (a miss) or the change refused the decode outright; a silent warm hit is the failure.
  expect(f.calls() > calls || result.kind === 'Refused').toBe(true);
  const reference = cold(f, changed, changed.decode);
  expect(result.kind).toBe(reference.kind);
  if (result.kind === 'Success' && reference.kind === 'Success') { expect(result.value.fields).toEqual(reference.value.fields); expect(result.value.taint).toEqual(reference.value.taint); }
});

it('P2-M3E-03 capture state changes on the same mutable context still invalidate the memo', () => {
  const f = setup();
  warmAndCold(f, f.ctx); const calls = f.calls();
  const capture = f.ctx.captures['memo:capture'] as { status: 'available' | 'expired'; bytes: string | null };
  capture.status = 'expired'; capture.bytes = null;
  // warmAndCold decodes twice (the warm path and the cold reference); after the change both recompute.
  expect(warmAndCold(f, f.ctx).taint).toContain('evidence-unavailable'); expect(f.calls()).toBe(calls + 2);
});

it('P2-M3E-04 owner-registration and migration replacement invalidate the memo; cone growth is content-sensitive', () => {
  const f = setup();
  value(decodeHistoricalBody(f.fact, f.ctx, f.ctx.decode)); const calls = f.calls();
  const reregistered: FactContext = { ...f.ctx, ownedBodies: [f.register()] };
  value(decodeHistoricalBody(f.fact, reregistered, reregistered.decode)); expect(f.calls()).toBe(calls + 1);
  const migrated: FactContext = { ...f.ctx, migrations: [...(f.ctx.migrations ?? [])] };
  value(decodeHistoricalBody(f.fact, migrated, migrated.decode)); expect(f.calls()).toBe(calls + 2);
  // A different cone (the same fact seen with an extra ancestor in history) is a different fingerprint.
  const grown: FactContext = { ...f.ctx, facts: [...f.ctx.facts, f.fact] };
  value(decodeHistoricalBody(f.fact, grown, grown.decode)); expect(f.calls()).toBe(calls + 3);
});


it('P2-M3E-05 canonical-invalid frozen accessors refuse without being invoked', () => {
  const f = setup();
  value(decodeHistoricalBody(f.fact, f.ctx, f.ctx.decode));
  let getterCalls = 0;
  const fields = Object.freeze(Object.defineProperty({ ...f.ctx.schemas[0]!.fields }, 'extra', {
    enumerable: true, get: () => { getterCalls++; return { kind: 'text', maxLength: 1 }; },
  }));
  const context: FactContext = { ...f.ctx, schemas: [{ ...f.ctx.schemas[0]!, fields }] };
  expect(decodeHistoricalBody(f.fact, context, context.decode).kind).toBe('Refused');
  expect(getterCalls).toBe(0);
});

it('P2-M3E4-01 a mutable equal-byte envelope cannot reuse after its signature changes', () => {
  const f = setup();
  const baseline = value(decodeHistoricalBody(f.fact, f.ctx, f.ctx.decode)); const calls = f.calls();
  const mutable = JSON.parse(JSON.stringify(f.fact)) as typeof f.fact;
  expect(Object.isFrozen(mutable)).toBe(false);

  // The valid equal-byte copy remains a content hit.
  expect(value(decodeHistoricalBody(mutable, f.ctx, f.ctx.decode))).toEqual(baseline);
  expect(f.calls()).toBe(calls);

  Object.assign(mutable, { signature: '00' });
  const warm = decodeHistoricalBody(mutable, f.ctx, f.ctx.decode);
  const reference = decodeHistoricalBody(JSON.parse(JSON.stringify(mutable)),
    { ...f.ctx, ownedBodies: [f.register()] }, f.ctx.decode);
  expect(warm).toEqual(reference);
  expect(warm.kind).toBe('Refused');
  if (warm.kind === 'Refused') expect(warm.detail).toContain('signature encoding');
});
