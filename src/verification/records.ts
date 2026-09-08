import { consumeResult, defineDecoder } from '../index.js';
import type { Json, Result } from '../index.js';
import type { ConflictClass, OwnedShape } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import type { VerificationComparison, VerificationDecodeContext, VerificationIdentity, VerificationRecord, VerificationRecordName } from './contracts.js';

const text = { kind: 'text', maxLength: 2048 } as const;
const integer = { kind: 'integer' } as const;
const bool = { kind: 'boolean' } as const;
const texts = { kind: 'array', maxLength: 512, items: text } as const;
const common = { type: text, schemaVersion: integer, id: text, predecessors: texts };
const pair = (fields: Readonly<Record<string, OwnedShape>>, optional: readonly string[] = []): OwnedShape => ({ kind: 'object', fields, ...(optional.length ? { optional } : {}) });
const list = (items: OwnedShape, maxLength = 512): OwnedShape => ({ kind: 'array', maxLength, items });
const status = pair({ reference: text, status: text });
const dimension = pair({ assessment: text, reason: text, evidence: texts });

export const verificationShapes: Readonly<Record<VerificationRecordName, OwnedShape>> = freeze({
  VerificationPlan: pair({ ...common,
    subject: pair({ rules: list(integer, 128), holder: text, governed: text, scope: text, generation: text }),
    arms: list(pair({ id: text, kind: text, executable: text, fixture: text, outputContract: text, canFail: text, required: bool }), 32),
    bar: pair({ version: text, predicates: texts, sources: texts, minimumStrength: text, subjectDigest: text, captureRequired: bool, freshness: integer, complete: bool }),
    independence: pair({ testedPrincipal: text, observerPrincipal: text, witnessController: text, commonFailures: texts }),
    scheduling: pair({ owner: text, run: text, loopPolicy: text, cadence: integer, freshnessWindow: integer, dueAction: text, recoveryBudget: text }),
    bounds: list(pair({ resource: text, limit: integer }), 64),
    consumers: list(pair({ id: text, direction: text, enforcedRecord: text, decoder: text, preserved: text }), 64),
    privacy: pair({ readers: texts, providers: texts, captureClass: text, secretCustody: text, destinations: texts }),
    activation: pair({ unit: texts, integration: texts, lifecycle: texts, semantic: texts, limits: texts, evidence: texts }),
  }),
  VerificationRequest: pair({ ...common, logicalKey: text, operation: text, attempt: text, reservation: text, operationDigest: text,
    scope: text, predicate: text, plan: text, barVersion: text, initialEvidence: texts, missingEvidence: texts,
    owner: text, loop: text, createdAt: integer, sourceGeneration: text }),
  VerificationAssessment: pair({ ...common, request: text, operation: text, attempt: text, operationDigest: text,
    barVersion: text, observer: text, evidence: texts, missingEvidence: texts, vectorDigest: text, knownLineages: texts,
    captureStatuses: list(status), taints: texts,
    predicates: list(pair({ predicate: text, verdict: text, reason: text, evidence: texts, decision: text }), 16),
    validFrom: integer, validUntil: integer, supersedes: text }),
  ProbeRecord: pair({ ...common, plan: text, planVersion: text, slot: text, attempt: text, subject: text, challengeDigest: text,
    run: text, operation: text, startedAt: integer, completedAt: integer, witnesses: texts, comparison: text,
    disposition: text, missingPhases: texts, captureStatus: text, costs: list(pair({ resource: text, amount: integer }), 64) }),
  RetrospectiveReviewRecord: pair({ ...common, plan: text, reviewer: text, independenceEvidence: texts, populationQuery: text,
    vectorDigest: text, sourceGeneration: text, eligibleCases: texts, inspected: texts,
    omitted: list(pair({ caseId: text, reason: text })), sampling: pair({ seed: text, strata: texts }),
    modelAttempts: texts, decisions: texts,
    findings: list(pair({ id: text, category: text, severity: text, owner: text, evidence: texts })),
    layerBelow: texts, nextWork: texts, closure: text, acceptedResidue: texts }),
  SemanticReviewRecord: pair({ ...common, edge: text, generation: text, ruleVersion: text, holderHash: text, fixtureHash: text,
    decoderHash: text, checkRuns: texts, evidencePopulation: texts, reviewer: text, decision: text, coverageLimits: texts,
    layerBelow: texts, compliantCases: texts, violatingCases: texts, verdict: text }),
  Grade: pair({ ...common, benchmarkRecord: text, request: text, resolution: text, decision: text, criterion: text,
    planVersion: text, grader: text, gradingDecision: text, vectorDigest: text, sourceGeneration: text, inspected: texts,
    missing: texts, captureStatuses: list(status), taints: texts, window: pair({ start: integer, end: integer }),
    conclusion: dimension, statedReason: dimension, outcome: dimension,
    process: list(pair({ requirement: text, assessment: text, reason: text, evidence: texts })),
    completeness: pair({ assessment: text, missing: texts, conflicts: texts }), supersedes: text }),
  AssessmentClosure: pair({ ...common, caseId: text, sourceVectorDigest: text, requiredAssessments: texts,
    dispositions: list(pair({ assessment: text, disposition: text, reference: text, reason: text })), activeDisputes: texts,
    terminalResolutions: texts, settlements: texts, reviewer: text, decision: text, releasesPin: text }),
  FeedbackDisposition: pair({ ...common, sourceIntent: text, sourceCapture: text, scope: text, detectionDecision: text,
    explicitSubmission: text, relatedCases: texts, relatedClaims: texts, relatedFindings: texts, classification: text,
    owner: text, improvementRun: text, evidence: texts, nextDueAt: integer, disposition: text, reason: text, duplicates: texts }),
  BenchmarkEvaluation: pair({ ...common, benchmarkRun: text, candidates: texts, scenarios: texts, executions: texts,
    inputDigest: text, compatibilityDigest: text, criterion: text, grades: texts, missing: texts, cancelled: texts,
    refused: texts, sampleSize: integer, heldOutGroups: list(pair({ group: text, sources: texts })),
    costs: list(pair({ resource: text, amount: integer })), routeDecision: text, selection: text, complete: bool }),
});

