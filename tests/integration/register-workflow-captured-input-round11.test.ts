import { describe, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import type { Json, Result, Validation } from '../../src/index.js';
import { createFactStore, registerOwnedBody } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeCheckRun,
  decodeRegisteredFact, runRegisterChecks } from '../../src/register/index.js';
import type { WorkflowChecks } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { detail, json, setup, value } from '../register/fixtures.js';
import { ownedPolicy, ownedSchema } from '../register/normal-provider-fixture.js';

const validation = <T>(result: Result<T>): Validation<T> => consumeResult<T, Validation<T>>(result, {
  Success: decoded => ({ ok: true, value: decoded }),
  Refused: refusal => ({ ok: false, reason: refusal.reason, detail: refusal.detail }),
});

function checksFor(register: ReturnType<ReturnType<typeof setup>['build']>,
  overrides: Partial<WorkflowChecks> = {}): WorkflowChecks {
  const s = setup();
  return { mode: 'normal', branch: 'main', runs: [],
    catalog: { fixtures: [], probes: [], sentinels: [], semanticReviews: [] }, landedParts: [], now: s.f.now,
    constructs: [], observations: [], separations: [], bootstrapRules: [],
    boundaries: register.shape.kinds.map(kind => ({ kind: kind.name, language: 'TypeScript', impossible: [], swept: [], residual: [] })),
    claims: register.shape.kinds.map(kind => ({ kind: kind.name, complete: false })), ...overrides };
}

describe('round-eleven captured workflow decision input', () => {
  it('P3-NF-28 uses the captured main branch and does not count a signed foreign-branch run', () => {
    const s = setup(), f = factsFixture();
    const register = s.build([s.rule(26), s.holder([{ rule: 26, class: 'held',
      evidence: { kind: 'fixture', id: 'check', stage: 'build' }, semanticallyReviewed: 'never' }])]);
    const rawRun = JSON.parse(JSON.stringify(json('CheckRunRecord', { id: 'run:foreign', commit: register.commit,
      branch: 'foreign-branch', providerRun: 'ci:foreign', outcome: 'passed',
      fixtures: [{ id: 'check', stage: 'build', outcome: 'passed' }], at: f.now }))) as Json;
    const run = value(decodeCheckRun(rawRun, s.context));
    const registration = value(registerOwnedBody({ owner: 'part-three', name: 'CheckRunRecord', currentVersion: 1,
      versions: { 1: { validate: input => ({ ok: true as const, value: input }) } }, migrations: {},
      decodeCurrent: input => validation(decodeRegisteredFact('check-run-record', input, s.context)) }, ownedPolicy(rawRun), f.c));
    const context = { ...f.ctx, facts: [], schemas: [f.schema,
      ownedSchema('check-run-record', 'part-three', 'CheckRunRecord', f.scope)], ownedBodies: [registration] };
    const root = f.fact({}, context), signed = f.next(root, { kind: 'check-run-record', body: { record: rawRun } }, context);
    const store = createFactStore(context, { owner: 'part-ten', read: () => [root, signed],
      append: () => { throw new Error('read-only'); } });
    const provider = createPartTwoRegisterProvider({ store,
      authority: createPartTwoRegisterAuthority({ facts: context, scope: f.scope,
        landing: { owner: 'part-ten', merges: [] }, context: s.context }),
      horizon: { lineages: { 'machine-a': { head: { epoch: 0, position: 1 }, observedAt: 100, closed: false } },
        stalenessBound: 100 }, context: s.context });
    const plain = checksFor(register, { runs: [run],
      catalog: { fixtures: [{ id: 'check', stage: 'build' }], probes: [], sentinels: [], semanticReviews: [] } });
    const moving = new Proxy(plain, { get(target, key, receiver) {
      return key === 'branch' ? 'foreign-branch' : Reflect.get(target, key, receiver);
    } });

    expect((JSON.parse(value(canonical(moving)).bytes) as { branch: string }).branch).toBe('main');
    expect(value(runRegisterChecks(register, moving, s.context, provider)).graph.totals['held-unreviewed']).toBe(0);
    expect(value(runRegisterChecks(register, { ...plain, branch: 'foreign-branch' }, s.context, provider))
      .graph.totals['held-unreviewed']).toBe(1);
  });

  it('P3-NF-24 uses captured landed parts while the consistently unlanded neighbour accepts', () => {
    const s = setup();
    const register = s.build([s.rule(26), s.holder([{ rule: 26, class: 'deferred', part: 9, ceiling: 1000,
      owner: 'part-nine', overdueAction: 'surface' }])]);
    const plain = checksFor(register, { landedParts: [9] });
    const moving = new Proxy(plain, { get(target, key, receiver) {
      return key === 'landedParts' ? [] : Reflect.get(target, key, receiver);
    } });

    expect((JSON.parse(value(canonical(moving)).bytes) as { landedParts: number[] }).landedParts).toEqual([9]);
    expect(detail(runRegisterChecks(register, moving, s.context))).toContain('P3-NF-24');
    expect(value(runRegisterChecks(register, { ...plain, landedParts: [] }, s.context)).graph.totals.deferred).toBe(1);
  });

  it('P3-NF-28 uses captured normal mode and still requires signed evidence', () => {
    const s = setup();
    const register = s.build([s.rule(26), s.holder([{ rule: 26, class: 'held',
      evidence: { kind: 'fixture', id: 'check', stage: 'build' }, semanticallyReviewed: 'never' }])]);
    const run = value(decodeCheckRun(json('CheckRunRecord', { id: 'unwitnessed', commit: register.commit, branch: 'main',
      providerRun: 'ci:unwitnessed', outcome: 'passed', fixtures: [{ id: 'check', stage: 'build', outcome: 'passed' }],
      at: s.f.now }), s.context));
    const plain = checksFor(register, { runs: [run],
      catalog: { fixtures: [{ id: 'check', stage: 'build' }], probes: [], sentinels: [], semanticReviews: [] } });
    const moving = new Proxy(plain, { get(target, key, receiver) {
      return key === 'mode' ? 'replay' : Reflect.get(target, key, receiver);
    } });

    expect((JSON.parse(value(canonical(moving)).bytes) as { mode: string }).mode).toBe('normal');
    expect(detail(runRegisterChecks(register, moving, s.context))).toContain('signed Part Two record verifier');
    expect(value(runRegisterChecks(register, { ...plain, mode: 'replay' }, s.context)).authority).toBe('shape-only');
  });
});
