import type { OwnedShape } from '../facts/index.js';
import type { SharedBreakerLoopPolicy, SharedLoopRecord } from './contracts.js';
import { encoded, ensure, freeze } from './boundary.js';

const txt = { kind: 'text', maxLength: 256 } as const;
const int = { kind: 'integer' } as const;
const common = { type: txt, schemaVersion: int };
const row = { ...common, domain: txt, command: txt, predecessor: txt, authority: txt, tick: int };
const reference: OwnedShape = { kind: 'object', fields: { owner: txt, name: txt, id: txt } };
const constitutionalResult: OwnedShape = { kind: 'object', fields: { type: txt, id: txt, fact: reference, field: txt } };
const clock: OwnedShape = { kind: 'object', fields: { type: txt, schemaVersion: int,
  subject: { kind: 'object', fields: { kind: txt, instance: txt } }, value: int, unit: txt, at: int, by: txt } };
const vectorEntry: OwnedShape = { kind: 'object', fields: { machine: txt, epoch: int, position: int } };
const sourceVector: OwnedShape = { kind: 'array', maxLength: 4096, items: vectorEntry };
const policyFields = { ...common, id: txt, maxAttempts: int, minDelay: int, maxDuration: int, timeout: int,
  concurrency: int, failDirection: txt, breaker: txt, initialDelay: int, maxDelay: int, backoffMultiplier: int,
  jitterMinPermille: int, jitterMaxPermille: int, failureThreshold: int,
  countedFailureClasses: { kind: 'array', maxLength: 64, items: txt } as OwnedShape,
  acceptedOutcomeWindow: int, breakerCooldown: int, maxOpenDuration: int,
  halfOpenTrials: int, halfOpenConcurrency: int, closeEvidence: txt, reopenEvidence: txt,
  parentDuty: reference, budgetWindow: int, parentAttemptBudget: int, parentResourceBudget: int };
const sharedPolicyFields = ['initialDelay', 'maxDelay', 'backoffMultiplier', 'jitterMinPermille', 'jitterMaxPermille',
  'failureThreshold', 'countedFailureClasses', 'acceptedOutcomeWindow', 'breakerCooldown', 'maxOpenDuration',
  'halfOpenTrials', 'halfOpenConcurrency', 'closeEvidence', 'reopenEvidence', 'parentDuty', 'budgetWindow',
  'parentAttemptBudget', 'parentResourceBudget'];
const policy: OwnedShape = { kind: 'object', fields: policyFields };
export const compatibleLoopPolicyShape: OwnedShape = { kind: 'object', fields: policyFields, optional: sharedPolicyFields };
const loopAttempt: OwnedShape = { kind: 'object', fields: { id: txt, holderFamily: txt, worker: txt, machine: txt,
  episode: txt, admittedAt: clock, resource: int, mode: txt, sourceVector } };
const loopOutcome: OwnedShape = { kind: 'object', fields: { attempt: txt, kind: txt, failureClass: txt,
  observedAt: clock, completion: constitutionalResult, jitterPermille: int,
  restoration: { kind: 'array', maxLength: 64, items: reference }, sourceVector } };
const managedLoopFields = {
  parentDuty: reference, currentOwnerRun: reference, policyGeneration: reference, pressureBinding: reference,
  operationFamily: txt,
  pressureScope: { kind: 'object', fields: { target: txt, conversation: txt, machine: txt, pool: txt } } as OwnedShape,
  pressureKey: txt, episodeKey: txt, transition: txt, transitionAt: clock, nextEligible: clock,
  clockBasis: txt, sourceVector, episodeAttempts: int, totalFailures: int, failureCount: int,
  rollingAttempts: int, rollingResource: int, breakerHasOpened: int, breakerOpenCount: int, breakerFirstOpened: clock,
  halfOpenAdmitted: int, halfOpenSucceeded: int,
  pendingAttempts: { kind: 'array', maxLength: 4096, items: txt } as OwnedShape,
  attemptLog: { kind: 'array', maxLength: 4096, items: loopAttempt } as OwnedShape,
  outcomeLog: { kind: 'array', maxLength: 4096, items: loopOutcome } as OwnedShape,
  outcomeWindowDigest: txt, closureEvidence: { kind: 'array', maxLength: 64, items: reference } as OwnedShape,
};

