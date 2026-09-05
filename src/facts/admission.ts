// Rules 28/31/33/90; P2-NF-23..28, 32..33, 72, 77.
import { decode, defineDecoder, grantLiveness, historicalGrantLiveness, rehydrateConflict, rehydrateOutcome, rehydrateResult, scopeIncludes } from '../index.js';
import type { Clock, ConstitutionalValue, DecodeContext, Json, Result, VerifiedPrincipal, UnresolvedInput } from '../index.js';
import { boundary, encoding, fields, integer, object, requireFact, same, string, take } from './boundary.js';
import type { AuthorityTaint, FactContext, FactEnvelope, FactSchema } from './contracts.js';
import { contextBoundary } from './contracts.js';
import { comparePosition, schemaFor, hashBytes } from './envelope.js';
import { decodeOwnedBody } from './owned.js';

export function causalCone(fact: FactEnvelope, facts: readonly FactEnvelope[]): readonly FactEnvelope[] {
  const byId = new Map(facts.map(f => [f.id, f]));
  const found = new Map<string, FactEnvelope>(), visiting = new Set<string>();
  const visit = (f: FactEnvelope) => {
    requireFact(!visiting.has(f.id) && f.id !== fact.id, 'causal cycle');
    if (found.has(f.id)) return;
    visiting.add(f.id);
    for (const id of [f.predecessors.inSegment, ...f.predecessors.required]) if (id !== null) {
      const p = byId.get(id); requireFact(p, `dangling causal reference: ${id}`); visit(p);
    }
    for (const [machine, head] of Object.entries(f.predecessors.frontier)) {
      const p = facts.find(p => p.machine === machine && comparePosition(p.segment, head) === 0);
      requireFact(p, `dangling frontier: ${machine}`); visit(p);
    }
    visiting.delete(f.id); found.set(f.id, f);
  };
  for (const id of [fact.predecessors.inSegment, ...fact.predecessors.required]) if (id !== null) {
    const p = byId.get(id); requireFact(p, `dangling causal reference: ${id}`); visit(p);
  }
  for (const [machine, head] of Object.entries(fact.predecessors.frontier)) {
    const p = facts.find(p => p.machine === machine && comparePosition(p.segment, head) === 0);
    requireFact(p, `dangling frontier: ${machine}`); visit(p);
  }
  return [...found.values()];
}
export function extendsChain(fact: FactEnvelope, context: FactContext): void {
  const sameId = context.facts.find(f => f.id === fact.id);
  requireFact(!sameId, 'id already admitted; origin may not reuse ids');
  const owned = context.facts.filter(f => f.machine === fact.machine).sort((a, b) => comparePosition(a.segment, b.segment));
  const head = owned.at(-1);
  if (!head) requireFact(fact.segment.epoch === 0 && fact.segment.position === 0 && fact.prevInSegment === context.genesis.hash, 'invalid genesis link');
  else if (fact.segment.epoch === head.segment.epoch) {
    requireFact(fact.segment.position === head.segment.position + 1 && fact.predecessors.inSegment === head.id && fact.prevInSegment === head.contentHash, 'segment gap or fork', 'integrity');
  } else {
    requireFact(fact.segment.epoch === head.segment.epoch + 1 && fact.segment.position === 0 && fact.prevInSegment === head.contentHash, 'successor epoch must bind previous closing head', 'integrity');
    requireFact(Object.entries(fact.predecessors.frontier).some(([m, p]) => m === head.machine && comparePosition(p, head.segment) === 0), 'successor epoch must retain causal lineage');
  }
}

