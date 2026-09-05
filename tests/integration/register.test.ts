import { describe, expect, it } from 'vitest';
import { decode, defineDecoder } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { generateRegister, generationOf, decodeGenerationRecord, loadRegister, buildRuleGraph, resolveTerms, renderRegister, planLandingCompletion } from '../../src/register/index.js';
import type { FactReference, RegisterContext, SpineReadPort } from '../../src/register/index.js';
import { setup, json, value, detail, hash } from '../register/fixtures.js';

function reply<T>(payload: T, context: RegisterContext): Result<T> {
  return value(defineDecoder<T, RegisterContext>({ name: 'SpineFixtureReply', owner: 'test-only', currentVersion: 1,
    versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {}, decodeCurrent: () => ({ ok: true, value: payload }) }, context.preserved)).decode(json('SpineFixtureReply', {}), context);
}
describe('register integration with constitutional types and explicit spine port', () => {
  it('real public components compose from declaration decode through graph and renderings', () => {
    const s = setup(); const record = value(generateRegister(s.input([s.rule(4)]), s.context));
    const terms = value(resolveTerms(record, s.context)); const graph = value(buildRuleGraph(record, 'branch', [], { fixtures: [], probes: [], sentinels: [], semanticReviews: [] }, s.context));
    const generation = value(generationOf(record, s.context)); const renderings = value(renderRegister(record, generation, terms, graph, s.context));
    expect(renderings.ruleBook).toContain('Rule 4'); expect(renderings.coverage).toContain('| gap | 1 |');
    expect(renderings.register).toContain('pending-landing');
  });
  it('P3-NF-21 P3-NF-23 load delegates all three authority checks to the spine provider', () => {
    const s = setup(); const register = s.build(); const generation = value(generationOf(register, s.context)); const calls: string[] = [];
    const record = value(decodeGenerationRecord(json('GenerationRecord', { generation, at: s.f.now }), s.context));
    const spine: SpineReadPort = { owner: 'part-two', verifyExtract: extract => { calls.push(`extract:${extract.vector.id}`); return reply({ owner: 'part-two', name: 'FactEnvelope', id: 'fact:extract' } as FactReference, s.context); },
      enteringForce: supplied => { calls.push(`force:${supplied.id}`); return reply(record, s.context); },
      isCurrent: (vector, now) => { calls.push(`current:${vector.id}:${now.value}`); return reply(true, s.context); } };
    expect(value(loadRegister(register, generation, s.context, spine, s.f.now))).toEqual(register);
    expect(calls).toEqual([`extract:${register.extract.vector.id}`, `force:${generation.id}`, `current:${register.extract.vector.id}:100`]);
  });
  it('P3-NF-22 completion plans require live genesis standing and remain unanchored until append', () => {
    const s = setup(); const machine = s.f.principal('landing', 'system'); const before = s.build(); const gen = value(generationOf(before, s.context));
    const record = value(decodeGenerationRecord(json('GenerationRecord', { generation: gen, at: s.f.now }), s.context));
    const spine: SpineReadPort = { owner: 'part-two', verifyExtract: () => reply({ owner: 'part-two', name: 'FactEnvelope', id: 'fact:extract' } as FactReference, s.context),
      enteringForce: () => reply(record, s.context), isCurrent: () => reply(true, s.context) };
    const actions = ['append:version-chain', 'append:generation-record', 'append:check-run-record'];
    Object.assign(s.f.ctx.register.actions, Object.fromEntries(actions.map(action => [action, { protected: false, repository: false }])));
    s.f.grant({ id: 'genesis:landing', grantee: machine, standing: 'delegate', actions, expiresAt: 1000 });
    const standing = { principal: machine, grants: s.f.grants, revocations: [], scope: s.f.scope, now: s.f.now };
    const row = { id: 'store', version: 'v1', status: 'live', since: 'commit:1', supersedes: [], approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'approval:1' },
      landedIn: 'landed:1', base: 'commit:1', contentHash: hash(s.declaration()) };
    const extract = { ...s.extract, rows: [row] };
    const planned = value(planLandingCompletion(before, extract, standing, spine, s.context));
    expect(planned.authority).toBe('requires-part-two-append');
    expect(detail(loadRegister(planned.register, planned.recordToAppend.generation, s.context, spine, s.f.now))).toContain('P3-NF-21');
    expect(detail(planLandingCompletion(before, extract, { ...standing, grants: [] }, spine, s.context))).toContain('standing');
    const payload = { id: 'revoke:landing', grantId: 'genesis:landing', by: s.f.alice, at: s.f.now, reason: 'withdrawn' }; const proof = s.f.proof(payload);
    const revoked = value(decode('Revocation', json('Revocation', { ...payload, source: proof.p }), { ...s.f.ctx, provenance: proof.p }));
    expect(detail(planLandingCompletion(before, extract, { ...standing, revocations: [revoked] }, spine, s.context))).toContain('revoked');
  });
  it.skip('P3-NF-21 P3-NF-23 SKIPPED: production spine admission, signed vector verification and replica initialization require the part-two adapter, absent on this lane base', () => {});
});
