import { consumeOutcome, decode, decodeMeasurement, grantLiveness, isValid, readEvidence, scopeIncludes } from '../index.js';
import type { Json, Result } from '../index.js';
import { authorAndAppend, causalCone, registerOwnedBody, walkVersions } from '../facts/index.js';
import type { FactEnvelope, FactSchema, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import type { EffectAuthor, EffectHost, EffectRecord, EffectRequestBinding, EffectSpine, OperationDefinition, OutboundMessage, TypedEffectPayload } from './contracts.js';
import type { FactStorePort } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { requireSettlement } from './settlement-authority.js';
import { effectOperationContracts, effectPayloadOwnedShape, validateEffectPayload } from './payloads.js';
import { referencedPayloadFacts } from './references.js';

const text = { kind: 'text', maxLength: 512 } as const, integer = { kind: 'integer' } as const;
const refs = { kind: 'array', maxLength: 64, items: text } as const;
const common = { type: text, schemaVersion: integer, id: text };
const capture = { kind: 'capture' } as const;
const outcome: OwnedShape = { kind: 'object', fields: { type: text, schemaVersion: integer, kind: text, evidence: refs } };
const observations: OwnedShape = { kind: 'object', fields: { occurrence: text, nonOccurrence: text, quiescence: text, charge: text } };
const requestBinding: OwnedShape = { kind: 'object', fields: {
  subject: text, target: text, sourceVector: text, sourceGeneration: text, principal: text,
  definition: { kind: 'object', fields: { id: text, version: text } },
  payload: { kind: 'object', fields: { id: text, digest: text } }, logicalEffect: text,
  run: text, step: text, lease: text, fence: text,
  reservation: { kind: 'object', fields: { request: text, attempt: text, charge: integer, run: text,
    semanticMessage: text, durability: text, replicas: integer } },
  claim: { kind: 'object', fields: { attempt: text, executor: text } },
} };
// The normalized owner settlement uses null. P2's shape supports null but no
// arbitrary union, so record
// it as an exact bounded decimal string ("unknown" or an integer), at this seam.
export const effectShapes: Readonly<Record<string, OwnedShape>> = freeze({
  OperationDefinition: { kind: 'object', fields: { ...common, feature: text, version: text, generation: text,
    adapter: text, account: text, conversation: text, speaker: text, scopeDigest: text, durability: text,
    replicas: integer, lossModel: text, maxBytes: integer, maxCharge: integer, timeout: integer, verificationBar: text,
    payloadKind: text, inputSchema: text, canonicalization: text, observationCapabilities: observations },
    optional: ['payloadKind', 'inputSchema', 'canonicalization', 'observationCapabilities'] },
  OutboundMessage: { kind: 'object', fields: { ...common, semanticMessage: text, run: text, speaker: text,
    account: text, conversation: text, text: { kind: 'text', maxLength: 4096 }, purpose: text, sourceResult: text } },
  EffectPayload: effectPayloadOwnedShape,
  EffectRequest: { kind: 'object', fields: { ...common, definition: text, message: text, semanticMessage: text,
    run: text, pending: text, attempt: text, digest: text, verificationOwner: text, verificationBar: text,
    obligation: text, closure: refs, payload: text, payloadDigest: text, binding: requestBinding },
    optional: ['payload', 'payloadDigest', 'binding'] },
  EffectValidation: { kind: 'object', fields: { ...common, request: text, digest: text, phase: text,
    generation: text, definition: text, expires: integer, authority: refs } },
  OperationObservation: { kind: 'object', fields: { ...common, request: text, operation: text, claim: text,
    digest: text, account: text, conversation: text, stage: text, wake: text, capture, attestation: text } },
  EffectSettlement: { kind: 'object', fields: { ...common, request: text, operation: text, claim: text,
    reservation: text, digest: text, acceptance: text, observations: refs, outcome,
    finalCharge: text, delayedExecutionExcluded: { kind: 'boolean' }, retainedExposure: integer,
    retryEligible: { kind: 'boolean' } } },
});
// These are the exact shapes that existed before typed payloads were added.
// Legacy records must take this path before any additive optional-field logic so
// even refusal details retain their original byte representation.
const legacyEffectShapes: Readonly<Record<string, OwnedShape>> = freeze({
  OperationDefinition: { kind: 'object', fields: { ...common, feature: text, version: text, generation: text,
    adapter: text, account: text, conversation: text, speaker: text, scopeDigest: text, durability: text,
    replicas: integer, lossModel: text, maxBytes: integer, maxCharge: integer, timeout: integer, verificationBar: text } },
  OutboundMessage: { kind: 'object', fields: { ...common, semanticMessage: text, run: text, speaker: text,
    account: text, conversation: text, text: { kind: 'text', maxLength: 4096 }, purpose: text, sourceResult: text } },
  EffectRequest: { kind: 'object', fields: { ...common, definition: text, message: text, semanticMessage: text,
    run: text, pending: text, attempt: text, digest: text, verificationOwner: text, verificationBar: text,
    obligation: text, closure: refs } },
  EffectValidation: effectShapes.EffectValidation!,
  OperationObservation: { kind: 'object', fields: { ...common, request: text, operation: text, claim: text,
    digest: text, account: text, conversation: text, stage: text, wake: text, capture, attestation: text } },
  EffectSettlement: { kind: 'object', fields: { ...common, request: text, operation: text, claim: text,
    reservation: text, digest: text, acceptance: text, observations: refs, outcome,
    finalCharge: text, delayedExecutionExcluded: { kind: 'boolean' }, retainedExposure: integer,
    retryEligible: { kind: 'boolean' } } },
});
export const kindFor = (name: string) => `effect-${name}`;
export function wire(r: EffectRecord): Json {
  return json(r.type === 'EffectSettlement' ? { ...r, finalCharge: r.finalCharge === null ? 'unknown' : String(r.finalCharge) } : r);
}
export function recordFrom(f: FactEnvelope): EffectRecord {
  const r = (f.body as { record: Record<string, Json> }).record;
  return freeze((r.type === 'EffectSettlement' ? { ...r, finalCharge: r.finalCharge === 'unknown' ? null : Number(r.finalCharge) } : r) as unknown as EffectRecord);
}
export function rows(facts: readonly FactEnvelope[]) {
  return facts.filter(f => Object.keys(effectShapes).some(n => f.kind === kindFor(n))).map(fact => ({ fact, record: recordFrom(fact) }));
}
function shapeCheck(v: unknown, shape: OwnedShape): void {
  if (shape.kind === 'text') { ensure(typeof v === 'string' && v.length <= shape.maxLength, 'bounded text required'); return; }
  if (shape.kind === 'integer') { ensure(Number.isSafeInteger(v), 'safe integer required'); return; }
  if (shape.kind === 'boolean') { ensure(typeof v === 'boolean', 'boolean required'); return; }
  if (shape.kind === 'array') { ensure(Array.isArray(v) && v.length <= shape.maxLength, 'bounded array required'); v.forEach(i => shapeCheck(i, shape.items)); return; }
  if (shape.kind === 'capture') { shapeCheck(v, { kind: 'object', fields: { reference: text, hash: text } }); return; }
  ensure(shape.kind === 'object' && v && typeof v === 'object' && !Array.isArray(v), 'closed object required');
  const r = v as Record<string, unknown>;
  const optional = new Set(shape.optional ?? []);
  ensure(Object.keys(r).every(k => Object.hasOwn(shape.fields, k))
    && Object.keys(shape.fields).filter(k => !optional.has(k)).every(k => Object.hasOwn(r, k)), 'missing or undeclared field');
  for (const [k, s] of Object.entries(shape.fields)) if (Object.hasOwn(r, k)) shapeCheck(r[k], s);
}
function legacyShapeCheck(v: unknown, shape: OwnedShape): void {
  if (shape.kind === 'text') { ensure(typeof v === 'string' && v.length <= shape.maxLength, 'bounded text required'); return; }
  if (shape.kind === 'integer') { ensure(Number.isSafeInteger(v), 'safe integer required'); return; }
  if (shape.kind === 'boolean') { ensure(typeof v === 'boolean', 'boolean required'); return; }
  if (shape.kind === 'array') { ensure(Array.isArray(v) && v.length <= shape.maxLength, 'bounded array required'); v.forEach(i => legacyShapeCheck(i, shape.items)); return; }
  if (shape.kind === 'capture') { legacyShapeCheck(v, { kind: 'object', fields: { reference: text, hash: text } }); return; }
  ensure(shape.kind === 'object' && v && typeof v === 'object' && !Array.isArray(v), 'closed object required');
  const r = v as Record<string, unknown>;
  ensure(Object.keys(r).length === Object.keys(shape.fields).length, 'missing or undeclared field');
  for (const [k, s] of Object.entries(shape.fields)) { ensure(Object.hasOwn(r, k), `missing ${k}`); legacyShapeCheck(r[k], s); }
}
function legacyRecord(name: string, input: unknown): boolean {
  if (!Object.hasOwn(legacyEffectShapes, name) || !input || typeof input !== 'object' || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  if (name === 'OperationDefinition') return value.payloadKind === undefined && value.inputSchema === undefined
    && value.canonicalization === undefined && value.observationCapabilities === undefined;
  if (name === 'EffectRequest') return value.payload === undefined && value.payloadDigest === undefined && value.binding === undefined;
  return true;
}
function recordShapeCheck(name: string, input: unknown): void {
  if (legacyRecord(name, input)) legacyShapeCheck(input, legacyEffectShapes[name]!);
  else shapeCheck(input, effectShapes[name]!);
}
export function live(host: EffectHost): void {
  const c = host.current(); ensure(!c.stopped, 'stop inhibits effect');
  const principal = take(decode('VerifiedPrincipal', host.principal, { ...c.decode, provenance: host.principal.provenance }));
  const now = take(decodeMeasurement('clock', c.clock, c.decode));
  const scope = take(decode('Scope', host.scope, c.decode));
  ensure((c.decode.grants ?? []).some(raw => {
    const g = take(decode('StandingGrant', raw, { ...c.decode, provenance: raw.source }));
    return g.grantee.id === principal.id && grantLiveness(g, c.decode.revocations ?? [], now) === 'live'
      && scopeIncludes(g.scope, scope) && (g.standing === 'operator' || g.actions.includes('work'));
  }), 'current standing does not cover reply');
  ensure(c.authority.length > 0, 'authority closure missing');
}
export function definitionCheck(d: OperationDefinition, host: EffectHost): void {
  const c = host.current(); live(host);
  const chain = walkVersions(c.versions);
  ensure(chain.conflicts.length === 0, 'governed definition contested');
  const v = chain.current.find(v => v.id === d.version && v.subject === d.feature);
  ensure(v && encoded(v.content).bytes === encoded(d).bytes, 'definition is not the exact approved current version');
  const approval = take(decode('Authorization', v.approvedIn, { ...c.decode, provenance: v.approvedIn.explicitYes }));
  ensure(approval.approver.id !== host.principal.id, 'executor cannot approve enforced policy');
  ensure(isValid(approval, v.base, encoded(v.content).hash, c.clock, c.decode) === 'valid', 'definition approval is not live');
  ensure(c.decode.register.entries.includes(d.feature) && c.decode.register.entries.includes(d.adapter)
    && d.generation === c.decode.register.generation.id, 'definition generation/feature/adapter mismatch');
  ensure(d.scopeDigest === encoded(host.scope).hash && d.speaker === host.principal.id, 'definition scope or speaker mismatch');
  const optional = [d.payloadKind, d.inputSchema, d.canonicalization, d.observationCapabilities];
  ensure(optional.every(value => value === undefined) || optional.every(value => value !== undefined), 'partial operation payload contract');
  if (d.payloadKind) {
    const contract = effectOperationContracts[d.payloadKind]; ensure(contract, 'unknown operation payload kind');
    ensure(d.inputSchema === contract.inputSchema && d.canonicalization === contract.canonicalization
      && encoded(d.observationCapabilities).bytes === encoded(contract.observations).bytes, 'operation payload schema/canonicalization/observation mismatch');
  }
}
function validate(r: EffectRecord, past: readonly FactEnvelope[], host: EffectHost, origin: boolean, at = host.current().clock): void {
  ensure(r.schemaVersion === 1 && r.id.length > 0, 'record identity/version');
  const all = rows(past);
  ensure(!all.some(x => x.record.type === r.type && x.record.id === r.id), 'immutable effect identity already exists');
  const find = <N extends EffectRecord['type']>(id: string, type: N): Extract<EffectRecord, { type: N }> => {
    const found = all.find(x => x.record.id === id && x.record.type === type);
    ensure(found, `missing ${type} predecessor`); return found.record as Extract<EffectRecord, { type: N }>;
  };
  if (r.type === 'OperationDefinition') {
    ensure(r.maxBytes > 0 && r.maxBytes <= 4096 && r.maxCharge >= 0 && r.timeout > 0 && r.lossModel.length > 0, 'finite operation bounds required');
    ensure((r.durability === 'replicated' && r.replicas > 0) || (r.durability === 'local-durable' && r.replicas === 0), 'invalid durability demand');
    if (origin) definitionCheck(r, host);
  } else if (r.type === 'OutboundMessage') {
    ensure(r.purpose === 'ordinary-reply' && r.speaker === host.principal.id && r.text.length > 0
      && r.semanticMessage.length > 0 && r.sourceResult.length > 0, 'attributable reply required');
    ensure(past.some(f => f.id === r.sourceResult), 'source result fact missing');
  } else if (r.type === 'EffectPayload') {
    // Historical bytes are checked against their signed context, not a later
    // wall clock or replacement executor. Action-time checks remain live-only.
    validateEffectPayload(r, host, past, at);
  } else if (r.type === 'EffectRequest') {
    const d = find(r.definition, 'OperationDefinition');
    if (r.payload === undefined) {
      const m = find(r.message, 'OutboundMessage');
      ensure(d.payloadKind === undefined || d.payloadKind === 'ordinary-reply'
        && d.inputSchema === effectOperationContracts['ordinary-reply'].inputSchema
        && d.canonicalization === effectOperationContracts['ordinary-reply'].canonicalization
        && encoded(d.observationCapabilities).bytes === encoded(effectOperationContracts['ordinary-reply'].observations).bytes,
      'ordinary reply does not match operation definition');
      ensure(r.id === `request:${encoded([m.account, m.conversation, m.semanticMessage]).hash}`, 'stable semantic identity required');
      ensure(r.digest === encoded(m).hash && r.semanticMessage === m.semanticMessage && r.run === m.run, 'request/message binding');
      ensure(m.account === d.account && m.conversation === d.conversation && m.speaker === d.speaker
        && new TextEncoder().encode(encoded(m).bytes).length <= d.maxBytes, 'actual target/payload exceeds operation');
      ensure(r.payloadDigest === undefined && r.binding === undefined, 'partial typed payload request');
    } else {
      const p = find(r.payload, 'EffectPayload') as TypedEffectPayload;
      ensure(r.message === r.payload && r.payloadDigest === encoded(p).hash && r.semanticMessage === p.semanticMessage && r.run === p.run,
        'request/payload binding');
      ensure(p.sourceResult === r.pending, 'typed source result is bound to another pending result');
      const references = referencedPayloadFacts(p, host, past, at);
      ensure(references.every(id => r.closure.includes(id)), 'typed request omits a resolved owner reference');
      ensure(r.id === `request:${encoded(['effect-payload', p.logicalEffect, p.semanticMessage, p.id]).hash}`, 'stable typed rendering identity required');
      ensure(r.binding && r.digest === encoded(r.binding).hash, 'typed request binding digest mismatch');
      const b = r.binding as EffectRequestBinding;
      ensure(b.subject === p.semanticMessage && b.target === p.targetDigest && b.principal === host.principal.id
        && b.definition.id === d.id && b.definition.version === d.version
        && b.payload.id === p.id && b.payload.digest === r.payloadDigest && b.logicalEffect === p.logicalEffect
        && b.run === p.run && b.step === p.step && b.sourceGeneration === d.generation,
      'typed request subject/target/principal/definition binding mismatch');
      ensure(b.reservation.request === r.id && b.reservation.attempt === r.attempt && b.reservation.charge === d.maxCharge
        && b.reservation.run === r.run
        && b.reservation.semanticMessage === `effect-child:${encoded([r.semanticMessage, p.logicalEffect]).hash}`
        && b.reservation.durability === d.durability && b.reservation.replicas === d.replicas
        && b.claim.attempt === r.attempt,
      'typed request reservation/claim binding mismatch');
      const lease = past.find(f => f.id === b.lease && f.kind === 'transport-Lease');
      const leaseRecord = lease ? (lease.body as { record?: Record<string, unknown> }).record : undefined;
      const fence = leaseRecord ? { type: 'FenceToken', schemaVersion: 1, domain: leaseRecord.domain,
        epoch: leaseRecord.epoch, assignment: lease!.id, holder: leaseRecord.holder, machine: leaseRecord.machine,
        incarnation: leaseRecord.incarnation, authority: leaseRecord.authority, generation: leaseRecord.generation } : null;
      ensure(b.sourceVector === encoded([...r.closure].sort()).hash && leaseRecord?.type === 'Lease'
        && leaseRecord.state === 'held' && b.claim.executor === leaseRecord.incarnation
        && fence !== null && b.fence === encoded(fence).hash,
        'typed request source vector/lease/fence binding mismatch');
      ensure(d.payloadKind === p.kind && d.inputSchema === effectOperationContracts[p.kind].inputSchema
        && d.canonicalization === effectOperationContracts[p.kind].canonicalization
        && encoded(d.observationCapabilities).bytes === encoded(effectOperationContracts[p.kind].observations).bytes,
      'typed payload does not match operation definition');
      if ('account' in p) ensure(d.account === p.account
        && d.conversation === (p.kind === 'create-topic' ? p.parentConversation : p.conversation),
      'typed payload target differs from approved operation target');
      ensure(new TextEncoder().encode(encoded(p).bytes).length <= d.maxBytes, 'actual target/payload exceeds operation');
    }
    ensure(r.attempt.length > 0 && r.verificationOwner.length > 0 && r.verificationBar === d.verificationBar, 'verification obligation required');
    ensure(r.closure.includes(r.pending) && r.closure.includes(r.obligation)
      && r.closure.every(id => past.some(f => f.id === id)), 'missing prerequisite closure');
    const loop = past.find(f => f.id === r.obligation);
    ensure(loop?.kind === 'transport-LoopRecord' && (loop.body as { record: { run: string } }).record.run === r.run, 'six-owned verification wake missing');
    if (origin) definitionCheck(d, host);
  } else if (r.type === 'EffectValidation') {
    const q = find(r.request, 'EffectRequest'), d = find(q.definition, 'OperationDefinition');
    ensure(r.digest === q.digest && r.definition === d.id && r.generation === d.generation
      && ['reservation', 'dispatch'].includes(r.phase) && r.authority.length > 0, 'validation binding');
    if (origin) { definitionCheck(d, host); ensure(r.expires === host.current().clock.value + d.timeout, 'validation expiry differs from bounded current clock'); }
  } else {
    const q = find(r.request, 'EffectRequest');
    const target = q.payload ? find(q.payload, 'EffectPayload') as TypedEffectPayload : find(q.message, 'OutboundMessage');
    const account = target.type === 'OutboundMessage' ? target.account : 'account' in target ? target.account : find(q.definition, 'OperationDefinition').account;
    const conversation = target.type === 'OutboundMessage' ? target.conversation : 'conversation' in target ? target.conversation : find(q.definition, 'OperationDefinition').conversation;
    const reservations = past.filter(f => f.kind === 'transport-AdmissionReservation');
    const op = reservations.map(f => ({ fact: f, r: (f.body as { record: { operation: string; state: string; digest: string; request: string; charge: number } }).record }))
      .filter(v => v.r.operation === r.operation).at(-1);
    ensure(op && op.r.request === q.id && op.r.digest === r.digest && r.digest === q.digest && op.r.state !== 'prepared', 'observation/settlement operation binding');
    const claim = reservations.find(f => f.id === r.claim);
    ensure(claim && (claim.body as { record: { operation: string; state: string } }).record.operation === r.operation
      && (claim.body as { record: { state: string } }).record.state === 'dispatch-claimed', 'claim fact mismatch');
    if (r.type === 'OperationObservation') {
      ensure(r.account === account && r.conversation === conversation && r.attestation === 'local-recorder'
        && ['executor-accepted', 'response', 'unknown', 'observer-accepted', 'lookup'].includes(r.stage), 'observation target or provenance inflation');
      if (r.stage === 'observer-accepted' || r.stage === 'lookup') {
        const wake = past.find(f => f.id === r.wake);
        const w = wake?.body as { record?: { pending: string; state: string; command: string } } | undefined;
        ensure(wake?.kind === 'transport-LoopRecord' && w?.record?.pending === r.operation
          && ['running', 'restoring', 'waiting'].includes(w.record.state), 'read-only query requires six-owned active wake');
        ensure(!past.some(f => f.kind === 'transport-RecoveryRecord'
          && `${(f.body as { record: { command: string } }).record.command}:wake` === w.record!.command), 'observation wake already completed');
        if (r.stage === 'observer-accepted') ensure(!all.some(v => v.record.type === 'OperationObservation'
          && v.record.wake === r.wake && v.record.stage === 'observer-accepted'), 'observation wake already consumed');
      } else ensure(r.wake === '', 'dispatch observation cannot consume a wake');
    } else {
      if (origin) requireSettlement(host, r);
      ensure(r.observations.length > 0 && r.observations.every(id => find(id, 'OperationObservation').operation === r.operation), 'settlement evidence binding');
      const acceptance = past.find(f => f.id === r.acceptance);
      if (!q.payload) {
        // Preserve the exact landed ordinary-reply replay contract.  Its live
        // Part Nine port still owns assessment validity; historical decoding
        // required only the referenced signed acceptance to exist.
        ensure(r.acceptance.length > 0 && acceptance, 'independent acceptance absent');
      } else {
        const acceptanceRecord = acceptance ? (acceptance.body as { record?: Record<string, unknown> }).record : undefined;
        ensure(r.acceptance.length > 0 && acceptance?.kind === 'verification-VerificationAssessment',
        'independent acceptance absent or wrong kind');
        ensure(acceptanceRecord?.type === 'VerificationAssessment'
          && acceptanceRecord.operation === r.operation && acceptanceRecord.attempt === q.attempt
          && acceptanceRecord.operationDigest === r.digest
          && typeof acceptanceRecord.validFrom === 'number' && typeof acceptanceRecord.validUntil === 'number'
          && acceptanceRecord.validFrom <= at.value && acceptanceRecord.validUntil >= at.value,
        'independent acceptance subject, attempt, digest, or freshness mismatch');
        const requestFact = past.find(fact => fact.kind === 'verification-VerificationRequest'
          && (fact.body as { record?: { id?: string } }).record?.id === acceptanceRecord.request);
        const verificationRequest = requestFact ? (requestFact.body as { record?: Record<string, unknown> }).record : undefined;
        ensure(requestFact && verificationRequest?.type === 'VerificationRequest'
          && verificationRequest.operation === r.operation && verificationRequest.attempt === q.attempt
          && verificationRequest.operationDigest === r.digest && verificationRequest.barVersion === acceptanceRecord.barVersion
          && Array.isArray(acceptanceRecord.predecessors) && acceptanceRecord.predecessors.includes(requestFact.id),
        'independent acceptance request lineage or binding mismatch');
        const planFact = past.find(fact => fact.kind === 'verification-VerificationPlan'
          && (fact.body as { record?: { id?: string } }).record?.id === verificationRequest.plan);
        const verificationPlan = planFact ? (planFact.body as { record?: Record<string, unknown> }).record : undefined;
        const bar = verificationPlan?.bar && typeof verificationPlan.bar === 'object' && !Array.isArray(verificationPlan.bar)
          ? verificationPlan.bar as Readonly<Record<string, unknown>> : undefined;
        ensure(planFact && verificationPlan?.type === 'VerificationPlan' && bar?.version === acceptanceRecord.barVersion
          && Array.isArray(verificationRequest.predecessors) && verificationRequest.predecessors.includes(planFact.id),
        'independent acceptance plan/bar lineage mismatch');
        ensure(Array.isArray(acceptanceRecord.captureStatuses)
          && acceptanceRecord.captureStatuses.every(item => item && typeof item === 'object'
            && !Array.isArray(item) && (item as { status?: unknown }).status === 'available')
          && Array.isArray(acceptanceRecord.taints) && acceptanceRecord.taints.length === 0,
        'independent acceptance has unavailable or tainted evidence');
        const predicates = Array.isArray(acceptanceRecord.predicates)
          ? acceptanceRecord.predicates as readonly Readonly<Record<string, unknown>>[] : [];
        const predicate = (name: string) => {
          const matches = predicates.filter(row => row.predicate === name);
          ensure(matches.length === 1 && ['satisfied', 'contradicted', 'insufficient'].includes(String(matches[0]!.verdict)),
            'independent acceptance predicate set is incomplete');
          return matches[0]!;
        };
        const occurrence = predicate('occurrence'), nonOccurrence = predicate('non-occurrence');
        const quiescence = predicate('quiescence'), charge = predicate('charge');
        const assessmentEvidence = Array.isArray(acceptanceRecord.evidence) ? acceptanceRecord.evidence as readonly string[] : [];
        ensure(predicates.every(row => Array.isArray(row.evidence)
          && (row.evidence as readonly unknown[]).every(id => typeof id === 'string' && assessmentEvidence.includes(id))),
        'independent acceptance predicate evidence is inconsistent');
        const acceptedOutcome = occurrence.verdict === 'satisfied' ? 'happened'
          : nonOccurrence.verdict === 'satisfied' && quiescence.verdict === 'satisfied' ? 'did-not-happen' : 'uncertain';
        const acceptedEvidence = [...new Set((acceptedOutcome === 'happened' ? occurrence.evidence
          : acceptedOutcome === 'did-not-happen' ? [...(nonOccurrence.evidence as readonly string[]), ...(quiescence.evidence as readonly string[])]
            : assessmentEvidence) as readonly string[])];
        const decodedOutcome = take(decode('Outcome', { type: 'Outcome', schemaVersion: 1, kind: acceptedOutcome,
          evidence: acceptedEvidence }, { ...host.current().decode, now: at }));
        ensure(encoded(decodedOutcome).bytes === encoded(r.outcome).bytes
          && r.delayedExecutionExcluded === (quiescence.verdict === 'satisfied'),
        'typed settlement differs from nine-owned outcome or delayed-execution conclusion');
        let acceptedCharge: number | null = null;
        if (charge.verdict === 'satisfied') {
          const ids = Array.isArray(charge.evidence) ? charge.evidence as readonly string[] : [];
          ensure(ids.length > 0, 'charge conclusion lacks evidence');
          for (const id of ids) {
            const evidence = host.current().decode.evidence?.find(item => item.id === id);
            ensure(evidence, 'charge conclusion evidence is absent');
            const claim = take(readEvidence(take(decode('Evidence', evidence, host.current().decode)), at, host.boundary.preserved));
            if (claim.subject !== r.operation || claim.predicate !== 'charge-settled'
              || !claim.value || typeof claim.value !== 'object' || Array.isArray(claim.value)) continue;
            const amount = (claim.value as Readonly<Record<string, Json>>).amount;
            const digest = (claim.value as Readonly<Record<string, Json>>).digest;
            if (digest === r.digest && typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0) acceptedCharge = amount;
          }
          ensure(acceptedCharge !== null, 'charge conclusion lacks an exact bound operation amount');
        }
        ensure(r.finalCharge === acceptedCharge
          && r.retainedExposure === (acceptedOutcome === 'uncertain' || acceptedCharge === null ? op.r.charge : acceptedCharge),
        'typed settlement differs from nine-owned charge conclusion');
      }
      ensure(r.retryEligible === false && r.retainedExposure >= 0 && (r.finalCharge === null || Number.isSafeInteger(r.finalCharge) && r.finalCharge >= 0), 'invalid charge or forbidden retry');
      ensure(r.finalCharge !== null || r.retainedExposure === op.r.charge, 'unknown charge must retain maximum exposure');
      // Owner-produced acceptance is consumed again at live consequential use.
      // Historical record validation never turns its Outcome into live authority.
    }
  }
}
export function effectSchemas(host: EffectHost): readonly FactSchema[] {
  return Object.keys(effectShapes).map(name => ({ kind: kindFor(name), version: 1,
    fields: { record: { kind: 'owned', owner: 'part-eight', name } }, machineScope: 'shared',
    standing: 'requester', action: 'work', scope: host.scope, causallyBound: false,
    requiredReferences: [], authority: 'none' }));
}
export function registerEffectBodies(host: EffectHost): Result<readonly OwnedBodyRegistration[]> {
  return boundary('EffectRegistrations', null, host.boundary, () => Object.entries(effectShapes).map(([name, shape]) => take(registerOwnedBody({
    name, owner: 'part-eight', currentVersion: 1, versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
    decodeCurrent: (input, c) => {
      try {
        recordShapeCheck(name, input);
        ensure(c.origin.machine === host.machine && c.origin.principal.id === host.principal.id
          && c.origin.principal.kind === host.principal.kind, 'foreign effect recorder');
        const r = recordFrom({ body: { record: input } } as unknown as FactEnvelope);
        ensure(r.type === name, 'owned type mismatch');
        const historicalCaptures: Record<string, string> = { ...host.current().decode.captures,
          ...Object.fromEntries(Object.entries(c.facts.captures)
            .filter(([, captured]) => captured.status === 'available' && captured.bytes !== null)
            .map(([reference, captured]) => [reference, captured.bytes!])) };
        for (const [reference, captured] of Object.entries(c.facts.captures))
          if (captured.status !== 'available') delete historicalCaptures[reference];
        const historicalStatuses = { ...(host.current().decode as { captureStatuses?: Readonly<Record<string, string>> }).captureStatuses,
          ...Object.fromEntries(Object.entries(c.facts.captures).map(([reference, captured]) => [reference, captured.status])) };
        const validationHost = c.mode === 'historical' ? { ...host, historical: true, historicalCaptures: c.facts.captures,
          current: () => ({ ...host.current(), clock: c.origin.at,
            decode: { ...c.facts.decode, captures: historicalCaptures, captureStatuses: historicalStatuses } }) } : host;
        validate(r, causalCone(c.origin, c.facts.facts), validationHost, c.mode === 'origin', c.origin.at);
        return { ok: true, value: freeze(input) };
      } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : 'effect record refused' }; }
    },
  }, shape, host.boundary))));
}
export function decodeOutboundMessage(input: unknown, host: EffectHost): Result<OutboundMessage> {
  return boundary('OutboundMessageInput', input, host.boundary, () => {
    const safe = json(input); legacyShapeCheck(safe, legacyEffectShapes.OutboundMessage!);
    const m = safe as unknown as OutboundMessage;
    ensure(m.type === 'OutboundMessage' && m.schemaVersion === 1 && m.id.length > 0 && m.purpose === 'ordinary-reply'
      && m.speaker === host.principal.id && m.text.length > 0, 'message identity, purpose or speaker');
    return freeze(m);
  });
}
export function createEffectSpine(host: EffectHost, author: EffectAuthor, store: FactStorePort): EffectSpine {
  return Object.freeze({ store, append: (record: EffectRecord, required: readonly string[]) => authorAndAppend({
    kind: kindFor(record.type), schemaVersion: 1, machine: host.machine,
    principal: json(host.principal), provenance: json(host.principal.provenance), at: json(host.current().clock),
    body: { record: wire(record) }, required,
  }, author.context, store, author.privateKey) });
}
export function installOperationDefinition(input: unknown, host: EffectHost, spine: EffectSpine): Result<OperationDefinition> {
  return boundary('OperationDefinitionInput', input, host.boundary, () => {
    const safe = json(input); recordShapeCheck('OperationDefinition', safe);
    const d = safe as unknown as OperationDefinition; definitionCheck(d, host);
    take(spine.append(d, host.current().authority)); return freeze(d);
  });
}