export function causalStanding(fact: FactEnvelope, context: FactContext, origin: boolean): { now: Clock; taint: readonly AuthorityTaint[]; decode: DecodeContext } {
  const schema = schemaFor(context, fact.kind, fact.schemaVersion), cone = causalCone(fact, context.facts);
  const ids = new Set(cone.map(f => f.id));
  for (const id of schema.requiredReferences) requireFact(fact.predecessors.required.includes(id), 'missing registry-declared causal reference');
  const grants = context.grants.filter(r => ids.has(r.factId)).map(r => r.grant);
  const revocations = context.revocations.filter(r => ids.has(r.factId)).map(r => r.revocation);
  // G2 mapping: now is the maximum governed time-anchor inside this cone (or the pinned
  // genesis clock). A time-anchor must be an admitted operator fact; arbitrary fact.at,
  // receipt time, and out-of-cone anchors cannot change the answer. Existing revocations
  // in the cone take effect causally even if their wall-clock testimony is in the future.
  // The minimal-plane provider supplies anchors; this checks each against actual cone state.
  let now = context.genesis.clock;
  for (const anchor of context.timeAnchors) {
    const f = cone.find(f => f.id === anchor.factId);
    if (!f) continue;
    const declared = schemaFor(context, f.kind, f.schemaVersion);
    requireFact(f.kind === 'time-anchor' && declared.standing === 'operator' && f.provenance.class === 'verified', 'time anchor lacks governed operator origin', 'standing');
    causalStanding(f, context, false);
    const body = object(f.body);
    requireFact(same(body.clock, anchor.clock), 'time anchor differs from recorded body', 'integrity');
    if (anchor.clock.value > now.value) now = anchor.clock;
  }
  const scoped = context.grants.filter(g => fact.predecessors.required.includes(g.factId) && scopeIncludes(g.grant.scope, schema.scope));
  const historicalRevocations = (context.historicalRevocations ?? []).filter(r => ids.has(r.factId)).map(r => r.revocation);
  const historical = (context.historicalGrants ?? []).filter(g => fact.predecessors.required.includes(g.factId)
    && scopeIncludes(take(decode('Scope', g.grant.view.scope, context.decode)), schema.scope));
  if (schema.standing !== 'requester') {
    requireFact(schema.causallyBound && scoped.length + historical.length > 0, 'standing-gated kind must name grant references');
    requireFact(fact.provenance.class === 'verified', 'verified provenance required above requester', 'standing');
    const grant = scoped.find(r => ids.has(r.factId) && r.grant.grantee.id === fact.principal.id
      && (schema.standing !== 'operator' || r.grant.standing === 'operator')
      && (r.grant.standing === 'operator' || r.grant.actions.includes(schema.action))
      && !revocations.some(v => v.grantId === r.grant.id)
      && !historicalRevocations.some(v => v.view.grantId === r.grant.id)
      && grantLiveness(r.grant, revocations, now) === 'live');
    const historicalGrant = historical.find(r => ids.has(r.factId) && r.grant.view.grantee.id === fact.principal.id
      && (schema.standing !== 'operator' || r.grant.view.standing === 'operator')
      && (r.grant.view.standing === 'operator' || r.grant.view.actions.includes(schema.action))
      && !revocations.some(v => v.grantId === r.grant.view.id)
      && take(historicalGrantLiveness(r.grant, historicalRevocations, now, context.preserved)) === 'live');
    requireFact(grant || historicalGrant, 'no live covering standing in declared causal cone', 'standing');
  }
  if (schema.authority === 'conferring') requireFact(schema.standing !== 'requester' && fact.provenance.class === 'verified', 'requester cannot confer authority', 'standing');
  // Bound directive exercise is reserved for part four's binding port; no local substitute.
  requireFact(!(schema.authority === 'directive' && fact.provenance.class === 'channel-attested'), 'part-four bound directive admission port required', 'standing');
  const grantIds = [...scoped.map(g => g.grant.id), ...historical.map(g => g.grant.view.id)];
  const relevant = [...context.revocations.map(v => ({ factId: v.factId, grantId: v.revocation.grantId })),
    ...(context.historicalRevocations ?? []).map(v => ({ factId: v.factId, grantId: v.revocation.view.grantId }))].filter(v => grantIds.includes(v.grantId) && !ids.has(v.factId));
  if (origin) for (const r of relevant) {
    const rev = context.facts.find(f => f.id === r.factId), folded = rev && context.folded[rev.machine];
    requireFact(!rev || !folded || comparePosition(rev.segment, folded) > 0, 'origin frontier omitted an already-folded relevant revocation', 'standing');
  }
  return { now, taint: relevant.length ? ['provisional'] : [], decode: { ...context.decode, now, grants, revocations } };
}

