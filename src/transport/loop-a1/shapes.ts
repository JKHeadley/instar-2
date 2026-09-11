import type { OwnedShape } from '../../facts/index.js';
import { encoded, ensure, freeze } from '../boundary.js';
import type { SharedBreakerLoopPolicy, SharedLoopRecord, StoredSharedLoopPolicy, StoredSharedLoopRecord } from './contracts.js';

const txt = { kind: 'text', maxLength: 256 } as const;
const int = { kind: 'integer' } as const;
const common = { type: txt, schemaVersion: int };
const row = { ...common, domain: txt, command: txt, predecessor: txt, authority: txt, tick: int };
const reference: OwnedShape = { kind: 'object', fields: { owner: txt, name: txt, id: txt } };
const constitutionalOutcome: OwnedShape = {
  kind: 'object',
  fields: { type: txt, id: txt, fact: reference, field: txt },
};
const fence: OwnedShape = {
  kind: 'object',
  fields: {
    ...common,
    domain: txt,
    epoch: int,
    assignment: txt,
    holder: txt,
    machine: txt,
    incarnation: txt,
    authority: txt,
    generation: txt,
  },
};
const clock: OwnedShape = {
  kind: 'object',
  fields: {
    type: txt,
    schemaVersion: int,
    subject: { kind: 'object', fields: { kind: txt, instance: txt } },
    value: int,
    unit: txt,
    at: int,
    by: txt,
  },
};
export const loopA1ExcludedPolicyFields = [
  'parentDuty',
  'budgetWindow',
  'parentAttemptBudget',
  'parentResourceBudget',
  'resourceBudget',
  'attemptBudget',
  'cursor',
  'scanCursor',
  'cursorKind',
] as const;
export const loopA1ExcludedRecordFields = [...loopA1ExcludedPolicyFields, 'concurrency'] as const;
const policyFields = {
  ...common,
  id: txt,
  maxAttempts: int,
  minDelay: int,
  maxDuration: int,
  timeout: int,
  concurrency: int,
  failDirection: txt,
  breaker: txt,
  initialDelay: int,
  maxDelay: int,
  backoffMultiplier: int,
  jitterMinPermille: int,
  jitterMaxPermille: int,
  failureThreshold: int,
  countedFailureClasses: { kind: 'array', maxLength: 64, items: txt } as OwnedShape,
  acceptedOutcomeWindow: int,
  breakerCooldown: int,
  maxOpenDuration: int,
  halfOpenTrials: int,
  halfOpenConcurrency: int,
  closeEvidence: txt,
  reopenEvidence: txt,
  parentDuty: reference,
  budgetWindow: int,
  parentAttemptBudget: int,
  parentResourceBudget: int,
  resourceBudget: int,
  attemptBudget: int,
  cursor: txt,
  scanCursor: reference,
  cursorKind: txt,
};
const policy: OwnedShape = {
  kind: 'object',
  fields: policyFields,
  optional: [...loopA1ExcludedPolicyFields],
};
const loopAttempt: OwnedShape = {
  kind: 'object',
  fields: { id: txt, episode: txt, admittedAt: clock, mode: txt },
};
const loopOutcome: OwnedShape = {
  kind: 'object',
  fields: {
    attempt: txt,
    kind: txt,
    failureClass: txt,
    observedAt: clock,
    recordedAt: clock,
    completion: constitutionalOutcome,
    jitterPermille: int,
    restoration: { kind: 'array', maxLength: 64, items: reference },
  },
};
const stoppedSubmission: OwnedShape = {
  kind: 'object',
  fields: { command: txt, fence, episode: reference, attempt: txt },
};
const closureSubmission: OwnedShape = {
  kind: 'object',
  fields: {
    command: txt,
    fence,
    episode: reference,
    attempt: txt,
    kind: txt,
    failureClass: txt,
    completion: constitutionalOutcome,
    jitterPermille: int,
    restoration: { kind: 'array', maxLength: 64, items: reference },
  },
};
export const sharedLoopRecordShape: OwnedShape = {
  kind: 'object',
  optional: [...loopA1ExcludedRecordFields, 'stoppedSubmission', 'closureSubmission', 'evidenceSubmission'],
  fields: {
    ...row,
    ...Object.fromEntries(loopA1ExcludedRecordFields.map(field => [field, policyFields[field]])),
    run: txt,
    episode: txt,
    policy,
    attempts: int,
    started: int,
    nextWake: int,
    state: txt,
    pending: txt,
    currentOwnerRun: reference,
    policyGeneration: reference,
    pressureBinding: reference,
    operationFamily: txt,
    pressureScope: { kind: 'object', fields: { target: txt, conversation: txt, machine: txt, pool: txt } },
    pressureKey: txt,
    episodeKey: txt,
    transition: txt,
    transitionAt: clock,
    nextEligible: clock,
    clockBasis: txt,
    sourceVector: reference,
    totalFailures: int,
    failureCount: int,
    breakerHasOpened: int,
    breakerOpenCount: int,
    breakerFirstOpened: clock,
    halfOpenAdmitted: int,
    halfOpenSucceeded: int,
    pendingAttempts: { kind: 'array', maxLength: 4096, items: txt },
    attemptLog: { kind: 'array', maxLength: 4096, items: loopAttempt },
    outcomeLog: { kind: 'array', maxLength: 4096, items: loopOutcome },
    outcomeWindowDigest: txt,
    closureEvidence: { kind: 'array', maxLength: 64, items: reference },
    stoppedSubmission,
    closureSubmission,
    evidenceSubmission: closureSubmission,
  },
};

