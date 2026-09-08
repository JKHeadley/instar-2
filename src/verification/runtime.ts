import { aggregateStrength, canonical, consumeResult, isFresh, readEvidence } from '../index.js';
import type { Claim, Clock, DecodeContext, Evidence, Json, Result } from '../index.js';
import type { FactContext } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { decodeVerificationAssessment } from './records.js';
import type { GuardPosture, GuardPostureView, ProbeRecord, VerificationAssessment, VerificationDecodeContext,
  VerificationDueItem, VerificationPlan, VerificationPredicate, VerificationRequest, VerificationVerdict } from './contracts.js';

const strengthRank = ['proof', 'observation', 'attestation', 'inference'] as const;
function evidenceSource(evidence: Evidence): string {
  return typeof evidence.source === 'string' ? evidence.source : evidence.source.id;
}
function object(value: Json): Readonly<Record<string, Json>> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, Json>> : undefined;
}
function captureAvailable(evidence: Evidence, decode: DecodeContext, facts: FactContext): boolean {
  const stored = facts.captures[evidence.capture.reference];
  if (stored) return stored.status === 'available' && stored.bytes !== null && stored.hash === evidence.capture.hash;
  return decode.captures[evidence.capture.reference] !== undefined;
}

export interface ProbePostureResolution {
  readonly probe: ProbeRecord; readonly sourceStatus: 'available' | 'unavailable'; readonly bound: boolean;
}

/** Resolve a reported probe pass against the current, independently decoded
 * Evidence inventory. The record's own witness ids and pass fields are only
 * claims until an exact fresh witness binds the real target and challenge. */
export function probeBoundToCurrentEvidence(plan: VerificationPlan, probe: ProbeRecord, now: Clock,
  evidence: readonly Evidence[], decode: DecodeContext, facts: FactContext, context: VerificationDecodeContext): boolean {
  if (probe.subject !== plan.subject.governed || !probe.run || !probe.operation || !probe.comparison
    || !/^sha256:[a-f0-9]{64}$/.test(probe.challengeDigest)) return false;
  if (probe.disposition !== 'passed') return true;
  return probe.witnesses.some(id => {
    const witness = evidence.find(item => item.id === id);
    if (!witness || evidenceSource(witness) !== plan.independence.witnessController
      || evidenceSource(witness) === plan.independence.testedPrincipal
      || !captureAvailable(witness, decode, facts)) return false;
    if (take(verificationEvidenceFreshness(witness, now, context)) !== 'fresh') return false;
    const claim = take(readEvidence(witness, now, context.preserved));
    const value = object(claim.value);
    return claim.subject === probe.subject && claim.predicate === 'probe-passed'
      && value?.challengeDigest === probe.challengeDigest && value?.subjectDigest === plan.bar.subjectDigest
      && value?.plan === probe.plan && value?.planVersion === probe.planVersion && value?.arm === probe.arm
      && value?.slot === probe.slot && value?.attempt === probe.attempt && value?.run === probe.run
      && value?.operation === probe.operation && value?.comparison === probe.comparison;
  });
}

/** P9's declared interval is half-open. The P1 call is still mandatory, and the
 * additional endpoint check prevents its current inclusive convention from
 * being presented as P9 activation agreement. */
export function verificationEvidenceFreshness(evidence: Evidence, now: Clock, context: VerificationDecodeContext): Result<'fresh' | 'expired' | 'unknown'> {
  return boundary('VerificationEvidenceFreshness', { evidence, now }, context, () => {
    if (evidence.observedAt.subject.instance !== now.subject.instance || evidence.observedAt.unit !== now.unit || now.value < evidence.observedAt.value) return 'unknown';
    consumeResult(readEvidence(evidence, now, context.preserved), { Success: () => undefined, Refused: () => undefined });
    const end = evidence.observedAt.value + evidence.freshFor;
    if (!Number.isFinite(end)) return 'unknown';
    return isFresh(evidence, now) && now.value < end ? 'fresh' : 'expired';
  });
}

