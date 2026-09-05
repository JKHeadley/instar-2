// Rules 28/31/33/90; P2-NF-23..28, 32..33, 72, 77.
import { decode, grantLiveness, rehydrateConflict, rehydrateOutcome, rehydrateResult, scopeIncludes } from '../index.js';
import type { Clock, ConstitutionalValue, DecodeContext, Json, Result } from '../index.js';
import { boundary, encoding, fields, integer, object, requireFact, same, string, take } from './boundary.js';
import type { AuthorityTaint, FactContext, FactEnvelope, FactSchema } from './contracts.js';
import { contextBoundary } from './contracts.js';
import { comparePosition, schemaFor, hashBytes } from './envelope.js';

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
    const body = object(f.body);
    requireFact(same(body.clock, anchor.clock), 'time anchor differs from recorded body', 'integrity');
    if (anchor.clock.value > now.value) now = anchor.clock;
  }
  const scoped = context.grants.filter(g => fact.predecessors.required.includes(g.factId) && scopeIncludes(g.grant.scope, schema.scope));
  if (schema.standing !== 'requester') {
    requireFact(schema.causallyBound && scoped.length > 0, 'standing-gated kind must name grant references');
    requireFact(fact.provenance.class === 'verified', 'verified provenance required above requester', 'standing');
    const grant = scoped.find(r => ids.has(r.factId) && r.grant.grantee.id === fact.principal.id
      && (schema.standing !== 'operator' || r.grant.standing === 'operator')
      && (r.grant.standing === 'operator' || r.grant.actions.includes(schema.action))
      && !revocations.some(v => v.grantId === r.grant.id)
      && grantLiveness(r.grant, revocations, now) === 'live');
    requireFact(grant, 'no live covering standing in declared causal cone', 'standing');
  }
  if (schema.authority === 'conferring') requireFact(schema.standing !== 'requester' && fact.provenance.class === 'verified', 'requester cannot confer authority', 'standing');
  // Bound directive exercise is reserved for part four's binding port; no local substitute.
  requireFact(!(schema.authority === 'directive' && fact.provenance.class === 'channel-attested'), 'part-four bound directive admission port required', 'standing');
  const relevant = context.revocations.filter(v => scoped.some(g => g.grant.id === v.revocation.grantId) && !ids.has(v.factId));
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
        requireFact(['text', 'integer', 'exact', 'boolean', 'reference', 'capture', 'constitutional'].includes(string(f.kind, 'field.kind')), 'undeclared/secret-valued field');
        if (f.kind === 'text') integer(f.maxLength, 'maxLength', 1);
        if (f.kind === 'exact') string(f.unit, 'unit');
      }
    }
    return schemas;
  });
}
export function decodeBody(fact: FactEnvelope, context: FactContext, decoderContext: DecodeContext): Result<Readonly<Record<string, Json | ConstitutionalValue>>> {
  return boundary('FactBody', fact.body, contextBoundary(context), raw => {
    const schema = schemaFor(context, fact.kind, fact.schemaVersion), body = object(raw);
    fields(body, Object.keys(schema.fields).filter(k => !schema.optional?.includes(k)), schema.optional);
    const out: Record<string, Json | ConstitutionalValue> = {};
    for (const [name, field] of Object.entries(schema.fields)) {
      const value = body[name]; if (value === undefined && schema.optional?.includes(name)) continue;
      requireFact(value !== undefined, `missing body field ${name}`);
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
        const p = context.decode.principals?.find(p => same(p.provenance, fact.provenance));
        requireFact(p, 'pinned live provenance unavailable; historical body seam required', 'standing');
        const c = { ...decoderContext, provenance: p.provenance };
        if (field.type === 'Outcome') out[name] = take(rehydrateOutcome(value, c));
        else if (field.type === 'Conflict') out[name] = take(rehydrateConflict(value, c));
        else if (field.type === 'Result') {
          // Payload JSON is validated by its own schema; rehydration never reconstructs by cast.
          const recorded = take(rehydrateResult(value, c, payload => boundary('RecordedPayload', payload, contextBoundary(context), x => x)));
          out[name] = recorded;
        } else out[name] = take(decode(field.type, value, c));
      } else out[name] = value;
    }
    return out;
  });
}

export function validateRepair(fact: FactEnvelope, context: FactContext): void {
  if (!['retraction', 'correction'].includes(fact.kind)) return;
  const body = object(fact.body), targetId = string(body.target, 'target');
  const target = context.facts.find(f => f.id === targetId); requireFact(target, 'repair target missing');
  if (fact.kind === 'retraction') string(body.reason, 'reason');
  const original = schemaFor(context, target.kind, target.schemaVersion), repair = schemaFor(context, fact.kind, fact.schemaVersion);
  const rank = { requester: 0, delegate: 1, operator: 2 };
  requireFact(rank[repair.standing] >= rank[original.standing] && scopeIncludes(repair.scope, original.scope), 'repair has less standing than target', 'standing');
  if (original.authority === 'conferring') requireFact(repair.standing === 'operator', 'authority repair requires original grant standing', 'standing');
  const seen = new Set([fact.id]); let current: FactEnvelope | undefined = target;
  while (current && ['retraction', 'correction'].includes(current.kind)) {
    requireFact(!seen.has(current.id), 'repair cycle'); seen.add(current.id);
    current = context.facts.find(f => f.id === object(current!.body).target);
  }
}
