import { describe, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import type { Clock, Json, Result, Validation } from '../../src/index.js';
import { authorAndAppend, registerOwnedBody } from '../../src/facts/index.js';
import type { FactSchema, OwnedBodyRegistration } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeCheckRun,
  decodeRegisteredFact, runRegisterChecks, semanticReviewSubject } from '../../src/register/index.js';
import type { RegisterContext } from '../../src/register/index.js';
import { privateKey } from '../facts/fixtures.js';
import { detail, json, setup, value } from '../register/fixtures.js';
import { ownedPolicy, ownedSchema } from '../register/normal-provider-fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';

const validation = <T>(result: Result<T>): Validation<T> => consumeResult<T, Validation<T>>(result, {
  Success: decoded => ({ ok: true, value: decoded }),
  Refused: refusal => ({ ok: false, reason: refusal.reason, detail: refusal.detail }),
});

function evidenceFixture(contextWithoutClock = false) {
  const s = setup();
  const holds = [{ rule: 26, class: 'held' as const,
    evidence: { kind: 'fixture' as const, id: 'check', stage: 'build' }, semanticallyReviewed: 'generation:1' }];
  const register = s.build([s.rule(26), s.holder(holds), { ...s.holder(holds), id: 'other-holder' }]);
  const holderHash = value(semanticReviewSubject(register, 'holder', 26, s.context));
  const otherHash = value(semanticReviewSubject(register, 'other-holder', 26, s.context));
  const v = verificationRuntimeFixture();
  const rawRun = JSON.parse(JSON.stringify(json('CheckRunRecord', { id: 'check-run:round-ten', commit: register.commit,
    branch: 'main', providerRun: 'ci:round-ten', outcome: 'passed',
    fixtures: [{ id: 'check', stage: 'build', outcome: 'passed' }], at: v.clock(100) }))) as Json;
  const run = value(decodeCheckRun(rawRun, s.context));
  const body = value(registerOwnedBody({ owner: 'part-three', name: 'CheckRunRecord', currentVersion: 1,
    versions: { 1: { validate: input => ({ ok: true as const, value: input }) } }, migrations: {},
    decodeCurrent: input => validation(decodeRegisteredFact('check-run-record', input, s.context)) }, ownedPolicy(rawRun), v.c));
  const mutable = v.context as unknown as { schemas: FactSchema[]; ownedBodies?: OwnedBodyRegistration[] };
  mutable.schemas.push(ownedSchema('check-run-record', 'part-three', 'CheckRunRecord', v.scope));
  mutable.ownedBodies = [...(mutable.ownedBodies ?? []), body];
  const signedRun = value(authorAndAppend({ kind: 'check-run-record', schemaVersion: 1, machine: 'machine-a',
    principal: JSON.parse(JSON.stringify(v.alice)), provenance: JSON.parse(JSON.stringify(v.alice.provenance)),
    at: JSON.parse(JSON.stringify(v.clock(100))), body: { record: rawRun }, required: [] },
  v.context, v.store, privateKey)).fact;
  const reviewRecord = value(v.runtime.record('SemanticReviewRecord', { ...verificationInput('SemanticReviewRecord'),
    edge: 'rule:26->other-holder', holderHash: otherHash, checkRuns: [run.id],
    evidencePopulation: [signedRun.id], layerBelow: [signedRun.id] }));
  const reviewFact = value(v.store.read()).find(row => row.kind === 'verification-SemanticReviewRecord')!;
  const context = (contextWithoutClock ? { ...s.context, authorityTypes: undefined,
    types: { ...s.context.types, now: undefined } } : { ...s.context,
    types: { ...s.context.types, now: v.clock(100) } }) as unknown as RegisterContext;
  const provider = createPartTwoRegisterProvider({ store: v.store,
    authority: createPartTwoRegisterAuthority({ facts: v.context, scope: v.scope,
      landing: { owner: 'part-ten', merges: [] }, context }),
    horizon: { lineages: { 'machine-a': { head: { epoch: 0, position: 1 }, observedAt: 100, closed: false } },
      stalenessBound: 100 }, context });
  const correct = { holder: 'other-holder', rule: 26, generation: reviewRecord.generation,
    subjectHash: otherHash, record: reviewFact.id };
  const wrong = { ...correct, holder: 'holder', subjectHash: holderHash };
  const checks = (review: typeof correct, now: Clock) => ({ mode: 'normal' as const, branch: 'main', runs: [run],
    catalog: { fixtures: [{ id: 'check', stage: 'build' }], probes: [], sentinels: [], semanticReviews: [review] },
    landedParts: [], now, constructs: [], observations: [], separations: [], bootstrapRules: [],
    boundaries: register.shape.kinds.map(kind => ({ kind: kind.name, language: 'TypeScript', impossible: [], swept: [], residual: [] })),
    claims: register.shape.kinds.map(kind => ({ kind: kind.name, complete: false })) });
  return { s, v, register, run, signedRun, provider, correct, wrong, checks };
}

