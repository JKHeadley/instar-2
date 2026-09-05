import { expect, it } from 'vitest';
import { decodeBody, decodeEnvelope, decodeHistoricalBody, registerOwnedBody, prepareSnapshot, verifyAndAdmit } from '../../src/facts/index.js';
import type { OwnedShape } from '../../src/facts/index.js';
import { factsFixture, value, refused } from './fixtures.js';

const text = { kind: 'text', maxLength: 100 } as const;
const policy: OwnedShape = { kind: 'object', fields: { type: text, schemaVersion: { kind: 'integer' }, run: text, predecessor: text,
  steps: { kind: 'array', maxLength: 10, items: { kind: 'object', fields: { id: text, state: text } } }, capture: { kind: 'capture' } } };
function setup() {
  const f = factsFixture(), hash = f.capture('transition evidence', 'owned:capture');
  let calls = 0;
  const registration = value(registerOwnedBody({ name: 'RunTransition', owner: 'part-five', currentVersion: 1, versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {},
    decodeCurrent: input => { calls++; const row = input as { steps: { state: string }[] }; return row.steps.every(s => ['pending', 'complete'].includes(s.state)) ? { ok: true, value: input } : { ok: false, detail: 'owner: unknown step state' }; } }, policy, f.c));
  const ctx = { ...f.ctx, schemas: [{ ...f.schema, fields: { transition: { kind: 'owned' as const, owner: 'part-five', name: 'RunTransition' } } }], ownedBodies: [registration],
    captures: { 'owned:capture': { hash, bytes: 'transition evidence' as string | null, byteLength: 19, status: 'available' as 'available' | 'expired' } } };
  const record = { type: 'RunTransition', schemaVersion: 1, run: 'run:1', predecessor: 'step:0', steps: [{ id: 'step:1', state: 'pending' }], capture: { reference: 'owned:capture', hash } };
  return { ...f, ctx, record, calls: () => calls };
}
it('P2-NF-28 later-owned structured fields dispatch through the owner at origin and replay', () => {
  const f = setup(), fact = value(decodeEnvelope(f.wire({ body: { transition: f.record } }), f.ctx));
  expect(value(decodeBody(fact, f.ctx, f.ctx.decode)).transition).toEqual(f.record);
  expect(value(verifyAndAdmit(fact, 'machine-a', f.ctx)).id).toBe(fact.id);
  expect(value(decodeHistoricalBody(fact, f.ctx, f.ctx.decode)).fields.transition).toEqual(f.record);
  expect(f.calls()).toBeGreaterThanOrEqual(3);
  const bad = value(decodeEnvelope(f.wire({ body: { transition: { ...f.record, steps: [{ id: 's', state: 'invented' }] } } }), f.ctx));
  refused(decodeBody(bad, f.ctx, f.ctx.decode), 'owner: unknown'); refused(verifyAndAdmit(bad, 'machine-a', f.ctx), 'owner: unknown');
});
it('P2-NF-18 P2-NF-19 P2-NF-64 structured free text, arrays, capture bytes and owner registration remain bounded', () => {
  const f = setup();
  for (const record of [{ ...f.record, run: 'x'.repeat(101) }, { ...f.record, steps: Array(11).fill({ id: 's', state: 'pending' }) }, { ...f.record, extra: 'undeclared' }]) {
    const fact = value(decodeEnvelope(f.wire({ body: { transition: record } }), f.ctx)); refused(decodeBody(fact, f.ctx, f.ctx.decode));
  }
  const fact = value(decodeEnvelope(f.wire({ body: { transition: f.record } }), f.ctx));
  refused(decodeBody(fact, { ...f.ctx, ownedBodies: [] }, f.ctx.decode), 'registration missing');
  refused(decodeBody(fact, { ...f.ctx, ownedBodies: [{ ...f.ctx.ownedBodies[0]! }] as never }, f.ctx.decode), 'not validated');
  f.ctx.captures['owned:capture'].status = 'expired'; f.ctx.captures['owned:capture'].bytes = null;
  refused(decodeBody(fact, f.ctx, f.ctx.decode), 'unavailable at append');
  expect(value(prepareSnapshot([fact], f.ctx)).entries[0]?.taint).toContain('evidence-unavailable');
});
it('P2-NF-22 owned decoders never run on an altered signed preimage', () => {
  const f = setup(), frame = f.wire({ body: { transition: f.record } }) as object;
  refused(verifyAndAdmit({ ...frame, body: { changed: true } }, 'machine-a', f.ctx), 'hash mismatch'); expect(f.calls()).toBe(0);
});