interface FreshEvidence { readonly evidence: Evidence; readonly claim: Claim }
function acceptedEvidence(plan: VerificationPlan, evidence: readonly Evidence[], now: Clock, decode: DecodeContext,
  captureStatuses: VerificationAssessment['captureStatuses'], context: VerificationDecodeContext): readonly FreshEvidence[] {
  const allowed: FreshEvidence[] = [];
  for (const item of evidence) {
    const source = evidenceSource(item);
    if (!plan.bar.sources.includes(source)) continue;
    if (strengthRank.indexOf(item.strength) > strengthRank.indexOf(plan.bar.minimumStrength)) continue;
    const freshness = take(verificationEvidenceFreshness(item, now, context));
    if (freshness !== 'fresh') continue;
    if (plan.bar.captureRequired && (decode.captures[item.capture.reference] === undefined
      || captureStatuses.find(status => status.reference === item.capture.reference)?.status !== 'available')) continue;
    allowed.push({ evidence: item, claim: take(readEvidence(item, now, context.preserved)) });
  }
  if (allowed.length) take(aggregateStrength(allowed.map(item => item.evidence), decode.preserved));
  return allowed;
}

function predicateEvidence(predicate: VerificationPredicate, request: VerificationRequest, evidence: readonly FreshEvidence[]): readonly FreshEvidence[] {
  const expected: Record<VerificationPredicate, string> = {
    occurrence: 'operation-occurred', 'non-occurrence': 'operation-did-not-occur',
    quiescence: 'old-executor-quiescent', charge: 'charge-settled',
  };
  return evidence.filter(item => {
    if (item.claim.subject !== request.operation || item.claim.predicate !== expected[predicate]) return false;
    const value = object(item.claim.value);
    return value?.digest === request.operationDigest;
  });
}

export interface AssessmentDerivationInput {
  readonly request: VerificationRequest; readonly plan: VerificationPlan; readonly evidence: readonly Evidence[];
  readonly observer: string; readonly vectorDigest: string; readonly knownLineages: readonly string[];
  readonly captureStatuses: VerificationAssessment['captureStatuses']; readonly taints: readonly string[];
  readonly now: Clock; readonly decode: DecodeContext; readonly predecessors?: readonly string[]; readonly supersedes?: string;
}
export function deriveVerificationAssessment(input: AssessmentDerivationInput, context: VerificationDecodeContext): Result<VerificationAssessment> {
  return boundary('DeriveVerificationAssessment', input, context, () => {
    const { request, plan, now } = input;
    ensure(request.plan === plan.id && request.barVersion === plan.bar.version, 'request uses another plan/bar');
    ensure(plan.subject.generation === request.sourceGeneration, 'request source generation differs from plan');
    ensure(!input.taints.includes('contested') && !input.taints.includes('provisional'), 'tainted source cannot satisfy verification bar');
    const usable = acceptedEvidence(plan, input.evidence, now, input.decode, input.captureStatuses, context);
    const rows: VerificationAssessment['predicates'] = (['occurrence', 'non-occurrence', 'quiescence', 'charge'] as const).map(predicate => {
      const matching = predicateEvidence(predicate, request, usable);
      let verdict: VerificationVerdict = matching.length ? 'satisfied' : 'insufficient';
      if (predicate === 'occurrence' && predicateEvidence('non-occurrence', request, usable).length) verdict = 'contradicted';
      if (predicate === 'non-occurrence' && predicateEvidence('occurrence', request, usable).length) verdict = 'contradicted';
      return { predicate, verdict, reason: matching.length ? 'declared bar satisfied by exact subject/digest evidence' : verdict === 'contradicted' ? 'opposite exact predicate is satisfied' : 'declared evidence is missing, stale, weak, unavailable, or out of scope', evidence: matching.map(item => item.evidence.id), decision: '' };
    });
    const evidenceIds = [...new Set(rows.flatMap(row => row.evidence))].sort();
    const missing = rows.filter(row => row.verdict === 'insufficient').map(row => row.predicate);
    const draft = { type: 'VerificationAssessment', schemaVersion: 1, id: '',
      predecessors: [...new Set([...(input.predecessors ?? []), ...(input.supersedes ? [input.supersedes] : [])])].sort(),
      request: request.id, operation: request.operation, attempt: request.attempt, operationDigest: request.operationDigest,
      barVersion: request.barVersion, observer: input.observer, evidence: evidenceIds, missingEvidence: missing,
      vectorDigest: input.vectorDigest, knownLineages: [...input.knownLineages].sort(), captureStatuses: input.captureStatuses,
      taints: input.taints, predicates: rows, validFrom: now.value,
      validUntil: now.value + plan.bar.freshness, supersedes: input.supersedes ?? '' };
    ensure(Number.isSafeInteger(draft.validUntil), 'assessment validity overflow');
    const { id: _empty, ...identity } = draft;
    const id = `assessment:${take(canonical(identity)).hash}`;
    return take(decodeVerificationAssessment({ ...draft, id }, context));
  });
}

