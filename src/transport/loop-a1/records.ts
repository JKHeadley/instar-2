import { consumeResult, decode, decodeMeasurement, grantLiveness, scopeIncludes } from '../../index.js';
import type { BoundaryContext, Clock, Json, Result, RunReference } from '../../index.js';
import { causalCone, prepareSnapshot, registerOwnedBody } from '../../facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, OwnedBodyRegistration } from '../../facts/index.js';
import type { Lease, TransportFact } from '../contracts.js';
import type { TransportHost } from '../contracts.js';
import { boundary, encoded, ensure, freeze, take } from '../boundary.js';
import {
  checkFence,
  fenceFor,
  latestLease,
  live,
  rows as legacyRows,
} from '../records.js';
import { noteAccountingCandidate } from '../settlement.js';
import type {
  LoopA1Host,
  LoopA1PolicyResult,
  LoopA1TransportFact,
  LoopAttempt,
  LoopOutcome,
  SharedBreakerLoopPolicy,
  SharedLoopRecord,
} from './contracts.js';
import {
  hasA1PolicyMarker,
  isSharedLoopPolicy,
  isStoredSharedLoopPolicy,
  isStoredSharedLoopRecord,
  loadSharedLoopPolicy,
  loadSharedLoopRecord,
  loopA1AdmissionShape,
  loopA1Shapes,
  rejectRequestExtensions,
  rejectUnsupportedSliceA1Fields,
  sharedLoopPolicyOwnedName,
  sharedLoopRecordCheck,
  sharedLoopRecordFactKind,
  sharedLoopRecordOwnedName,
  sharedPolicyCheck,
  shapeCheck,
} from './shapes.js';
import { decodeLoopPolicy as decodeLegacyLoopPolicy } from '../records.js';

export function decodeLoopPolicyA1(input: unknown, context: BoundaryContext): LoopA1PolicyResult {
  const legacy = decodeLegacyLoopPolicy(input, context);
  const accepted = consumeResult(legacy, { Success: () => true, Refused: () => false });
  if (accepted || !hasA1PolicyMarker(input)) return legacy as LoopA1PolicyResult;
  return boundary('SharedBreakerLoopPolicyInput', input, context, safe => {
    rejectUnsupportedSliceA1Fields(safe);
    ensure(isSharedLoopPolicy(safe), 'unsupported loop policy');
    sharedPolicyCheck(safe);
    return freeze(safe);
  }) as LoopA1PolicyResult;
}

export function loopA1Schemas(host: TransportHost): readonly FactSchema[] {
  const base = {
    machineScope: 'shared' as const,
    standing: 'requester' as const,
    action: 'work',
    scope: host.scope,
    causallyBound: false,
    requiredReferences: [] as readonly string[],
    authority: 'none' as const,
  };
  return [
    {
      ...base,
      kind: `transport-${sharedLoopPolicyOwnedName}`,
      version: 1,
      fields: {
        policy: { kind: 'owned' as const, owner: 'part-six', name: sharedLoopPolicyOwnedName },
        generation: { kind: 'text' as const, maxLength: 256 },
      },
    },
    {
      ...base,
      kind: sharedLoopRecordFactKind,
      version: 1,
      fields: { record: { kind: 'owned' as const, owner: 'part-six', name: sharedLoopRecordOwnedName } },
    },
  ];
}

type SignedCopyDetails = Readonly<{
  absent: string;
  conflict: string;
  outside?: string;
}>;

/**
 * Resolve one immutable signed identity without making physical multiplicity
 * meaningful. Every candidate participates in the value-conflict check, while
 * historical replay may constrain selection to the witnesses it actually signed.
 */
function collapseSignedRecordCopies(candidates: readonly FactEnvelope[],
  value: (fact: FactEnvelope) => Json, details: SignedCopyDetails,
  required?: readonly string[], preferredId?: string): FactEnvelope {
  ensure(candidates.length > 0, details.absent);
  if (candidates.length > 1) {
    ensure(new Set(candidates.map(fact => encoded(value(fact)).bytes)).size === 1, details.conflict);
    ensure(new Set(candidates.map(fact => encoded([
      fact.kind, fact.schemaVersion, fact.principal, fact.provenance, fact.predecessors.required,
    ]).bytes)).size === 1, details.conflict);
  }
  const requiredSet = required ? new Set(required) : undefined;
  const witnessed = requiredSet ? candidates.filter(fact => requiredSet.has(fact.id)) : [...candidates];
  ensure(witnessed.length > 0, details.outside ?? 'owner evidence is outside the signed required-reference set');
  const preferred = preferredId ? candidates.find(fact => fact.id === preferredId) : undefined;
  ensure(!preferred || !requiredSet || requiredSet.has(preferred.id),
    details.outside ?? 'owner evidence is outside the signed required-reference set');
  return preferred ?? [...witnessed].sort((left, right) => {
    const machine = Buffer.compare(Buffer.from(left.segment.machine, 'utf8'), Buffer.from(right.segment.machine, 'utf8'));
    if (machine !== 0) return machine;
    if (left.segment.epoch !== right.segment.epoch) return left.segment.epoch < right.segment.epoch ? -1 : 1;
    if (left.segment.position !== right.segment.position) return left.segment.position < right.segment.position ? -1 : 1;
    return Buffer.compare(Buffer.from(left.id, 'utf8'), Buffer.from(right.id, 'utf8'));
  })[0]!;
}

export function rowsA1(facts: readonly FactEnvelope[], domain: string): LoopA1TransportFact[] {
  const legacy = new Map(legacyRows(facts, domain).map(row => [row.fact.id, row]));
  const seen = new Map<string, FactEnvelope>();
  const rows: LoopA1TransportFact[] = [];
  const sharedCopies = new Map<string, { index: number; facts: FactEnvelope[] }>();
  for (const fact of facts) {
    const sameId = seen.get(fact.id);
    if (sameId) {
      if (sameId.kind === sharedLoopRecordFactKind || fact.kind === sharedLoopRecordFactKind) {
        collapseSignedRecordCopies([sameId, fact], candidate => candidate as unknown as Json, {
          absent: 'shared loop envelope is absent', conflict: 'shared loop envelope is conflicted',
        });
      }
      continue;
    }
    seen.set(fact.id, fact);
    const base = legacy.get(fact.id);
    if (base) {
      rows.push(base);
      continue;
    }
    if (fact.kind !== sharedLoopRecordFactKind) continue;
    const stored = (fact.body as { record?: unknown }).record;
    if (!isStoredSharedLoopRecord(stored)) continue;
    const record = loadSharedLoopRecord(stored);
    if (record.domain !== domain) continue;
    const key = `${record.domain}\u0000${record.command}`;
    const copies = sharedCopies.get(key);
    if (copies) {
      copies.facts.push(fact);
      const selected = collapseSignedRecordCopies(copies.facts,
        candidate => (candidate.body as { record: Json }).record, {
          absent: 'shared loop history is absent',
          conflict: 'shared loop history is conflicted',
        });
      rows[copies.index] = {
        fact: selected,
        record: loadSharedLoopRecord((selected.body as { record: never }).record),
      };
    } else {
      sharedCopies.set(key, { index: rows.length, facts: [fact] });
      rows.push({ fact, record });
    }
  }
  return rows;
}

function referenceCheck(value: { readonly owner: string; readonly name: string; readonly id: string }, owner: string, name: string): void {
  ensure(value.owner === owner && value.name === name && value.id.length > 0, `${name} reference owner`);
}
function schemaOwns(context: FactContext, fact: FactEnvelope, field: string, owner: string, name: string): boolean {
  const schema = context.schemas.find(value => value.kind === fact.kind && value.version === fact.schemaVersion);
  const fieldShape = schema?.fields[field];
  return fieldShape?.kind === 'owned' && fieldShape.owner === owner && fieldShape.name === name;
}
function allFacts(facts: readonly FactEnvelope[]): readonly FactEnvelope[] {
  const unique = new Map<string, FactEnvelope>();
  const conflicting = new Map<string, FactEnvelope[]>();
  for (const fact of facts) {
    const existing = unique.get(fact.id);
    if (!existing) {
      unique.set(fact.id, fact);
      continue;
    }
    if (existing === fact
      || existing.contentHash === fact.contentHash && existing.signature === fact.signature) continue;
    conflicting.set(fact.id, [...conflicting.get(fact.id) ?? [existing], fact]);
  }
  for (const [id, group] of conflicting) {
    unique.set(id, collapseSignedRecordCopies(group, fact => fact as unknown as Json, {
      absent: 'signed fact is absent', conflict: 'signed fact envelope is conflicted',
    }));
  }
  return [...unique.values()];
}
export function collapseSignedFactHistory(facts: readonly FactEnvelope[]): readonly FactEnvelope[] {
  return allFacts(facts);
}
function requireUsableFacts(facts: readonly FactEnvelope[], context: FactContext,
  history: readonly FactEnvelope[] = context.facts): void {
  const population = allFacts([...context.facts, ...history]);
  const snapshot = take(prepareSnapshot(facts, { ...context, facts: population }));
  ensure(snapshot.entries.length === facts.length
    && snapshot.entries.every(entry => entry.taint.length === 0 && entry.conflicts.length === 0),
  'referenced owner evidence is unavailable, stale, or conflicted');
}

