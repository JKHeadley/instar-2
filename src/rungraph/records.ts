import { compareMeasurements, decode, decodeMeasurement, defineDecoder, scopeIncludes } from '../index.js';
import type { HistoricalRead, Inventory, Json, Result } from '../index.js';
import { causalCone, causalStanding, decodeHistoricalBody, registerOwnedBody } from '../facts/index.js';
import type { FactEnvelope, FactSchema, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import { boundary, encoded, freeze, json, need, object, same, take } from './boundary.js';
import { INITIAL_MAX_ATTEMPTS, INITIAL_MAX_CHILDREN, INITIAL_MAX_DEPTH } from './limits.js';
import type { CompletedRunExit, ConstitutionalReference, Run, RunBudget, RunDecodeContext, RunRecord, RunStep, RunTransition, SessionGrounding } from './types.js';

const text: OwnedShape = { kind: 'text', maxLength: 1024 }, integer: OwnedShape = { kind: 'integer' };
const list = (items: OwnedShape, maxLength = 1024): OwnedShape => ({ kind: 'array', items, maxLength });
const shape = (fields: Readonly<Record<string, OwnedShape>>, optional: readonly string[] = []): OwnedShape => ({ kind: 'object', fields, optional });
const ref = shape({ owner: text, name: text, id: text });
const recordRef = shape({ type: text, id: text, fact: ref, field: text });
const clock = shape({ type: text, schemaVersion: integer, subject: shape({ kind: text, instance: text }), value: integer, unit: text, at: integer, by: text });
const measurement = shape({ type: text, schemaVersion: integer, subject: shape({ kind: text, instance: text }), value: integer, unit: text, at: clock, by: text });
const scope = shape({ type: text, schemaVersion: integer, kind: text, members: list(text) }, ['members']);
const wake = shape({ owner: recordRef, at: clock, reason: text });
const blocked = shape({ kind: text, reference: text, owner: recordRef, nextObservation: clock }, ['reference', 'owner', 'nextObservation']);
const destination = shape({ binding: ref, route: ref });
const exitTest = shape({ check: text, version: text, subject: text, acceptance: text, evidenceKinds: list(text), freshFor: integer });
const base = { type: text, schemaVersion: integer, id: text };
const budget = shape({ ...base, bounds: list(text), resources: list(measurement), maxWorkers: integer, maxProcesses: integer,
  maxOutstanding: integer, maxChildren: integer, maxDepth: integer, maxAttempts: integer, repetitionPolicy: ref, safetyCeiling: clock, exhaustedOwner: recordRef });
const step = shape({ ...base, run: text, expected: text, kind: text, operation: shape({ key: text, digest: text, classification: ref }),
  evidence: list(ref), directives: list(recordRef), authorizations: list(recordRef), allocation: shape({ budget: text, reservation: ref }),
  ownership: ref, resultDestination: destination, generation: ref });
// Vectors are represented as bounded maps in the P2 envelope. Stored P5 payloads
// use the same map shape; its variable keys are validated separately below.
const vectorText: OwnedShape = { kind: 'text', maxLength: 65536 };
const exit = shape({ ...base, run: text, expected: text, proposer: recordRef, standing: ref, frontier: vectorText, at: clock, kind: text,
  exitTest, check: ref, evidence: list(recordRef), result: recordRef, settledOperations: list(text) });
export const runShapes: Readonly<Record<string, OwnedShape>> = {
  RunBudget: budget, RunStep: step, RunExit: exit,
  Run: shape({ ...base, opening: ref, intent: recordRef, directives: list(recordRef), owner: recordRef, scope,
    authority: shape({ resolution: ref, grants: list(recordRef) }), exitTest, budget, cadence: shape({ bound: text, milliseconds: integer }),
    nextWake: wake, blockedOn: blocked, resultDestination: destination, generation: ref, createdAt: clock, depth: integer }),
  RunTransition: shape({ ...base, run: text, expected: text, trigger: ref, kind: text, from: text, to: text, responsible: recordRef,
    standing: ref, ownership: ref, generation: ref, at: clock, blockedOn: blocked, nextWake: wake,
    step, grounding: ref, affectedStep: text, outcome: recordRef, settlement: ref, exit }, ['step', 'grounding', 'affectedStep', 'outcome', 'settlement', 'exit']),
  SessionGrounding: shape({ ...base, run: text, expected: text, worker: text, harness: text, reason: text, step: text, incarnation: text, contextDeliveryReason: text, ownership: ref, executionContext: ref, at: clock, previousActivity: clock, elapsed: measurement,
    principal: recordRef, intake: ref, binding: ref, directives: list(recordRef), generation: ref, frontier: vectorText,
    knownLineages: list(text), threshold: integer, messages: list(shape({ fact: ref, sequence: integer, capture: text, hash: text })),
    lastInbound: ref, pendingOperations: list(text), children: list(text), receipts: list(text), briefingClasses: list(text), consumption: ref }, ['step', 'incarnation', 'contextDeliveryReason']),
};
function checkShape(input: Json, policy: OwnedShape): void {
  if (policy.kind === 'text') { need(typeof input === 'string' && input.length > 0 && input.length <= policy.maxLength, 'bounded nonempty text required'); return; }
  if (policy.kind === 'integer') { need(typeof input === 'number' && Number.isSafeInteger(input) && input >= 0, 'nonnegative safe integer required'); return; }
  if (policy.kind === 'array') { need(Array.isArray(input) && input.length <= policy.maxLength, 'bounded list required'); input.forEach(v => checkShape(v, policy.items)); return; }
  need(policy.kind === 'object', 'unimplemented run field policy');
  const v = object(input); need(Object.keys(v).every(k => Object.hasOwn(policy.fields, k)), 'unknown run field');
  for (const [k, p] of Object.entries(policy.fields)) { if (v[k] === undefined && policy.optional?.includes(k)) continue; need(v[k] !== undefined, `missing required field ${k}`); checkShape(v[k]!, p); }
}
export function factReference(input: Json, context: RunDecodeContext): FactEnvelope {
  const r = object(input); need(r.owner === 'part-two' && r.name === 'FactEnvelope' && typeof r.id === 'string', 'fact reference owner/name required');
  const fact = context.facts.facts.find(f => f.id === r.id); need(fact, `admitted fact unavailable: ${r.id}`); return fact;
}
export function constitutional<N extends keyof Inventory>(reference: ConstitutionalReference<N>, type: N, context: RunDecodeContext): HistoricalRead<Inventory[N]> {
  need(reference.type === type, `expected ${type} reference`);
  const fact = factReference(json(reference.fact), context);
  const body = take(decodeHistoricalBody(fact, context.facts, causalStanding(fact, context.facts, false).decode));
  const record = body.fields[reference.field];
  need(record && typeof record === 'object' && body.records.includes(record as HistoricalRead<Inventory[N]>), 'reference must select an owner-decoded constitutional field');
  const read = record as HistoricalRead<Inventory[N]>;
  need(read.view.type === type && (!('id' in read.view) || read.view.id === reference.id), 'constitutional reference identity differs');
  need(read.captureStatus === 'available', 'evidence-unavailable: referenced constitutional capture'); return read;
}
function reference(r: Json, owner: string, name: string): void { const v = object(r); need(v.owner === owner && v.name === name, `${name}: wrong reference owner`); }
function principal(r: Json, c: RunDecodeContext): void {
  const p = constitutional(r as unknown as ConstitutionalReference<'VerifiedPrincipal'>, 'VerifiedPrincipal', c);
  need(p.view.kind === 'agent' || p.view.kind === 'system', 'accountable owner must be verified agent or system');
  need(p.view.provenance.class === 'verified', 'accountable owner requires verified origin');
}
function generation(v: Json, c: RunDecodeContext): void {
  reference(v, 'part-three', 'RegisterGeneration'); need(same(v, c.types.register.generation), 'generation does not match pinned register');
}
function blockedOn(v: Json, c: RunDecodeContext): void {
  const b = object(v);
  if (b.kind === 'nothing') need(Object.keys(b).length === 1, 'nothing cannot hide an obligation');
  else { need(['step', 'recovery', 'resource', 'stop', 'evidence'].includes(String(b.kind)), 'out of slice scope: blocked-on kind');
    need(b.reference && b.owner && b.nextObservation, 'owned inhibit requires reference and next observation'); principal(b.owner, c); take(decodeMeasurement('clock', b.nextObservation, c.types)); }
}
function validateExitTest(v: Json, c: RunDecodeContext): void {
  const e = object(v); need(c.types.register.entries.includes(String(e.check)), 'exit check is not registered');
  need(/^sha256:[a-f0-9]{64}$/.test(String(e.acceptance)) && Number(e.freshFor) > 0 && (e.evidenceKinds as Json[]).length > 0, 'exit test requires exact conditions, evidence and freshness');
}
function validateDestination(v: Json, c: RunDecodeContext): void { const d = object(v); reference(d.binding!, 'part-four', 'ConversationBinding'); factReference(d.route!, c); }
function decodeRecord(name: string, input: Json, c: RunDecodeContext): Json {
  const v = object(input), policy = runShapes[name]; need(policy && v.type === name && v.schemaVersion === (name === 'SessionGrounding' ? 2 : 1), 'type or schema version unknown');
  // Canonical vector text is a bounded wire encoding of P2's vector, not a rival vector.
  checkShape(input, policy);
  for (const field of ['at', 'createdAt', 'previousActivity', 'safetyCeiling']) if (v[field]) v[field] = json(take(decodeMeasurement('clock', v[field], c.types)));
  if (v.generation) generation(v.generation, c);
  if (v.nextWake) { const w = object(v.nextWake); principal(w.owner!, c); take(decodeMeasurement('clock', w.at, c.types)); }
  if (v.blockedOn) blockedOn(v.blockedOn, c);
  if (v.resultDestination) validateDestination(v.resultDestination, c);
  if (v.exitTest) validateExitTest(v.exitTest, c);
  if (name === 'RunBudget') {
    const bounds = v.bounds as string[]; need(bounds.length > 0 && bounds.every(b => c.types.register.entries.includes(b)), 'budget requires registered bounds');
    reference(v.repetitionPolicy!, 'part-six', 'LoopPolicy'); principal(v.exhaustedOwner!, c);
    need(Number(v.maxChildren) <= INITIAL_MAX_CHILDREN && Number(v.maxDepth) <= INITIAL_MAX_DEPTH && Number(v.maxAttempts) <= INITIAL_MAX_ATTEMPTS, 'operator-set graph/retry ceiling exceeded');
    need(Number(v.maxOutstanding) > 0 && Number(v.maxDepth) > 0, 'budget must name finite root capacity');
    const resources = v.resources as Json[]; need(resources.length > 0, 'budget resources required');
    v.resources = resources.map(r => { const kind = String(object(object(r).subject).kind); const m = take(decodeMeasurement(kind, r, c.types));
      need(kind !== 'clock' && m.subject.instance === v.id && m.value >= 0, 'budget measurement subject mismatch'); return json(m); });
  } else if (name === 'Run') {
    const opening = factReference(v.opening!, c); need(c.stimulusKinds.includes(opening.kind), 'opening must be an admitted stimulus');
    need(v.id === runIdFor(v.opening), 'root identity must be derived from opening cause');
    const intent = constitutional(v.intent as unknown as ConstitutionalReference<'Intent'>, 'Intent', c);
    need(object(object(v.intent).fact).id === opening.id, 'intent must come from opening admission');
    if (opening.kind === 'intake-admitted') {
      const resolved = take(resolveIntakeOwner(opening, c));
      need(same(v.owner, resolved.owner) && same(v.intent, resolved.intent), 'run changed resolved intake accountability');
    } else need(object(object(v.owner).fact).id === opening.id, 'owner must come from opening admission');
    principal(v.owner!, c); v.scope = json(take(decode('Scope', v.scope, c.types)));
    const declared = c.facts.schemas.find(s => s.kind === opening.kind && s.version === opening.schemaVersion); need(declared && scopeIncludes(declared.scope, take(decode('Scope', v.scope, c.types))), 'run scope exceeds admitted stimulus scope');
    const directives = v.directives as unknown as ConstitutionalReference<'Directive'>[];
    need(same(directives.map(d => d.id).sort(), [...intent.view.under].sort()), 'run must retain the exact intent directive lineage'); directives.forEach(d => constitutional(d, 'Directive', c));
    const auth = object(v.authority); factReference(auth.resolution!, c); (auth.grants as unknown as ConstitutionalReference<'StandingGrant'>[]).forEach(g => constitutional(g, 'StandingGrant', c));
    v.budget = decodeRecord('RunBudget', v.budget!, c); need(v.depth === 1, 'out of slice scope: non-root depth');
    const cadence = object(v.cadence); need(c.types.register.entries.includes(String(cadence.bound)) && Number(cadence.milliseconds) > 0, 'registered bounded cadence required');
  } else if (name === 'RunStep') {
    need(['compute', 'effect', 'ground', 'evaluate-exit'].includes(String(v.kind)), 'out of slice scope: step kind');
    const operation = object(v.operation); need(/^sha256:[a-f0-9]{64}$/.test(String(operation.digest)), 'exact operation digest required'); factReference(operation.classification!, c);
    reference(v.ownership!, 'part-six', 'Lease'); reference(object(v.allocation).reservation!, 'part-six', 'AdmissionReservation');
    (v.evidence as Json[]).forEach(r => factReference(r, c));
    (v.directives as unknown as ConstitutionalReference<'Directive'>[]).forEach(r => constitutional(r, 'Directive', c));
    (v.authorizations as unknown as ConstitutionalReference<'Authorization'>[]).forEach(r => constitutional(r, 'Authorization', c));
  } else if (name === 'RunTransition') {
    need(['start', 'observe', 'recover', 'stop', 'resume', 'propose-exit', 'close'].includes(String(v.kind)), 'out of slice scope: transition kind');
    principal(v.responsible!, c); factReference(v.standing!, c); factReference(v.trigger!, c); reference(v.ownership!, 'part-six', 'Lease');
    if (v.step) v.step = decodeRecord('RunStep', v.step, c);
    if (v.exit) v.exit = decodeRecord('RunExit', v.exit, c);
    if (v.grounding) factReference(v.grounding, c);
    if (v.outcome) constitutional(v.outcome as unknown as ConstitutionalReference<'Outcome'>, 'Outcome', c);
    if (v.settlement) factReference(v.settlement, c);
  } else if (name === 'RunExit') {
    need(v.kind === 'completed', 'out of slice scope: unreachable/cancelled exit'); principal(v.proposer!, c); factReference(v.standing!, c); factReference(v.check!, c);
    (v.evidence as unknown as ConstitutionalReference<'Evidence'>[]).forEach(r => constitutional(r, 'Evidence', c));
    constitutional(v.result as unknown as ConstitutionalReference<'Result'>, 'Result', c);
  } else if (name === 'SessionGrounding') {
    reference(v.ownership!, 'part-six', 'Lease'); factReference(v.executionContext!, c);
    principal(v.principal!, c); factReference(v.intake!, c); factReference(v.lastInbound!, c); factReference(v.consumption!, c); reference(v.binding!, 'part-four', 'ConversationBinding');
    need(['start', 'recovery', 'resume'].includes(String(v.reason)), 'out of slice scope: compaction accounting');
    if (v.contextDeliveryReason !== undefined) need(['initial', 'live-input', 'compaction'].includes(String(v.contextDeliveryReason)), 'unknown context delivery reason');
    need((v.children as Json[]).length === 0, 'out of slice scope: child grounding');
    const elapsed = take(decodeMeasurement('elapsed-time', v.elapsed, c.types));
    const now = take(decodeMeasurement('clock', v.at, c.types)), previous = take(decodeMeasurement('clock', v.previousActivity, c.types));
    need(now.subject.instance === previous.subject.instance, 'cross-machine clock uncertainty requires owner observation; out of slice scope');
    need(elapsed.unit === 'ms' && elapsed.subject.instance === v.worker && elapsed.value === take(compareMeasurements<'clock'>(now, previous, c.preserved)) && elapsed.value >= 0, 'grounding elapsed measurement differs');
    v.elapsed = json(elapsed);
  }
  return freeze(v);
}
// Vector serialization is internal to the fact-body adapter. Public records retain
// P2's CausalFrontier type; exact canonical bytes are enforced in both directions.
function toWire(input: Json): Json {
  if (Array.isArray(input)) return input.map(toWire);
  if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, key === 'frontier' ? encoded(value).bytes : toWire(value)]));
  return input;
}
function fromWire(input: Json): Json {
  if (Array.isArray(input)) return input.map(fromWire);
  if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input).map(([key, value]) => {
    if (key !== 'frontier') return [key, fromWire(value)];
    need(typeof value === 'string', 'canonical frontier bytes required'); const vector = object(JSON.parse(value) as Json); need(encoded(vector).bytes === value, 'noncanonical frontier');
    for (const p of Object.values(vector)) { const o = object(p); need(Object.keys(o).sort().join(',') === 'epoch,position' && [o.epoch, o.position].every(n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0), 'invalid P2 frontier'); }
    return [key, vector];
  }));
  return input;
}
export const runIdFor = (opening: unknown): string => `run:${encoded(opening).hash}`;
/** Consume P4's actual IntakeWork through its installed P2 owner decoder. The
 * opaque owner key resolves only through trusted installation context. No new
 * stimulus, principal, authority, or altered intake cause is authored here. */
