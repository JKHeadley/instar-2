import { expect, it } from 'vitest';
import { compare, compareHistoricalReads, consumeResult, decode, readHistorical, resolveConflict } from '../../src/index.js';
import { digest, fixture, value } from '../fixtures.js';

it('historical authority Conflict can be retained by a consumer but cannot resolve or supply live standing', () => {
  const f = fixture(); const other = f.grant({ expiresAt: 200 });
  const base = { register: f.ctx.register, captures: f.captures, now: f.now, preserved: f.ctx.preserved };
  const a = value(readHistorical('StandingGrant', f.g, f.historyPin(f.g), base));
  const b = value(readHistorical('StandingGrant', other, f.historyPin(other), base));
  const result = value(compareHistoricalReads('StandingGrant', a, b, 'identity', f.scope, { register: f.ctx.register, preserved: f.ctx.preserved, recordSubjects: {} }));
  if (typeof result === 'boolean') throw new Error('expected authority Conflict');
  expect(result.view.fields).toContain('source');
  const retained = { owner: 'downstream-consumer', conflict: result };
  expect(retained.conflict.kind).toBe('derived-conflict');
  const live = value(compare('StandingGrant', f.g, other, 'identity', f.scope, f.ctx.preserved));
  expect(result.view).toEqual(live);
  const { floor: _floor, ...decisionInput } = f.decisionInput({ by: f.alice,
    conclusion: { subject: digest(result.view), predicate: 'resolve-to-hash', value: digest(f.g), evidence: ['e1'] } });
  const decision = value(decode('Decision', decisionInput, f.ctx));
  for (const candidate of [result, result.view]) consumeResult(Reflect.apply(resolveConflict, undefined, [candidate, decision, f.g, f.now, f.ctx]), {
    Success: () => { throw new Error('historical Conflict became live'); }, Refused: r => expect(r.detail).toContain('decoded conflict'),
  });
  const auth = f.authInput();
  // Even a genuine live explicit-yes and principal context cannot authorize using
  // the historical grant carried inside the derived product.
  consumeResult(Reflect.apply(decode, undefined, ['Authorization', auth.input, { ...auth.context, grants: [result.view.left] }]), {
    Success: () => { throw new Error('historical side became standing'); }, Refused: r => expect(r.detail).toContain('not live'),
  });
  consumeResult(Reflect.apply(compare, undefined, ['StandingGrant', result.view.left, f.g, 'identity', f.scope, f.ctx.preserved]), {
    Success: () => { throw new Error('historical side entered live comparison'); }, Refused: r => expect(r.detail).toContain('comparison domain'),
  });
});
