import { consumeResult, decode } from '../index.js';
import type { BoundaryContext, Clock, Decision, Json, Result } from '../index.js';
import { authorAndAppend, causalCone, registerOwnedBody } from '../facts/index.js';
import type { FactEnvelope, FactSchema, FactStorePort, OwnedBodyContext, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import type { AdmissionReservation } from '../transport/index.js';
import type { Capture, DispatchMessage, JudgmentAttemptRecord, JudgmentAuthor, JudgmentFact, JudgmentHost, JudgmentRecord, JudgmentRequest, JudgmentSpine, ProviderObservation } from './contracts.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { observationCheck } from './model-adapter.js';

const txt = { kind: 'text', maxLength: 256 } as const, int = { kind: 'integer' } as const, capture = { kind: 'capture' } as const;
const row = { type: txt, schemaVersion: int, id: txt, request: txt, predecessor: txt };
export const judgmentShapes: Readonly<Record<string, OwnedShape>> = freeze({
  JudgmentRequest: { kind: 'object', fields: { ...row, logicalKey: txt, inputDigest: txt, run: txt, step: txt, ordinal: int, semanticMessage: txt, effectRequest: txt,
    point: txt, consumer: txt, generation: txt, incarnation: txt, deadline: int, question: capture, context: capture, submitted: capture,
    route: txt, evidence: { kind: 'array', maxLength: 64, items: txt }, maxInputBytes: int, maxOutputBytes: int, maxCharge: int,
    account: txt, conversation: txt }, optional: ['account', 'conversation'] },
  JudgmentAttemptRecord: { kind: 'object', fields: { ...row, attempt: txt, phase: txt, operation: txt, reservation: txt, receipt: capture }, optional: ['operation', 'reservation', 'receipt'] },
  JudgmentResolution: { kind: 'object', fields: { ...row, attempt: txt, disposition: txt, response: txt, accounting: txt, decoded: txt } },
});
export const kindFor = (name: string) => `judgment-${name}`;
export function judgmentSchemas(host: JudgmentHost): readonly FactSchema[] {
  return Object.keys(judgmentShapes).map(name => ({ kind: kindFor(name), version: 1,
    fields: { record: { kind: 'owned', owner: 'part-seven', name }, result: { kind: 'constitutional', type: 'Result' },
      decision: { kind: 'constitutional', type: 'Decision' }, outcome: { kind: 'constitutional', type: 'Outcome' },
      evidence: { kind: 'constitutional', type: 'Evidence' } }, optional: ['result', 'decision', 'outcome', 'evidence'],
    machineScope: 'shared', standing: 'requester', action: 'work', scope: host.transport.scope,
    causallyBound: false, requiredReferences: [], authority: 'none' }));
}
export function rows(facts: readonly FactEnvelope[]): JudgmentFact[] {
  return facts.filter(f => Object.keys(judgmentShapes).some(n => f.kind === kindFor(n)))
    .map(fact => ({ fact, record: (fact.body as { record: Json }).record as unknown as JudgmentRecord }));
}
export function requestIn(all: readonly JudgmentFact[]): JudgmentRequest | undefined {
  return all.find((v): v is JudgmentFact & { record: JudgmentRequest } => v.record.type === 'JudgmentRequest')?.record;
}
export function phaseIn(all: readonly JudgmentFact[], phase: JudgmentAttemptRecord['phase']): JudgmentFact & { record: JudgmentAttemptRecord } | undefined {
  return all.find((v): v is JudgmentFact & { record: JudgmentAttemptRecord } => v.record.type === 'JudgmentAttemptRecord' && v.record.phase === phase);
}
/** The exact outbound record eight dispatches for an admitted-through-eight
 * question (docs/11 step 6). Deterministic from the durable request + the
 * question fact identity, so the owner validator recomputes it unconditionally:
 * six's reservation digest MUST be this record's hash. The text carries the
 * submitted-input CAPTURE (reference + digest), never the raw prompt bytes —
 * the registered adapter resolves the content-addressed payload. */
export function dispatchMessage(request: JudgmentRequest, source: string, host: JudgmentHost): DispatchMessage {
  ensure(request.account !== undefined && request.conversation !== undefined, 'admitted-dispatch addressing required');
  return freeze({ type: 'OutboundMessage', schemaVersion: 1, id: `judgment-dispatch:${request.id}`,
    semanticMessage: request.semanticMessage, run: request.run, speaker: host.transport.principal.id,
    account: request.account, conversation: request.conversation,
    // The text also carries the question DEADLINE, digest-bound through six's
    // reservation and eight's request, so the registered adapter re-enforces the
    // invocation constraint at the provider boundary itself (R1).
    text: encoded({ submitted: request.submitted, digest: request.inputDigest, deadline: request.deadline }).bytes,
    purpose: 'ordinary-reply', sourceResult: source });
}
export function decisionFrom(observation: ProviderObservation, request: JudgmentRequest, host: JudgmentHost, c: BoundaryContext): Result<Decision> {
  return boundary('JudgmentAnswerDecode', observation, c, () => {
    ensure(observation.state === 'complete' && observation.bytes !== null && !observation.limitation, `provider ${observation.state}: no usable answer`);
    ensure(observation.usage.charge === null || observation.usage.charge <= request.maxCharge, 'observed liability exceeds reservation');
    const decision = take(decode('Decision', JSON.parse(observation.bytes) as unknown, host.transport.current().decode));
    ensure(decision.floor && 'judgment' in decision.by, 'model answer requires floor and model attribution');
    ensure(encoded(decision.floor.allowed).bytes === encoded(host.floor).bytes, 'answer widened or replaced floor');
    ensure(decision.by.judgment === request.point && decision.by.route === request.route && decision.by.model === host.description.model, 'answer route attribution differs');
    ensure([...decision.conclusion.evidence, ...decision.reason.evidence].every(e => request.evidence.includes(e)), 'answer invented context evidence');
    return decision;
  });
}
export function providerEvidence(receipt: Capture, content: string, operation: string, at: Clock, host: JudgmentHost) {
  const dc = host.transport.current().decode;
  return take(decode('Evidence', { type: 'Evidence', schemaVersion: 1, id: `provider:${receipt.hash}`,
    claim: { subject: operation, predicate: 'provider-observation-recorded', value: receipt.hash },
    source: host.transport.principal.provenance.adapter, observedAt: at, freshFor: 0, capture: receipt, strength: 'observation' },
  { ...dc, captures: { ...dc.captures, [receipt.reference]: content } }));
}
export function unsettledOutcome(response: JudgmentFact & { record: JudgmentAttemptRecord }, content: string, host: JudgmentHost) {
  const evidence = providerEvidence(response.record.receipt!, content, response.record.operation!, response.fact.at, host);
  const dc = host.transport.current().decode;
  return take(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: 'uncertain', evidence: [evidence.id] }, { ...dc, evidence: [...dc.evidence ?? [], evidence] }));
}
export function registerJudgmentBodies(host: JudgmentHost, c: BoundaryContext): Result<readonly OwnedBodyRegistration[]> {
  return boundary('JudgmentRegistrations', null, c, () => Object.entries(judgmentShapes).map(([name, shape]) => take(registerOwnedBody({
    name, owner: 'part-seven', currentVersion: 1, versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
    decodeCurrent: (v, ctx) => {
      try { validate(v as unknown as JudgmentRecord, ctx, host, c); return { ok: true, value: freeze(v) }; }
      catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'judgment record refused' }; }
    },
  }, shape, c))));
}
function validate(r: JudgmentRecord, ctx: OwnedBodyContext, host: JudgmentHost, c: BoundaryContext): void {
  const all = rows(causalCone(ctx.origin, ctx.facts.facts));
  ensure(ctx.origin.machine === host.transport.machine && ctx.origin.principal.id === host.transport.principal.id
    && ctx.origin.principal.kind === host.transport.principal.kind, 'judgment recorder identity mismatch');
  ensure(all.every(v => v.fact.machine === host.transport.machine && v.fact.principal.id === host.transport.principal.id), 'untrusted judgment predecessor');
  ensure(r.schemaVersion === 1 && ctx.origin.kind === kindFor(r.type) && r.id.length > 0 && r.request.length > 0, 'judgment identity/version');
  ensure(r.predecessor === (all.at(-1)?.fact.id ?? ''), 'judgment predecessor changed');
  ensure(!all.some(v => v.record.id === r.id), 'duplicate judgment record identity');
  if (ctx.mode === 'origin') ensure(r.predecessor === (rows(ctx.facts.facts).at(-1)?.fact.id ?? ''), 'stale judgment origin predecessor');
  const body = ctx.origin.body as Record<string, Json>;
  if (!(r.type === 'JudgmentAttemptRecord' && r.phase === 'accounting-observed')) ensure(body.outcome === undefined, 'Outcome belongs to accounting observation');
  if (!(r.type === 'JudgmentAttemptRecord' && r.phase === 'response-observed')) ensure(body.evidence === undefined, 'provider evidence belongs to response');
  const bytes = (cap: Capture): string | undefined => {
    const content = ctx.facts.captures[cap.reference];
    return content?.status === 'available' && content.bytes !== null ? content.bytes : undefined;
  };
  if (r.type === 'JudgmentRequest') {
    ensure(all.length === 0 && r.request === r.id && r.ordinal >= 0 && r.run.length > 0 && r.step.length > 0
      && r.semanticMessage.length > 0 && r.effectRequest.length > 0, 'slice accepts one logical question');
    ensure(r.logicalKey === encoded([r.run, r.step, r.ordinal]).hash, 'logical question identity');
    ensure(r.point === host.point && r.consumer === 'advisory' && r.route === host.description.route, 'unknown judgment point or route');
    ensure(r.maxCharge === host.description.maxCharge && r.maxInputBytes === host.description.maxInputBytes
      && r.maxOutputBytes === host.description.maxOutputBytes, 'caller changed registered bounds');
    ensure(r.deadline >= 0 && r.evidence.length === new Set(r.evidence).size, 'invalid deadline/evidence');
    ensure((r.account === undefined) === (r.conversation === undefined), 'admitted-dispatch addressing must be complete');
    if (r.account !== undefined) ensure(r.effectRequest === `request:${encoded([r.account, r.conversation, r.semanticMessage]).hash}`,
      'admitted-dispatch identity must derive from the registered addressing');
    if (ctx.mode === 'origin') ensure(r.generation === host.transport.current().generation.id && r.incarnation === host.transport.incarnation, 'stale request generation/incarnation');
    const submitted = bytes(r.submitted), question = bytes(r.question), context = bytes(r.context);
    if (submitted !== undefined && question !== undefined && context !== undefined) {
      ensure(encoded(submitted).hash === r.inputDigest, 'submitted digest changed');
      const wire = JSON.parse(submitted) as { provider: string; model: string; route: string; input: Record<string, unknown> };
      ensure(wire.provider === host.description.provider && wire.model === host.description.model && wire.route === r.route, 'submitted route mismatch');
      ensure(wire.input.question === question && wire.input.context === context
        && encoded(wire.input.floor).bytes === encoded(host.floor).bytes && encoded(wire.input.evidence).bytes === encoded(r.evidence).bytes
        && wire.input.deadline === r.deadline && wire.input.generation === r.generation && wire.input.point === r.point,
      'submitted manifest differs from request');
    }
    ensure(body.result === undefined && body.decision === undefined, 'request cannot contain answer'); return;
  }
  const request = requestIn(all); ensure(request && r.request === request.id, 'missing owning question');
  ensure(!all.some(v => v.record.type === 'JudgmentResolution'), 'terminal question cannot reopen');
  ensure(r.attempt === `attempt:${request.id}:1`, 'slice has one immutable attempt');
  const phases = ['prepared', 'dispatch-observed', 'response-observed', 'accounting-observed', 'decode-observed'];
  const previous = all.filter(v => v.record.type === 'JudgmentAttemptRecord');
  if (r.type === 'JudgmentAttemptRecord') {
    ensure(r.phase === phases[previous.length], 'attempt phase skipped or repeated');
    if (r.phase === 'prepared') ensure(r.operation === undefined && r.reservation === undefined && r.receipt === undefined, 'prepared is explicitly not reserved');
    else {
      ensure(r.operation && r.reservation, 'phase requires six operation/reservation');
      const reservation = causalCone(ctx.origin, ctx.facts.facts).find(f => f.id === r.reservation);
      const op = (reservation?.body as { record?: AdmissionReservation } | undefined)?.record;
      // Through-eight admission (account present): six reserved the dispatch
      // MESSAGE eight adopts, so the claimed digest is that record's hash.
      // Direct-model admission: the claimed digest is the submitted-input digest.
      const requestFact = all.find(v => v.record.type === 'JudgmentRequest'); ensure(requestFact, 'missing owning question fact');
      const claimedDigest = request.account !== undefined ? encoded(dispatchMessage(request, requestFact.fact.id, host)).hash : request.inputDigest;
      ensure(reservation?.kind === 'transport-AdmissionReservation' && op?.state === 'consumed' && op.operation === r.operation && op.attempt === r.attempt
        && op.request === request.effectRequest && op.semanticMessage === request.semanticMessage && op.digest === claimedDigest && op.charge === request.maxCharge && op.run === request.run,
      'phase lacks exact consumed six claim');
      const first = phaseIn(all, 'dispatch-observed');
      if (first) ensure(r.operation === first.record.operation && r.reservation === first.record.reservation, 'attempt remapped operation');
      if (r.phase === 'response-observed') {
        ensure(r.receipt, 'response requires captured receipt');
        const consumed = causalCone(ctx.origin, ctx.facts.facts).some(f => {
          const a = (f.body as { record?: AdmissionReservation }).record;
          return f.kind === 'transport-AdmissionReservation' && a !== undefined && a.operation === r.operation && a.state === 'consumed';
        }); ensure(consumed, 'response without consumed dispatch claim');
        const content = bytes(r.receipt); if (content !== undefined) {
          observationCheck(JSON.parse(content) as ProviderObservation, host.description);
          ensure(encoded(body.evidence).bytes === encoded(providerEvidence(r.receipt, content, r.operation, ctx.origin.at, host)).bytes, 'provider observation evidence inflated or changed');
        }
      } else ensure(r.receipt === undefined, 'receipt belongs only to response phase');
      if (r.phase === 'accounting-observed') {
        const response = phaseIn(all, 'response-observed'); ensure(response?.record.receipt, 'accounting requires receipt');
        const content = bytes(response.record.receipt);
        if (content !== undefined) ensure(encoded(body.outcome).bytes === encoded(unsettledOutcome(response, content, host)).bytes, 'provider receipt is not settled effect evidence');
      }
    }
    if (r.phase !== 'decode-observed') { ensure(body.result === undefined && body.decision === undefined, 'answer before decode phase'); return; }
  } else {
    ensure(previous.length === phases.length, 'resolution requires all durable attempt phases');
    ensure(r.response === phaseIn(all, 'response-observed')?.fact.id && r.accounting === phaseIn(all, 'accounting-observed')?.fact.id
      && r.decoded === phaseIn(all, 'decode-observed')?.fact.id, 'resolution must link actual receipt/accounting/decode facts');
  }
  const response = phaseIn(all, 'response-observed')?.record.receipt; ensure(response, 'missing response record');
  const content = bytes(response);
  if (content !== undefined) {
    const result = decisionFrom(JSON.parse(content) as ProviderObservation, request, host, c);
    ensure(encoded(body.result).bytes === encoded(result).bytes, 'recorded Result differs from captured answer');
    consumeResult(result, { Success: d => {
      ensure(encoded(body.decision).bytes === encoded(d).bytes, 'recorded Decision differs from captured answer');
      if (r.type === 'JudgmentResolution') ensure(r.disposition === 'decided', 'decided disposition required');
    }, Refused: () => {
      ensure(body.decision === undefined, 'refused provider cannot produce Decision');
      if (r.type === 'JudgmentResolution') ensure(r.disposition === 'refused', 'refused disposition required');
    } });
  }
}
export function createJudgmentSpine(host: JudgmentHost, author: JudgmentAuthor, store: FactStorePort): JudgmentSpine {
  return Object.freeze({ store, append: (record: JudgmentRecord, attachments: Readonly<Record<string, unknown>> = {}) => authorAndAppend({
    kind: kindFor(record.type), schemaVersion: 1, machine: host.transport.machine,
    principal: json(host.transport.principal), provenance: json(host.transport.principal.provenance), at: json(host.transport.current().clock),
    body: json({ record, ...attachments }), required: record.predecessor ? [record.predecessor] : [],
  }, author.context, store, author.privateKey) });
}
