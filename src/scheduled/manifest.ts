import { canonical, consumeResult, defineDecoder, deriveThrough } from '../index.js';
import type { BoundaryContext, Hash, Json, Result, VersionedDecoder } from '../index.js';
import { ensure, freeze, take } from './boundary.js';
import { parseCronV1 } from './cron.js';
import { parseRfc3339Offset } from './time.js';
import type { ScheduledPriority, ScheduledWorkManifest } from './contracts.js';

type Obj = Record<string, Json>;
const priorities = ['low', 'maintenance', 'medium', 'high', 'critical'] as const;
export const SCHEDULED_MANIFEST_LIMITS = Object.freeze({
  textBytes: 4_096,
  listItems: 256,
  listBytes: 8_192,
  manifestBytes: 32_768,
});
const utf8Bytes = (value: string): number => new TextEncoder().encode(value).byteLength;
const supportedTimeZones = new Set(Intl.supportedValuesOf('timeZone'));

function object(value: unknown, path: string): Obj {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), `${path}: expected object`); return value as Obj;
}
function fields(value: Obj, required: readonly string[], path: string): void {
  for (const key of required) ensure(Object.hasOwn(value, key), `${path}.${key}: missing required field`);
  for (const key of Object.keys(value)) ensure(required.includes(key), `${path}.${key}: unexpected field`);
}
function text(value: unknown, path: string): string {
  ensure(typeof value === 'string' && value.length > 0, `${path}: expected nonempty string`);
  ensure(utf8Bytes(value) <= SCHEDULED_MANIFEST_LIMITS.textBytes, `${path}: exceeds encoded text byte limit`);
  return value;
}
function number(value: unknown, path: string, integer = false): number {
  ensure(typeof value === 'number' && Number.isFinite(value) && value >= 0 && (!integer || Number.isSafeInteger(value)), `${path}: expected nonnegative ${integer ? 'safe integer' : 'number'}`); return value;
}
function hash(value: unknown, path: string): Hash {
  const result = text(value, path); ensure(/^sha256:[a-f0-9]{64}$/.test(result), `${path}: expected SHA-256 digest`); return result as Hash;
}
function list(value: unknown, path: string, nonempty = false, ordered = false): readonly string[] {
  ensure(Array.isArray(value), `${path}: expected list`);
  ensure(value.length <= SCHEDULED_MANIFEST_LIMITS.listItems, `${path}: exceeds list item limit`);
  const result = value.map((item, index) => text(item, `${path}[${index}]`));
  ensure(utf8Bytes(JSON.stringify(result)) <= SCHEDULED_MANIFEST_LIMITS.listBytes, `${path}: exceeds encoded list byte limit`);
  ensure((!nonempty || result.length > 0) && new Set(result).size === result.length, `${path}: empty or duplicate members`);
  if (!ordered) ensure(result.every((item, index) => index === 0 || result[index - 1]! < item), `${path}: set members must use canonical lexical order`);
  return freeze(result);
}
function one<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  const result = text(value, path); ensure(allowed.includes(result as T), `${path}: unknown value ${result}`); return result as T;
}
function namedTimeZone(value: unknown, path: string): string {
  const result = text(value, path);
  ensure(/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z][A-Za-z0-9._+-]*)*$/.test(result),
    `${path}: expected a canonical named-zone reference`);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: result });
    formatter.format(0);
    ensure(supportedTimeZones.has(result) || formatter.resolvedOptions().timeZone.length > 0,
      `${path}: unsupported IANA named zone ${result}`);
  } catch {
    ensure(false, `${path}: unsupported IANA named zone ${result}`);
  }
  return result;
}

const groups = ['type', 'schemaVersion', 'identity', 'schedule', 'work', 'authority', 'bounds', 'admission',
  'intelligence', 'effectsAndProof', 'recovery', 'presentation', 'activation'] as const;