export function resolveRunReference(reference: RunReference, facts: readonly FactEnvelope[], context: FactContext,
  status = true, allowTerminal = false, required?: readonly string[]): FactEnvelope {
  referenceCheck(reference, 'part-five', 'Run');
  const candidates = allFacts(facts).filter(fact => schemaOwns(context, fact, 'record', 'part-five', 'Run'))
    .filter(fact => {
      const body = fact.body as { run?: unknown; record?: { type?: unknown; id?: unknown } };
      return body.run === reference.id && body.record?.type === 'Run' && body.record.id === reference.id;
    });
  const fact = collapseSignedRecordCopies(candidates,
    candidate => (candidate.body as { record: Json }).record, {
      absent: 'Run admission is absent', conflict: 'Run admission is conflicted',
    }, required);
  const terminal = allFacts(facts).some(value => schemaOwns(context, value, 'record', 'part-five', 'RunTransition')
    && (value.body as { run?: unknown; record?: { run?: unknown; to?: unknown } }).run === reference.id
    && ['completed', 'cancelled', 'unreachable'].includes(String((value.body as { record?: { to?: unknown } }).record?.to)));
  ensure(allowTerminal || !terminal, 'Run admission is terminal');
  const openingId = (fact.body as { record: { opening?: { id?: string } } }).record.opening?.id;
  const opening = collapseSignedRecordCopies(allFacts(facts).filter(value => value.id === openingId),
    candidate => candidate as unknown as Json, {
      absent: 'Run opening evidence is absent', conflict: 'Run opening evidence is conflicted',
    });
  if (status) requireUsableFacts([fact, opening], context, facts);
  return fact;
}

export function resolvePolicyFact(policyValue: SharedBreakerLoopPolicy, generation: string,
  facts: readonly FactEnvelope[], context: FactContext, status = true,
  required?: readonly string[]): FactEnvelope {
  const candidates = allFacts(facts).filter(fact => fact.kind === `transport-${sharedLoopPolicyOwnedName}`
    && schemaOwns(context, fact, 'policy', 'part-six', sharedLoopPolicyOwnedName))
    .filter(fact => (fact.body as { policy?: { id?: unknown }; generation?: unknown }).policy?.id === policyValue.id
      && (fact.body as { generation?: unknown }).generation === generation);
  ensure(candidates.length > 0, 'governed loop policy fact is absent for the pinned generation');
  const values = candidates.map(fact => loadSharedLoopPolicy((fact.body as { policy: never }).policy));
  ensure(values.some(value => encoded(value).bytes === encoded(policyValue).bytes),
    'governed loop policy differs from the pinned value');
  const fact = collapseSignedRecordCopies(candidates,
    candidate => (candidate.body as { policy: Json }).policy, {
      absent: 'governed loop policy fact is absent for the pinned generation',
      conflict: 'governed loop policy is conflicted',
    }, required);
  if (status) requireUsableFacts(candidates, context, facts);
  return fact;
}

export function resolvePressureBinding(record: Pick<SharedLoopRecord,
  'currentOwnerRun' | 'operationFamily' | 'pressureScope' | 'pressureKey' | 'pressureBinding'>,
facts: readonly FactEnvelope[], context: FactContext, host: LoopA1Host, status = true,
required?: readonly string[]): FactEnvelope {
  referenceCheck(record.pressureBinding, 'part-two', 'FactEnvelope');
  ensure(host.loopScopeBinding?.owner === 'part-three', 'governed loop pressure binding unavailable');
  const resolved = take(host.loopScopeBinding.resolve({
    parentDuty: record.currentOwnerRun,
    operationFamily: record.operationFamily,
    pressureScope: record.pressureScope,
  }));
  ensure(resolved.operationFamily === record.operationFamily
    && encoded(resolved.pressureScope).bytes === encoded(record.pressureScope).bytes
    && encoded(resolved.witness).bytes === encoded(record.pressureBinding).bytes,
  'governed loop pressure binding changed');
  const candidates = allFacts(facts).filter(value => value.kind === 'loop-pressure-binding')
    .filter(value => {
      const body = value.body as { parentDuty?: unknown; operationFamily?: unknown; pressureScopeBytes?: unknown };
      return body.parentDuty === record.currentOwnerRun.id && body.operationFamily === record.operationFamily
        && body.pressureScopeBytes === encoded(record.pressureScope).bytes;
    });
  const fact = collapseSignedRecordCopies(candidates, candidate => candidate.body, {
    absent: 'governed loop pressure binding fact is absent or wrong-kind',
    conflict: 'governed loop pressure binding fact is conflicted',
  }, required, record.pressureBinding.id);
  const body = fact.body as { parentDuty?: unknown; operationFamily?: unknown; pressureScopeBytes?: unknown };
  ensure(body.parentDuty === record.currentOwnerRun.id && body.operationFamily === record.operationFamily
    && body.pressureScopeBytes === encoded(record.pressureScope).bytes
    && record.pressureKey === `pressure:${encoded([record.operationFamily, record.pressureScope]).hash}`,
  'governed loop pressure binding names another subject');
  if (status) requireUsableFacts([fact], context, facts);
  return fact;
}

