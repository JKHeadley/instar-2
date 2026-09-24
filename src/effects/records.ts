import { decode, decodeMeasurement, grantLiveness, isValid, scopeIncludes } from '../index.js';
import type { Json, Result } from '../index.js';
import { authorAndAppend, causalCone, registerOwnedBody, walkVersions } from '../facts/index.js';
import type { FactEnvelope, FactSchema, OwnedBodyContext, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import type { EffectAuthor, EffectHost, EffectRecord, EffectRequest, EffectSpine, NativeLaunchDefinition, NativeLaunchObservation,
  NativeLaunchRequest, NativeProcessRecord, OperationDefinition, OutboundMessage } from './contracts.js';
import type { FactStorePort } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { requireSettlement } from './settlement-authority.js';

const text = { kind: 'text', maxLength: 512 } as const, integer = { kind: 'integer' } as const;
const refs = { kind: 'array', maxLength: 64, items: text } as const;
const common = { type: text, schemaVersion: integer, id: text };
const capture = { kind: 'capture' } as const;
const environment = { kind: 'array', maxLength: 64, items: { kind: 'object', fields: { name: text, valueDigest: text } } } as const;
const manifest = { kind: 'array', maxLength: 64, items: { kind: 'object', fields: { class: text, reference: text, digest: text } } } as const;
const launchLimits = { kind: 'object', fields: { wallMilliseconds: integer, cpuMilliseconds: integer,
  memoryBytes: integer, processCount: integer, handleCount: integer, inputBytes: integer,
  outputBytes: integer, scratchBytes: integer, queueCount: integer, outstandingDispatchCount: integer,
  observationCount: integer, observationMilliseconds: integer, observationBytes: integer,
  maximumExposure: integer, allocation: text } } as const;
const target = { kind: 'object', fields: { installation: text, machine: text, principal: text,
  harness: text, artifactDigest: text, executable: text, executableDigest: text, boundaryDigest: text,
  restrictedIdentity: text, workingScope: text, environmentDigest: text, handlePolicyDigest: text } } as const;
const parameters = { kind: 'object', fields: { mode: text, installation: text, machine: text,
  principal: text, incarnation: text, harness: text, artifactDigest: text, executable: text,
  executableDigest: text, boundaryDigest: text, restrictedIdentity: text, workingScope: text,
  environment, environmentCapture: capture, portHandles: refs, resourceReferences: refs,
  input: text, inputDigest: text, contextManifest: manifest, consumptionMode: text, limits: launchLimits } } as const;
const processIdentity = { kind: 'object', fields: { state: text, machine: text, incarnation: text,
  startIdentity: text, pid: integer, artifactDigest: text, boundaryDigest: text },
  optional: ['machine', 'incarnation', 'startIdentity', 'pid', 'artifactDigest', 'boundaryDigest'] } as const;
const outcome: OwnedShape = { kind: 'object', fields: { type: text, schemaVersion: integer, kind: text, evidence: refs } };
// The normalized owner settlement uses null. P2's shape supports null but no
// arbitrary union, so record
// it as an exact bounded decimal string ("unknown" or an integer), at this seam.
export const effectShapes: Readonly<Record<string, OwnedShape>> = freeze({
  OperationDefinition: { kind: 'object', fields: { ...common, feature: text, version: text, generation: text,
    adapter: text, account: text, conversation: text, speaker: text, scopeDigest: text, durability: text,
    replicas: integer, lossModel: text, maxBytes: integer, maxCharge: integer, timeout: integer, verificationBar: text } },
  OutboundMessage: { kind: 'object', fields: { ...common, semanticMessage: text, run: text, speaker: text,
    account: text, conversation: text, text: { kind: 'text', maxLength: 4096 }, purpose: text, sourceResult: text,
    context: { kind: 'object', fields: { input: { kind: 'object', fields: { fact: text, reference: text, hash: text } },
      manifest: { kind: 'array', maxLength: 64, items: { kind: 'object', fields: { class: text, reference: text, digest: text } } } } } }, optional: ['context'] },
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
export const nativeProcessShapes: Readonly<Record<NativeProcessRecord['type'], OwnedShape>> = freeze({
  OperationDefinition: { kind: 'object', fields: { ...common, operation: text, feature: text,
    version: text, generation: text, adapter: text, mode: text, profile: text, target,
    limits: launchLimits, authority: { kind: 'object', fields: { scope: text, grants: refs,
      authorization: refs, policy: refs } }, durability: text, replicas: integer, lossModel: text,
    verificationBar: text, observationPolicy: text, expiryEvidence: text } },
  EffectRequest: { kind: 'object', fields: { ...common, operation: text, definition: text,
    generation: text, run: text, step: text, pending: text, expectedPredecessor: text,
    attempt: text, semanticMessage: text, parameters, digest: text, launchSpec: text,
    launchSpecDigest: text, reservation: text, verificationOwner: text,
    verificationBar: text, obligation: text, closure: refs } },
  OperationObservation: { kind: 'object', fields: { ...common, operation: text, operationIdentity: text,
    request: text, claim: text, consumption: text, digest: text, launchSpec: text,
    launchSpecDigest: text, machine: text, incarnation: text, stage: text,
    processIdentity, wake: text, capture, attestation: text, observer: text,
    observedAt: integer, freshFor: integer, predecessors: refs } },
});
function versionedShape(name: NativeProcessRecord['type']): OwnedShape {
  const old = effectShapes[name]!, next = nativeProcessShapes[name]!;
  ensure(old.kind === 'object' && next.kind === 'object', 'record shape must be closed');
  const fields = { ...old.fields, ...next.fields, legacyMessage: { kind: 'boolean' } as const };
  const required = new Set(['type', 'schemaVersion', 'id']);
  return { kind: 'object', fields, optional: Object.keys(fields).filter(key => !required.has(key)) };
}
export const kindFor = (name: string) => `effect-${name}`;
export function wire(r: EffectRecord): Json {
  return json(r.type === 'EffectSettlement' ? { ...r, finalCharge: r.finalCharge === null ? 'unknown' : String(r.finalCharge) } : r);
}
export function recordFrom(f: FactEnvelope): EffectRecord {
  const r = (f.body as { record: Record<string, Json> }).record;
  return freeze((r.type === 'EffectSettlement' ? { ...r, finalCharge: r.finalCharge === 'unknown' ? null : Number(r.finalCharge) } : r) as unknown as EffectRecord);
}
export function rows(facts: readonly FactEnvelope[]) {
  return facts.filter(f => f.schemaVersion === 1 && Object.keys(effectShapes).some(n => f.kind === kindFor(n)))
    .map(fact => ({ fact, record: recordFrom(fact) }));
}
export function nativeProcessRows(facts: readonly FactEnvelope[]) {
  return facts.filter(f => f.schemaVersion === 2 && Object.keys(nativeProcessShapes).some(n => f.kind === kindFor(n)))
    .map(fact => ({ fact, record: freeze((fact.body as unknown as { record: NativeProcessRecord }).record) }));
}
function shapeCheck(v: unknown, shape: OwnedShape): void {
  if (shape.kind === 'text') { ensure(typeof v === 'string' && v.length <= shape.maxLength, 'bounded text required'); return; }
  if (shape.kind === 'integer') { ensure(Number.isSafeInteger(v), 'safe integer required'); return; }
  if (shape.kind === 'boolean') { ensure(typeof v === 'boolean', 'boolean required'); return; }
  if (shape.kind === 'array') { ensure(Array.isArray(v) && v.length <= shape.maxLength, 'bounded array required'); v.forEach(i => shapeCheck(i, shape.items)); return; }
  if (shape.kind === 'capture') { shapeCheck(v, { kind: 'object', fields: { reference: text, hash: text } }); return; }
  ensure(shape.kind === 'object' && v && typeof v === 'object' && !Array.isArray(v), 'closed object required');
  const r = v as Record<string, unknown>;
  ensure(Object.keys(r).every(k => Object.hasOwn(shape.fields, k))
    && Object.keys(shape.fields).every(k => shape.optional?.includes(k) || Object.hasOwn(r, k)), 'missing or undeclared field');
  for (const [k, s] of Object.entries(shape.fields)) {
    if (shape.optional?.includes(k) && !Object.hasOwn(r, k)) continue;
    ensure(Object.hasOwn(r, k), `missing ${k}`); shapeCheck(r[k], s);
  }
}
export function live(host: EffectHost, feature?: string): void {
  const c = feature === 'harness-live-input' ? host.current(feature) : host.current(); ensure(!c.stopped, 'stop inhibits effect');
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
  const c = d.feature === 'harness-live-input' ? host.current(d.feature) : host.current(); live(host, d.feature);
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
export function nativeDefinitionCheck(d: NativeLaunchDefinition, host: EffectHost): void {
  live(host, d.feature);
  const c = host.current(d.feature), versions = walkVersions(c.versions);
  ensure(versions.conflicts.length === 0, 'native launch definition contested');
  const approved = versions.current.find(value => value.id === d.version && value.subject === d.feature);
  ensure(approved && encoded(approved.content).bytes === encoded(d).bytes, 'native launch definition is not current');
  const authorization = take(decode('Authorization', approved.approvedIn,
    { ...c.decode, provenance: approved.approvedIn.explicitYes }));
  ensure(authorization.approver.id !== host.principal.id
    && isValid(authorization, approved.base, encoded(approved.content).hash, c.clock, c.decode) === 'valid',
  'native launch definition approval is not live');
  ensure(d.operation === 'native-confined-launch' && d.feature === d.operation && d.mode === 'context-loading'
    && d.generation === c.decode.register.generation.id
    && c.decode.register.entries.includes(d.feature) && c.decode.register.entries.includes(d.adapter),
  'native launch definition identity or generation changed');
  ensure(d.target.machine === host.machine && d.target.principal === host.principal.id
    && d.authority.scope === encoded(host.scope).hash && d.authority.grants.length > 0
    && d.profile.length > 0 && d.observationPolicy.length > 0 && d.expiryEvidence.length > 0,
  'native launch target or authority missing');
  ensure(d.target.executable.startsWith('/') && d.target.restrictedIdentity.length > 0
    && d.target.handlePolicyDigest.length > 0 && d.target.environmentDigest.length > 0,
  'fixed native target is incomplete');
  ensure(Object.entries(d.limits).every(([key, value]) => key === 'allocation'
    ? typeof value === 'string' && value.length > 0 : Number.isSafeInteger(value) && (value as number) > 0)
    && d.limits.processCount === 1, 'finite fixed launch bounds required');
  ensure((d.durability === 'local-durable' && d.replicas === 0)
    || (d.durability === 'replicated' && d.replicas > 0), 'native durability demand invalid');
}
function exactList(values: readonly string[]): boolean {
  return values.length > 0 && values.every(value => value.length > 0)
    && encoded([...new Set(values)].sort()).bytes === encoded(values).bytes;
}
function validateNative(record: NativeProcessRecord, past: readonly FactEnvelope[], host: EffectHost, origin: boolean): void {
  ensure(record.schemaVersion === 2 && record.id.length > 0, 'native record identity/version');
  const all = nativeProcessRows(past);
  ensure(!all.some(row => row.record.type === record.type && row.record.id === record.id)
    && !rows(past).some(row => row.record.type === record.type && row.record.id === record.id),
  'native record identity already exists');
  const find = <T extends NativeProcessRecord['type']>(id: string, type: T) => {
    const row = all.find(item => item.record.id === id && item.record.type === type);
    ensure(row, `native ${type} predecessor absent`);
    return row as { fact: FactEnvelope; record: Extract<NativeProcessRecord, { type: T }> };
  };
  if (record.type === 'OperationDefinition') {
    ensure(record.operation === 'native-confined-launch' && record.mode === 'context-loading', 'native definition mode');
    if (origin) nativeDefinitionCheck(record, host);
    return;
  }
  if (record.type === 'EffectRequest') {
    const definition = find(record.definition, 'OperationDefinition').record;
    if (origin) nativeDefinitionCheck(definition, host);
    const p = record.parameters;
    ensure(record.operation === 'native-confined-launch' && p.mode === 'context-loading'
      && record.generation === definition.generation && record.verificationBar === definition.verificationBar
      && record.verificationOwner === 'part-nine', 'native request definition/verification mismatch');
    ensure(record.id === `request:${encoded(['native-confined-launch', p.installation, p.machine,
      record.run, record.step, p.incarnation]).hash}` && record.digest === encoded(p).hash,
    'native request identity or parameter digest changed');
    ensure(encoded(p.limits).bytes === encoded(definition.limits).bytes
      && p.installation === definition.target.installation && p.machine === definition.target.machine
      && p.principal === definition.target.principal && p.harness === definition.target.harness
      && p.artifactDigest === definition.target.artifactDigest
      && p.executable === definition.target.executable
      && p.executableDigest === definition.target.executableDigest
      && p.boundaryDigest === definition.target.boundaryDigest
      && p.restrictedIdentity === definition.target.restrictedIdentity
      && p.workingScope === definition.target.workingScope,
    'native request target or limits changed');
    ensure(exactList(p.resourceReferences) && p.portHandles.length > 0
      && encoded([...new Set(p.portHandles)].sort()).bytes === encoded(p.portHandles).bytes,
    'native allocation and singleton handle references required');
    ensure(record.closure.includes(record.pending) && record.closure.includes(record.reservation)
      && record.closure.includes(record.launchSpec) && record.closure.includes(record.obligation)
      && record.closure.every(id => past.some(fact => fact.id === id)), 'native causal closure incomplete');
    const opening = past.find(fact => fact.id === record.pending);
    const run = opening?.body as { record?: { id?: string; opening?: { id?: string } }; run?: string } | undefined;
    const k = encoded(['native-confined-launch', record.pending]).hash;
    ensure(opening?.kind === 'run-opening' && run?.record?.id === record.run
      && record.step === `initial-step:${k}` && record.semanticMessage === `initial-launch:${k}`
      && record.attempt === `initial-launch-attempt:${k}` && record.expectedPredecessor === record.run,
    'native initial Run anchor or derived identity changed');
    const prepared = past.find(fact => fact.id === record.reservation);
    const reservation = (prepared?.body as { record?: { type?: string; state?: string; request?: string;
      attempt?: string; digest?: string; run?: string } } | undefined)?.record;
    ensure(prepared?.kind === 'transport-AdmissionReservation' && reservation?.type === 'AdmissionReservation'
      && reservation.state === 'prepared' && reservation.request === record.id
      && reservation.attempt === record.attempt && reservation.digest === record.digest
      && reservation.run === record.run, 'native prepared Six mapping changed');
    const spec = past.find(fact => fact.id === record.launchSpec);
    const launch = (spec?.body as { record?: Record<string, unknown> } | undefined)?.record;
    ensure(spec?.kind === 'assembly-HarnessLaunchSpec' && launch?.processOperation === record.reservation
      && record.launchSpecDigest === encoded(launch).hash
      && launch.run === record.run && launch.step === record.step
      && launch.machine === p.machine && launch.incarnation === p.incarnation
      && launch.principal === p.principal && launch.harness === p.harness
      && launch.artifactDigest === p.artifactDigest && launch.workingScope === p.workingScope
      && launch.input === p.input && launch.inputDigest === p.inputDigest
      && launch.consumptionMode === p.consumptionMode
      && encoded(launch.portHandles).bytes === encoded(p.portHandles).bytes
      && encoded(launch.environment).bytes === encoded(p.environment).bytes
      && encoded(launch.contextManifest).bytes === encoded(p.contextManifest).bytes
      && encoded(launch.resourceReferences).bytes === encoded([...p.resourceReferences, record.reservation].sort()).bytes,
    'native complete Ten specification differs');
    ensure(p.resourceReferences.every(id => past.some(fact => fact.id === id
      && fact.segment.position < prepared.segment.position)), 'native prior allocation not before reservation');
    return;
  }
  const request = find(record.request, 'EffectRequest').record;
  const definition = find(request.definition, 'OperationDefinition').record;
  ensure(record.operation === 'native-confined-launch' && record.digest === request.digest
    && record.launchSpec === request.launchSpec && record.launchSpecDigest === request.launchSpecDigest
    && record.machine === request.parameters.machine && record.incarnation === request.parameters.incarnation
    && record.freshFor > 0 && record.freshFor <= definition.limits.observationMilliseconds
    && record.observedAt >= 0 && record.attestation === 'local-recorder',
  'native observation request/subject/freshness mismatch');
  const claim = past.find(fact => fact.id === record.claim);
  const consumed = past.find(fact => fact.id === record.consumption);
  const claimRow = (claim?.body as { record?: { state?: string; operation?: string } } | undefined)?.record;
  const consumedRow = (consumed?.body as { record?: { state?: string; operation?: string } } | undefined)?.record;
  ensure(claimRow?.state === 'dispatch-claimed' && consumedRow?.state === 'consumed'
    && claimRow.operation === record.operationIdentity && consumedRow.operation === record.operationIdentity,
  'native observation requires original consumed claim');
  ensure(record.processIdentity.state === 'unknown' || record.processIdentity.state === 'known'
    && record.processIdentity.machine === record.machine
    && record.processIdentity.incarnation === record.incarnation
    && record.processIdentity.pid > 0 && record.processIdentity.startIdentity.length > 0,
  'native process identity incomplete');
  ensure(record.processIdentity.state === 'unknown'
    ? Object.keys(record.processIdentity).length === 1
    : Object.keys(record.processIdentity).length === 7,
  'native process identity has extra or missing fields');
  ensure(record.predecessors.includes(record.claim) && record.predecessors.includes(record.consumption)
    && record.predecessors.includes(record.launchSpec)
    && record.predecessors.every(id => past.some(fact => fact.id === id)),
  'native observation predecessor closure incomplete');
  ensure(['launched', 'uncertain', 'exit-observed', 'lookup'].includes(record.stage)
    && (record.stage === 'lookup' || record.stage === 'exit-observed' ? record.wake.length > 0 : record.wake === ''),
  'native observation stage or wake invalid');
  if (record.wake) {
    const wake = past.find(fact => fact.id === record.wake);
    const loop = (wake?.body as { record?: { type?: string; pending?: string; state?: string } } | undefined)?.record;
    ensure(wake?.kind === 'transport-LoopRecord' && loop?.type === 'LoopRecord'
      && loop.pending === record.operationIdentity
      && ['running', 'restoring', 'waiting'].includes(loop.state ?? ''),
    'native observation requires original active Six wake');
  }
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
    if (r.context) ensure(r.purpose === 'context-delivery' && r.context.input.fact === r.sourceResult
      && /^sha256:[a-f0-9]{64}$/.test(r.context.input.hash), 'explicit context input binding required');
    ensure((r.purpose === 'ordinary-reply' || r.purpose === 'context-delivery') && r.speaker === host.principal.id && r.text.length > 0
      && r.semanticMessage.length > 0 && r.sourceResult.length > 0, 'attributable reply required');
    ensure(past.some(f => f.id === r.sourceResult), 'source result fact missing');
  } else if (r.type === 'EffectRequest') {
    const d = find(r.definition, 'OperationDefinition'), m = find(r.message, 'OutboundMessage');
    ensure((m.purpose === 'context-delivery') === (d.feature === 'harness-live-input'), 'live-input payload requires its governed harness-live-input definition');
    ensure(r.id === `request:${encoded([m.account, m.conversation, m.semanticMessage]).hash}`, 'stable semantic identity required');
    ensure(r.digest === encoded(m).hash && r.semanticMessage === m.semanticMessage && r.run === m.run, 'request/message binding');
    ensure(m.account === d.account && m.conversation === d.conversation && m.speaker === d.speaker
      && new TextEncoder().encode(encoded(m).bytes).length <= d.maxBytes, 'actual target/payload exceeds operation');
    ensure(r.attempt.length > 0 && r.verificationOwner.length > 0 && r.verificationBar === d.verificationBar, 'verification obligation required');
    ensure(r.closure.includes(r.pending) && r.closure.includes(r.obligation)
      && r.closure.every(id => past.some(f => f.id === id)), 'missing prerequisite closure');
    const loop = past.find(f => f.id === r.obligation);
    ensure(loop?.kind === 'transport-LoopRecord' && (loop.body as { record: { run: string } }).record.run === r.run, 'six-owned verification wake missing');
    if (origin) definitionCheck(d, host);
  } else if (r.type === 'EffectValidation') {
    const legacy = all.find(row => row.record.type === 'EffectRequest' && row.record.id === r.request)?.record as EffectRequest | undefined;
    const native = nativeProcessRows(past).find(row => row.record.type === 'EffectRequest'
      && row.record.id === r.request)?.record as NativeLaunchRequest | undefined;
    ensure((legacy ? 1 : 0) + (native ? 1 : 0) === 1, 'validation request variant missing or ambiguous');
    const q = legacy ?? native!;
    const d = legacy ? find(legacy.definition, 'OperationDefinition')
      : nativeProcessRows(past).find(row => row.record.type === 'OperationDefinition'
        && row.record.id === native!.definition)?.record as NativeLaunchDefinition | undefined;
    ensure(d && r.digest === q.digest && r.definition === d.id && r.generation === d.generation
      && ['reservation', 'dispatch'].includes(r.phase) && r.authority.length > 0, 'validation binding');
    if (origin) {
      if (legacy) definitionCheck(d as OperationDefinition, host);
      else nativeDefinitionCheck(d as NativeLaunchDefinition, host);
      const lifetime = legacy ? (d as OperationDefinition).timeout : (d as NativeLaunchDefinition).limits.wallMilliseconds;
      ensure(r.expires === host.current().clock.value + lifetime, 'validation expiry differs from bounded current clock');
    }
  } else if (r.type === 'EffectSettlement' && nativeProcessRows(past).some(row =>
    row.record.type === 'EffectRequest' && row.record.id === r.request)) {
    const request = nativeProcessRows(past).find(row => row.record.type === 'EffectRequest'
      && row.record.id === r.request)?.record as NativeLaunchRequest;
    const operations = past.filter(fact => fact.kind === 'transport-AdmissionReservation')
      .map(fact => ({ fact, record: (fact.body as unknown as { record: {
        operation: string; state: string; request: string; digest: string; charge: number } }).record }))
      .filter(row => row.record.operation === r.operation);
    const current = operations.at(-1), claim = operations.find(row => row.fact.id === r.claim);
    ensure(current && current.record.state !== 'prepared' && current.record.request === request.id
      && current.record.digest === request.digest && r.digest === request.digest
      && claim?.record.state === 'dispatch-claimed'
      && current.fact.id === r.reservation, 'native settlement original operation mismatch');
    const observations = nativeProcessRows(past).filter(row => row.record.type === 'OperationObservation'
      && row.record.operationIdentity === r.operation).map(row => row.record.id);
    ensure(r.observations.length > 0 && r.observations.every(id => observations.includes(id))
      && r.acceptance.length > 0 && past.some(fact => fact.id === r.acceptance),
    'native settlement assessment or observations absent');
    ensure(r.retryEligible === false && r.retainedExposure >= 0
      && (r.finalCharge === null || Number.isSafeInteger(r.finalCharge) && r.finalCharge >= 0)
      && (r.finalCharge !== null || r.retainedExposure === current.record.charge),
    'native settlement cannot erase retained exposure');
    if (origin) requireSettlement(host, r);
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
/** Only the launch-enabled installation adds these schemas and their matching
 * body migrations. Existing message installations retain their v1 body map. */
export function nativeProcessSchemas(host: EffectHost): readonly FactSchema[] {
  return Object.keys(nativeProcessShapes).map(name => ({ kind: kindFor(name), version: 2,
    fields: { record: { kind: 'owned', owner: 'part-eight', name } }, machineScope: 'shared',
    standing: 'requester', action: 'work', scope: host.scope, causallyBound: false,
    requiredReferences: [], authority: 'none' }));
}
export const nativeProcessMigrations = Object.freeze(Object.keys(nativeProcessShapes).map(name => ({
  kind: kindFor(name), from: 1, to: 2, migrate: (body: Json): Json => body,
})));
const genuineEffectRegistrations = new WeakSet<object>();
export function isHarnessLiveInputOwnerRegistration(registration: OwnedBodyRegistration): boolean {
  return genuineEffectRegistrations.has(registration);
}
export function registerEffectBodies(host: EffectHost): Result<readonly OwnedBodyRegistration[]> {
  return boundary('EffectRegistrations', null, host.boundary, () => Object.entries(effectShapes).map(([name, shape]) => { const versioned = Object.hasOwn(nativeProcessShapes, name);
    const registration = take(registerOwnedBody({
    name, owner: 'part-eight', currentVersion: versioned ? 2 : 1,
    versions: versioned ? { 1: { validate: v => ({ ok: true, value: v }) }, 2: { validate: v => ({ ok: true, value: v }) } }
      : { 1: { validate: v => ({ ok: true, value: v }) } },
    migrations: versioned ? { 1: (value: Json) => ({ ...(value as Record<string, Json>), schemaVersion: 2, legacyMessage: true }) }
      : {},
    decodeCurrent: (input, c) => {
      try {
        const original = (c.origin.body as { record?: Json }).record;
        ensure(original && typeof original === 'object' && !Array.isArray(original), 'original owned record missing');
        const legacy = versioned && c.origin.schemaVersion === 1;
        if (legacy) {
          const migrated = input as Record<string, Json>;
          const { legacyMessage: _marker, ...restored } = migrated;
          ensure(migrated.legacyMessage === true && migrated.schemaVersion === 2
            && encoded({ ...restored, schemaVersion: 1 }).bytes === encoded(original).bytes,
          'legacy migration changed original bytes');
          input = original;
        } else ensure(!versioned || c.origin.schemaVersion === 2
          && !(input as Record<string, Json>).legacyMessage, 'stored v2 legacy intermediate refused');
        shapeCheck(input, legacy || !versioned ? shape : nativeProcessShapes[name as NativeProcessRecord['type']]!);
        ensure(c.origin.machine === host.machine && c.origin.principal.id === host.principal.id
          && c.origin.principal.kind === host.principal.kind, 'foreign effect recorder');
        const r = (versioned && !legacy ? input : recordFrom({ body: { record: input } } as unknown as FactEnvelope)) as EffectRecord | NativeProcessRecord;
        ensure(r.type === name, 'owned type mismatch');
        if (versioned && !legacy) validateNative(r as NativeProcessRecord, causalCone(c.origin, c.facts.facts), host, c.mode === 'origin');
        else validate(r as EffectRecord, causalCone(c.origin, c.facts.facts), host, c.mode === 'origin');
        return { ok: true, value: freeze(input) };
      } catch (e) { return { ok: false, detail: e instanceof Error ? e.message : 'effect record refused' }; }
    },
  }, versioned ? versionedShape(name as NativeProcessRecord['type']) : shape, host.boundary)); genuineEffectRegistrations.add(registration); return registration; }));
}
export function decodeOutboundMessage(input: unknown, host: EffectHost): Result<OutboundMessage> {
  return boundary('OutboundMessageInput', input, host.boundary, () => {
    const safe = json(input); shapeCheck(safe, effectShapes.OutboundMessage!);
    const m = safe as unknown as OutboundMessage;
    ensure(m.type === 'OutboundMessage' && m.schemaVersion === 1 && m.id.length > 0 && (m.purpose === 'ordinary-reply' || m.purpose === 'context-delivery')
      && m.speaker === host.principal.id && m.text.length > 0, 'message identity, purpose or speaker');
    if (m.context) ensure(m.purpose === 'context-delivery' && m.context.input.fact === m.sourceResult
      && /^sha256:[a-f0-9]{64}$/.test(m.context.input.hash), 'explicit context input binding required');
    return freeze(m);
  });
}
const liveInputAuthors = new WeakMap<object, EffectAuthor>();
export function harnessLiveInputAuthor(spine: EffectSpine): EffectAuthor {
  const author = liveInputAuthors.get(spine); ensure(author, 'live-input requires a genuine Eight spine'); return author;
}
export function readHarnessLiveInputCapture(spine: EffectSpine, capture: { reference: string; hash: string }): string {
  const stored = liveInputAuthors.get(spine)?.context.captures?.[capture.reference];
  ensure(stored?.status === 'available' && typeof stored.bytes === 'string' && stored.hash === capture.hash, 'live-input response capture unavailable');
  return stored.bytes;
}
export function createEffectSpine(host: EffectHost, author: EffectAuthor, store: FactStorePort): EffectSpine {
  const spine = Object.freeze({ store, append: (record: EffectRecord | NativeProcessRecord, required: readonly string[]) => authorAndAppend({
    kind: kindFor(record.type), schemaVersion: record.schemaVersion, machine: host.machine,
    principal: json(host.principal), provenance: json(host.principal.provenance), at: json(host.current().clock),
    body: { record: record.schemaVersion === 1 ? wire(record) : json(record) }, required,
  }, author.context, store, author.privateKey) });
  liveInputAuthors.set(spine, author); return spine;
}
export function installOperationDefinition(input: unknown, host: EffectHost, spine: EffectSpine): Result<OperationDefinition> {
  return boundary('OperationDefinitionInput', input, host.boundary, () => {
    const safe = json(input); shapeCheck(safe, effectShapes.OperationDefinition!);
    const d = safe as unknown as OperationDefinition; definitionCheck(d, host);
    take(spine.append(d, (d.feature === 'harness-live-input' ? host.current(d.feature) : host.current()).authority)); return freeze(d);
  });
}
export function installNativeLaunchDefinition(input: unknown, host: EffectHost, spine: EffectSpine): Result<NativeLaunchDefinition> {
  return boundary('NativeLaunchDefinitionInput', input, host.boundary, () => {
    const safe = json(input); shapeCheck(safe, nativeProcessShapes.OperationDefinition);
    const record = safe as unknown as NativeLaunchDefinition;
    nativeDefinitionCheck(record, host);
    take(spine.append(record, host.current(record.feature).authority));
    return freeze(record);
  });
}
function decodeNative<T extends NativeProcessRecord['type']>(type: T, input: unknown,
  context: OwnedBodyContext, host: EffectHost): Result<Extract<NativeProcessRecord, { type: T }>> {
  return boundary(`NativeLaunch${type}`, input, host.boundary, () => {
    ensure(context.origin.schemaVersion === 2 && context.origin.kind === kindFor(type)
      && context.origin.machine === host.machine && context.origin.principal.id === host.principal.id,
    'native launch owner envelope mismatch');
    const safe = json(input); shapeCheck(safe, nativeProcessShapes[type]);
    ensure(encoded((context.origin.body as { record: Json }).record).bytes === encoded(safe).bytes,
      'native launch original body differs');
    const record = safe as unknown as Extract<NativeProcessRecord, { type: T }>;
    ensure(record.type === type && record.operation === 'native-confined-launch', 'native launch variant mismatch');
    validateNative(record, causalCone(context.origin, context.facts.facts), host, context.mode === 'origin');
    return freeze(record);
  });
}
export function decodeNativeConfinedLaunchDefinitionAtOrigin(input: unknown, context: OwnedBodyContext, host: EffectHost) {
  ensure(context.mode === 'origin', 'native definition origin mode required');
  return decodeNative('OperationDefinition', input, context, host);
}
export function decodeHistoricalNativeConfinedLaunchDefinition(input: unknown, context: OwnedBodyContext, host: EffectHost) {
  ensure(context.mode === 'historical', 'native definition historical mode required');
  return decodeNative('OperationDefinition', input, context, host);
}
export function decodeNativeConfinedLaunchRequestAtOrigin(input: unknown, context: OwnedBodyContext, host: EffectHost) {
  ensure(context.mode === 'origin', 'native request origin mode required');
  return decodeNative('EffectRequest', input, context, host);
}
export function decodeHistoricalNativeConfinedLaunchRequest(input: unknown, context: OwnedBodyContext, host: EffectHost) {
  ensure(context.mode === 'historical', 'native request historical mode required');
  return decodeNative('EffectRequest', input, context, host);
}
export function decodeNativeConfinedLaunchObservationAtOrigin(input: unknown, context: OwnedBodyContext, host: EffectHost) {
  ensure(context.mode === 'origin', 'native observation origin mode required');
  return decodeNative('OperationObservation', input, context, host);
}
export function decodeHistoricalNativeConfinedLaunchObservation(input: unknown, context: OwnedBodyContext, host: EffectHost) {
  ensure(context.mode === 'historical', 'native observation historical mode required');
  return decodeNative('OperationObservation', input, context, host);
}
export function recordNativeConfinedLaunchRequest(input: unknown, host: EffectHost, spine: EffectSpine): Result<NativeLaunchRequest> {
  return boundary('RecordNativeLaunchRequest', input, host.boundary, () => {
    const safe = json(input); shapeCheck(safe, nativeProcessShapes.EffectRequest);
    const record = safe as unknown as NativeLaunchRequest;
    const snapshot = take(spine.store.readForProjection());
    ensure(snapshot.entries.every(entry => !entry.taint.length && !entry.conflicts.length), 'native launch history contested');
    const prior = nativeProcessRows(snapshot.entries.map(entry => entry.fact))
      .find(entry => entry.record.type === record.type && entry.record.id === record.id);
    if (prior) {
      ensure(encoded(prior.record).bytes === encoded(record).bytes, 'native request identity conflict');
      return prior.record as NativeLaunchRequest;
    }
    const receipt = take(spine.append(record, record.closure));
    ensure(!receipt.taint.length && encoded((receipt.fact.body as unknown as { record: NativeLaunchRequest }).record).bytes === encoded(record).bytes,
    'native request append changed');
    return freeze(record);
  });
}
export function recordNativeConfinedLaunchObservation(input: unknown, host: EffectHost, spine: EffectSpine): Result<NativeLaunchObservation> {
  return boundary('RecordNativeLaunchObservation', input, host.boundary, () => {
    const safe = json(input); shapeCheck(safe, nativeProcessShapes.OperationObservation);
    const record = safe as unknown as NativeLaunchObservation;
    const snapshot = take(spine.store.readForProjection());
    ensure(snapshot.entries.every(entry => !entry.taint.length && !entry.conflicts.length), 'native launch history contested');
    const prior = nativeProcessRows(snapshot.entries.map(entry => entry.fact))
      .find(entry => entry.record.type === record.type && entry.record.id === record.id);
    if (prior) {
      ensure(encoded(prior.record).bytes === encoded(record).bytes, 'native observation identity conflict');
      return prior.record as NativeLaunchObservation;
    }
    const receipt = take(spine.append(record, record.predecessors));
    ensure(!receipt.taint.length && encoded((receipt.fact.body as unknown as { record: NativeLaunchObservation }).record).bytes === encoded(record).bytes,
    'native observation append changed');
    return freeze(record);
  });
}
