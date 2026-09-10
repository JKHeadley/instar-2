import { decode, decodeMeasurement, grantLiveness, scopeIncludes } from '../index.js';
import type { BoundaryContext, Clock, Json, Result, RunReference } from '../index.js';
import { causalCone, prepareSnapshot, registerOwnedBody } from '../facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import type { AdmissionReservation, FenceToken, Lease, LoopAttempt, LoopOutcome, LoopPolicy, LoopRecord, ScanCursor, SettlementConsumer, SharedLoopRecord, TransportFact, TransportHost, TransportRecord, TransportRowRecord } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { compatibleLoopPolicyShape, isSharedLoopPolicy, isSharedLoopRecord, isStoredSharedLoopRecord,
  loadSharedLoopRecord, seamShapeCheck, sharedLoopRecordCheck,
  sharedLoopPolicyOwnedName, sharedLoopRecordFactKind, sharedLoopRecordOwnedName, sharedPolicyCheck, sourceVectorCheck,
  transportSeamShapes as seamShapes } from './loop-seam.js';
import { admissionAccounting, bindSettlementConsumer, checkApplicationEvidence, latestApplication, noteAccountingCandidate, requireApplication } from './settlement.js';

const txt = { kind: 'text', maxLength: 256 } as const;
const int = { kind: 'integer' } as const;
const common = { type: txt, schemaVersion: int };
const row = { ...common, domain: txt, command: txt, predecessor: txt, authority: txt, tick: int };
const fence: OwnedShape = { kind: 'object', fields: { ...common, domain: txt, epoch: int, assignment: txt, holder: txt, machine: txt, incarnation: txt, authority: txt, generation: txt } };
const policy: OwnedShape = { kind: 'object', fields: { ...common, id: txt, maxAttempts: int, minDelay: int, maxDuration: int, timeout: int, concurrency: int, failDirection: txt, breaker: txt } };
export const transportShapes: Readonly<Record<string, OwnedShape>> = freeze({
  Lease: { kind: 'object', fields: { ...row, epoch: int, holder: txt, machine: txt, incarnation: txt, generation: txt, expires: int, state: txt, operation: txt, term: int } },
  FenceToken: fence, LoopPolicy: policy,
  AdmissionReservation: { kind: 'object', fields: { ...row, operation: txt, request: txt, attempt: txt, digest: txt, run: txt, semanticMessage: txt, deliveryAttempt: txt, fence, charge: int, state: txt, executor: txt, durability: txt, replicas: int } },
  LoopRecord: { kind: 'object', fields: { ...row, run: txt, episode: txt, policy, attempts: int, started: int, nextWake: int, state: txt, pending: txt } },
  RecoveryRecord: { kind: 'object', fields: { ...row, operation: txt, episode: txt, observation: txt, disposition: txt } },
  ScanCursor: { kind: 'object', fields: { ...row, scan: txt, generation: txt, orderedKeysDigest: txt,
    keyCount: int, previous: txt, selectedFrom: int, selectedCount: int, nextIndex: int,
    maxItems: int, maxDuration: int, elapsed: int, wrapped: int } },
  SettlementApplication: { kind: 'object', fields: { ...row, operation: txt, request: txt, reservation: txt, claim: txt, digest: txt,
    settlement: txt, settlementFact: txt, settlementHash: txt, actualCharge: int, exposure: int, released: int, unresolved: int, capViolation: int, retryEligible: int } },
});
const registeredTransportShapes: Readonly<Record<string, OwnedShape>> = freeze({
  ...transportShapes,
  LoopPolicy: compatibleLoopPolicyShape,
});
export const transportSeamShapes = seamShapes;
const recordNames = ['Lease', 'AdmissionReservation', 'LoopRecord', 'RecoveryRecord', 'ScanCursor', 'SettlementApplication'];
export const kindFor = (name: string) => `transport-${name}`;
export const kindForRecord = (record: TransportRecord) => isSharedLoopRecord(record) ? sharedLoopRecordFactKind : kindFor(record.type);
export function transportSchemas(host: TransportHost): readonly FactSchema[] {
  return recordNames.map(name => ({ kind: kindFor(name), version: 1,
    fields: { record: { kind: 'owned', owner: 'part-six', name } }, machineScope: 'shared',
    // The issuer identity and current standing are checked by the owner boundary too.
    standing: 'requester', action: 'work', scope: host.scope, causallyBound: false,
    requiredReferences: [], authority: 'none' }));
}
export function transportSeamSchemas(host: TransportHost): readonly FactSchema[] {
  const base = { machineScope: 'shared' as const, standing: 'requester' as const, action: 'work', scope: host.scope,
    causallyBound: false, requiredReferences: [] as readonly string[], authority: 'none' as const };
  return [
    { ...base, kind: kindFor('LoopPolicy'), version: 1,
      fields: { policy: { kind: 'owned' as const, owner: 'part-six', name: sharedLoopPolicyOwnedName }, generation: { kind: 'text' as const, maxLength: 256 } } },
    { ...base, kind: sharedLoopRecordFactKind, version: 1,
      fields: { record: { kind: 'owned' as const, owner: 'part-six', name: sharedLoopRecordOwnedName } } },
  ];
}
export function shapeCheck(v: unknown, shape: OwnedShape): void {
  if (shape.kind === 'text') { ensure(typeof v === 'string' && v.length <= shape.maxLength, 'bounded text required'); return; }
  if (shape.kind === 'integer') { ensure(Number.isSafeInteger(v), 'safe integer required'); return; }
  ensure(shape.kind === 'object' && v !== null && typeof v === 'object' && !Array.isArray(v), 'closed object required');
  const r = v as Record<string, unknown>;
  ensure(Object.keys(r).length === Object.keys(shape.fields).length, 'undeclared or missing field');
  for (const [key, field] of Object.entries(shape.fields)) { ensure(Object.hasOwn(r, key), `missing ${key}`); shapeCheck(r[key], field); }
}
export function policyCheck(p: LoopPolicy): void {
  shapeCheck(p, policy);
  ensure(p.type === 'LoopPolicy' && p.schemaVersion === 1 && p.id.length > 0, 'policy identity');
  ensure(p.maxAttempts >= 0 && p.maxDuration >= 0 && p.minDelay > 0 && p.timeout > 0,
    'finite nonnegative bounds and positive delays required');
  ensure(p.concurrency === 1 && p.failDirection === 'closed' && p.breaker === 'stub-closed', 'unsupported loop policy');
}
function referenceCheck(value: { readonly owner: string; readonly name: string; readonly id: string }, owner: string, name: string): void {
  ensure(value.owner === owner && value.name === name && value.id.length > 0, `${name} reference owner`);
}
export { sourceVectorCheck } from './loop-seam.js';
function schemaOwns(context: FactContext, fact: FactEnvelope, field: string, owner: string, name: string): boolean {
  const schema = context.schemas.find(value => value.kind === fact.kind && value.version === fact.schemaVersion);
  const shape = schema?.fields[field];
  return shape?.kind === 'owned' && shape.owner === owner && shape.name === name;
}
function allFacts(facts: readonly FactEnvelope[]): readonly FactEnvelope[] {
  return [...new Map(facts.map(fact => [fact.id, fact])).values()];
}
function requireUsableFacts(facts: readonly FactEnvelope[], context: FactContext,
  history: readonly FactEnvelope[] = context.facts): void {
  const population = allFacts([...context.facts, ...history]);
  const snapshot = take(prepareSnapshot(facts, { ...context, facts: population }));
  ensure(snapshot.entries.length === facts.length
    && snapshot.entries.every(entry => entry.taint.length === 0 && entry.conflicts.length === 0),
  'referenced owner evidence is unavailable, stale, or conflicted');
}
export function resolveSourceVector(vector: SharedLoopRecord['sourceVector'], facts: readonly FactEnvelope[],
  context?: FactContext): readonly FactEnvelope[] {
  sourceVectorCheck(vector);
  const resolved = vector.map(point => allFacts(facts).find(fact => fact.machine === point.machine
    && fact.segment.epoch === point.epoch && fact.segment.position === point.position));
  ensure(resolved.every(Boolean), 'source vector names an unavailable signed position');
  const exact = resolved as readonly FactEnvelope[];
  if (context) requireUsableFacts(exact, context, facts);
  return exact;
}
export function resolveRunReference(reference: RunReference, facts: readonly FactEnvelope[], context: FactContext,
  status = true, allowTerminal = false): FactEnvelope {
  referenceCheck(reference, 'part-five', 'Run');
  const candidates = allFacts(facts).filter(fact => schemaOwns(context, fact, 'record', 'part-five', 'Run'))
    .filter(fact => {
      const body = fact.body as { run?: unknown; record?: { type?: unknown; id?: unknown } };
      return body.run === reference.id && body.record?.type === 'Run' && body.record.id === reference.id;
    });
  ensure(candidates.length > 0, 'Run admission is absent');
  ensure(new Set(candidates.map(fact => encoded((fact.body as { record: Json }).record).bytes)).size === 1,
    'Run admission is conflicted');
  const fact = candidates.at(-1)!;
  const terminal = allFacts(facts).some(value => schemaOwns(context, value, 'record', 'part-five', 'RunTransition')
    && (value.body as { run?: unknown; record?: { run?: unknown; to?: unknown } }).run === reference.id
    && ['completed', 'cancelled', 'unreachable'].includes(String((value.body as { record?: { to?: unknown } }).record?.to)));
  ensure(allowTerminal || !terminal, 'Run admission is terminal');
  const openingId = (fact.body as { record: { opening?: { id?: string } } }).record.opening?.id;
  const opening = allFacts(facts).find(value => value.id === openingId);
  ensure(opening, 'Run opening evidence is absent');
  if (status) requireUsableFacts([fact, opening], context, facts);
  return fact;
}
export function resolvePolicyFact(policyValue: SharedLoopRecord['policy'], generation: string,
  facts: readonly FactEnvelope[], context: FactContext, status = true): FactEnvelope {
  const candidates = allFacts(facts).filter(fact => fact.kind === kindFor('LoopPolicy')
    && schemaOwns(context, fact, 'policy', 'part-six', sharedLoopPolicyOwnedName))
    .filter(fact => (fact.body as { policy?: { id?: unknown }; generation?: unknown }).policy?.id === policyValue.id
      && (fact.body as { generation?: unknown }).generation === generation);
  ensure(candidates.length > 0, 'governed loop policy fact is absent for the pinned generation');
  ensure(candidates.some(fact => encoded((fact.body as { policy: Json }).policy).bytes === encoded(policyValue).bytes),
    'governed loop policy differs from the pinned value');
  ensure(new Set(candidates.map(fact => encoded((fact.body as { policy: Json }).policy).bytes)).size === 1,
    'governed loop policy is conflicted');
  if (status) requireUsableFacts(candidates, context, facts);
  return candidates.at(-1)!;
}
export function resolvePressureBinding(record: Pick<SharedLoopRecord, 'parentDuty' | 'operationFamily' | 'pressureScope'
  | 'pressureKey' | 'pressureBinding'>, facts: readonly FactEnvelope[], context: FactContext,
  host: TransportHost, status = true): FactEnvelope {
  referenceCheck(record.pressureBinding, 'part-two', 'FactEnvelope');
  ensure(host.loopScopeBinding?.owner === 'part-three', 'governed loop pressure binding unavailable');
  const resolved = take(host.loopScopeBinding.resolve({ parentDuty: record.parentDuty,
    operationFamily: record.operationFamily, pressureScope: record.pressureScope }));
  ensure(resolved.operationFamily === record.operationFamily
    && encoded(resolved.pressureScope).bytes === encoded(record.pressureScope).bytes
    && encoded(resolved.witness).bytes === encoded(record.pressureBinding).bytes,
  'governed loop pressure binding changed');
  const fact = allFacts(facts).find(value => value.id === record.pressureBinding.id);
  ensure(fact?.kind === 'loop-pressure-binding', 'governed loop pressure binding fact is absent or wrong-kind');
  const body = fact.body as { parentDuty?: unknown; operationFamily?: unknown; pressureScopeBytes?: unknown };
  ensure(body.parentDuty === record.parentDuty.id && body.operationFamily === record.operationFamily
    && body.pressureScopeBytes === encoded(record.pressureScope).bytes
    && record.pressureKey === `pressure:${encoded([record.operationFamily, record.pressureScope]).hash}`,
  'governed loop pressure binding names another subject');
  if (status) requireUsableFacts([fact], context, facts);
  return fact;
}
function ownerRecordCandidates(facts: readonly FactEnvelope[], context: FactContext, name: string, id: string) {
  return allFacts(facts).filter(fact => schemaOwns(context, fact, 'record', 'part-nine', name))
    .filter(fact => {
      const record = (fact.body as { record?: { type?: unknown; id?: unknown } }).record;
      return record?.type === name && record.id === id;
    });
}
function uniqueOwnerRecord(facts: readonly FactEnvelope[], context: FactContext, name: string, id: string): FactEnvelope {
  const candidates = ownerRecordCandidates(facts, context, name, id);
  ensure(candidates.length > 0, `${name} evidence is absent`);
  ensure(new Set(candidates.map(fact => encoded((fact.body as { record: Json }).record).bytes)).size === 1,
    `${name} evidence is conflicted`);
  return candidates.at(-1)!;
}
function evidenceFact(id: string, facts: readonly FactEnvelope[], context: FactContext): FactEnvelope {
  const candidates = allFacts(facts).filter(fact => Object.entries(fact.body as Readonly<Record<string, Json>>).some(([field, value]) => {
    const shape = context.schemas.find(schema => schema.kind === fact.kind && schema.version === fact.schemaVersion)?.fields[field];
    const constitutional = value as { type?: unknown; id?: unknown } | undefined;
    return shape?.kind === 'constitutional' && shape.type === 'Evidence'
      && constitutional?.type === 'Evidence' && constitutional.id === id;
  }));
  ensure(candidates.length > 0, 'VerificationAssessment predicate Evidence is absent');
  ensure(new Set(candidates.map(fact => encoded(fact.body).bytes)).size === 1,
    'VerificationAssessment predicate Evidence is conflicted');
  return candidates.at(-1)!;
}
function restorationAssessmentComplete(record: Readonly<{ missingEvidence?: unknown; captureStatuses?: unknown;
  taints?: unknown; predicates?: unknown }>): boolean {
  const predicates = Array.isArray(record.predicates)
    ? record.predicates as readonly { predicate?: unknown; verdict?: unknown }[] : [];
  const verdict = (name: string) => predicates.find(value => value.predicate === name)?.verdict;
  return Array.isArray(record.missingEvidence) && record.missingEvidence.length === 0
    && Array.isArray(record.taints) && record.taints.length === 0
    && Array.isArray(record.captureStatuses) && record.captureStatuses.every(value =>
      value !== null && typeof value === 'object' && (value as { status?: unknown }).status === 'available')
    && verdict('occurrence') === 'satisfied' && verdict('non-occurrence') === 'contradicted'
    && verdict('quiescence') === 'satisfied' && verdict('charge') === 'satisfied';
}
export function resolveRestorationReference(reference: SharedLoopRecord['closureEvidence'][number],
  facts: readonly FactEnvelope[], context: FactContext, at: Clock, pressureKey: string,
  operationFamily: string, host: TransportHost, status = true, requireComplete = true): readonly FactEnvelope[] {
  referenceCheck(reference, 'part-nine', 'VerificationAssessment');
  const candidates = allFacts(facts).filter(fact => schemaOwns(context, fact, 'record', 'part-nine', 'VerificationAssessment'))
    .filter(fact => fact.id === reference.id
      || (fact.body as { record?: { type?: unknown; id?: unknown } }).record?.id === reference.id);
  ensure(candidates.length > 0, 'VerificationAssessment evidence is absent');
  ensure(new Set(candidates.map(fact => encoded((fact.body as { record: Json }).record).bytes)).size === 1,
    'VerificationAssessment evidence is conflicted');
  const fact = candidates.at(-1)!;
  const record = (fact.body as { record: { request?: unknown; predecessors?: unknown; operation?: unknown; attempt?: unknown;
    operationDigest?: unknown; barVersion?: unknown; evidence?: unknown; supersedes?: unknown;
    missingEvidence?: unknown; captureStatuses?: unknown; taints?: unknown; predicates?: unknown;
    validFrom?: number; validUntil?: number } }).record;
  ensure(Number.isSafeInteger(record.validFrom) && Number.isSafeInteger(record.validUntil)
    && record.validFrom! <= at.value && at.value < record.validUntil!, 'VerificationAssessment evidence is stale');
  const expectedDigest = encoded([pressureKey, operationFamily]).hash;
  const predicates = Array.isArray(record.predicates) ? record.predicates as readonly { predicate?: unknown; verdict?: unknown }[] : [];
  ensure(record.operation === operationFamily && record.operationDigest === expectedDigest,
    'VerificationAssessment restoration subject differs from the governed pressure');
  ensure(typeof record.request === 'string' && typeof record.attempt === 'string' && typeof record.barVersion === 'string'
    && Array.isArray(record.predecessors) && Array.isArray(record.evidence),
  'VerificationAssessment support bindings are incomplete');
  const predecessors = record.predecessors as unknown[];
  const requestFact = uniqueOwnerRecord(facts, context, 'VerificationRequest', record.request);
  const request = (requestFact.body as { record: { predecessors?: unknown; operation?: unknown; attempt?: unknown;
    operationDigest?: unknown; plan?: unknown; barVersion?: unknown; sourceGeneration?: unknown } }).record;
  ensure(Array.isArray(request.predecessors) && typeof request.plan === 'string'
    && predecessors.includes(requestFact.id),
  'VerificationAssessment request lineage is absent');
  const planFact = uniqueOwnerRecord(facts, context, 'VerificationPlan', request.plan);
  const plan = (planFact.body as { record: { subject?: { generation?: unknown }; bar?: { version?: unknown } } }).record;
  ensure(request.predecessors.includes(planFact.id)
    && request.operation === operationFamily && request.operationDigest === expectedDigest
    && request.attempt === record.attempt && request.barVersion === record.barVersion
    && plan.bar?.version === request.barVersion && plan.subject?.generation === request.sourceGeneration,
  'VerificationAssessment request, plan, or pressure subject differs');
  const predicateEvidence = (Array.isArray(record.predicates) ? record.predicates : [])
    .flatMap(value => value && typeof value === 'object' && Array.isArray((value as { evidence?: unknown }).evidence)
      ? (value as { evidence: unknown[] }).evidence : []);
  const evidenceIds = [...new Set([...record.evidence, ...predicateEvidence])];
  ensure(evidenceIds.every(id => typeof id === 'string' && id.length > 0),
    'VerificationAssessment predicate Evidence reference is invalid');
  const evidenceFacts = evidenceIds.map(id => evidenceFact(id as string, facts, context));
  const superseded = typeof record.supersedes === 'string' && record.supersedes.length > 0
    ? [uniqueOwnerRecord(facts, context, 'VerificationAssessment', record.supersedes)] : [];
  const support = [...new Map([fact, requestFact, planFact, ...evidenceFacts, ...superseded]
    .map(value => [value.id, value])).values()];
  ensure([requestFact, ...evidenceFacts, ...superseded].every(value => predecessors.includes(value.id)),
    'VerificationAssessment support is outside its signed predecessor set');
  if (requireComplete) ensure(restorationAssessmentComplete(record),
    'VerificationAssessment does not establish complete restoration');
  ensure(host.restorationEvidence?.owner === 'part-nine', 'independent restoration evidence unavailable');
  const verified = take(host.restorationEvidence.verify({ reference, pressureKey, operationFamily }));
  ensure(encoded(verified.reference).bytes === encoded(reference).bytes
    && verified.operation === record.operation && verified.operationDigest === record.operationDigest
    && encoded(verified.missingEvidence).bytes === encoded(record.missingEvidence).bytes
    && encoded(verified.captureStatuses).bytes === encoded(record.captureStatuses).bytes
    && encoded(verified.taints).bytes === encoded(record.taints).bytes
    && encoded(verified.predicates).bytes === encoded(predicates.map(value => ({ predicate: value.predicate, verdict: value.verdict }))).bytes
    && verified.validFrom === record.validFrom && verified.validUntil === record.validUntil,
  'current Part Nine restoration assessment differs from signed history');
  if (status) requireUsableFacts(support, context, facts);
  return support;
}
export function restorationReferenceComplete(reference: SharedLoopRecord['closureEvidence'][number],
  facts: readonly FactEnvelope[], context: FactContext, at: Clock, pressureKey: string,
  operationFamily: string, host: TransportHost, status = true): boolean {
  const support = resolveRestorationReference(reference, facts, context, at, pressureKey,
    operationFamily, host, status, false);
  const assessment = support.find(fact => schemaOwns(context, fact, 'record', 'part-nine', 'VerificationAssessment')
    && (fact.id === reference.id
      || (fact.body as { record?: { id?: unknown } }).record?.id === reference.id));
  ensure(assessment, 'VerificationAssessment evidence is absent');
  return restorationAssessmentComplete((assessment.body as {
    record: Parameters<typeof restorationAssessmentComplete>[0]
  }).record);
}
function sharedLoopMeasurements(record: SharedLoopRecord, host: TransportHost): void {
  const values = [record.transitionAt, record.nextEligible, record.breakerFirstOpened,
    ...record.attemptLog.map(value => value.admittedAt), ...record.outcomeLog.map(value => value.observedAt)];
  for (const value of values) take(decodeMeasurement('clock', value, host.current().decode));
}
function requiredBy(origin: FactEnvelope, dependencies: readonly FactEnvelope[]): void {
  const required = new Set(origin.predecessors.required);
  ensure(dependencies.every(fact => required.has(fact.id)), 'owner evidence is outside the signed required-reference set');
}
export function sharedLoopEvidence(record: SharedLoopRecord, facts: readonly FactEnvelope[], context: FactContext,
  host: TransportHost): readonly FactEnvelope[] {
  const history = allFacts(facts);
  sharedLoopMeasurements(record, host);
  const dependencies: FactEnvelope[] = [
    resolvePolicyFact(record.policy, record.policyGeneration.id, history, context, false),
    resolveRunReference(record.parentDuty, history, context, false),
    resolveRunReference(record.currentOwnerRun, history, context, false),
    resolvePressureBinding(record, history, context, host, false),
    ...resolveSourceVector(record.sourceVector, history),
  ];
  for (const outcome of record.outcomeLog) {
    dependencies.push(...resolveSourceVector(outcome.sourceVector, history));
    dependencies.push(resolveLoopOutcomeCompletion(record, outcome, history, context, false));
    for (const reference of outcome.restoration) dependencies.push(...resolveRestorationReference(reference, history, context,
      outcome.observedAt, record.pressureKey, record.operationFamily, host, false, false));
  }
  for (const attempt of record.attemptLog) dependencies.push(...resolveSourceVector(attempt.sourceVector, history));
  for (const reference of record.closureEvidence) {
    const contributedAt = record.outcomeLog.find(outcome => outcome.restoration.some(value => value.id === reference.id))?.observedAt
      ?? record.transitionAt;
    const support = resolveRestorationReference(reference, history, context,
      record.transition === 'closed' ? record.transitionAt : contributedAt,
      record.pressureKey, record.operationFamily, host, false);
    dependencies.push(...support);
  }
  const unique = [...new Map(dependencies.map(fact => [fact.id, fact])).values()];
  requireUsableFacts(unique, context, history);
  return unique;
}
export function resolveSharedLoopEvidence(record: SharedLoopRecord, origin: FactEnvelope,
  facts: readonly FactEnvelope[], context: FactContext, host: TransportHost): readonly string[] {
  const unique = sharedLoopEvidence(record, facts, context, host);
  requiredBy(origin, unique); return unique.map(fact => fact.id);
}
function constitutionalFact(reference: { readonly type: string; readonly id: string;
  readonly fact: { readonly owner: string; readonly name: string; readonly id: string }; readonly field: string },
  expected: 'Result' | 'Outcome', facts: readonly FactEnvelope[], context: FactContext, status = true): FactEnvelope {
  const fact = allFacts(facts).find(value => value.id === reference.fact.id);
  ensure(fact, `${expected} fact is absent`);
  const schema = context.schemas.find(value => value.kind === fact.kind && value.version === fact.schemaVersion);
  const field = schema?.fields[reference.field];
  ensure(reference.type === expected && field?.kind === 'constitutional' && field.type === expected,
    `reference is not an owner ${expected} field`);
  const owned = (fact.body as Record<string, unknown>)[reference.field] as { type?: unknown; id?: unknown } | undefined;
  ensure(owned?.type === expected && (owned.id === undefined || owned.id === reference.id),
    `${expected} reference names another subject`);
  if (status) requireUsableFacts([fact], context, facts);
  return fact;
}
export function resolveConstitutionalResult(reference: { readonly type: string; readonly id: string;
  readonly fact: { readonly owner: string; readonly name: string; readonly id: string }; readonly field: string },
  facts: readonly FactEnvelope[], context: FactContext): FactEnvelope {
  return constitutionalFact(reference, 'Result', facts, context);
}
function resolveLoopOutcomeCompletion(record: SharedLoopRecord, outcome: SharedLoopRecord['outcomeLog'][number],
  facts: readonly FactEnvelope[], context: FactContext, status = true): FactEnvelope {
  const fact = constitutionalFact(outcome.completion, 'Outcome', facts, context, status);
  const actual = (fact.body as Record<string, unknown>)[outcome.completion.field] as { kind?: unknown } | undefined;
  const derivedKind = actual?.kind === 'happened' ? 'accepted' : 'failed';
  ensure(actual && ['happened', 'did-not-happen', 'uncertain'].includes(String(actual.kind))
    && outcome.kind === derivedKind, 'loop result classification differs from signed Outcome');
  const expectedBinding = encoded([record.pressureKey, record.operationFamily, outcome.attempt]).hash;
  ensure((fact.body as { loopAttemptBinding?: unknown }).loopAttemptBinding === expectedBinding,
    'Outcome completion is not bound to this loop attempt and operation family');
  const signedClass = (fact.body as { loopFailureClass?: unknown }).loopFailureClass;
  const attemptFacts = allFacts(facts).filter(candidate => candidate.kind === sharedLoopRecordFactKind)
    .filter(candidate => {
      const stored = (candidate.body as { record?: unknown }).record;
      if (!isStoredSharedLoopRecord(stored)) return false;
      const candidateRecord = loadSharedLoopRecord(stored);
      return candidateRecord.pressureKey === record.pressureKey && candidateRecord.operationFamily === record.operationFamily
        && candidateRecord.attemptLog.some(attempt => attempt.id === outcome.attempt);
    });
  const witnessedAttempts = attemptFacts.filter(candidate => fact.predecessors.required.includes(candidate.id));
  ensure(witnessedAttempts.length > 0,
    'Outcome completion does not witness its admitted loop attempt');
  ensure(new Set(witnessedAttempts.map(candidate => {
    const admitted = loadSharedLoopRecord((candidate.body as { record: never }).record);
    return encoded([admitted.policy, admitted.policyGeneration]).bytes;
  })).size === 1, 'Outcome completion has conflicting admitted policy generations');
  const admitted = loadSharedLoopRecord((witnessedAttempts.at(-1)!.body as { record: never }).record);
  const expectedPolicy = encoded([admitted.policy.id, admitted.policyGeneration.id,
    admitted.policy.countedFailureClasses]).hash;
  ensure(typeof signedClass === 'string' && signedClass === outcome.failureClass
    && (derivedKind === 'failed' ? signedClass.length > 0 : signedClass.length === 0)
    && (fact.body as { loopFailurePolicy?: unknown }).loopFailurePolicy === expectedPolicy,
  'loop failure class is not witnessed under the admitted classification policy');
  ensure(encoded(outcome.observedAt).bytes === encoded(fact.at).bytes,
    'loop outcome ordering clock differs from signed completion evidence');
  return fact;
}
export function loopRecordCheck(r: LoopRecord): void {
  if (isSharedLoopRecord(r)) { sharedLoopRecordCheck(r); return; }
  shapeCheck(r, transportShapes.LoopRecord!);
  ensure(r.type === 'LoopRecord' && r.schemaVersion === 1, 'owned type mismatch');
  policyCheck(r.policy);
}
export function decodeLoopPolicy(input: unknown, c: BoundaryContext): Result<LoopPolicy> {
  const legacy = boundary('LoopPolicyInput', input, c, safe => { const p = safe as unknown as LoopPolicy; policyCheck(p); return freeze(p); });
  if (!isSharedLoopPolicy(input)) return legacy;
  return boundary('LoopPolicyInput', input, c, safe => {
    const p = safe as unknown as SharedLoopRecord['policy']; sharedPolicyCheck(p); return freeze(p);
  });
}
export function decodeLoopRecord(input: unknown, c: BoundaryContext): Result<LoopRecord> {
  const legacy = boundary('LoopRecordInput', input, c, safe => {
    const r = safe as unknown as LoopRecord; shapeCheck(r, transportShapes.LoopRecord!);
    ensure(r.type === 'LoopRecord' && r.schemaVersion === 1, 'owned type mismatch'); policyCheck(r.policy); return freeze(r);
  });
  if (!isSharedLoopRecord(input)) return legacy;
  return boundary('LoopRecordInput', input, c, safe => {
    const r = safe as unknown as SharedLoopRecord; sharedLoopRecordCheck(r); return freeze(r);
  });
}
export function decodeScanCursor(input: unknown, c: BoundaryContext): Result<ScanCursor> {
  return boundary('ScanCursorInput', input, c, safe => { const r = safe as unknown as ScanCursor; shapeCheck(r, transportShapes.ScanCursor!); return freeze(r); });
}
export function rows(facts: readonly FactEnvelope[], domain: string): TransportFact[] {
  return facts.filter(f => recordNames.some(n => f.kind === kindFor(n)) || f.kind === sharedLoopRecordFactKind).map(fact => ({ fact,
    record: fact.kind === sharedLoopRecordFactKind
      ? loadSharedLoopRecord((fact.body as { readonly record: Json }).record as never)
      : (fact.body as { readonly record: Json }).record as unknown as TransportRecord,
  })).filter(f => f.record.domain === domain);
}
export function latestLease(all: readonly TransportFact[]): TransportFact & { readonly record: Lease } | undefined {
  return all.filter((v): v is TransportFact & { record: Lease } => v.record.type === 'Lease').at(-1);
}
export function latestLoop(all: readonly TransportFact[], run: string): LoopRecord | undefined {
  let loop: LoopRecord | undefined;
  for (const { record: r } of all) {
    if (r.type === 'LoopRecord' && r.run === run) loop = r;
    // A matching durable result is the completion/release of an active wake,
    // not the passage of time or the creation of another API object.
    if (r.type === 'RecoveryRecord' && loop && loop.command === `${r.command}:wake`)
      loop = freeze({ ...loop, state: r.disposition === 'waiting' ? 'waiting' : 'stopped' });
  }
  return loop;
}
export function latestSharedLoop(all: readonly TransportFact[], pressureKey: string): SharedLoopRecord | undefined {
  const record = all.filter(row => row.record.type === 'LoopRecord' && row.record.policy.breaker === 'shared-circuit-v1'
    && (row.record as SharedLoopRecord).pressureKey === pressureKey).at(-1)?.record;
  return record?.type === 'LoopRecord' && record.policy.breaker === 'shared-circuit-v1' ? record as SharedLoopRecord : undefined;
}
const loopTickets = new WeakMap<TransportHost, Set<string>>();
export function withSharedLoopCandidate<T>(host: TransportHost, record: SharedLoopRecord, run: () => T): T {
  const key = encoded(record).hash, set = loopTickets.get(host) ?? new Set<string>(); loopTickets.set(host, set);
  ensure(!set.has(key), 'shared loop candidate already active'); set.add(key);
  try { return run(); } finally { set.delete(key); }
}
function requireSharedLoopCandidate(host: TransportHost, record: SharedLoopRecord): void {
  ensure(loopTickets.get(host)?.has(encoded(record).hash), 'shared loop transition requires its conditional writer');
}
const sameClock = (left: Clock, right: Clock) => left.subject.kind === right.subject.kind
  && left.subject.instance === right.subject.instance && left.unit === right.unit;