function ownerRecordCandidates(facts: readonly FactEnvelope[], context: FactContext, name: string, id: string): FactEnvelope[] {
  return allFacts(facts).filter(fact => schemaOwns(context, fact, 'record', 'part-nine', name))
    .filter(fact => {
      const record = (fact.body as { record?: { type?: unknown; id?: unknown } }).record;
      return record?.type === name && record.id === id;
    });
}
function restorationAssessmentCandidates(facts: readonly FactEnvelope[], context: FactContext,
  id: string): FactEnvelope[] {
  const owned = allFacts(facts)
    .filter(fact => schemaOwns(context, fact, 'record', 'part-nine', 'VerificationAssessment'));
  const referenced = owned.filter(fact => fact.id === id
    || (fact.body as { record?: { id?: unknown } }).record?.id === id);
  const identities = new Set(referenced.flatMap(fact => {
    const identity = (fact.body as { record?: { id?: unknown } }).record?.id;
    return typeof identity === 'string' ? [identity] : [];
  }));
  return owned.filter(fact => {
    const identity = (fact.body as { record?: { id?: unknown } }).record?.id;
    return typeof identity === 'string' && identities.has(identity);
  });
}
function uniqueOwnerRecord(facts: readonly FactEnvelope[], context: FactContext, name: string, id: string,
  required?: readonly string[]): FactEnvelope {
  const candidates = ownerRecordCandidates(facts, context, name, id);
  return collapseSignedRecordCopies(candidates,
    fact => (fact.body as { record: Json }).record, {
      absent: `${name} evidence is absent`, conflict: `${name} evidence is conflicted`,
    }, required);
}
function evidenceFact(id: string, facts: readonly FactEnvelope[], context: FactContext,
  required?: readonly string[]): FactEnvelope {
  const candidates = allFacts(facts).filter(fact => Object.entries(fact.body as Readonly<Record<string, Json>>).some(([field, value]) => {
    const candidate = context.schemas.find(schema => schema.kind === fact.kind && schema.version === fact.schemaVersion)?.fields[field];
    const constitutional = value as { type?: unknown; id?: unknown } | undefined;
    return candidate?.kind === 'constitutional' && candidate.type === 'Evidence'
      && constitutional?.type === 'Evidence' && constitutional.id === id;
  }));
  return collapseSignedRecordCopies(candidates, fact => fact.body, {
    absent: 'VerificationAssessment predicate Evidence is absent',
    conflict: 'VerificationAssessment predicate Evidence is conflicted',
  }, required);
}
function restorationAssessmentComplete(record: Readonly<{
  missingEvidence?: unknown;
  captureStatuses?: unknown;
  taints?: unknown;
  predicates?: unknown;
}>): boolean {
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
  operationFamily: string, host: LoopA1Host, status = true, requireComplete = true,
  required?: readonly string[]): readonly FactEnvelope[] {
  referenceCheck(reference, 'part-nine', 'VerificationAssessment');
  const candidates = restorationAssessmentCandidates(facts, context, reference.id);
  const fact = collapseSignedRecordCopies(candidates,
    candidate => (candidate.body as { record: Json }).record, {
      absent: 'VerificationAssessment evidence is absent',
      conflict: 'VerificationAssessment evidence is conflicted',
    }, required, reference.id);
  const record = (fact.body as { record: {
    request?: unknown;
    predecessors?: unknown;
    operation?: unknown;
    attempt?: unknown;
    operationDigest?: unknown;
    barVersion?: unknown;
    evidence?: unknown;
    supersedes?: unknown;
    missingEvidence?: unknown;
    captureStatuses?: unknown;
    taints?: unknown;
    predicates?: unknown;
    validFrom?: number;
    validUntil?: number;
  } }).record;
  ensure(Number.isSafeInteger(record.validFrom) && Number.isSafeInteger(record.validUntil)
    && record.validFrom! <= at.value && at.value < record.validUntil!, 'VerificationAssessment evidence is stale');
  const expectedDigest = encoded([pressureKey, operationFamily]).hash;
  const predicates = Array.isArray(record.predicates)
    ? record.predicates as readonly { predicate?: unknown; verdict?: unknown }[] : [];
  ensure(record.operation === operationFamily && record.operationDigest === expectedDigest,
    'VerificationAssessment restoration subject differs from the governed pressure');
  ensure(typeof record.request === 'string' && typeof record.attempt === 'string'
    && typeof record.barVersion === 'string' && Array.isArray(record.predecessors) && Array.isArray(record.evidence),
  'VerificationAssessment support bindings are incomplete');
  const predecessors = record.predecessors as string[];
  const requestFact = uniqueOwnerRecord(facts, context, 'VerificationRequest', record.request, predecessors);
  const request = (requestFact.body as { record: {
    predecessors?: unknown;
    operation?: unknown;
    attempt?: unknown;
    operationDigest?: unknown;
    plan?: unknown;
    barVersion?: unknown;
    sourceGeneration?: unknown;
  } }).record;
  ensure(Array.isArray(request.predecessors) && typeof request.plan === 'string'
    && predecessors.includes(requestFact.id), 'VerificationAssessment request lineage is absent');
  const planFact = uniqueOwnerRecord(facts, context, 'VerificationPlan', request.plan, request.predecessors);
  const plan = (planFact.body as { record: {
    subject?: { generation?: unknown; governed?: unknown };
    bar?: { version?: unknown };
  } }).record;
  ensure(request.predecessors.includes(planFact.id)
    && request.operation === operationFamily && request.operationDigest === expectedDigest
    && request.attempt === record.attempt && request.barVersion === record.barVersion
    && plan.bar?.version === request.barVersion && plan.subject?.generation === request.sourceGeneration
    && plan.subject?.governed === pressureKey,
  'VerificationAssessment request, plan, or pressure subject differs');
  const predicateEvidence = (Array.isArray(record.predicates) ? record.predicates : [])
    .flatMap(value => value && typeof value === 'object' && Array.isArray((value as { evidence?: unknown }).evidence)
      ? (value as { evidence: unknown[] }).evidence : []);
  const evidenceIds = [...new Set([...record.evidence as unknown[], ...predicateEvidence])];
  ensure(evidenceIds.every(id => typeof id === 'string' && id.length > 0),
    'VerificationAssessment predicate Evidence reference is invalid');
  const evidenceFacts = evidenceIds.map(id => evidenceFact(id as string, facts, context, predecessors));
  const superseded = typeof record.supersedes === 'string' && record.supersedes.length > 0
    ? [uniqueOwnerRecord(facts, context, 'VerificationAssessment', record.supersedes, predecessors)] : [];
  const support = allFacts([fact, requestFact, planFact, ...evidenceFacts, ...superseded]);
  ensure([requestFact, ...evidenceFacts, ...superseded].every(value => predecessors.includes(value.id)),
    'VerificationAssessment support is outside its signed predecessor set');
  if (requireComplete) ensure(restorationAssessmentComplete(record),
    'VerificationAssessment does not establish complete restoration');
  ensure(host.restorationEvidence?.owner === 'part-nine', 'independent restoration evidence unavailable');
  const verified = take(host.restorationEvidence.verify({ reference, pressureKey, operationFamily, at }));
  ensure(encoded(verified.reference).bytes === encoded(reference).bytes
    && verified.operation === record.operation && verified.operationDigest === record.operationDigest
    && encoded(verified.missingEvidence).bytes === encoded(record.missingEvidence).bytes
    && encoded(verified.captureStatuses).bytes === encoded(record.captureStatuses).bytes
    && encoded(verified.taints).bytes === encoded(record.taints).bytes
    && encoded(verified.predicates).bytes === encoded(predicates.map(value => ({
      predicate: value.predicate,
      verdict: value.verdict,
    }))).bytes
    && verified.validFrom === record.validFrom && verified.validUntil === record.validUntil,
  'current Part Nine restoration assessment differs from signed history');
  if (status) requireUsableFacts(support, context, facts);
  return support;
}

export function restorationReferenceComplete(reference: SharedLoopRecord['closureEvidence'][number],
  facts: readonly FactEnvelope[], context: FactContext, at: Clock, pressureKey: string,
  operationFamily: string, host: LoopA1Host, status = true): boolean {
  const support = resolveRestorationReference(reference, facts, context, at, pressureKey,
    operationFamily, host, status, false);
  const assessment = support.find(fact => schemaOwns(context, fact, 'record', 'part-nine', 'VerificationAssessment')
    && (fact.id === reference.id || (fact.body as { record?: { id?: unknown } }).record?.id === reference.id));
  ensure(assessment, 'VerificationAssessment evidence is absent');
  return restorationAssessmentComplete((assessment.body as {
    record: Parameters<typeof restorationAssessmentComplete>[0];
  }).record);
}

export function currentRestorationReferences(references: SharedLoopRecord['closureEvidence'],
  facts: readonly FactEnvelope[], context: FactContext, at: Clock, pressureKey: string,
  operationFamily: string, host: LoopA1Host): SharedLoopRecord['closureEvidence'] {
  return freeze(references.filter(reference => {
    referenceCheck(reference, 'part-nine', 'VerificationAssessment');
    const candidates = restorationAssessmentCandidates(facts, context, reference.id);
    const fact = collapseSignedRecordCopies(candidates,
      candidate => (candidate.body as { record: Json }).record, {
        absent: 'VerificationAssessment evidence is absent',
        conflict: 'VerificationAssessment evidence is conflicted',
      }, undefined, reference.id);
    const validity = (fact.body as {
      record: { validFrom?: unknown; validUntil?: unknown };
    }).record;
    ensure(Number.isSafeInteger(validity.validFrom) && Number.isSafeInteger(validity.validUntil),
      'VerificationAssessment validity is incomplete');
    if (at.value < (validity.validFrom as number) || at.value >= (validity.validUntil as number)) return false;
    resolveRestorationReference(reference, facts, context, at, pressureKey, operationFamily, host, false);
    return true;
  }));
}

function sharedLoopMeasurements(record: SharedLoopRecord, host: LoopA1Host): void {
  const values = [record.transitionAt, record.nextEligible, record.breakerFirstOpened,
    ...record.attemptLog.map(value => value.admittedAt),
    ...record.outcomeLog.flatMap(value => [value.observedAt, value.recordedAt])];
  for (const value of values) take(decodeMeasurement('clock', value, host.current().decode));
}
function requiredBy(origin: FactEnvelope, dependencies: readonly FactEnvelope[]): void {
  const required = new Set(origin.predecessors.required);
  ensure(dependencies.every(fact => required.has(fact.id)),
    'owner evidence is outside the signed required-reference set');
}

