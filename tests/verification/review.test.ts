import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { authorAndAppend } from '../../src/facts/index.js';
import type { FactSchema } from '../../src/facts/index.js';
import { affectedGrades, benchmarkAccounting, feedbackCoverage, gradeSupport, reviewAccounting,
  semanticCoverage, waiverReview, decodeFeedbackDisposition, decodeVerificationRecord } from '../../src/verification/index.js';
import type { VerificationRecord, VerificationRecordName } from '../../src/verification/index.js';
import { factsFixture, privateKey, value } from '../facts/fixtures.js';
import { verificationInput } from './fixture.js';
import { verificationRuntimeFixture } from './runtime-fixture.js';

const decoded = <N extends VerificationRecordName>(name: N, input: unknown): Extract<VerificationRecord, { type: N }> =>
  value(decodeVerificationRecord(name, input, factsFixture().c));

it('P9-NF-26 review accounting rejects a success-only subset and keeps every omission in the denominator', () => {
  const population = [
    { id: 'question:1', category: 'question' as const, fact: 'fact:1' },
    { id: 'refusal:1', category: 'refusal' as const, fact: 'fact:2' },
    { id: 'unsettled:1', category: 'unsettled' as const, fact: 'fact:3' },
  ];
  const complete = verificationInput('RetrospectiveReviewRecord');
  const record = decoded('RetrospectiveReviewRecord', { ...complete, eligibleCases: population.map(row => row.id), inspected: ['question:1'],
    omitted: [{ caseId: 'refusal:1', reason: 'sampled' }, { caseId: 'unsettled:1', reason: 'capture unavailable' }], closure: 'incomplete' as const });
  expect(reviewAccounting(population, record)).toMatchObject({ eligible: 3, inspected: 1, omitted: 2, complete: true,
    categories: { question: 1, refusal: 1, unsettled: 1 } });
  const highlights = decoded('RetrospectiveReviewRecord', { ...record, eligibleCases: ['question:1'], inspected: ['question:1'], omitted: [] });
  expect(reviewAccounting(population, highlights)).toMatchObject({ complete: false });
});

it('P9-NF-28 P9-NF-33 P9-NF-34 unlinked feedback remains missing and replies do not close improvement work', () => {
  const verified = verificationInput('FeedbackDisposition');
  const open = decoded('FeedbackDisposition', { ...verified, id: 'feedback:open', sourceIntent: 'intent:2', disposition: 'investigating' as const,
    improvementRun: '', evidence: [], nextDueAt: 200 });
  expect(feedbackCoverage([verified.sourceIntent, 'intent:2', 'intent:3'], [verified, open])).toEqual({
    total: 3, inspectedOrPending: 2, missing: ['intent:3'], openImprovement: ['feedback:open'],
    verifiedImprovement: [verified.id],
  });
});

it('P9-NF-30 P9-NF-57 semantic review is exact-generation and disagreement remains disputed', () => {
  const runtime = verificationRuntimeFixture();
  const schema: FactSchema = { ...runtime.schema, kind: 'check-run-record', fields: { id: { kind: 'text', maxLength: 2048 } } };
  (runtime.context.schemas as FactSchema[]).push(schema);
  value(runtime.runtime.record('VerificationPlan', verificationInput('VerificationPlan')));
  const run = value(authorAndAppend({ kind: 'check-run-record', schemaVersion: 1, machine: 'machine-a',
    principal: JSON.parse(JSON.stringify(runtime.alice)), provenance: JSON.parse(JSON.stringify(runtime.alice.provenance)),
    at: JSON.parse(JSON.stringify(runtime.clock(100))), body: { id: 'check-run:resolved' }, required: [] },
  runtime.context, runtime.store, privateKey)).fact;
  const adequate = decoded('SemanticReviewRecord', { ...verificationInput('SemanticReviewRecord'),
    checkRuns: ['check-run:resolved'], evidencePopulation: [run.id], layerBelow: [run.id] });
  value(runtime.runtime.record('SemanticReviewRecord', adequate));
  const history = { snapshot: value(runtime.store.readForProjection()) };
  const old = decoded('SemanticReviewRecord', { ...adequate, id: 'semantic:old', generation: 'generation:old' });
  expect(semanticCoverage([{ edge: adequate.edge, generation: adequate.generation, firstSeen: 1 }], [old], history)[0]).toMatchObject({ reviewed: false, verdict: 'never' });
  expect(semanticCoverage([{ edge: adequate.edge, generation: adequate.generation, firstSeen: 1 }], [adequate], history)[0]).toMatchObject({ reviewed: true, verdict: 'adequate' });
  const adverse = decoded('SemanticReviewRecord', { ...adequate, id: 'semantic:adverse', verdict: 'inadequate' as const });
  expect(semanticCoverage([{ edge: adequate.edge, generation: adequate.generation, firstSeen: 1 }], [adequate, adverse], history)[0]).toMatchObject({ reviewed: false, verdict: 'disputed' });
});