const atOrAfter = (left: Clock, right: Clock) => sameClock(left, right) && left.value >= right.value;
const shifted = (base: Clock, delta: number): Clock => freeze({ ...base, value: base.value + delta,
  at: base.at + delta } as unknown as Clock);
const compareBytes = (left: string, right: string) => Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
const sortedOutcomes = (outcomes: readonly SharedLoopRecord['outcomeLog'][number][]) => [...outcomes].sort((a, b) =>
  a.observedAt.value - b.observedAt.value || compareBytes(encoded(a.sourceVector).bytes, encoded(b.sourceVector).bytes)
    || compareBytes(a.attempt, b.attempt));
const windowAt = (record: Pick<SharedLoopRecord, 'policy' | 'outcomeLog'>, now: Clock) => sortedOutcomes(record.outcomeLog
  .filter(outcome => sameClock(outcome.observedAt, now) && outcome.observedAt.value > now.value - record.policy.acceptedOutcomeWindow));
const failureCountAt = (policy: SharedLoopRecord['policy'], outcomes: readonly SharedLoopRecord['outcomeLog'][number][]) => {
  let count = 0;
  for (const outcome of outcomes) count = outcome.kind === 'accepted' ? 0
    : policy.countedFailureClasses.includes(outcome.failureClass) ? count + 1 : count;
  return count;
};
const rollingAt = (record: Pick<SharedLoopRecord, 'policy' | 'attemptLog'>, now: Clock) => {
  const attempts = record.attemptLog.filter(attempt => sameClock(attempt.admittedAt, now)
    && attempt.admittedAt.value > now.value - record.policy.budgetWindow);
  return { rollingAttempts: attempts.length, rollingResource: attempts.reduce((sum, attempt) => sum + attempt.resource, 0) };
};
const parentRollingAt = (all: readonly TransportFact[], record: SharedLoopRecord, now: Clock,
  added?: LoopAttempt) => {
  const latest = new Map<string, SharedLoopRecord>();
  for (const row of all) if (row.record.type === 'LoopRecord' && row.record.policy.breaker === 'shared-circuit-v1') {
    const loop = row.record as SharedLoopRecord;
    if (loop.parentDuty.id === record.parentDuty.id) latest.set(loop.pressureKey, loop);
  }
  const attempts = new Map<string, LoopAttempt>();
  for (const loop of latest.values()) for (const attempt of loop.attemptLog) {
    const old = attempts.get(attempt.id);
    ensure(!old || encoded(old).bytes === encoded(attempt).bytes, 'parent attempt identity is conflicted across pressure scopes');
    attempts.set(attempt.id, attempt);
  }
  if (added) {
    const old = attempts.get(added.id);
    ensure(!old, 'parent attempt identity already belongs to another pressure scope');
    attempts.set(added.id, added);
  }
  ensure([...attempts.values()].every(attempt => sameClock(attempt.admittedAt, now)),
    'parent budget contains an incomparable attempt clock');
  return rollingAt({ policy: record.policy, attemptLog: [...attempts.values()] }, now);
};
export function validateSharedParentPolicy(record: Pick<SharedLoopRecord, 'parentDuty' | 'policy'>,
  all: readonly TransportFact[]): void {
  ensure(all.filter(row => row.record.type === 'LoopRecord' && row.record.policy.breaker === 'shared-circuit-v1')
    .filter(row => (row.record as SharedLoopRecord).parentDuty.id === record.parentDuty.id)
    .every(row => encoded((row.record as SharedLoopRecord).policy).bytes === encoded(record.policy).bytes),
  'conflicting parent pressure policy');
}
export function sharedAdmissionDecision(previous: SharedLoopRecord, all: readonly TransportFact[], now: Clock,
  input: Omit<LoopAttempt, 'mode'>): Readonly<{
    kind: 'stopped';
  } | {
    kind: 'admitted'; attempt: LoopAttempt; state: SharedLoopRecord['state']; transition: SharedLoopRecord['transition'];
    halfOpenAdmitted: number; halfOpenSucceeded: number; rollingAttempts: number; rollingResource: number;
  }> {
  validateSharedParentPolicy(previous, all);
  ensure(previous.clockBasis === now.subject.instance && atOrAfter(now, previous.transitionAt),
    'incomparable or backward shared pressure time');
  ensure(input.episode === previous.episode, 'attempt episode differs from the governed loop episode');
  ensure(previous.state !== 'stopped' && previous.state !== 'closed', 'loop episode is terminal');
  const unfinished = previous.attemptLog.filter(attempt => !previous.outcomeLog.some(outcome => outcome.attempt === attempt.id))
    .map(attempt => attempt.id);
  ensure(encoded(previous.pendingAttempts).bytes === encoded(unfinished).bytes, 'incomplete attempt population');
  const episodeExhausted = previous.episodeAttempts >= previous.policy.maxAttempts
    || now.value - previous.started >= previous.policy.maxDuration;
  const openExhausted = (previous.state === 'open-breaker' || previous.state === 'half-open')
    && previous.breakerHasOpened === 1 && now.value - previous.breakerFirstOpened.value > previous.policy.maxOpenDuration;
  if (episodeExhausted || openExhausted) {
    ensure(previous.pendingAttempts.length === 0, 'unfinished attempts retain loop ownership at the bound');
    return freeze({ kind: 'stopped' as const });
  }
  ensure(atOrAfter(now, previous.nextEligible), 'breaker cooldown or wake is not eligible');
  let mode: LoopAttempt['mode'] = 'closed';
  let state: SharedLoopRecord['state'] = 'running';
  let transition: SharedLoopRecord['transition'] = 'attempt-admitted';
  let halfOpenAdmitted = previous.halfOpenAdmitted;
  let halfOpenSucceeded = previous.halfOpenSucceeded;
  if (previous.state === 'open-breaker' || previous.state === 'half-open') {
    ensure(previous.breakerHasOpened === 1, 'breaker-open history is incomplete');
    mode = 'half-open'; state = 'half-open';
    if (previous.state === 'open-breaker') {
      ensure(previous.pendingAttempts.length === 0, 'unfinished attempts retain breaker ownership');
      transition = 'half-opened'; halfOpenAdmitted = 0; halfOpenSucceeded = 0;
    }
    ensure(halfOpenAdmitted < previous.policy.halfOpenTrials
      && previous.pendingAttempts.length < previous.policy.halfOpenConcurrency
      && previous.pendingAttempts.length < previous.policy.concurrency,
    'half-open trial bound exhausted');
    halfOpenAdmitted++;
  } else ensure(previous.pendingAttempts.length < previous.policy.concurrency, 'concurrent work cap exhausted');
  const attempt = freeze({ ...input, mode } as LoopAttempt);
  const rolling = parentRollingAt(all, previous, now, attempt);
  ensure(rolling.rollingAttempts <= previous.policy.parentAttemptBudget
    && rolling.rollingResource <= previous.policy.parentResourceBudget,
  'shared parent budget exhausted');
  return freeze({ kind: 'admitted' as const, attempt, state, transition, halfOpenAdmitted,
    halfOpenSucceeded, ...rolling });
}
export function sharedOutcomeDecision(previous: SharedLoopRecord, all: readonly TransportFact[],
  added: LoopOutcome, receiptAt: Clock,
  completeRestoration: ReadonlyArray<SharedLoopRecord['closureEvidence'][number]> = added.restoration): Readonly<Pick<SharedLoopRecord, 'state' | 'transition' | 'nextEligible'
  | 'totalFailures' | 'failureCount' | 'rollingAttempts' | 'rollingResource' | 'breakerHasOpened'
  | 'breakerOpenCount' | 'breakerFirstOpened' | 'halfOpenAdmitted' | 'halfOpenSucceeded'
  | 'pendingAttempts' | 'outcomeLog' | 'outcomeWindowDigest' | 'closureEvidence'>> {
  const policy = previous.policy;
  const outcomeLog = sortedOutcomes([...previous.outcomeLog, added]);
  const pendingAttempts = previous.pendingAttempts.filter(value => value !== added.attempt);
  const outcomes = windowAt({ policy, outcomeLog }, receiptAt);
  const failureCount = failureCountAt(policy, outcomes);
  const counted = added.kind === 'failed' && policy.countedFailureClasses.includes(added.failureClass);
  let state: SharedLoopRecord['state'];
  let transition: SharedLoopRecord['transition'] = 'outcome-recorded';
  let nextEligible = receiptAt;
  let breakerHasOpened = previous.breakerHasOpened;
  let breakerOpenCount = previous.breakerOpenCount;
  let breakerFirstOpened = previous.breakerFirstOpened;
  let halfOpenAdmitted = previous.halfOpenAdmitted;
  let halfOpenSucceeded = previous.halfOpenSucceeded;
  let closureEvidence = previous.closureEvidence;
  const attempt = previous.attemptLog.find(value => value.id === added.attempt)!;
  if (previous.state === 'open-breaker') {
    state = 'open-breaker'; nextEligible = previous.nextEligible;
  } else if (attempt.mode === 'half-open' && counted) {
    state = 'open-breaker'; transition = 'reopened'; nextEligible = shifted(added.observedAt, policy.breakerCooldown);
    breakerOpenCount++;
    if (breakerHasOpened === 0) { breakerHasOpened = 1; breakerFirstOpened = added.observedAt; }
    halfOpenAdmitted = 0; halfOpenSucceeded = 0;
  } else if (attempt.mode === 'half-open') {
    halfOpenSucceeded += added.kind === 'accepted' ? 1 : 0;
    closureEvidence = freeze([...new Map([...closureEvidence, ...completeRestoration].map(value => [value.id, value])).values()]);
    if (halfOpenSucceeded >= policy.halfOpenTrials && pendingAttempts.length === 0 && closureEvidence.length > 0) {
      state = 'closed'; transition = 'closed'; nextEligible = receiptAt;
    } else state = 'half-open';
  } else if (failureCount >= policy.failureThreshold) {
    state = 'open-breaker'; transition = 'opened'; nextEligible = shifted(added.observedAt, policy.breakerCooldown);
    breakerOpenCount++;
    // This is a new uninterrupted open interval. Cumulative counters survive a
    // witnessed close, but time spent healthy between cycles is not open time.
    breakerHasOpened = 1; breakerFirstOpened = added.observedAt;
  } else if (pendingAttempts.length > 0) state = 'running';
  else {
    state = 'waiting';
    const exponent = Math.min(failureCount, 53), base = Math.min(policy.maxDelay,
      policy.initialDelay * Math.pow(policy.backoffMultiplier, exponent));
    const delay = Math.max(policy.minDelay,
      Math.min(policy.maxDelay, Math.floor(base * added.jitterPermille / 1000)));
    nextEligible = shifted(receiptAt, delay);
  }
  const rolling = parentRollingAt(all, previous, receiptAt);
  return freeze({ state, transition, nextEligible, totalFailures: previous.totalFailures + (counted ? 1 : 0),
    failureCount, ...rolling, breakerHasOpened, breakerOpenCount, breakerFirstOpened, halfOpenAdmitted,
    halfOpenSucceeded, pendingAttempts, outcomeLog, outcomeWindowDigest: encoded(windowAt({ policy, outcomeLog }, receiptAt)).hash,
    closureEvidence });
}
function exactPrefix<T>(prior: readonly T[], next: readonly T[]): boolean {
  return prior.every((value, index) => encoded(value as never).bytes === encoded(next[index] as never).bytes);
}
function validateSharedLoopHistory(record: SharedLoopRecord, all: readonly TransportFact[], host: TransportHost,
  origin: boolean, evidenceFacts?: readonly FactEnvelope[], context?: FactContext): void {
  loopRecordCheck(record);
  validateSharedParentPolicy(record, all);
  const previous = latestSharedLoop(all, record.pressureKey);
  if (origin) requireSharedLoopCandidate(host, record);
  if (!previous) {
    const parentRolling = parentRollingAt(all, record, record.transitionAt);
    const firstEligible = shifted(record.transitionAt, record.policy.initialDelay);
    ensure(record.transition === 'scheduled' && record.state === 'scheduled' && record.attempts === 0
      && record.started === record.transitionAt.value && record.nextWake === firstEligible.value
      && encoded(record.nextEligible).bytes === encoded(firstEligible).bytes
      && record.episodeAttempts === 0 && record.totalFailures === 0 && record.failureCount === 0
      && record.rollingAttempts === parentRolling.rollingAttempts
      && record.rollingResource === parentRolling.rollingResource && record.breakerHasOpened === 0
      && record.breakerOpenCount === 0
      && encoded(record.breakerFirstOpened).bytes === encoded(record.transitionAt).bytes
      && record.halfOpenAdmitted === 0 && record.halfOpenSucceeded === 0
      && record.pendingAttempts.length === 0 && record.attemptLog.length === 0 && record.outcomeLog.length === 0
      && record.outcomeWindowDigest === encoded([]).hash && record.closureEvidence.length === 0,
    'initial shared loop counters must be empty');
    return;
  }
  ensure(encoded(previous.policy).bytes === encoded(record.policy).bytes
    && encoded(previous.parentDuty).bytes === encoded(record.parentDuty).bytes
    && previous.operationFamily === record.operationFamily
    && encoded(previous.pressureScope).bytes === encoded(record.pressureScope).bytes
    && previous.clockBasis === record.clockBasis, 'shared pressure policy or clock changed');
  if (record.transition === 'scheduled') {
    const firstEligible = shifted(record.transitionAt, record.policy.initialDelay);
    const currentOutcomes = windowAt(record, record.transitionAt);
    const parentRolling = parentRollingAt(all, record, record.transitionAt);
    ensure((previous.state === 'closed' || previous.state === 'stopped' && previous.failureCount < previous.policy.failureThreshold)
      && previous.pendingAttempts.length === 0 && previous.episode !== record.episode
      && record.state === 'scheduled' && record.started === record.transitionAt.value
      && record.nextWake === firstEligible.value && encoded(record.nextEligible).bytes === encoded(firstEligible).bytes
      && record.run === record.currentOwnerRun.id
      && record.attempts === previous.attempts && record.totalFailures === previous.totalFailures
      && encoded(record.attemptLog).bytes === encoded(previous.attemptLog).bytes
      && encoded(record.outcomeLog).bytes === encoded(previous.outcomeLog).bytes
      && record.breakerOpenCount === previous.breakerOpenCount
      && record.breakerHasOpened === previous.breakerHasOpened
      && encoded(record.breakerFirstOpened).bytes === encoded(previous.breakerFirstOpened).bytes
      && record.failureCount === failureCountAt(record.policy, currentOutcomes)
      && record.rollingAttempts === parentRolling.rollingAttempts
      && record.rollingResource === parentRolling.rollingResource
      && record.outcomeWindowDigest === encoded(currentOutcomes).hash
      && record.closureEvidence.length === 0
      && record.episodeAttempts === 0 && record.pendingAttempts.length === 0
      && record.halfOpenAdmitted === 0 && record.halfOpenSucceeded === 0,
    'new episode reset shared pressure or replaced an active episode');
    ensure(atOrAfter(record.transitionAt, previous.transitionAt), 'shared loop clock moved backward');
    return;
  }
  ensure(previous.episode === record.episode && previous.episodeKey === record.episodeKey
    && previous.started === record.started && encoded(previous.currentOwnerRun).bytes === encoded(record.currentOwnerRun).bytes,
  'shared episode identity or current owner changed');
  ensure(atOrAfter(record.transitionAt, previous.transitionAt), 'shared loop clock moved backward');
  ensure(record.attempts >= previous.attempts && record.totalFailures >= previous.totalFailures
    && record.episodeAttempts >= previous.episodeAttempts && record.breakerOpenCount >= previous.breakerOpenCount
    && exactPrefix(previous.attemptLog, record.attemptLog)
    && previous.outcomeLog.every(value => record.outcomeLog.some(next => encoded(next).bytes === encoded(value).bytes)),
  'shared pressure history reset or changed');
  ensure(previous.state !== 'stopped' && previous.state !== 'closed', 'terminal loop episode cannot transition');
  const unchangedAttempts = encoded(record.attemptLog).bytes === encoded(previous.attemptLog).bytes;
  const unchangedOutcomes = encoded(record.outcomeLog).bytes === encoded(previous.outcomeLog).bytes;
  if (record.transition === 'stopped') {
    const currentOutcomes = windowAt(previous, record.transitionAt);
    const parentRolling = parentRollingAt(all, previous, record.transitionAt);
    ensure(unchangedAttempts && unchangedOutcomes && previous.pendingAttempts.length === 0
      && record.pendingAttempts.length === 0 && record.attempts === previous.attempts
      && record.episodeAttempts === previous.episodeAttempts && record.totalFailures === previous.totalFailures
      && record.state === 'stopped' && (previous.episodeAttempts >= record.policy.maxAttempts
        || record.transitionAt.value - previous.started >= record.policy.maxDuration
        || (previous.state === 'open-breaker' || previous.state === 'half-open')
          && previous.breakerHasOpened === 1
          && record.transitionAt.value - previous.breakerFirstOpened.value > record.policy.maxOpenDuration),
    'stopped transition lacks an exhausted bound');
    const expected = freeze({ ...previous,
      schemaVersion: record.schemaVersion, domain: record.domain, command: record.command,
      predecessor: record.predecessor, authority: record.authority, tick: record.tick,
      nextWake: record.transitionAt.value, state: 'stopped' as const, pending: '',
      transition: 'stopped' as const, transitionAt: record.transitionAt,
      nextEligible: record.transitionAt, sourceVector: previous.sourceVector,
      failureCount: failureCountAt(record.policy, currentOutcomes),
      rollingAttempts: parentRolling.rollingAttempts, rollingResource: parentRolling.rollingResource,
      outcomeWindowDigest: encoded(currentOutcomes).hash,
    } as SharedLoopRecord);
    ensure(encoded(record).bytes === encoded(expected).bytes,
      'stopped transition differs from the complete policy and parent-budget calculation');
    return;
  }
  if (record.transition === 'attempt-admitted' || record.transition === 'half-opened') {
    ensure(record.attemptLog.length === previous.attemptLog.length + 1 && unchangedOutcomes
      && record.outcomeLog.length === previous.outcomeLog.length && record.episodeAttempts === previous.episodeAttempts + 1
      && record.totalFailures === previous.totalFailures, 'attempt admission invented another history change');
    const attempt = record.attemptLog.at(-1)!;
    ensure(encoded(attempt.admittedAt).bytes === encoded(record.transitionAt).bytes
      && encoded(attempt.sourceVector).bytes === encoded(record.sourceVector).bytes
      && encoded(record.pendingAttempts).bytes === encoded([...previous.pendingAttempts, attempt.id]).bytes,
    'attempt admission population or clock differs');
    const { mode: _mode, ...input } = attempt;
    const decision = sharedAdmissionDecision(previous, all, record.transitionAt, input);
    ensure(decision.kind === 'admitted',
      'attempt admission differs from the complete policy and parent-budget calculation');
    const currentOutcomes = windowAt(previous, record.transitionAt);
    const expected = freeze({ ...previous,
      schemaVersion: record.schemaVersion, domain: record.domain, command: record.command,
      predecessor: record.predecessor, authority: record.authority, tick: record.tick,
      attempts: previous.attempts + 1, episodeAttempts: previous.episodeAttempts + 1,
      nextWake: record.transitionAt.value, state: decision.state,
      pending: [...previous.pendingAttempts, decision.attempt.id][0]!, transition: decision.transition,
      transitionAt: record.transitionAt, nextEligible: record.transitionAt,
      sourceVector: previous.sourceVector,
      failureCount: failureCountAt(record.policy, currentOutcomes),
      rollingAttempts: decision.rollingAttempts, rollingResource: decision.rollingResource,
      halfOpenAdmitted: decision.halfOpenAdmitted, halfOpenSucceeded: decision.halfOpenSucceeded,
      pendingAttempts: [...previous.pendingAttempts, decision.attempt.id],
      attemptLog: [...previous.attemptLog, decision.attempt],
      outcomeWindowDigest: encoded(currentOutcomes).hash,
    } as SharedLoopRecord);
    ensure(encoded(record).bytes === encoded(expected).bytes,
      'attempt admission differs from the complete policy and parent-budget calculation');
    return;
  }
  if (record.transition === 'closed' && unchangedAttempts && unchangedOutcomes) {
    ensure(previous.state === 'half-open' && previous.pendingAttempts.length === 0
      && previous.halfOpenSucceeded >= previous.policy.halfOpenTrials
      && exactPrefix(previous.closureEvidence, record.closureEvidence)
      && record.closureEvidence.length > previous.closureEvidence.length,
    'evidence-only closure lacks completed trials or new restoration support');
    const currentOutcomes = windowAt(previous, record.transitionAt);
    const parentRolling = parentRollingAt(all, previous, record.transitionAt);
    const expected = freeze({ ...previous,
      schemaVersion: record.schemaVersion, domain: record.domain, command: record.command,
      predecessor: record.predecessor, authority: record.authority, tick: record.tick,
      nextWake: record.transitionAt.value, state: 'closed' as const, pending: '', transition: 'closed' as const,
      transitionAt: record.transitionAt, nextEligible: record.transitionAt, sourceVector: previous.sourceVector,
      policyGeneration: record.policyGeneration, closureEvidence: record.closureEvidence,
      failureCount: failureCountAt(record.policy, currentOutcomes),
      rollingAttempts: parentRolling.rollingAttempts, rollingResource: parentRolling.rollingResource,
      outcomeWindowDigest: encoded(currentOutcomes).hash,
    } as SharedLoopRecord);
    ensure(encoded(record).bytes === encoded(expected).bytes,
      'evidence-only closure changed the recorded completion or breaker history');
    return;
  }
  ensure(record.outcomeLog.length === previous.outcomeLog.length + 1 && unchangedAttempts,
    'outcome transition must add exactly one witnessed completion');
  const added = record.outcomeLog.find(outcome => !previous.outcomeLog.some(old => old.attempt === outcome.attempt));
  ensure(added && previous.pendingAttempts.includes(added.attempt), 'outcome completion was not pending');
  const attempt = previous.attemptLog.find(value => value.id === added.attempt)!;
  ensure(encoded(added.sourceVector).bytes === encoded(attempt.sourceVector).bytes,
    'outcome frontier differs from its admitted attempt');
  ensure(atOrAfter(added.observedAt, attempt.admittedAt) && atOrAfter(record.transitionAt, added.observedAt),
    'outcome evidence or receipt clock precedes its admission');
  ensure(encoded(record.outcomeLog).bytes === encoded(sortedOutcomes(record.outcomeLog)).bytes,
    'outcome population is not canonically ordered');
  ensure(encoded(record.pendingAttempts).bytes === encoded(previous.pendingAttempts.filter(id => id !== added.attempt)).bytes,
    'outcome changed the pending population');
  const completeRestoration = evidenceFacts && context
    ? added.restoration.filter(reference => restorationReferenceComplete(reference, evidenceFacts, context,
      record.transitionAt, record.pressureKey, record.operationFamily, host, false))
    : added.restoration.filter(reference => record.closureEvidence.some(value => value.id === reference.id));
  const expected = sharedOutcomeDecision(previous, all, added, record.transitionAt, completeRestoration);
  const successor = freeze({ ...previous,
    schemaVersion: record.schemaVersion, domain: record.domain, command: record.command,
    predecessor: record.predecessor, authority: record.authority, tick: record.tick,
    nextWake: expected.nextEligible.value, state: expected.state,
    pending: expected.pendingAttempts[0] ?? '', transition: expected.transition,
    transitionAt: record.transitionAt, nextEligible: expected.nextEligible,
    sourceVector: previous.sourceVector, policyGeneration: record.policyGeneration,
    totalFailures: expected.totalFailures, failureCount: expected.failureCount,
    rollingAttempts: expected.rollingAttempts, rollingResource: expected.rollingResource,
    breakerHasOpened: expected.breakerHasOpened, breakerOpenCount: expected.breakerOpenCount,
    breakerFirstOpened: expected.breakerFirstOpened, halfOpenAdmitted: expected.halfOpenAdmitted,
    halfOpenSucceeded: expected.halfOpenSucceeded, pendingAttempts: expected.pendingAttempts,
    outcomeLog: expected.outcomeLog, outcomeWindowDigest: expected.outcomeWindowDigest,
    closureEvidence: expected.closureEvidence,
  } as SharedLoopRecord);
  ensure(encoded(record).bytes === encoded(successor).bytes,
    'breaker decision differs from the complete admitted outcome frontier');
}
export function loopActive(all: readonly TransportFact[], loop: LoopRecord): boolean {
  return ['running', 'restoring', 'waiting'].includes(loop.state)
    && !all.some(({ record: r }) => r.type === 'RecoveryRecord' && loop.command === `${r.command}:wake`);
}
export function observationAdmission(loop: LoopRecord, tick: number, authority: string): 'ordinary' | 'restored' | 'none' {
  if (loop.attempts >= loop.policy.maxAttempts || loop.policy.maxDuration === 0) return 'none';
  // Separate, one-shot read-only allowance when the old duration clock is
  // suspect. Its committed state is restoring and its result stops the loop.
  if (authority !== loop.authority) return 'restored';
  return tick - loop.started < loop.policy.maxDuration ? 'ordinary' : 'none';
}
export function reservations(all: readonly TransportFact[]): AdmissionReservation[] {
  const ops = new Map<string, AdmissionReservation>();
  for (const { record: r } of all) if (r.type === 'AdmissionReservation') ops.set(r.operation, r);
  return [...ops.values()];
}
export function resolveSharedLoopAdmission(all: readonly TransportFact[], run: string,
  attemptId: string, resourceDemand: number): TransportFact | undefined {
  const governed = all.filter(row => row.record.type === 'LoopRecord'
    && row.record.policy.breaker === 'shared-circuit-v1'
    && (row.record as SharedLoopRecord).currentOwnerRun.id === run) as readonly (TransportFact & { record: SharedLoopRecord })[];
  if (governed.length === 0) return undefined;
  const admissions = governed.filter(row => ['attempt-admitted', 'half-opened'].includes(row.record.transition)
    && row.record.attemptLog.at(-1)?.id === attemptId);
  ensure(admissions.length > 0, 'executable reservation lacks an admitted shared loop attempt');
  ensure(new Set(admissions.map(row => encoded(row.record.attemptLog.at(-1)!).bytes)).size === 1
    && new Set(admissions.map(row => row.record.pressureKey)).size === 1,
  'executable reservation attempt is conflicted across governed pressure');
  const admission = admissions.at(-1)!;
  const latest = latestSharedLoop(all, admission.record.pressureKey);
  ensure(latest && latest.episode === admission.record.episode
    && latest.currentOwnerRun.id === run
    && !['stopped', 'closed'].includes(latest.state)
    && latest.pendingAttempts.includes(attemptId)
    && latest.attemptLog.some(attempt => attempt.id === attemptId
      && encoded(attempt).bytes === encoded(admission.record.attemptLog.at(-1)!).bytes),
  'shared loop attempt is no longer executable');
  const admitted = admission.record.attemptLog.at(-1)!;
  ensure(resourceDemand <= admitted.resource,
    'executable reservation exceeds its admitted shared loop resource');
  return admission;
}
export function latestScanCursor(all: readonly TransportFact[], scan: string): (TransportFact & { readonly record: ScanCursor }) | undefined {
  return all.filter((v): v is TransportFact & { readonly record: ScanCursor } => v.record.type === 'ScanCursor' && v.record.scan === scan).at(-1);
}
function completedScanRound(all: readonly TransportFact[], scan: string): boolean {
  let orderedKeysDigest: string | undefined;
  let keyCount: number | undefined;
  let completed = false;
  for (const { record } of all) {
    if (record.type !== 'ScanCursor' || record.scan !== scan) continue;
    if (record.orderedKeysDigest !== orderedKeysDigest || record.keyCount !== keyCount) {
      orderedKeysDigest = record.orderedKeysDigest;
      keyCount = record.keyCount;
      completed = record.keyCount === 0;
    }
    // A zero-work page does not undo a completed round for the same key
    // identity. Positive work either completes at zero or starts/leaves a new
    // unfinished round, so its durable cursor replaces the accumulated state.
    if (record.selectedCount > 0) completed = record.wrapped === 1 && record.nextIndex === 0;
  }
  return completed;
}
export function validateScanGeneration(all: readonly TransportFact[], scan: string, generation: string,
  orderedKeysDigest: string, keyCount: number): void {
  const prior = latestScanCursor(all, scan);
  const original = all.find((v): v is TransportFact & { readonly record: ScanCursor } =>
    v.record.type === 'ScanCursor' && v.record.scan === scan && v.record.generation === generation);
  if (original) ensure(original.record.orderedKeysDigest === orderedKeysDigest && original.record.keyCount === keyCount,
    'scan generation changed its original ordered keys');
  if (!prior || prior.record.generation === generation) return;
  ensure(!original, 'scan generation cannot resume after supersession');
  const sameKeys = prior.record.orderedKeysDigest === orderedKeysDigest && prior.record.keyCount === keyCount;
  ensure(sameKeys || completedScanRound(all, scan),
    'scan generation change is unsupported while key remainder is unfinished');
}
export function fenceFor(all: readonly TransportFact[], lease: Lease): FenceToken {
  const assignment = all.find(v => v.record.type === 'Lease' && v.record.epoch === lease.epoch);
  ensure(assignment, 'missing committed assignment');
  return freeze({ type: 'FenceToken', schemaVersion: 1, domain: lease.domain, epoch: lease.epoch,
    assignment: assignment.fact.id, holder: lease.holder, machine: lease.machine,
    incarnation: lease.incarnation, authority: lease.authority, generation: lease.generation } as FenceToken);
}
export function checkFence(all: readonly TransportFact[], token: FenceToken, host: TransportHost, tick: number): Lease {
  shapeCheck(token, fence);
  const lease = latestLease(all)?.record;
  ensure(lease && lease.state === 'held' && lease.expires > tick, 'lease absent, released or expired');
  ensure(lease.authority === host.authorityIncarnation, 'restored timer is not current authority');
  ensure(lease.holder === host.principal.id && lease.machine === host.machine && lease.incarnation === host.incarnation,
    'fence principal or process incarnation mismatch');
  ensure(encoded(token).bytes === encoded(fenceFor(all, lease)).bytes, 'stale or uncommitted fence');
  ensure(lease.generation === host.current().generation.id, 'register generation moved');
  return lease;
}
export function live(host: TransportHost): void {
  const current = host.current();
  ensure(!current.stopped, 'stop prohibits new admission');
  ensure(current.generation.owner === 'part-three' && current.generation.name === 'RegisterGeneration'
    && current.generation.id === current.decode.register.generation.id, 'current generation mismatch');
  const principal = take(decode('VerifiedPrincipal', host.principal, { ...current.decode, provenance: host.principal.provenance }));
  const scope = take(decode('Scope', host.scope, current.decode));
  const now = take(decodeMeasurement('clock', current.clock, current.decode));
  const grants = (current.decode.grants ?? []).map(g => take(decode('StandingGrant', g, { ...current.decode, provenance: g.source })));
  ensure(grants.some(g => g.grantee.id === principal.id && grantLiveness(g, current.decode.revocations ?? [], now) === 'live'
    && scopeIncludes(g.scope, scope) && (g.standing === 'operator' || g.actions.includes('work'))), 'current standing does not cover transport admission');
}