function decodeShape(input: Json, expectedVersion: 1 | 2, context: BoundaryContext): ScheduledWorkManifest {
  ensure(utf8Bytes(take(canonical(input)).bytes) <= SCHEDULED_MANIFEST_LIMITS.manifestBytes,
    'manifest exceeds encoded byte budget');
  const root = object(input, 'manifest'); fields(root, groups, 'manifest');
  ensure(root.type === 'ScheduledWorkManifest' && root.schemaVersion === expectedVersion, 'manifest: unknown type or schema version');
  const identity = object(root.identity, 'identity'); fields(identity, ['jobId', 'displayName', 'accountableOwner', 'packageVersion', 'contentDigest'], 'identity');
  const jobId = text(identity.jobId, 'identity.jobId'); ensure(/^[a-z0-9][a-z0-9.:-]{0,127}$/.test(jobId), 'identity.jobId: expected registered canonical id');
  const decodedIdentity = freeze({ jobId, displayName: text(identity.displayName, 'identity.displayName'),
    accountableOwner: text(identity.accountableOwner, 'identity.accountableOwner'), packageVersion: text(identity.packageVersion, 'identity.packageVersion'),
    contentDigest: hash(identity.contentDigest, 'identity.contentDigest') });

  const schedule = object(root.schedule, 'schedule'); const scheduleCommon = ['kind', 'activationInstant', 'timeZoneDataVersion', 'calendarPolicyVersion', 'currentLatenessCutoffMs'];
  const kind = one(schedule.kind, ['recurring', 'one-shot'] as const, 'schedule.kind');
  fields(schedule, [...scheduleCommon, ...(kind === 'recurring' ? ['expression', 'timeZone'] : ['at'])], 'schedule');
  const activationInstant = text(schedule.activationInstant, 'schedule.activationInstant'); parseRfc3339Offset(activationInstant);
  const common = { activationInstant, timeZoneDataVersion: text(schedule.timeZoneDataVersion, 'schedule.timeZoneDataVersion'),
    calendarPolicyVersion: text(schedule.calendarPolicyVersion, 'schedule.calendarPolicyVersion'),
    currentLatenessCutoffMs: number(schedule.currentLatenessCutoffMs, 'schedule.currentLatenessCutoffMs') };
  const decodedSchedule = kind === 'recurring'
    ? freeze({ kind, expression: parseCronV1(text(schedule.expression, 'schedule.expression')).expression,
      timeZone: namedTimeZone(schedule.timeZone, 'schedule.timeZone'), ...common })
    : freeze({ kind, at: text(schedule.at, 'schedule.at'), ...common });
  if (decodedSchedule.kind === 'one-shot') parseRfc3339Offset(decodedSchedule.at);
  ensure(/^tzdb:\d{4}[a-z]$/.test(decodedSchedule.timeZoneDataVersion),
    'schedule.timeZoneDataVersion: expected a pinned tzdb release reference');
  ensure(/^calendar:[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9]\d*$/.test(decodedSchedule.calendarPolicyVersion),
    'schedule.calendarPolicyVersion: expected a pinned calendar policy reference');
  const work = object(root.work, 'work'); fields(work, ['entryPoint', 'bodyDigest', 'resultDestination', 'groundingContract', 'predecessors'], 'work');
  const authority = object(root.authority, 'authority'); fields(authority, ['systemPrincipal', 'standingGrant', 'scope', 'operationClasses', 'authorizations'], 'authority');
  const bounds = object(root.bounds, 'bounds'); fields(bounds, ['runBudget', 'exitTest', 'durationMs', 'attempts', 'concurrency', 'tokens', 'money', 'bytes', 'notifications'], 'bounds');
  const admission = object(root.admission, 'admission'); fields(admission, ['priority', 'eligibleAssemblies', 'eligibleMachines', 'requiredCapabilities', 'capacityEvidencePolicy', 'placement', 'catchUp', 'classWeights', 'creditCap', 'promotionAfterMs', 'minimumMaintenanceShare', 'maxHighPriorityEligibilityToAdmissionMs'], 'admission');
  const weights = object(admission.classWeights, 'admission.classWeights'); fields(weights, priorities, 'admission.classWeights');
  const classWeights = freeze(Object.fromEntries(priorities.map(priority => [priority, number(weights[priority], `admission.classWeights.${priority}`, true)])) as Record<ScheduledPriority, number>);
  ensure(classWeights.maintenance > 0, 'admission.classWeights.maintenance: must be nonzero');
  const minimumMaintenanceShare = number(admission.minimumMaintenanceShare, 'admission.minimumMaintenanceShare'); ensure(minimumMaintenanceShare > 0 && minimumMaintenanceShare <= 1, 'admission.minimumMaintenanceShare: expected (0,1]');
  const intelligence = object(root.intelligence, 'intelligence'); fields(intelligence, ['route', 'floor', 'profile', 'supervision', 'businessSteps', 'capturePolicy', 'gradingPolicy', 'failureDirection', 'postCompletionLearning'], 'intelligence');
  const effects = object(root.effectsAndProof, 'effectsAndProof'); fields(effects, ['operations', 'operationIdentityPolicy', 'verificationPlan', 'acceptedOutcomeEvidence', 'uncertaintyOwner'], 'effectsAndProof');
  const recovery = object(root.recovery, 'recovery'); fields(recovery, ['parentDuty', 'rollingBudget', 'loopPolicy', 'backoffPolicy', 'breakerOutcomeWindow', 'recoveryPolicy', 'maxOverdueAgeMs', 'exhaustionDestination'], 'recovery');
  const presentation = object(root.presentation, 'presentation'); fields(presentation, ['destination', 'pushPolicy', 'description'], 'presentation');
  const activation = object(root.activation, 'activation'); fields(activation, ['requiredChecks', 'semanticReview', 'assemblyCompatibility', 'holderProof', 'rollout'], 'activation');

  const decoded = freeze({ type: 'ScheduledWorkManifest', schemaVersion: 2, identity: decodedIdentity, schedule: decodedSchedule,
    work: { entryPoint: text(work.entryPoint, 'work.entryPoint'), bodyDigest: hash(work.bodyDigest, 'work.bodyDigest'), resultDestination: text(work.resultDestination, 'work.resultDestination'), groundingContract: text(work.groundingContract, 'work.groundingContract'), predecessors: list(work.predecessors, 'work.predecessors') },
    authority: { systemPrincipal: text(authority.systemPrincipal, 'authority.systemPrincipal'), standingGrant: text(authority.standingGrant, 'authority.standingGrant'), scope: text(authority.scope, 'authority.scope'), operationClasses: list(authority.operationClasses, 'authority.operationClasses', true), authorizations: list(authority.authorizations, 'authority.authorizations') },
    bounds: { runBudget: text(bounds.runBudget, 'bounds.runBudget'), exitTest: text(bounds.exitTest, 'bounds.exitTest'), durationMs: number(bounds.durationMs, 'bounds.durationMs'), attempts: number(bounds.attempts, 'bounds.attempts', true), concurrency: number(bounds.concurrency, 'bounds.concurrency', true), tokens: number(bounds.tokens, 'bounds.tokens'), money: number(bounds.money, 'bounds.money'), bytes: number(bounds.bytes, 'bounds.bytes'), notifications: number(bounds.notifications, 'bounds.notifications', true) },
    admission: { priority: one(admission.priority, priorities, 'admission.priority'), eligibleAssemblies: list(admission.eligibleAssemblies, 'admission.eligibleAssemblies', true), eligibleMachines: list(admission.eligibleMachines, 'admission.eligibleMachines'), requiredCapabilities: list(admission.requiredCapabilities, 'admission.requiredCapabilities'), capacityEvidencePolicy: text(admission.capacityEvidencePolicy, 'admission.capacityEvidencePolicy'), placement: one(admission.placement, ['global-once', 'every-eligible-machine'] as const, 'admission.placement'), catchUp: one(admission.catchUp, ['none', 'latest'] as const, 'admission.catchUp'), classWeights, creditCap: number(admission.creditCap, 'admission.creditCap', true), promotionAfterMs: number(admission.promotionAfterMs, 'admission.promotionAfterMs'), minimumMaintenanceShare, maxHighPriorityEligibilityToAdmissionMs: number(admission.maxHighPriorityEligibilityToAdmissionMs, 'admission.maxHighPriorityEligibilityToAdmissionMs') },
    intelligence: { route: text(intelligence.route, 'intelligence.route'), floor: text(intelligence.floor, 'intelligence.floor'), profile: text(intelligence.profile, 'intelligence.profile'), supervision: one(intelligence.supervision, ['tier0', 'tier1', 'tier2'] as const, 'intelligence.supervision'), businessSteps: list(intelligence.businessSteps, 'intelligence.businessSteps', true, true), capturePolicy: text(intelligence.capturePolicy, 'intelligence.capturePolicy'), gradingPolicy: text(intelligence.gradingPolicy, 'intelligence.gradingPolicy'), failureDirection: one(intelligence.failureDirection, ['closed', 'open'] as const, 'intelligence.failureDirection'), postCompletionLearning: one(intelligence.postCompletionLearning, ['off', 'required'] as const, 'intelligence.postCompletionLearning') },
    effectsAndProof: { operations: list(effects.operations, 'effectsAndProof.operations'), operationIdentityPolicy: text(effects.operationIdentityPolicy, 'effectsAndProof.operationIdentityPolicy'), verificationPlan: text(effects.verificationPlan, 'effectsAndProof.verificationPlan'), acceptedOutcomeEvidence: list(effects.acceptedOutcomeEvidence, 'effectsAndProof.acceptedOutcomeEvidence', true), uncertaintyOwner: text(effects.uncertaintyOwner, 'effectsAndProof.uncertaintyOwner') },
    recovery: { parentDuty: text(recovery.parentDuty, 'recovery.parentDuty'), rollingBudget: text(recovery.rollingBudget, 'recovery.rollingBudget'), loopPolicy: text(recovery.loopPolicy, 'recovery.loopPolicy'), backoffPolicy: text(recovery.backoffPolicy, 'recovery.backoffPolicy'), breakerOutcomeWindow: text(recovery.breakerOutcomeWindow, 'recovery.breakerOutcomeWindow'), recoveryPolicy: text(recovery.recoveryPolicy, 'recovery.recoveryPolicy'), maxOverdueAgeMs: number(recovery.maxOverdueAgeMs, 'recovery.maxOverdueAgeMs'), exhaustionDestination: text(recovery.exhaustionDestination, 'recovery.exhaustionDestination') },
    presentation: { destination: text(presentation.destination, 'presentation.destination'), pushPolicy: text(presentation.pushPolicy, 'presentation.pushPolicy'), description: text(presentation.description, 'presentation.description') },
    activation: { requiredChecks: list(activation.requiredChecks, 'activation.requiredChecks', true), semanticReview: text(activation.semanticReview, 'activation.semanticReview'), assemblyCompatibility: text(activation.assemblyCompatibility, 'activation.assemblyCompatibility'), holderProof: text(activation.holderProof, 'activation.holderProof'), rollout: one(activation.rollout, ['dark', 'dry-run', 'active'] as const, 'activation.rollout') } }) as ScheduledWorkManifest;
  ensure(utf8Bytes(take(canonical(decoded)).bytes) <= SCHEDULED_MANIFEST_LIMITS.manifestBytes,
    'manifest exceeds encoded byte budget after canonical normalization');
  return decoded;
}