describe('round-ten captured normal evidence boundary', () => {
  it('P3-NF-28 refuses holder and subject reassignment after Part One captures the signed review input', () => {
    const f = evidenceFixture();
    expect(value(f.provider.verifySemanticReview(f.correct, f.v.clock(100)))).toBe(true);
    expect(detail(f.provider.verifySemanticReview(f.wrong, f.v.clock(100)))).toContain('does not bind this exact holder');

    const reads = { holder: 0, subjectHash: 0 };
    const moving = new Proxy(f.wrong, { get(target, key, receiver) {
      if (key === 'holder' || key === 'subjectHash') {
        reads[key]++;
        return reads[key] === 1 ? f.correct[key] : f.wrong[key];
      }
      return Reflect.get(target, key, receiver);
    } });
    const captured = JSON.parse(value(canonical(moving)).bytes) as typeof f.wrong;
    expect(captured).toMatchObject({ holder: 'holder', subjectHash: f.wrong.subjectHash });
    expect(detail(f.provider.verifySemanticReview(moving, f.v.clock(100)))).toContain('does not bind this exact holder');

    const workflowReads = { holder: 0, subjectHash: 0 };
    const workflowReview = new Proxy(f.wrong, { get(target, key, receiver) {
      if (key === 'holder' || key === 'subjectHash') {
        workflowReads[key]++;
        return workflowReads[key] === 1 ? f.correct[key] : f.wrong[key];
      }
      return Reflect.get(target, key, receiver);
    } });
    value(canonical(workflowReview));
    expect(detail(runRegisterChecks(f.register, f.checks(workflowReview, f.v.clock(100)), f.s.context, f.provider)))
      .toContain('does not bind this exact holder');
  });

  it('P3-NF-23/28 refuses missing or malformed evidence use clocks and captures a valid accessor once', () => {
    const f = evidenceFixture(true);
    for (const id of [f.run.id, f.signedRun.id]) {
      expect(value(f.provider.verifyRecord({ id, kind: 'check-run-record' }, f.run, f.v.clock(200)))).toBe(true);
      expect(detail(f.provider.verifyRecord({ id, kind: 'check-run-record' }, f.run, f.v.clock(201))))
        .toContain('unknown or exceeded staleness bound');
      expect(detail(f.provider.verifyRecord({ id, kind: 'check-run-record' }, f.run))).not.toBe('success');
      for (const clock of [{}, { ...f.v.clock(200), value: Number.NaN },
        (({ value: _value, ...rest }) => rest)(f.v.clock(200)),
        { ...f.v.clock(200), unit: 'seconds' },
        { ...f.v.clock(200), subject: { kind: 'duration', instance: 'test' } }])
        expect(detail(f.provider.verifyRecord({ id, kind: 'check-run-record' }, f.run, clock as Clock))).not.toBe('success');
    }

    expect(value(f.provider.verifySemanticReview(f.correct, f.v.clock(200)))).toBe(true);
    expect(detail(f.provider.verifySemanticReview(f.correct))).not.toBe('success');
    expect(detail(f.provider.verifySemanticReview(f.correct, {} as Clock))).not.toBe('success');

    let reads = 0;
    const accessor = { ...f.v.clock(200) } as Record<string, unknown>;
    Object.defineProperty(accessor, 'value', { enumerable: true, get() { reads++; return 200; } });
    expect(detail(f.provider.verifyRecord({ id: f.run.id, kind: 'check-run-record' }, f.run, accessor as unknown as Clock)))
      .toContain('accessor or hidden field');
    expect(reads).toBe(0);
  });
});