// The owner validator runs INSIDE P2's append boundary, after signed-chain checks and
// before its compare-head durable append. A caller bypassing the authority API cannot
// rebase a stale transition on a newer envelope head.
export function validateTransition(r: TransportRowRecord, all: readonly TransportFact[], host: TransportHost,
  origin = false, evidenceFacts?: readonly FactEnvelope[], context?: FactContext): void {
  ensure(r.domain === host.domain && r.schemaVersion === 1 && r.command.length > 0 && r.tick >= 0, 'record domain or identity');
  ensure(r.predecessor === (all.at(-1)?.fact.id ?? ''), 'conditional predecessor changed');
  ensure(!all.some(v => v.record.command === r.command), 'command already committed');
  const previous = latestLease(all)?.record;
  const active = () => {
    ensure(previous, 'lease required');
    ensure(previous.state === 'held' && previous.authority === r.authority && previous.expires > r.tick, 'stale lease at boundary');
    return previous;
  };
  if (r.type === 'Lease') {
    ensure(r.epoch >= 1 && r.holder === host.principal.id && r.machine === host.machine && r.incarnation.length > 0 && r.generation.length > 0, 'lease binding');
    ensure(r.state === 'held' || r.state === 'released', 'lease state');
    ensure(['acquire', 'renew', 'release', 'write'].includes(r.operation)
      && ((r.operation === 'acquire' || r.operation === 'renew') ? r.term > 0 && r.expires === r.tick + r.term : r.term === 0), 'lease command binding');
    if (!previous || r.epoch !== previous.epoch) {
      ensure(r.state === 'held' && r.operation === 'acquire' && r.epoch === (previous?.epoch ?? 0) + 1, 'epoch must extend committed maximum');
      ensure(!previous || previous.state === 'released' || previous.authority !== r.authority || previous.expires <= r.tick, 'lease is still held');
    } else {
      const p = active();
      ensure(r.operation !== 'acquire' && (r.state === 'released') === (r.operation === 'release'), 'lease transition command');
      if (r.operation !== 'renew') ensure(r.expires === p.expires, 'write/release changed term');
      ensure(r.holder === p.holder && r.machine === p.machine && r.incarnation === p.incarnation && r.generation === p.generation, 'renew/release changed owner');
    }
    ensure(r.expires > r.tick && r.expires - r.tick <= host.maxLeaseTerm, 'lease term outside finite bound');
  } else if (r.type === 'ScanCursor') {
    ensure(r.scan.length > 0 && r.generation.length > 0 && /^sha256:[a-f0-9]{64}$/.test(r.orderedKeysDigest), 'scan cursor identity');
    ensure(r.keyCount >= 0 && r.selectedFrom >= 0 && r.selectedCount >= 0 && r.nextIndex >= 0
      && r.maxItems >= 0 && r.maxDuration >= 0 && r.elapsed >= 0, 'scan cursor bounds');
    ensure(r.selectedCount <= r.maxItems && r.selectedCount <= r.keyCount && r.elapsed <= r.maxDuration,
      'scan cursor exceeded page bound');
    ensure(r.maxDuration !== 0 || r.selectedCount === 0, 'zero-duration scan cannot select work');
    ensure(r.wrapped === 0 || r.wrapped === 1, 'scan cursor wrap marker');
    const prior = latestScanCursor(all, r.scan);
    ensure(r.previous === (prior?.fact.id ?? ''), 'scan cursor is absent or stale');
    ensure(r.selectedFrom === (prior?.record.nextIndex ?? 0), 'scan cursor progress reset or skipped');
    ensure(r.keyCount === 0 ? r.selectedFrom === 0 && r.nextIndex === 0 && r.selectedCount === 0 && r.wrapped === 0
      : r.selectedFrom < r.keyCount && r.nextIndex === (r.selectedFrom + r.selectedCount) % r.keyCount
        && r.wrapped === (r.selectedCount > 0 && r.selectedFrom + r.selectedCount >= r.keyCount ? 1 : 0),
    'scan cursor progression changed');
    validateScanGeneration(all, r.scan, r.generation, r.orderedKeysDigest, r.keyCount);
  } else {
    const lease = active();
    if (r.type === 'AdmissionReservation') {
      // A conditional close exists BECAUSE the reserving fence is gone; it keeps
      // the immutable original fence and is still written under the live lease.
      ensure(r.state === 'closed' || encoded(r.fence).bytes === encoded(fenceFor(all, lease)).bytes, 'stale fence at durable boundary');
      ensure(r.charge >= 0 && r.request.length > 0 && r.attempt.length > 0 && /^sha256:[a-f0-9]{64}$/.test(r.digest), 'reservation identity or demand');
      ensure(r.operation === `operation:${encoded([r.domain, r.request, r.attempt]).hash}`, 'operation mapping must be injective');
      ensure(r.deliveryAttempt === `delivery:${encoded([r.operation, r.semanticMessage]).hash}`, 'delivery attempt identity changed');
      ensure((r.durability === 'local-durable' && r.replicas === 0) || (r.durability === 'replicated' && r.replicas > 0), 'effect durability requirement');
      const prior = reservations(all).find(p => p.operation === r.operation);
      if (!prior) {
        ensure(r.state === 'prepared' && r.executor === '', 'reservation must precede claim');
        resolveSharedLoopAdmission(all, r.run, r.attempt, r.charge);
        // Inhibition is sticky until an owned governed reconciliation exists.
        // Different request/attempt/semantic keys cannot erase a same-run breach.
        ensure(!reservations(all).some(p => p.run === r.run && all.some(v => v.record.type === 'SettlementApplication'
          && v.record.operation === p.operation && v.record.capViolation === 1)), 'cap violation inhibits affected admission');
        // A closed operation is proven never dispatch-claimed: zero exposure and
        // resolved. Every other state still needs qualified accounting evidence.
        const states = new Map(reservations(all).map(p => [p.operation, p.state === 'closed' ? { exposure: 0, unresolved: 0 }
          : origin ? admissionAccounting(all, p, host)
          : latestApplication(all, p.operation) ?? { exposure: p.charge, unresolved: 1 }]));
        ensure(!reservations(all).some(p => p.request === r.request || p.semanticMessage === r.semanticMessage
          || p.run === r.run && states.get(p.operation)!.unresolved !== 0), 'unresolved execution or charge prohibits a new attempt; unproven accounting durability is unresolved');
        ensure(reservations(all).reduce((n, p) => n + states.get(p.operation)!.exposure, r.charge) <= host.budget, 'spend bound exhausted');
        const loop = latestLoop(all, r.run); ensure(loop && loop.state !== 'stopped', 'durable recovery wake required before reservation');
      } else {
        const immutable = (v: AdmissionReservation) => ({ ...v, command: '', predecessor: '', tick: 0, authority: '', state: '', executor: '' });
        ensure(encoded(immutable(r)).bytes === encoded(immutable(prior)).bytes, 'immutable operation mapping changed');
        if (r.state === 'closed') {
          // Proof, not assumption: no row for this operation ever left 'prepared'
          // anywhere in the committed prefix. A close is terminal and unexecuted.
          ensure(prior.state === 'prepared' && !all.some(v => v.record.type === 'AdmissionReservation'
            && v.record.operation === r.operation && v.record.state !== 'prepared'), 'close requires proof no dispatch-claim exists');
          ensure(r.executor === '', 'a closed operation has no executor');
        } else {
          resolveSharedLoopAdmission(all, r.run, r.attempt, r.charge);
          ensure((prior.state === 'prepared' && r.state === 'dispatch-claimed') || (prior.state === 'dispatch-claimed' && r.state === 'consumed'), 'claim is one-use');
          ensure(r.executor === lease.incarnation && (prior.executor === '' || prior.executor === r.executor), 'executor binding mismatch');
        }
      }
    } else if (r.type === 'LoopRecord') {
      if (isSharedLoopRecord(r))
        validateSharedLoopHistory(r, all, host, origin, evidenceFacts, context);
      else {
        policyCheck(r.policy);
        ensure(r.run.length > 0 && r.episode === `loop:${encoded([r.domain, r.run]).hash}`, 'stable loop episode');
        ensure(['scheduled', 'running', 'restoring', 'waiting', 'stopped'].includes(r.state) && r.attempts >= 0 && r.attempts <= r.policy.maxAttempts, 'loop state or count');
        const prior = latestLoop(all, r.run);
        if (!prior) {
          ensure(!all.some(p => p.record.type === 'LoopRecord'), 'slice supports one run only');
          ensure(r.attempts === 0 && r.started === r.tick && r.pending === '' && r.state === 'scheduled', 'initial loop');
        }
        else {
          ensure(prior.state !== 'stopped', 'stopped is terminal, not closed or restartable');
          ensure(!loopActive(all, prior), 'observation already active; durable completion required');
          ensure(encoded(r.policy).bytes === encoded(prior.policy).bytes && r.started === prior.started && r.episode === prior.episode, 'loop bounds cannot reset');
          const admission = observationAdmission(prior, r.tick, r.authority);
          ensure(r.attempts === prior.attempts + (admission === 'none' ? 0 : 1), 'loop attempts cannot reset or skip');
          ensure(r.authority !== prior.authority || r.tick >= prior.nextWake, 'wake not due');
          ensure(admission === 'none' ? r.state === 'stopped' : admission === 'restored' ? r.state === 'restoring'
            : r.state === 'running' || r.state === 'waiting', 'loop duration/attempt admission mismatch');
        }
        ensure(r.nextWake >= r.tick + r.policy.minDelay, 'minimum wake delay');
      }
    } else if (r.type === 'SettlementApplication') {
      const op = reservations(all).find(p => p.operation === r.operation);
      ensure(op && (op.state === 'dispatch-claimed' || op.state === 'consumed'), 'application requires dispatched reservation');
      ensure(!all.some(v => v.record.type === 'SettlementApplication' && v.record.settlement === r.settlement), 'settlement already applied');
      const prior = latestApplication(all, r.operation);
      ensure(!prior || prior.actualCharge === -1 || prior.actualCharge === r.actualCharge, 'settled charge changed');
      ensure(!prior || prior.unresolved === 1 || r.unresolved === 0, 'resolved accounting cannot regress');
      ensure(r.actualCharge >= -1 && r.exposure >= 0 && r.released >= 0 && [0, 1].includes(r.unresolved)
        && [0, 1].includes(r.capViolation) && r.retryEligible === 0, 'invalid application accounting');
    } else {
      const op = reservations(all).find(v => v.operation === r.operation);
      ensure(op && op.state !== 'prepared', 'recovery must name an unresolved claim');
      const loop = latestLoop(all, op.run);
      ensure(loop && loop.pending === op.operation && r.episode === loop.episode, 'owned recovery episode required');
      ensure(loop.command === `${r.command}:wake`, 'result must complete its exact active wake');
      ensure((r.disposition === 'waiting' && ['running', 'waiting'].includes(loop.state))
        || (r.disposition === 'stopped-at-bound' && ['restoring', 'stopped'].includes(loop.state)), 'recovery disposition is not effect settlement');
      if (loop.state === 'stopped') ensure(r.observation === '', 'stopped admission cannot start an observation');
    }
  }
}
export function registerTransportBodies<S = never>(host: TransportHost, c: BoundaryContext, settlementConsumer?: SettlementConsumer<S>): Result<readonly OwnedBodyRegistration[]> {
  return boundary('TransportRegistrations', null, c, () => {
    const registrations = Object.entries(registeredTransportShapes).map(([name, shape]) => take(registerOwnedBody({
    name, owner: 'part-six', currentVersion: 1, versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
    decodeCurrent: (input, ctx) => {
      try {
        if (name === 'LoopPolicy') {
          if (isSharedLoopPolicy(input)) seamShapeCheck(input, shape);
          else shapeCheck(input, transportShapes.LoopPolicy!);
        } else shapeCheck(input, shape);
        const v = input as unknown as TransportRecord;
        ensure((input as { type: string }).type === name && v.schemaVersion === 1, 'owned type mismatch');
        if (name === 'LoopPolicy') {
          if (isSharedLoopPolicy(input)) sharedPolicyCheck(input); else policyCheck(input as unknown as LoopPolicy);
        }
        else if (name === 'FenceToken') {
          const past = rows(causalCone(ctx.origin, ctx.facts.facts), host.domain), lease = latestLease(past)?.record;
          ensure(lease && encoded(input).bytes === encoded(fenceFor(past, lease)).bytes, 'fence lacks committed assignment');
          if (ctx.mode === 'origin') { live(host); checkFence(past, input as unknown as FenceToken, host, host.monotonic()); }
        }
        else if (recordNames.includes(name)) {
          // The independently configured one-voter identity is invariant across
          // origin, replication and replay. Process incarnations may change;
          // a different signed actor/machine cannot speak for this authority.
          ensure(ctx.origin.machine === host.machine && ctx.origin.principal.id === host.principal.id
            && ctx.origin.principal.kind === host.principal.kind, 'issuer is not this authority');
          const past = rows(causalCone(ctx.origin, ctx.facts.facts), host.domain);
          ensure(past.every(({ fact }) => fact.machine === host.machine && fact.principal.id === host.principal.id
            && fact.principal.kind === host.principal.kind), 'predecessor issuer is not this authority');
          // P2 also live-decodes preserved facts for projection reconstruction.
          // Such a fact is already in its verified input set; it is NOT a new
          // append. Only a new origin candidate may perform current custody I/O.
          // Raw P2 origin append still lacks this fact and therefore checks R1.
          const candidate = !ctx.facts.facts.some(f => f.id === ctx.origin.id);
          // Any NEW six candidate, origin or replicated, invalidates an in-memory
          // prepared prefix. Historical/projection reads are pure and do not.
          // Even a subsequently refused candidate conservatively invalidates it.
          if (candidate) noteAccountingCandidate(host);
          const admitting = ctx.mode === 'origin' && candidate;
          validateTransition(v, past, host, admitting);
          if (v.type === 'SettlementApplication') {
            checkApplicationEvidence(v, causalCone(ctx.origin, ctx.facts.facts), past);
            if (ctx.mode === 'origin') requireApplication(host, v, settlementConsumer);
          }
          if (ctx.mode === 'origin') {
            live(host);
            const now = host.monotonic();
            ensure(v.authority === host.authorityIncarnation && v.tick <= now
              && !past.some(p => p.record.authority === v.authority && p.record.tick > v.tick), 'untrusted authority clock or incarnation');
            ensure(v.predecessor === (rows(ctx.facts.facts, host.domain).at(-1)?.fact.id ?? ''), 'stale origin predecessor');
            if (v.type !== 'ScanCursor') {
              const lease = latestLease(past)?.record;
              if (v.type !== 'Lease' || v.epoch === lease?.epoch) {
                ensure(lease?.incarnation === host.incarnation && lease.authority === host.authorityIncarnation && lease.expires > now
                  && lease.generation === host.current().generation.id, 'stale owner at durable boundary');
              } else ensure(v.incarnation === host.incarnation && v.expires > now
                && v.generation === host.current().generation.id, 'acquisition incarnation or expiration');
            }
          }
        }
        return { ok: true, value: freeze(input) };
      } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'transport record refused' }; }
    },
    }, shape, c)));
    bindSettlementConsumer(host, settlementConsumer); return registrations;
  });
}
export function registerTransportSeamBodies(host: TransportHost, c: BoundaryContext): Result<readonly OwnedBodyRegistration[]> {
  return boundary('TransportSeamRegistrations', null, c, () => Object.entries(transportSeamShapes).map(([name, shape]) =>
    take(registerOwnedBody({
      name, owner: 'part-six', currentVersion: 1,
      versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
      decodeCurrent: (input, ctx) => {
        try {
          seamShapeCheck(input, shape);
          if (name === sharedLoopPolicyOwnedName) {
            const policy = input as unknown as SharedLoopRecord['policy'];
            sharedPolicyCheck(policy);
          } else {
            ensure(name === sharedLoopRecordOwnedName && isStoredSharedLoopRecord(input), 'owned type mismatch');
            const record = loadSharedLoopRecord(input);
            sharedLoopRecordCheck(record);
            ensure(ctx.origin.machine === host.machine && ctx.origin.principal.id === host.principal.id
              && ctx.origin.principal.kind === host.principal.kind, 'issuer is not this authority');
            const cone = causalCone(ctx.origin, ctx.facts.facts);
            const past = rows(cone, host.domain);
            ensure(past.every(({ fact }) => fact.machine === host.machine && fact.principal.id === host.principal.id
              && fact.principal.kind === host.principal.kind), 'predecessor issuer is not this authority');
            const candidate = !ctx.facts.facts.some(fact => fact.id === ctx.origin.id);
            if (candidate) noteAccountingCandidate(host);
            const admitting = ctx.mode === 'origin' && candidate;
            resolveSharedLoopEvidence(record, ctx.origin, ctx.facts.facts, ctx.facts, host);
            validateTransition(record, past, host, admitting, cone, ctx.facts);
            if (ctx.mode === 'origin') {
              live(host);
              const now = host.monotonic();
              ensure(record.authority === host.authorityIncarnation && record.tick <= now
                && !past.some(row => row.record.authority === record.authority && row.record.tick > record.tick),
              'untrusted authority clock or incarnation');
              ensure(record.predecessor === (rows(ctx.facts.facts, host.domain).at(-1)?.fact.id ?? ''),
                'stale origin predecessor');
              const lease = latestLease(past)?.record;
              ensure(lease?.incarnation === host.incarnation && lease.authority === host.authorityIncarnation
                && lease.expires > now && lease.generation === host.current().generation.id,
              'stale owner at durable boundary');
            }
          }
          return { ok: true, value: freeze(input) };
        } catch (error) {
          return { ok: false, detail: error instanceof Error ? error.message : 'transport seam record refused' };
        }
      },
    }, shape, c))));
}
