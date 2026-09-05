import { describe, expect, it } from 'vitest';
import { consumeResult, decode, readHistorical, readHistoricalEvidence } from '../../src/index.js';
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
    const historical = value(readHistorical('Provenance', clone(p), pin, f.ctx)); expect(historical.captureStatus).toBe('missing'); expect(historical.view.record).toEqual(p.record);
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
  it('R3 historical body validation composes through verified dependency wrappers', () => {
    const f = fixture(); const grantPin = f.historyPin(f.g); const authPin = f.historyPin(f.authorization);
    const context = { register: f.ctx.register, captures: f.captures, preserved: f.ctx.preserved, now: f.now };
    const grant = value(readHistorical('StandingGrant', clone(f.g), grantPin, context));
    expect(value(readHistorical('Authorization', clone(f.authorization), authPin, { ...context, history: [grant] })).view.under).toBe('g1');
    refused(readHistorical('Authorization', clone(f.authorization), authPin, context), 'grant missing');
    refused(readHistorical('Authorization', clone(f.authorization), authPin, { ...context, history: [{ ...grant }] }), 'origin-verified reads');
    refused(readHistorical('Authorization', clone(f.authorization), authPin, { ...context, history: [grant], now: f.clock(99) }), 'not live');
  });
  it('R3 Evidence retains each unavailable-capture state and cannot supply a live claim', () => {
    const f = fixture(); const pin = f.historyPin(f.e);
    const available = value(readHistorical('Evidence', clone(f.e), pin, f.ctx));
    expect(value(readHistoricalEvidence(available, f.now, f.ctx.preserved)).predicate).toBe('exists');
    refused(readHistoricalEvidence(available, f.clock(111), f.ctx.preserved), 'expired');
    delete f.captures['capture:evidence'];
    for (const status of ['tombstoned', 'expired', 'missing'] as const) {
      const record = value(readHistorical('Evidence', clone(f.e), pin, { ...f.ctx, captureStatuses: { 'capture:evidence': status } }));
      expect(record.captureStatus).toBe(status); expect(record.unavailableCaptures).toEqual([{ reference: 'capture:evidence', hash: f.e.capture.hash, status }]);
      refused(readHistoricalEvidence(record, f.now, f.ctx.preserved), 'evidence-unavailable');
    }
  });
});