it('N3 semantic adequacy withdraws when the signed review holder itself becomes tainted', () => {
  const runtime = verificationRuntimeFixture();
  (runtime.context.schemas as FactSchema[]).push(
    { ...runtime.schema, kind: 'source-evidence', fields: { evidence: { kind: 'constitutional', type: 'Evidence' } } },
    { ...runtime.schema, kind: 'check-run-record', fields: { id: { kind: 'text', maxLength: 2048 } } },
  );
  Object.assign(runtime.context.captures, { [runtime.e.capture.reference]: { hash: runtime.e.capture.hash,
    bytes: runtime.captures[runtime.e.capture.reference]!, byteLength: Buffer.byteLength(runtime.captures[runtime.e.capture.reference]!), status: 'available' } });
  const source = value(authorAndAppend({ kind: 'source-evidence', schemaVersion: 1, machine: 'machine-a',
    principal: JSON.parse(JSON.stringify(runtime.alice)), provenance: JSON.parse(JSON.stringify(runtime.alice.provenance)),
    at: JSON.parse(JSON.stringify(runtime.clock(100))), body: { evidence: JSON.parse(JSON.stringify(runtime.e)) }, required: [] },
  runtime.context, runtime.store, privateKey)).fact;
  const run = value(authorAndAppend({ kind: 'check-run-record', schemaVersion: 1, machine: 'machine-a',
    principal: JSON.parse(JSON.stringify(runtime.alice)), provenance: JSON.parse(JSON.stringify(runtime.alice.provenance)),
    at: JSON.parse(JSON.stringify(runtime.clock(100))), body: { id: 'check-run:resolved' }, required: [] },
  runtime.context, runtime.store, privateKey)).fact;
  const review = decoded('SemanticReviewRecord', { ...verificationInput('SemanticReviewRecord'), predecessors: [source.id],
    checkRuns: ['check-run:resolved'], evidencePopulation: [run.id], layerBelow: [run.id] });
  value(runtime.runtime.record('SemanticReviewRecord', review));
  const edge = [{ edge: review.edge, generation: review.generation, firstSeen: 0 }];
  expect(semanticCoverage(edge, [review], { snapshot: value(runtime.store.readForProjection()) })[0]!.reviewed).toBe(true);
  Object.assign(runtime.context.captures[runtime.e.capture.reference]!, { bytes: null, status: 'missing' });
  expect(semanticCoverage(edge, [review], { snapshot: value(runtime.store.readForProjection()) })[0])
    .toMatchObject({ reviewed: false, verdict: 'partial' });
});

it('M2 semantic adequacy withdraws when an explicitly referenced foundation is disputed', () => {
  const runtime = verificationRuntimeFixture();
  (runtime.context.schemas as FactSchema[]).push(
    { ...runtime.schema, kind: 'check-run-record', fields: { id: { kind: 'text', maxLength: 2048 } } },
  );
  const run = value(authorAndAppend({ kind: 'check-run-record', schemaVersion: 1, machine: 'machine-a',
    principal: JSON.parse(JSON.stringify(runtime.alice)), provenance: JSON.parse(JSON.stringify(runtime.alice.provenance)),
    at: JSON.parse(JSON.stringify(runtime.clock(100))), body: { id: 'check-run:resolved' }, required: [] },
  runtime.context, runtime.store, privateKey)).fact;
  const feedback = verificationInput('FeedbackDisposition');
  const source = value(runtime.spine.append(value(decodeFeedbackDisposition(feedback, runtime.c)))).fact;
  const review = decoded('SemanticReviewRecord', { ...verificationInput('SemanticReviewRecord'),
    checkRuns: [run.id], evidencePopulation: [source.id], layerBelow: [source.id] });
  value(runtime.runtime.record('SemanticReviewRecord', review));
  const edge = [{ edge: review.edge, generation: review.generation, firstSeen: 0 }];
  expect(semanticCoverage(edge, [review], { snapshot: value(runtime.store.readForProjection()) })[0])
    .toMatchObject({ reviewed: true, verdict: 'adequate' });
  value(runtime.spine.append(value(decodeFeedbackDisposition({ ...feedback, reason: 'explicit foundation disagreement' }, runtime.c))));
  expect(semanticCoverage(edge, [review], { snapshot: value(runtime.store.readForProjection()) })[0])
    .toMatchObject({ reviewed: false, verdict: 'partial' });
});

