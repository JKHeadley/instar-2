import { consumeOutcome, consumeResult, decode } from '../index.js';
import type { OwnedReference, Result, FactEnvelopeReference } from '../index.js';
import { authorAndAppend, causalCone, registerOwnedBody } from '../facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, FactStorePort, OwnedShape } from '../facts/index.js';
import type { AdmissionReservation, DispatchClaim, FenceToken, TransportAuthority } from '../transport/index.js';
import type { Capture, PreparedProviderJudgment, ProviderJudgmentPort } from '../judgment/index.js';
import type { RunStep, RunGraphDependencies } from '../rungraph/index.js';
import type { ProviderInvocationPort } from '../assembly/index.js';
import type { EffectSettlementAssessmentInput, EffectSettlementAssessmentPort } from '../verification/index.js';
import type { EffectDurabilityPort, EffectCustodyPort, EffectHost, EffectRequest, EffectSettlement, OperationDefinition, OperationObservation } from './contracts.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { definitionCheck, effectShapes, recordFrom, wire } from './records.js';
import { issuedSettlement, requireSettlement, withSettlement } from './settlement-authority.js';
import { withProviderReceipt } from './provider-authority.js';

export interface ProviderCallPayload {
  readonly kind: 'model-provider-call'; readonly version: 1;
  readonly request: OwnedReference<'part-seven', 'JudgmentRequest'>;
  readonly prepared: OwnedReference<'part-seven', 'JudgmentAttemptRecord'>;
  readonly effectRequest: string; readonly attempt: string; readonly submitted: Capture; readonly submittedDigest: string;
  readonly run: string; readonly semanticMessage: string; readonly provider: string; readonly model: string; readonly route: string;
  readonly settingsDigest: string; readonly outputSchemaDigest: string; readonly deadline: number; readonly disclosure: string;
  readonly definition: string; readonly verificationBar: string; readonly verificationOwner: string; readonly resultDestination: string;
  readonly maxInputBytes: number; readonly maxOutputBytes: number; readonly maxCaptureBytes: number;
  readonly maxTokens: number; readonly maxCharge: number; readonly timeout: number;
}
export interface ProviderEffectRequest {
  readonly type: 'ProviderEffectRequest'; readonly schemaVersion: 2; readonly id: string; readonly definition: string;
  readonly semanticMessage: string; readonly run: string; readonly pending: string; readonly attempt: string;
  readonly digest: string; readonly verificationOwner: string; readonly verificationBar: string; readonly obligation: string;
  readonly closure: readonly string[]; readonly payload: ProviderCallPayload;
}
export interface ProviderOperationObservation extends Omit<OperationObservation, 'type'> { readonly type: 'ProviderOperationObservation'; readonly judgmentReceipt: string }
export interface ProviderEffectDependencies {
  readonly host: EffectHost; readonly context: FactContext; readonly store: FactStorePort; readonly privateKey: string;
  readonly transport: TransportAuthority; readonly judgment: ProviderJudgmentPort; readonly invocation: ProviderInvocationPort;
  readonly durability: EffectDurabilityPort; readonly custody: EffectCustodyPort;
  readonly assessment: EffectSettlementAssessmentPort | null; readonly plan: string;
}
export interface ProviderEffectDoorway {
  readonly owner: 'part-eight';
  prepare(input: Readonly<{ prepared: PreparedProviderJudgment; definition: string; verificationOwner: string;
    resultDestination: string; obligation: string }>, fence: FenceToken): Result<ProviderEffectRequest>;
  adopt(request: ProviderEffectRequest, reservation: AdmissionReservation, fence: FenceToken): Result<ProviderEffectRequest>;
  dispatch(request: ProviderEffectRequest, fence: FenceToken): Promise<Result<ProviderOperationObservation>>;
  handoff(request: ProviderEffectRequest, claim: DispatchClaim, fence: FenceToken): Promise<Result<ProviderOperationObservation>>;
  assess(operation: string): Result<OwnedReference<'part-nine', 'VerificationAssessment'>>;
  settle(operation: string, assessment: OwnedReference<'part-nine', 'VerificationAssessment'>): Result<EffectSettlement>;
  readRunSettlement(reference: FactEnvelopeReference, step: RunStep): ReturnType<RunGraphDependencies['settlement']['read']>;
  inspect(): Result<readonly FactEnvelope[]>;
}
const txt = { kind: 'text', maxLength: 512 } as const, int = { kind: 'integer' } as const;
const ref = { kind: 'object', fields: { owner: txt, name: txt, id: txt } } as const;
const payloadShape: OwnedShape = { kind: 'object', fields: { kind: txt, version: int, request: ref, prepared: ref,
  effectRequest: txt, attempt: txt, submitted: { kind: 'capture' }, submittedDigest: txt, run: txt, semanticMessage: txt,
  provider: txt, model: txt, route: txt, settingsDigest: txt, outputSchemaDigest: txt, deadline: int, disclosure: txt,
  definition: txt, verificationBar: txt, verificationOwner: txt, resultDestination: txt, maxInputBytes: int, maxOutputBytes: int,
  maxCaptureBytes: int, maxTokens: int, maxCharge: int, timeout: int } };
