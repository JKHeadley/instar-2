import { describe, expect, it } from 'vitest';
import { decodeDeclaration, decodeReference, decodeShape, implementedInvariants, invariantCoverage } from '../../src/register/index.js';
import { setup, detail, value, shapeInput } from './fixtures.js';

describe('declaration boundary', () => {
  it('P3-NF-02 missing required fact refuses at the declaring site', () => {
    const s = setup(); expect(detail(decodeDeclaration(s.declaration('store', 'stores', { growth: 'compacts' }), s.context))).toContain('holdsAgentMemory');
    expect(value(decodeDeclaration(s.declaration(), s.context)).declaredBy.path).toBe('src/example.ts');
  });
  it('P3-NF-03 unknown kind refuses instead of borrowing another shape', () => {
    const s = setup(); expect(detail(decodeDeclaration(s.declaration('x', 'unknown'), s.context))).toContain('P3-NF-03');
  });
  it('P3-NF-05 closed-list violations refuse, including cross-field memory deletion', () => {
    const s = setup(); const d = s.declaration();
    expect(detail(decodeDeclaration({ ...d, requiredFacts: { ...d.requiredFacts, growth: 'pretends' } }, s.context))).toContain('P3-NF-05');
    expect(detail(decodeDeclaration({ ...d, requiredFacts: { ...d.requiredFacts, growth: 'deletes' } }, s.context))).toContain('cannot be deleted');
  });
  it('P3-NF-06 rejects unbounded attention and absent bound references through P1', () => {
    const s = setup();
    for (const repeats of [{ kind: 'unbounded' }, { kind: 'bounded' }]) expect(detail(decodeDeclaration({ ...s.declaration(), profile: s.f.profileInput({ repeats }) }, s.context))).toMatch(/attention|by|bound/);
    expect(value(decodeDeclaration({ ...s.declaration(), profile: s.profile }, s.context)).profile?.repeats.kind).toBe('no');
  });
  it('P3-NF-12 old term kind fact refuses; field with allowed values decodes', () => {
    const s = setup(); const facts = { name: 'freshness', kind: 'fact', definition: 'A bounded window.', allowedValues: ['bounded'] };
    expect(detail(decodeDeclaration(s.declaration('freshness', 'terms', facts), s.context))).toContain('P3-NF-12');
    expect(value(decodeDeclaration(s.declaration('freshness', 'terms', { ...facts, kind: 'field' }), s.context)).kind).toBe('terms');
  });
  it('P3-NF-20 a named invariant with no implementation cannot ship', () => {
    const s = setup(); expect(detail(invariantCoverage(s.context.shape, [], s.context))).toContain('P3-NF-20');
    expect(value(invariantCoverage(s.context.shape, implementedInvariants, s.context))).toBe(true);
    const feature = s.declaration('feature', 'features', { metrics: [] }, { profile: s.profile });
    expect(detail(decodeDeclaration(feature, s.context))).toContain('metrics');
    expect(detail(decodeDeclaration({ ...feature, status: 'dark', requiredFacts: { metrics: ['latency'] } }, s.context))).toContain('object');
    expect(detail(decodeDeclaration({ ...feature, profile: s.f.profileInput(), requiredFacts: { metrics: ['latency'] } }, s.context))).toContain('liveProof');
  });
  it('P3-NF-30 runtime-only family input refuses, closed commit/extract source decodes', () => {
    const s = setup(); expect(detail(decodeDeclaration({ ...s.declaration(), family: { source: 'live-processes', mode: 'runtime' } }, s.context))).toContain('P3-NF-30');
    expect(value(decodeDeclaration({ ...s.declaration(), family: { source: 'tree-members', mode: 'commit-extract' } }, s.context)).family?.source).toBe('tree-members');
  });
  it('hostile unknown input never throws and cannot invoke accessors', () => {
    const s = setup(); const cyclic: unknown[] = []; cyclic.push(cyclic); let reads = 0;
    const getter = Object.defineProperty({}, 'type', { enumerable: true, get() { reads++; throw new Error('accessed'); } });
    for (const input of [undefined, null, 3, 'x', {}, cyclic, getter, new Map(), { type: 'Declaration', schemaVersion: 2 }]) {
      expect(() => detail(decodeDeclaration(input, s.context))).not.toThrow();
    }
    expect(reads).toBe(0);
  });
  it('generated fields and unregistered reference ids refuse; outputs are frozen', () => {
    const s = setup(); expect(detail(decodeDeclaration({ ...s.declaration(), owner: 'pretend-owner' }, s.context))).toContain('undeclared field');
    expect(detail(decodeReference({ type: 'Reference', schemaVersion: 1, id: 'absent', target: 'stores' }, s.context))).toContain('unresolved');
    expect(Object.isFrozen(value(decodeDeclaration(s.declaration(), s.context)).requiredFacts)).toBe(true);
  });
});