function shapeCheck(value: unknown, shape: OwnedShape): void {
  if (shape.kind === 'text') { ensure(typeof value === 'string' && value.length <= shape.maxLength, 'bounded text required'); return; }
  if (shape.kind === 'integer') { ensure(Number.isSafeInteger(value), 'safe integer required'); return; }
  if (shape.kind === 'boolean') { ensure(typeof value === 'boolean', 'boolean required'); return; }
  if (shape.kind === 'null') { ensure(value === null, 'null required'); return; }
  if (shape.kind === 'capture') { shapeCheck(value, pair({ reference: text, hash: text })); return; }
  if (shape.kind === 'array') { ensure(Array.isArray(value) && value.length <= shape.maxLength, 'bounded array required'); value.forEach(item => shapeCheck(item, shape.items)); return; }
  ensure(value && typeof value === 'object' && !Array.isArray(value), 'closed object required');
  const record = value as Record<string, unknown>; const optional = new Set(shape.optional ?? []);
  ensure(Object.keys(record).every(key => Object.hasOwn(shape.fields, key)), 'undeclared field');
  ensure(Object.keys(shape.fields).every(key => optional.has(key) || Object.hasOwn(record, key)), 'missing field');
  for (const [key, field] of Object.entries(shape.fields)) if (record[key] !== undefined) shapeCheck(record[key], field);
}

