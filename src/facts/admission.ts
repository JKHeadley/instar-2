// Rules 28/31/33/90; P2-NF-23..28, 32..33, 72, 77.
import { decode, defineDecoder, grantLiveness, historicalGrantLiveness, rehydrateConflict, rehydrateOutcome, rehydrateResult, scopeIncludes } from '../index.js';
import type { Clock, ConstitutionalValue, DecodeContext, Json, Result, VerifiedPrincipal, UnresolvedInput } from '../index.js';
import { boundary, encoding, fields, integer, object, requireFact, same, string, take } from './boundary.js';
import type { AuthorityTaint, CausalFrontier, FactContext, FactEnvelope, FactSchema, LineagePosition } from './contracts.js';
import { contextBoundary } from './contracts.js';
import { comparePosition, factId, schemaFor, hashBytes } from './envelope.js';
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
// Occam cut #3: "is X in this fact's history?" by position, not by materializing the cone. Where
// every machine's facts form one gapless signed chain (the shape extendsChain admits), a fact's
// history on machine m is exactly m's chain up to the highest m-position it reaches, so a vector of
// those positions answers membership, and each vector position's contentHash (which the chain's
// prevInSegment links bind back to genesis) identifies the history. Any list outside that shape, or
// any dangling reference or cycle, answers undefined and the caller walks the cone as before, so
// refusals and answers are unchanged. One index serves one operation; nothing outlives it.
export interface CausalIndex {
  readonly byId: ReadonlyMap<string, FactEnvelope>;
  /** Highest position reached per machine, or undefined when only the walk can answer. */
  frontierOf(fact: FactEnvelope): CausalFrontier | undefined;
  /** causalCone(fact).length, or undefined when only the walk can answer. */
  coneSize(fact: FactEnvelope): number | undefined;
  /** The contentHash at each reached machine's head: binds the whole history through the chain links. */
  coneHeads(fact: FactEnvelope): readonly string[] | undefined;
}
export function causalIndex(facts: readonly FactEnvelope[]): CausalIndex {
  const byId = new Map<string, FactEnvelope>(), at = new Map<string, FactEnvelope>(), chains = new Map<string, FactEnvelope[]>();
  const broken = new Set<string>();
  for (const f of facts) {
    const key = factId(f.segment);
    if (byId.has(f.id) || f.id !== key || f.machine !== f.segment.machine) broken.add(f.machine);
    byId.set(f.id, f); if (!at.has(key)) at.set(key, f);
    const chain = chains.get(f.machine); if (chain) chain.push(f); else chains.set(f.machine, [f]);
  }
  const rank = new Map<string, number>();
  for (const [machine, chain] of chains) {
    const sorted = [...chain].sort((a, b) => comparePosition(a.segment, b.segment));
    sorted.forEach((f, i) => {
      rank.set(f.id, i);
      const prev = sorted[i - 1];
      const linked = !prev ? f.segment.epoch === 0 && f.segment.position === 0 && f.predecessors.inSegment === null
        : f.prevInSegment !== prev.contentHash ? false
        : f.segment.epoch === prev.segment.epoch ? f.segment.position === prev.segment.position + 1 && f.predecessors.inSegment === prev.id
          : f.segment.epoch === prev.segment.epoch + 1 && f.segment.position === 0 && f.predecessors.inSegment === null
            && Object.hasOwn(f.predecessors.frontier, machine) && comparePosition(f.predecessors.frontier[machine]!, prev.segment) === 0;
      if (!linked) broken.add(machine);
    });
  }
  const vectors = new Map<string, CausalFrontier | null>(), visiting = new Set<string>();
  // Only list members are remembered (by id); any other object, even one sharing an id, is
  // computed from its own signed references.
  const compute = (fact: FactEnvelope): CausalFrontier | null => {
    const refs = [...[fact.predecessors.inSegment, ...fact.predecessors.required].map(id => id === null ? null : byId.get(id)),
      ...Object.entries(fact.predecessors.frontier).map(([m, p]) => at.get(factId({ machine: m, ...p })))];
    // Machine names are arbitrary strings ('constructor', '__proto__', ...): a null-prototype
    // dictionary, as canonical snapshotting uses, so no inherited property reads as a position.
    const vector: Record<string, LineagePosition> = Object.create(null) as Record<string, LineagePosition>;
    for (const ref of refs) {
      if (ref === null) continue;
      const inner = ref && member(ref);
      if (!ref || !inner || ref.id === fact.id) return null;
      for (const [m, p] of [...Object.entries(inner), [ref.machine, ref.segment] as const])
        if (!vector[m] || comparePosition(p, vector[m]!) > 0) vector[m] = { epoch: p.epoch, position: p.position };
    }
    // Reaching a fact that carries the start's own id is the walk's "causal cycle" refusal.
    const self = byId.get(fact.id), reached = self && vector[self.machine];
    if (reached && comparePosition(self.segment, reached) <= 0) return null;
    return Object.keys(vector).every(m => !broken.has(m)) ? vector : null;
  };
  const member = (fact: FactEnvelope): CausalFrontier | null => {
    const known = vectors.get(fact.id); if (known !== undefined) return known;
    if (visiting.has(fact.id)) return null;
    visiting.add(fact.id); const vector = compute(fact); visiting.delete(fact.id);
    vectors.set(fact.id, vector); return vector;
  };
  const frontierOf = (fact: FactEnvelope): CausalFrontier | undefined =>
    (byId.get(fact.id) === fact ? member(fact) : compute(fact)) ?? undefined;
  const head = (m: string, p: LineagePosition) => at.get(factId({ machine: m, ...p }))!;
  return { byId, frontierOf,
    coneSize: fact => { const v = frontierOf(fact); return v && Object.entries(v).reduce((n, [m, p]) => n + rank.get(head(m, p).id)! + 1, 0); },
    coneHeads: fact => { const v = frontierOf(fact); return v && Object.entries(v).map(([m, p]) => head(m, p).contentHash).sort(); } };
}
/** The facts of `fact`'s causal history, by id: exactly causalCone(fact, facts), including its refusals. */
export function historyOf(fact: FactEnvelope, facts: readonly FactEnvelope[], index: CausalIndex): (id: string) => FactEnvelope | undefined {
  const vector = index.frontierOf(fact);
  if (!vector) { const cone = new Map(causalCone(fact, facts).map(f => [f.id, f])); return id => cone.get(id); }
  return id => {
    const x = index.byId.get(id), head = x && vector[x.machine];
    return x && x.id !== fact.id && head && comparePosition(x.segment, head) <= 0 ? x : undefined;
  };
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

export function causalStanding(fact: FactEnvelope, context: FactContext, origin: boolean, index: CausalIndex = causalIndex(context.facts)): { now: Clock; taint: readonly AuthorityTaint[]; decode: DecodeContext } {
  const schema = schemaFor(context, fact.kind, fact.schemaVersion), inCone = historyOf(fact, context.facts, index);
  const ids = { has: (id: string) => inCone(id) !== undefined };
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
    const f = inCone(anchor.factId);
    if (!f) continue;
    const declared = schemaFor(context, f.kind, f.schemaVersion);
    requireFact(f.kind === 'time-anchor' && declared.standing === 'operator' && f.provenance.class === 'verified', 'time anchor lacks governed operator origin', 'standing');
    causalStanding(f, context, false, index);
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
  requireFact(!(schema.authority === 'directive' && fact.provenance.class !== 'verified'), 'part-four bound directive admission port required', 'standing');
  const grantIds = [...scoped.map(g => g.grant.id), ...historical.map(g => g.grant.view.id)];
  const relevant = [...context.revocations.map(v => ({ factId: v.factId, grantId: v.revocation.grantId })),
    ...(context.historicalRevocations ?? []).map(v => ({ factId: v.factId, grantId: v.revocation.view.grantId }))].filter(v => v.factId !== fact.id && grantIds.includes(v.grantId) && !ids.has(v.factId));
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
