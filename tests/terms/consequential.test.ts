import { describe, expect, it } from 'vitest';
import { deriveProfile, decode } from '../../src/index.js';
import type { ProfileTermsReadPort } from '../../src/index.js';
import { fixture, value } from '../fixtures.js';
import { shapeInput } from '../register/fixtures.js';

// Rules 34, 38, 43, 62, 76 use the glossary's verification profiles. These do not decide
// sign-off: the five profile fields cannot establish current role, thresholds or sensitive matters.
describe('the committed shape derives verification adjectives, independently of sign-off', () => {
  const f = fixture();
  const terms = { owner: 'part-three', derivedFrom: shapeInput().derivedFrom } as ProfileTermsReadPort;
  const derive = (input: Record<string, unknown>) => value(deriveProfile(value(decode('Profile', f.profileInput(input), f.ctx)), terms, f.ctx.preserved));
  it('critical and significant are one expression', () => {
    expect(terms.derivedFrom.significant).toEqual(terms.derivedFrom.critical);
  });
  it('an irreversible one-shot chat notice requires verification without deciding sign-off', () => {
    expect(derive({ consequence: 'attention', reversibility: 'irreversible', reach: 'user', surface: 'chat', repeats: { kind: 'no' } }))
      .toEqual({ critical: true, significant: true, userFacing: true, irreversible: true });
  });
  it('each declared risk independently requires verification', () => {
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