export function resolveIntakeOwner(admitted: FactEnvelope, c: RunDecodeContext): Result<{
  opening: import('../index.js').FactEnvelopeReference;
  intent: ConstitutionalReference<'Intent'>;
  owner: import('./types.js').PrincipalReference;
}> {
  return boundary('ResolveIntakeOwner', admitted, c, () => {
    const opening = { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: admitted.id };
    const original = factReference(json(opening), c);
    need(same(original, admitted) && original.kind === 'intake-admitted', 'actual admitted intake fact required');
    const schema = c.facts.schemas.find(s => s.kind === original.kind && s.version === original.schemaVersion);
    const workField = schema?.fields.work;
    need(workField?.kind === 'owned' && workField.owner === 'part-four' && workField.name === 'IntakeWork', 'part-four IntakeWork owner decoder required');
    const body = take(decodeHistoricalBody(original, c.facts, causalStanding(original, c.facts, false).decode));
    need(body.taint.length === 0, 'intake resolution evidence unavailable');
    const work = object(json(body.fields.work));
    need(typeof work.owner === 'string' && work.blockedOn === 'run-admission' && work.standing === 'requester', 'admitted requester work must await run admission');
    const owner = c.intakeOwners?.[work.owner]; need(owner, 'accountable intake owner is unresolved');
    principal(json(owner), c);
    const rawIntent = object(object(original.body).intent);
    need(typeof rawIntent.id === 'string', 'admitted Intent identity required');
    const intent = { type: 'Intent' as const, id: rawIntent.id, fact: opening, field: 'intent' };
    constitutional(intent, 'Intent', c);
    return { opening, intent, owner };
  });
}
function decoded<T>(name: string, input: unknown, c: RunDecodeContext): Result<T> {
  // P5's own brand does not mint P1 values. Restore every embedded measurement
  // and Scope through its owner's public decoder after validating the wire tree.
  const hydrate = (v: Json): unknown => {
    if (Array.isArray(v)) return v.map(hydrate);
    if (v && typeof v === 'object') {
      const o = object(v);
      if (o.type === 'Scope') return take(decode('Scope', o, c.types));
      if (o.type === 'Measurement') return take(decodeMeasurement(String(object(o.subject).kind), o, c.types));
      return Object.fromEntries(Object.entries(o).map(([k, value]) => [k, hydrate(value)]));
    } return v;
  };
  return boundary(`Decode${name}`, input, c, v => hydrate(fromWire(decodeRecord(name, toWire(v), c))) as T);
}
export const decodeRun = (v: unknown, c: RunDecodeContext): Result<Run> => decoded('Run', v, c);
export const decodeRunBudget = (v: unknown, c: RunDecodeContext): Result<RunBudget> => decoded('RunBudget', v, c);
export const decodeRunStep = (v: unknown, c: RunDecodeContext): Result<RunStep> => decoded('RunStep', v, c);
export const decodeRunTransition = (v: unknown, c: RunDecodeContext): Result<RunTransition> => decoded('RunTransition', v, c);
export const decodeRunExit = (v: unknown, c: RunDecodeContext): Result<CompletedRunExit> => decoded('RunExit', v, c);
export const decodeSessionGrounding = (v: unknown, c: RunDecodeContext): Result<SessionGrounding> => decoded('SessionGrounding', v, c);
export const recordWire = (record: RunRecord): Json => toWire(json(record));
export const recordFromWire = (record: Json): Json => fromWire(record);
export const runKinds = { Run: 'run-opening', RunTransition: 'run-transition', SessionGrounding: 'session-grounding' } as const;
export function runFactSchemas(context: RunDecodeContext): Result<{ schemas: readonly FactSchema[]; registrations: readonly OwnedBodyRegistration[] }> {
  return boundary('RunFactSchemas', null, context, () => {
    const registrations = Object.keys(runKinds).map(name => take(registerOwnedBody({ owner: 'part-five', name, currentVersion: name === 'SessionGrounding' ? 2 : 1,
      versions: { 1: { validate: value => name === 'SessionGrounding' ? { ok: false, detail: 'legacy grounding lacks execution context; re-ground required' } : { ok: true, value } },
        ...(name === 'SessionGrounding' ? { 2: { validate: (value: Json) => ({ ok: true as const, value }) } } : {}) },
      migrations: name === 'SessionGrounding' ? { 1: () => { throw new Error('grounding ownership cannot be inferred by migration'); } } : {}, decodeCurrent: (value, c) => {
        const local = { ...context, types: c.facts.decode, facts: c.facts };
        const record = decodeRecord(name, value, local);
        const cone = new Set(causalCone(c.origin, c.facts.facts).map(f => f.id));
        need(recordReferences(record).every(id => cone.has(id)), 'run record reference is outside signed causal cone');
        return { ok: true, value: record };
      } }, runShapes[name]!, context)));
    const first = context.facts.schemas.find(s => context.stimulusKinds.includes(s.kind)); need(first, 'stimulus schema required for run installation');
    const schemas = Object.entries(runKinds).map(([name, kind]): FactSchema => ({ kind, version: 1,
      fields: { run: { kind: 'text', maxLength: 1024 }, record: { kind: 'owned', owner: 'part-five', name } },
      machineScope: 'shared', standing: 'requester', action: first.action, scope: first.scope, causallyBound: true, requiredReferences: [], authority: 'none' }));
    return { schemas, registrations };
  });
}
export function recordReferences(record: Json): readonly string[] {
  const ids = new Set<string>();
  const walk = (v: Json): void => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') {
    const o = object(v); if (o.owner === 'part-two' && o.name === 'FactEnvelope' && typeof o.id === 'string') ids.add(o.id);
    Object.values(o).forEach(walk);
  } }; walk(record); return [...ids].sort();
}