export function validateSchemas(schemas: readonly FactSchema[], context: FactContext): Result<readonly FactSchema[]> {
  return boundary('FactSchemaRegistry', schemas, contextBoundary(context), raw => {
    requireFact(Array.isArray(raw), 'schema registry must be list');
    const unique = new Set<string>();
    for (const item of raw) {
      const s = object(item); const key = `${string(s.kind, 'kind')}:${integer(s.version, 'version', 1)}`;
      requireFact(!unique.has(key), 'duplicate schema'); unique.add(key);
      requireFact(s.machineScope === 'shared', 'machine-local fact schema forbidden');
      requireFact(['requester', 'delegate', 'operator'].includes(string(s.standing, 'standing')), 'unknown standing');
      requireFact(s.standing === 'requester' || s.causallyBound === true, 'standing kind must be causally bound');
      for (const definition of Object.values(object(s.fields ?? null))) {
        const f = object(definition);
        requireFact(['text', 'integer', 'exact', 'boolean', 'reference', 'capture', 'constitutional', 'owned'].includes(string(f.kind, 'field.kind')), 'undeclared/secret-valued field');
        if (f.kind === 'owned') { string(f.owner, 'owner'); string(f.name, 'name'); }
        if (f.kind === 'text') integer(f.maxLength, 'maxLength', 1);
        if (f.kind === 'exact') string(f.unit, 'unit');
      }
    }
    return schemas;
  });
}
const bodyManifests = new WeakMap<object, readonly { readonly field: string; readonly value: ConstitutionalValue }[]>();
export function bodyConstitutionalFields(body: object) { return bodyManifests.get(body) ?? []; }
export function decodeBody(fact: FactEnvelope, context: FactContext, decoderContext: DecodeContext): Result<Readonly<Record<string, Json | ConstitutionalValue>>> {
  return boundary('FactBody', fact.body, contextBoundary(context), raw => {
    const migrated = migrateBody(fact, context, raw);
    const schema = schemaFor(context, fact.kind, migrated.version), body = object(migrated.body);
    fields(body, Object.keys(schema.fields).filter(k => !schema.optional?.includes(k)), schema.optional);
    const out: Record<string, Json | ConstitutionalValue> = {};
    const manifest: { field: string; value: ConstitutionalValue }[] = [];
    for (const [name, field] of Object.entries(schema.fields)) {
      const value = body[name]; if (value === undefined && schema.optional?.includes(name)) continue;
      requireFact(value !== undefined, `missing body field ${name}`);
      if (field.kind === 'owned') { out[name] = decodeOwnedBody(field.owner, field.name, value, fact, 'origin', context).value; continue; }
      if (field.kind === 'text') requireFact(typeof value === 'string' && value.length <= field.maxLength, `${name}: text exceeds declared bound`);
      if (field.kind === 'integer') requireFact(typeof value === 'number' && Number.isSafeInteger(value), `${name}: integer required`);
      if (field.kind === 'exact') requireFact(typeof value === 'string' && /^-?(0|[1-9][0-9]*)$/.test(value), `${name}: exact integer minor units required`);
      if (field.kind === 'boolean') requireFact(typeof value === 'boolean', `${name}: boolean required`);
      if (field.kind === 'reference') string(value, name);
      if (field.kind === 'capture') {
        const ref = object(value); fields(ref, ['reference', 'hash']);
        const capture = context.captures[string(ref.reference, name)];
        requireFact(capture && capture.status === 'available' && capture.bytes !== null && capture.hash === ref.hash && hashBytes(capture.bytes) === ref.hash, 'capture reference does not resolve', 'integrity');
      }
      if (field.kind === 'constitutional') {
        // P1 producers are always used. A body's authority record must have its own pinned
        // authentication context matching the fact; an arbitrary second provenance is refused.
        const pinned = context.decode.provenance && same(context.decode.provenance, fact.provenance) ? context.decode.provenance
          : context.decode.principals?.find(p => same(p.provenance, fact.provenance))?.provenance;
        requireFact(pinned, 'pinned live provenance unavailable; historical body seam required', 'standing');
        const c = { ...decoderContext, provenance: pinned };
        let decoded: ConstitutionalValue;
        if (field.type === 'Outcome') decoded = take(rehydrateOutcome(value, c));
        else if (field.type === 'Conflict') decoded = take(rehydrateConflict(value, c));
        else if (field.type === 'Result') {
          // Payload JSON is validated by its own schema; rehydration never reconstructs by cast.
          const recorded = take(rehydrateResult(value, c, payload => boundary('RecordedPayload', payload, contextBoundary(context), x => x)));
          decoded = recorded;
        } else decoded = take(decode(field.type, value, c));
        out[name] = decoded; manifest.push({ field: name, value: decoded });
      } else out[name] = value;
    }
    bodyManifests.set(out, manifest); return out;
  });
}