function constitutionalFact(reference: {
  readonly type: string;
  readonly id: string;
  readonly fact: { readonly owner: string; readonly name: string; readonly id: string };
  readonly field: string;
}, expected: 'Result' | 'Outcome', facts: readonly FactEnvelope[], context: FactContext,
status = true, required?: readonly string[]): FactEnvelope {
  const addressed = allFacts(facts).find(value => value.id === reference.fact.id);
  ensure(addressed, `${expected} fact is absent`);
  const schema = context.schemas.find(value => value.kind === addressed.kind && value.version === addressed.schemaVersion);
  const field = schema?.fields[reference.field];
  ensure(reference.type === expected && field?.kind === 'constitutional' && field.type === expected,
    `reference is not an owner ${expected} field`);
  const addressedBinding = (addressed.body as { loopAttemptBinding?: unknown }).loopAttemptBinding;
  const addressedValue = (addressed.body as Record<string, Json>)[reference.field];
  const candidates = allFacts(facts).filter(candidate => {
    const candidateSchema = context.schemas.find(value => value.kind === candidate.kind
      && value.version === candidate.schemaVersion);
    const candidateField = candidateSchema?.fields[reference.field];
    const candidateValue = (candidate.body as Record<string, unknown>)[reference.field] as {
      type?: unknown; id?: unknown;
    } | undefined;
    return candidateField?.kind === 'constitutional' && candidateField.type === expected
      && candidateValue?.type === expected
      && (candidateValue.id === reference.id
        || candidateValue.id === undefined && (candidate.id === reference.fact.id
          || expected === 'Outcome' && typeof addressedBinding === 'string'
            && (candidate.body as { loopAttemptBinding?: unknown }).loopAttemptBinding === addressedBinding
            && encoded(candidateValue as unknown as Json).bytes === encoded(addressedValue).bytes));
  });
  const fact = collapseSignedRecordCopies(candidates, candidate => candidate.body, {
    absent: `${expected} fact is absent`, conflict: `${expected} evidence is conflicted`,
  }, required, reference.fact.id);
  const owned = (fact.body as Record<string, unknown>)[reference.field] as { type?: unknown; id?: unknown } | undefined;
  ensure(owned?.type === expected && (owned.id === undefined || owned.id === reference.id),
    `${expected} reference names another subject`);
  if (status) requireUsableFacts([fact], context, facts);
  return fact;
}

function resolveLoopOutcomeCompletion(record: SharedLoopRecord, outcome: LoopOutcome,
  facts: readonly FactEnvelope[], context: FactContext, status = true,
  required?: readonly string[]): FactEnvelope {
  const fact = constitutionalFact(outcome.completion, 'Outcome', facts, context, status, required);
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
      return candidateRecord.pressureKey === record.pressureKey
        && candidateRecord.operationFamily === record.operationFamily
        && ['attempt-admitted', 'half-opened'].includes(candidateRecord.transition)
        && candidateRecord.attemptLog.at(-1)?.id === outcome.attempt;
    });
  const admittedFact = collapseSignedRecordCopies(attemptFacts,
    candidate => (candidate.body as { record: Json }).record, {
      absent: 'Outcome completion does not witness its admitted loop attempt',
      conflict: 'Outcome completion has conflicting admitted policy generations',
      outside: 'Outcome completion does not witness its admitted loop attempt',
    }, fact.predecessors.required);
  const admitted = loadSharedLoopRecord((admittedFact.body as { record: never }).record);
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

export function resolveLoopOutcomeFact(reference: LoopOutcome['completion'],
  facts: readonly FactEnvelope[], context: FactContext): FactEnvelope {
  return constitutionalFact(reference, 'Outcome', facts, context);
}

function restorationIntroductionAt(record: SharedLoopRecord, outcome: LoopOutcome,
  reference: SharedLoopRecord['closureEvidence'][number], history: readonly FactEnvelope[]): Clock {
  const addressed = allFacts(history).find(fact => fact.id === record.predecessor);
  ensure(addressed, 'restoration introduction predecessor is absent');
  const addressedRecord = isStoredSharedLoopRecord((addressed.body as { record?: unknown }).record)
    ? loadSharedLoopRecord((addressed.body as { record: never }).record) : undefined;
  const predecessor = addressedRecord
    ? collapseSignedRecordCopies(allFacts(history).filter(fact => {
      const stored = (fact.body as { record?: unknown }).record;
      return fact.kind === sharedLoopRecordFactKind && isStoredSharedLoopRecord(stored)
        && loadSharedLoopRecord(stored).domain === addressedRecord.domain
        && loadSharedLoopRecord(stored).command === addressedRecord.command;
    }), fact => (fact.body as { record: Json }).record, {
      absent: 'restoration introduction predecessor is absent',
      conflict: 'restoration introduction predecessor is conflicted',
    }, undefined, record.predecessor)
    : collapseSignedRecordCopies([addressed], fact => fact as unknown as Json, {
      absent: 'restoration introduction predecessor is absent',
      conflict: 'restoration introduction predecessor is conflicted',
    }, undefined, record.predecessor);
  const past = rowsA1([...causalCone(predecessor, history), predecessor], record.domain);
  for (const row of past) {
    if (!isA1Record(row.record) || row.record.episode !== record.episode) continue;
    const contributed = row.record.outcomeLog.find(value => value.attempt === outcome.attempt);
    if (contributed?.restoration.some(value => encoded(value).bytes === encoded(reference).bytes)) {
      return row.record.transitionAt;
    }
  }
  return record.transitionAt;
}

export function sharedLoopEvidence(record: SharedLoopRecord, facts: readonly FactEnvelope[], context: FactContext,
  host: LoopA1Host, required?: readonly string[]): readonly FactEnvelope[] {
  const history = allFacts(facts);
  sharedLoopMeasurements(record, host);
  const dependencies: FactEnvelope[] = [
    resolvePolicyFact(record.policy, record.policyGeneration.id, history, context, false, required),
    resolveRunReference(record.currentOwnerRun, history, context, false, false, required),
    resolvePressureBinding(record, history, context, host, false, required),
  ];
  for (const outcome of record.outcomeLog) {
    dependencies.push(resolveLoopOutcomeCompletion(record, outcome, history, context, false, required));
    for (const reference of outcome.restoration) {
      dependencies.push(...resolveRestorationReference(reference, history, context,
        restorationIntroductionAt(record, outcome, reference, history),
        record.pressureKey, record.operationFamily, host, false, false, required));
    }
  }
  for (const reference of record.closureEvidence) {
    const contributingOutcome = record.outcomeLog.find(outcome =>
      outcome.restoration.some(value => encoded(value).bytes === encoded(reference).bytes));
    const contributedAt = contributingOutcome
      ? restorationIntroductionAt(record, contributingOutcome, reference, history)
      : record.transitionAt;
    dependencies.push(...resolveRestorationReference(reference, history, context,
      record.transition === 'closed' ? record.transitionAt : contributedAt,
      record.pressureKey, record.operationFamily, host, false, true, required));
  }
  const unique = allFacts(dependencies);
  requireUsableFacts(unique, context, history);
  return unique;
}

function resolveSharedLoopEvidence(record: SharedLoopRecord, origin: FactEnvelope,
  facts: readonly FactEnvelope[], context: FactContext, host: LoopA1Host): readonly string[] {
  const dependencies = sharedLoopEvidence(record, facts, context, host, origin.predecessors.required);
  requiredBy(origin, dependencies);
  return dependencies.map(fact => fact.id);
}

export function latestSharedLoop(all: readonly LoopA1TransportFact[], pressureKey: string): SharedLoopRecord | undefined {
  const record = all.filter(row => isA1Record(row.record) && row.record.pressureKey === pressureKey).at(-1)?.record;
  return isA1Record(record) ? record : undefined;
}
export function latestSharedLoopByParent(all: readonly LoopA1TransportFact[], run: string): SharedLoopRecord | undefined {
  const record = all.filter(row => isA1Record(row.record) && row.record.run === run).at(-1)?.record;
  return isA1Record(record) ? record : undefined;
}
export function isA1Record(input: unknown): input is SharedLoopRecord {
  return input !== null && typeof input === 'object'
    && (input as { type?: unknown }).type === 'LoopRecord'
    && isSharedLoopPolicy((input as { policy?: unknown }).policy);
}

const tickets = new WeakMap<LoopA1Host, Set<string>>();
export function withSharedLoopCandidate<T>(host: LoopA1Host, record: SharedLoopRecord, run: () => T): T {
  const key = encoded(record).hash;
  const set = tickets.get(host) ?? new Set<string>();
  tickets.set(host, set);
  ensure(!set.has(key), 'shared loop candidate already active');
  set.add(key);
  try {
    return run();
  } finally {
    set.delete(key);
  }
}
function requireSharedLoopCandidate(host: LoopA1Host, record: SharedLoopRecord): void {
  ensure(tickets.get(host)?.has(encoded(record).hash), 'shared loop transition requires its conditional writer');
}

