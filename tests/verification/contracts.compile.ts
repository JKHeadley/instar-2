import type { VerificationPlan, VerificationRequest, VerificationAssessment, ProbeRecord, RetrospectiveReviewRecord,
  SemanticReviewRecord, Grade, AssessmentClosure, FeedbackDisposition, BenchmarkEvaluation } from '../../src/verification/index.js';

declare const raw: object;
// @ts-expect-error Caller JSON cannot construct a nine-owned plan.
const plan: VerificationPlan = raw;
// @ts-expect-error Caller JSON cannot construct a nine-owned request.
const request: VerificationRequest = raw;
// @ts-expect-error Caller JSON cannot construct a nine-owned assessment.
const assessment: VerificationAssessment = raw;
// @ts-expect-error Caller JSON cannot construct a nine-owned probe.
const probe: ProbeRecord = raw;
// @ts-expect-error Caller JSON cannot construct a nine-owned retrospective review.
const review: RetrospectiveReviewRecord = raw;
// @ts-expect-error Caller JSON cannot construct a nine-owned semantic review.
const semantic: SemanticReviewRecord = raw;
// @ts-expect-error Caller JSON cannot construct a nine-owned grade.
const grade: Grade = raw;
// @ts-expect-error Caller JSON cannot construct a nine-owned closure.
const closure: AssessmentClosure = raw;
// @ts-expect-error Caller JSON cannot construct a nine-owned feedback disposition.
const feedback: FeedbackDisposition = raw;
// @ts-expect-error Caller JSON cannot construct a nine-owned benchmark evaluation.
const evaluation: BenchmarkEvaluation = raw;
void [plan, request, assessment, probe, review, semantic, grade, closure, feedback, evaluation];
