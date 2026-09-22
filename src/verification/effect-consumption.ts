import { consumeResult, decode, readEvidence } from '../index.js';
import type { Evidence, Outcome, OwnedReference, Result } from '../index.js';
import type { FactEnvelope, FactStorePort } from '../facts/index.js';
import { hashBytes, causalCone } from '../facts/index.js';
import type { AdmissionReservation } from '../transport/index.js';
import type { OperationObservation } from '../effects/index.js';
import type { ProviderOperationObservation } from '../effects/provider-api.js';
import type { CapturedProviderDecision, ProviderDecisionReadPort, ProviderResponseAssessmentInput,
  ProviderResponseAssessmentPort, ProviderResponseSubject, ProviderResponseVerificationAssessment,
  ProviderResponseVerificationPlan, ProviderResponseVerificationRequest, VerificationAssessment,
  VerificationHost, VerificationPlan, VerificationRuntimePort } from './contracts.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { mergeVerificationRecords, verificationIdentityClosure } from './storage.js';
import { deriveProviderResponseAssessment, deriveVerificationAssessment, verificationEvidenceFreshness } from './runtime.js';
import { decodeCapturedProviderDecision } from '../judgment/provider-path.js';

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
const genuineResponsePorts = new WeakMap<object, FactStorePort>();

export function isGenuineProviderResponseAssessmentPort(port: ProviderResponseAssessmentPort, store: FactStorePort): boolean {
  return genuineResponsePorts.get(port) === store;
}

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

const responseFactReferences = (subject: ProviderResponseSubject) => [subject.seven.request, subject.seven.prepared,
  subject.seven.response, subject.eight.request, subject.eight.executorObservation, subject.eight.responseObservation,
  subject.six.consumedReservation, subject.six.dispatchClaim] as const;

/** Nine's output-use port resolves Seven's decoder and every referenced owner
 * fact from the same signed store. The supplied subject is a question, never an
 * evaluator or bearer token. */