export const sameClock = (left: Clock, right: Clock): boolean => left.subject.kind === right.subject.kind
  && left.subject.instance === right.subject.instance && left.unit === right.unit;
export const atOrAfter = (left: Clock, right: Clock): boolean => sameClock(left, right) && left.value >= right.value;
export const shifted = (base: Clock, delta: number): Clock => {
  ensure(Number.isSafeInteger(delta) && delta >= 0 && Number.isSafeInteger(base.value + delta),
    'shared loop time overflow');
  return freeze({ ...base, value: base.value + delta, at: base.at + delta } as unknown as Clock);
};
const compareBytes = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
export const sortedOutcomes = (outcomes: readonly LoopOutcome[]): LoopOutcome[] => [...outcomes].sort((left, right) =>
  left.observedAt.value - right.observedAt.value || compareBytes(left.attempt, right.attempt));
export const windowAt = (record: Pick<SharedLoopRecord, 'policy' | 'outcomeLog'>, now: Clock): LoopOutcome[] =>
  sortedOutcomes(record.outcomeLog.filter(outcome => sameClock(outcome.observedAt, now)
    && outcome.observedAt.value > now.value - record.policy.acceptedOutcomeWindow));
export const failureCountAt = (policy: SharedBreakerLoopPolicy, outcomes: readonly LoopOutcome[]): number => {
  let count = 0;
  for (const outcome of outcomes) {
    count = outcome.kind === 'accepted' ? 0
      : policy.countedFailureClasses.includes(outcome.failureClass) ? count + 1 : count;
  }
  return count;
};

export type AdmissionDecision = Readonly<{
  kind: 'stopped';
} | {
  kind: 'admitted';
  attempt: LoopAttempt;
  state: SharedLoopRecord['state'];
  transition: SharedLoopRecord['transition'];
  breakerHasOpened: 0 | 1;
  breakerFirstOpened: Clock;
  halfOpenAdmitted: number;
  halfOpenSucceeded: number;
  closureEvidence: SharedLoopRecord['closureEvidence'];
}>;

export function sharedAdmissionDecision(previous: SharedLoopRecord, now: Clock,
  input: Omit<LoopAttempt, 'mode'>): AdmissionDecision {
  ensure(previous.clockBasis === now.subject.instance && atOrAfter(now, previous.transitionAt),
    'incomparable or backward shared pressure time');
  ensure(input.episode === previous.episode, 'attempt episode differs from the governed loop episode');
  ensure(previous.state !== 'stopped', 'loop episode is terminal');
  const unfinished = previous.attemptLog.filter(attempt =>
    !previous.outcomeLog.some(outcome => outcome.attempt === attempt.id)).map(attempt => attempt.id);
  ensure(encoded(previous.pendingAttempts).bytes === encoded(unfinished).bytes, 'incomplete attempt population');
  const episodeExhausted = previous.attempts >= previous.policy.maxAttempts
    || now.value - previous.started >= previous.policy.maxDuration;
  const openExhausted = (previous.state === 'open-breaker' || previous.state === 'half-open')
    && previous.breakerHasOpened === 1
    && now.value - previous.breakerFirstOpened.value >= previous.policy.maxOpenDuration;
  if (episodeExhausted || openExhausted) {
    ensure(previous.pendingAttempts.length === 0, 'unfinished attempts retain loop ownership at the bound');
    return freeze({ kind: 'stopped' as const });
  }
  ensure(atOrAfter(now, previous.nextEligible), 'breaker cooldown or wake is not eligible');
  let mode: LoopAttempt['mode'] = 'closed';
  let state: SharedLoopRecord['state'] = 'running';
  let transition: SharedLoopRecord['transition'] = 'attempt-admitted';
  let breakerHasOpened = previous.breakerHasOpened;
  let breakerFirstOpened = previous.breakerFirstOpened;
  let halfOpenAdmitted = previous.halfOpenAdmitted;
  let halfOpenSucceeded = previous.halfOpenSucceeded;
  let closureEvidence = previous.closureEvidence;
  if (previous.state === 'closed') {
    ensure(previous.pendingAttempts.length === 0, 'closed cycle retains unfinished attempts');
    // F6: a witnessed close ends one breaker cycle, not the one permitted A1
    // episode. Cumulative attempt/failure/open counters remain in the record,
    // while every cycle-specific closure input is reset and must be re-witnessed.
    breakerHasOpened = 0;
    breakerFirstOpened = now;
    halfOpenAdmitted = 0;
    halfOpenSucceeded = 0;
    closureEvidence = freeze([]);
  } else if (previous.state === 'open-breaker' || previous.state === 'half-open') {
    ensure(previous.breakerHasOpened === 1, 'breaker-open history is incomplete');
    mode = 'half-open';
    state = 'half-open';
    if (previous.state === 'open-breaker') {
      ensure(previous.pendingAttempts.length === 0, 'unfinished attempts retain breaker ownership');
      transition = 'half-opened';
      halfOpenAdmitted = 0;
      halfOpenSucceeded = 0;
    }
    ensure(halfOpenAdmitted < previous.policy.halfOpenTrials
      && previous.pendingAttempts.length < previous.policy.halfOpenConcurrency,
    'half-open trial bound exhausted');
    halfOpenAdmitted++;
  } else {
    ensure(previous.pendingAttempts.length < 1, 'concurrent work cap exhausted');
  }
  const attempt = freeze({ ...input, mode } as LoopAttempt);
  return freeze({ kind: 'admitted' as const, attempt, state, transition, breakerHasOpened,
    breakerFirstOpened, halfOpenAdmitted, halfOpenSucceeded, closureEvidence });
}

export function sharedOutcomeDecision(previous: SharedLoopRecord, added: LoopOutcome, receiptAt: Clock,
  completeRestoration: ReadonlyArray<SharedLoopRecord['closureEvidence'][number]> = added.restoration): Readonly<Pick<SharedLoopRecord,
  'state' | 'transition' | 'nextEligible' | 'totalFailures' | 'failureCount' | 'breakerHasOpened'
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
    state = 'open-breaker';
    nextEligible = previous.nextEligible;
  } else if (attempt.mode === 'half-open' && counted) {
    state = 'open-breaker';
    transition = 'reopened';
    nextEligible = shifted(added.observedAt, policy.breakerCooldown);
    breakerOpenCount++;
    breakerHasOpened = 1;
    breakerFirstOpened = previous.breakerFirstOpened;
    halfOpenAdmitted = 0;
    halfOpenSucceeded = 0;
  } else if (attempt.mode === 'half-open') {
    halfOpenSucceeded += added.kind === 'accepted' ? 1 : 0;
    closureEvidence = freeze([...new Map([...closureEvidence, ...completeRestoration]
      .map(value => [value.id, value])).values()]);
    if (halfOpenSucceeded >= policy.halfOpenTrials && pendingAttempts.length === 0 && closureEvidence.length > 0) {
      state = 'closed';
      transition = 'closed';
      nextEligible = receiptAt;
    } else {
      state = 'half-open';
    }
  } else if (failureCount >= policy.failureThreshold) {
    state = 'open-breaker';
    transition = 'opened';
    nextEligible = shifted(added.observedAt, policy.breakerCooldown);
    breakerOpenCount++;
    breakerHasOpened = 1;
    breakerFirstOpened = added.observedAt;
  } else if (pendingAttempts.length > 0) {
    state = 'running';
  } else {
    state = 'waiting';
    const exponent = Math.min(failureCount, 53);
    const base = Math.min(policy.maxDelay, policy.initialDelay * Math.pow(policy.backoffMultiplier, exponent));
    const delay = Math.max(policy.minDelay,
      Math.min(policy.maxDelay, Math.floor(base * added.jitterPermille / 1000)));
    nextEligible = shifted(receiptAt, delay);
  }
  return freeze({
    state,
    transition,
    nextEligible,
    totalFailures: previous.totalFailures + (counted ? 1 : 0),
    failureCount,
    breakerHasOpened,
    breakerOpenCount,
    breakerFirstOpened,
    halfOpenAdmitted,
    halfOpenSucceeded,
    pendingAttempts,
    outcomeLog,
    outcomeWindowDigest: encoded(windowAt({ policy, outcomeLog }, receiptAt)).hash,
    closureEvidence,
  });
}

function exactPrefix<T>(prior: readonly T[], next: readonly T[]): boolean {
  return prior.every((value, index) => encoded(value as never).bytes === encoded(next[index] as never).bytes);
}