const predicates = ['occurrence', 'non-occurrence', 'quiescence', 'charge'] as const;
function one(value: string, choices: readonly string[], field: string): void { ensure(choices.includes(value), `${field} outside closed set`); }
function nonnegative(value: number, field: string): void { ensure(Number.isSafeInteger(value) && value >= 0, `${field} must be a nonnegative integer`); }
function unique(values: readonly string[], field: string): void { ensure(new Set(values).size === values.length, `${field} contains duplicates`); }
function validate(record: VerificationRecord): void {
  ensure(record.schemaVersion === 1 && record.id.length > 0, 'verification identity/version');
  unique(record.predecessors, 'predecessors');
  switch (record.type) {
    case 'VerificationPlan':
      ensure(record.subject.rules.length > 0 && record.subject.holder.length > 0 && record.subject.governed.length > 0 && record.subject.generation.length > 0, 'plan subject incomplete');
      ensure(record.arms.length > 0 && record.arms.every(arm => arm.id && arm.executable && arm.fixture && arm.outputContract && arm.canFail), 'plan arm incomplete');
      record.arms.forEach(arm => one(arm.kind, ['build', 'runtime', 'probe', 'sentinel', 'retrospective'], 'arm kind'));
      record.bar.predicates.forEach(predicate => one(predicate, predicates, 'bar predicate'));
      one(record.bar.minimumStrength, ['proof', 'observation', 'attestation', 'inference'], 'minimum strength');
      nonnegative(record.bar.freshness, 'bar freshness'); nonnegative(record.scheduling.cadence, 'cadence'); nonnegative(record.scheduling.freshnessWindow, 'freshness window');
      ensure(record.scheduling.owner && record.scheduling.run && record.scheduling.loopPolicy && record.scheduling.dueAction, 'plan scheduling incomplete');
      ensure(record.bounds.length > 0 && record.bounds.every(bound => bound.resource.length > 0 && bound.limit >= 0), 'finite named plan bounds required');
      record.consumers.forEach(consumer => one(consumer.direction, ['open', 'closed'], 'consumer direction'));
      ensure(record.activation.unit.length > 0 && record.activation.integration.length > 0 && record.activation.lifecycle.length > 0 && record.activation.semantic.length > 0, 'three tiers and semantic activation required');
      break;
    case 'VerificationRequest':
      one(record.predicate, predicates, 'request predicate');
      ensure(record.logicalKey && record.operation && record.attempt && record.operationDigest && record.plan && record.barVersion && record.owner && record.loop && record.sourceGeneration, 'request binding incomplete');
      nonnegative(record.createdAt, 'request clock'); break;
    case 'VerificationAssessment': {
      ensure(record.request && record.operation && record.attempt && record.operationDigest && record.barVersion && record.observer && record.vectorDigest, 'assessment binding incomplete');
      unique(record.knownLineages, 'known lineages'); unique(record.evidence, 'assessment evidence');
      ensure(record.validUntil >= record.validFrom, 'assessment validity interval inverted');
      const seen = new Set<string>();
      for (const item of record.predicates) {
        one(item.predicate, predicates, 'assessment predicate'); one(item.verdict, ['satisfied', 'contradicted', 'insufficient'], 'assessment verdict');
        ensure(!seen.has(item.predicate), 'assessment predicate collapsed or repeated'); seen.add(item.predicate);
        if (item.verdict === 'satisfied') ensure(item.evidence.length > 0, 'satisfied predicate needs evidence');
      }
      ensure(seen.has('occurrence') && seen.has('non-occurrence') && seen.has('quiescence') && seen.has('charge'), 'assessment must keep four settlement predicates separate');
      break;
    }
    case 'ProbeRecord':
      one(record.disposition, ['passed', 'failed', 'inconclusive', 'not-run', 'cancelled'], 'probe disposition');
      one(record.captureStatus, ['available', 'tombstoned', 'expired', 'missing'], 'probe capture status');
      ensure(record.plan && record.planVersion && record.slot && record.attempt && record.subject && record.challengeDigest, 'probe binding incomplete');
      nonnegative(record.startedAt, 'probe start'); nonnegative(record.completedAt, 'probe completion');
      ensure(record.disposition === 'not-run' || record.disposition === 'cancelled' || record.completedAt >= record.startedAt, 'probe completion precedes start');
      if (record.disposition === 'passed') ensure(record.witnesses.length > 0 && record.missingPhases.length === 0, 'passing probe requires complete independent witness');
      break;
    case 'RetrospectiveReviewRecord':
      one(record.closure, ['open', 'incomplete', 'converged'], 'review closure');
      ensure(record.plan && record.reviewer && record.populationQuery && record.vectorDigest && record.sourceGeneration, 'review binding incomplete');
      unique(record.eligibleCases, 'eligible cases'); unique(record.inspected, 'inspected cases');
      ensure(record.inspected.every(id => record.eligibleCases.includes(id)) && record.inspected.length + record.omitted.length === record.eligibleCases.length, 'review denominator incomplete');
      if (record.closure === 'converged') ensure(record.independenceEvidence.length > 0 && record.layerBelow.length > 0, 'convergence requires independence and layer-below evidence');
      break;
    case 'SemanticReviewRecord':
      one(record.verdict, ['adequate', 'partial', 'inadequate'], 'semantic verdict');
      ensure(record.edge && record.generation && record.ruleVersion && record.holderHash && record.fixtureHash && record.decoderHash && record.reviewer && record.decision, 'semantic review binding incomplete');
      if (record.verdict === 'adequate') ensure(record.checkRuns.length > 0 && record.compliantCases.length > 0 && record.violatingCases.length > 0, 'adequate review must exercise both semantic neighbors');
      break;
    case 'Grade':
      one(record.conclusion.assessment, ['supported', 'contradicted', 'unverifiable', 'not-applicable'], 'conclusion grade');
      one(record.statedReason.assessment, ['supported', 'contradicted', 'unverifiable', 'not-applicable'], 'reason grade');
      one(record.outcome.assessment, ['met', 'unmet', 'pending', 'unverifiable', 'not-applicable'], 'outcome grade');
      one(record.completeness.assessment, ['complete', 'incomplete', 'disputed'], 'completeness grade');
      record.process.forEach(item => one(item.assessment, ['satisfied', 'violated', 'unverifiable'], 'process grade'));
      ensure(record.benchmarkRecord && record.request && record.resolution && record.criterion && record.planVersion && record.grader && record.gradingDecision && record.vectorDigest && record.sourceGeneration, 'grade binding incomplete');
      ensure(record.window.end >= record.window.start, 'grade window inverted');
      ensure(record.decision.length > 0 || record.conclusion.assessment === 'not-applicable' || record.conclusion.assessment === 'unverifiable', 'absent Decision cannot receive an invented conclusion');
      break;
    case 'AssessmentClosure':
      ensure(record.caseId && record.sourceVectorDigest && record.requiredAssessments.length > 0 && record.reviewer && record.decision && record.releasesPin, 'closure binding incomplete');
      ensure(record.activeDisputes.length === 0, 'open dispute forbids assessment closure');
      ensure(record.dispositions.length === record.requiredAssessments.length && record.dispositions.every(item => record.requiredAssessments.includes(item.assessment)), 'closure assessment denominator incomplete');
      record.dispositions.forEach(item => one(item.disposition, ['assessed', 'evidence-unavailable-with-reason'], 'closure disposition'));
      break;
    case 'FeedbackDisposition':
      one(record.disposition, ['detected', 'investigating', 'improvement-owned', 'verified-improvement', 'duplicate-linked', 'declined-with-reason'], 'feedback disposition');
      ensure(record.sourceIntent && record.sourceCapture && record.scope && record.classification && record.owner, 'feedback binding incomplete');
      nonnegative(record.nextDueAt, 'feedback due clock');
      if (record.disposition === 'verified-improvement') ensure(record.improvementRun && record.evidence.length > 0, 'verified improvement requires run exit and proof');
      if (record.disposition === 'declined-with-reason') ensure(record.reason.length > 0, 'declined feedback requires reason');
      if (record.disposition === 'duplicate-linked') ensure(record.duplicates.length > 0, 'duplicate disposition keeps links');
      break;
    case 'BenchmarkEvaluation':
      ensure(record.benchmarkRun && record.inputDigest && record.compatibilityDigest && record.criterion, 'benchmark evaluation binding incomplete');
      nonnegative(record.sampleSize, 'sample size');
      ensure(record.sampleSize === record.executions.length + record.missing.length + record.cancelled.length + record.refused.length, 'benchmark denominator excludes planned executions');
      if (record.sampleSize === 0) ensure(!record.complete && !record.selection, 'zero denominator is undefined, never a winner');
      if (record.complete) ensure(record.missing.length === 0 && record.cancelled.length === 0, 'missing execution cannot yield complete evaluation');
      break;
  }
}

