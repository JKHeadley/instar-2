import { decode, readEvidence } from '../index.js';
import type { Claim, Evidence, Json, Outcome, OwnedReference, Result } from '../index.js';
import type { EffectAssessmentInput, EffectAssessmentPort, EffectAssessmentView } from '../effects/index.js';
import { boundary, encoded, ensure, take } from './boundary.js';
import { deriveVerificationAssessment, verificationEvidenceFreshness } from './runtime.js';
import { mergeVerificationRecords, verificationIdentityClosure } from './storage.js';
import type { CurrentVerificationFact, VerificationAssessment, VerificationHost, VerificationPlan,
  VerificationRecord, VerificationRequest, VerificationRuntimePort } from './contracts.js';

function rawRecord(fact: import('../facts/index.js').FactEnvelope): Readonly<Record<string, Json>> | undefined {
  const body = fact.body as Readonly<Record<string, Json>>;
  const record = body.record;
  return record && typeof record === 'object' && !Array.isArray(record) ? record as Readonly<Record<string, Json>> : undefined;
}
function checkedIdentityScope(rows: readonly CurrentVerificationFact[], seeds: readonly CurrentVerificationFact[]) {
  const scoped = verificationIdentityClosure(rows, seeds);
  const merged = mergeVerificationRecords(scoped.map(row => row.record));
  ensure(merged.conflicts.length === 0, merged.conflicts[0]?.detail ?? 'verification history contains an immutable disagreement');
  ensure(scoped.every(row => row.conflicts.length === 0), 'verification history contains an immutable disagreement');
  return { scoped, merged };
}
function cleanCanonicalSource(rows: readonly CurrentVerificationFact[], record: VerificationRecord): boolean {
  const hash = encoded(record).hash;
  return rows.some(row => row.record.type === record.type && encoded(row.record).hash === hash
    && row.taint.length === 0 && row.conflicts.length === 0);
}
function relatedFacts(host: VerificationHost, input: EffectAssessmentInput): readonly string[] {
  const facts = host.current().facts.facts;
  return facts.filter(fact => {
    if (!['effect-EffectRequest', 'effect-OperationObservation', 'transport-AdmissionReservation'].includes(fact.kind)) return false;
    const record = rawRecord(fact);
    return record?.id === input.request.id || record?.operation === input.reservation.operation
      || input.observations.some(observation => record?.id === observation.id);
  }).map(fact => fact.id).sort();
}
function planFor(host: VerificationHost, runtime: VerificationRuntimePort, bar: string): VerificationPlan {
  const rows = take(runtime.inspectCurrent());
  const candidates = rows.filter(row => row.record.type === 'VerificationPlan'
    && row.record.bar.version === bar && row.record.subject.generation === host.current().generation);
  const { scoped, merged } = checkedIdentityScope(rows, candidates);
  const current = merged.records.filter((record): record is VerificationPlan => record.type === 'VerificationPlan'
    && record.bar.version === bar && record.subject.generation === host.current().generation
    && cleanCanonicalSource(scoped, record));
  ensure(current.length === 1, 'exact current verification plan/bar missing or ambiguous');
  return current[0]!;
}
interface CurrentEvidence { readonly evidence: Evidence; readonly claim: Claim }
function evidenceFor(host: VerificationHost, operation: string, digest: string): readonly CurrentEvidence[] {
  const snapshot = host.current(); const current: CurrentEvidence[] = [];
  for (const evidence of snapshot.evidence) {
    if (take(verificationEvidenceFreshness(evidence, snapshot.clock, host.boundary)) !== 'fresh') continue;
    const claim = take(readEvidence(evidence, snapshot.clock, host.boundary.preserved));
    if (claim.subject !== operation || !['operation-occurred', 'operation-did-not-occur', 'old-executor-quiescent', 'charge-settled'].includes(claim.predicate)) continue;
    if (object(claim.value)?.digest === digest) current.push({ evidence, claim });
  }
  return current;
}
function object(value: Json | undefined): Readonly<Record<string, Json>> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, Json>> : undefined;
}
function reservationFact(host: VerificationHost, input: EffectAssessmentInput): string {
  const match = host.current().facts.facts.find(fact => fact.kind === 'transport-AdmissionReservation'
    && rawRecord(fact)?.operation === input.reservation.operation && rawRecord(fact)?.attempt === input.reservation.attempt);
  ensure(match, 'six-owned reservation fact missing'); return match.id;
}
function requestInput(host: VerificationHost, plan: VerificationPlan, planFact: string, input: EffectAssessmentInput): object {
  const evidence = evidenceFor(host, input.reservation.operation, input.request.digest);
  const logicalKey = encoded([input.reservation.operation, input.request.digest, plan.id, plan.bar.version]).hash;
  return { type: 'VerificationRequest', schemaVersion: 1, id: `verification-request:${logicalKey}`,
    predecessors: [...new Set([planFact, ...relatedFacts(host, input)])].sort(),
    logicalKey, operation: input.reservation.operation, attempt: input.reservation.attempt, reservation: reservationFact(host, input),
    operationDigest: input.request.digest, scope: plan.subject.scope, predicate: 'occurrence', plan: plan.id,
    barVersion: plan.bar.version, initialEvidence: evidence.map(item => item.evidence.id),
    missingEvidence: ['occurrence', 'non-occurrence', 'quiescence', 'charge'].filter(predicate =>
      !evidence.some(item => item.claim.predicate === ({ occurrence: 'operation-occurred', 'non-occurrence': 'operation-did-not-occur', quiescence: 'old-executor-quiescent', charge: 'charge-settled' } as Record<string, string>)[predicate])),
    owner: plan.scheduling.owner, loop: plan.scheduling.loopPolicy, createdAt: host.current().clock.value,
    sourceGeneration: plan.subject.generation };
}
function currentCaptureStatuses(host: VerificationHost, evidence: readonly CurrentEvidence[]): VerificationAssessment['captureStatuses'] {
  return evidence.map(item => ({ reference: item.evidence.capture.reference,
    status: host.current().facts.captures[item.evidence.capture.reference]?.status ?? 'missing' as const }));
}
function chargeFrom(evidence: readonly CurrentEvidence[], assessment: VerificationAssessment): number | null {
  const accepted = assessment.predicates.find(row => row.predicate === 'charge' && row.verdict === 'satisfied');
  if (!accepted) return null;
  const source = evidence.find(item => accepted.evidence.includes(item.evidence.id));
  const value = source?.claim.value;
  const fields = object(value); const amount = fields?.amount;
  return typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}