function withoutSubmission(record: SharedLoopRecord): SharedLoopRecord {
  const { stoppedSubmission: _stopped, closureSubmission: _closure,
    evidenceSubmission: _evidence, ...rest } = record;
  return rest as SharedLoopRecord;
}

function priorOutcomePreserved(previous: LoopOutcome, next: LoopOutcome,
  closureAttempt?: string): boolean {
  if (encoded(previous).bytes === encoded(next).bytes) return true;
  if (previous.attempt !== closureAttempt || next.attempt !== closureAttempt) return false;
  const { restoration: previousRestoration, ...previousCore } = previous;
  const { restoration: nextRestoration, ...nextCore } = next;
  return encoded(previousCore).bytes === encoded(nextCore).bytes
    && exactPrefix(previousRestoration, nextRestoration);
}

function validateSharedLoopHistory(record: SharedLoopRecord, all: readonly LoopA1TransportFact[],
  host: LoopA1Host, origin: boolean, evidenceFacts?: readonly FactEnvelope[], context?: FactContext): void {
  sharedLoopRecordCheck(record);
  ensure(record.policyGeneration.id === latestLease(all as readonly TransportFact[])?.record.generation,
    'shared transition generation differs from its committed lease');
  const previous = latestSharedLoop(all, record.pressureKey);
  const parentEpisode = latestSharedLoopByParent(all, record.run);
  if (!previous && parentEpisode) {
    ensure(encoded(parentEpisode.policy).bytes === encoded(record.policy).bytes,
      'conflicting shared pressure policy or parent');
    ensure(false, 'unsupported-in-slice-a1');
  }
  if (origin) requireSharedLoopCandidate(host, record);
  if (!previous) {
    const firstEligible = shifted(record.transitionAt, record.policy.initialDelay);
    ensure(record.transition === 'scheduled' && record.state === 'scheduled' && record.attempts === 0
      && record.started === record.transitionAt.value && record.nextWake === firstEligible.value
      && encoded(record.nextEligible).bytes === encoded(firstEligible).bytes
      && record.totalFailures === 0 && record.failureCount === 0 && record.breakerHasOpened === 0
      && record.breakerOpenCount === 0
      && encoded(record.breakerFirstOpened).bytes === encoded(record.transitionAt).bytes
      && record.halfOpenAdmitted === 0 && record.halfOpenSucceeded === 0
      && record.pendingAttempts.length === 0 && record.attemptLog.length === 0
      && record.outcomeLog.length === 0 && record.outcomeWindowDigest === encoded([]).hash
      && record.closureEvidence.length === 0,
    'initial shared loop counters must be empty');
    return;
  }
  ensure(encoded(previous.policy).bytes === encoded(record.policy).bytes
    && previous.operationFamily === record.operationFamily
    && encoded(previous.pressureScope).bytes === encoded(record.pressureScope).bytes
    && previous.clockBasis === record.clockBasis, 'shared pressure policy or clock changed');
  ensure(record.transition !== 'scheduled', 'unsupported-in-slice-a1');
  ensure(previous.episode === record.episode && previous.episodeKey === record.episodeKey
    && previous.started === record.started
    && encoded(previous.currentOwnerRun).bytes === encoded(record.currentOwnerRun).bytes,
  'shared episode identity or current owner changed');
  ensure(atOrAfter(record.transitionAt, previous.transitionAt), 'shared loop clock moved backward');
  ensure(encoded(record.sourceVector).bytes === encoded(previous.sourceVector).bytes, 'unsupported-in-slice-a1');
  ensure(record.attempts >= previous.attempts && record.totalFailures >= previous.totalFailures
    && record.breakerOpenCount >= previous.breakerOpenCount
    && exactPrefix(previous.attemptLog, record.attemptLog)
    && previous.outcomeLog.every(value => record.outcomeLog.some(next =>
      priorOutcomePreserved(value, next,
        record.closureSubmission?.attempt ?? record.evidenceSubmission?.attempt))),
  'shared pressure history reset or changed');
  ensure(previous.state !== 'stopped', 'terminal loop episode cannot transition');
  const currentClosureEvidence = evidenceFacts && context
    ? currentRestorationReferences(previous.closureEvidence, evidenceFacts, context, record.transitionAt,
      record.pressureKey, record.operationFamily, host)
    : previous.closureEvidence;
  const unchangedAttempts = encoded(record.attemptLog).bytes === encoded(previous.attemptLog).bytes;
  const unchangedOutcomes = encoded(record.outcomeLog).bytes === encoded(previous.outcomeLog).bytes;
  if (record.transition === 'stopped') {
    const currentOutcomes = windowAt(previous, record.transitionAt);
    ensure(unchangedAttempts && unchangedOutcomes && previous.pendingAttempts.length === 0
      && record.pendingAttempts.length === 0 && record.attempts === previous.attempts
      && record.totalFailures === previous.totalFailures && record.state === 'stopped'
      && (previous.attempts >= record.policy.maxAttempts
        || record.transitionAt.value - previous.started >= record.policy.maxDuration
        || (previous.state === 'open-breaker' || previous.state === 'half-open')
          && previous.breakerHasOpened === 1
          && record.transitionAt.value - previous.breakerFirstOpened.value >= record.policy.maxOpenDuration),
    'stopped transition lacks an exhausted bound');
    if (record.stoppedSubmission) {
      const lease = latestLease(all as readonly TransportFact[])!.record;
      const expectedSubmission = freeze({
        command: record.command,
        fence: fenceFor(all as readonly TransportFact[], lease),
        episode: { owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode },
        attempt: record.stoppedSubmission.attempt,
      });
      ensure(encoded(record.stoppedSubmission).bytes === encoded(expectedSubmission).bytes,
        'stopped transition has an inconsistent command submission');
    }
    const expected = freeze({
      ...(record.stoppedSubmission ? withoutSubmission(previous) : previous),
      schemaVersion: record.schemaVersion,
      domain: record.domain,
      command: record.command,
      predecessor: record.predecessor,
      authority: record.authority,
      tick: record.tick,
      nextWake: record.transitionAt.value,
      state: 'stopped' as const,
      pending: '',
      transition: 'stopped' as const,
      transitionAt: record.transitionAt,
      nextEligible: record.transitionAt,
      sourceVector: previous.sourceVector,
      policyGeneration: record.policyGeneration,
      failureCount: failureCountAt(record.policy, currentOutcomes),
      outcomeWindowDigest: encoded(currentOutcomes).hash,
      ...(record.stoppedSubmission ? { stoppedSubmission: record.stoppedSubmission } : {}),
    } as SharedLoopRecord);
    ensure(encoded(record).bytes === encoded(expected).bytes,
      'stopped transition differs from the complete policy calculation');
    return;
  }
  if (record.transition === 'attempt-admitted' || record.transition === 'half-opened') {
    ensure(record.attemptLog.length === previous.attemptLog.length + 1 && unchangedOutcomes
      && record.outcomeLog.length === previous.outcomeLog.length
      && record.totalFailures === previous.totalFailures,
    'attempt admission invented another history change');
    const attempt = record.attemptLog.at(-1)!;
    ensure(encoded(attempt.admittedAt).bytes === encoded(record.transitionAt).bytes
      && encoded(record.pendingAttempts).bytes === encoded([...previous.pendingAttempts, attempt.id]).bytes,
    'attempt admission population or clock differs');
    const { mode: _mode, ...input } = attempt;
    const decision = sharedAdmissionDecision(previous, record.transitionAt, input);
    ensure(decision.kind === 'admitted', 'attempt admission differs from the complete policy calculation');
    const currentOutcomes = windowAt(previous, record.transitionAt);
    const expected = freeze({
      ...withoutSubmission(previous),
      schemaVersion: record.schemaVersion,
      domain: record.domain,
      command: record.command,
      predecessor: record.predecessor,
      authority: record.authority,
      tick: record.tick,
      attempts: previous.attempts + 1,
      nextWake: record.transitionAt.value,
      state: decision.state,
      pending: [...previous.pendingAttempts, decision.attempt.id][0]!,
      transition: decision.transition,
      transitionAt: record.transitionAt,
      nextEligible: record.transitionAt,
      sourceVector: previous.sourceVector,
      policyGeneration: record.policyGeneration,
      failureCount: failureCountAt(record.policy, currentOutcomes),
      breakerHasOpened: decision.breakerHasOpened,
      breakerFirstOpened: decision.breakerFirstOpened,
      halfOpenAdmitted: decision.halfOpenAdmitted,
      halfOpenSucceeded: decision.halfOpenSucceeded,
      pendingAttempts: [...previous.pendingAttempts, decision.attempt.id],
      attemptLog: [...previous.attemptLog, decision.attempt],
      outcomeWindowDigest: encoded(currentOutcomes).hash,
      closureEvidence: decision.closureEvidence,
    } as SharedLoopRecord);
    ensure(encoded(record).bytes === encoded(expected).bytes,
      'attempt admission differs from the complete policy calculation');
    return;
  }
  if (record.transition === 'evidence-retained' && record.evidenceSubmission) {
    const submission = record.evidenceSubmission;
    const existing = previous.outcomeLog.find(value => value.attempt === submission.attempt);
    ensure(existing?.kind === 'accepted' && previous.state === 'half-open',
      'partial evidence retention lacks an accepted half-open outcome');
    const lease = latestLease(all as readonly TransportFact[])!.record;
    const expectedSubmission = freeze({
      command: record.command,
      fence: fenceFor(all as readonly TransportFact[], lease),
      episode: { owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode },
      attempt: existing.attempt,
      kind: existing.kind,
      failureClass: existing.failureClass,
      completion: existing.completion,
      jitterPermille: existing.jitterPermille,
      restoration: submission.restoration,
    });
    ensure(encoded(submission).bytes === encoded(expectedSubmission).bytes,
      'partial evidence submission differs from its recorded outcome');
    const completeRestoration = evidenceFacts && context
      ? submission.restoration.filter(reference => restorationReferenceComplete(reference, evidenceFacts, context,
        record.transitionAt, record.pressureKey, record.operationFamily, host, false))
      : submission.restoration.filter(reference => record.closureEvidence.some(value => value.id === reference.id));
    ensure(completeRestoration.length === 0 || previous.pendingAttempts.length > 0
      || previous.halfOpenSucceeded < previous.policy.halfOpenTrials,
    'complete restoration evidence must use the closing transition');
    const closureEvidence = freeze([...new Map([...currentClosureEvidence, ...completeRestoration]
      .map(value => [value.id, value])).values()]);
    const restoration = freeze([...new Map([...existing.restoration, ...submission.restoration]
      .map(value => [value.id, value])).values()]);
    ensure(restoration.length > existing.restoration.length,
      'partial evidence transition lacks new restoration support');
    const outcomeLog = freeze(previous.outcomeLog.map(value => value.attempt === existing.attempt
      ? freeze({ ...value, restoration } as LoopOutcome) : value));
    const currentOutcomes = windowAt({ policy: previous.policy, outcomeLog }, record.transitionAt);
    const expected = freeze({
      ...withoutSubmission(previous),
      schemaVersion: record.schemaVersion,
      domain: record.domain,
      command: record.command,
      predecessor: record.predecessor,
      authority: record.authority,
      tick: record.tick,
      transition: 'evidence-retained' as const,
      transitionAt: record.transitionAt,
      sourceVector: previous.sourceVector,
      policyGeneration: record.policyGeneration,
      outcomeLog,
      closureEvidence,
      failureCount: failureCountAt(record.policy, currentOutcomes),
      outcomeWindowDigest: encoded(currentOutcomes).hash,
      evidenceSubmission: submission,
    } as SharedLoopRecord);
    ensure(encoded(record).bytes === encoded(expected).bytes,
      'partial evidence transition changed the breaker history or closure requirements');
    return;
  }
  if (record.transition === 'closed' && record.closureSubmission) {
    const submission = record.closureSubmission;
    const existing = previous.outcomeLog.find(value => value.attempt === submission.attempt);
    ensure(existing && previous.state === 'half-open' && previous.pendingAttempts.length === 0
      && previous.halfOpenSucceeded >= previous.policy.halfOpenTrials,
    'evidence-only closure lacks completed trials or its submitted outcome');
    const lease = latestLease(all as readonly TransportFact[])!.record;
    const expectedSubmission = freeze({
      command: record.command,
      fence: fenceFor(all as readonly TransportFact[], lease),
      episode: { owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode },
      attempt: existing.attempt,
      kind: existing.kind,
      failureClass: existing.failureClass,
      completion: existing.completion,
      jitterPermille: existing.jitterPermille,
      restoration: submission.restoration,
    });
    ensure(encoded(submission).bytes === encoded(expectedSubmission).bytes,
      'evidence-only closure submission differs from its recorded outcome');
    const completeRestoration = evidenceFacts && context
      ? submission.restoration.filter(reference => restorationReferenceComplete(reference, evidenceFacts, context,
        record.transitionAt, record.pressureKey, record.operationFamily, host, false))
      : submission.restoration.filter(reference => record.closureEvidence.some(value => value.id === reference.id));
    const closureEvidence = freeze([...new Map([...currentClosureEvidence, ...completeRestoration]
      .map(value => [value.id, value])).values()]);
    ensure(completeRestoration.some(reference => !previous.closureEvidence.some(old => old.id === reference.id)),
      'evidence-only closure lacks new complete restoration support');
    const restoration = freeze([...new Map([...existing.restoration, ...submission.restoration]
      .map(value => [value.id, value])).values()]);
    const outcomeLog = freeze(previous.outcomeLog.map(value => value.attempt === existing.attempt
      ? freeze({ ...value, restoration } as LoopOutcome) : value));
    const currentOutcomes = windowAt({ policy: previous.policy, outcomeLog }, record.transitionAt);
    const expected = freeze({
      ...withoutSubmission(previous),
      schemaVersion: record.schemaVersion,
      domain: record.domain,
      command: record.command,
      predecessor: record.predecessor,
      authority: record.authority,
      tick: record.tick,
      nextWake: record.transitionAt.value,
      state: 'closed' as const,
      pending: '',
      transition: 'closed' as const,
      transitionAt: record.transitionAt,
      nextEligible: record.transitionAt,
      sourceVector: previous.sourceVector,
      policyGeneration: record.policyGeneration,
      outcomeLog,
      closureEvidence,
      failureCount: failureCountAt(record.policy, currentOutcomes),
      outcomeWindowDigest: encoded(currentOutcomes).hash,
      closureSubmission: submission,
    } as SharedLoopRecord);
    ensure(encoded(record).bytes === encoded(expected).bytes,
      'evidence-only closure changed the submitted evidence or breaker history');
    return;
  }
  if (record.transition === 'closed' && unchangedAttempts && unchangedOutcomes) {
    ensure(previous.state === 'half-open' && previous.pendingAttempts.length === 0
      && previous.halfOpenSucceeded >= previous.policy.halfOpenTrials
      && exactPrefix(previous.closureEvidence, record.closureEvidence)
      && record.closureEvidence.length > previous.closureEvidence.length,
    'evidence-only closure lacks completed trials or new restoration support');
    const currentOutcomes = windowAt(previous, record.transitionAt);
    const expected = freeze({
      ...withoutSubmission(previous),
      schemaVersion: record.schemaVersion,
      domain: record.domain,
      command: record.command,
      predecessor: record.predecessor,
      authority: record.authority,
      tick: record.tick,
      nextWake: record.transitionAt.value,
      state: 'closed' as const,
      pending: '',
      transition: 'closed' as const,
      transitionAt: record.transitionAt,
      nextEligible: record.transitionAt,
      sourceVector: previous.sourceVector,
      policyGeneration: record.policyGeneration,
      closureEvidence: record.closureEvidence,
      failureCount: failureCountAt(record.policy, currentOutcomes),
      outcomeWindowDigest: encoded(currentOutcomes).hash,
    } as SharedLoopRecord);
    ensure(encoded(record).bytes === encoded(expected).bytes,
      'evidence-only closure changed the recorded completion or breaker history');
    return;
  }
  ensure(record.outcomeLog.length === previous.outcomeLog.length + 1 && unchangedAttempts,
    'outcome transition must add exactly one witnessed completion');
  const added = record.outcomeLog.find(outcome =>
    !previous.outcomeLog.some(old => old.attempt === outcome.attempt));
  ensure(added && previous.pendingAttempts.includes(added.attempt), 'outcome completion was not pending');
  const attempt = previous.attemptLog.find(value => value.id === added.attempt)!;
  ensure(encoded(added.recordedAt).bytes === encoded(record.transitionAt).bytes,
    'outcome recording time differs from its introducing transition');
  ensure(atOrAfter(added.observedAt, attempt.admittedAt) && atOrAfter(record.transitionAt, added.observedAt),
    'outcome evidence or receipt clock precedes its admission');
  ensure(encoded(record.outcomeLog).bytes === encoded(sortedOutcomes(record.outcomeLog)).bytes,
    'outcome population is not canonically ordered');
  ensure(encoded(record.pendingAttempts).bytes
    === encoded(previous.pendingAttempts.filter(id => id !== added.attempt)).bytes,
  'outcome changed the pending population');
  const completeRestoration = evidenceFacts && context
    ? added.restoration.filter(reference => restorationReferenceComplete(reference, evidenceFacts, context,
      record.transitionAt, record.pressureKey, record.operationFamily, host, false))
    : added.restoration.filter(reference => record.closureEvidence.some(value => value.id === reference.id));
  const expected = sharedOutcomeDecision({ ...previous, closureEvidence: currentClosureEvidence },
    added, record.transitionAt, completeRestoration);
  const successor = freeze({
    ...withoutSubmission(previous),
    schemaVersion: record.schemaVersion,
    domain: record.domain,
    command: record.command,
    predecessor: record.predecessor,
    authority: record.authority,
    tick: record.tick,
    nextWake: expected.nextEligible.value,
    state: expected.state,
    pending: expected.pendingAttempts[0] ?? '',
    transition: expected.transition,
    transitionAt: record.transitionAt,
    nextEligible: expected.nextEligible,
    sourceVector: previous.sourceVector,
    policyGeneration: record.policyGeneration,
    totalFailures: expected.totalFailures,
    failureCount: expected.failureCount,
    breakerHasOpened: expected.breakerHasOpened,
    breakerOpenCount: expected.breakerOpenCount,
    breakerFirstOpened: expected.breakerFirstOpened,
    halfOpenAdmitted: expected.halfOpenAdmitted,
    halfOpenSucceeded: expected.halfOpenSucceeded,
    pendingAttempts: expected.pendingAttempts,
    outcomeLog: expected.outcomeLog,
    outcomeWindowDigest: expected.outcomeWindowDigest,
    closureEvidence: expected.closureEvidence,
  } as SharedLoopRecord);
  ensure(encoded(record).bytes === encoded(successor).bytes,
    'breaker decision differs from the complete admitted outcome frontier');
}