function decoderFor<N extends VerificationRecordName>(name: N, context: VerificationDecodeContext) {
  return defineDecoder<Extract<VerificationRecord, { type: N }>, VerificationDecodeContext>({
    name, owner: 'part-nine', currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
    decodeCurrent: value => {
      try {
        shapeCheck(value, verificationShapes[name]);
        const record = value as unknown as Extract<VerificationRecord, { type: N }>;
        ensure(record.type === name, 'owned verification type mismatch'); validate(record);
        return { ok: true, value: freeze(record) };
      } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'verification record refused' }; }
    },
  }, context.preserved);
}

export function decodeVerificationRecord<N extends VerificationRecordName>(name: N, input: unknown, context: VerificationDecodeContext): Result<Extract<VerificationRecord, { type: N }>> {
  return consumeResult(decoderFor(name, context), { Success: decoder => decoder.decode(input, context), Refused: refusal => refusal });
}
export const decodeVerificationPlan = (input: unknown, context: VerificationDecodeContext) => decodeVerificationRecord('VerificationPlan', input, context);
export const decodeVerificationRequest = (input: unknown, context: VerificationDecodeContext) => decodeVerificationRecord('VerificationRequest', input, context);
export const decodeVerificationAssessment = (input: unknown, context: VerificationDecodeContext) => decodeVerificationRecord('VerificationAssessment', input, context);
export const decodeProbeRecord = (input: unknown, context: VerificationDecodeContext) => decodeVerificationRecord('ProbeRecord', input, context);
export const decodeRetrospectiveReviewRecord = (input: unknown, context: VerificationDecodeContext) => decodeVerificationRecord('RetrospectiveReviewRecord', input, context);
export const decodeSemanticReviewRecord = (input: unknown, context: VerificationDecodeContext) => decodeVerificationRecord('SemanticReviewRecord', input, context);
export const decodeGrade = (input: unknown, context: VerificationDecodeContext) => decodeVerificationRecord('Grade', input, context);
export const decodeAssessmentClosure = (input: unknown, context: VerificationDecodeContext) => decodeVerificationRecord('AssessmentClosure', input, context);
export const decodeFeedbackDisposition = (input: unknown, context: VerificationDecodeContext) => decodeVerificationRecord('FeedbackDisposition', input, context);
export const decodeBenchmarkEvaluation = (input: unknown, context: VerificationDecodeContext) => decodeVerificationRecord('BenchmarkEvaluation', input, context);