export const sharedLoopRecordShape: OwnedShape = { kind: 'object', fields: { ...row, run: txt, episode: txt, policy,
  attempts: int, started: int, nextWake: int, state: txt, pending: txt, ...managedLoopFields } };
export const transportSeamShapes: Readonly<Record<string, OwnedShape>> = freeze({
  SharedLoopRecord: sharedLoopRecordShape,
});
export const sharedLoopPolicyOwnedName = 'LoopPolicy';
export const sharedLoopRecordOwnedName = 'SharedLoopRecord';
export const sharedLoopRecordFactKind = 'transport-SharedLoopRecord';
export type StoredSharedLoopRecord = Omit<SharedLoopRecord, 'type'> & { readonly type: 'SharedLoopRecord' };

export function seamShapeCheck(v: unknown, shape: OwnedShape): void {
  if (shape.kind === 'text') { ensure(typeof v === 'string' && v.length <= shape.maxLength, 'bounded text required'); return; }
  if (shape.kind === 'integer') { ensure(Number.isSafeInteger(v), 'safe integer required'); return; }
  if (shape.kind === 'boolean') { ensure(typeof v === 'boolean', 'boolean required'); return; }
  if (shape.kind === 'null') { ensure(v === null, 'null required'); return; }
  if (shape.kind === 'array') {
    ensure(Array.isArray(v) && v.length <= shape.maxLength, 'bounded array required');
    v.forEach(value => seamShapeCheck(value, shape.items)); return;
  }
  ensure(shape.kind === 'object' && v !== null && typeof v === 'object' && !Array.isArray(v), 'closed object required');
  const record = v as Record<string, unknown>;
  ensure(Object.keys(record).length === Object.keys(shape.fields).length, 'undeclared or missing field');
  for (const [key, field] of Object.entries(shape.fields)) {
    ensure(Object.hasOwn(record, key), `missing ${key}`); seamShapeCheck(record[key], field);
  }
}

export function isSharedLoopPolicy(input: unknown): input is SharedBreakerLoopPolicy {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    && (input as { breaker?: unknown }).breaker === 'shared-circuit-v1';
}

export function isSharedLoopRecord(input: unknown): input is SharedLoopRecord {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    && (input as { type?: unknown }).type === 'LoopRecord'
    && isSharedLoopPolicy((input as { policy?: unknown }).policy);
}

export function isStoredSharedLoopRecord(input: unknown): input is StoredSharedLoopRecord {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    && (input as { type?: unknown }).type === 'SharedLoopRecord'
    && isSharedLoopPolicy((input as { policy?: unknown }).policy);
}

export function storeSharedLoopRecord(record: SharedLoopRecord): StoredSharedLoopRecord {
  return freeze({ ...record, type: 'SharedLoopRecord' as const });
}

export function loadSharedLoopRecord(record: StoredSharedLoopRecord): SharedLoopRecord {
  return freeze({ ...record, type: 'LoopRecord' as const }) as SharedLoopRecord;
}

export function sharedPolicyCheck(p: SharedBreakerLoopPolicy): void {
  seamShapeCheck(p, policy);
  ensure(p.type === 'LoopPolicy' && p.schemaVersion === 1 && p.id.length > 0, 'policy identity');
  ensure(p.maxAttempts >= 0 && p.maxDuration >= 0 && p.minDelay > 0 && p.timeout > 0,
    'finite nonnegative bounds and positive delays required');
  ensure(p.breaker === 'shared-circuit-v1', 'unsupported loop policy');
  ensure(p.failDirection === 'closed', 'unsupported loop fail direction');
  ensure(p.concurrency >= 0 && p.initialDelay > 0 && p.initialDelay >= p.minDelay && p.maxDelay >= p.initialDelay
    && p.backoffMultiplier >= 1 && p.jitterMinPermille >= 0 && p.jitterMaxPermille >= p.jitterMinPermille
    && p.jitterMaxPermille <= 1000, 'invalid delay, multiplier, jitter, or concurrency bounds');
  ensure(p.failureThreshold > 0 && p.countedFailureClasses.length > 0
    && new Set(p.countedFailureClasses).size === p.countedFailureClasses.length
    && p.countedFailureClasses.every(value => value.length > 0), 'invalid counted failure policy');
  ensure(p.acceptedOutcomeWindow > 0 && p.breakerCooldown > 0 && p.maxOpenDuration >= p.breakerCooldown
    && p.halfOpenTrials >= 0 && p.halfOpenConcurrency >= 0 && p.halfOpenConcurrency <= p.halfOpenTrials,
  'invalid breaker window, cooldown, or half-open bounds');
  ensure(p.halfOpenConcurrency <= p.concurrency, 'half-open concurrency exceeds total concurrent-work cap');
  ensure(p.closeEvidence === 'part-nine-restoration' && p.reopenEvidence === 'counted-failure',
    'unsupported breaker evidence contract');
  ensure(p.parentDuty.owner === 'part-five' && p.parentDuty.name === 'Run' && p.parentDuty.id.length > 0,
    'persistent parent duty reference required');
  ensure(p.budgetWindow > 0 && p.parentAttemptBudget >= 0 && p.parentAttemptBudget <= 4096 && p.parentResourceBudget >= 0,
    'invalid shared parent budget');
}

