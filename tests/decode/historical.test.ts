import { describe, expect, it } from 'vitest';
import { consumeResult, decode, readHistorical } from '../../src/index.js';
import type { Provenance, Result } from '../../src/index.js';
import { bytes, clone, fixture, raw, value } from '../fixtures.js';
const refused = <T>(result: Result<T>, text: string) => consumeResult(result, { Success: () => { throw new Error('expected refusal'); }, Refused: r => expect(r.detail).toContain(text) });
describe('origin-pinned historical principal and provenance reads', () => {
  it('preserves channel attestation under a valid machine signature', () => {
    const f = fixture(); const p = f.principal('old-requester', 'person', true); const pin = f.historyPin(p);
    const historical = value(readHistorical('VerifiedPrincipal', clone(p), pin, f.ctx));
    expect(historical.view.provenance.class).toBe('channel-attested'); expect(historical.mode).toBe('historical');
    expect(historical.captureStatus).toBe('available');
    refused(decode('VerifiedPrincipal', raw('VerifiedPrincipal', { id: p.id, kind: p.kind }), { ...f.ctx, provenance: historical.view.provenance as Provenance }), 'not produced');
    refused(readHistorical('VerifiedPrincipal', { ...clone(p), provenance: { ...clone(p.provenance), class: 'verified' } }, pin, f.ctx), 'origin pin');
  });
  it('reconstructs original verified provenance without creating a live authentication value', () => {
    const f = fixture(); const p = f.alice.provenance; const pin = f.historyPin(p);
    const historical = value(readHistorical('Provenance', clone(p), pin, f.ctx)); expect(historical.view.class).toBe('verified');
    refused(decode('VerifiedPrincipal', raw('VerifiedPrincipal', { id: 'alice', kind: 'person' }), { ...f.ctx, provenance: historical.view as Provenance }), 'not produced');
  });
  it('preserves unavailable historical captures as visibly unavailable', () => {
    const f = fixture(); const p = f.alice.provenance; const pin = f.historyPin(p); delete f.captures[p.record.reference];
    const historical = value(readHistorical('Provenance', clone(p), pin, f.ctx)); expect(historical.captureStatus).toBe('unavailable'); expect(historical.view.record).toEqual(p.record);
  });
  it('rejects changed origin bytes, invalid signatures, wrong paths and altered identity', () => {
    const f = fixture(); const p = f.alice; const pin = f.historyPin(p);
    const original = JSON.parse(f.captures[pin.capture.reference]!);
    const altered = (changes: object) => { const changed = bytes({ ...original, ...changes }); const hash = f.capture(changed, 'altered-envelope'); return { ...pin, capture: { reference: 'altered-envelope', hash } }; };
    refused(readHistorical('VerifiedPrincipal', clone(p), altered({ signature: '00'.repeat(64) }), f.ctx), 'signature');
    refused(readHistorical('VerifiedPrincipal', clone(p), altered({ body: { ...clone(p), id: 'another' } }), f.ctx), 'contentHash');
    refused(readHistorical('VerifiedPrincipal', clone(p), altered({ contentHash: `sha256:${'00'.repeat(32)}` }), f.ctx), 'contentHash');
    refused(readHistorical('VerifiedPrincipal', clone(p), { ...pin, path: ['missing'] }, f.ctx), 'path');
    refused(readHistorical('VerifiedPrincipal', { ...clone(p), id: 'another' }, pin, f.ctx), 'origin pin');
    f.captures[pin.capture.reference] = '{}'; refused(readHistorical('VerifiedPrincipal', clone(p), pin, f.ctx), 'capture');
  });
  it('historical decoder remains total on hostile input', () => {
    const f = fixture(); const pin = f.historyPin(f.alice);
    for (const input of [null, undefined, new Proxy({}, { ownKeys() { throw new Error('trap'); } })]) expect(() => refused(readHistorical('VerifiedPrincipal', input, pin, f.ctx), '')).not.toThrow();
  });
});