function viewFor(host: VerificationHost, factId: string, assessment: VerificationAssessment, input: EffectAssessmentInput): EffectAssessmentView {
  ensure(assessment.operation === input.reservation.operation && assessment.operationDigest === input.request.digest
    && assessment.attempt === input.reservation.attempt, 'assessment binding differs from effect');
  const evidence = evidenceFor(host, assessment.operation, assessment.operationDigest);
  const occurrence = assessment.predicates.find(row => row.predicate === 'occurrence')!;
  const nonOccurrence = assessment.predicates.find(row => row.predicate === 'non-occurrence')!;
  const quiescence = assessment.predicates.find(row => row.predicate === 'quiescence')!;
  const happened = occurrence.verdict === 'satisfied';
  const didNotHappen = nonOccurrence.verdict === 'satisfied' && quiescence.verdict === 'satisfied';
  const kind: Outcome['kind'] = happened ? 'happened' : didNotHappen ? 'did-not-happen' : 'uncertain';
  const ids = [...new Set((kind === 'happened' ? occurrence.evidence : kind === 'did-not-happen'
    ? [...nonOccurrence.evidence, ...quiescence.evidence] : assessment.evidence))];
  const outcome = take(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind, evidence: ids },
    { ...host.current().decode, evidence: [...host.current().decode.evidence ?? [], ...evidence.map(item => item.evidence)] }));
  return Object.freeze({ outcome, finalCharge: chargeFrom(evidence, assessment),
    delayedExecutionExcluded: quiescence.verdict === 'satisfied', required: Object.freeze([factId]) });
}

