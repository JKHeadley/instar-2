import { randomBytes } from 'node:crypto';
import { consumeResult, defineDecoder } from '../index.js';
import type { Json, Result } from '../index.js';
import { authorAndAppend, causalCone, hashBytes, registerOwnedBody } from '../facts/index.js';
import type { ConflictClass, FactEnvelope, FactSchema, OwnedBodyContext, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import type { ProviderResponseSubject, VerificationAuthor, VerificationComparison, VerificationDecodeContext, VerificationHost, VerificationIdentity, VerificationRecord, VerificationRecordName, VerificationSpine } from './contracts.js';

const text = { kind: 'text', maxLength: 2048 } as const;
const integer = { kind: 'integer' } as const;
const bool = { kind: 'boolean' } as const;
const texts = { kind: 'array', maxLength: 512, items: text } as const;
const common = { type: text, schemaVersion: integer, id: text, predecessors: texts };
const pair = (fields: Readonly<Record<string, OwnedShape>>, optional: readonly string[] = []): OwnedShape => ({ kind: 'object', fields, ...(optional.length ? { optional } : {}) });
const list = (items: OwnedShape, maxLength = 512): OwnedShape => ({ kind: 'array', maxLength, items });
const status = pair({ reference: text, status: text });
const dimension = pair({ assessment: text, reason: text, evidence: texts });

const verificationV1Shapes: Readonly<Record<VerificationRecordName, OwnedShape>> = freeze({
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
  ProbeRecord: pair({ ...common, plan: text, planVersion: text, arm: text, slot: text, attempt: text, subject: text, challengeDigest: text,
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
    processAssessments: list(pair({ requirement: text, assessment: text, reason: text, evidence: texts })),
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

const factReference = pair({ owner: text, name: text, id: text, kind: text, schemaVersion: integer, contentHash: text });
const capture = { kind: 'capture' } as const;
const responseSubject = pair({
  seven: pair({ request: factReference, prepared: factReference, attempt: text, response: factReference }),
  eight: pair({ request: factReference, executorObservation: factReference, responseObservation: factReference }),
  six: pair({ operation: text, consumedReservation: factReference, dispatchClaim: factReference }),
  submitted: pair({ capture, operationDigest: text }),
  route: pair({ provider: text, model: text, route: text, routeBasis: text, floorDigest: text,
    evidence: texts, evidenceDigest: text, settingsDigest: text, outputSchemaDigest: text }),
  response: pair({ capture, answerDigest: text, parserReference: text,
    parserVersion: text, evidenceContractReference: text, evidenceContractVersion: text }),
  terminal: pair({ evidence: text, capture, rawDigest: text, sourceEvidence: texts }),
});
const responseRequirement = pair({ predicate: text, sources: texts, minimumStrength: text, requiredContract: text });
const verificationV2Shapes: Readonly<Partial<Record<VerificationRecordName, OwnedShape>>> = freeze({
  VerificationPlan: pair({ ...common, purpose: text,
    subject: pair({ rules: list(integer, 128), holder: text, governed: text, scope: text, generation: text }),
    arms: list(pair({ id: text, kind: text, executable: text, fixture: text, outputContract: text, canFail: text, required: bool }), 32),
    bar: pair({ version: text, predicates: texts, sources: texts, minimumStrength: text, subjectDigest: text, captureRequired: bool, freshness: integer, complete: bool }),
    independence: pair({ testedPrincipal: text, observerPrincipal: text, witnessController: text, commonFailures: texts }),
    scheduling: pair({ owner: text, run: text, loopPolicy: text, cadence: integer, freshnessWindow: integer, dueAction: text, recoveryBudget: text }),
    bounds: list(pair({ resource: text, limit: integer }), 64), consumers: list(pair({ id: text, direction: text, enforcedRecord: text, decoder: text, preserved: text }), 64),
    privacy: pair({ readers: texts, providers: texts, captureClass: text, secretCustody: text, destinations: texts }),
    activation: pair({ unit: texts, integration: texts, lifecycle: texts, semantic: texts, limits: texts, evidence: texts }),
    responseContract: pair({ parserReference: text, parserVersion: text, evidenceContractReference: text, evidenceContractVersion: text, mode: text }),
    responseRequirements: list(responseRequirement, 2),
  }),
  VerificationRequest: pair({ ...common, purpose: text, logicalKey: text, operation: text, attempt: text, reservation: text,
    operationDigest: text, scope: text, predicates: texts, subject: responseSubject, plan: text, barVersion: text,
    initialEvidence: texts, missingEvidence: texts, owner: text, loop: text, createdAt: integer, sourceGeneration: text }),
  VerificationAssessment: pair({ ...common, purpose: text, request: text, operation: text, attempt: text, operationDigest: text,
    subject: responseSubject, barVersion: text, observer: text, evidence: texts, missingEvidence: texts, vectorDigest: text,
    knownLineages: texts, captureStatuses: list(status), taints: texts,
    predicates: list(pair({ predicate: text, verdict: text, reason: text, evidence: texts, decision: text }), 16),
    validFrom: integer, validUntil: integer, supersedes: text }),
});

// The owner boundary accepts either original v1 bytes or the exact output-use v2
// bytes. Version-specific closed validation below still rejects mixed variants.
export const verificationShapes: Readonly<Record<VerificationRecordName, OwnedShape>> = freeze(Object.fromEntries(
  (Object.keys(verificationV1Shapes) as VerificationRecordName[]).map(name => {
    const v1 = verificationV1Shapes[name] as Extract<OwnedShape, { kind: 'object' }>;
    const v2 = verificationV2Shapes[name] as Extract<OwnedShape, { kind: 'object' }> | undefined;
    if (!v2) return [name, v1];
    const fields = { ...v1.fields, ...v2.fields };
    const optional = Object.keys(fields).filter(key => !Object.hasOwn(v1.fields, key) || !Object.hasOwn(v2.fields, key));
    return [name, pair(fields, optional)];
  }),
) as Record<VerificationRecordName, OwnedShape>);

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

const settlementPredicates = ['occurrence', 'non-occurrence', 'quiescence', 'charge'] as const;
const responsePredicates = ['response-authenticity', 'response-completeness'] as const;
const predicates = [...settlementPredicates, ...responsePredicates] as const;
const legacyMigrationProof = randomBytes(32).toString('hex');
const captureStatuses = ['available', 'tombstoned', 'expired', 'missing'] as const;
const closureAssessments = ['conclusion', 'reason', 'outcome', 'process'] as const;
function one(value: string, choices: readonly string[], field: string): void { ensure(choices.includes(value), `${field} outside closed set`); }
function nonnegative(value: number, field: string): void { ensure(Number.isSafeInteger(value) && value >= 0, `${field} must be a nonnegative integer`); }
function unique(values: readonly string[], field: string): void { ensure(new Set(values).size === values.length, `${field} contains duplicates`); }
function hash(value: string, field: string): void { ensure(/^sha256:[a-f0-9]{64}$/.test(value), `${field} malformed`); }
function validateResponseSubject(subject: ProviderResponseSubject): void {
  const references = [subject.seven.request, subject.seven.prepared, subject.seven.response, subject.eight.request,
    subject.eight.executorObservation, subject.eight.responseObservation, subject.six.consumedReservation, subject.six.dispatchClaim];
  for (const reference of references) {
    ensure(reference.owner === 'part-two' && reference.name === 'FactEnvelope' && reference.id && reference.kind
      && Number.isSafeInteger(reference.schemaVersion) && reference.schemaVersion > 0, 'response fact reference incomplete');
    hash(reference.contentHash, 'response fact content hash');
  }
  ensure(subject.seven.attempt && subject.six.operation && subject.route.provider && subject.route.model && subject.route.route
    && subject.route.routeBasis && subject.response.parserReference && subject.response.parserVersion
    && subject.response.evidenceContractReference && subject.response.evidenceContractVersion && subject.terminal.evidence,
  'response subject incomplete');
  for (const [field, value] of Object.entries({ submittedCapture: subject.submitted.capture.hash,
    operationDigest: subject.submitted.operationDigest, floorDigest: subject.route.floorDigest,
    evidenceDigest: subject.route.evidenceDigest, settingsDigest: subject.route.settingsDigest,
    outputSchemaDigest: subject.route.outputSchemaDigest, responseCapture: subject.response.capture.hash,
    answerDigest: subject.response.answerDigest, terminalCapture: subject.terminal.capture.hash,
    terminalRawDigest: subject.terminal.rawDigest })) hash(value, field);
  unique(subject.route.evidence, 'response route evidence'); unique(subject.terminal.sourceEvidence, 'response source evidence');
}
function validate(record: VerificationRecord): void {
  ensure((record.schemaVersion === 1 || record.schemaVersion === 2) && record.id.length > 0, 'verification identity/version');
  ensure(('purpose' in record) === (record.schemaVersion === 2), 'verification purpose/version mismatch');
  unique(record.predecessors, 'predecessors');
  switch (record.type) {
    case 'VerificationPlan':
      if ('purpose' in record) {
        ensure(record.purpose === 'output-use' && record.responseContract.mode === 'single-final-reply', 'output plan purpose or mode');
        ensure(record.responseContract.parserReference && record.responseContract.parserVersion
          && record.responseContract.evidenceContractReference && record.responseContract.evidenceContractVersion, 'output response contract incomplete');
        ensure(record.responseRequirements.length === 2, 'output response requirements incomplete');
        unique(record.responseRequirements.map(row => row.predicate), 'response requirements');
        ensure(responsePredicates.every(predicate => record.responseRequirements.some(row => row.predicate === predicate)), 'both response requirements required');
        record.responseRequirements.forEach(row => {
          one(row.predicate, responsePredicates, 'response requirement predicate');
          one(row.minimumStrength, ['proof', 'observation', 'attestation', 'inference'], 'response minimum strength');
          ensure(row.sources.length > 0 && row.requiredContract.length > 0, 'response requirement incomplete');
        });
        ensure(record.bar.captureRequired && record.bar.predicates.length === 6
          && predicates.every(predicate => record.bar.predicates.includes(predicate)), 'output plan must retain all six predicates');
      } else ensure(record.bar.predicates.every(predicate => settlementPredicates.includes(predicate as typeof settlementPredicates[number])), 'v1 plan cannot name output predicates');
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
      if ('purpose' in record) {
        ensure(record.purpose === 'output-use' && record.predicates.length === 2
          && responsePredicates.every(predicate => record.predicates.includes(predicate)), 'output request must ask both response predicates');
        unique(record.predicates, 'request predicates'); validateResponseSubject(record.subject);
      } else one(record.predicate!, settlementPredicates, 'request predicate');
      ensure(record.logicalKey && record.operation && record.attempt && record.operationDigest && record.plan && record.barVersion && record.owner && record.loop && record.sourceGeneration, 'request binding incomplete');
      nonnegative(record.createdAt, 'request clock'); break;
    case 'VerificationAssessment': {
      ensure(record.request && record.operation && record.attempt && record.operationDigest && record.barVersion && record.observer && record.vectorDigest, 'assessment binding incomplete');
      unique(record.knownLineages, 'known lineages'); unique(record.evidence, 'assessment evidence');
      record.captureStatuses.forEach(item => one(item.status, captureStatuses, 'assessment capture status'));
      ensure(record.validUntil >= record.validFrom, 'assessment validity interval inverted');
      const seen = new Set<string>();
      for (const item of record.predicates) {
        one(item.predicate, predicates, 'assessment predicate'); one(item.verdict, ['satisfied', 'contradicted', 'insufficient'], 'assessment verdict');
        ensure(!seen.has(item.predicate), 'assessment predicate collapsed or repeated'); seen.add(item.predicate);
        if (item.verdict === 'satisfied') ensure(item.evidence.length > 0, 'satisfied predicate needs evidence');
      }
      ensure(seen.has('occurrence') && seen.has('non-occurrence') && seen.has('quiescence') && seen.has('charge'), 'assessment must keep four settlement predicates separate');
      if ('purpose' in record) {
        ensure(record.purpose === 'output-use' && seen.size === 6
          && responsePredicates.every(predicate => seen.has(predicate)), 'output assessment must keep both response predicates separate');
        validateResponseSubject(record.subject);
      } else ensure(seen.size === 4, 'v1 assessment cannot promote output predicates');
      break;
    }
    case 'ProbeRecord':
      one(record.disposition, ['passed', 'failed', 'inconclusive', 'not-run', 'cancelled'], 'probe disposition');
      one(record.captureStatus, ['available', 'tombstoned', 'expired', 'missing'], 'probe capture status');
      ensure(record.plan && record.planVersion && record.arm && record.slot && record.attempt && record.subject && record.challengeDigest
        && record.run && record.operation && record.comparison, 'probe binding incomplete');
      ensure(/^sha256:[a-f0-9]{64}$/.test(record.challengeDigest), 'probe challenge digest malformed');
      nonnegative(record.startedAt, 'probe start'); nonnegative(record.completedAt, 'probe completion');
      ensure(record.disposition === 'not-run' || record.disposition === 'cancelled' || record.completedAt >= record.startedAt, 'probe completion precedes start');
      if (record.disposition === 'passed') ensure(record.witnesses.length > 0 && record.missingPhases.length === 0, 'passing probe requires complete independent witness');
      break;
    case 'RetrospectiveReviewRecord':
      one(record.closure, ['open', 'incomplete', 'converged'], 'review closure');
      ensure(record.plan && record.reviewer && record.populationQuery && record.vectorDigest && record.sourceGeneration, 'review binding incomplete');
      unique(record.eligibleCases, 'eligible cases'); unique(record.inspected, 'inspected cases');
      unique(record.omitted.map(item => item.caseId), 'omitted cases');
      ensure(record.omitted.every(item => item.reason.length > 0), 'review omission requires a reason');
      ensure(record.inspected.every(id => record.eligibleCases.includes(id))
        && record.omitted.every(item => record.eligibleCases.includes(item.caseId))
        && record.eligibleCases.every(id => record.inspected.includes(id) !== record.omitted.some(item => item.caseId === id))
        && record.inspected.length + record.omitted.length === record.eligibleCases.length, 'review denominator incomplete');
      if (record.closure === 'converged') ensure(record.independenceEvidence.length > 0 && record.layerBelow.length > 0, 'convergence requires independence and layer-below evidence');
      break;
    case 'SemanticReviewRecord':
      one(record.verdict, ['adequate', 'partial', 'inadequate'], 'semantic verdict');
      ensure(record.edge && record.generation && record.ruleVersion && record.holderHash && record.fixtureHash && record.decoderHash && record.reviewer && record.decision, 'semantic review binding incomplete');
      unique(record.checkRuns, 'semantic check runs'); unique(record.evidencePopulation, 'semantic evidence population'); unique(record.layerBelow, 'semantic layer below');
      if (record.verdict === 'adequate') ensure(record.checkRuns.length > 0 && record.evidencePopulation.length > 0
        && record.layerBelow.length > 0 && record.compliantCases.length > 0 && record.violatingCases.length > 0,
      'adequate review must resolve a foundation and exercise both semantic neighbors');
      break;
    case 'Grade':
      record.captureStatuses.forEach(item => one(item.status, captureStatuses, 'grade capture status'));
      one(record.conclusion.assessment, ['supported', 'contradicted', 'unverifiable', 'not-applicable'], 'conclusion grade');
      one(record.statedReason.assessment, ['supported', 'contradicted', 'unverifiable', 'not-applicable'], 'reason grade');
      one(record.outcome.assessment, ['met', 'unmet', 'pending', 'unverifiable', 'not-applicable'], 'outcome grade');
      one(record.completeness.assessment, ['complete', 'incomplete', 'disputed'], 'completeness grade');
      record.processAssessments.forEach(item => one(item.assessment, ['satisfied', 'violated', 'unverifiable'], 'procedure grade'));
      ensure(record.benchmarkRecord && record.request && record.resolution && record.criterion && record.planVersion && record.grader && record.gradingDecision && record.vectorDigest && record.sourceGeneration, 'grade binding incomplete');
      ensure(record.window.end >= record.window.start, 'grade window inverted');
      ensure(record.decision.length > 0 || record.conclusion.assessment === 'not-applicable' || record.conclusion.assessment === 'unverifiable', 'absent Decision cannot receive an invented conclusion');
      break;
    case 'AssessmentClosure':
      ensure(record.caseId && record.sourceVectorDigest && record.requiredAssessments.length > 0 && record.reviewer && record.decision && record.releasesPin, 'closure binding incomplete');
      ensure(record.activeDisputes.length === 0, 'open dispute forbids assessment closure');
      unique(record.requiredAssessments, 'required closure assessments'); unique(record.dispositions.map(item => item.assessment), 'closure dispositions');
      ensure(record.requiredAssessments.length === closureAssessments.length
        && closureAssessments.every(assessment => record.requiredAssessments.includes(assessment)), 'closure required assessment partition differs');
      ensure(record.dispositions.length === record.requiredAssessments.length
        && record.requiredAssessments.every(assessment => record.dispositions.some(item => item.assessment === assessment)), 'closure assessment denominator incomplete');
      record.dispositions.forEach(item => one(item.disposition, ['assessed', 'evidence-unavailable-with-reason'], 'closure disposition'));
      ensure(record.dispositions.every(item => item.reference.trim().length > 0),
        'closure disposition requires reference and reason; reference must be substantive');
      ensure(record.dispositions.every(item => item.disposition !== 'evidence-unavailable-with-reason'
        || item.reason.trim().length > 0), 'unavailable closure disposition requires a reason');
      ensure(record.releasesPin === `assessment-pin:${record.caseId}`, 'closure may release only its own assessment pin');
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
  const versioned = name === 'VerificationPlan' || name === 'VerificationRequest' || name === 'VerificationAssessment';
  return defineDecoder<Extract<VerificationRecord, { type: N }>, VerificationDecodeContext>({
    name, owner: 'part-nine', currentVersion: versioned ? 2 : 1,
    versions: versioned ? {
      1: { validate: value => { try { shapeCheck(value, verificationV1Shapes[name]); return { ok: true as const, value }; }
        catch (error) { return { ok: false as const, detail: error instanceof Error ? error.message : 'legacy verification record refused' }; } } },
      2: { validate: value => {
        try {
          const raw = value as unknown as Record<string, unknown>;
          if (raw.purpose === 'legacy-settlement') {
            ensure(Object.keys(raw).sort().join(',') === 'legacy,migrationProof,purpose,schemaVersion,type'
              && raw.migrationProof === legacyMigrationProof, 'external legacy migration wrapper refused');
            return { ok: true as const, value };
          }
          ensure(raw.purpose === 'output-use', 'type or schema version unknown');
          shapeCheck(value, verificationV2Shapes[name]!); return { ok: true as const, value };
        } catch (error) { return { ok: false as const, detail: error instanceof Error ? error.message : 'output verification record refused' }; }
      } },
    } : { 1: { validate: value => ({ ok: true as const, value }) } },
    migrations: versioned ? { 1: value => json({ type: name, schemaVersion: 2, purpose: 'legacy-settlement',
      migrationProof: legacyMigrationProof, legacy: value }) } : {},
    decodeCurrent: value => {
      try {
        const raw = value as unknown as Record<string, unknown>;
        const candidate = raw.purpose === 'legacy-settlement' ? raw.legacy : value;
        const record = candidate as unknown as Extract<VerificationRecord, { type: N }>;
        shapeCheck(candidate, 'purpose' in record ? verificationV2Shapes[name]! : verificationV1Shapes[name]);
        ensure(record.type === name, 'owned verification type mismatch'); validate(record);
        return { ok: true, value: freeze(record) };
      } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'verification record refused' }; }
    },
  }, context.preserved);
}

export function decodeVerificationRecord<N extends VerificationRecordName>(name: N, input: unknown, context: VerificationDecodeContext): Result<Extract<VerificationRecord, { type: N }>> {
  if (input && typeof input === 'object' && !Array.isArray(input)
    && (input as { purpose?: unknown }).purpose === 'legacy-settlement')
    return boundary('DecodeVerificationRecord', input, context, () => { throw new Error('external legacy migration wrapper refused'); });
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
    case 'VerificationRequest': return 'purpose' in record
      ? `request:${record.logicalKey}:${encoded(record.subject).hash}:${record.plan}:${record.barVersion}:${record.sourceGeneration}`
      : `request:${record.logicalKey}:${record.predicate}`;
    case 'VerificationAssessment': return `assessment:${record.request}:${record.barVersion}:${record.vectorDigest}`;
    case 'ProbeRecord': return `probe:${record.plan}:${record.arm}:${record.slot}:${record.attempt}`;
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
    if (ai.id !== bi.id && ai.logicalKey !== bi.logicalKey) return freeze({ equal: false });
    if (ai.canonicalHash === bi.canonicalHash) return freeze({ equal: true });
    const conflict: ConflictClass = { key: ai.logicalKey, kind: 'immutable-disagreement', facts: [ai.canonicalHash, bi.canonicalHash].sort(), detail: `divergent canonical content for ${name} logical identity ${ai.logicalKey}` };
    return freeze({ equal: false, conflict });
  });
}

export function wireVerificationRecord(record: VerificationRecord): Json { return json(record); }

export const verificationKindFor = (name: VerificationRecordName): string => `verification-${name}`;
export function verificationRecordFrom(fact: FactEnvelope, context: VerificationDecodeContext): VerificationRecord {
  const body = fact.body as { record: Json };
  ensure(body.record && typeof body.record === 'object' && !Array.isArray(body.record), 'verification record body missing');
  const name = (body.record as Readonly<Record<string, Json>>).type;
  ensure(typeof name === 'string' && Object.hasOwn(verificationShapes, name), 'unknown verification record type');
  return take(decodeVerificationRecord(name as VerificationRecordName, body.record, context));
}

function responseReferences(subject: ProviderResponseSubject): readonly ResponseFactReference[] {
  return [subject.seven.request, subject.seven.prepared, subject.seven.response, subject.eight.request,
    subject.eight.executorObservation, subject.eight.responseObservation, subject.six.consumedReservation, subject.six.dispatchClaim];
}
type ResponseFactReference = ProviderResponseSubject['seven']['request'];
function decodeOwnedVerification(name: VerificationRecordName, input: unknown, context: OwnedBodyContext,
  host: VerificationHost, historical: boolean): VerificationRecord {
  ensure(context.origin.machine === host.machine && context.origin.principal.id === host.principal.id
    && context.origin.principal.kind === host.principal.kind, 'foreign verification recorder');
  const record = take(decodeVerificationRecord(name, input, context));
  ensure(context.origin.kind === verificationKindFor(name) && context.origin.schemaVersion === 1,
    'verification fact kind or envelope schema mismatch');
  const cone = new Map(causalCone(context.origin, context.facts.facts).map(fact => [fact.id, fact]));
  ensure(record.predecessors.every(id => cone.has(id)), 'verification predecessor outside causal cone');
  if ((record.type === 'VerificationAssessment' || record.type === 'Grade') && record.supersedes)
    ensure(record.predecessors.includes(record.supersedes), 'changed assessment must causally link predecessor');
  if ((record.type === 'VerificationRequest' || record.type === 'VerificationAssessment') && 'purpose' in record) {
    for (const reference of responseReferences(record.subject)) {
      const fact = cone.get(reference.id);
      ensure(fact && fact.kind === reference.kind && fact.schemaVersion === reference.schemaVersion
        && fact.contentHash === reference.contentHash && record.predecessors.includes(reference.id), 'response subject fact differs or lacks closure');
    }
    for (const capture of [record.subject.submitted.capture, record.subject.response.capture, record.subject.terminal.capture]) {
      const stored = context.facts.captures[capture.reference];
      ensure(stored && stored.hash === capture.hash, 'response subject capture metadata absent');
      ensure(historical || stored.status === 'available' && stored.bytes !== null && hashBytes(stored.bytes) === capture.hash,
        'current response subject capture unavailable');
    }
    let boundRequest: Extract<VerificationRecord, { type: 'VerificationRequest' }> | undefined;
    const planId = record.type === 'VerificationRequest' ? record.plan : (() => {
      const requestFact = [...cone.values()].find(fact => fact.kind === verificationKindFor('VerificationRequest')
        && (fact.body as unknown as { record?: { id?: string } }).record?.id === record.request);
      ensure(requestFact && record.predecessors.includes(requestFact.id), 'output assessment request is absent from causal closure');
      const request = take(decodeVerificationRequest((requestFact.body as unknown as { record: Json }).record, context));
      ensure('purpose' in request && encoded(request.subject).bytes === encoded(record.subject).bytes
        && request.operation === record.operation && request.attempt === record.attempt
        && request.operationDigest === record.operationDigest && request.barVersion === record.barVersion,
      'output assessment differs from its request');
      boundRequest = request;
      return request.plan;
    })();
    const planFact = [...cone.values()].find(fact => fact.kind === verificationKindFor('VerificationPlan')
      && (fact.body as unknown as { record?: { id?: string } }).record?.id === planId);
    ensure(planFact && record.predecessors.includes(planFact.id), 'output verification plan absent from causal closure');
    const plan = take(decodeVerificationPlan((planFact.body as unknown as { record: Json }).record, context));
    const sourceGeneration = record.type === 'VerificationRequest' ? record.sourceGeneration : boundRequest!.sourceGeneration;
    const scope = record.type === 'VerificationRequest' ? record.scope : boundRequest!.scope;
    ensure('purpose' in plan && plan.bar.subjectDigest === encoded(record.subject).hash
      && plan.bar.version === record.barVersion && plan.subject.generation === sourceGeneration
      && plan.subject.scope === scope, 'output plan, bar, generation, scope, or subject differs');
    const evidence = record.type === 'VerificationRequest' ? record.initialEvidence : record.evidence;
    for (const id of evidence) {
      const fact = [...cone.values()].find(candidate => (candidate.body as unknown as { evidence?: { id?: string } }).evidence?.id === id);
      ensure(fact && record.predecessors.includes(fact.id), 'output Evidence absent from causal closure');
    }
    if (!historical) ensure(sourceGeneration === host.current().generation,
      'output request or assessment generation is not current');
  }
  if (!historical && record.type === 'VerificationPlan' && 'purpose' in record) {
    const scope = host.scope.kind === 'organization' || host.scope.members.includes(record.subject.scope);
    ensure(record.subject.generation === host.current().generation && scope, 'output plan generation or scope is not current');
  }
  return record;
}
export function decodeVerificationRecordAtOrigin(name: VerificationRecordName, input: unknown,
  context: OwnedBodyContext, host: VerificationHost): Result<VerificationRecord> {
  return boundary('DecodeVerificationRecordAtOrigin', { name, input }, context, () => decodeOwnedVerification(name, input, context, host, false));
}
export function decodeHistoricalVerificationRecord(name: VerificationRecordName, input: unknown,
  context: OwnedBodyContext, host: VerificationHost): Result<VerificationRecord> {
  return boundary('DecodeHistoricalVerificationRecord', { name, input }, context, () => decodeOwnedVerification(name, input, context, host, true));
}
export function verificationRows(facts: readonly FactEnvelope[], context: VerificationDecodeContext): readonly { fact: FactEnvelope; record: VerificationRecord }[] {
  const kinds = new Set(Object.keys(verificationShapes).map(name => verificationKindFor(name as VerificationRecordName)));
  return facts.filter(fact => kinds.has(fact.kind)).map(fact => ({ fact, record: verificationRecordFrom(fact, context) }));
}
export function verificationSchemas(host: VerificationHost): readonly FactSchema[] {
  return (Object.keys(verificationShapes) as VerificationRecordName[]).map(name => ({
    kind: verificationKindFor(name), version: 1,
    fields: { record: { kind: 'owned', owner: 'part-nine', name } }, machineScope: 'shared',
    standing: 'requester', action: 'work', scope: host.scope, causallyBound: true,
    requiredReferences: [], authority: 'none',
  }));
}
export function registerVerificationBodies(host: VerificationHost): Result<readonly OwnedBodyRegistration[]> {
  return boundary('VerificationRegistrations', null, host.boundary, () =>
    (Object.keys(verificationShapes) as VerificationRecordName[]).map(name => {
      const versioned = name === 'VerificationPlan' || name === 'VerificationRequest' || name === 'VerificationAssessment';
      return take(registerOwnedBody({
      name, owner: 'part-nine', currentVersion: versioned ? 2 : 1,
      versions: versioned ? { 1: { validate: value => { try { shapeCheck(value, verificationV1Shapes[name]); return { ok: true as const, value }; }
        catch (error) { return { ok: false as const, detail: error instanceof Error ? error.message : 'legacy verification record refused' }; } } },
        2: { validate: value => { try { const raw = value as unknown as Record<string, unknown>;
          if (raw.purpose === 'legacy-settlement') ensure(Object.keys(raw).sort().join(',') === 'legacy,migrationProof,purpose,schemaVersion,type'
            && raw.migrationProof === legacyMigrationProof, 'external legacy migration wrapper refused');
          else { ensure(raw.purpose === 'output-use', 'wire body schema 2 requires output-use'); shapeCheck(value, verificationV2Shapes[name]!); }
          return { ok: true as const, value }; } catch (error) { return { ok: false as const,
            detail: error instanceof Error ? error.message : 'output verification record refused' }; } } } }
        : { 1: { validate: value => ({ ok: true as const, value }) } },
      migrations: versioned ? { 1: value => json({ type: name, schemaVersion: 2, purpose: 'legacy-settlement',
        migrationProof: legacyMigrationProof, legacy: value }) } : {},
      decodeCurrent: (value, context) => {
        try {
          const raw = value as unknown as Record<string, unknown>;
          const original = raw.purpose === 'legacy-settlement' ? raw.legacy : value;
          const record = take((context.mode === 'origin' ? decodeVerificationRecordAtOrigin : decodeHistoricalVerificationRecord)(name, original, context, host));
          return { ok: true, value: wireVerificationRecord(record) };
        } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'verification body refused' }; }
      },
    }, verificationShapes[name], host.boundary)); }),
  );
}
export function createVerificationSpine(host: VerificationHost, author: VerificationAuthor, store: VerificationSpine['store']): VerificationSpine {
  return Object.freeze({ store, append: (record: VerificationRecord, required: readonly string[] = record.predecessors) => authorAndAppend({
    kind: verificationKindFor(record.type), schemaVersion: 1, machine: host.machine,
    principal: json(host.principal), provenance: json(host.principal.provenance), at: json(host.current().clock),
    body: { record: wireVerificationRecord(record) }, required,
  }, author.context, store, author.privateKey) });
}
