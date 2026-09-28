import { describe, expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { buildRuleGraph, checkDeadlines, checkGraphLoops, decodeCheckRun, checkSeparation, semanticReviewSubject } from '../../src/register/index.js';
import type { CheckCatalog, RuleGraph } from '../../src/register/index.js';
import { setup, json, value, detail, clone } from '../register/fixtures.js';

const catalog: CheckCatalog = { fixtures: [{ id: 'fixture:4', stage: 'build' }], probes: [], sentinels: [], semanticReviews: [] };
const held = { rule: 4, class: 'held', evidence: { kind: 'fixture', id: 'fixture:4', stage: 'build' }, semanticallyReviewed: 'never' };
describe('both-way rule graph and deadlines', () => {
  it('P3-NF-13 a holder naming a missing rule fails; governed-by creates no edge', () => {
    const s = setup(); expect(detail(buildRuleGraph(s.build([s.holder([held])]), 'branch', [], catalog, s.context))).toContain('P3-NF-13');
    const graph = value(buildRuleGraph(s.build([s.rule(4), { ...s.declaration(), standards: [4] }]), 'branch', [], catalog, s.context));
    expect(graph.rules[0]?.enforcedBy).toEqual([]); expect(graph.gaps).toEqual([4]);
  });
  it('P3-NF-13 dark, soaking and retired entries still resolve their rule references but mint no live edge (Rule 69)', () => {
    const s = setup();
    const deferred = { rule: 999, class: 'deferred', part: 9, ceiling: 1000, owner: 'review', overdueAction: 'surface' };
    for (const status of ['dark', 'soaking', 'retired']) {
      expect(detail(buildRuleGraph(s.build([s.rule(4), { ...s.declaration(), status, standards: [999] }]), 'branch', [], catalog, s.context))).toContain('P3-NF-13');
      expect(detail(buildRuleGraph(s.build([s.rule(4), s.holder([deferred], { status })]), 'branch', [], catalog, s.context))).toContain('P3-NF-13');
      // A retired rule is still history an inactive entry may cite; neither mints enforcement.
      const graph = value(buildRuleGraph(s.build([s.rule(4), { ...s.rule(7), status: 'retired' }, s.holder([held], { status, standards: [7] })]), 'branch', [], catalog, s.context));
      expect(graph.edges).toEqual([]); expect(graph.gaps).toEqual([4]);
    }
  });
  it('P3-NF-14 a fixture must exist at its stage and a probe must declare cadence', () => {
    const s = setup(); const r = s.build([s.rule(4), s.holder([held])]);
    expect(detail(buildRuleGraph(r, 'branch', [], { ...catalog, fixtures: [{ id: 'fixture:4', stage: 'test' }] }, s.context))).toContain('P3-NF-14');
    const probe = s.build([s.rule(4), s.holder([{ ...held, evidence: { kind: 'probe', id: 'probe', stage: 'runtime' } }])]);
    expect(detail(buildRuleGraph(probe, 'branch', [], { ...catalog, probes: [{ id: 'probe', cadence: 0 }] }, s.context))).toContain('P3-NF-14');
  });
  it('P3-NF-15 gaps and deferrals have accountable loops; omitted loops fail', () => {
    const s = setup(); const r = s.build([s.rule(4), s.rule(7), s.holder([{ rule: 4, class: 'deferred', part: 9, ceiling: 1000, owner: 'review', overdueAction: 'surface' }])]);
    const graph = value(buildRuleGraph(r, 'branch', [], catalog, s.context)); expect(graph.loops).toHaveLength(2);
    expect(value(checkGraphLoops(graph, s.context))).toBe(true);
    expect(detail(checkGraphLoops({ ...graph, loops: [] } as unknown as RuleGraph, s.context))).toContain('P3-NF-15');
  });
  it('P3-NF-18 a holder may enforce only its shape table subjects', () => {
    const s = setup(); expect(detail(buildRuleGraph(s.build([s.rule(7), s.holder([{ ...held, rule: 7 }])]), 'branch', [], catalog, s.context))).toContain('P3-NF-18');
    expect(value(buildRuleGraph(s.build([s.rule(4), s.holder([held])]), 'branch', [], catalog, s.context)).edges).toHaveLength(1);
  });
  it('P3-NF-24 deferrals cannot survive unknown parts, a landing, or a ceiling', () => {
    const s = setup(); const deferred = { rule: 4, class: 'deferred', part: 9, ceiling: 1000, owner: 'review', overdueAction: 'surface' };
    expect(detail(buildRuleGraph(s.build([s.rule(4), s.holder([{ ...deferred, part: 99 }])]), 'branch', [], catalog, s.context))).toContain('P3-NF-24');
    const r = s.build([s.rule(4), s.holder([deferred])]); const graph = value(buildRuleGraph(r, 'branch', [], catalog, s.context));
    expect(value(checkDeadlines(graph, r, [], s.f.now, s.context))).toBe(true);
    expect(detail(checkDeadlines(graph, r, [9], s.f.now, s.context))).toContain('P3-NF-24');
    expect(detail(checkDeadlines(graph, r, [], s.f.clock(1000), s.context))).toContain('P3-NF-24');
    expect(detail(checkDeadlines(graph, r, [], s.f.clock(1001), s.context))).toContain('P3-NF-24');
  });
  it('P3-NF-25 runtime sentinel evidence requires a declared freshness probe', () => {
    const s = setup(); const r = s.build([s.rule(4), s.holder([{ ...held, evidence: { kind: 'sentinel', id: 'watcher', stage: 'runtime' } }])]);
    expect(detail(buildRuleGraph(r, 'branch', [], { ...catalog, sentinels: [{ id: 'watcher', freshnessProbe: 'probe' }] }, s.context))).toContain('P3-NF-25');
    expect(value(buildRuleGraph(r, 'branch', [], { ...catalog, probes: [{ id: 'probe', cadence: 50 }], sentinels: [{ id: 'watcher', freshnessProbe: 'probe' }] }, s.context)).edges[0]?.class).toBe('held-unreviewed');
  });
  it('P3-NF-28 fixtures with no executed branch record render declared, not held', () => {
    const s = setup(); const r = s.build([s.rule(4), s.holder([held])]);
    const run = (branch: string, outcome = 'passed') => value(decodeCheckRun(json('CheckRunRecord', { id: 'run', commit: 'commit:1', branch,
      providerRun: 'ci:run/1', outcome, fixtures: [{ id: 'fixture:4', stage: 'build', outcome }], at: s.f.now }), s.context));
    expect(value(buildRuleGraph(r, 'branch', [], catalog, s.context)).edges[0]?.class).toBe('declared');
    expect(value(buildRuleGraph(r, 'branch', [run('other')], catalog, s.context)).edges[0]?.class).toBe('declared');
    expect(value(buildRuleGraph(r, 'branch', [run('branch', 'incomplete')], catalog, s.context)).edges[0]?.class).toBe('declared');
    const graph = value(buildRuleGraph(r, 'branch', [run('branch')], catalog, s.context));
    expect(graph.edges[0]?.class).toBe('held-unreviewed'); expect(graph.totals['held-reviewed']).toBe(0);
    expect(value(buildRuleGraph(r, 'branch', [run('branch', 'failed')], catalog, s.context)).edges[0]?.class).toBe('held-unreviewed');
    // A failing run remains a failing historical record, even though execution is now proved.
    expect(run('branch', 'failed').outcome).toBe('failed');
  });
  it('P3-NF-27 compares real scoped live grants and revocations, not principal labels', () => {
    const s = setup(); const machine = s.f.principal('landing', 'system');
    const execution = { principal: machine, grants: s.f.grants, revocations: s.f.revocations, scope: s.f.scope, now: s.f.now };
    expect(value(checkSeparation(execution, s.f.alice, s.f.scope, 'work', s.context))).toBe(true);
    s.f.grant({ id: 'landing-grant', grantee: machine, standing: 'delegate', actions: ['work'], expiresAt: 1000 });
    expect(detail(checkSeparation(execution, s.f.alice, s.f.scope, 'work', s.context))).toContain('P3-NF-27');
    const payload = { id: 'revoke', grantId: 'landing-grant', by: s.f.alice, at: s.f.now, reason: 'withdrawn' }; const proof = s.f.proof(payload);
    const revocation = value(decode('Revocation', json('Revocation', { ...payload, source: proof.p }), { ...s.f.ctx, provenance: proof.p }));
    expect(value(checkSeparation({ ...execution, revocations: [revocation] }, s.f.alice, s.f.scope, 'work', s.context))).toBe(true);
    expect(detail(checkSeparation({ ...execution, now: s.f.clock(0) }, s.f.alice, s.f.scope, 'work', s.context))).toContain('standing');
  });
  it('parent and merge cycles fail; generated tree relationships are reciprocal', () => {
    const s = setup(); const cycle = s.build([s.rule(4, { parent: 7 }), s.rule(7, { parent: 4 })]);
    expect(detail(buildRuleGraph(cycle, 'branch', [], catalog, s.context))).toContain('cycle');
    const graph = value(buildRuleGraph(s.build([s.rule(4), s.rule(7, { parent: 4 })]), 'branch', [], catalog, s.context));
    expect(graph.rules.find(r => r.number === 4)?.children).toEqual([7]);
  });
  it('reviewed totals require a review record bound to current holder and rule content', () => {
    const s = setup(); const h = { ...held, evidence: { kind: 'probe', id: 'probe', stage: 'runtime' }, semanticallyReviewed: 'reviewed-generation' };
    const r = s.build([s.rule(4), s.holder([h])]); const subjectHash = value(semanticReviewSubject(r, 'holder', 4, s.context));
    const c = { ...catalog, probes: [{ id: 'probe', cadence: 100 }], semanticReviews: [{ holder: 'holder', rule: 4, generation: 'reviewed-generation', subjectHash, record: 'part-nine:review:1' }] };
    expect(value(buildRuleGraph(r, 'branch', [], c, s.context)).totals['held-reviewed']).toBe(1);
    const changed = s.build([s.rule(4, { statement: 'Different obligation.' }), s.holder([h])]);
    expect(value(buildRuleGraph(changed, 'branch', [], c, s.context)).totals['held-reviewed']).toBe(0);
  });
});