function referenceCheck(value: { readonly owner: string; readonly name: string; readonly id: string }, owner: string, name: string): void {
  ensure(value.owner === owner && value.name === name && value.id.length > 0, `${name} reference owner`);
}
const compareBytes = (left: string, right: string) => Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));

export function sourceVectorCheck(vector: SharedLoopRecord['sourceVector']): void {
  seamShapeCheck(vector, sourceVector);
  ensure(vector.length > 0, 'source vector population is empty');
  ensure(new Set(vector.map(entry => entry.machine)).size === vector.length, 'source vector has duplicate machine');
  ensure(vector.every(entry => entry.machine.length > 0 && entry.epoch >= 0 && entry.position >= 0), 'invalid source vector position');
  ensure(vector.every((entry, index) => index === 0 || compareBytes(vector[index - 1]!.machine, entry.machine) < 0),
    'source vector must be machine-sorted');
}

export function sharedLoopRecordCheck(shared: SharedLoopRecord): void {
  seamShapeCheck(shared, sharedLoopRecordShape);
  ensure(shared.type === 'LoopRecord' && shared.schemaVersion === 1 && shared.run.length > 0 && shared.episode.length > 0,
    'loop record identity');
  sharedPolicyCheck(shared.policy);
  ensure(['scheduled', 'running', 'restoring', 'waiting', 'open-breaker', 'half-open', 'stopped', 'closed'].includes(shared.state)
    && ['scheduled', 'attempt-admitted', 'outcome-recorded', 'opened', 'half-opened', 'reopened', 'closed', 'stopped'].includes(shared.transition),
  'unknown shared loop state or transition');
  referenceCheck(shared.parentDuty, 'part-five', 'Run'); referenceCheck(shared.currentOwnerRun, 'part-five', 'Run');
  referenceCheck(shared.policyGeneration, 'part-three', 'RegisterGeneration');
  referenceCheck(shared.pressureBinding, 'part-two', 'FactEnvelope');
  ensure(encoded(shared.parentDuty).bytes === encoded(shared.policy.parentDuty).bytes, 'parent duty changed from policy');
  ensure(shared.run === shared.currentOwnerRun.id, 'shared loop run differs from its witnessed current owner');
  ensure(shared.operationFamily.length > 0 && Object.values(shared.pressureScope).every(value => value.length > 0)
    && shared.pressureKey === `pressure:${encoded([shared.operationFamily, shared.pressureScope]).hash}`,
  'shared pressure identity changed');
  ensure(shared.episode === `loop:${encoded([shared.pressureKey, shared.episodeKey]).hash}` && shared.episodeKey.length > 0,
    'shared episode identity changed');
  ensure(shared.clockBasis === shared.transitionAt.subject.instance
    && shared.nextEligible.subject.instance === shared.clockBasis
    && shared.breakerFirstOpened.subject.instance === shared.clockBasis, 'incomparable shared loop time');
  sourceVectorCheck(shared.sourceVector);
  ensure(shared.attempts === shared.attemptLog.length && shared.episodeAttempts >= 0
    && shared.episodeAttempts <= shared.policy.maxAttempts && shared.totalFailures >= shared.failureCount
    && shared.rollingAttempts >= 0 && shared.rollingResource >= 0, 'shared loop counters disagree');
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
  for (const attempt of shared.attemptLog) { sourceVectorCheck(attempt.sourceVector); ensure(attempt.resource >= 0, 'negative attempt resource'); }
  for (const outcome of shared.outcomeLog) {
    sourceVectorCheck(outcome.sourceVector);
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
}