export function validateA1Transition(record: SharedLoopRecord, all: readonly LoopA1TransportFact[],
  host: LoopA1Host, origin = false, evidenceFacts?: readonly FactEnvelope[], context?: FactContext): void {
  ensure(record.domain === host.domain && record.schemaVersion === 1 && record.command.length > 0 && record.tick >= 0,
    'record domain or identity');
  ensure(record.predecessor === (all.at(-1)?.fact.id ?? ''), 'conditional predecessor changed');
  ensure(!all.some(value => value.record.command === record.command), 'command already committed');
  const lease = latestLease(all as readonly TransportFact[])?.record;
  ensure(lease && lease.state === 'held' && lease.authority === record.authority && lease.expires > record.tick,
    'stale lease at boundary');
  validateSharedLoopHistory(record, all, host, origin, evidenceFacts, context);
}

function validateIssuer(host: LoopA1Host, origin: FactEnvelope, past: readonly LoopA1TransportFact[]): void {
  ensure(origin.machine === host.machine && origin.principal.id === host.principal.id
    && origin.principal.kind === host.principal.kind, 'issuer is not this authority');
  ensure(past.every(({ fact }) => fact.machine === host.machine && fact.principal.id === host.principal.id
    && fact.principal.kind === host.principal.kind), 'predecessor issuer is not this authority');
}

