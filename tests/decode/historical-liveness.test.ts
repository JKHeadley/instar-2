import { expect, it } from 'vitest';
import { consumeResult, historicalGrantLiveness, readHistorical } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { clone, fixture, raw, value } from '../fixtures.js';
const refused = <T>(result: Result<T>, text: string) => consumeResult(result, {
  Success: () => { throw new Error('expected refusal'); }, Refused: r => { expect(r.detail).toContain(text); expect(r.preserved).toBeTruthy(); },
});
function setup() {
  const f = fixture(); const grant = f.grant({ id: 'limited', expiresAt: 105 });
  const ctx = { register: f.ctx.register, captures: f.captures, preserved: f.ctx.preserved, now: f.now };
  const historical = value(readHistorical('StandingGrant', grant, f.historyPin(grant), ctx));
  const payload = { id: 'revocation', grantId: grant.id, by: f.alice, at: f.clock(104), reason: 'in cone' };
  const record = raw('Revocation', { ...payload, source: f.proof(payload).p });
  const revocation = value(readHistorical('Revocation', record, f.historyPin(record), { ...ctx, history: [historical] }));
  return { f, grant, historical, revocation, ctx };
}
it('NF-10 historical-only liveness reports every temporal boundary from an explicit clock', () => {
  const { f, historical } = setup();
  for (const [at, status] of [[99, 'not-yet-live'], [100, 'live'], [104, 'live'], [105, 'expired'], [106, 'expired']] as const)
    expect(value(historicalGrantLiveness(historical, [], f.clock(at), f.ctx.preserved))).toBe(status);
});
it('NF-39 historical-only causal revocation cannot be bypassed with testimony time', () => {
  const { f, historical, revocation } = setup();
  expect(value(historicalGrantLiveness(historical, [revocation], f.clock(100), f.ctx.preserved))).toBe('revoked');
  expect(value(historicalGrantLiveness(historical, [revocation], f.clock(104), f.ctx.preserved))).toBe('revoked');
  // Same receiver has the wrapper, but P2 excludes it from this fact's cone.
  expect(value(historicalGrantLiveness(historical, [], f.clock(100), f.ctx.preserved))).toBe('live');
});
it('historical-only liveness ignores revocations of a different grant', () => {
  const { f, historical, revocation, ctx } = setup();
  const other = value(readHistorical('StandingGrant', f.g, f.historyPin(f.g), ctx));
  expect(value(historicalGrantLiveness(other, [revocation], f.now, f.ctx.preserved))).toBe('live');
  expect(value(historicalGrantLiveness(historical, [revocation, revocation], f.now, f.ctx.preserved))).toBe('revoked');
});
it('historical-only liveness refuses copied wrappers, live instances and invalid clocks at runtime', () => {
  const { f, historical, revocation } = setup();
  refused(historicalGrantLiveness({ ...historical }, [], f.now, f.ctx.preserved), 'origin-verified StandingGrant');
  refused(historicalGrantLiveness(historical, [{ ...revocation }], f.now, f.ctx.preserved), 'origin-verified Revocations');
  for (const invalid of [f.g, historical.view, clone(historical), null])
    refused(Reflect.apply(historicalGrantLiveness, undefined, [invalid, [], f.now, f.ctx.preserved]), 'origin-verified StandingGrant');
  refused(Reflect.apply(historicalGrantLiveness, undefined, [historical, [], clone(f.now), f.ctx.preserved]), 'decoded causal clock');
  refused(Reflect.apply(historicalGrantLiveness, undefined, [historical, null, f.now, f.ctx.preserved]), 'must be a list');
});
for (const status of ['missing', 'expired', 'tombstoned'] as const) it(`historical-only liveness refuses ${status} dependency taint`, () => {
  const { f, grant, ctx } = setup(); const pin = f.historyPin(grant);
  delete f.captures[grant.source.record.reference];
  const history = value(readHistorical('StandingGrant', grant, pin, { ...ctx, captureStatuses: { [grant.source.record.reference]: status } }));
  expect(history.captureStatus).toBe(status);
  refused(historicalGrantLiveness(history, [], f.now, f.ctx.preserved), 'evidence-unavailable');
});
it('historical-only liveness refuses unavailable revocation dependencies too', () => {
  const { f, historical, revocation, ctx } = setup(); const pin = f.historyPin(revocation.view);
  delete f.captures[revocation.view.source.record.reference];
  const unavailable = value(readHistorical('Revocation', revocation.view, pin, { ...ctx, history: [historical] }));
  expect(unavailable.captureStatus).toBe('missing');
  refused(historicalGrantLiveness(historical, [unavailable], f.now, f.ctx.preserved), 'evidence-unavailable');
  expect(value(historicalGrantLiveness(historical, [], f.now, f.ctx.preserved))).toBe('live');
});
