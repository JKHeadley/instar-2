import { describe, expect, it } from 'vitest';
import { canonical, consumeResult, decode, defineDecoder } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeExtract, decodeGenerationRecord, generateRegister, generationOf, loadRegister, verifyGenerated, constructGoverned, checkPairing, checkBoundaryCoverage,
  verifyLandingCompletion, readRegisterEntry } from '../../src/register/index.js';
import type { FactReference, GeneratedRegister, GenerationRecord, RegisterContext, SpineReadPort, VerifiedRegister } from '../../src/register/index.js';
import { setup, json, detail, value, hash, clone } from './fixtures.js';

export function portResult<T>(payload: T, context: RegisterContext): Result<T> {
  return value(defineDecoder<T, RegisterContext>({ name: 'TestPortReply', owner: 'test-only', currentVersion: 1,
    versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {},
    decodeCurrent: () => ({ ok: true, value: payload }),
  }, context.preserved)).decode(json('TestPortReply', {}), context);
}
export function spineFor(register: GeneratedRegister, s: ReturnType<typeof setup>): SpineReadPort {
  const generation = value(generationOf(register, s.context));
  const record = value(decodeGenerationRecord(json('GenerationRecord', { generation, at: s.f.now }), s.context));
  return { owner: 'part-two', verifyExtract: () => portResult({ owner: 'part-two', name: 'FactEnvelope', id: 'fact:verified-extract' } as FactReference, s.context),
    enteringForce: () => portResult(record, s.context), isCurrent: () => portResult(true, s.context) };
}
describe('register generation and consumption', () => {
  it('P3-NF-01 hand-edited generated output fails regenerate-and-compare', () => {
    const s = setup(); const r = s.build(); expect(value(verifyGenerated(r, s.build(), s.context))).toBe(true);
    expect(detail(verifyGenerated({ ...r, commit: 'pretend' }, r, s.context))).toContain('P3-NF-01');
  });
  it('P3-NF-04 governed construction and pairing reject an undeclared id', () => {
    const s = setup(); const r = s.build(); expect(detail(constructGoverned('stores', 'missing', r, s.context))).toContain('P3-NF-04');
    expect(value(constructGoverned('stores', 'store', r, s.context)).declaration.id).toBe('store');
    expect(detail(checkPairing(r, [{ id: 'missing', path: 'src/example.ts', symbol: 'example' }], s.context))).toContain('P3-NF-04');
  });
  it('P3-NF-06 generation resolves a repeat bound to a live critical outcome and probe', () => {
    const s = setup(); const d = { ...s.declaration(), profile: s.f.profileInput() };
    expect(detail(generateRegister(s.input([d]), s.context))).toContain('P3-NF-06');
    expect(s.build([d, s.bound]).entries).toHaveLength(2);
  });
  it('P3-NF-07 independent builds at the same C and E have byte-identical output', () => {
    const s = setup(); const a = s.build([s.declaration('a'), s.declaration('b')]);
    const second = setup(); const b = second.build([second.declaration('b'), second.declaration('a')]);
    expect(value(canonical(a))).toEqual(value(canonical(b)));
    expect(hash(s.build([s.declaration('a'), s.declaration('b')], { commit: 'commit:2' }))).not.toBe(hash(a));
    expect(hash(s.build([s.declaration('a'), s.declaration('b')], { extract: { ...s.extract, vector: { owner: 'part-two', name: 'FactPositionVector', id: 'vector:other' } } }))).not.toBe(hash(a));
  });
  it('P3-NF-08 consumer decoder rejects changed bytes under a genuine generation', () => {
    const s = setup(); const r = s.build(); const g = value(generationOf(r, s.context)); const spine = spineFor(r, s);
    const loaded = value(loadRegister(r, g, s.context, spine, s.f.now)); expect(loaded).toEqual(r);
    expect(value(readRegisterEntry('store', loaded, s.context)).declaration.id).toBe('store');
    expect(detail(readRegisterEntry('store', r as VerifiedRegister, s.context))).toContain('loadRegister');
    expect(detail(loadRegister({ ...r, commit: 'tampered' }, g, s.context, spine, s.f.now))).toContain('P3-NF-08');
  });
  it('nested spine refusals retain their original reason, site, direction and preserved input', () => {
    const s = setup(); const r = s.build(); const g = value(generationOf(r, s.context)); const spine = spineFor(r, s);
    const failed = decode('Profile', null, { ...s.f.ctx, preserved: 'capture:spine-original' });
    const refusal = consumeResult(failed, { Success: () => { throw new Error('expected refusal'); }, Refused: r => r });
    const loaded = loadRegister(r, g, s.context, { ...spine, verifyExtract: () => refusal }, s.f.now);
    consumeResult(loaded, { Success: () => { throw new Error('refusal swallowed'); }, Refused: r => expect(r).toBe(refusal) });
  });
  it('P3-NF-16 duplicate ids name both declaration sites and refuse', () => {
    const s = setup(); const input = s.input(); const sources = [s.source(s.declaration(), 'src/one.ts'), s.source(s.declaration(), 'src/two.ts')];
    const failure = detail(generateRegister({ ...input, sources }, s.context)); expect(failure).toContain('P3-NF-16'); expect(failure).toContain('src/one.ts'); expect(failure).toContain('src/two.ts');
  });
  it('P3-NF-17 retired ids cannot inherit standing without a recorded supersession', () => {
    const s = setup(); const row = { id: 'store', version: 'v1', status: 'retired', since: 'commit:old', supersedes: [],
      approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'approval:old' }, landedIn: 'commit:old', base: 'base:old', contentHash: hash(s.declaration()) };
    expect(detail(generateRegister(s.input([s.declaration()], { extract: { ...s.extract, rows: [row] } }), s.context))).toContain('P3-NF-17');
    const next = { ...row, version: 'v2', status: 'live', supersedes: ['v1'] };
    expect(s.build([s.declaration()], { extract: { ...s.extract, rows: [row, next] } }).entries[0]?.history).toHaveLength(2);
  });
  it('P3-NF-19 declared but unpaired caps fail; ordinary phantom declarations warn', () => {
    const s = setup(); const r = s.build([{ ...s.declaration(), profile: s.f.profileInput() }, s.bound]);
    expect(detail(checkPairing(r, [], s.context))).toContain('P3-NF-19');
    expect(value(checkPairing(r, [{ id: 'bound', path: 'src/example.ts', symbol: 'example' }], s.context)).warnings).toContain('phantom declaration: store');
  });
  it('P3-NF-21 a matching hash without an entering-force fact cannot govern', () => {
    const s = setup(); const r = s.build(); const g = value(generationOf(r, s.context)); const spine = spineFor(r, s);
    const other = value(decodeGenerationRecord(json('GenerationRecord', { generation: { ...g, commit: 'not-this-commit' }, at: s.f.now }), s.context));
    expect(detail(loadRegister(r, g, s.context, { ...spine, enteringForce: () => portResult(other, s.context) }, s.f.now))).toContain('P3-NF-21');
  });
  it('P3-NF-23 incomplete trees, unverifiable extracts, and stale vectors refuse', () => {
    const s = setup(); expect(detail(generateRegister(s.input([], { complete: false }), s.context))).toContain('P3-NF-23');
    const r = s.build(); const g = value(generationOf(r, s.context)); const spine = spineFor(r, s);
    expect(detail(loadRegister(r, g, s.context, { ...spine, isCurrent: () => portResult(false, s.context) }, s.f.now))).toContain('P3-NF-23');
    expect(detail(loadRegister(r, g, s.context, { ...spine, verifyExtract: () => { throw new Error('P3-NF-23: vector not verified'); } }, s.f.now))).toContain('not verified');
  });
  it('P3-NF-29 a residual-heavy boundary cannot report complete enumeration', () => {
    const s = setup(); const boundary = { kind: 'stores', language: 'TypeScript', impossible: ['missing port argument'], swept: ['static calls'], residual: ['reflection'] };
    expect(detail(checkBoundaryCoverage([boundary], [{ kind: 'stores', complete: true }], s.context))).toContain('P3-NF-29');
    expect(value(checkBoundaryCoverage([boundary], [{ kind: 'stores', complete: false }], s.context))).toEqual([boundary]);
  });
  it('P3-NF-30 closed family members are generated and duplicate members still refuse', () => {
    const s = setup(); const d = { ...s.declaration(), family: { mode: 'commit-extract', source: 'members' } };
    const r = s.build([d], { instances: { members: [{ id: 'member:1', requiredFacts: s.declaration().requiredFacts }] } });
    expect(r.entries.map(e => e.declaration.id)).toEqual(['member:1', 'store']);
    expect(detail(generateRegister(s.input([d], { instances: { members: [{ id: 'store', requiredFacts: s.declaration().requiredFacts }] } }), s.context))).toContain('P3-NF-16');
  });
  it('P3-NF-22 a landing completion may fill pending fields but cannot edit content', () => {
    const s = setup(); const before = s.build();
    const row = { id: 'store', version: 'v1', status: 'live', since: 'commit:1', supersedes: [],
      approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'approval:1' }, landedIn: 'commit:land', base: 'commit:1', contentHash: hash(s.declaration()) };
    const after = s.build([s.declaration()], { extract: { ...s.extract, rows: [row] } });
    expect(value(verifyLandingCompletion(before, after, s.context))).toBe(true);
    expect(value(verifyLandingCompletion(after, after, s.context))).toBe(true);
    const changed = clone(after) as unknown as { entries: { declaration: { requiredFacts: { growth: string } } }[] };
    changed.entries[0]!.declaration.requiredFacts.growth = 'deletes';
    expect(detail(verifyLandingCompletion(before, changed as unknown as GeneratedRegister, s.context))).toContain('P3-NF-22');
  });
});
