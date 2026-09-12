import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Json, Result, Validation } from '../../src/index.js';
import { authorAndAppend, registerOwnedBody } from '../../src/facts/index.js';
import type { FactSchema, OwnedBodyRegistration } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeCheckRun,
  decodeRegisteredFact, runRegisterChecks, semanticReviewSubject } from '../../src/register/index.js';
import { privateKey } from '../facts/fixtures.js';
import { detail, json, setup, value } from '../register/fixtures.js';
import { ownedPolicy, ownedSchema } from '../register/normal-provider-fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';

const validation = <T>(result: Result<T>): Validation<T> => consumeResult<T, Validation<T>>(result, {
  Success: decoded => ({ ok: true, value: decoded }),
  Refused: refusal => ({ ok: false, reason: refusal.reason, detail: refusal.detail }),
});

describe('round-nine signed workflow evidence currency', () => {
  it('P3-NF-23/28 refuses expired and unobserved replicas at use clock 201 and accepts refreshed evidence', () => {
    const s = setup();
    const register = s.build([s.rule(26), s.holder([{ rule: 26, class: 'held',
      evidence: { kind: 'fixture', id: 'check', stage: 'build' }, semanticallyReviewed: 'generation:1' }])]);
    const subjectHash = value(semanticReviewSubject(register, 'holder', 26, s.context));
    const v = verificationRuntimeFixture();
    const rawRun = JSON.parse(JSON.stringify(json('CheckRunRecord', { id: 'check-run:round-nine', commit: register.commit,
      branch: 'main', providerRun: 'ci:round-nine', outcome: 'passed',
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
      holderHash: subjectHash, checkRuns: [run.id], evidencePopulation: [signedRun.id], layerBelow: [signedRun.id] }));
    const reviewFact = value(v.store.read()).find(row => row.kind === 'verification-SemanticReviewRecord')!;
    const review = { holder: 'holder', rule: 26, generation: reviewRecord.generation, subjectHash, record: reviewFact.id };
    const checks = (now: ReturnType<typeof v.clock>) => ({ mode: 'normal' as const, branch: 'main', runs: [run],
      catalog: { fixtures: [{ id: 'check', stage: 'build' as const }], probes: [], sentinels: [], semanticReviews: [review] },
      landedParts: [], now, constructs: [], observations: [], separations: [], bootstrapRules: [],
      boundaries: register.shape.kinds.map(kind => ({ kind: kind.name, language: 'TypeScript', impossible: [], swept: [], residual: [] })),
      claims: register.shape.kinds.map(kind => ({ kind: kind.name, complete: false })) });
    const provider = (observedAt: number | null) => {
      const useContext = { ...s.context, types: { ...s.context.types, now: v.clock(201) } };
      return { useContext, evidence: createPartTwoRegisterProvider({ store: v.store,
        authority: createPartTwoRegisterAuthority({ facts: v.context, scope: v.scope,
          landing: { owner: 'part-ten', merges: [] }, context: useContext }),
        horizon: { lineages: { 'machine-a': { head: { epoch: 0, position: 1 }, observedAt, closed: false } },
          stalenessBound: 100 }, context: useContext }) };
    };

    for (const observedAt of [100, null]) {
      const { useContext, evidence } = provider(observedAt);
      expect(detail(evidence.verifyRecord({ id: run.id, kind: 'check-run-record' }, run)))
        .toContain('unknown or exceeded staleness bound');
      expect(detail(evidence.verifyRecord({ id: signedRun.id, kind: 'check-run-record' }, run)))
        .toContain('unknown or exceeded staleness bound');
      expect(detail(evidence.verifySemanticReview(review))).toContain('unknown or exceeded staleness bound');
      expect(detail(runRegisterChecks(register, checks(v.clock(201)), useContext, evidence)))
        .toContain('unknown or exceeded staleness bound');
    }

    const { useContext, evidence } = provider(201);
    expect(value(evidence.verifyRecord({ id: run.id, kind: 'check-run-record' }, run))).toBe(true);
    expect(value(evidence.verifyRecord({ id: signedRun.id, kind: 'check-run-record' }, run))).toBe(true);
    expect(value(evidence.verifySemanticReview(review))).toBe(true);
    expect(value(runRegisterChecks(register, checks(v.clock(201)), useContext, evidence)).graph.totals)
      .toMatchObject({ 'held-reviewed': 1, 'held-unreviewed': 0 });
  });
});
