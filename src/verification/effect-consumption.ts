import { decode, readEvidence } from '../index.js';
import type { Evidence, Outcome, OwnedReference, Result } from '../index.js';
import type { FactEnvelope, FactStorePort } from '../facts/index.js';
import { hashBytes, causalCone } from '../facts/index.js';
import type { AdmissionReservation } from '../transport/index.js';
import type { OperationObservation } from '../effects/index.js';
import type { ProviderOperationObservation } from '../effects/provider-api.js';
import type { VerificationAssessment, VerificationHost, VerificationPlan, VerificationRuntimePort } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { mergeVerificationRecords, verificationIdentityClosure } from './storage.js';
import { deriveVerificationAssessment, verificationEvidenceFreshness } from './runtime.js';

/** Both the legacy reply and versioned provider request use this owner boundary. */
export interface EffectSettlementAssessmentInput {
  readonly request: Readonly<{ id: string; digest: string; attempt: string; verificationBar: string }>;
  readonly reservation: AdmissionReservation;
  readonly claim: string;
  readonly observations: readonly (OperationObservation | ProviderOperationObservation)[];
  readonly plan: string;
  readonly bar: string;
  readonly generation: string;
}
export interface ConsumedEffectAssessment {
  readonly assessment: OwnedReference<'part-nine', 'VerificationAssessment'>;
  readonly operation: string; readonly attempt: string; readonly digest: string; readonly bar: string;
  readonly outcome: Outcome;
  readonly accepted: Readonly<{ occurrence: readonly string[]; nonOccurrence: readonly string[]; quiescence: readonly string[]; charge: readonly string[] }>;
  readonly dispositions: VerificationAssessment['predicates'];
  readonly charge: Readonly<{ state: 'final'; amount: number } | { state: 'unresolved' }>;
  readonly delayedExecutionExcluded: boolean;
  readonly required: readonly string[];
}
export interface EffectSettlementAssessmentPort {
  readonly owner: 'part-nine';
  assess(input: EffectSettlementAssessmentInput): Result<OwnedReference<'part-nine', 'VerificationAssessment'>>;
  consumeEffectSettlementAssessment<T>(reference: OwnedReference<'part-nine', 'VerificationAssessment'>,
    input: EffectSettlementAssessmentInput, consumer: (view: ConsumedEffectAssessment) => T): Result<T>;
}
const record = (f: FactEnvelope) => (f.body as unknown as { record?: Record<string, unknown> }).record;