export const loopA1Shapes: Readonly<Record<string, OwnedShape>> = freeze({
  SharedBreakerLoopPolicy: policy,
  SharedLoopRecord: sharedLoopRecordShape,
});
/**
 * Part Two validates this shape before the A1 decoder runs. Excluded optional
 * names therefore remain admitted as names, but have no child shape whose value
 * could pre-empt A1's presence-based typed refusal.
 */
export function loopA1AdmissionShape(shape: OwnedShape): OwnedShape {
  if (shape.kind === 'array') return { ...shape, items: loopA1AdmissionShape(shape.items) };
  if (shape.kind !== 'object') return shape;
  return {
    ...shape,
    fields: Object.fromEntries(Object.entries(shape.fields)
      .filter(([key]) => !shape.optional?.includes(key))
      .map(([key, child]) => [key, loopA1AdmissionShape(child)])),
  };
}

export const sharedLoopPolicyOwnedName = 'SharedBreakerLoopPolicy';
export const sharedLoopRecordOwnedName = 'SharedLoopRecord';
export const sharedLoopRecordFactKind = 'transport-SharedLoopRecord';

export function shapeCheck(value: unknown, shape: OwnedShape): void {
  if (shape.kind === 'text') {
    ensure(typeof value === 'string' && value.length <= shape.maxLength, 'bounded text required');
    return;
  }
  if (shape.kind === 'integer') {
    ensure(Number.isSafeInteger(value), 'safe integer required');
    return;
  }
  if (shape.kind === 'boolean') {
    ensure(typeof value === 'boolean', 'boolean required');
    return;
  }
  if (shape.kind === 'null') {
    ensure(value === null, 'null required');
    return;
  }
  if (shape.kind === 'array') {
    ensure(Array.isArray(value) && value.length <= shape.maxLength, 'bounded array required');
    value.forEach(item => shapeCheck(item, shape.items));
    return;
  }
  ensure(shape.kind === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value), 'closed object required');
  const record = value as Record<string, unknown>;
  const required = Object.keys(shape.fields).filter(key => !shape.optional?.includes(key));
  ensure(required.every(key => Object.hasOwn(record, key))
    && Object.keys(record).every(key => Object.hasOwn(shape.fields, key)), 'undeclared or missing field');
  for (const [key, child] of Object.entries(shape.fields)) {
    if (Object.hasOwn(record, key)) shapeCheck(record[key], child);
  }
}

export function hasA1PolicyMarker(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    && (Object.hasOwn(input, 'initialDelay') || (input as { type?: unknown }).type === 'SharedBreakerLoopPolicy');
}
export function isSharedLoopPolicy(input: unknown): input is SharedBreakerLoopPolicy {
  return hasA1PolicyMarker(input) && (input as { breaker?: unknown }).breaker === 'shared-circuit-v1';
}
export function isStoredSharedLoopPolicy(input: unknown): input is StoredSharedLoopPolicy {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    && (input as { type?: unknown }).type === 'SharedBreakerLoopPolicy'
    && (input as { breaker?: unknown }).breaker === 'shared-circuit-v1';
}
export function isStoredSharedLoopRecord(input: unknown): input is StoredSharedLoopRecord {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    && (input as { type?: unknown }).type === 'SharedLoopRecord'
    && isSharedLoopPolicy((input as { policy?: unknown }).policy);
}
export function storeSharedLoopPolicy(value: SharedBreakerLoopPolicy): StoredSharedLoopPolicy {
  return freeze({ ...value, type: 'SharedBreakerLoopPolicy' as const });
}
export function loadSharedLoopPolicy(value: StoredSharedLoopPolicy): SharedBreakerLoopPolicy {
  return freeze({ ...value, type: 'LoopPolicy' as const }) as SharedBreakerLoopPolicy;
}
export function storeSharedLoopRecord(value: SharedLoopRecord): StoredSharedLoopRecord {
  return freeze({ ...value, type: 'SharedLoopRecord' as const });
}
export function loadSharedLoopRecord(value: StoredSharedLoopRecord): SharedLoopRecord {
  return freeze({ ...value, type: 'LoopRecord' as const }) as SharedLoopRecord;
}

