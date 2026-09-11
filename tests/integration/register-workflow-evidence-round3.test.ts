import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { authorAndAppend } from '../../src/facts/index.js';
import type { FactSchema } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, runRegisterChecks,
  semanticReviewSubject } from '../../src/register/index.js';
import { semanticCoverage } from '../../src/verification/index.js';
import { privateKey } from '../facts/fixtures.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { verificationInput } from '../verification/fixture.js';
import { setup, value } from '../register/fixtures.js';

const detail = (result: ReturnType<ReturnType<typeof createPartTwoRegisterProvider>['verifySemanticReview']>) =>
  consumeResult(result, { Success: () => 'success', Refused: refusal => refusal.detail });

function providerFor(v: ReturnType<typeof verificationRuntimeFixture>, head: number) {
  const s = setup();
  const authority = createPartTwoRegisterAuthority({ facts: v.context, scope: v.scope,
    landing: { owner: 'part-ten', merges: [] }, context: s.context });
  return createPartTwoRegisterProvider({ store: v.store, authority, horizon: { lineages: {
    'machine-a': { head: { epoch: 0, position: head }, observedAt: 100, closed: false },
  }, stalenessBound: 100 }, context: s.context });
}

describe('normal workflow signed evidence composition', () => {
  it('P3-NF-28 retains Part Nine incomplete and current-support answers without local reinterpretation', () => {
    const v = verificationRuntimeFixture();
    const record = value(v.runtime.record('SemanticReviewRecord', verificationInput('SemanticReviewRecord')));
    const fact = value(v.store.read())[0]!;
    const snapshot = value(v.store.readForProjection());
    expect(semanticCoverage([{ edge: record.edge, generation: record.generation, firstSeen: 0 }], [record], { snapshot })[0])
      .toMatchObject({ reviewed: false, verdict: 'partial' });
    const provider = providerFor(v, 0);
    const review = { holder: 'holder', rule: 26, generation: record.generation,
      subjectHash: record.holderHash, record: fact.id };
    expect(detail(provider.verifySemanticReview(review))).toContain('Part Nine reports this semantic review incomplete');
    expect(detail(provider.verifySemanticReview({ ...review, subjectHash: 'sha256:changed-subject' })))
      .toContain('does not bind this exact holder');
  });

  it('P3-NF-28 accepts a fully supported Part Nine answer and refuses an ordinary signed note substitute', () => {
    const v = verificationRuntimeFixture();
    (v.context.schemas as FactSchema[]).push(
      { ...v.schema, kind: 'check-run-record', fields: { id: { kind: 'text', maxLength: 2048 } } },
    );
    const run = value(authorAndAppend({ kind: 'check-run-record', schemaVersion: 1, machine: 'machine-a',
      principal: JSON.parse(JSON.stringify(v.alice)), provenance: JSON.parse(JSON.stringify(v.alice.provenance)),
      at: JSON.parse(JSON.stringify(v.clock(100))), body: { id: 'check-run:resolved' }, required: [] },
    v.context, v.store, privateKey)).fact;
    const input = { ...verificationInput('SemanticReviewRecord'), holderHash: 'sha256:subject',
      checkRuns: ['check-run:resolved'], evidencePopulation: [run.id], layerBelow: [run.id] };
    const record = value(v.runtime.record('SemanticReviewRecord', input));
    const facts = value(v.store.read()); const fact = facts.find(row => row.kind === 'verification-SemanticReviewRecord')!;
    const note = v.next(facts.at(-1)!, {}, { ...v.context, facts });
    v.bytes.push(JSON.parse(JSON.stringify(note)));
    const provider = providerFor(v, 2);
    const review = { holder: 'holder', rule: 26, generation: record.generation,
      subjectHash: record.holderHash, record: fact.id };
    expect(value(provider.verifySemanticReview(review))).toBe(true);
    expect(detail(provider.verifySemanticReview({ ...review, record: note.id }))).toContain('semantic review reference kind differs');
  });

  it('P3-NF-28 normal graph cannot upgrade an exact-bound review that Part Nine reports partial', () => {
    const s = setup();
    const register = s.build([s.rule(26), s.holder([{ rule: 26, class: 'held',
      evidence: { kind: 'probe', id: 'probe', stage: 'test' }, semanticallyReviewed: 'generation:1' }])]);
    const subjectHash = value(semanticReviewSubject(register, 'holder', 26, s.context));
    const v = verificationRuntimeFixture();
    const record = value(v.runtime.record('SemanticReviewRecord', { ...verificationInput('SemanticReviewRecord'), holderHash: subjectHash }));
    const fact = value(v.store.read())[0]!; const provider = providerFor(v, 0);
    const review = { holder: 'holder', rule: 26, generation: record.generation, subjectHash, record: fact.id };
    const checks = { mode: 'normal' as const, branch: 'main', runs: [],
      catalog: { fixtures: [], probes: [{ id: 'probe', cadence: 100 }], sentinels: [], semanticReviews: [review] },
      landedParts: [], now: s.f.now,
      constructs: register.entries.map(entry => ({ id: entry.declaration.id, path: entry.declaration.declaredBy.path,
        symbol: entry.declaration.declaredBy.symbol })), observations: [], separations: [], bootstrapRules: [],
      boundaries: register.shape.kinds.map(kind => ({ kind: kind.name, language: 'TypeScript',
        impossible: ['missing declared id'], swept: [], residual: ['dynamic'] })),
      claims: register.shape.kinds.map(kind => ({ kind: kind.name, complete: false })) };
    expect(consumeResult(runRegisterChecks(register, checks, s.context, provider), {
      Success: () => 'success', Refused: refusal => refusal.detail,
    })).toContain('Part Nine reports this semantic review incomplete');
  });
});
