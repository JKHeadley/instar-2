import { describe, expect, it } from 'vitest';
import { decode, defineDecoder } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { generateRegister, generationOf, decodeGenerationRecord, loadRegister, readRegisterEntry, readEnforcedRecord, checkGovernedState, buildRuleGraph, resolveTerms, renderRegister, planLandingCompletion } from '../../src/register/index.js';
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
  it('P3-P5 rungraph.contract retains approved history through the verified runtime consumer', () => {
    const s = setup(); const context = { ...s.context, references: [...s.context.references!, { provider: 'decoder' as const, id: 'decodeRun' }] };
    const contract = s.declaration('rungraph.contract', 'governed documents', { location: 'docs/09-the-run-graph.md', changelog: 'git-history:docs/09-the-run-graph.md' });
    const holder = s.holder([]); const gate = { ...holder, requiredFacts: { ...holder.requiredFacts, decidesAlone: 'governed-state', enforces: { record: 'rungraph.contract', decoder: 'decodeRun' } } };
    const observations = [{ site: 'holder', record: 'rungraph.contract', decoder: 'decodeRun', reads: ['rungraph.contract'], invokes: ['decodeRun'] }];
    const row = { id: 'rungraph.contract', version: 'contract:v1', status: 'live', since: 'commit:1', supersedes: [],
      approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'fixture:verified-approval' }, landedIn: 'commit:1', base: 'commit:1', contentHash: hash(contract) };
    for (const approved of [false, true]) {
      const candidate = value(generateRegister(s.input([contract, gate], { extract: { ...s.extract, rows: approved ? [row] : [] } }), context));
      const generation = value(generationOf(candidate, context));
      const record = value(decodeGenerationRecord(json('GenerationRecord', { generation, at: s.f.now }), context));
      const spine: SpineReadPort = { owner: 'part-two', verifyExtract: () => reply({ owner: 'part-two', name: 'FactEnvelope', id: 'fixture:extract' } as FactReference, context),
        enteringForce: () => reply(record, context), isCurrent: () => reply(true, context) };
      // A shape-only cast cannot impersonate loadRegister, regardless of rows.
      expect(detail(readRegisterEntry('rungraph.contract', candidate as Parameters<typeof readRegisterEntry>[1], context))).toContain('must use loadRegister');
      const loaded = value(loadRegister(candidate, generation, context, spine, s.f.now));
      if (approved) {
        expect(value(readRegisterEntry('rungraph.contract', loaded, context)).approvedIn).toEqual(row.approvedIn);
        expect(value(checkGovernedState(observations, loaded, context))).toBe(true);
        expect(detail(checkGovernedState([{ ...observations[0]!, invokes: [] }], loaded, context))).toContain('invoke named decoder');
      } else expect(detail(checkGovernedState(observations, loaded, context))).toContain('lacks approved history');
    }
  });
  it('P4 pair-aware runtime guard preserves the verified authority boundary before calling a real decoder', () => {
    const s = setup(), context = s.context;
    const contract = s.declaration('intake.contract', 'governed documents', { location: 'docs/08-the-intake.md', changelog: 'git-history:docs/08-the-intake.md' });
    const holder = s.holder([]), gate = { ...holder, requiredFacts: { ...holder.requiredFacts, decidesAlone: 'governed-state', enforces: { record: 'intake.contract', decoder: 'decode:Profile' } } };
    const row = { id: 'intake.contract', version: 'contract:v1', status: 'live', since: 'commit:1', supersedes: [],
      approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'fixture:approval' }, landedIn: 'commit:1', base: 'commit:1', contentHash: hash(contract) };
    for (const approved of [false, true]) {
      const candidate = value(generateRegister(s.input([contract, gate], { extract: { ...s.extract, rows: approved ? [row] : [] } }), context));
      const generation = value(generationOf(candidate, context));
      const record = value(decodeGenerationRecord(json('GenerationRecord', { generation, at: s.f.now }), context));
      const checks: string[] = [];
      const spine: SpineReadPort = { owner: 'part-two', verifyExtract: () => { checks.push('extract'); return reply(row.approvedIn as FactReference, context); },
        enteringForce: () => { checks.push('force'); return reply(record, context); }, isCurrent: () => { checks.push('current'); return reply(true, context); } };
      expect(detail(readEnforcedRecord('holder', 'intake.contract', 'decode:Profile', candidate as Parameters<typeof readEnforcedRecord>[3], context))).toContain('must use loadRegister');
      const loaded = value(loadRegister(candidate, generation, context, spine, s.f.now));
      expect(checks).toEqual(['extract', 'force', 'current']);
      let calls = 0;
      const consume = (site: string, name: string, decoder: string) => {
        value(readEnforcedRecord(site, name, decoder, loaded, context));
        calls++; return value(decode('Profile', s.profile, s.f.ctx));
      };
      for (const pair of [['missing', 'intake.contract', 'decode:Profile'], ['holder', 'other', 'decode:Profile'], ['holder', 'intake.contract', 'decode:Scope']]) {
        expect(() => consume(pair[0]!, pair[1]!, pair[2]!)).toThrow(); expect(calls).toBe(0);
      }
      if (approved) { expect(consume('holder', 'intake.contract', 'decode:Profile').type).toBe('Profile'); expect(calls).toBe(1); }
      else { expect(() => consume('holder', 'intake.contract', 'decode:Profile')).toThrow('approved history'); expect(calls).toBe(0); }
    }
  });
  it.skip('P3-NF-21 P3-NF-23 SKIPPED: production spine admission, signed vector verification and replica initialization require the part-two adapter, absent on this lane base', () => {});
});