export function createEffectAssessmentPort(host: VerificationHost, runtime: VerificationRuntimePort): EffectAssessmentPort {
  const issued = new Map<string, { assessment: VerificationAssessment; inputHash: string; guardHash: string; view: EffectAssessmentView }>();
  let guards = 0;
  const inputHash = (input: EffectAssessmentInput) => encoded(input).hash;
  const guardHash = (assessment: VerificationAssessment, input: EffectAssessmentInput) => encoded({ assessment,
    input: inputHash(input), generation: host.current().generation,
    evidence: evidenceFor(host, assessment.operation, assessment.operationDigest).map(item => encoded(item.evidence).hash).sort(),
    captures: currentCaptureStatuses(host, evidenceFor(host, assessment.operation, assessment.operationDigest)) }).hash;
  const bindStored = (id: string, input: EffectAssessmentInput) => {
    const rows = take(runtime.inspectCurrent());
    const row = rows.find(item => item.fact.id === id && item.record.type === 'VerificationAssessment');
    ensure(row && row.record.type === 'VerificationAssessment', 'verification assessment fact missing');
    const assessmentScope = checkedIdentityScope(rows, [row]);
    const assessment = row.record as VerificationAssessment;
    ensure(row.taint.length === 0 && row.conflicts.length === 0 && cleanCanonicalSource(assessmentScope.scoped, assessment),
      'verification assessment source is tainted');
    const requestSeeds = rows.filter(item => item.record.type === 'VerificationRequest' && item.record.id === assessment.request);
    const requestScope = checkedIdentityScope(rows, requestSeeds);
    const requests = requestScope.merged.records.filter((record): record is VerificationRequest =>
      record.type === 'VerificationRequest' && record.id === assessment.request && cleanCanonicalSource(requestScope.scoped, record));
    ensure(requests.length === 1,
      'verification assessment request missing, ambiguous, or tainted');
    const request = requests[0]!;
    const requestFact = requestScope.scoped.find(item => item.record.type === 'VerificationRequest'
      && encoded(item.record).hash === encoded(request).hash && assessment.predecessors.includes(item.fact.id)
      && item.taint.length === 0 && item.conflicts.length === 0);
    ensure(requestFact, 'verification assessment request/effect lineage differs');
    const planSeeds = rows.filter(item => item.record.type === 'VerificationPlan' && item.record.id === request.plan);
    const planScope = checkedIdentityScope(rows, planSeeds);
    const plans = planScope.merged.records.filter((record): record is VerificationPlan =>
      record.type === 'VerificationPlan' && record.id === request.plan && cleanCanonicalSource(planScope.scoped, record));
    ensure(plans.length === 1,
      'verification assessment plan missing, ambiguous, or tainted');
    const plan = plans[0]!;
    const currentPlan = planFor(host, runtime, input.bar);
    ensure(plan.id === currentPlan.id && request.barVersion === plan.bar.version && assessment.barVersion === plan.bar.version
      && request.sourceGeneration === plan.subject.generation && plan.subject.generation === host.current().generation,
    'verification assessment plan/bar generation differs');
    ensure(request.operation === input.reservation.operation && request.attempt === input.reservation.attempt
      && request.operationDigest === input.request.digest && request.reservation === reservationFact(host, input)
      && assessment.operation === request.operation && assessment.attempt === request.attempt
      && assessment.operationDigest === request.operationDigest && assessment.predecessors.includes(requestFact.fact.id),
    'verification assessment request/effect lineage differs');
    const snapshot = host.current(); const currentEvidence = evidenceFor(host, request.operation, request.operationDigest);
    const derived = take(deriveVerificationAssessment({ request, plan, evidence: currentEvidence.map(item => item.evidence),
      observer: assessment.observer, vectorDigest: encoded(snapshot.facts.folded).hash,
      knownLineages: Object.keys(snapshot.facts.folded), captureStatuses: currentCaptureStatuses(host, currentEvidence),
      taints: [], now: snapshot.clock, predecessors: assessment.predecessors, supersedes: assessment.supersedes,
      decode: snapshot.decode }, host.boundary));
    ensure(assessment.vectorDigest === derived.vectorDigest
      && encoded(assessment.knownLineages).hash === encoded(derived.knownLineages).hash
      && encoded(assessment.captureStatuses).hash === encoded(derived.captureStatuses).hash
      && encoded(assessment.taints).hash === encoded(derived.taints).hash
      && encoded(assessment.evidence).hash === encoded(derived.evidence).hash
      && encoded(assessment.missingEvidence).hash === encoded(derived.missingEvidence).hash
      && encoded(assessment.predicates).hash === encoded(derived.predicates).hash,
    'verification assessment does not match current derived evidence');
    return { row: { ...row, record: assessment }, request, plan };
  };
  const readStored = (id: string, input: EffectAssessmentInput) => {
    const { row } = bindStored(id, input);
    const view = viewFor(host, row.fact.id, row.record, input);
    const state = { assessment: row.record, inputHash: inputHash(input), guardHash: guardHash(row.record, input), view };
    issued.set(id, state); return state;
  };
  const port: EffectAssessmentPort = { owner: 'part-nine' as const,
    assess(input: EffectAssessmentInput) {
      return boundary('AssessEffectEvidence', input, host.boundary, () => {
        ensure(guards === 0, 'assessment held by synchronous consumer');
        const plan = planFor(host, runtime, input.bar);
        const planFact = take(runtime.inspectCurrent()).find(row => row.record.type === 'VerificationPlan' && row.record.id === plan.id)?.fact.id;
        ensure(planFact, 'verification plan fact missing');
        const request = take(runtime.record('VerificationRequest', requestInput(host, plan, planFact, input))) as VerificationRequest;
        const requestFact = take(runtime.inspectCurrent()).find(row => row.record.type === 'VerificationRequest' && row.record.id === request.id)?.fact.id;
        ensure(requestFact, 'verification request fact missing');
        const evidence = evidenceFor(host, request.operation, request.operationDigest);
        const assessment = take(deriveVerificationAssessment({ request, plan, evidence: evidence.map(item => item.evidence), observer: host.principal.id,
          vectorDigest: encoded(host.current().facts.folded).hash, knownLineages: Object.keys(host.current().facts.folded),
          captureStatuses: currentCaptureStatuses(host, evidence), taints: [], now: host.current().clock, predecessors: [requestFact],
          decode: host.current().decode }, host.boundary));
        take(runtime.record('VerificationAssessment', assessment));
        const fact = take(runtime.inspectCurrent()).find(row => row.record.type === 'VerificationAssessment' && row.record.id === assessment.id);
        ensure(fact, 'assessment append missing');
        const view = viewFor(host, fact.fact.id, assessment, input);
        issued.set(fact.fact.id, { assessment, inputHash: inputHash(input), guardHash: guardHash(assessment, input), view });
        return { owner: 'part-nine' as const, name: 'VerificationAssessment' as const, id: fact.fact.id };
      });
    },
    read(reference: OwnedReference<'part-nine', 'VerificationAssessment'>, input: EffectAssessmentInput) {
      return boundary('ReadEffectAssessment', { reference, input }, host.boundary, () => readStored(reference.id, input).view);
    },
    consumeCurrent<T>(reference: OwnedReference<'part-nine', 'VerificationAssessment'>, input: EffectAssessmentInput, consumer: (current: EffectAssessmentView) => T): Result<T> {
      return boundary('ConsumeCurrentEffectAssessment', { reference, input }, host.boundary, () => {
        const state = issued.get(reference.id); ensure(state, 'assessment must be read before current consumption');
        ensure(!host.current().stopped, 'stop or cancellation inhibits assessment acceptance');
        ensure(host.current().clock.value >= state.assessment.validFrom && host.current().clock.value < state.assessment.validUntil, 'assessment expired');
        ensure(state.inputHash === inputHash(input) && state.guardHash === guardHash(state.assessment, input), 'assessment or evidence changed');
        bindStored(reference.id, input);
        ensure(host.current().generation === planFor(host, runtime, input.bar).subject.generation, 'assessment generation is stale');
        guards++;
        try {
          const result = consumer(state.view);
          ensure(!(result && typeof result === 'object' && 'then' in result), 'assessment consumer must not wait');
          return result;
        } finally { guards--; }
      });
    },
  };
  return Object.freeze(port);
}
