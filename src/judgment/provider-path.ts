import { createHash } from 'node:crypto';
import { decode, readEvidence } from '../index.js';
import type { BoundaryContext, Decision, OwnedReference, Result, RunReference } from '../index.js';
import { authorAndAppend, causalCone, hashBytes, registerOwnedBody } from '../facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, FactStorePort, OwnedBodyContext, OwnedShape } from '../facts/index.js';
import type { FenceToken, SettlementApplication, TransportAuthority } from '../transport/index.js';
import type { RunGraphPort } from '../rungraph/index.js';
import { consumeEffectSettlement } from '../effects/index.js';
import { consumeProviderReceipt } from '../effects/provider-api.js';
import type { ProviderReceipt } from '../effects/provider-api.js';
import type { EffectSettlement } from '../effects/index.js';
import type { CapturedProviderDecision, ProviderResponseAssessmentPort, ProviderResponseSubject } from '../verification/index.js';
import { isGenuineProviderResponseAssessmentPort, registerProviderDecisionReadPort } from '../verification/effect-consumption.js';
import type { Capture, JudgmentCapturePort, JudgmentHost, ProviderObservation, RecordedAnswer } from './contracts.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { observationCheck } from './model-adapter.js';

export interface ProviderJudgmentRequest {
  readonly type: 'ProviderJudgmentRequest'; readonly schemaVersion: 2; readonly id: string;
  readonly run: string; readonly step: string; readonly predecessor: string; readonly pending: string;
  readonly ordinal: number; readonly semanticMessage: string; readonly point: string; readonly consumer: 'advisory';
  readonly generation: string; readonly incarnation: string; readonly deadline: number;
  readonly question: Capture; readonly context: Capture; readonly submitted: Capture; readonly inputDigest: string;
  readonly floorDigest: string; readonly evidence: readonly string[]; readonly provider: string; readonly model: string; readonly route: string;
  readonly routeBasis: string; readonly disclosure: string; readonly settingsDigest: string; readonly outputSchemaDigest: string;
  readonly maxInputBytes: number; readonly maxOutputBytes: number; readonly maxCaptureBytes: number;
  readonly maxTokens: number; readonly maxCharge: number; readonly timeout: number;
  readonly attempt: string; readonly effectRequest: string;
}
export interface PreparedProviderJudgment {
  readonly request: OwnedReference<'part-seven', 'JudgmentRequest'>;
  readonly prepared: OwnedReference<'part-seven', 'JudgmentAttemptRecord'>;
  readonly value: ProviderJudgmentRequest;
}
export interface ProviderQuestionInput {
  readonly id: string; readonly run: RunReference; readonly step: string; readonly ordinal: number;
  readonly semanticMessage: string; readonly question: string; readonly context: string;
  readonly evidence: readonly string[]; readonly deadline: number;
}
export interface ProviderAnswerAcceptance {
  readonly type: 'ProviderAnswerAcceptance'; readonly schemaVersion: 1; readonly id: string;
  readonly request: string; readonly attempt: string; readonly response: ProviderResponseSubject['seven']['response'];
  readonly operation: string; readonly claim: string; readonly digest: string; readonly capture: Capture;
  readonly answerDigest: string; readonly assessment: ProviderResponseSubject['seven']['response'];
  readonly settlement: ProviderResponseSubject['seven']['response']; readonly accounting: ProviderResponseSubject['seven']['response'];
  readonly maximumCharge: number; readonly retainedExposure: number;
  readonly generation: string; readonly acceptedAt: number;
}
export interface ProviderAnswerAcceptanceInput {
  readonly subject: ProviderResponseSubject;
  readonly assessment: OwnedReference<'part-nine', 'VerificationAssessment'>;
  readonly settlement: ProviderResponseSubject['seven']['response'];
  readonly accounting: ProviderResponseSubject['seven']['response'];
}
export interface ProviderJudgmentPort {
  readonly owner: 'part-seven';
  prepare(input: ProviderQuestionInput, fence: FenceToken): Result<PreparedProviderJudgment>;
  readPrepared(reference: OwnedReference<'part-seven', 'JudgmentRequest'>, fence?: FenceToken): Result<PreparedProviderJudgment>;
  recordReceipt(receipt: ProviderReceipt): Result<OwnedReference<'part-seven', 'JudgmentAttemptRecord'>>;
  decodeCapturedProviderDecision(subject: ProviderResponseSubject): Result<CapturedProviderDecision>;
  recordProviderAnswerAcceptance(input: ProviderAnswerAcceptanceInput,
    assessment: ProviderResponseAssessmentPort, fence: FenceToken): Result<OwnedReference<'part-seven', 'ProviderAnswerAcceptance'>>;
  resolve(reference: OwnedReference<'part-seven', 'JudgmentRequest'>, settlement: EffectSettlement, fence: FenceToken): Result<RecordedAnswer>;
}
export interface ProviderJudgmentDependencies {
  readonly host: JudgmentHost; readonly boundary: BoundaryContext; readonly authority: TransportAuthority;
  readonly captures: JudgmentCapturePort; readonly store: FactStorePort; readonly context: FactContext; readonly privateKey: string;
  readonly runs: RunGraphPort;
  readonly settings: Readonly<Record<string, import('../index.js').Json>>;
  readonly outputSchema: Readonly<Record<string, import('../index.js').Json>>;
  readonly maxTokens: number; readonly maxCaptureBytes: number; readonly timeout: number; readonly disclosure: string;
}
export function decodeCapturedProviderDecision(port: Pick<ProviderJudgmentPort, 'decodeCapturedProviderDecision'>,
  subject: ProviderResponseSubject): Result<CapturedProviderDecision> {
  return port.decodeCapturedProviderDecision(subject);
}
export function recordProviderAnswerAcceptance(port: Pick<ProviderJudgmentPort, 'recordProviderAnswerAcceptance'>,
  input: ProviderAnswerAcceptanceInput, assessment: ProviderResponseAssessmentPort,
  fence: FenceToken): Result<OwnedReference<'part-seven', 'ProviderAnswerAcceptance'>> {
  return port.recordProviderAnswerAcceptance(input, assessment, fence);
}
const txt = { kind: 'text', maxLength: 512 } as const, int = { kind: 'integer' } as const;
const refs = { kind: 'array', maxLength: 64, items: txt } as const, cap = { kind: 'capture' } as const;
const common = { type: txt, schemaVersion: int, id: txt };
const factRef = { kind: 'object', fields: { owner: txt, name: txt, id: txt, kind: txt, schemaVersion: int, contentHash: txt } } as const;
const shapes: Readonly<Record<string, OwnedShape>> = {
  ProviderJudgmentRequest: { kind: 'object', fields: { ...common, run: txt, step: txt, predecessor: txt, pending: txt,
    ordinal: int, semanticMessage: txt, point: txt, consumer: txt, generation: txt, incarnation: txt, deadline: int,
    question: cap, context: cap, submitted: cap, inputDigest: txt, floorDigest: txt, evidence: refs,
    provider: txt, model: txt, route: txt, routeBasis: txt, disclosure: txt, settingsDigest: txt, outputSchemaDigest: txt,
    maxInputBytes: int, maxOutputBytes: int, maxCaptureBytes: int, maxTokens: int, maxCharge: int, timeout: int, attempt: txt, effectRequest: txt } },
  ProviderJudgmentAttemptRecord: { kind: 'object', fields: { ...common, request: txt, attempt: txt, phase: txt,
    submittedDigest: txt, operation: txt, reservation: txt, claim: txt, observation: txt, receipt: cap },
    optional: ['receipt'] },
  ProviderJudgmentResolution: { kind: 'object', fields: { ...common, request: txt, attempt: txt, response: txt, settlement: txt, accounting: txt } },
  ProviderAnswerAcceptance: { kind: 'object', fields: { ...common, request: txt, attempt: txt, response: factRef,
    operation: txt, claim: txt, digest: txt, capture: cap, answerDigest: txt, assessment: factRef,
    settlement: factRef, accounting: factRef, maximumCharge: int, retainedExposure: int,
    generation: txt, acceptedAt: int } },
};
const raw = (f: FactEnvelope) => (f.body as unknown as { record: Record<string, unknown> }).record;
const active = new WeakMap<object, string>();
function decodeProviderAnswerAcceptance(input: unknown, context: OwnedBodyContext,
  host: JudgmentHost, historical: boolean): ProviderAnswerAcceptance {
  const value = input as ProviderAnswerAcceptance;
  ensure(value && value.type === 'ProviderAnswerAcceptance' && value.schemaVersion === 1 && value.id.length > 0,
    'provider answer acceptance identity');
  ensure(context.origin.kind === 'judgment-provider-ProviderAnswerAcceptance' && context.origin.schemaVersion === 1
    && context.origin.machine === host.transport.machine && context.origin.principal.id === host.transport.principal.id,
  'provider answer acceptance origin differs');
  if (!historical) ensure(active.get(host) === encoded(value).hash, 'provider answer acceptance requires owner operation');
  const cone = causalCone(context.origin, context.facts.facts);
  const exact = (reference: ProviderResponseSubject['seven']['response'], kind: string) => {
    const fact = cone.find(candidate => candidate.id === reference.id);
    ensure(reference.owner === 'part-two' && reference.name === 'FactEnvelope' && fact?.kind === kind
      && fact.schemaVersion === reference.schemaVersion && fact.contentHash === reference.contentHash,
    'provider answer acceptance reference differs');
    return fact;
  };
  const request = cone.find(fact => fact.kind === 'judgment-provider-ProviderJudgmentRequest'
    && raw(fact)?.id === value.request);
  const response = exact(value.response, 'judgment-provider-ProviderJudgmentAttemptRecord');
  const assessment = exact(value.assessment, 'verification-VerificationAssessment');
  const settlement = exact(value.settlement, 'effect-provider-ProviderEffectSettlement');
  const accounting = exact(value.accounting, 'transport-SettlementApplication');
  ensure(request, 'provider answer acceptance request absent');
  const q = raw(request) as unknown as ProviderJudgmentRequest;
  const rr = raw(response)!, assessed = raw(assessment)!, sr = raw(settlement)!, ar = raw(accounting)!;
  ensure(q.attempt === value.attempt && rr.phase === 'response-observed' && rr.request === q.id
    && rr.attempt === q.attempt && rr.operation === value.operation && rr.claim === value.claim
    && rr.submittedDigest === value.digest, 'provider answer acceptance response differs');
  ensure(sr.acceptance === value.assessment.id && sr.request === q.effectRequest && sr.operation === value.operation
    && sr.claim === value.claim && sr.digest === value.digest && sr.retainedExposure === value.retainedExposure
    && sr.retryEligible === false, 'provider answer acceptance settlement differs');
  ensure(ar.settlement === sr.id && ar.settlementFact === settlement.id && ar.settlementHash === settlement.contentHash
    && ar.operation === value.operation && ar.request === q.effectRequest && ar.claim === value.claim
    && ar.digest === value.digest && ar.exposure === value.retainedExposure && ar.retryEligible === 0,
  'provider answer acceptance accounting differs');
  const assessedSubject = assessed.subject as unknown as ProviderResponseSubject | undefined;
  const assessmentRequest = cone.find(fact => fact.kind === 'verification-VerificationRequest'
    && raw(fact)?.id === assessed.request);
  const assessmentRequestRecord = assessmentRequest ? raw(assessmentRequest) : undefined;
  ensure(assessed.schemaVersion === 2 && assessed.purpose === 'output-use' && assessedSubject
    && assessmentRequestRecord?.schemaVersion === 2 && assessmentRequestRecord.purpose === 'output-use'
    && encoded(assessmentRequestRecord.subject).bytes === encoded(assessedSubject).bytes
    && assessedSubject.seven.request.id === request.id && assessedSubject.seven.response.id === response.id
    && assessedSubject.seven.attempt === value.attempt && assessedSubject.six.operation === value.operation
    && assessedSubject.six.dispatchClaim.id === value.claim
    && assessedSubject.submitted.operationDigest === value.digest
    && encoded(assessedSubject.response.capture).bytes === encoded(value.capture).bytes
    && assessedSubject.response.answerDigest === value.answerDigest,
  'provider answer acceptance assessment subject differs');
  const assessedRows = assessed.predicates as unknown as readonly Readonly<{ predicate: string; verdict: string }>[];
  ensure(Array.isArray(assessedRows) && ['response-authenticity', 'response-completeness'].every(predicate =>
    assessedRows.some(row => row.predicate === predicate && row.verdict === 'satisfied')),
  'provider answer acceptance assessment did not pass both response rows');
  ensure(Number.isSafeInteger(value.maximumCharge) && value.maximumCharge >= 0 && q.maxCharge === value.maximumCharge
    && Number.isSafeInteger(value.retainedExposure) && value.retainedExposure >= 0
    && (ar.unresolved === 0 || value.retainedExposure === value.maximumCharge),
  'provider answer acceptance maximum exposure differs');
  ensure(value.capture.reference.length > 0 && value.capture.hash === value.answerDigest,
    'provider answer acceptance capture or digest differs');
  const capture = context.facts.captures[value.capture.reference];
  if (!historical || capture?.status === 'available') {
    ensure(capture?.status === 'available' && capture.bytes !== null && capture.hash === value.capture.hash
      && hashBytes(capture.bytes) === value.answerDigest, 'provider answer acceptance captured Decision unavailable');
    const decision = take(decode('Decision', JSON.parse(capture.bytes), context.facts.decode));
    ensure(decision.floor && encoded(decision.floor.allowed).hash === q.floorDigest && 'judgment' in decision.by
      && decision.by.judgment === q.point && decision.by.route === q.route && decision.by.model === q.model,
    'provider answer acceptance Decision differs');
    ensure([...decision.conclusion.evidence, ...decision.reason.evidence].every(id => q.evidence.includes(id)),
      'provider answer acceptance Decision invented evidence');
  }
  ensure(value.generation === q.generation && (historical || value.generation === host.transport.current().generation.id)
    && Number.isSafeInteger(value.acceptedAt) && value.acceptedAt >= 0,
    'provider answer acceptance generation or clock invalid');
  return freeze(value);
}
export function decodeProviderAnswerAcceptanceAtOrigin(input: unknown, context: OwnedBodyContext,
  host: JudgmentHost): Result<ProviderAnswerAcceptance> {
  return boundary('DecodeProviderAnswerAcceptanceAtOrigin', input, context,
    () => decodeProviderAnswerAcceptance(input, context, host, false));
}
export function decodeHistoricalProviderAnswerAcceptance(input: unknown, context: OwnedBodyContext,
  host: JudgmentHost): Result<ProviderAnswerAcceptance> {
  return boundary('DecodeHistoricalProviderAnswerAcceptance', input, context,
    () => decodeProviderAnswerAcceptance(input, context, host, true));
}
export function providerJudgmentSchemas(host: JudgmentHost): readonly FactSchema[] {
  return Object.keys(shapes).map(name => ({ kind: `judgment-provider-${name}`, version: 1,
    fields: { record: { kind: 'owned', owner: 'part-seven', name }, decision: { kind: 'constitutional', type: 'Decision' } },
    optional: ['decision'], machineScope: 'shared', standing: 'requester', action: 'work', scope: host.transport.scope,
    causallyBound: false, requiredReferences: [], authority: 'none' }));
}
export function registerProviderJudgmentBodies(host: JudgmentHost, c: BoundaryContext) {
  return boundary('ProviderJudgmentRegistrations', null, c, () => Object.entries(shapes).map(([name, shape]) => {
    const acceptance = name === 'ProviderAnswerAcceptance';
    return take(registerOwnedBody({
    name, owner: 'part-seven', currentVersion: acceptance ? 1 : 2,
    versions: acceptance ? { 1: { validate: v => ({ ok: true as const, value: v }) } }
      : { 1: { validate: v => ({ ok: true as const, value: v }) }, 2: { validate: v => ({ ok: true as const, value: v }) } },
    migrations: acceptance ? {} : { 1: () => { throw new Error('legacy judgment uses the unchanged version-one decoder'); } },
    decodeCurrent: (v, ctx) => {
      try {
        if (acceptance) {
          const decoded = take((ctx.mode === 'origin' ? decodeProviderAnswerAcceptanceAtOrigin
            : decodeHistoricalProviderAnswerAcceptance)(v, ctx, host));
          return { ok: true, value: json(decoded) };
        }
        const r = v as Record<string, import('../index.js').Json>, past = causalCone(ctx.origin, ctx.facts.facts);
        ensure(r.type === name && r.schemaVersion === 2 && typeof r.id === 'string' && r.id.length > 0, 'provider judgment identity');
        ensure(ctx.origin.machine === host.transport.machine && ctx.origin.principal.id === host.transport.principal.id, 'provider judgment recorder');
        ensure(!past.some(f => f.kind === ctx.origin.kind && raw(f)?.id === r.id), 'provider judgment identity collision');
        if (ctx.mode === 'origin') ensure(active.get(host) === encoded(v).hash, 'provider judgment requires owner operation');
        if (name === 'ProviderJudgmentRequest') {
          ensure(past.some(f => f.id === r.pending && f.kind === 'run-transition'), 'real Five pending step required');
          const q = v as unknown as ProviderJudgmentRequest;
          const bytes = ctx.facts.captures[q.submitted.reference];
          if (bytes?.bytes != null) {
            ensure(hashBytes(bytes.bytes) === q.submitted.hash && encoded(bytes.bytes).hash === q.inputDigest, 'submitted bytes changed');
            // Re-resolve the copied request fields against the ACTUAL submitted bytes
            // instead of trusting them: provider/model/route/point/generation/evidence
            // are exactly what was submitted for the provider call.
            const submission = JSON.parse(bytes.bytes) as Record<string, unknown>;
            for (const field of ['provider', 'model', 'route', 'point', 'generation', 'evidence'] as const)
              ensure(encoded(submission[field]).bytes === encoded(q[field]).bytes, `submitted ${field} differs`);
          }
          // Bind the request's run/predecessor to the referenced Five pending transition,
          // and enforce finite non-negative bounds.
          const pending = past.find(f => f.id === q.pending && f.kind === 'run-transition');
          ensure(pending && raw(pending)?.run === q.run && raw(pending)?.id === q.predecessor,
            'provider request pending run or predecessor differs');
          for (const amount of [q.maxInputBytes, q.maxOutputBytes, q.maxCaptureBytes, q.maxTokens, q.maxCharge, q.timeout, q.ordinal, q.deadline])
            ensure(Number.isSafeInteger(amount) && amount >= 0, 'provider request bound invalid');
        } else {
          const q = past.find(f => f.kind === 'judgment-provider-ProviderJudgmentRequest' && f.schemaVersion === 1 && raw(f)?.id === r.request);
          ensure(q && raw(q)?.attempt === r.attempt, 'request attempt mismatch');
          if (r.phase !== 'prepared') {
            const consumed = past.find(f => f.id === r.reservation && f.kind === 'transport-AdmissionReservation');
            if (name === 'ProviderJudgmentAttemptRecord') ensure(consumed && raw(consumed)?.state === 'consumed'
              && raw(consumed)?.operation === r.operation && raw(consumed)?.attempt === r.attempt
              && raw(consumed)?.request === raw(q)?.effectRequest, 'missing consumed claim');
          }
          // Resolve every observation/claim/response/settlement/accounting the receipt
          // and resolution NAME, by required kind, and compare their relationships —
          // never trust the copied ids or an intake fact substituted for a real record.
          if (name === 'ProviderJudgmentAttemptRecord') {
            ensure((r.phase === 'prepared' || r.phase === 'response-observed')
              && r.submittedDigest === raw(q)?.inputDigest, 'provider attempt phase or digest differs');
            if (r.phase === 'response-observed') {
              const observation = past.find(f => f.id === r.observation && f.kind === 'effect-provider-ProviderOperationObservation');
              const claim = past.find(f => f.id === r.claim && f.kind === 'transport-AdmissionReservation');
              ensure(observation && raw(observation)?.stage === 'executor-accepted'
                && raw(observation)?.request === raw(q)?.effectRequest && raw(observation)?.operation === r.operation
                && raw(observation)?.claim === r.claim && raw(observation)?.digest === r.submittedDigest,
                'provider receipt observation differs');
              ensure(claim && raw(claim)?.state === 'dispatch-claimed' && raw(claim)?.operation === r.operation
                && raw(claim)?.attempt === r.attempt && raw(claim)?.request === raw(q)?.effectRequest
                && raw(claim)?.digest === r.submittedDigest, 'provider receipt claim differs');
              ensure([r.observation, r.claim, r.reservation].every(id => ctx.origin.predecessors.required.includes(String(id))),
                'provider receipt dependency closure differs');
            }
          }
          if (name === 'ProviderJudgmentResolution') {
            const response = past.find(f => f.id === r.response && f.kind === 'judgment-provider-ProviderJudgmentAttemptRecord');
            const settlement = past.find(f => f.id === r.settlement && f.kind === 'effect-provider-ProviderEffectSettlement');
            const accounting = past.find(f => f.id === r.accounting && f.kind === 'transport-SettlementApplication');
            ensure(response && raw(response)?.phase === 'response-observed' && raw(response)?.request === r.request
              && raw(response)?.attempt === r.attempt, 'provider resolution response differs');
            ensure(settlement && raw(settlement)?.request === raw(q)?.effectRequest
              && raw(settlement)?.operation === raw(response)?.operation && raw(settlement)?.digest === raw(q)?.inputDigest,
              'provider resolution settlement differs');
            ensure(accounting && raw(accounting)?.settlement === raw(settlement)?.id
              && raw(accounting)?.settlementFact === settlement.id && raw(accounting)?.settlementHash === settlement.contentHash
              && raw(accounting)?.unresolved === 0, 'provider resolution accounting differs');
            ensure([r.response, r.settlement, r.accounting].every(id => ctx.origin.predecessors.required.includes(String(id))),
              'provider resolution dependency closure differs');
          }
        }
        return { ok: true, value: v };
      } catch (e) { return { ok: false, detail: String(e) }; }
    },
  }, shape, c)); }));
}
export function createProviderJudgmentPort(p: ProviderJudgmentDependencies): ProviderJudgmentPort {
  const checked = <T>(n: string, i: unknown, fn: () => T) => boundary(n, i, p.boundary, fn);
  const facts = () => take(p.store.readForProjection()).entries.map(e => e.fact);
  const validate = (ids: readonly string[]) => {
    const entries = take(p.store.readForProjection()).entries, seen = new Set<string>();
    const visit = (id: string) => {
      if (seen.has(id)) return; seen.add(id);
      const row = entries.find(e => e.fact.id === id);
      ensure(row && !row.taint.length && !row.conflicts.length, 'judgment dependency tainted or withdrawn');
      row.fact.predecessors.required.forEach(visit);
    };
    ids.forEach(visit);
  };
  const append = <T extends { type: string; id: string }>(r: T, required: readonly string[], decision?: Decision) => {
    validate(required);
    const prior = facts().find(f => f.kind === `judgment-provider-${r.type}` && raw(f)?.id === r.id);
    if (prior) { ensure(encoded(raw(prior)).bytes === encoded(r).bytes, 'judgment immutable collision'); return prior; }
    active.set(p.host, encoded(r).hash);
    try { return take(authorAndAppend({ kind: `judgment-provider-${r.type}`, schemaVersion: 1, machine: p.host.transport.machine,
      principal: json(p.host.transport.principal), provenance: json(p.host.transport.principal.provenance), at: json(p.host.transport.current().clock),
      body: json({ record: r, ...(decision ? { decision } : {}) }), required }, p.context, p.store, p.privateKey)).fact; }
    finally { active.delete(p.host); }
  };
  const current = (q: ProviderJudgmentRequest, fence: FenceToken) => {
    const now = p.host.transport.current(), view = take(p.runs.read(q.run));
    ensure(now.generation.id === q.generation && p.host.transport.incarnation === q.incarnation, 'stale judgment generation/incarnation');
    ensure(p.host.transport.monotonic() < q.deadline && !now.stopped, 'judgment deadline or stop');
    ensure(view.head === q.predecessor && view.pending.some(s => s.id === q.step) && view.conflicts.length === 0, 'stale Five predecessor or pending step');
    take(p.authority.admitWrite(`provider-current:${q.id}:${facts().at(-1)?.id}`, fence));
    for (const id of q.evidence) { const e = now.decode.evidence?.find(e => e.id === id); ensure(e, 'judgment evidence absent'); take(readEvidence(e, now.clock, p.boundary.preserved)); }
    ensure(encoded(p.host.floor).hash === q.floorDigest, 'judgment floor changed');
  };
  const readPrepared: ProviderJudgmentPort['readPrepared'] = (ref, fence) => checked('ReadPreparedProviderJudgment', ref, () => {
    ensure(ref.owner === 'part-seven' && ref.name === 'JudgmentRequest', 'preparation owner mismatch');
    const all = facts(), f = all.find(f => f.id === ref.id && f.kind === 'judgment-provider-ProviderJudgmentRequest' && f.schemaVersion === 1);
    ensure(f, 'prepared request absent'); const q = raw(f) as unknown as ProviderJudgmentRequest;
    const prepared = all.find(f => f.kind === 'judgment-provider-ProviderJudgmentAttemptRecord' && raw(f)?.request === q.id && raw(f)?.phase === 'prepared');
    ensure(prepared, 'prepared attempt absent');
    validate([f.id, prepared.id]);
    const bytes = take(p.captures.read(q.submitted));
    ensure(hashBytes(bytes) === q.submitted.hash && encoded(bytes).hash === q.inputDigest, 'missing or changed submitted bytes');
    if (fence) current(q, fence);
    return freeze({ request: ref, prepared: { owner: 'part-seven', name: 'JudgmentAttemptRecord', id: prepared.id }, value: q });
  });
  const decodeCapturedProviderDecision: ProviderJudgmentPort['decodeCapturedProviderDecision'] = subject => checked('DecodeCapturedProviderDecision', subject, () => {
    const snapshot = take(p.store.readForProjection());
    const exact = (reference: ProviderResponseSubject['seven']['request'], kind: string) => {
      const row = snapshot.entries.find(entry => entry.fact.id === reference.id);
      ensure(row && !row.taint.length && !row.conflicts.length && row.fact.kind === kind
        && row.fact.schemaVersion === reference.schemaVersion && row.fact.contentHash === reference.contentHash,
      'captured response owner fact differs or is unavailable');
      return row.fact;
    };
    const requestFact = exact(subject.seven.request, 'judgment-provider-ProviderJudgmentRequest');
    const preparedFact = exact(subject.seven.prepared, 'judgment-provider-ProviderJudgmentAttemptRecord');
    const responseFact = exact(subject.seven.response, 'judgment-provider-ProviderJudgmentAttemptRecord');
    const effectRequestFact = exact(subject.eight.request, 'effect-provider-ProviderEffectRequest');
    const executorFact = exact(subject.eight.executorObservation, 'effect-provider-ProviderOperationObservation');
    const responseObservationFact = exact(subject.eight.responseObservation, 'effect-provider-ProviderOperationObservation');
    const consumedFact = exact(subject.six.consumedReservation, 'transport-AdmissionReservation');
    const claimFact = exact(subject.six.dispatchClaim, 'transport-AdmissionReservation');
    const q = raw(requestFact) as unknown as ProviderJudgmentRequest;
    const prepared = raw(preparedFact)!, response = raw(responseFact)!, effectRequest = raw(effectRequestFact)!;
    const executor = raw(executorFact)!, responseObservation = raw(responseObservationFact)!;
    const consumed = raw(consumedFact)!, claim = raw(claimFact)!;
    ensure(prepared.phase === 'prepared' && prepared.request === q.id && response.phase === 'response-observed'
      && response.request === q.id && response.attempt === q.attempt && q.attempt === subject.seven.attempt,
    'captured response request or attempt differs');
    ensure(effectRequest.id === q.effectRequest && effectRequest.digest === q.inputDigest
      && executor.stage === 'executor-accepted' && responseObservation.stage === 'response'
      && executor.operation === subject.six.operation && responseObservation.operation === subject.six.operation
      && responseObservation.judgmentReceipt === responseFact.id
      && encoded(responseObservation.capture).bytes === encoded(response.receipt).bytes,
    'captured response effect observation differs');
    ensure(consumed.state === 'consumed' && claim.state === 'dispatch-claimed'
      && consumed.operation === subject.six.operation && claim.operation === subject.six.operation
      && consumed.request === effectRequest.id && claim.request === effectRequest.id
      && consumed.digest === q.inputDigest && claim.digest === q.inputDigest,
    'captured response claim or reservation differs');
    ensure(q.inputDigest === subject.submitted.operationDigest && q.submitted.reference === subject.submitted.capture.reference
      && q.submitted.hash === subject.submitted.capture.hash && q.provider === subject.route.provider
      && q.model === subject.route.model && q.route === subject.route.route && q.routeBasis === subject.route.routeBasis
      && q.floorDigest === subject.route.floorDigest && q.settingsDigest === subject.route.settingsDigest
      && q.outputSchemaDigest === subject.route.outputSchemaDigest && encoded(q.evidence).bytes === encoded(subject.route.evidence).bytes
      && encoded(q.evidence).hash === subject.route.evidenceDigest, 'captured response route or submitted identity differs');
    const receipt = response.receipt as Capture;
    const observation = JSON.parse(take(p.captures.read(receipt))) as ProviderObservation;
    observationCheck(observation, p.host.description);
    ensure(observation.state === 'complete' && observation.bytes !== null && observation.responseEvidence,
      'captured response is not a complete evidenced answer');
    const evidence = observation.responseEvidence;
    ensure(evidence.source.request === requestFact.id && evidence.source.attempt === q.attempt
      && evidence.source.operation === subject.six.operation && evidence.source.claim === claimFact.id
      && evidence.source.submittedDigest === q.inputDigest && evidence.source.provider === q.provider
      && evidence.source.model === q.model && evidence.source.route === q.route,
    'captured response evidence call binding differs');
    ensure(evidence.answer.source.reference === subject.response.capture.reference
      && evidence.answer.source.hash === subject.response.capture.hash
      && evidence.answer.answerDigest === subject.response.answerDigest
      && evidence.terminal.raw.reference === subject.terminal.capture.reference
      && evidence.terminal.raw.hash === subject.terminal.capture.hash
      && evidence.terminal.rawDigest === subject.terminal.rawDigest
      && evidence.terminal.evidence === subject.terminal.evidence
      && encoded(evidence.source.evidence).bytes === encoded(subject.terminal.sourceEvidence).bytes
      && evidence.contract.parserReference === subject.response.parserReference
      && evidence.contract.parserVersion === subject.response.parserVersion
      && evidence.contract.evidenceContractReference === subject.response.evidenceContractReference
      && evidence.contract.evidenceContractVersion === subject.response.evidenceContractVersion,
    'captured response evidence contract or capture differs');
    const answerBytes = take(p.captures.read(evidence.answer.source));
    ensure(answerBytes === observation.bytes && hashBytes(answerBytes) === subject.response.answerDigest,
      'captured answer bytes or digest changed');
    ensure(evidence.eligibility === 'admitted' && evidence.terminal.reason === 'successful-final-reply'
      && !evidence.terminal.limited && !evidence.terminal.errored && !evidence.terminal.cancelled
      && !evidence.terminal.timedOut && !evidence.terminal.truncated && !evidence.terminal.toolCall,
    'captured response terminal is not an admitted final reply');
    ensure(evidence.contract.parserReference === 'claude-code-json-result'
      && evidence.contract.parserVersion === '1', 'captured response parser is unsupported');
    let extracted: string;
    try {
      const rawBase64 = take(p.captures.read(evidence.terminal.raw));
      const terminalBytes = Buffer.from(rawBase64, 'base64');
      ensure(Buffer.from(terminalBytes).toString('base64') === rawBase64
        && `sha256:${createHash('sha256').update(terminalBytes).digest('hex')}` === evidence.terminal.rawDigest,
      'captured raw terminal bytes or digest changed');
      const terminalText = new TextDecoder('utf-8', { fatal: true }).decode(terminalBytes);
      const frame = JSON.parse(terminalText) as Record<string, unknown>;
      const transformed = frame.structured_output === undefined ? frame.result : JSON.stringify(frame.structured_output);
      ensure(frame.type === 'result' && frame.is_error === false && typeof transformed === 'string'
        && frame.stop_reason === evidence.terminal.providerReason, 'captured terminal transform is not a final reply');
      extracted = transformed;
    } catch (error) { ensure(false, `captured terminal transform refused: ${String(error)}`); throw error; }
    ensure(extracted === answerBytes && hashBytes(extracted) === evidence.answer.answerDigest,
      'captured terminal transform differs from answer capture');
    const decision = take(decode('Decision', JSON.parse(answerBytes), p.host.transport.current().decode));
    ensure(decision.floor && encoded(decision.floor.allowed).hash === q.floorDigest && 'judgment' in decision.by
      && decision.by.judgment === q.point && decision.by.route === q.route && decision.by.model === q.model,
    'answer floor, point, route, or model differs');
    ensure([...decision.conclusion.evidence, ...decision.reason.evidence].every(id => q.evidence.includes(id)),
      'answer invented evidence');
    const required = [requestFact.id, preparedFact.id, responseFact.id, effectRequestFact.id, executorFact.id,
      responseObservationFact.id, consumedFact.id, claimFact.id];
    validate(required);
    return freeze({ owner: 'part-seven' as const, decision: json(decision), answerBytes,
      answerDigest: subject.response.answerDigest, response: subject.seven.response,
      responseEvidence: json(evidence), required });
  });
  const recordProviderAnswerAcceptance: ProviderJudgmentPort['recordProviderAnswerAcceptance'] = (input, assessment, fence) =>
    checked('RecordProviderAnswerAcceptance', input, () => {
      ensure(assessment.owner === 'part-nine' && isGenuineProviderResponseAssessmentPort(assessment, p.store),
        'genuine same-store Nine response assessment required');
      const prepared = take(readPrepared({ owner: 'part-seven', name: 'JudgmentRequest', id: input.subject.seven.request.id }, fence));
      const q = prepared.value;
      current(q, fence);
      const decoded = take(decodeCapturedProviderDecision(input.subject));
      const snapshot = take(p.store.readForProjection());
      const exact = (reference: ProviderResponseSubject['seven']['response'], kind: string) => {
        const row = snapshot.entries.find(entry => entry.fact.id === reference.id);
        ensure(row && !row.taint.length && !row.conflicts.length && row.fact.kind === kind
          && row.fact.schemaVersion === reference.schemaVersion && row.fact.contentHash === reference.contentHash,
        'answer acceptance owner fact differs or is unavailable');
        return row.fact;
      };
      const settlementFact = exact(input.settlement, 'effect-provider-ProviderEffectSettlement');
      const accountingFact = exact(input.accounting, 'transport-SettlementApplication');
      const settlement = raw(settlementFact)!, accounting = raw(accountingFact) as unknown as SettlementApplication;
      ensure(settlement.acceptance === input.assessment.id && settlement.request === q.effectRequest
        && settlement.operation === input.subject.six.operation && settlement.claim === input.subject.six.dispatchClaim.id
        && settlement.digest === q.inputDigest && settlement.retryEligible === false,
      'answer acceptance settlement differs from response subject');
      ensure(accounting.type === 'SettlementApplication' && accounting.settlement === settlement.id
        && accounting.settlementFact === settlementFact.id && accounting.settlementHash === settlementFact.contentHash
        && accounting.operation === settlement.operation && accounting.request === settlement.request
        && accounting.claim === settlement.claim && accounting.digest === settlement.digest && accounting.retryEligible === 0,
      'answer acceptance accounting differs from settlement');
      ensure(Number.isSafeInteger(q.maxCharge) && q.maxCharge >= 0 && accounting.exposure === settlement.retainedExposure
        && (accounting.unresolved === 0 || settlement.retainedExposure === q.maxCharge),
      'answer acceptance did not retain enforced maximum exposure');
      const transport = take(p.authority.inspect());
      const reservations = transport.filter(row => row.record.type === 'AdmissionReservation');
      const exposure = new Map<string, number>();
      for (const row of reservations) if (row.record.type === 'AdmissionReservation' && row.record.state !== 'prepared'
        && row.record.state !== 'closed') exposure.set(row.record.operation, row.record.charge);
      for (const row of transport) if (row.record.type === 'SettlementApplication')
        exposure.set(row.record.operation, row.record.exposure);
      ensure([...exposure.values()].reduce((sum, amount) => sum + amount, 0) <= p.host.transport.budget,
        'retained provider exposure exceeds current spend capacity');
      return take(assessment.consumeProviderResponseAssessment(input.assessment, input.subject, view => {
        ensure(view.answerDigest === decoded.answerDigest && view.assessment.id === input.assessment.id,
          'Nine response assessment differs from captured Decision');
        ensure(view.assessmentFact.id === input.assessment.id
          && view.assessmentFact.kind === 'verification-VerificationAssessment'
          && view.assessmentFact.schemaVersion === 1
          && view.assessmentFact.contentHash === snapshot.entries.find(entry => entry.fact.id === input.assessment.id)?.fact.contentHash,
        'Nine assessment fact identity differs');
        const prior = facts().find(fact => fact.kind === 'judgment-provider-ProviderAnswerAcceptance'
          && raw(fact)?.request === q.id && raw(fact)?.attempt === q.attempt);
        if (prior) {
          const value = raw(prior) as unknown as ProviderAnswerAcceptance;
          ensure(value.assessment.id === input.assessment.id && value.settlement.id === settlementFact.id
            && value.accounting.id === accountingFact.id && value.answerDigest === decoded.answerDigest,
          'provider answer already accepted with different joins');
          return freeze({ owner: 'part-seven' as const, name: 'ProviderAnswerAcceptance' as const, id: prior.id });
        }
        const fields = { request: q.id, attempt: q.attempt, response: input.subject.seven.response,
          operation: input.subject.six.operation, claim: input.subject.six.dispatchClaim.id, digest: q.inputDigest,
          capture: input.subject.response.capture,
          answerDigest: decoded.answerDigest, assessment: view.assessmentFact,
          settlement: input.settlement, accounting: input.accounting, maximumCharge: q.maxCharge,
          retainedExposure: accounting.exposure, generation: p.host.transport.current().generation.id,
          acceptedAt: p.host.transport.current().clock.value };
        const candidate: ProviderAnswerAcceptance = freeze({ type: 'ProviderAnswerAcceptance', schemaVersion: 1,
          id: `provider-answer-acceptance:${encoded(fields).hash}`, ...fields });
        const fact = append(candidate, [...view.required, settlementFact.id, accountingFact.id], decoded.decision as unknown as Decision);
        return freeze({ owner: 'part-seven' as const, name: 'ProviderAnswerAcceptance' as const, id: fact.id });
      }));
    });
  const port = Object.freeze({ owner: 'part-seven', readPrepared, decodeCapturedProviderDecision, recordProviderAnswerAcceptance,
    prepare: (input, fence) => checked('PrepareProviderJudgment', input, () => {
      ensure(Object.keys(input).sort().join(',') === 'context,deadline,evidence,id,ordinal,question,run,semanticMessage,step', 'closed provider question');
      ensure(input.run.owner === 'part-five' && input.run.name === 'Run', 'Five run required');
      const view = take(p.runs.read(input.run.id)), pending = facts().find(f => f.kind === 'run-transition' && raw(f)?.id === view.head);
      ensure(facts().find(fact => fact.id === view.run.opening.id)?.kind !== 'judgment-provider-ProviderAnswerAcceptance',
        'accepted provider reply Run cannot request another model operation');
      ensure(pending && view.pending.some(s => s.id === input.step), 'real Five pending step required');
      ensure(Number.isSafeInteger(input.ordinal) && input.ordinal >= 0 && input.id.length > 0 && input.semanticMessage.length > 0, 'bounded question identity');
      const d = p.host.description;
      for (const n of [p.maxTokens, p.maxCaptureBytes, p.timeout, d.maxInputBytes, d.maxOutputBytes, d.maxCharge, input.deadline]) ensure(Number.isSafeInteger(n) && n >= 0, 'finite provider bound');
      ensure(d.automaticRetries === 0 && d.measured === false && d.basis.length > 0 && p.disclosure.length > 0, 'registered route basis required');
      ensure(p.settings.automaticRetries === 0 && p.settings.maxTokens === p.maxTokens, 'submitted settings exceed token/retry bounds');
      const submitted = encoded({ provider: d.provider, model: d.model, route: d.route, messages: [{ role: 'user', content: input.question },
        { role: 'context', content: input.context }], attachments: [], tools: [], settings: p.settings, outputSchema: p.outputSchema,
        floor: p.host.floor, evidence: input.evidence, point: p.host.point, generation: p.host.transport.current().generation.id }).bytes;
      ensure(new TextEncoder().encode(submitted).length <= d.maxInputBytes && p.maxTokens > 0 && p.timeout > 0, 'provider input/token/time bound exceeded');
      const digest = encoded(submitted).hash;
      ensure(view.pending.some(s => s.id === input.step && s.operation.key === input.semanticMessage && s.operation.digest === digest), 'Five pending input digest differs');
      const prior = facts().find(f => f.kind === 'judgment-provider-ProviderJudgmentRequest' && f.schemaVersion === 1 && (raw(f)?.id === input.id
        || raw(f)?.run === input.run.id && raw(f)?.step === input.step && raw(f)?.ordinal === input.ordinal));
      if (prior) { ensure(raw(prior)?.inputDigest === digest && raw(prior)?.id === input.id, 'request immutable collision');
        validate([prior.id]);
        const q = raw(prior) as unknown as ProviderJudgmentRequest;
        if (!facts().some(f => f.kind === 'judgment-provider-ProviderJudgmentAttemptRecord'
          && raw(f)?.request === q.id && raw(f)?.phase === 'prepared')) {
          current(q, fence);
          const bytes = take(p.captures.read(q.submitted));
          ensure(hashBytes(bytes) === q.submitted.hash && encoded(bytes).hash === q.inputDigest, 'missing or changed submitted bytes');
          append({ type: 'ProviderJudgmentAttemptRecord', schemaVersion: 2, id: `${q.attempt}:prepared`, request: q.id,
            attempt: q.attempt, phase: 'prepared', submittedDigest: q.inputDigest,
            operation: '', reservation: '', claim: '', observation: '' }, [prior.id]);
        }
        return take(readPrepared({ owner: 'part-seven', name: 'JudgmentRequest', id: prior.id }, fence)); }
      ensure(new TextEncoder().encode(input.question + input.context + submitted).length + 6 * d.maxOutputBytes + 8192 <= p.maxCaptureBytes, 'capture bound exceeded');
      const capture = (bytes: string) => take(p.captures.put(bytes, d.maxInputBytes));
      const attempt = `attempt:${input.id}:1`;
      const q: ProviderJudgmentRequest = freeze({ type: 'ProviderJudgmentRequest', schemaVersion: 2, id: input.id,
        run: input.run.id, step: input.step, predecessor: view.head, pending: pending.id, ordinal: input.ordinal,
        semanticMessage: input.semanticMessage, point: p.host.point, consumer: 'advisory', generation: p.host.transport.current().generation.id,
        incarnation: p.host.transport.incarnation, deadline: input.deadline, question: capture(input.question), context: capture(input.context), submitted: capture(submitted),
        inputDigest: digest, floorDigest: encoded(p.host.floor).hash, evidence: input.evidence, provider: d.provider, model: d.model, route: d.route,
        routeBasis: d.basis, disclosure: p.disclosure, settingsDigest: encoded(p.settings).hash, outputSchemaDigest: encoded(p.outputSchema).hash,
        maxInputBytes: d.maxInputBytes, maxOutputBytes: d.maxOutputBytes, maxCaptureBytes: p.maxCaptureBytes,
        maxTokens: p.maxTokens, maxCharge: d.maxCharge, timeout: p.timeout, attempt,
        effectRequest: `provider-request:${encoded([input.run.id, input.step, input.ordinal, attempt, digest]).hash}` });
      current(q, fence);
      const request = append(q, [pending.id]);
      append({ type: 'ProviderJudgmentAttemptRecord', schemaVersion: 2, id: `${attempt}:prepared`, request: q.id, attempt,
        phase: 'prepared', submittedDigest: digest, operation: '', reservation: '', claim: '', observation: '' }, [request.id]);
      return take(readPrepared({ owner: 'part-seven', name: 'JudgmentRequest', id: request.id }, fence));
    }),
    recordReceipt: receipt => checked('RecordProviderReceipt', null, () => take(consumeProviderReceipt(receipt, p.boundary, value => {
      const prepared = take(readPrepared(value.request)), q = prepared.value;
      ensure(value.attempt === q.attempt && value.digest === q.inputDigest && value.effectRequest === q.effectRequest, 'receipt request/attempt/operation mismatch');
      const consumed = facts().find(f => f.id === value.reservation && f.kind === 'transport-AdmissionReservation');
      ensure(consumed && raw(consumed)?.state === 'consumed' && raw(consumed)?.operation === value.operation, 'missing consumed claim');
      const observation = facts().find(f => f.id === value.observation && f.kind === 'effect-provider-ProviderOperationObservation');
      ensure(observation && raw(observation)?.stage === 'executor-accepted' && raw(observation)?.claim === value.claim, 'receipt missing executor observation');
      const content = take(p.captures.read(value.capture));
      observationCheck(JSON.parse(content) as ProviderObservation, p.host.description);
      const f = append({ type: 'ProviderJudgmentAttemptRecord', schemaVersion: 2, id: `${q.attempt}:response`, request: q.id,
        attempt: q.attempt, phase: 'response-observed', submittedDigest: q.inputDigest, operation: value.operation,
        reservation: value.reservation, claim: value.claim, observation: value.observation, receipt: value.capture },
      [prepared.prepared.id, consumed.id, observation.id, value.claim]);
      return freeze({ owner: 'part-seven' as const, name: 'JudgmentAttemptRecord' as const, id: f.id });
    }))),
    resolve: (reference, settlement, fence) => checked('ResolveProviderJudgment', reference, () => {
      const prepared = take(readPrepared(reference, fence)), q = prepared.value;
      const response = facts().find(f => f.kind === 'judgment-provider-ProviderJudgmentAttemptRecord' && raw(f)?.request === q.id && raw(f)?.phase === 'response-observed');
      ensure(response, 'missing receipt; uncertainty retained');
      const observation = JSON.parse(take(p.captures.read(raw(response)!.receipt as Capture))) as ProviderObservation;
      ensure(observation.state === 'complete' && observation.bytes !== null, 'provider timeout or missing answer; uncertainty retained');
      const decision = take(decode('Decision', JSON.parse(observation.bytes), p.host.transport.current().decode));
      ensure(decision.floor && encoded(decision.floor.allowed).hash === q.floorDigest && 'judgment' in decision.by
        && decision.by.judgment === q.point && decision.by.route === q.route && decision.by.model === q.model, 'answer floor/route mismatch');
      ensure([...decision.conclusion.evidence, ...decision.reason.evidence].every(id => q.evidence.includes(id)), 'answer invented evidence');
      const accounting = facts().find(f => f.kind === 'transport-SettlementApplication' && raw(f)?.settlement === settlement.id && raw(f)?.unresolved === 0);
      ensure(accounting, 'unknown charge or missing Six accounting');
      return take(consumeEffectSettlement(settlement, p.boundary, s => {
        ensure(s.request === q.effectRequest && s.operation === raw(response)?.operation && s.digest === q.inputDigest, 'settlement request mismatch');
        const sf = facts().find(f => f.kind === 'effect-provider-ProviderEffectSettlement' && raw(f)?.id === s.id); ensure(sf, 'settlement missing');
        const resolution = append({ type: 'ProviderJudgmentResolution', schemaVersion: 2, id: `${q.id}:resolution`, request: q.id, attempt: q.attempt,
          response: response.id, settlement: sf.id, accounting: accounting.id }, [response.id, sf.id, accounting.id], decision);
        return freeze({ resolution: { owner: 'part-seven', name: 'JudgmentResolution', id: resolution.id }, decision });
      }));
    }),
  } satisfies ProviderJudgmentPort);
  return registerProviderDecisionReadPort(port, p.store);
}
