import { describe, expect, it } from 'vitest';
import { deriveProfile, decode } from '../../src/index.js';
import type { ProfileTermsReadPort } from '../../src/index.js';
import { fixture, value } from '../fixtures.js';
import { shapeInput } from '../register/fixtures.js';

// Rules 34, 38, 43, 62, 76 read "critical", "significant" and "user-facing" through the purpose's
// single consequential-effect definition. This reads the COMMITTED shape, so a stale formula fails here.
describe('the committed shape derives the purpose-aligned adjectives', () => {
  const f = fixture();
  const terms = { owner: 'part-three', derivedFrom: shapeInput().derivedFrom } as ProfileTermsReadPort;
  const derive = (input: object) => value(deriveProfile(value(decode('Profile', f.profileInput(input), f.ctx)), terms, f.ctx.preserved));
  it('critical and significant are one expression', () => {
    expect(terms.derivedFrom.significant).toEqual(terms.derivedFrom.critical);
  });
  it('an irreversible one-shot chat notice is consequential (the audit counterexample)', () => {
    expect(derive({ consequence: 'attention', reversibility: 'irreversible', reach: 'user', surface: 'chat', repeats: { kind: 'no' } }))
      .toEqual({ critical: true, significant: true, userFacing: true, irreversible: true });
  });
  it('each of the four tests alone makes an effect consequential', () => {
    const ordinary = { consequence: 'none', reversibility: 'reversible', reach: 'internal', surface: 'none', repeats: { kind: 'no' } };
    for (const change of [{ reversibility: 'irreversible' }, { consequence: 'money' }, { reach: 'world' }, { consequence: 'security' }, { consequence: 'identity' }, { consequence: 'control' }, { consequence: 'external' }])
      expect(derive({ ...ordinary, ...change }).critical).toBe(true);
    expect(derive(ordinary)).toEqual({ critical: false, significant: false, userFacing: false, irreversible: false });
  });
  it('visibility alone is user-facing, not significant', () => {
    expect(derive({ consequence: 'attention', reversibility: 'reversible', reach: 'user', surface: 'chat', repeats: { kind: 'no' } }))
      .toEqual({ critical: false, significant: false, userFacing: true, irreversible: false });
  });
});
