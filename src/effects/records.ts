import { decode, decodeMeasurement, grantLiveness, isValid, scopeIncludes } from '../index.js';
import type { Json, Result } from '../index.js';
import { authorAndAppend, causalCone, registerOwnedBody, walkVersions } from '../facts/index.js';
import type { FactEnvelope, FactSchema, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import type { EffectAuthor, EffectHost, EffectRecord, EffectSpine, OperationDefinition, OutboundMessage } from './contracts.js';
import type { FactStorePort } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { requireSettlement } from './settlement-authority.js';

const text = { kind: 'text', maxLength: 512 } as const, integer = { kind: 'integer' } as const;
const refs = { kind: 'array', maxLength: 64, items: text } as const;
const common = { type: text, schemaVersion: integer, id: text };
const capture = { kind: 'capture' } as const;
const outcome: OwnedShape = { kind: 'object', fields: { type: text, schemaVersion: integer, kind: text, evidence: refs } };
// The normalized owner settlement uses null. P2's shape supports null but no
// arbitrary union, so record
// it as an exact bounded decimal string ("unknown" or an integer), at this seam.
export const effectShapes: Readonly<Record<string, OwnedShape>> = freeze({
  OperationDefinition: { kind: 'object', fields: { ...common, feature: text, version: text, generation: text,
    adapter: text, account: text, conversation: text, speaker: text, scopeDigest: text, durability: text,
    replicas: integer, lossModel: text, maxBytes: integer, maxCharge: integer, timeout: integer, verificationBar: text } },
  OutboundMessage: { kind: 'object', fields: { ...common, semanticMessage: text, run: text, speaker: text,
    account: text, conversation: text, text: { kind: 'text', maxLength: 4096 }, purpose: text, sourceResult: text } },
  EffectRequest: { kind: 'object', fields: { ...common, definition: text, message: text, semanticMessage: text,
    run: text, pending: text, attempt: text, digest: text, verificationOwner: text, verificationBar: text,
    obligation: text, closure: refs } },
  EffectValidation: { kind: 'object', fields: { ...common, request: text, digest: text, phase: text,
    generation: text, definition: text, expires: integer, authority: refs } },
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
  ensure(Object.keys(r).length === Object.keys(shape.fields).length, 'missing or undeclared field');
  for (const [k, s] of Object.entries(shape.fields)) { ensure(Object.hasOwn(r, k), `missing ${k}`); shapeCheck(r[k], s); }
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
}
function validate(r: EffectRecord, past: readonly FactEnvelope[], host: EffectHost, origin: boolean): void {
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
  } else if (r.type === 'EffectRequest') {
    const d = find(r.definition, 'OperationDefinition'), m = find(r.message, 'OutboundMessage');
    ensure(r.id === `request:${encoded([m.account, m.conversation, m.semanticMessage]).hash}`, 'stable semantic identity required');
    ensure(r.digest === encoded(m).hash && r.semanticMessage === m.semanticMessage && r.run === m.run, 'request/message binding');
    ensure(m.account === d.account && m.conversation === d.conversation && m.speaker === d.speaker
      && encoded(m.text).bytes.length <= d.maxBytes, 'actual target/payload exceeds operation');
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
    if (origin) { definitionCheck(d, host); ensure(r.expires > host.current().clock.value, 'validation expired'); }
  } else {
    const q = find(r.request, 'EffectRequest'), m = find(q.message, 'OutboundMessage');
    const reservations = past.filter(f => f.kind === 'transport-AdmissionReservation');
    const op = reservations.map(f => ({ fact: f, r: (f.body as { record: { operation: string; state: string; digest: string; request: string; charge: number } }).record }))
      .filter(v => v.r.operation === r.operation).at(-1);
    ensure(op && op.r.request === q.id && op.r.digest === r.digest && r.digest === q.digest && op.r.state !== 'prepared', 'observation/settlement operation binding');
    const claim = reservations.find(f => f.id === r.claim);
    ensure(claim && (claim.body as { record: { operation: string; state: string } }).record.operation === r.operation
      && (claim.body as { record: { state: string } }).record.state === 'dispatch-claimed', 'claim fact mismatch');
    if (r.type === 'OperationObservation') {
      ensure(r.account === m.account && r.conversation === m.conversation && r.attestation === 'local-recorder'
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
      ensure(r.acceptance.length > 0 && past.some(f => f.id === r.acceptance), 'independent acceptance absent');
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
        shapeCheck(input, shape);
        ensure(c.origin.machine === host.machine && c.origin.principal.id === host.principal.id
          && c.origin.principal.kind === host.principal.kind, 'foreign effect recorder');
        const r = recordFrom({ body: { record: input } } as unknown as FactEnvelope);
        ensure(r.type === name, 'owned type mismatch');
        validate(r, causalCone(c.origin, c.facts.facts), host, c.mode === 'origin');
        return { ok: true, value: freeze(input) };
      } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : 'effect record refused' }; }
    },
  }, shape, host.boundary))));
}
export function decodeOutboundMessage(input: unknown, host: EffectHost): Result<OutboundMessage> {
  return boundary('OutboundMessageInput', input, host.boundary, () => {
    const safe = json(input); shapeCheck(safe, effectShapes.OutboundMessage!);
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
    const safe = json(input); shapeCheck(safe, effectShapes.OperationDefinition!);
    const d = safe as unknown as OperationDefinition; definitionCheck(d, host);
    take(spine.append(d, host.current().authority)); return freeze(d);
  });
}