export function rejectUnsupportedSliceA1Fields(input: unknown): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return;
  ensure(!Object.keys(input).some(key => loopA1ExcludedPolicyFields
    .includes(key as typeof loopA1ExcludedPolicyFields[number])),
    'unsupported-in-slice-a1');
}
export function rejectTransitionExtensions(input: unknown): void {
  rejectRequestExtensions(input);
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return;
  ensure(!Object.keys(input).some(key => ['sourceVector', 'holderFamily', 'worker', 'machine', 'resource'].includes(key)),
    'unsupported-in-slice-a1');
}
export function rejectRequestExtensions(input: unknown): void {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return;
  ensure(!Object.keys(input).some(key => loopA1ExcludedRecordFields
    .includes(key as typeof loopA1ExcludedRecordFields[number])), 'unsupported-in-slice-a1');
}
export function requireOpaqueSourceReference(input: unknown): asserts input is SharedLoopRecord['sourceVector'] {
  ensure(input !== null && typeof input === 'object' && !Array.isArray(input), 'unsupported-in-slice-a1');
  const reference = input as { owner?: unknown; name?: unknown; id?: unknown };
  ensure(reference.owner === 'part-two' && reference.name === 'FactEnvelope'
    && typeof reference.id === 'string' && reference.id.length > 0, 'unsupported-in-slice-a1');
}
export function sharedPolicyCheck(value: SharedBreakerLoopPolicy): void {
  rejectUnsupportedSliceA1Fields(value);
  shapeCheck(value, policy);
  ensure(value.type === 'LoopPolicy' && value.schemaVersion === 1 && value.id.length > 0, 'policy identity');
  ensure(value.maxAttempts >= 0 && value.maxDuration >= 0 && value.minDelay > 0 && value.timeout > 0,
    'finite nonnegative bounds and positive delays required');
  ensure(value.breaker === 'shared-circuit-v1', 'unsupported loop policy');
  ensure(value.failDirection === 'closed', 'unsupported loop fail direction');
  ensure(value.concurrency === 1, 'unsupported-in-slice-a1');
  ensure(value.initialDelay > 0 && value.initialDelay >= value.minDelay && value.maxDelay >= value.initialDelay
    && value.backoffMultiplier >= 1 && value.jitterMinPermille >= 0
    && value.jitterMaxPermille >= value.jitterMinPermille && value.jitterMaxPermille <= 1000,
  'invalid delay, multiplier, or jitter bounds');
  ensure(value.failureThreshold > 0 && value.countedFailureClasses.length > 0
    && new Set(value.countedFailureClasses).size === value.countedFailureClasses.length
    && value.countedFailureClasses.every(item => item.length > 0), 'invalid counted failure policy');
  ensure(value.acceptedOutcomeWindow > 0 && value.breakerCooldown > 0
    && value.maxOpenDuration >= value.breakerCooldown && value.halfOpenTrials >= 0
    && value.halfOpenConcurrency >= 0 && value.halfOpenConcurrency <= value.halfOpenTrials
    && value.halfOpenConcurrency <= 1, 'invalid breaker window, cooldown, or half-open bounds');
  ensure(value.closeEvidence === 'part-nine-restoration' && value.reopenEvidence === 'counted-failure',
    'unsupported breaker evidence contract');
}