it('R6 semantic adequacy needs nonempty foundations and every claimed source resolved in signed current history', () => {
  const raw = verificationInput('SemanticReviewRecord');
  expect(() => decoded('SemanticReviewRecord', { ...raw, layerBelow: [], evidencePopulation: [], checkRuns: ['made-up'] })).toThrow();
  expect(semanticCoverage([{ edge: raw.edge, generation: raw.generation, firstSeen: 0 }], [raw])[0])
    .toMatchObject({ reviewed: false, verdict: 'partial' });
});

it('P9-NF-39 P9-NF-40 P9-NF-42 P9-NF-47 grades keep conclusion/reason/outcome separate and dependency changes withdraw support', () => {
  const grade = verificationInput('Grade');
  expect(grade.conclusion.assessment).toBe('supported'); expect(grade.statedReason.assessment).toBe('contradicted');
  expect(grade.outcome.assessment).toBe('met'); expect(gradeSupport(grade)).toEqual({ grade: grade.id, current: true, reasons: [] });
  expect(gradeSupport(grade, ['evidence:2'])).toEqual({ grade: grade.id, current: false, reasons: ['dependency-changed'] });
  expect(affectedGrades([grade], ['evidence:2'])).toEqual([grade.id]);
  const unavailable = decoded('Grade', { ...grade, captureStatuses: [{ reference: 'capture:decision', status: 'tombstoned' }] });
  expect(gradeSupport(unavailable)).toMatchObject({ current: false, reasons: ['capture-unavailable'] });
});

it('P9-NF-45 P9-NF-46 held-out leakage and missing executions prevent a measured winner', () => {
  const evaluation = verificationInput('BenchmarkEvaluation');
  expect(benchmarkAccounting(evaluation)).toMatchObject({ denominator: 1, accounted: 1, complete: true, selected: 'route:a' });
  const leaked = decoded('BenchmarkEvaluation', { ...evaluation, heldOutGroups: [{ group: 'one', sources: ['incident'] }, { group: 'two', sources: ['incident'] }] });
  expect(benchmarkAccounting(leaked)).toMatchObject({ complete: false, heldOutLeakage: ['incident'], selected: null });
  const missing = decoded('BenchmarkEvaluation', { ...evaluation, executions: [], missing: ['execution:1'], complete: false, selection: '' });
  expect(benchmarkAccounting(missing)).toMatchObject({ denominator: 1, accounted: 1, complete: false, selected: null });
});

it('P9-NF-35 P9-NF-36 waiver review counts distinct causally prior Authorization facts, not prose or timestamps', () => {
  const f = factsFixture();
  const decoded = f.authInput({ id: 'waiver:1', at: f.clock(100), kind: { kind: 'waiver', rule: 'rule:94' } });
  const waiver = value(decode('Authorization', decoded.input, { ...decoded.context, actAt: f.clock(200) }));
  expect(waiverReview([waiver, waiver], [
    { id: 'act:linked', rule: 'rule:94', scope: 'scope', at: 150, predecessors: [waiver.id] },
    { id: 'act:late', rule: 'rule:94', scope: 'scope', at: 90, predecessors: [waiver.id] },
    { id: 'act:prose', rule: 'rule:94', scope: 'scope', at: 150, predecessors: ['someone-said-waived'] },
  ])).toEqual({ waivers: 1, linkedActs: 1, unusedWaivers: [], actsWithoutPriorWaiver: ['act:late', 'act:prose'] });
});