export function verificationLogicalKey(record: VerificationRecord): string {
  switch (record.type) {
    case 'VerificationPlan': return `plan:${record.id}`;
    case 'VerificationRequest': return `request:${record.logicalKey}:${record.predicate}`;
    case 'VerificationAssessment': return `assessment:${record.request}:${record.barVersion}:${record.vectorDigest}`;
    case 'ProbeRecord': return `probe:${record.plan}:${record.slot}:${record.attempt}`;
    case 'RetrospectiveReviewRecord': return `review:${record.plan}:${record.populationQuery}:${record.vectorDigest}`;
    case 'SemanticReviewRecord': return `semantic:${record.edge}:${record.generation}`;
    case 'Grade': return `grade:${record.benchmarkRecord}:${record.criterion}:${record.vectorDigest}`;
    case 'AssessmentClosure': return `closure:${record.caseId}:${record.sourceVectorDigest}`;
    case 'FeedbackDisposition': return `feedback:${record.sourceIntent}:${record.sourceCapture}`;
    case 'BenchmarkEvaluation': return `evaluation:${record.benchmarkRun}:${record.criterion}:${record.inputDigest}`;
  }
}
export function verificationIdentity(record: VerificationRecord): VerificationIdentity {
  return freeze({ id: record.id, logicalKey: verificationLogicalKey(record), canonicalHash: encoded(record).hash });
}
export function compareVerificationRecords<N extends VerificationRecordName>(name: N, left: unknown, right: unknown, context: VerificationDecodeContext): Result<VerificationComparison> {
  return boundary('CompareVerificationRecords', { name, left, right }, context, () => {
    const a = take(decodeVerificationRecord(name, left, context));
    const b = take(decodeVerificationRecord(name, right, context));
    const ai = verificationIdentity(a), bi = verificationIdentity(b);
    if (ai.id !== bi.id) return freeze({ equal: false });
    if (ai.canonicalHash === bi.canonicalHash) return freeze({ equal: true });
    const conflict: ConflictClass = { key: ai.logicalKey, kind: 'immutable-disagreement', facts: [ai.canonicalHash, bi.canonicalHash].sort(), detail: `divergent canonical content for ${name} identity ${ai.id}` };
    return freeze({ equal: false, conflict });
  });
}

export function wireVerificationRecord(record: VerificationRecord): Json { return json(record); }