function referenceCheck(value: { readonly owner: string; readonly name: string; readonly id: string }, owner: string, name: string): void {
  ensure(value.owner === owner && value.name === name && value.id.length > 0, `${name} reference owner`);
}
export function sharedLoopRecordCheck(shared: SharedLoopRecord): void {
  ensure(!Object.keys(shared).some(key => loopA1ExcludedRecordFields
    .includes(key as typeof loopA1ExcludedRecordFields[number])),
    'unsupported-in-slice-a1');
  shapeCheck(shared, sharedLoopRecordShape);
  ensure(shared.type === 'LoopRecord' && shared.schemaVersion === 1 && shared.run.length > 0 && shared.episode.length > 0,
    'loop record identity');
  sharedPolicyCheck(shared.policy);
  requireOpaqueSourceReference(shared.sourceVector);
  ensure(['scheduled', 'running', 'restoring', 'waiting', 'open-breaker', 'half-open', 'stopped', 'closed'].includes(shared.state)
    && ['scheduled', 'attempt-admitted', 'outcome-recorded', 'opened', 'half-opened', 'reopened', 'evidence-retained', 'closed', 'stopped'].includes(shared.transition),
  'unknown shared loop state or transition');
  referenceCheck(shared.currentOwnerRun, 'part-five', 'Run');
  referenceCheck(shared.policyGeneration, 'part-three', 'RegisterGeneration');
  referenceCheck(shared.pressureBinding, 'part-two', 'FactEnvelope');
  ensure(shared.run === shared.currentOwnerRun.id, 'shared loop run differs from its witnessed current owner');
  ensure(shared.operationFamily.length > 0 && Object.values(shared.pressureScope).every(value => value.length > 0)
    && shared.pressureKey === `pressure:${encoded([shared.operationFamily, shared.pressureScope]).hash}`,
  'shared pressure identity changed');
  ensure(shared.episode === `loop:${encoded([shared.pressureKey, shared.episodeKey]).hash}` && shared.episodeKey.length > 0,
    'shared episode identity changed');
  ensure(shared.clockBasis === shared.transitionAt.subject.instance
    && shared.nextEligible.subject.instance === shared.clockBasis
    && shared.breakerFirstOpened.subject.instance === shared.clockBasis, 'incomparable shared loop time');
  ensure(shared.attempts === shared.attemptLog.length && shared.attempts <= shared.policy.maxAttempts
    && shared.totalFailures >= shared.failureCount, 'shared loop counters disagree');
  ensure(shared.breakerHasOpened === 0 || shared.breakerHasOpened === 1, 'invalid breaker-open marker');
  ensure(shared.breakerOpenCount >= shared.breakerHasOpened, 'invalid breaker-open count');
  ensure(new Set(shared.pendingAttempts).size === shared.pendingAttempts.length
    && shared.pending === (shared.pendingAttempts[0] ?? ''), 'pending attempts disagree');
  ensure(shared.outcomeLog.length <= shared.attemptLog.length
    && new Set(shared.attemptLog.map(attempt => attempt.id)).size === shared.attemptLog.length
    && new Set(shared.outcomeLog.map(outcome => outcome.attempt)).size === shared.outcomeLog.length,
  'shared loop attempt population is incomplete or duplicated');
  ensure(shared.outcomeLog.every(outcome => shared.attemptLog.some(attempt => attempt.id === outcome.attempt)),
    'outcome lacks contributing attempt');
  const unfinished = shared.attemptLog.filter(attempt => !shared.outcomeLog.some(outcome => outcome.attempt === attempt.id))
    .map(attempt => attempt.id);
  ensure(encoded(shared.pendingAttempts).bytes === encoded(unfinished).bytes,
    'pending attempts do not equal admitted attempts minus completed attempts');
  for (const outcome of shared.outcomeLog) {
    ensure(outcome.jitterPermille >= shared.policy.jitterMinPermille
      && outcome.jitterPermille <= shared.policy.jitterMaxPermille, 'outcome jitter outside pinned policy');
    ensure(outcome.kind === 'accepted' || outcome.kind === 'failed', 'unknown loop outcome');
    ensure(outcome.completion.type === 'Outcome' && outcome.completion.id.length > 0,
      'loop outcome requires an owner Outcome completion');
    referenceCheck(outcome.completion.fact, 'part-two', 'FactEnvelope');
    outcome.restoration.forEach(value => referenceCheck(value, 'part-nine', 'VerificationAssessment'));
  }
  ensure(/^sha256:[a-f0-9]{64}$/.test(shared.outcomeWindowDigest), 'invalid outcome window digest');
  shared.closureEvidence.forEach(value => referenceCheck(value, 'part-nine', 'VerificationAssessment'));
  ensure([shared.stoppedSubmission, shared.closureSubmission, shared.evidenceSubmission]
    .filter(Boolean).length <= 1, 'shared loop record has conflicting submissions');
  if (shared.stoppedSubmission) {
    ensure(shared.transition === 'stopped' && shared.stoppedSubmission.command === shared.command,
      'stopped submission differs from its transition');
    referenceCheck(shared.stoppedSubmission.episode, 'part-six', 'LoopRecord');
    ensure(shared.stoppedSubmission.episode.id === shared.episode && shared.stoppedSubmission.attempt.length > 0,
      'stopped submission names another episode or empty attempt');
  }
  if (shared.closureSubmission) {
    ensure(shared.transition === 'closed' && shared.closureSubmission.command === shared.command,
      'closure submission differs from its transition');
    referenceCheck(shared.closureSubmission.episode, 'part-six', 'LoopRecord');
    ensure(shared.closureSubmission.episode.id === shared.episode && shared.closureSubmission.attempt.length > 0,
      'closure submission names another episode or empty attempt');
  }
  if (shared.evidenceSubmission) {
    ensure(shared.transition === 'evidence-retained' && shared.evidenceSubmission.command === shared.command,
      'evidence submission differs from its transition');
    referenceCheck(shared.evidenceSubmission.episode, 'part-six', 'LoopRecord');
    ensure(shared.evidenceSubmission.episode.id === shared.episode && shared.evidenceSubmission.attempt.length > 0,
      'evidence submission names another episode or empty attempt');
  }
}
