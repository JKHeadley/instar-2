import { describe, expect, it } from 'vitest';
import { resolveTerms, verifyDerivedColumns, generateRegister } from '../../src/register/index.js';
import { setup, detail, value, clone } from '../register/fixtures.js';
describe('structured terms and shared profile derivations', () => {
  it('P3-NF-10 structured missing terms fail even without formatting; live terms gain usedBy', () => {
    const s = setup(); const rule = s.rule(4, { termRefs: ['term:record'] });
    expect(detail(generateRegister(s.input([rule]), s.context))).toContain('unresolved');
    const term = s.declaration('term:record', 'terms', { name: 'record', kind: 'noun', definition: 'An attributable observation.' });
    expect(value(resolveTerms(s.build([rule, term]), s.context)).usedBy['term:record']).toEqual(['rule:4']);
    expect(detail(resolveTerms(s.build([term, { ...term, id: 'other' }]), s.context))).toContain('multiple live');
  });
  it('P3-NF-11 profile adjectives are computed from term shape, never asserted', () => {
    const s = setup(); const d = { ...s.declaration(), profile: s.f.profileInput({ consequence: 'external', repeats: { kind: 'no' } }) };
    const r = s.build([d]); const terms = value(resolveTerms(r, s.context));
    expect(terms.adjectives.store).toEqual({ critical: true, significant: true, userFacing: true, irreversible: false });
    expect(value(verifyDerivedColumns(terms.adjectives, terms, s.context))).toBe(true);
    expect(detail(verifyDerivedColumns({ store: { critical: false } }, terms, s.context))).toContain('P3-NF-11');
    const term = s.declaration('term:critical', 'terms', { name: 'critical', kind: 'adjective', definition: 'Damages authority or irreversible data.', derivedFrom: { field: 'consequence', in: ['none'] } });
    expect(detail(resolveTerms(s.build([term]), s.context))).toContain('P3-NF-11');
  });
});