export function migrateBody(fact: FactEnvelope, context: FactContext, body: Json): { body: Json; version: number } {
  const schemas = context.schemas.filter(s => s.kind === fact.kind);
  const current = Math.max(...schemas.map(s => s.version));
  const versions = Object.fromEntries(schemas.map(s => [s.version, { validate: (input: Json) => {
    const raw = object(input), payload = object(raw.body ?? null);
    fields(payload, Object.keys(s.fields).filter(k => !s.optional?.includes(k)), s.optional);
    return { ok: true as const, value: input };
  } }]));
  const migrations = Object.fromEntries((context.migrations ?? []).filter(m => m.kind === fact.kind).map(m => {
    requireFact(m.to === m.from + 1, 'migration must advance one version');
    return [m.from, (input: Json) => ({ ...object(input), schemaVersion: m.to, body: m.migrate(object(input).body!) })];
  }));
  const decoder = take(defineDecoder<Json, ReturnType<typeof contextBoundary>>({ name: `Body:${fact.kind}`, owner: 'part-two', currentVersion: current, versions, migrations,
    decodeCurrent: input => ({ ok: true, value: object(input).body! }) }, context.preserved));
  // Admission has already verified original hashes/signatures; migrations cannot affect them.
  return { body: take(decoder.decode({ type: `Body:${fact.kind}`, schemaVersion: fact.schemaVersion, body }, contextBoundary(context))), version: current };
}

export function validateRepair(fact: FactEnvelope, context: FactContext): void {
  const body = object(fact.body), correction = body.corrects !== undefined;
  requireFact(fact.kind !== 'correction', 'correction must be the original kind with corrects');
  if (fact.kind !== 'retraction' && !correction) return;
  const targetId = string(correction ? body.corrects : body.target, correction ? 'corrects' : 'target');
  const target = context.facts.find(f => f.id === targetId); requireFact(target, 'repair target missing');
  if (fact.kind === 'retraction') string(body.reason, 'reason');
  requireFact(!correction || fact.kind === target.kind, 'correction must name same-kind original');
  requireFact(causalCone(fact, context.facts).some(f => f.id === target.id), 'repair must causally follow target');
  const original = schemaFor(context, target.kind, target.schemaVersion), repair = schemaFor(context, fact.kind, fact.schemaVersion);
  const rank = { requester: 0, delegate: 1, operator: 2 };
  requireFact(rank[repair.standing] >= rank[original.standing] && scopeIncludes(repair.scope, original.scope), 'repair has less standing than target', 'standing');
  if (original.authority === 'conferring') requireFact(repair.standing === 'operator', 'authority repair requires original grant standing', 'standing');
  const seen = new Set([fact.id]); let current: FactEnvelope | undefined = target;
  while (current) {
    requireFact(!seen.has(current.id), 'repair cycle'); seen.add(current.id);
    const body = object(current.body); const next: Json | undefined = current.kind === 'retraction' ? body.target : body.corrects;
    current = context.facts.find(f => f.id === next);
  }
}

export function wrapUnresolved(input: unknown, observer: VerifiedPrincipal, context: FactContext): Result<{ kind: 'unattributable-observation'; principal: VerifiedPrincipal; body: { input: UnresolvedInput } }> {
  return boundary('UnattributableObservation', input, contextBoundary(context), raw => {
    requireFact(observer.kind === 'system' && context.decode.principals?.some(p => same(p, observer)), 'observation requires decoded system principal', 'standing');
    const unresolved = take(decode('UnresolvedInput', raw, context.decode));
    return { kind: 'unattributable-observation', principal: observer, body: { input: unresolved } };
  });
}
