import { expect, it } from 'vitest';
import { consumeResult, decode, historicalGrantLiveness, readHistorical } from '../../src/index.js';
import { fixture, raw, value } from '../fixtures.js';

it('historical-only grant → approval → revocation → standing consumption never needs a live authority constructor', () => {
  const f = fixture(); const grantPin = f.historyPin(f.g);
  const ctx = { register: f.ctx.register, captures: f.captures, preserved: f.ctx.preserved, now: f.now };
  const grant = value(readHistorical('StandingGrant', f.g, grantPin, ctx));
  const history = { ...ctx, history: [grant] };
  const authPin = f.historyPin(f.authorization);
  expect(value(historicalGrantLiveness(grant, [], ctx.now, ctx.preserved))).toBe('live');
  const auth = value(readHistorical('Authorization', f.authorization, authPin, history));
  expect(auth.view.under).toBe(grant.view.id);
  const payload = { id: 'withdrawn', grantId: f.g.id, by: f.alice, at: f.clock(110), reason: 'revoked causally' };
  const record = raw('Revocation', { ...payload, source: f.proof(payload).p });
  const revoked = value(readHistorical('Revocation', record, f.historyPin(record), history));
  expect(value(historicalGrantLiveness(grant, [revoked], ctx.now, ctx.preserved))).toBe('revoked');
  consumeResult(readHistorical('Authorization', f.authorization, authPin, { ...history, history: [grant, revoked] }), {
    Success: () => { throw new Error('causal revocation was ignored'); }, Refused: r => expect(r.detail).toContain('not live'),
  });
  // Pure historical classification must not confer a live constructor capability.
  const attemptedLive = Reflect.apply(decode, undefined, ['StandingGrant', f.g, {
    ...ctx, provenance: grant.view.source, principals: [grant.view.grantee],
  }]);
  consumeResult(attemptedLive, { Success: () => { throw new Error('historical grant became live'); }, Refused: r => expect(r.detail).toContain('not produced') });
});