export function decoder(preserved: string): Result<VersionedDecoder<ScheduledWorkManifest, BoundaryContext>> {
  const validate = (value: Json, version: 1 | 2, context: BoundaryContext) => { try { decodeShape(value, version, context); return { ok: true as const, value }; }
    catch (error) { return { ok: false as const, detail: error instanceof Error ? error.message : 'invalid manifest' }; } };
  return defineDecoder<ScheduledWorkManifest, BoundaryContext>({ name: 'ScheduledWorkManifest', owner: 'part-fifteen', currentVersion: 2,
    versions: { 1: { validate: (value, context) => validate(value, 1, context) }, 2: { validate: (value, context) => validate(value, 2, context) } },
    migrations: { 1: value => ({ ...(value as Record<string, Json>), schemaVersion: 2 }) },
    decodeCurrent: (value, context) => { try { return { ok: true, value: decodeShape(value, 2, context) }; } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'invalid manifest' }; } } }, preserved);
}

export function decodeScheduledWorkManifest(input: unknown, context: BoundaryContext): Result<ScheduledWorkManifest> {
  return consumeResult(decoder(context.preserved), { Success: value => deriveThrough(value, input, context), Refused: refusal => refusal });
}

export function canonicalManifest(input: unknown, context: BoundaryContext): Readonly<{ manifest: ScheduledWorkManifest; bytes: string; hash: Hash }> {
  const manifest = take(decodeScheduledWorkManifest(input, context)); const encoded = take(canonical(manifest));
  return freeze({ manifest, bytes: encoded.bytes, hash: encoded.hash });
}