export function registerLoopA1Bodies(host: LoopA1Host, context: BoundaryContext): Result<readonly OwnedBodyRegistration[]> {
  return boundary('LoopA1Registrations', null, context, () => Object.entries(loopA1Shapes).map(([name, shape]) =>
    take(registerOwnedBody({
      name,
      owner: 'part-six',
      currentVersion: 1,
      versions: { 1: { validate: value => ({ ok: true, value }) } },
      migrations: {},
      decodeCurrent: (input, decodeContext) => {
        try {
          if (name === sharedLoopPolicyOwnedName) {
            rejectUnsupportedSliceA1Fields(input);
            shapeCheck(input, shape);
            ensure(isStoredSharedLoopPolicy(input), 'owned type mismatch');
            sharedPolicyCheck(loadSharedLoopPolicy(input));
          } else {
            rejectRequestExtensions(input);
            rejectUnsupportedSliceA1Fields((input as { policy?: unknown })?.policy);
            shapeCheck(input, shape);
            ensure(name === sharedLoopRecordOwnedName && isStoredSharedLoopRecord(input), 'owned type mismatch');
            const record = loadSharedLoopRecord(input);
            sharedLoopRecordCheck(record);
            const logicalCopies = allFacts([...decodeContext.facts.facts, decodeContext.origin])
              .filter(fact => fact.kind === sharedLoopRecordFactKind)
              .filter(fact => {
                const stored = (fact.body as { record?: unknown }).record;
                return isStoredSharedLoopRecord(stored)
                  && loadSharedLoopRecord(stored).domain === record.domain
                  && loadSharedLoopRecord(stored).command === record.command;
              });
            collapseSignedRecordCopies(logicalCopies,
              fact => (fact.body as { record: Json }).record, {
                absent: 'shared loop record is absent',
                conflict: 'shared loop record is conflicted',
              }, undefined, decodeContext.origin.id);
            const duplicate = logicalCopies.some(fact => fact.id !== decodeContext.origin.id);
            const cone = causalCone(decodeContext.origin, decodeContext.facts.facts);
            const past = rowsA1(cone, host.domain);
            validateIssuer(host, decodeContext.origin, past);
            const candidate = !decodeContext.facts.facts.some(fact => fact.id === decodeContext.origin.id);
            if (candidate && !duplicate) noteAccountingCandidate(host);
            const admitting = decodeContext.mode === 'origin' && candidate && !duplicate;
            if (!duplicate) validateA1Transition(record, past, host, admitting, cone, decodeContext.facts);
            resolveSharedLoopEvidence(record, decodeContext.origin,
              decodeContext.facts.facts, decodeContext.facts, host);
            if (decodeContext.mode === 'origin' && !duplicate) {
              live(host);
              const now = host.monotonic();
              ensure(record.authority === host.authorityIncarnation && record.tick <= now
                && !past.some(row => row.record.authority === record.authority && row.record.tick > record.tick),
              'untrusted authority clock or incarnation');
              ensure(record.predecessor === (rowsA1(decodeContext.facts.facts, host.domain).at(-1)?.fact.id ?? ''),
                'stale origin predecessor');
              const lease = latestLease(past as readonly TransportFact[])?.record;
              ensure(lease?.incarnation === host.incarnation && lease.authority === host.authorityIncarnation
                && lease.expires > now && lease.generation === host.current().generation.id,
              'stale owner at durable boundary');
            }
          }
          return { ok: true, value: freeze(input) };
        } catch (error) {
          return { ok: false, detail: error instanceof Error ? error.message : 'transport loop A1 record refused' };
        }
      },
    }, loopA1AdmissionShape(shape), context))));
}

export function liveLoopA1Host(host: LoopA1Host): void {
  const current = host.current();
  ensure(!current.stopped, 'stop prohibits new admission');
  ensure(current.generation.owner === 'part-three' && current.generation.name === 'RegisterGeneration'
    && current.generation.id === current.decode.register.generation.id, 'current generation mismatch');
  const principal = take(decode('VerifiedPrincipal', host.principal,
    { ...current.decode, provenance: host.principal.provenance }));
  const scope = take(decode('Scope', host.scope, current.decode));
  const now = take(decodeMeasurement('clock', current.clock, current.decode));
  const grants = (current.decode.grants ?? []).map(grant =>
    take(decode('StandingGrant', grant, { ...current.decode, provenance: grant.source })));
  ensure(grants.some(grant => grant.grantee.id === principal.id
    && grantLiveness(grant, current.decode.revocations ?? [], now) === 'live'
    && scopeIncludes(grant.scope, scope)
    && (grant.standing === 'operator' || grant.actions.includes('work'))),
  'current standing does not cover transport admission');
}

export function checkLoopA1Fence(all: readonly LoopA1TransportFact[], token: Parameters<typeof checkFence>[1],
  host: LoopA1Host, tick: number): Lease {
  return checkFence(all as readonly TransportFact[], token, host, tick);
}

export function currentFenceFor(all: readonly LoopA1TransportFact[], lease: Lease) {
  return fenceFor(all as readonly TransportFact[], lease);
}