export function deriveVerificationDue(plans: readonly VerificationPlan[], probes: readonly ProbeRecord[], now: Clock): readonly VerificationDueItem[] {
  const rows: VerificationDueItem[] = [];
  for (const plan of plans) for (const arm of plan.arms.filter(arm => arm.required)) {
    const attempts = probes.filter(probe => probe.plan === plan.id && probe.planVersion === plan.bar.version && probe.arm === arm.id)
      .sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
    const last = attempts.at(-1); const dueAt = last ? last.startedAt + plan.scheduling.cadence : 0;
    rows.push({ plan: plan.id, arm: arm.id, instance: plan.subject.governed, dueAt,
      lastAttempt: last?.id ?? '', overdueBy: Math.max(0, now.value - dueAt) });
  }
  return freeze(rows.sort((a, b) => a.dueAt - b.dueAt || `${a.plan}:${a.arm}`.localeCompare(`${b.plan}:${b.arm}`)));
}

function armPosture(plan: VerificationPlan, arm: VerificationPlan['arms'][number], probes: readonly ProbePostureResolution[], now: Clock) {
  const rows = probes.filter(row => row.probe.plan === plan.id && row.probe.planVersion === plan.bar.version && row.probe.arm === arm.id)
    .sort((a, b) => a.probe.startedAt - b.probe.startedAt || a.probe.id.localeCompare(b.probe.id));
  const last = rows.at(-1), success = rows.filter(row => row.bound && row.sourceStatus === 'available'
    && row.probe.disposition === 'passed' && row.probe.captureStatus === 'available').at(-1);
  const sourceStatus = last?.sourceStatus ?? 'unknown' as const;
  let posture: GuardPosture;
  if (!arm.required) posture = 'inactive';
  else if (!last) posture = 'unknown';
  else if (!last.bound || last.sourceStatus !== 'available') posture = 'unknown';
  else if (last.probe.disposition === 'failed') posture = 'failed';
  else if (last.probe.disposition !== 'passed' || last.probe.captureStatus !== 'available' || last.probe.missingPhases.length) posture = 'unknown';
  else if (!success || now.value < success.probe.completedAt || now.value >= success.probe.completedAt + plan.scheduling.freshnessWindow) posture = 'stale';
  else posture = 'healthy';
  return freeze({ arm: arm.id, lastAttempt: last?.probe.id ?? '', lastSuccess: success?.probe.id ?? '', sourceStatus, posture });
}
export function deriveGuardPosture(plan: VerificationPlan, probes: readonly ProbePostureResolution[], now: Clock,
  currentGeneration: string, planAvailable: boolean): GuardPostureView {
  const current = planAvailable && plan.subject.generation === currentGeneration;
  const arms = plan.arms.map(arm => armPosture(plan, arm, current ? probes : [], now));
  let posture: GuardPosture = 'inactive';
  const required = arms.filter((_, index) => plan.arms[index]!.required);
  if (required.length) {
    if (required.some(row => row.posture === 'failed')) posture = 'failed';
    else if (required.some(row => row.posture === 'stale')) posture = 'stale';
    else if (required.some(row => row.posture === 'unknown')) posture = 'unknown';
    else posture = 'healthy';
  }
  return freeze({ plan: plan.id, generation: plan.subject.generation, evaluatedAt: now.value, arms, posture });
}