export function createEffectSettlementAssessmentPort(host: VerificationHost, runtime: VerificationRuntimePort,
  store: FactStorePort): EffectSettlementAssessmentPort {
  let consuming = false;
  const checked = <T>(name: string, input: unknown, fn: () => T) => boundary(name, input, host.boundary, fn);
  const current = (input: EffectSettlementAssessmentInput) => {
    const s = host.current(), snapshot = take(store.readForProjection());
    ensure(!s.stopped && s.generation === input.generation, 'assessment stop or stale generation');
    const facts = snapshot.entries.map(e => e.fact);
    // Validate semantic dependencies, not unrelated records in the append history.
    // Keep all history/statuses intact; never promote an unavailable entry.
    const validate = (ids: readonly string[]) => {
      const seen = new Set<string>();
      const visit = (id: string) => {
        if (seen.has(id)) return; seen.add(id);
        const row = snapshot.entries.find(e => e.fact.id === id);
        ensure(row && !row.taint.length && !row.conflicts.length, 'assessment input tainted or withdrawn');
        row.fact.predecessors.required.forEach(visit);
      };
      ids.forEach(visit);
    };
    const required: string[] = [];
    const exact = (kind: string, value: unknown) => {
      const f = facts.find(f => f.kind === kind && encoded(record(f)).bytes === encoded(value).bytes);
      ensure(f, `assessment differently-bound or missing ${kind}`); required.push(f.id); return f;
    };
    const q = facts.find(f => ['effect-EffectRequest', 'effect-provider-ProviderEffectRequest'].includes(f.kind) && record(f)?.id === input.request.id);
    ensure(q && Object.entries(input.request).every(([k, v]) => record(q)?.[k] === v), 'assessment request differs');
    required.push(q.id);
    const r = input.reservation;
    ensure(r.request === input.request.id && r.digest === input.request.digest && r.attempt === input.request.attempt
      && r.state === 'consumed', 'assessment requires exact consumed reservation');
    exact('transport-AdmissionReservation', r);
    const claim = facts.find(f => f.id === input.claim && f.kind === 'transport-AdmissionReservation');
    ensure(claim && record(claim)?.state === 'dispatch-claimed' && record(claim)?.operation === r.operation
      && record(claim)?.digest === r.digest && record(claim)?.attempt === r.attempt, 'assessment claim differs');
    required.push(claim.id);
    const observed = facts.filter(f => ['effect-OperationObservation', 'effect-provider-ProviderOperationObservation'].includes(f.kind) && record(f)?.operation === r.operation);
    ensure(observed.length > 0 && encoded(observed.map(record)).bytes === encoded(input.observations).bytes,
      'assessment observations changed or incomplete');
    for (const o of input.observations) {
      ensure(o.request === r.request && o.claim === input.claim && o.digest === r.digest, 'observation binding differs');
      exact(observed.find(f => record(f)?.id === o.id)!.kind, o);
      const cap = s.facts.captures[o.capture.reference];
      ensure(cap?.status === 'available' && cap.bytes !== null && cap.hash === o.capture.hash
        && hashBytes(cap.bytes) === cap.hash, 'assessment observation capture unavailable or changed');
    }
    const rows = take(runtime.inspectCurrent());
    const plans = verificationIdentityClosure(rows, rows.filter(row => row.record.type === 'VerificationPlan' && row.record.id === input.plan));
    const merged = mergeVerificationRecords(plans.map(row => row.record));
    ensure(merged.records.length === 1 && merged.conflicts.length === 0
      && plans.every(row => !row.taint.length && !row.conflicts.length), 'assessment plan absent or conflicted');
    const plan = merged.records[0] as VerificationPlan;
    ensure(plan.bar.version === input.bar && input.request.verificationBar === input.bar
      && plan.subject.generation === s.generation, 'assessment bar or generation differs');
    required.push(plans[0]!.fact.id);
    const evidence: Evidence[] = [];
    for (const e of s.evidence) {
      if (take(verificationEvidenceFreshness(e, s.clock, host.boundary)) !== 'fresh') continue;
      const claim = take(readEvidence(e, s.clock, host.boundary.preserved));
      if (claim.subject !== r.operation) continue;
      const v = claim.value;
      if (!v || typeof v !== 'object' || Array.isArray(v) || (v as Readonly<Record<string, unknown>>).digest !== r.digest) continue;
      if (take(verificationEvidenceFreshness(e, s.clock, host.boundary)) !== 'fresh') continue;
      take(readEvidence(e, s.clock, host.boundary.preserved));
      const cap = s.facts.captures[e.capture.reference];
      if (!cap || cap.status !== 'available' || cap.bytes === null || hashBytes(cap.bytes) !== e.capture.hash) continue;
      const source = facts.find(f => (f.body as unknown as { evidence?: Evidence }).evidence?.id === e.id
        && encoded((f.body as unknown as { evidence: Evidence }).evidence).bytes === encoded(e).bytes);
      ensure(source, 'assessment source Evidence fact absent or changed');
      required.push(source.id); evidence.push(e);
    }
    validate(required);
    return { s, facts, plan, evidence, required: [...new Set(required)].sort(), rows, validate };
  };
  // Pin the signed prefix actually examined for this request. Later unrelated
  // appends need not invalidate it; current status/evidence checks above still
  // detect withdrawal, contradiction and changes to the operation's inputs.
  const pin = (request: FactEnvelope, c: ReturnType<typeof current>) => {
    const frontier: Record<string, { epoch: number; position: number; fact: string }> = {};
    const sources = [request, ...c.required.map(id => c.facts.find(f => f.id === id)!)];
    for (const f of sources.flatMap(source => [...causalCone(source, c.facts), source])) {
      const prior = frontier[f.machine];
      if (!prior || f.segment.epoch > prior.epoch || f.segment.epoch === prior.epoch && f.segment.position > prior.position)
        frontier[f.machine] = { epoch: f.segment.epoch, position: f.segment.position, fact: f.id };
    }
    return { digest: encoded({ folded: c.s.facts.folded, frontier }).hash, lineages: Object.keys(frontier).sort() };
  };
  const api: EffectSettlementAssessmentPort = {
    owner: 'part-nine',
    assess: input => checked('AssessEffectSettlement', input, () => {
      ensure(!consuming, 'assessment held by synchronous consumer');
      const c = current(input);
      const binding = encoded(input).hash;
      const prior = c.rows.find(row => row.record.type === 'VerificationRequest' && row.record.logicalKey === binding);
      const request = prior?.record.type === 'VerificationRequest' ? prior.record : take(runtime.record('VerificationRequest', { type: 'VerificationRequest', schemaVersion: 1,
        id: `effect-verification:${binding}`, predecessors: c.required, logicalKey: binding,
        operation: input.reservation.operation, attempt: input.reservation.attempt,
        reservation: c.facts.find(f => f.kind === 'transport-AdmissionReservation' && encoded(record(f)).bytes === encoded(input.reservation).bytes)!.id,
        operationDigest: input.request.digest, scope: c.plan.subject.scope, predicate: 'occurrence', plan: c.plan.id,
        barVersion: input.bar, initialEvidence: c.evidence.map(e => e.id), missingEvidence: [], owner: c.plan.scheduling.owner,
        loop: c.plan.scheduling.loopPolicy, createdAt: c.s.clock.value, sourceGeneration: input.generation }));
      const requestFact = take(runtime.inspectCurrent()).find(row => row.record.id === request.id)!.fact;
      const pinned = pin(requestFact, c);
      const a = take(deriveVerificationAssessment({ request, plan: c.plan, evidence: c.evidence,
        observer: host.principal.id, vectorDigest: pinned.digest, knownLineages: pinned.lineages,
        captureStatuses: c.evidence.map(e => ({ reference: e.capture.reference, status: 'available' as const })), taints: [],
        now: c.s.clock, decode: c.s.decode, predecessors: [requestFact.id, ...c.required] }, host.boundary));
      take(runtime.record('VerificationAssessment', a));
      return freeze({ owner: 'part-nine' as const, name: 'VerificationAssessment' as const,
        id: take(runtime.inspectCurrent()).find(row => row.record.id === a.id)!.fact.id });
    }),
    consumeEffectSettlementAssessment: (reference, input, consumer) => checked('ConsumeEffectSettlementAssessment', { reference, input }, () => {
      ensure(!consuming, 'assessment consumer reentry');
      ensure(reference.owner === 'part-nine' && reference.name === 'VerificationAssessment', 'assessment owner differs');
      const c = current(input), row = c.rows.find(row => row.fact.id === reference.id);
      ensure(row?.record.type === 'VerificationAssessment' && !row.taint.length && !row.conflicts.length, 'assessment absent or tainted');
      const a = row.record;
      const requestRow = c.rows.find(row => row.record.type === 'VerificationRequest' && row.record.id === a.request);
      ensure(requestRow?.record.type === 'VerificationRequest' && !requestRow.taint.length
        && requestRow.record.logicalKey === encoded(input).hash, 'assessment differently-bound input');
      ensure(a.operation === requestRow.record.operation && a.operation === input.reservation.operation
        && a.attempt === requestRow.record.attempt && a.attempt === input.reservation.attempt
        && a.operationDigest === requestRow.record.operationDigest && a.operationDigest === input.request.digest
        && a.barVersion === requestRow.record.barVersion && a.barVersion === input.bar,
        'assessment record differs from its witnessed request');
      const captureKeys = (items: VerificationAssessment['captureStatuses']) =>
        encoded([...new Set(items.map(item => encoded(item).bytes))].sort()).bytes;
      ensure(!a.taints.length && captureKeys(a.captureStatuses) === captureKeys(c.evidence.map(e => ({
        reference: e.capture.reference, status: 'available' as const }))),
        'assessment retained taint or capture status differs');
      ensure([requestRow.fact.id, ...c.required].every(id => a.predecessors.includes(id)),
        'assessment prerequisite closure incomplete');
      ensure(a.validUntil <= a.validFrom + c.plan.bar.freshness, 'assessment validity differs from plan');
      c.validate([row.fact.id, requestRow.fact.id, ...a.predecessors]);
      const pinned = pin(requestRow.fact, c);
      ensure(a.vectorDigest === pinned.digest
        && encoded(a.knownLineages).bytes === encoded(pinned.lineages).bytes, 'assessment pinned vector changed');
      ensure(c.s.clock.value >= a.validFrom && c.s.clock.value < a.validUntil, 'assessment stale');
      const derived = take(deriveVerificationAssessment({ request: requestRow.record, plan: c.plan, evidence: c.evidence,
        observer: a.observer, vectorDigest: a.vectorDigest, knownLineages: a.knownLineages,
        captureStatuses: c.evidence.map(e => ({ reference: e.capture.reference, status: 'available' as const })), taints: [],
        now: c.s.clock, decode: c.s.decode, predecessors: a.predecessors }, host.boundary));
      ensure(encoded(a.predicates).bytes === encoded(derived.predicates).bytes && encoded(a.evidence).bytes === encoded(derived.evidence).bytes
        && encoded([...a.missingEvidence].sort()).bytes === encoded([...derived.missingEvidence].sort()).bytes,
        'assessment evidence stale, withdrawn or changed');
      const predicate = (name: string) => a.predicates.find(p => p.predicate === name)!;
      const occurrence = predicate('occurrence'), absent = predicate('non-occurrence'), quiet = predicate('quiescence'), charge = predicate('charge');
      const kind = occurrence.verdict === 'satisfied' ? 'happened' : absent.verdict === 'satisfied' && quiet.verdict === 'satisfied' ? 'did-not-happen' : 'uncertain';
      ensure(a.evidence.length > 0, 'assessment insufficient; retain uncertainty');
      const outcome = take(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind,
        evidence: kind === 'happened' ? occurrence.evidence : kind === 'did-not-happen' ? [...absent.evidence, ...quiet.evidence] : a.evidence }, c.s.decode));
      const amounts = charge.verdict === 'satisfied' ? charge.evidence.map(id => {
        const v = take(readEvidence(c.evidence.find(e => e.id === id)!, c.s.clock, host.boundary.preserved)).value;
        return v && typeof v === 'object' && !Array.isArray(v) ? (v as Readonly<Record<string, unknown>>).amount : undefined;
      }) : [];
      const amount = amounts[0];
      ensure(amounts.length === 0 || typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0
        && amounts.every(n => n === amount), 'assessment final charge conflicted');
      const view: ConsumedEffectAssessment = freeze({ assessment: reference, operation: a.operation, attempt: a.attempt,
        digest: a.operationDigest, bar: a.barVersion, outcome,
        accepted: { occurrence: occurrence.evidence, nonOccurrence: absent.evidence, quiescence: quiet.evidence, charge: charge.evidence },
        dispositions: a.predicates, charge: typeof amount === 'number' ? { state: 'final', amount } : { state: 'unresolved' },
        delayedExecutionExcluded: quiet.verdict === 'satisfied', required: [...new Set([...c.required, row.fact.id, requestRow.fact.id, ...a.predecessors])].sort() });
      consuming = true;
      try { const result = consumer(view); ensure(!(result && typeof result === 'object' && 'then' in result), 'assessment consumer must not wait'); return result; }
      finally { consuming = false; }
    }),
  };
  return Object.freeze(api);
}
