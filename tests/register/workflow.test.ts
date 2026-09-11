import { describe, expect, it } from 'vitest';
import { defineDecoder, consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeShape, generateRegister, generationOf, decodeGenerationRecord, loadRegister, generateAgainstParent, runRegisterChecks, decodeDeclaration,
  decodeShapeChangeDocument, shapeDifferences } from '../../src/register/index.js';
import type { RegisterContext, SpineReadPort, FactReference, WorkflowChecks } from '../../src/register/index.js';
import { checkProtectedTests } from '../../scripts/check-register-protection.mjs';
import { readFileSync } from 'node:fs';
import { setup, json, value, detail, hash, shapeInput } from './fixtures.js';

function reply<T>(payload: T, context: RegisterContext): Result<T> {
  return value(defineDecoder<T, RegisterContext>({ name: 'WorkflowFixtureReply', owner: 'test-only', currentVersion: 1,
    versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {}, decodeCurrent: () => ({ ok: true, value: payload }) }, context.preserved))
    .decode(json('WorkflowFixtureReply', {}), context);
}
function changeDocument(parent: ReturnType<typeof setup>['context']['shape'], candidate: ReturnType<typeof setup>['context']['shape'],
  parentGeneration: string, fact: FactReference, context: RegisterContext, id = 'fixture-change') {
  return value(decodeShapeChangeDocument(json('ShapeChangeDocument', { id, parent: parentGeneration, candidateShape: hash(candidate),
    changes: shapeDifferences(parent, candidate), ownerReferences: [], approvedIn: fact }), context));
}
describe('repair workflow composition', () => {
  it.each(['loosening', 'tightening', 'incompatible tightening', 'required field', 'missing required field'])('P3-NF-09 N1 approved %s is loadable or refuses before publication', variant => {
    const s = setup();
    const raw = shapeInput() as { kinds: { name: string; invariants: string[]; fields: { name: string; format: string; required: boolean; values: string[]; reference: boolean; terms: string[] }[] }[] };
    const storeShape = raw.kinds.find(k => k.name === 'stores')!;
    storeShape.fields.push({ name: 'retentionLabel', format: 'text', required: false, values: [], reference: false, terms: [] });
    const context = { ...s.context, shape: value(decodeShape(raw, s.context)) };
    const store = { ...s.declaration(), requiredFacts: { ...s.declaration().requiredFacts,
      ...(variant === 'required field' ? { retentionLabel: 'kept' } : {}) } };
    const input = s.input([store]);
    const before = value(generateRegister(input, context)); const generation = value(generationOf(before, context));
    let record = value(decodeGenerationRecord(json('GenerationRecord', { generation, at: s.f.now }), context));
    const fact: FactReference = { owner: 'part-two', name: 'FactEnvelope', id: 'fixture:approval' };
    const provider = { owner: 'part-two' as const, verifyExtract: () => reply(fact, context), enteringForce: () => reply(record, context),
      isCurrent: () => reply(true, context), verifyShapeChange: () => reply(fact, context) };
    const parent = value(loadRegister(before, generation, context, provider, s.f.now));
    if (variant === 'loosening') storeShape.invariants = [];
    else if (variant.includes('tightening')) storeShape.fields.find(f => f.name === 'growth')!.values = [variant.startsWith('incompatible') ? 'summarizes' : 'compacts'];
    else storeShape.fields.find(f => f.name === 'retentionLabel')!.required = true;
    const candidate = value(decodeShape(raw, context));
    const document = changeDocument(parent.shape, candidate, generation.id, fact, context, variant);
    const binding = { parent: generation.id, candidateShape: hash(candidate), document: { path: 'approved-change.json', hash: hash(document) }, approval: fact };
    const result = generateAgainstParent(input, parent, candidate, binding, provider, context, document);
    if (variant.startsWith('incompatible') || variant.startsWith('missing')) {
      expect(detail(result)).toMatch(/closed list|retentionLabel/); return;
    }
    const next = value(result); const nextGeneration = value(generationOf(next, context));
    record = value(decodeGenerationRecord(json('GenerationRecord', { generation: nextGeneration, at: s.f.now }), context));
    expect(value(loadRegister(next, nextGeneration, context, provider, s.f.now))).toEqual(next);
    expect(next.shape).toEqual(candidate);
  });
  it('P3-NF-09 R5 ordinary declarations use verified parent shape; shape changes need exact approved binding', () => {
    const s = setup(); const before = s.build(); const generation = value(generationOf(before, s.context));
    const record = value(decodeGenerationRecord(json('GenerationRecord', { generation, at: s.f.now }), s.context));
    const approvals: unknown[] = [];
    const fact: FactReference = { owner: 'part-two', name: 'FactEnvelope', id: 'approval' };
    const provider: SpineReadPort & { verifyShapeChange: (binding: unknown) => Result<FactReference> } = {
      owner: 'part-two', verifyExtract: () => reply(fact, s.context), enteringForce: () => reply(record, s.context),
      isCurrent: () => reply(true, s.context), verifyShapeChange: binding => { approvals.push(binding); return reply(fact, s.context); } };
    const parent = value(loadRegister(before, generation, s.context, provider, s.f.now));
    const changed = shapeInput() as { kinds: { name: string; invariants: string[]; fields: { name: string; values: string[] }[] }[] };
    changed.kinds.find(k => k.name === 'stores')!.invariants = [];
    const candidate = value(decodeShape(changed, s.context));
    expect(detail(generateAgainstParent(s.input(), parent, candidate, null, provider, s.context))).toContain('P3-NF-09');
    const document = changeDocument(parent.shape, candidate, generation.id, fact, s.context);
    const binding = { parent: generation.id, candidateShape: hash(candidate), document: { path: 'register-source/shape-change.json', hash: hash(document) }, approval: fact };
    const bad = { ...s.declaration(), requiredFacts: { ...s.declaration().requiredFacts, growth: 'deletes' } };
    expect(detail(generateAgainstParent(s.input([bad]), parent, candidate, binding, provider, s.context, document))).toContain('P3-NF-20');
    expect(value(generateAgainstParent(s.input(), parent, candidate, binding, provider, s.context, document)).shape).toEqual(candidate);
    expect(approvals).toEqual([binding, binding]);
    changed.kinds.find(k => k.name === 'stores')!.fields.find(f => f.name === 'growth')!.values.push('invented');
    const widened = value(decodeShape(changed, s.context));
    expect(detail(generateAgainstParent(s.input(), parent, widened, binding, provider, s.context, document))).toContain('binding');
    const widenedDocument = changeDocument(parent.shape, widened, generation.id, fact, s.context, 'widened');
    const newBinding = { ...binding, candidateShape: hash(widened), document: { ...binding.document, hash: hash(widenedDocument) } };
    expect(detail(generateAgainstParent(s.input([{ ...bad, requiredFacts: { ...bad.requiredFacts, growth: 'invented' } }]), parent, widened, newBinding, provider, s.context, widenedDocument))).toContain('closed list');
  });
  it('P3-NF-13 P3-NF-15 P3-NF-24 P3-NF-27 P3-NF-29 R1 full ladder is callable without a production spine', () => {
    const s = setup(); const checks: WorkflowChecks = { mode: 'normal', branch: 'main', runs: [], catalog: { fixtures: [], probes: [], sentinels: [], semanticReviews: [] },
      landedParts: [], now: s.f.now, constructs: [], observations: [], separations: [], bootstrapRules: [],
      boundaries: s.context.shape.kinds.map(k => ({ kind: k.name, language: 'TypeScript', impossible: [], swept: ['static calls'], residual: ['plugins'] })),
      claims: s.context.shape.kinds.map(k => ({ kind: k.name, complete: false })) };
    expect(value(runRegisterChecks(s.build([s.rule(4)]), checks, s.context)).graph.gaps).toEqual([4]);
    expect(detail(runRegisterChecks(s.build([s.rule(4, { deadline: 99 })]), checks, s.context))).toContain('deadline passed');
    expect(detail(runRegisterChecks(s.build([s.rule(4), s.holder([{ rule: 999, class: 'deferred', part: 99, ceiling: 1000, owner: 'operator', overdueAction: 'surface' }])]), checks, s.context))).toContain('missing rule');
    expect(detail(runRegisterChecks(s.build([s.rule(4)]), { ...checks, claims: checks.claims.map(c => ({ ...c, complete: true })) }, s.context))).toContain('residual');
    expect(detail(runRegisterChecks(s.build([s.bound, { ...s.declaration(), profile: s.f.profileInput() }]), checks, s.context))).toContain('paired construct');
    const holder = s.holder([]);
    const guarded = { ...holder, requiredFacts: { ...holder.requiredFacts, decidesAlone: 'governed-state', enforces: { record: 'store', decoder: 'decode:Profile' } } };
    const row = { id: 'store', version: 'v1', status: 'live', since: 'commit:old', supersedes: [], approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'approval:1' },
      landedIn: 'commit:old', base: 'base:old', contentHash: hash(s.declaration()) };
    const governed = s.build([s.declaration(), guarded], { extract: { ...s.extract, rows: [row] } });
    const observed = { ...checks, observations: [{ site: 'holder', record: 'store', decoder: 'decode:Profile', reads: ['store'], invokes: ['decode:Profile'] }] };
    expect(detail(runRegisterChecks(s.build([s.declaration(), guarded]), { ...observed, mode: 'replay' }, s.context))).toContain('lacks approved history');
    expect(detail(runRegisterChecks(governed, observed, s.context))).toContain('standing evidence');
    const machine = s.f.principal('executor', 'system');
    const separated = { ...observed, separations: [{ site: 'holder', record: 'store', execution: { principal: machine, grants: s.f.grants, revocations: [], scope: s.f.scope, now: s.f.now },
      writer: s.f.alice, scope: s.f.scope, action: 'work' }] };
    expect(value(runRegisterChecks(governed, separated, s.context)).graph.gaps).toEqual([]);
    s.f.grant({ id: 'executor:write', grantee: machine, standing: 'delegate', actions: ['work'], expiresAt: 1000 });
    expect(detail(runRegisterChecks(governed, separated, s.context))).toContain('executing principal');
  });
  it('P3-NF-09 R8 every P3 suite path is protected, including moved/new mapped fixtures', () => {
    const s = setup(); const declarations = JSON.parse(readFileSync('src/register/toolchain.declarations.json', 'utf8')) as object[];
    const register = s.build(declarations);
    const paths = ['tests/register/new.test.ts', 'tests/terms/resolver.test.ts', 'tests/rulegraph/graph.test.ts', 'tests/integration/register.test.ts', 'tests/e2e/register.test.ts'];
    expect(checkProtectedTests(register, paths)).toBe(true);
    expect(() => checkProtectedTests(register, [...paths, 'tests/moved/new.test.ts'])).toThrow('unprotected');
  });
  it('P3-NF-02 inherited P1 boundary repair preserves open and closed sites on hostile input', () => {
    const s = setup();
    for (const [site, direction] of [['delivery', 'open'], ['types.decode', 'closed']] as const) {
      const result = decodeDeclaration(null, { ...s.context, site });
      consumeResult(result, { Success: () => { throw new Error('expected refusal'); }, Refused: r => {
        expect(r.site).toBe(site); expect(r.failDirection).toBe(direction); expect(r.preserved).toBe(s.context.preserved);
      } });
    }
  });
});
