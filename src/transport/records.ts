import { decode, decodeMeasurement, grantLiveness, scopeIncludes } from '../index.js';
import type { BoundaryContext, Json, Result } from '../index.js';
import { causalCone, registerOwnedBody } from '../facts/index.js';
import type { FactEnvelope, FactSchema, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import type { AdmissionReservation, FenceToken, Lease, LoopPolicy, LoopRecord, MissedRangeFact, MissedRangeRecord, ScanCursor, SettlementConsumer, SharedLoopRecord, TransportFact, TransportHost, TransportOwnedRecord, TransportRecord, TransportRowRecord } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { admissionAccounting, bindSettlementConsumer, checkApplicationEvidence, latestApplication, noteAccountingCandidate, requireApplication } from './settlement.js';

const txt = { kind: 'text', maxLength: 256 } as const;
const int = { kind: 'integer' } as const;
const common = { type: txt, schemaVersion: int };
const row = { ...common, domain: txt, command: txt, predecessor: txt, authority: txt, tick: int };
const fence: OwnedShape = { kind: 'object', fields: { ...common, domain: txt, epoch: int, assignment: txt, holder: txt, machine: txt, incarnation: txt, authority: txt, generation: txt } };
const reference: OwnedShape = { kind: 'object', fields: { owner: txt, name: txt, id: txt } };
const constitutionalResult: OwnedShape = { kind: 'object', fields: { type: txt, id: txt, fact: reference, field: txt } };
const clock: OwnedShape = { kind: 'object', fields: { type: txt, schemaVersion: int,
  subject: { kind: 'object', fields: { kind: txt, instance: txt } }, value: int, unit: txt, at: int, by: txt } };
const durationMeasurement: OwnedShape = { kind: 'object', fields: { type: txt, schemaVersion: int,
  subject: { kind: 'object', fields: { kind: txt, instance: txt } }, value: int, unit: txt, at: clock, by: txt } };
const vectorEntry: OwnedShape = { kind: 'object', fields: { machine: txt, epoch: int, position: int } };
const sourceVector: OwnedShape = { kind: 'array', maxLength: 4096, items: vectorEntry };
const policyFields = { ...common, id: txt, maxAttempts: int, minDelay: int, maxDuration: int, timeout: int,
  concurrency: int, failDirection: txt, breaker: txt, initialDelay: int, maxDelay: int, backoffMultiplier: int,
  jitterMinPermille: int, jitterMaxPermille: int, failureThreshold: int,
  countedFailureClasses: { kind: 'array', maxLength: 64, items: txt } as OwnedShape,
  acceptedOutcomeWindow: int, breakerCooldown: int, maxOpenDuration: int,
  halfOpenTrials: int, halfOpenConcurrency: int, closeEvidence: txt, reopenEvidence: txt,
  parentDuty: reference, budgetWindow: int, parentAttemptBudget: int, parentResourceBudget: int };
const governedPolicyFields = Object.keys(policyFields).filter(key => !['type', 'schemaVersion', 'id', 'maxAttempts', 'minDelay', 'maxDuration', 'timeout', 'concurrency', 'failDirection', 'breaker'].includes(key));
const policy: OwnedShape = { kind: 'object', fields: policyFields, optional: governedPolicyFields };
const loopAttempt: OwnedShape = { kind: 'object', fields: { id: txt, holderFamily: txt, worker: txt, machine: txt,
  episode: txt, admittedAt: clock, resource: int, mode: txt, sourceVector } };
const loopOutcome: OwnedShape = { kind: 'object', fields: { attempt: txt, kind: txt, failureClass: txt,
  observedAt: clock, jitterPermille: int, restoration: { kind: 'array', maxLength: 64, items: reference }, sourceVector } };
const managedLoopFields = {
  parentDuty: reference, currentOwnerRun: reference, policyGeneration: reference,
  operationFamily: txt, pressureScope: { kind: 'object', fields: { target: txt, conversation: txt, machine: txt, pool: txt } } as OwnedShape,
  pressureKey: txt, episodeKey: txt, transition: txt, transitionAt: clock, nextEligible: clock,
  clockBasis: txt, sourceVector, episodeAttempts: int, totalFailures: int, failureCount: int,
  rollingAttempts: int, rollingResource: int, breakerHasOpened: int, breakerOpenCount: int, breakerFirstOpened: clock,
  halfOpenAdmitted: int, halfOpenSucceeded: int,
  pendingAttempts: { kind: 'array', maxLength: 4096, items: txt } as OwnedShape,
  attemptLog: { kind: 'array', maxLength: 4096, items: loopAttempt } as OwnedShape,
  outcomeLog: { kind: 'array', maxLength: 4096, items: loopOutcome } as OwnedShape,
  outcomeWindowDigest: txt, closureEvidence: { kind: 'array', maxLength: 64, items: reference } as OwnedShape,
};
const loopRecordShape: OwnedShape = { kind: 'object', fields: { ...row, run: txt, episode: txt, policy,
  attempts: int, started: int, nextWake: int, state: txt, pending: txt, ...managedLoopFields }, optional: Object.keys(managedLoopFields) };
const disposition: OwnedShape = { kind: 'object', fields: { scheduledInstant: clock, kind: txt,
  result: constitutionalResult, run: reference }, optional: ['result', 'run'] };
const missedRangeShape: OwnedShape = { kind: 'object', fields: { ...common, id: txt, parentDuty: reference,
  episode: reference, scanCursor: reference, jobInstance: txt, packageDigest: txt, calendarPolicy: txt,
  asOf: clock, currentLateness: durationMeasurement, first: clock, last: clock, memberCount: int,
  orderedMembersDigest: txt, derivationInputDigest: txt, catchUpPolicy: txt,
  dispositions: { kind: 'array', maxLength: 4096, items: disposition }, catchUpRun: reference }, optional: ['catchUpRun'] };
export const transportShapes: Readonly<Record<string, OwnedShape>> = freeze({
  Lease: { kind: 'object', fields: { ...row, epoch: int, holder: txt, machine: txt, incarnation: txt, generation: txt, expires: int, state: txt, operation: txt, term: int } },
  FenceToken: fence, LoopPolicy: policy,
  AdmissionReservation: { kind: 'object', fields: { ...row, operation: txt, request: txt, attempt: txt, digest: txt, run: txt, semanticMessage: txt, deliveryAttempt: txt, fence, charge: int, state: txt, executor: txt, durability: txt, replicas: int } },
  LoopRecord: loopRecordShape,
  RecoveryRecord: { kind: 'object', fields: { ...row, operation: txt, episode: txt, observation: txt, disposition: txt } },
  ScanCursor: { kind: 'object', fields: { ...row, scan: txt, generation: txt, orderedKeysDigest: txt,
    keyCount: int, previous: txt, selectedFrom: int, selectedCount: int, nextIndex: int,
    maxItems: int, maxDuration: int, elapsed: int, wrapped: int } },
  SettlementApplication: { kind: 'object', fields: { ...row, operation: txt, request: txt, reservation: txt, claim: txt, digest: txt,
    settlement: txt, settlementFact: txt, settlementHash: txt, actualCharge: int, exposure: int, released: int, unresolved: int, capViolation: int, retryEligible: int } },
  MissedRangeRecord: missedRangeShape,
});
const recordNames = ['Lease', 'AdmissionReservation', 'LoopRecord', 'RecoveryRecord', 'ScanCursor', 'SettlementApplication', 'MissedRangeRecord'];
export const kindFor = (name: string) => `transport-${name}`;
export function transportSchemas(host: TransportHost): readonly FactSchema[] {
  return recordNames.map(name => ({ kind: kindFor(name), version: 1,
    fields: { record: { kind: 'owned', owner: 'part-six', name } }, machineScope: 'shared',
    // The issuer identity and current standing are checked by the owner boundary too.
    standing: 'requester', action: 'work', scope: host.scope, causallyBound: false,
    requiredReferences: [], authority: 'none' }));
}
export function shapeCheck(v: unknown, shape: OwnedShape): void {
  if (shape.kind === 'text') { ensure(typeof v === 'string' && v.length <= shape.maxLength, 'bounded text required'); return; }
  if (shape.kind === 'integer') { ensure(Number.isSafeInteger(v), 'safe integer required'); return; }
  if (shape.kind === 'boolean') { ensure(typeof v === 'boolean', 'boolean required'); return; }
  if (shape.kind === 'null') { ensure(v === null, 'null required'); return; }
  if (shape.kind === 'array') {
    ensure(Array.isArray(v) && v.length <= shape.maxLength, 'bounded array required');
    v.forEach(value => shapeCheck(value, shape.items)); return;
  }
  ensure(shape.kind === 'object' && v !== null && typeof v === 'object' && !Array.isArray(v), 'closed object required');
  const r = v as Record<string, unknown>;
  ensure(Object.keys(r).every(key => Object.hasOwn(shape.fields, key)), 'undeclared field');
  for (const [key, field] of Object.entries(shape.fields)) {
    if (!Object.hasOwn(r, key)) { ensure(shape.optional?.includes(key), `missing ${key}`); continue; }
    shapeCheck(r[key], field);
  }
}
export function policyCheck(p: LoopPolicy): void {
  shapeCheck(p, policy);
  ensure(p.type === 'LoopPolicy' && p.schemaVersion === 1 && p.id.length > 0, 'policy identity');
  ensure(p.maxAttempts >= 0 && p.maxDuration >= 0 && p.minDelay > 0 && p.timeout > 0,
    'finite nonnegative bounds and positive delays required');
  ensure(p.failDirection === 'closed', 'unsupported loop fail direction');
  if (p.breaker === 'stub-closed') {
    ensure(p.concurrency === 1 && Object.keys(p).length === 10, 'unsupported loop policy');
    return;
  }
  ensure(p.breaker === 'shared-circuit-v1' && Object.keys(p).length === Object.keys(policyFields).length,
    'real breaker policy is incomplete or unknown');
  ensure(p.concurrency > 0 && p.initialDelay > 0 && p.initialDelay >= p.minDelay && p.maxDelay >= p.initialDelay
    && p.backoffMultiplier >= 1 && p.jitterMinPermille >= 0 && p.jitterMaxPermille >= p.jitterMinPermille
    && p.jitterMaxPermille <= 1000, 'invalid delay, multiplier, jitter, or concurrency bounds');
  ensure(p.failureThreshold > 0 && p.countedFailureClasses.length > 0
    && new Set(p.countedFailureClasses).size === p.countedFailureClasses.length
    && p.countedFailureClasses.every(value => value.length > 0), 'invalid counted failure policy');
  ensure(p.acceptedOutcomeWindow > 0 && p.breakerCooldown > 0 && p.maxOpenDuration >= p.breakerCooldown
    && p.halfOpenTrials > 0 && p.halfOpenConcurrency > 0 && p.halfOpenConcurrency <= p.halfOpenTrials,
  'invalid breaker window, cooldown, or half-open bounds');
  ensure(p.closeEvidence === 'part-nine-restoration' && p.reopenEvidence === 'counted-failure', 'unsupported breaker evidence contract');
  ensure(p.parentDuty.owner === 'part-five' && p.parentDuty.name === 'Run' && p.parentDuty.id.length > 0,
    'persistent parent duty reference required');
  ensure(p.budgetWindow > 0 && p.parentAttemptBudget > 0 && p.parentAttemptBudget <= 4096 && p.parentResourceBudget >= 0,
    'invalid shared parent budget');
}
function referenceCheck(value: { readonly owner: string; readonly name: string; readonly id: string }, owner: string, name: string): void {
  ensure(value.owner === owner && value.name === name && value.id.length > 0, `${name} reference owner`);
}
export function sourceVectorCheck(vector: SharedLoopRecord['sourceVector']): void {
  shapeCheck(vector, sourceVector);
  ensure(new Set(vector.map(entry => entry.machine)).size === vector.length, 'source vector has duplicate machine');
  ensure(vector.every(entry => entry.machine.length > 0 && entry.epoch >= 0 && entry.position >= 0), 'invalid source vector position');
  ensure(vector.every((entry, index) => index === 0 || vector[index - 1]!.machine < entry.machine), 'source vector must be machine-sorted');
}
export function loopRecordCheck(r: LoopRecord): void {
  shapeCheck(r, loopRecordShape);
  ensure(r.type === 'LoopRecord' && r.schemaVersion === 1 && r.run.length > 0 && r.episode.length > 0,
    'loop record identity');
  policyCheck(r.policy);
  if (r.policy.breaker === 'stub-closed') {
    ensure(Object.keys(r).length === Object.keys(row).length + 8, 'legacy loop record bytes changed');
    ensure(['scheduled', 'running', 'restoring', 'waiting', 'stopped'].includes(r.state)
      && r.attempts >= 0 && r.attempts <= r.policy.maxAttempts, 'loop state or count');
    return;
  }
  const shared = r as SharedLoopRecord;
  ensure(Object.keys(shared).length === Object.keys(row).length + 8 + Object.keys(managedLoopFields).length,
    'shared loop transition is incomplete');
  ensure(['scheduled', 'running', 'restoring', 'waiting', 'open-breaker', 'half-open', 'stopped', 'closed'].includes(shared.state)
    && ['scheduled', 'attempt-admitted', 'outcome-recorded', 'opened', 'half-opened', 'reopened', 'closed', 'stopped'].includes(shared.transition),
  'unknown shared loop state or transition');
  referenceCheck(shared.parentDuty, 'part-five', 'Run'); referenceCheck(shared.currentOwnerRun, 'part-five', 'Run');
  referenceCheck(shared.policyGeneration, 'part-three', 'RegisterGeneration');
  ensure(encoded(shared.parentDuty).bytes === encoded(shared.policy.parentDuty).bytes, 'parent duty changed from policy');
  ensure(shared.operationFamily.length > 0 && Object.values(shared.pressureScope).every(value => value.length > 0)
    && shared.pressureKey === `pressure:${encoded([shared.operationFamily, shared.pressureScope]).hash}`,
  'shared pressure identity changed');
  ensure(shared.episode === `loop:${encoded([shared.pressureKey, shared.episodeKey]).hash}` && shared.episodeKey.length > 0,
    'shared episode identity changed');
  ensure(shared.clockBasis === shared.transitionAt.subject.instance
    && shared.nextEligible.subject.instance === shared.clockBasis
    && shared.breakerFirstOpened.subject.instance === shared.clockBasis,
  'incomparable shared loop time');
  sourceVectorCheck(shared.sourceVector);
  ensure(shared.attempts === shared.attemptLog.length && shared.episodeAttempts >= 0
    && shared.episodeAttempts <= shared.policy.maxAttempts && shared.totalFailures >= shared.failureCount
    && shared.rollingAttempts >= 0 && shared.rollingResource >= 0, 'shared loop counters disagree');
  ensure(shared.breakerHasOpened === 0 || shared.breakerHasOpened === 1,
    'invalid breaker-open marker');
  ensure(shared.breakerOpenCount >= shared.breakerHasOpened, 'invalid breaker-open count');
  ensure(new Set(shared.pendingAttempts).size === shared.pendingAttempts.length
    && shared.pending === (shared.pendingAttempts[0] ?? ''), 'pending attempts disagree');
  ensure(shared.outcomeLog.length <= shared.attemptLog.length
    && new Set(shared.attemptLog.map(attempt => attempt.id)).size === shared.attemptLog.length
    && new Set(shared.outcomeLog.map(outcome => outcome.attempt)).size === shared.outcomeLog.length,
  'shared loop attempt population is incomplete or duplicated');
  ensure(shared.outcomeLog.every(outcome => shared.attemptLog.some(attempt => attempt.id === outcome.attempt)),
    'outcome lacks contributing attempt');
  for (const attempt of shared.attemptLog) { sourceVectorCheck(attempt.sourceVector); ensure(attempt.resource >= 0, 'negative attempt resource'); }
  for (const outcome of shared.outcomeLog) {
    sourceVectorCheck(outcome.sourceVector);
    ensure(outcome.jitterPermille >= shared.policy.jitterMinPermille
      && outcome.jitterPermille <= shared.policy.jitterMaxPermille, 'outcome jitter outside pinned policy');
    ensure(outcome.kind === 'accepted' || outcome.kind === 'failed', 'unknown loop outcome');
    outcome.restoration.forEach(value => referenceCheck(value, 'part-nine', 'VerificationAssessment'));
  }
  ensure(/^sha256:[a-f0-9]{64}$/.test(shared.outcomeWindowDigest), 'invalid outcome window digest');
  shared.closureEvidence.forEach(value => referenceCheck(value, 'part-nine', 'VerificationAssessment'));
}
export function missedRangeCheck(r: MissedRangeRecord): void {
  const wire = r.catchUpRun === null ? Object.fromEntries(Object.entries(r).filter(([key]) => key !== 'catchUpRun')) : r;
  shapeCheck(wire, missedRangeShape);
  ensure(r.type === 'MissedRangeRecord' && r.schemaVersion === 1 && r.id.length > 0, 'missed range identity');
  referenceCheck(r.parentDuty, 'part-five', 'Run'); referenceCheck(r.episode, 'part-six', 'LoopRecord');
  referenceCheck(r.scanCursor, 'part-six', 'ScanCursor');
  ensure(r.jobInstance.length > 0 && r.calendarPolicy.length > 0
    && /^sha256:[a-f0-9]{64}$/.test(r.packageDigest)
    && /^sha256:[a-f0-9]{64}$/.test(r.orderedMembersDigest)
    && /^sha256:[a-f0-9]{64}$/.test(r.derivationInputDigest), 'missed range digest or identity');
  ensure(r.memberCount > 0 && r.dispositions.length === r.memberCount, 'missed range membership/disposition mismatch');
  ensure(r.catchUpPolicy === 'none' || r.catchUpPolicy === 'latest', 'unknown catch-up policy');
  if (r.catchUpRun !== null) referenceCheck(r.catchUpRun, 'part-five', 'Run');
  r.dispositions.forEach(value => {
    ensure(['missed-no-execution', 'existing-run', 'catch-up-run'].includes(value.kind), 'unknown missed member disposition');
    if (value.kind === 'missed-no-execution') {
      ensure(Object.keys(value).length === 3 && value.result.type === 'Result' && value.result.id.length > 0
        && value.result.field.length > 0, 'missed member must carry only its constitutional Result');
      referenceCheck(value.result.fact, 'part-two', 'FactEnvelope');
    } else {
      ensure(Object.keys(value).length === 3, 'admitted member must carry only its Run');
      referenceCheck(value.run, 'part-five', 'Run');
    }
  });
}
export function decodeLoopPolicy(input: unknown, c: BoundaryContext): Result<LoopPolicy> {
  return boundary('LoopPolicyInput', input, c, safe => { const p = safe as unknown as LoopPolicy; policyCheck(p); return freeze(p); });
}
export function decodeLoopRecord(input: unknown, c: BoundaryContext): Result<LoopRecord> {
  return boundary('LoopRecordInput', input, c, safe => { const r = safe as unknown as LoopRecord; loopRecordCheck(r); return freeze(r); });
}
export function decodeScanCursor(input: unknown, c: BoundaryContext): Result<ScanCursor> {
  return boundary('ScanCursorInput', input, c, safe => { const r = safe as unknown as ScanCursor; shapeCheck(r, transportShapes.ScanCursor!); return freeze(r); });
}
export function decodeMissedRangeRecord(input: unknown, c: BoundaryContext): Result<MissedRangeRecord> {
  return boundary('MissedRangeRecordInput', input, c, safe => { const r = safe as unknown as MissedRangeRecord; missedRangeCheck(r); return freeze(r); });
}
const missedTickets = new WeakMap<TransportHost, Set<string>>();
export function withMissedRangeCandidate<T>(host: TransportHost, record: MissedRangeRecord, run: () => T): T {
  const key = encoded(record).hash, set = missedTickets.get(host) ?? new Set<string>();
  missedTickets.set(host, set); ensure(!set.has(key), 'missed range candidate already active');
  set.add(key); try { return run(); } finally { set.delete(key); }
}
function requireMissedRangeCandidate(host: TransportHost, record: MissedRangeRecord): void {
  ensure(missedTickets.get(host)?.has(encoded(record).hash), 'missed range requires its conditional writer');
}
export function missedRows(facts: readonly FactEnvelope[]): readonly MissedRangeFact[] {
  return facts.filter(fact => fact.kind === kindFor('MissedRangeRecord')).map(fact => {
    const wire = (fact.body as { readonly record: Json }).record as Record<string, Json>;
    const record = freeze({ ...wire, catchUpRun: wire.catchUpRun ?? null }) as unknown as MissedRangeRecord;
    return { fact, record };
  });
}
export function validateMissedRangeHistory(record: MissedRangeRecord, prior: readonly MissedRangeFact[]): void {
  missedRangeCheck(record);
  const previous = prior.filter(row => row.record.id === record.id).at(-1)?.record;
  if (!previous) return;
  const stable = (value: MissedRangeRecord) => ({ ...value, dispositions: [], catchUpRun: null });
  ensure(encoded(stable(previous)).bytes === encoded(stable(record)).bytes, 'missed range identity or membership changed');
  ensure(previous.dispositions.every((old, index) => {
    const next = record.dispositions[index]!;
    return encoded(old.scheduledInstant).bytes === encoded(next.scheduledInstant).bytes
      && (old.kind === 'missed-no-execution' || encoded(old).bytes === encoded(next).bytes);
  }), 'completed missed member disposition changed');
  if (previous.catchUpRun) ensure(encoded(previous.catchUpRun).bytes === encoded(record.catchUpRun).bytes,
    'catch-up Run changed or was minted twice');
}
export function rows(facts: readonly FactEnvelope[], domain: string): TransportFact[] {
  return facts.filter(f => recordNames.some(n => f.kind === kindFor(n))).map(fact => ({ fact,
    record: (fact.body as { readonly record: Json }).record as unknown as TransportRecord,
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
function validateSharedLoopHistory(record: SharedLoopRecord, all: readonly TransportFact[], host: TransportHost, origin: boolean): void {
  loopRecordCheck(record);
  const previous = latestSharedLoop(all, record.pressureKey);
  if (origin) requireSharedLoopCandidate(host, record);
  if (!previous) {
    ensure(record.transition === 'scheduled' && record.state === 'scheduled' && record.attempts === 0
      && record.episodeAttempts === 0 && record.totalFailures === 0 && record.failureCount === 0
      && record.rollingAttempts === 0 && record.rollingResource === 0 && record.breakerHasOpened === 0
      && record.breakerOpenCount === 0
      && record.halfOpenAdmitted === 0 && record.halfOpenSucceeded === 0
      && record.pendingAttempts.length === 0 && record.attemptLog.length === 0 && record.outcomeLog.length === 0,
    'initial shared loop counters must be empty');
    return;
  }
  ensure(encoded(previous.policy).bytes === encoded(record.policy).bytes
    && encoded(previous.parentDuty).bytes === encoded(record.parentDuty).bytes
    && previous.operationFamily === record.operationFamily
    && encoded(previous.pressureScope).bytes === encoded(record.pressureScope).bytes
    && previous.clockBasis === record.clockBasis, 'shared pressure policy or clock changed');
  if (record.transition === 'scheduled') {
    ensure(previous.state === 'closed' && previous.episode !== record.episode
      && record.attempts === previous.attempts && record.totalFailures === previous.totalFailures
      && encoded(record.attemptLog).bytes === encoded(previous.attemptLog).bytes
      && encoded(record.outcomeLog).bytes === encoded(previous.outcomeLog).bytes
      && record.breakerOpenCount === previous.breakerOpenCount
      && record.episodeAttempts === 0 && record.pendingAttempts.length === 0,
    'new episode reset shared pressure or replaced an active episode');
    return;
  }
  ensure(previous.episode === record.episode && previous.episodeKey === record.episodeKey
    && previous.started === record.started && encoded(previous.currentOwnerRun).bytes === encoded(record.currentOwnerRun).bytes
    && previous.policyGeneration.id === record.policyGeneration.id, 'shared episode identity or pinned generation changed');
  ensure(record.attempts >= previous.attempts && record.totalFailures >= previous.totalFailures
    && record.episodeAttempts >= previous.episodeAttempts && record.breakerOpenCount >= previous.breakerOpenCount
    && record.attemptLog.slice(0, previous.attemptLog.length).every((value, index) => encoded(value).bytes === encoded(previous.attemptLog[index]).bytes)
    && previous.outcomeLog.every(value => record.outcomeLog.some(next => encoded(next).bytes === encoded(value).bytes)),
  'shared pressure history reset or changed');
  ensure(previous.state !== 'stopped' && previous.state !== 'closed', 'terminal loop episode cannot transition');
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
export function validateTransition(r: TransportRowRecord, all: readonly TransportFact[], host: TransportHost, origin = false): void {
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
          ensure((prior.state === 'prepared' && r.state === 'dispatch-claimed') || (prior.state === 'dispatch-claimed' && r.state === 'consumed'), 'claim is one-use');
          ensure(r.executor === lease.incarnation && (prior.executor === '' || prior.executor === r.executor), 'executor binding mismatch');
        }
      }
    } else if (r.type === 'LoopRecord') {
      policyCheck(r.policy);
      if (r.policy.breaker === 'shared-circuit-v1') validateSharedLoopHistory(r as SharedLoopRecord, all, host, origin);
      else {
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
    const registrations = Object.entries(transportShapes).map(([name, shape]) => take(registerOwnedBody({
    name, owner: 'part-six', currentVersion: 1, versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
    decodeCurrent: (input, ctx) => {
      try {
        shapeCheck(input, shape);
        const normalized = name === 'MissedRangeRecord' && !(input as Record<string, Json>).catchUpRun
          ? { ...(input as Record<string, Json>), catchUpRun: null } : input;
        const v = normalized as unknown as TransportOwnedRecord;
        ensure((input as { type: string }).type === name && v.schemaVersion === 1, 'owned type mismatch');
        if (name === 'LoopPolicy') policyCheck(input as unknown as LoopPolicy);
        else if (name === 'FenceToken') {
          const past = rows(causalCone(ctx.origin, ctx.facts.facts), host.domain), lease = latestLease(past)?.record;
          ensure(lease && encoded(input).bytes === encoded(fenceFor(past, lease)).bytes, 'fence lacks committed assignment');
          if (ctx.mode === 'origin') { live(host); checkFence(past, input as unknown as FenceToken, host, host.monotonic()); }
        }
        else if (recordNames.includes(name)) {
          if (v.type === 'LoopRecord') loopRecordCheck(v);
          // The independently configured one-voter identity is invariant across
          // origin, replication and replay. Process incarnations may change;
          // a different signed actor/machine cannot speak for this authority.
          ensure(ctx.origin.machine === host.machine && ctx.origin.principal.id === host.principal.id
            && ctx.origin.principal.kind === host.principal.kind, 'issuer is not this authority');
          const cone = causalCone(ctx.origin, ctx.facts.facts);
          const past = rows(cone, host.domain);
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
          if (v.type === 'MissedRangeRecord') {
            const missed = missedRows(cone);
            ensure(missed.every(({ fact }) => fact.machine === host.machine && fact.principal.id === host.principal.id
              && fact.principal.kind === host.principal.kind), 'predecessor issuer is not this authority');
            validateMissedRangeHistory(v, missed);
            if (admitting) requireMissedRangeCandidate(host, v);
          } else validateTransition(v, past, host, admitting);
          if (v.type === 'SettlementApplication') {
            checkApplicationEvidence(v, causalCone(ctx.origin, ctx.facts.facts), past);
            if (ctx.mode === 'origin') requireApplication(host, v, settlementConsumer);
          }
          if (ctx.mode === 'origin') {
            live(host);
            if (v.type !== 'MissedRangeRecord') {
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
        }
        return { ok: true, value: freeze(input) };
      } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'transport record refused' }; }
    },
    }, shape, c)));
    bindSettlementConsumer(host, settlementConsumer); return registrations;
  });
}