const legacyRequest = effectShapes.EffectRequest as Extract<OwnedShape, { kind: 'object' }>;
const { message: _message, ...requestFields } = legacyRequest.fields;
const observationShape = effectShapes.OperationObservation as Extract<OwnedShape, { kind: 'object' }>;
const shapes: Readonly<Record<string, OwnedShape>> = {
  ProviderEffectRequest: { kind: 'object', fields: { ...requestFields, payload: payloadShape } },
  ProviderOperationObservation: { kind: 'object', fields: { ...observationShape.fields, judgmentReceipt: txt } },
  ProviderEffectSettlement: effectShapes.EffectSettlement!,
};
const raw = (f: FactEnvelope) => (f.body as unknown as { record: Record<string, unknown> }).record;
const active = new WeakMap<object, string>();
const providerKind = (name: string) => `effect-provider-${name === 'EffectSettlement' ? 'ProviderEffectSettlement' : name}`;
// Provider facts occupy separate kinds and body registrations; legacy facts never migrate.
export const providerEffectMigrations = [] as const;
export function providerEffectSchemas(host: EffectHost): readonly FactSchema[] {
  return Object.keys(shapes).map(name => ({ kind: providerKind(name), version: 1,
    fields: { record: { kind: 'owned', owner: 'part-eight', name }, evidence: { kind: 'constitutional', type: 'Evidence' }, outcome: { kind: 'constitutional', type: 'Outcome' } }, optional: ['evidence', 'outcome'], machineScope: 'shared',
    standing: 'requester', action: 'work', scope: host.scope, causallyBound: false, requiredReferences: [], authority: 'none' }));
}
export function registerProviderEffectBodies(host: EffectHost) {
  return boundary('ProviderEffectRegistrations', null, host.boundary, () => Object.entries(shapes).map(([name, shape]) => take(registerOwnedBody({
    name, owner: 'part-eight', currentVersion: name === 'ProviderEffectRequest' ? 2 : 1,
    versions: { 1: { validate: v => ({ ok: true, value: v }) }, ...(name === 'ProviderEffectRequest' ? { 2: { validate: (v: import('../index.js').Json) => ({ ok: true as const, value: v }) } } : {}) },
    migrations: name === 'ProviderEffectRequest' ? { 1: () => { throw new Error('legacy reply uses the unchanged version-one decoder'); } } : {},
    decodeCurrent: (v, ctx) => {
      try {
        const r = v as Record<string, import('../index.js').Json>, past = causalCone(ctx.origin, ctx.facts.facts);
        ensure(r.type === name && typeof r.id === 'string' && r.id.length > 0, 'provider effect identity');
        ensure(ctx.origin.principal.id === host.principal.id && ctx.origin.machine === host.machine, 'provider effect recorder differs');
        ensure(!past.some(f => f.kind === ctx.origin.kind && raw(f)?.id === r.id), 'provider effect immutable collision');
        if (ctx.mode === 'origin' && name !== 'ProviderEffectSettlement') ensure(active.get(host) === encoded(v).hash, 'provider effect requires owner admission');
        if (name === 'ProviderEffectRequest') {
          const q = v as unknown as ProviderEffectRequest, p = q.payload;
          ensure(p.kind === 'model-provider-call' && p.version === 1 && q.schemaVersion === 2, 'ordinary reply substituted for provider payload');
          const request = past.find(f => f.id === p.request.id && f.kind === 'judgment-provider-ProviderJudgmentRequest' && f.schemaVersion === 1);
          const prepared = past.find(f => f.id === p.prepared.id && f.kind === 'judgment-provider-ProviderJudgmentAttemptRecord' && raw(f)?.phase === 'prepared');
          ensure(request && prepared && raw(prepared)?.request === raw(request)?.id && raw(request)?.effectRequest === q.id
            && raw(request)?.attempt === q.attempt && raw(request)?.inputDigest === q.digest, 'provider preparation binding mismatch');
          ensure(p.attempt === q.attempt && p.effectRequest === q.id && p.submittedDigest === q.digest
            && p.run === q.run && p.semanticMessage === q.semanticMessage, 'provider payload binding mismatch');
          ensure(q.closure.every(id => past.some(f => f.id === id)) && q.closure.includes(q.pending), 'provider closure absent');
        } else {
          const q = past.find(f => f.kind === 'effect-provider-ProviderEffectRequest' && raw(f)?.id === r.request);
          ensure(q && raw(q)?.digest === r.digest, 'provider operation request mismatch');
          const claim = past.find(f => f.id === r.claim && f.kind === 'transport-AdmissionReservation');
          ensure(claim && raw(claim)?.state === 'dispatch-claimed' && raw(claim)?.operation === r.operation, 'provider claim missing');
          if (name === 'ProviderEffectSettlement') {
            const settlement = recordFrom({ body: { record: { ...r, type: 'EffectSettlement' } } } as unknown as FactEnvelope) as EffectSettlement;
            ensure(settlement.schemaVersion === 1 && settlement.observations.length > 0
              && settlement.observations.every(id => past.some(f => f.kind === 'effect-provider-ProviderOperationObservation'
                && raw(f)?.id === id && raw(f)?.operation === settlement.operation && raw(f)?.request === settlement.request
                && raw(f)?.claim === settlement.claim && raw(f)?.digest === settlement.digest)), 'provider settlement observations differ');
            ensure(past.some(f => f.id === settlement.acceptance && f.kind === 'verification-VerificationAssessment'), 'provider assessment absent');
            const reservation = past.find(f => f.id === settlement.reservation && f.kind === 'transport-AdmissionReservation');
            ensure(reservation && raw(reservation)?.state === 'consumed' && raw(reservation)?.operation === settlement.operation,
              'provider settlement consumed reservation differs');
            ensure(!settlement.retryEligible && settlement.retainedExposure >= 0
              && (settlement.finalCharge === null ? settlement.retainedExposure === raw(reservation)?.charge
                : Number.isSafeInteger(settlement.finalCharge) && settlement.finalCharge >= 0), 'provider settlement charge differs');
            if (ctx.mode === 'origin') requireSettlement(host, settlement);
          }
          if (name === 'ProviderOperationObservation' && r.stage !== 'executor-accepted') {
            const receipt = past.find(f => f.id === r.judgmentReceipt && f.kind === 'judgment-provider-ProviderJudgmentAttemptRecord');
            ensure(receipt && raw(receipt)?.operation === r.operation && raw(receipt)?.phase === 'response-observed', 'provider observation missing Seven receipt');
          }
        }
        return { ok: true, value: v };
      } catch (e) { return { ok: false, detail: String(e) }; }
    },
  }, shape, host.boundary))));
}
export function createProviderEffectDoorway(p: ProviderEffectDependencies): ProviderEffectDoorway {
  const checked = <T>(n: string, i: unknown, fn: () => T) => boundary(n, i, p.host.boundary, fn);
  // A request object whose one-use Six claim we observed consumed can only
  // refuse another dispatch. This accelerates refusal, never grants authority;
  // copied requests and fresh doorways still use the durable checks below.
  const consumedRequests = new WeakSet<ProviderEffectRequest>();
  const facts = () => take(p.store.readForProjection()).entries.map(e => e.fact);
  const validate = (ids: readonly string[], entries = take(p.store.readForProjection()).entries) => {
    const seen = new Set<string>();
    const visit = (id: string) => {
      if (seen.has(id)) return; seen.add(id);
      const row = entries.find(e => e.fact.id === id);
      ensure(row && !row.taint.length && !row.conflicts.length, 'effect dependency tainted or withdrawn');
      row.fact.predecessors.required.forEach(visit);
    };
    ids.forEach(visit);
  };
  const find = (kind: string, id: string) => { const f = facts().find(f => f.kind === kind && raw(f)?.id === id); ensure(f, `missing ${kind}`); validate([f.id]); return f; };
  const save = (r: object & { type: string; id: string }, required: readonly string[], attachments: Readonly<Record<string, import('../index.js').Json>> = {}) => {
    validate(required);
    const legacy = r.type === 'EffectSettlement' && facts().some(f => f.kind === 'effect-EffectRequest'
      && raw(f)?.id === (r as EffectSettlement).request);
    const kind = legacy ? 'effect-EffectSettlement' : providerKind(r.type);
    const v = r.type === 'EffectSettlement' ? { ...wire(r as EffectSettlement) as object,
      type: legacy ? 'EffectSettlement' : 'ProviderEffectSettlement' } : json(r);
    const prior = facts().find(f => f.kind === kind && raw(f)?.id === r.id);
    if (prior) { ensure(encoded(raw(prior)).bytes === encoded(v).bytes, 'effect immutable collision'); return prior; }
    active.set(p.host, encoded(v).hash);
    try { return take(authorAndAppend({ kind, schemaVersion: 1, machine: p.host.machine,
      principal: json(p.host.principal), provenance: json(p.host.principal.provenance), at: json(p.host.current().clock),
      body: { record: v, ...(legacy ? {} : attachments) }, required: [...new Set(required)] }, p.context, p.store, p.privateKey)).fact; }
    finally { active.delete(p.host); }
  };
  const demand = (d: OperationDefinition, ids: readonly string[]) => {
    const all = facts(), closure = new Map<string, FactEnvelope>();
    for (const id of ids) { const f = all.find(f => f.id === id); ensure(f, 'durability closure missing');
      for (const item of [...causalCone(f, all), f]) closure.set(item.id, item); }
    const receipts = take(p.durability.ensure([...closure.values()]));
    for (const f of closure.values()) {
      const receipt = receipts.find(r => r.fact.id === f.id);
      ensure(receipt && encoded(receipt.fact).bytes === encoded(f).bytes && !receipt.taint.length, 'exact durable receipt missing');
      const state = receipt.durability;
      ensure(state.kind === 'local-durable' || state.kind === 'replicated', 'local durability missing');
      if (d.durability === 'replicated') ensure(state.kind === 'replicated' && state.n >= d.replicas
        && state.n === new Set(state.peers).size && !state.peers.includes(f.machine), 'replicated provider demand unmet');
    }
  };
  const actual = (q: ProviderEffectRequest, fence?: FenceToken) => {
    ensure(encoded(raw(find('effect-provider-ProviderEffectRequest', q.id))).bytes === encoded(q).bytes, 'provider request changed');
    const d = raw(find('effect-OperationDefinition', q.definition)) as unknown as OperationDefinition;
    definitionCheck(d, p.host);
    const seven = take(p.judgment.readPrepared(q.payload.request, fence));
    ensure(q.id === seven.value.effectRequest && q.digest === seven.value.inputDigest && q.attempt === seven.value.attempt
      && q.run === seven.value.run && q.semanticMessage === seven.value.semanticMessage, 'request/attempt mismatch');
    ensure((!fence || q.payload.deadline > p.host.current().clock.value) && q.payload.maxCharge === d.maxCharge
      && q.payload.maxInputBytes <= d.maxBytes && q.payload.timeout <= d.timeout, 'provider bound exceeded');
    ensure(q.payload.route === d.adapter && q.payload.provider === d.account && q.payload.disclosure === d.conversation, 'unapproved provider route');
    return d;
  };
  const operation = (id: string) => {
    const all = take(p.transport.inspect()), records = all.filter(f => f.record.type === 'AdmissionReservation' && f.record.operation === id);
    const last = records.at(-1); ensure(last?.record.type === 'AdmissionReservation', 'provider reservation absent');
    const claim = records.find(f => f.record.type === 'AdmissionReservation' && f.record.state === 'dispatch-claimed');
    return { reservation: last.record, fact: last.fact, claim: claim?.fact };
  };
  const inputFor = (id: string) => {
    const op = operation(id); ensure(op.claim && op.reservation.state === 'consumed', 'missing consumed claim');
    const provider = facts().some(f => f.kind === 'effect-provider-ProviderEffectRequest' && raw(f)?.id === op.reservation.request);
    const q = raw(find(provider ? 'effect-provider-ProviderEffectRequest' : 'effect-EffectRequest', op.reservation.request)) as unknown as ProviderEffectRequest | EffectRequest;
    const d = q.type === 'ProviderEffectRequest' ? actual(q) : raw(find('effect-OperationDefinition', q.definition)) as unknown as OperationDefinition;
    if (q.type === 'EffectRequest') {
      definitionCheck(d, p.host);
      const message = raw(find('effect-OutboundMessage', q.message));
      ensure(encoded(message).hash === q.digest && message?.run === q.run && message?.semanticMessage === q.semanticMessage,
        'ordinary reply binding differs');
    }
    const observationKind = provider ? 'effect-provider-ProviderOperationObservation' : 'effect-OperationObservation';
    // Select and validate the exact observation set from ONE status-bearing P2
    // snapshot. No host callback or other wait intervenes between these steps.
    // Each inputFor call still obtains a fresh snapshot, including the final
    // re-resolution after capture/custody work and before Nine's live guard.
    const observationEntries = take(p.store.readForProjection()).entries;
    const selected = observationEntries.filter(e => e.fact.kind === observationKind && raw(e.fact)?.operation === id);
    const observations = selected.map(e => raw(e.fact) as unknown as ProviderOperationObservation);
    validate(selected.map(e => e.fact.id), observationEntries);
    ensure(!provider || observations.some(o => o.judgmentReceipt.length > 0), 'missing Seven receipt; retain uncertainty');
    const input: EffectSettlementAssessmentInput = { request: { id: q.id, digest: q.digest, attempt: q.attempt, verificationBar: q.verificationBar },
      reservation: op.reservation, claim: op.claim.id, observations, plan: p.plan, bar: q.verificationBar,
      generation: p.host.current().decode.register.generation.id };
    return { op, q, d, input };
  };
  const observation = (q: ProviderEffectRequest, stage: 'executor-accepted' | 'response' | 'unknown', capture: Capture, judgmentReceipt = '') => {
    const op = operationForRequest(q); ensure(op.claim, 'claim absent');
    const r = freeze({ type: 'ProviderOperationObservation', schemaVersion: 1, id: `${q.id}:${stage}`, request: q.id,
      operation: op.reservation.operation, claim: op.claim.id, digest: q.digest, account: q.payload.provider, conversation: q.payload.disclosure,
      stage, wake: '', capture, attestation: 'local-recorder', judgmentReceipt } as ProviderOperationObservation);
    const f = save(r, [find('effect-provider-ProviderEffectRequest', q.id).id, op.fact.id, op.claim.id, ...(judgmentReceipt ? [judgmentReceipt] : [])]);
    return { value: r, fact: f };
  };
  const operationForRequest = (q: ProviderEffectRequest) => {
    const r = take(p.transport.inspect()).filter(f => f.record.type === 'AdmissionReservation' && f.record.request === q.id).at(-1);
    ensure(r?.record.type === 'AdmissionReservation', 'provider request not reserved'); return operation(r.record.operation);
  };
  const matches = (q: ProviderEffectRequest, r: AdmissionReservation, d: OperationDefinition) => ensure(r.request === q.id
    && r.digest === q.digest && r.attempt === q.attempt && r.run === q.run && r.semanticMessage === q.semanticMessage
    && r.charge === d.maxCharge && r.durability === d.durability && r.replicas === d.replicas, 'provider admission binding mismatch');
  const api: ProviderEffectDoorway = {
    owner: 'part-eight', inspect: () => checked('ProviderEffectInspect', null, facts),
    prepare: (input, fence) => checked('PrepareProviderEffect', input, () => {
      const prepared = take(p.judgment.readPrepared(input.prepared.request, fence));
      ensure(encoded(prepared).bytes === encoded(input.prepared).bytes, 'changed Seven preparation');
      const s = prepared.value, d = raw(find('effect-OperationDefinition', input.definition)) as unknown as OperationDefinition;
      definitionCheck(d, p.host);
      const obligation = facts().find(f => f.id === input.obligation && f.kind === 'transport-LoopRecord' && raw(f)?.run === s.run);
      ensure(obligation && input.verificationOwner.length > 0 && input.resultDestination.length > 0, 'provider verification obligation absent');
      const payload: ProviderCallPayload = { kind: 'model-provider-call', version: 1, request: prepared.request, prepared: prepared.prepared,
        effectRequest: s.effectRequest, attempt: s.attempt, submitted: s.submitted, submittedDigest: s.inputDigest, run: s.run,
        semanticMessage: s.semanticMessage, provider: s.provider, model: s.model, route: s.route, settingsDigest: s.settingsDigest,
        outputSchemaDigest: s.outputSchemaDigest, deadline: s.deadline, disclosure: s.disclosure, definition: d.id,
        verificationBar: d.verificationBar, verificationOwner: input.verificationOwner, resultDestination: input.resultDestination,
        maxInputBytes: s.maxInputBytes, maxOutputBytes: s.maxOutputBytes, maxCaptureBytes: s.maxCaptureBytes,
        maxTokens: s.maxTokens, maxCharge: s.maxCharge, timeout: s.timeout };
      const closure = [...new Set([s.pending, prepared.request.id, prepared.prepared.id, find('effect-OperationDefinition', d.id).id,
        obligation.id, ...p.host.current().authority])];
      const q: ProviderEffectRequest = freeze({ type: 'ProviderEffectRequest', schemaVersion: 2, id: s.effectRequest, definition: d.id,
        semanticMessage: s.semanticMessage, run: s.run, pending: s.pending, attempt: s.attempt, digest: s.inputDigest,
        verificationOwner: input.verificationOwner, verificationBar: d.verificationBar, obligation: obligation.id, closure, payload });
      save(q, closure); actual(q, fence); demand(d, [find('effect-provider-ProviderEffectRequest', q.id).id]);
      actual(q, fence);
      take(p.transport.reserve({ command: `reserve:${q.id}`, fence, request: { owner: 'part-eight', name: 'EffectRequest', id: q.id },
        attempt: q.attempt, payloadDigest: q.digest, charge: d.maxCharge, run: { owner: 'part-five', name: 'Run', id: q.run },
        semanticMessage: q.semanticMessage, durability: d.durability, replicas: d.replicas }));
      return q;
    }),
    adopt: (q, supplied, fence) => checked('AdoptProviderAdmission', q, () => {
      const d = actual(q, fence), op = operation(supplied.operation); matches(q, op.reservation, d);
      ensure(encoded(supplied).bytes === encoded(op.reservation).bytes && supplied.state === 'prepared', 'adoption admission changed or consumed');
      demand(d, [op.fact.id, find('effect-provider-ProviderEffectRequest', q.id).id]); return q;
    }),
    dispatch: async (q, fence) => {
      const ready = checked('DispatchProviderEffect', q, () => {
        ensure(!consumedRequests.has(q), 'claimed provider operation uncertain; never invoke twice');
        const d = actual(q, fence), op = operationForRequest(q); matches(q, op.reservation, d);
        ensure(op.reservation.state === 'prepared', 'claimed provider operation uncertain; never invoke twice');
        demand(d, [op.fact.id, find('effect-provider-ProviderEffectRequest', q.id).id]); actual(q, fence);
        return take(p.transport.claim(`claim:${q.id}`, fence, op.reservation.operation));
      });
      return consumeResult(ready, { Refused: r => Promise.resolve(r), Success: claim => api.handoff(q, claim, fence) });
    },
    handoff: async (q, claim, fence) => {
      const ready = checked('HandoffProviderEffect', q, () => {
        const d = actual(q, fence), op = operation(claim.operation); matches(q, op.reservation, d);
        ensure(op.claim && op.reservation.state === 'dispatch-claimed' && claim.digest === q.digest && claim.attempt === q.attempt,
          'missing or consumed provider claim');
        demand(d, [op.fact.id, op.claim.id, find('effect-provider-ProviderEffectRequest', q.id).id]); actual(q, fence); return d;
      });
      return consumeResult(ready, { Refused: r => Promise.resolve(r), Success: async d => {
        let accepted: ReturnType<typeof observation> | undefined;
        const result = await p.invocation.invoke(q.payload, claim, fence, () => checked('ProviderExecutorAccepted', null, () => {
          actual(q, fence); const consumed = operation(claim.operation); ensure(consumed.reservation.state === 'consumed', 'missing consumed claim');
          consumedRequests.add(q);
          accepted = observation(q, 'executor-accepted', take(p.host.capture(encoded({ operation: claim.operation, executor: p.host.incarnation }).bytes)) as Capture);
          demand(d, [consumed.fact.id, accepted.fact.id]); actual(q, fence); return accepted.fact.id;
        }));
        return checked('ObserveProviderReturn', null, () => {
          const capture = take(result); ensure(accepted, 'missing executor acceptance');
          const op = operation(claim.operation); ensure(op.claim, 'claim absent');
          const receipt = { request: q.payload.request, effectRequest: q.id, attempt: q.attempt, digest: q.digest,
            operation: claim.operation, reservation: op.fact.id, claim: op.claim.id, observation: accepted.fact.id, capture };
          const recorded = withProviderReceipt(receipt, () => take(p.judgment.recordReceipt(receipt)));
          return observation(q, 'response', capture, recorded.id).value;
        });
      } });
    },
    assess: id => checked('AssessProviderEffect', id, () => { ensure(p.assessment?.owner === 'part-nine', 'Nine assessment absent'); return take(p.assessment.assess(inputFor(id).input)); }),
    settle: (id, reference) => settle(id, reference, value => value),
    readRunSettlement: (reference, step) => checked('ProviderSettlementRunConsumer', reference, () => {
      const f = facts().find(f => f.id === reference.id && f.kind === 'effect-provider-ProviderEffectSettlement'); ensure(f, 'run settlement missing');
      const s = recordFrom({ ...f, body: { record: { ...raw(f), type: 'EffectSettlement' } } } as unknown as FactEnvelope) as EffectSettlement;
      return take(settle(s.operation, { owner: 'part-nine', name: 'VerificationAssessment', id: s.acceptance }, current => {
        const q = raw(find('effect-provider-ProviderEffectRequest', current.request)) as unknown as ProviderEffectRequest;
        const seven = facts().find(f => f.id === q.payload.request.id);
        ensure(seven && step.run === q.run && step.id === raw(seven)?.step
          && step.operation.key === q.semanticMessage && step.operation.digest === q.digest, 'run settlement step binding differs');
        return { record: reference, outcome: current.outcome,
          claimClosed: consumeOutcome(current.outcome, { happened: () => true, 'did-not-happen': () => current.delayedExecutionExcluded, uncertain: () => false }),
          chargeSettled: current.finalCharge !== null };
      }));
    }),
  };
  function settle<T>(id: string, reference: OwnedReference<'part-nine', 'VerificationAssessment'>, use: (value: EffectSettlement) => T): Result<T> {
    return checked('SettleProviderEffect', { id, reference }, () => {
      ensure(p.assessment?.owner === 'part-nine', 'Nine assessment absent');
      const { q, d, op, input } = inputFor(id), assessor = p.assessment;
      const proof = take(assessor.consumeEffectSettlementAssessment(reference, input, v => v));
      demand(d, [...q.closure, op.fact.id, ...proof.required]);
      take(p.custody.verify(input.observations.map(o => o.capture), d));
      ensure(encoded(inputFor(id).input).bytes === encoded(input).bytes, 'assessment input changed during durability wait');
      const finalCharge = proof.charge.state === 'final' ? proof.charge.amount : null;
      const uncertain = consumeOutcome(proof.outcome, { happened: () => false, 'did-not-happen': () => false, uncertain: () => true });
      const fields = { request: q.id, operation: id, claim: op.claim!.id, reservation: op.fact.id, digest: q.digest,
        acceptance: reference.id, observations: input.observations.map(o => o.id), outcome: proof.outcome, finalCharge,
        delayedExecutionExcluded: proof.delayedExecutionExcluded, retainedExposure: uncertain || finalCharge === null || !proof.delayedExecutionExcluded ? op.reservation.charge : finalCharge,
        retryEligible: false as const };
      const candidate = freeze({ type: 'EffectSettlement', schemaVersion: 1, id: `settlement:${encoded(fields).hash}`, ...fields } as unknown as EffectSettlement);
      const capture = take(p.host.capture(encoded({ settlement: candidate.id, operation: id }).bytes));
      const claimClosed = !uncertain && (consumeOutcome(proof.outcome, { happened: () => true, 'did-not-happen': () => proof.delayedExecutionExcluded, uncertain: () => false }));
      const evidence = take(decode('Evidence', { type: 'Evidence', schemaVersion: 1, id: `run-settlement:${candidate.id}`,
        claim: { subject: q.semanticMessage, predicate: 'operation-settled', value: { digest: q.digest, claimClosed, chargeSettled: finalCharge !== null } },
        source: p.host.principal.provenance.adapter, observedAt: p.host.current().clock, freshFor: d.timeout,
        capture, strength: 'observation' }, p.host.current().decode));
      const saved = take(assessor.consumeEffectSettlementAssessment(reference, input, view => {
        ensure(encoded(view).bytes === encoded(proof).bytes && view.operation === id && view.attempt === q.attempt
          && view.digest === q.digest && view.bar === q.verificationBar, 'Nine consumption binding changed');
        ensure(encoded(inputFor(id).input).bytes === encoded(input).bytes, 'assessment inputs changed before settlement append');
        const sf = withSettlement(p.host, candidate, () => save(candidate, [...view.required, ...q.closure], { evidence: json(evidence), outcome: json(view.outcome) }));
        // Durability may wait: the owner guard ends before that wait, then a new
        // current guard is required for the consequential consumer below.
        return { candidate, sf };
      }));
      demand(d, [saved.sf.id]);
      ensure(encoded(inputFor(id).input).bytes === encoded(input).bytes, 'settlement inputs changed');
      return take(assessor.consumeEffectSettlementAssessment(reference, input, view => {
        ensure(encoded(view).bytes === encoded(proof).bytes, 'settlement assessment changed');
        return use(issuedSettlement(saved.candidate, next => settle(id, reference, next)));
      }));
    });
  }
  return Object.freeze(api);
}