export function createProviderResponseAssessmentPort(host: VerificationHost, runtime: VerificationRuntimePort,
  store: FactStorePort, seven: ProviderDecisionReadPort): ProviderResponseAssessmentPort {
  take(decodeCapturedProviderDecision(seven, undefined, store, host.boundary));
  let consuming = false;
  const checked = <T>(name: string, input: unknown, fn: () => T) => boundary(name, input, host.boundary, fn);
  const validate = (ids: readonly string[], entries = take(store.readForProjection()).entries) => {
    const seen = new Set<string>();
    const visit = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const row = entries.find(entry => entry.fact.id === id);
      ensure(row && !row.taint.length && !row.conflicts.length, 'response assessment dependency tainted, conflicted, or withdrawn');
      row.fact.predecessors.required.forEach(visit);
    };
    ids.forEach(visit);
  };
  const identityRows = <T extends 'VerificationRequest' | 'VerificationAssessment'>(rows: ReturnType<VerificationRuntimePort['inspectCurrent']> extends Result<infer V> ? V : never,
    type: T, seeds: readonly (typeof rows)[number][]) => {
    const closure = verificationIdentityClosure(rows, seeds);
    ensure(closure.length > 0 && closure.every(row => !row.taint.length && !row.conflicts.length),
      `${type} identity is absent, tainted, or conflicted`);
    const merged = mergeVerificationRecords(closure.map(row => row.record));
    if (merged.conflicts.length === 0) return { row: closure[0]!, closure };
    ensure(type === 'VerificationAssessment', `${type} logical identity disagrees`);
    const assessmentRows = closure.filter(row => row.record.type === 'VerificationAssessment' && 'purpose' in row.record);
    const superseded = new Set(assessmentRows.map(row => row.record.type === 'VerificationAssessment'
      ? row.record.supersedes : '').filter(Boolean));
    const tips = assessmentRows.filter(row => !superseded.has(row.fact.id));
    ensure(tips.length === 1, 'VerificationAssessment supersession is ambiguous');
    const seen = new Set<string>(); let cursor = tips[0]!;
    while (true) {
      ensure(!seen.has(cursor.fact.id), 'VerificationAssessment supersession cycle'); seen.add(cursor.fact.id);
      const prior = cursor.record.type === 'VerificationAssessment' ? cursor.record.supersedes : '';
      if (!prior) break;
      ensure(cursor.record.predecessors.includes(prior), 'VerificationAssessment supersession lacks causal predecessor');
      const next = assessmentRows.find(row => row.fact.id === prior);
      ensure(next, 'VerificationAssessment supersession target absent'); cursor = next;
    }
    ensure(assessmentRows.every(row => seen.has(row.fact.id)
      || assessmentRows.some(candidate => seen.has(candidate.fact.id)
        && encoded(candidate.record).bytes === encoded(row.record).bytes)),
    'VerificationAssessment disagreement is not one linked chain');
    return { row: tips[0]!, closure };
  };
  const current = (input: ProviderResponseAssessmentInput) => {
    const state = host.current();
    ensure(!state.stopped && state.generation === input.generation, 'response assessment stop or stale generation');
    const snapshot = take(store.readForProjection()), facts = snapshot.entries.map(entry => entry.fact);
    const refs = responseFactReferences(input.subject);
    const resolved = refs.map(reference => {
      const row = snapshot.entries.find(entry => entry.fact.id === reference.id);
      ensure(row && !row.taint.length && !row.conflicts.length && row.fact.kind === reference.kind
        && row.fact.schemaVersion === reference.schemaVersion && row.fact.contentHash === reference.contentHash,
      'response subject owner fact differs, is absent, or is not current');
      return row.fact;
    });
    const expectedKinds = ['judgment-provider-ProviderJudgmentRequest', 'judgment-provider-ProviderJudgmentAttemptRecord',
      'judgment-provider-ProviderJudgmentAttemptRecord', 'effect-provider-ProviderEffectRequest',
      'effect-provider-ProviderOperationObservation', 'effect-provider-ProviderOperationObservation',
      'transport-AdmissionReservation', 'transport-AdmissionReservation'];
    ensure(resolved.every((fact, index) => fact.kind === expectedKinds[index]), 'response subject owner kind differs');
    const records = resolved.map(fact => record(fact)!);
    const request = records[0]!, prepared = records[1]!, response = records[2]!, effectRequest = records[3]!;
    const executorObservation = records[4]!, responseObservation = records[5]!, consumed = records[6]!, claim = records[7]!;
    const subject = input.subject;
    ensure(prepared.phase === 'prepared' && prepared.request === request.id && response.phase === 'response-observed'
      && response.request === request.id && response.attempt === subject.seven.attempt
      && request.attempt === subject.seven.attempt, 'Seven response relationship differs');
    ensure(effectRequest.id === request.effectRequest && effectRequest.attempt === subject.seven.attempt
      && effectRequest.digest === subject.submitted.operationDigest, 'Eight request differs from Seven response');
    ensure(executorObservation.stage === 'executor-accepted' && responseObservation.stage === 'response'
      && executorObservation.operation === subject.six.operation && responseObservation.operation === subject.six.operation
      && responseObservation.judgmentReceipt === subject.seven.response.id, 'Eight response observations differ');
    ensure(consumed.state === 'consumed' && claim.state === 'dispatch-claimed'
      && consumed.operation === subject.six.operation && claim.operation === subject.six.operation
      && consumed.request === effectRequest.id && claim.request === effectRequest.id
      && consumed.digest === subject.submitted.operationDigest && claim.digest === subject.submitted.operationDigest,
    'Six reservation or consumed claim differs');
    const submitted = request.submitted as Readonly<{ reference?: unknown; hash?: unknown }> | undefined;
    ensure(request.inputDigest === subject.submitted.operationDigest
      && submitted?.reference === subject.submitted.capture.reference
      && submitted?.hash === subject.submitted.capture.hash
      && request.provider === subject.route.provider && request.model === subject.route.model
      && request.route === subject.route.route && request.routeBasis === subject.route.routeBasis
      && request.floorDigest === subject.route.floorDigest && request.settingsDigest === subject.route.settingsDigest
      && request.outputSchemaDigest === subject.route.outputSchemaDigest
      && encoded(request.evidence).hash === subject.route.evidenceDigest
      && encoded(request.evidence).bytes === encoded(subject.route.evidence).bytes,
    'submitted identity, route, floor, or evidence set differs');
    const capture = (reference: string, hash: string) => {
      const value = state.facts.captures[reference];
      ensure(value?.status === 'available' && value.bytes !== null && value.hash === hash
        && hashBytes(value.bytes) === hash, 'response subject capture unavailable or changed');
    };
    capture(subject.submitted.capture.reference, subject.submitted.capture.hash);
    capture(subject.response.capture.reference, subject.response.capture.hash);
    capture(subject.terminal.capture.reference, subject.terminal.capture.hash);
    const rows = take(runtime.inspectCurrent());
    const plans = verificationIdentityClosure(rows, rows.filter(row => row.record.type === 'VerificationPlan'
      && row.record.id === input.plan));
    const merged = mergeVerificationRecords(plans.map(row => row.record));
    ensure(merged.conflicts.length === 0 && plans.length > 0 && plans.every(row => !row.taint.length && !row.conflicts.length),
      'response assessment plan absent or conflicted');
    const plan = merged.records.find((candidate): candidate is ProviderResponseVerificationPlan => candidate.type === 'VerificationPlan'
      && 'purpose' in candidate && candidate.id === input.plan);
    ensure(plan && plan.bar.version === input.bar && plan.subject.generation === input.generation
      && plan.bar.subjectDigest === encoded(subject).hash
      && plan.responseContract.parserReference === subject.response.parserReference
      && plan.responseContract.parserVersion === subject.response.parserVersion
      && plan.responseContract.evidenceContractReference === subject.response.evidenceContractReference
      && plan.responseContract.evidenceContractVersion === subject.response.evidenceContractVersion,
    'response assessment plan, bar, subject, or response contract differs');
    const decision = consumeResult(decodeCapturedProviderDecision(seven, subject, store, host.boundary), {
      Success: value => value, Refused: () => null,
    });
    const receipt = response.receipt as Readonly<{ reference?: unknown; hash?: unknown }> | undefined;
    const receiptCapture = typeof receipt?.reference === 'string' ? state.facts.captures[receipt.reference] : undefined;
    ensure(receiptCapture?.status === 'available' && receiptCapture.bytes !== null
      && receiptCapture.hash === receipt?.hash && hashBytes(receiptCapture.bytes) === receiptCapture.hash,
    'response observation receipt unavailable or changed');
    let responseEvidence: import('../index.js').Json = null;
    try {
      const observation = JSON.parse(receiptCapture.bytes) as Readonly<{ responseEvidence?: import('../index.js').Json }>;
      responseEvidence = observation.responseEvidence ?? null;
    } catch { /* Malformed answer/receipt remains an insufficient output assessment. */ }
    const storedEvidence = snapshot.entries.flatMap(entry => {
      if (entry.taint.length || entry.conflicts.length) return [];
      const item = (entry.fact.body as unknown as { evidence?: Evidence }).evidence;
      return item ? [item] : [];
    });
    const candidates = [...new Map([...state.evidence, ...storedEvidence].map(item => [item.id, item])).values()];
    const evidence: Evidence[] = [];
    const evidenceFacts: string[] = [];
    for (const item of candidates) {
      if (take(verificationEvidenceFreshness(item, state.clock, host.boundary)) !== 'fresh') continue;
      const claim = take(readEvidence(item, state.clock, host.boundary.preserved));
      const rawValue = claim.value;
      const exactOperation = claim.subject === subject.six.operation && rawValue && typeof rawValue === 'object'
        && !Array.isArray(rawValue) && (rawValue as Readonly<Record<string, unknown>>).operationDigest === subject.submitted.operationDigest;
      const settlementOperation = claim.subject === subject.six.operation && rawValue && typeof rawValue === 'object'
        && !Array.isArray(rawValue) && (rawValue as Readonly<Record<string, unknown>>).digest === subject.submitted.operationDigest;
      if (!exactOperation && !settlementOperation && !subject.terminal.sourceEvidence.includes(item.id)
        && subject.terminal.evidence !== item.id) continue;
      const source = snapshot.entries.find(entry => !entry.taint.length && !entry.conflicts.length
        && (entry.fact.body as unknown as { evidence?: Evidence }).evidence?.id === item.id
        && encoded((entry.fact.body as unknown as { evidence: Evidence }).evidence).bytes === encoded(item).bytes);
      ensure(source, 'response assessment Evidence fact absent, changed, or withdrawn');
      const stored = state.facts.captures[item.capture.reference];
      ensure(stored?.status === 'available' && stored.bytes !== null && stored.hash === item.capture.hash
        && hashBytes(stored.bytes) === item.capture.hash, 'response assessment Evidence capture unavailable');
      evidence.push(item); evidenceFacts.push(source.fact.id);
    }
    const required = [...new Set([...refs.map(reference => reference.id), plans[0]!.fact.id, ...evidenceFacts])].sort();
    validate(required, snapshot.entries);
    return { state, snapshot, facts, rows, plan, decision, responseEvidence, evidence, required, validate };
  };
  const pin = (request: FactEnvelope, value: ReturnType<typeof current>) => {
    const frontier: Record<string, { epoch: number; position: number; fact: string }> = {};
    const sources = [request, ...value.required.map(id => value.facts.find(fact => fact.id === id)!)];
    for (const fact of sources.flatMap(source => [...causalCone(source, value.facts), source])) {
      const prior = frontier[fact.machine];
      if (!prior || fact.segment.epoch > prior.epoch || fact.segment.epoch === prior.epoch && fact.segment.position > prior.position)
        frontier[fact.machine] = { epoch: fact.segment.epoch, position: fact.segment.position, fact: fact.id };
    }
    return { digest: encoded({ folded: value.state.facts.folded, frontier }).hash, lineages: Object.keys(frontier).sort() };
  };
  const consume = <T>(reference: OwnedReference<'part-nine', 'VerificationAssessment'>,
    subject: ProviderResponseSubject, requireOutput: boolean,
    consumer: (view: import('./contracts.js').ConsumedProviderResponseAssessment) => T): T => {
    ensure(!consuming, 'response assessment consumer reentry');
    ensure(reference.owner === 'part-nine' && reference.name === 'VerificationAssessment', 'response assessment owner differs');
    const seed = { plan: '', bar: '', generation: host.current().generation, subject };
    const rows = take(runtime.inspectCurrent()), seedRow = rows.find(candidate => candidate.fact.id === reference.id);
    ensure(seedRow?.record.type === 'VerificationAssessment' && 'purpose' in seedRow.record,
      'output-use assessment absent or legacy');
    const assessmentIdentity = identityRows(rows, 'VerificationAssessment', [seedRow]);
    const row = assessmentIdentity.row;
    ensure(row.fact.id === reference.id, 'output-use assessment was superseded');
    const assessment = row.record as ProviderResponseVerificationAssessment;
    const requestSeed = rows.find(candidate => candidate.record.type === 'VerificationRequest'
      && candidate.record.id === assessment.request);
    ensure(requestSeed?.record.type === 'VerificationRequest' && 'purpose' in requestSeed.record,
      'output-use request absent or legacy');
    const requestRow = identityRows(rows, 'VerificationRequest', [requestSeed]).row;
    ensure(requestRow.record.type === 'VerificationRequest' && 'purpose' in requestRow.record,
      'output-use request identity differs');
    const request = requestRow.record as ProviderResponseVerificationRequest;
    seed.plan = request.plan; seed.bar = request.barVersion; seed.generation = request.sourceGeneration;
    const c = current(seed);
    ensure(encoded(request.subject).bytes === encoded(subject).bytes && encoded(assessment.subject).bytes === encoded(subject).bytes
      && assessment.operation === subject.six.operation && request.operation === subject.six.operation
      && assessment.attempt === subject.seven.attempt && request.attempt === subject.seven.attempt
      && assessment.operationDigest === subject.submitted.operationDigest
      && request.operationDigest === subject.submitted.operationDigest, 'response assessment subject or operation differs');
    ensure([requestRow.fact.id, ...c.required].every(id => assessment.predecessors.includes(id)),
      'response assessment prerequisite closure incomplete');
    c.validate([row.fact.id, requestRow.fact.id, ...assessment.predecessors]);
    const pinned = pin(requestRow.fact, c);
    ensure(assessment.vectorDigest === pinned.digest && encoded(assessment.knownLineages).bytes === encoded(pinned.lineages).bytes,
      'response assessment pinned vector changed');
    ensure(c.state.clock.value >= assessment.validFrom && c.state.clock.value < assessment.validUntil
      && assessment.validUntil <= assessment.validFrom + c.plan.bar.freshness, 'response assessment stale');
    const captures = c.evidence.map(item => ({ reference: item.capture.reference, status: 'available' as const }));
    const derived = take(deriveProviderResponseAssessment({ request, plan: c.plan, evidence: c.evidence,
      decision: c.decision, responseEvidence: c.responseEvidence, observer: assessment.observer, vectorDigest: assessment.vectorDigest,
      knownLineages: assessment.knownLineages, captureStatuses: captures, taints: [], now: c.state.clock,
      decode: c.state.decode, facts: c.state.facts, predecessors: assessment.predecessors }, host.boundary));
    ensure(encoded(assessment.predicates).bytes === encoded(derived.predicates).bytes
      && encoded(assessment.evidence).bytes === encoded(derived.evidence).bytes
      && encoded([...assessment.missingEvidence].sort()).bytes === encoded([...derived.missingEvidence].sort()).bytes,
    'response assessment evidence stale, withdrawn, or changed');
    if (requireOutput) for (const predicate of ['response-authenticity', 'response-completeness'] as const)
      ensure(assessment.predicates.find(row => row.predicate === predicate)?.verdict === 'satisfied', `${predicate} is not satisfied`);
    const view = freeze({ assessment: reference, assessmentFact: { owner: 'part-two' as const, name: 'FactEnvelope' as const,
      id: row.fact.id, kind: row.fact.kind, schemaVersion: row.fact.schemaVersion, contentHash: row.fact.contentHash },
      subject, answerDigest: subject.response.answerDigest,
      evidence: assessment.evidence, validUntil: assessment.validUntil,
      required: [...new Set([...c.required, requestRow.fact.id, row.fact.id, ...assessment.predecessors])].sort() });
    consuming = true;
    try {
      const result = consumer(view);
      ensure(!(result && typeof result === 'object' && 'then' in result), 'response assessment consumer must not wait');
      return result;
    } finally { consuming = false; }
  };
  const api: ProviderResponseAssessmentPort = { owner: 'part-nine' as const,
    assess: input => checked('AssessProviderResponse', input, () => {
      ensure(!consuming, 'response assessment held by synchronous consumer');
      const c = current(input), binding = encoded(input).hash;
      const priorSeed = c.rows.find(row => row.record.type === 'VerificationRequest' && 'purpose' in row.record
        && row.record.logicalKey === binding);
      const prior = priorSeed ? identityRows(c.rows, 'VerificationRequest', [priorSeed]).row : undefined;
      const request = prior?.record.type === 'VerificationRequest' && 'purpose' in prior.record
        ? prior.record as ProviderResponseVerificationRequest
        : take(runtime.record('VerificationRequest', { type: 'VerificationRequest', schemaVersion: 2, purpose: 'output-use',
          id: `provider-response-verification:${binding}`, predecessors: c.required, logicalKey: binding,
          operation: input.subject.six.operation, attempt: input.subject.seven.attempt,
          reservation: input.subject.six.consumedReservation.id, operationDigest: input.subject.submitted.operationDigest,
          scope: c.plan.subject.scope, predicates: ['response-authenticity', 'response-completeness'], subject: input.subject,
          plan: c.plan.id, barVersion: input.bar, initialEvidence: c.evidence.map(item => item.id), missingEvidence: [],
          owner: c.plan.scheduling.owner, loop: c.plan.scheduling.loopPolicy, createdAt: c.state.clock.value,
          sourceGeneration: input.generation })) as ProviderResponseVerificationRequest;
      const requestFact = take(runtime.inspectCurrent()).find(row => row.record.id === request.id)!.fact;
      const pinned = pin(requestFact, c);
      const existingRows = take(runtime.inspectCurrent());
      const existingSeeds = existingRows.filter(row => row.record.type === 'VerificationAssessment' && 'purpose' in row.record
        && row.record.request === request.id && row.record.barVersion === input.bar && row.record.vectorDigest === pinned.digest);
      let supersedes = '';
      if (existingSeeds.length) {
        const existing = identityRows(existingRows, 'VerificationAssessment', existingSeeds).row;
        ensure(existing.record.type === 'VerificationAssessment' && 'purpose' in existing.record,
          'output assessment identity differs');
        if (c.state.clock.value >= existing.record.validFrom && c.state.clock.value < existing.record.validUntil)
          return freeze({ owner: 'part-nine' as const, name: 'VerificationAssessment' as const, id: existing.fact.id });
        supersedes = existing.fact.id;
      } else {
        // A changed evidence/frontier vector is a new logical identity, but it
        // still has to close over the immediately preceding assessment for the
        // same request/bar.  Refuse divergent unlinked tips instead of silently
        // choosing one history.
        const priorRows = existingRows.filter(row => row.record.type === 'VerificationAssessment'
          && 'purpose' in row.record && row.record.request === request.id && row.record.barVersion === input.bar);
        if (priorRows.length) {
          const superseded = new Set(priorRows.map(row => row.record.type === 'VerificationAssessment'
            ? row.record.supersedes : '').filter(Boolean));
          const tips = priorRows.filter(row => !superseded.has(row.fact.id));
          ensure(tips.length === 1, 'output assessment supersession is ambiguous');
          supersedes = tips[0]!.fact.id;
        }
      }
      const captures = c.evidence.map(item => ({ reference: item.capture.reference, status: 'available' as const }));
      const assessment = take(deriveProviderResponseAssessment({ request, plan: c.plan, evidence: c.evidence,
      decision: c.decision, observer: host.principal.id, vectorDigest: pinned.digest, knownLineages: pinned.lineages,
        responseEvidence: c.responseEvidence,
        captureStatuses: captures, taints: [], now: c.state.clock, decode: c.state.decode, facts: c.state.facts,
        predecessors: [requestFact.id, ...c.required, ...(supersedes ? [supersedes] : [])],
        ...(supersedes ? { supersedes } : {}) }, host.boundary));
      take(runtime.record('VerificationAssessment', assessment));
      return freeze({ owner: 'part-nine' as const, name: 'VerificationAssessment' as const,
        id: take(runtime.inspectCurrent()).find(row => row.record.id === assessment.id)!.fact.id });
    }),
    consumeProviderResponseAssessment: <T>(reference: OwnedReference<'part-nine', 'VerificationAssessment'>,
      subject: ProviderResponseSubject, consumer: (view: import('./contracts.js').ConsumedProviderResponseAssessment) => T) => checked('ConsumeProviderResponseAssessment',
      { reference, subject }, () => consume(reference, subject, true, consumer)),
    consumeEffectSettlementAssessment: <T>(reference: OwnedReference<'part-nine', 'VerificationAssessment'>,
      input: EffectSettlementAssessmentInput, consumer: (view: ConsumedEffectAssessment) => T) => checked('ConsumeProviderResponseSettlementRows',
      { reference, input }, () => {
        const rows = take(runtime.inspectCurrent()), row = rows.find(candidate => candidate.fact.id === reference.id);
        ensure(row?.record.type === 'VerificationAssessment' && 'purpose' in row.record,
          'same output-use assessment required for settlement');
        return consume(reference, row.record.subject, false, responseView => {
          const assessment = row.record as ProviderResponseVerificationAssessment;
          const currentFacts = take(store.readForProjection()).entries.map(entry => entry.fact);
          const effectRequest = record(currentFacts.find(fact => fact.id === responseView.subject.eight.request.id)!);
          const executorObservation = record(currentFacts.find(fact => fact.id === responseView.subject.eight.executorObservation.id)!);
          const responseObservation = record(currentFacts.find(fact => fact.id === responseView.subject.eight.responseObservation.id)!);
          ensure(input.reservation.operation === responseView.subject.six.operation
            && input.reservation.attempt === responseView.subject.seven.attempt
            && input.reservation.digest === responseView.subject.submitted.operationDigest
            && input.request.id === effectRequest?.id
            && input.request.digest === responseView.subject.submitted.operationDigest
            && input.request.verificationBar === assessment.barVersion
            && input.claim === responseView.subject.six.dispatchClaim.id
            && encoded(input.observations.map(item => item.id)).bytes === encoded([
              executorObservation?.id, responseObservation?.id]).bytes,
          'settlement input differs from output response subject');
          const predicate = (name: string) => assessment.predicates.find(item => item.predicate === name)!;
          const occurrence = predicate('occurrence'), absent = predicate('non-occurrence'), quiet = predicate('quiescence'), charge = predicate('charge');
          const kind = occurrence.verdict === 'satisfied' ? 'happened'
            : absent.verdict === 'satisfied' && quiet.verdict === 'satisfied' ? 'did-not-happen' : 'uncertain';
          const outcome = take(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind,
            evidence: kind === 'happened' ? occurrence.evidence : kind === 'did-not-happen'
              ? [...absent.evidence, ...quiet.evidence] : assessment.evidence }, host.current().decode));
          const evidence = host.current().evidence;
          const amounts = charge.verdict === 'satisfied' ? charge.evidence.map(id => {
            const item = evidence.find(candidate => candidate.id === id); ensure(item, 'charge Evidence absent');
            const value = take(readEvidence(item, host.current().clock, host.boundary.preserved)).value;
            return value && typeof value === 'object' && !Array.isArray(value)
              ? (value as Readonly<Record<string, unknown>>).amount : undefined;
          }) : [];
          const amount = amounts[0];
          ensure(amounts.length === 0 || typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0
            && amounts.every(value => value === amount), 'assessment final charge conflicted');
          return consumer(freeze({ assessment: reference, operation: assessment.operation, attempt: assessment.attempt,
            digest: assessment.operationDigest, bar: assessment.barVersion, outcome,
            accepted: { occurrence: occurrence.evidence, nonOccurrence: absent.evidence,
              quiescence: quiet.evidence, charge: charge.evidence }, dispositions: assessment.predicates,
            charge: typeof amount === 'number' ? { state: 'final' as const, amount } : { state: 'unresolved' as const },
            delayedExecutionExcluded: quiet.verdict === 'satisfied', required: responseView.required }));
        });
      }),
  };
  const port = Object.freeze(api);
  genuineResponsePorts.set(port, store);
  return port;
}
