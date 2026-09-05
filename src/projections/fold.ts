// Rules 24/31/33/45/95. A closed data-only fold language is the effect boundary:
// callers cannot inject callbacks, imports, clocks, caches, or other projections.
import { compare, consumeResult } from '../index.js';
import type { Clock, ConstitutionalValue, Json, RegisterGenerationReference, Result, Scope } from '../index.js';
import { boundary, encoding, frozen, object, requireFact, take } from '../facts/boundary.js';
import type { FactBoundary } from '../facts/boundary.js';
import type { AuthorityTaint, CausalFrontier, ConflictClass, FactEnvelope, LineagePosition } from '../facts/contracts.js';
import { comparePosition, foldKey } from '../facts/envelope.js';
import { causalCone } from '../facts/admission.js';

export type MergeClass = 'additive' | 'set-union' | 'max' | 'min' | 'exclusive-singleton' | 'cap-checked aggregate';
export type InputDecision = Readonly<{ kind: 'ignores'; reason: string } | {
  kind: 'folds'; merge: MergeClass; identity: string; value: string; cap?: string;
}>;
export interface ProjectionDefinition {
  readonly id: string; readonly class: 'authority-answering' | 'informational'; readonly stalenessBound: number;
  readonly decisions: Readonly<Record<string, InputDecision>>;
  readonly retention: 'all-identities';
}
export interface KnownLineage { readonly head: LineagePosition | null; readonly observedAt: number | null; readonly closed: boolean }
export interface ProjectionGeneration {
  readonly reference: RegisterGenerationReference;
  readonly kinds: readonly string[];
  readonly lineages: Readonly<Record<string, KnownLineage>>;
}
export interface FoldInput {
  readonly fact: FactEnvelope; readonly taint: readonly AuthorityTaint[];
  readonly constitutional?: readonly { readonly field: string; readonly value: ConstitutionalValue; readonly subject: Scope }[];
}
export interface ProjectedView {
  readonly projection: string; readonly generation: string;
  readonly policy: Readonly<{ class: 'authority-answering' | 'informational'; stalenessBound: number }>;
  readonly values: Readonly<Record<string, Json>>;
  readonly conflicts: readonly ConflictClass[]; readonly taint: readonly AuthorityTaint[];
  readonly foldedThrough: CausalFrontier; readonly knownLineages: Readonly<Record<string, KnownLineage>>;
  readonly retractions: readonly string[]; readonly corrections: readonly { readonly original: string; readonly replacement: string }[];
}
const classes: readonly string[] = ['additive', 'set-union', 'max', 'min', 'exclusive-singleton', 'cap-checked aggregate'];
function exact(v: Json | undefined): bigint {
  requireFact(typeof v === 'string' && /^-?(0|[1-9][0-9]*)$/.test(v), 'quantity must use exact integer minor units'); return BigInt(v);
}
function validate(def: ProjectionDefinition, generation: ProjectionGeneration): void {
  // canonical rejects functions/accessors anywhere in definition before the fold starts.
  encoding(def); encoding(generation);
  requireFact(generation.reference.owner === 'part-three' && generation.reference.name === 'RegisterGeneration', 'register generation must come from part three');
  requireFact(def.id.length > 0 && Number.isFinite(def.stalenessBound) && def.stalenessBound > 0 && def.retention === 'all-identities', 'projection needs identity, bound, and retention declaration');
  requireFact(Object.keys(def.decisions).length === generation.kinds.length, 'undeclared input or absent folds/ignores decision');
  for (const kind of generation.kinds) {
    const d = def.decisions[kind]; requireFact(d, `missing input decision: ${kind}`);
    if (d.kind === 'ignores') requireFact(d.reason.trim().length > 0, 'ignore requires reason');
    else {
      requireFact(d.kind === 'folds' && classes.includes(d.merge), 'missing merge class');
      requireFact(d.identity.length > 0 && d.value.length > 0, 'fold must declare field access');
      if (d.merge === 'cap-checked aggregate') exact(d.cap);
    }
  }
}
function concurrent(a: FactEnvelope, b: FactEnvelope, facts: readonly FactEnvelope[]): boolean {
  return !causalCone(a, facts).some(f => f.id === b.id) && !causalCone(b, facts).some(f => f.id === a.id);
}
export function foldProjection(def: ProjectionDefinition, inputs: readonly FoldInput[], generation: ProjectionGeneration, context: FactBoundary): Result<ProjectedView> {
  return boundary('ProjectionFold', null, context, () => {
    validate(def, generation);
    const dedup = new Map<string, FoldInput>();
    const conflicts: ConflictClass[] = [], taint = new Set<AuthorityTaint>();
    for (const input of inputs) {
      const prior = dedup.get(input.fact.id);
      requireFact(!prior || prior.fact.contentHash === input.fact.contentHash, 'same fact id with immutable-field disagreement');
      dedup.set(input.fact.id, input); input.taint.forEach(t => taint.add(t));
    }
    const rows = [...dedup.values()].sort((a, b) => Buffer.compare(Buffer.from(foldKey(a.fact)), Buffer.from(foldKey(b.fact))));
    const facts = rows.map(r => r.fact), foldedThrough: Record<string, LineagePosition> = {};
    for (const fact of facts) {
      requireFact(Object.hasOwn(generation.lineages, fact.machine), 'fact from unknown lineage');
      const prev = foldedThrough[fact.machine]; if (!prev || comparePosition(fact.segment, prev) > 0) foldedThrough[fact.machine] = { epoch: fact.segment.epoch, position: fact.segment.position };
    }
    const byId = new Map(facts.map(f => [f.id, f]));
    const retractions = facts.filter(f => f.kind === 'retraction');
    const isRetracted = (id: string, visiting = new Set<string>()): boolean => {
      requireFact(!visiting.has(id), 'retraction cycle'); visiting.add(id);
      const result = retractions.some(r => object(r.body).target === id && !isRetracted(r.id, new Set(visiting)));
      return result;
    };
    const excluded = new Set<string>(), corrections: { original: string; replacement: string }[] = [];
    for (const original of facts) {
      const replacements = facts.filter(f => object(f.body).corrects === original.id && !isRetracted(f.id));
      for (const replacement of replacements) requireFact(replacement.kind === original.kind && causalCone(replacement, facts).some(f => f.id === original.id), 'correction must follow same-kind original');
      const heads = replacements.filter(a => !replacements.some(b => b.id !== a.id && causalCone(b, facts).some(p => p.id === a.id)));
      if (heads.length > 1) {
        const ids = heads.map(f => f.id).sort(); conflicts.push({ key: `correction:${original.id}`, kind: 'concurrent-correction', facts: ids, detail: 'concurrent corrections require resolution' });
        taint.add('contested'); excluded.add(original.id); heads.forEach(f => excluded.add(f.id));
      } else if (heads[0]) {
        excluded.add(original.id); replacements.filter(r => r.id !== heads[0]!.id).forEach(r => excluded.add(r.id));
        corrections.push({ original: original.id, replacement: heads[0].id });
      }
    }
    const groups = new Map<string, { decision: Extract<InputDecision, { kind: 'folds' }>; rows: FactEnvelope[] }>();
    const constitutional = new Map<string, { fact: FactEnvelope; value: ConstitutionalValue; subject: Scope }>();
    for (const input of rows) for (const field of input.constitutional ?? []) {
      requireFact(encoding(object(input.fact.body)[field.field]).bytes === encoding(field.value).bytes, 'constitutional fold input differs from stored field');
      if (!('id' in field.value)) continue;
      const key = `${field.value.type}:${field.value.id}`, prior = constitutional.get(key);
      if (prior && 'id' in prior.value) {
        const comparison = take(compare(field.value.type, prior.value, field.value, 'identity', field.subject, context.preserved));
        if (typeof comparison !== 'boolean') {
          conflicts.push({ key: `constitutional:${key}`, kind: 'immutable-disagreement', facts: [prior.fact.id, input.fact.id].sort(), detail: 'part-one immutable-field conflict', constitutional: comparison });
          taint.add('contested'); excluded.add(prior.fact.id); excluded.add(input.fact.id);
        }
      } else constitutional.set(key, { fact: input.fact, value: field.value, subject: field.subject });
    }
    for (const fact of facts) {
      const decision = def.decisions[fact.kind]; requireFact(decision, 'projection received undeclared kind');
      if (decision.kind === 'ignores' || excluded.has(fact.id) || isRetracted(fact.id)) continue;
      try {
        const body = object(fact.body), identity = body[decision.identity];
        requireFact(typeof identity === 'string' && identity.length > 0 && body[decision.value] !== undefined, 'poison fact: missing fold field');
        if (['additive', 'max', 'min', 'cap-checked aggregate'].includes(decision.merge)) exact(body[decision.value]);
        const key = `${fact.kind}:${identity}`;
        const group = groups.get(key) ?? { decision, rows: [] }; group.rows.push(fact); groups.set(key, group);
      } catch (error) {
        conflicts.push({ key: `poison:${def.id}:${fact.id}`, kind: 'poison-fact', facts: [fact.id], detail: error instanceof Error ? error.message : 'fold input failed' }); taint.add('contested');
      }
    }
    const values: Record<string, Json> = {};
    for (const [key, group] of [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
      const d = group.decision, members = group.rows;
      const data = members.map(f => object(f.body)[d.value]!);
      if (d.merge === 'exclusive-singleton') {
        const heads = members.filter(a => !members.some(b => a.id !== b.id && causalCone(b, facts).some(f => f.id === a.id)));
        if (heads.some((a, i) => heads.slice(i + 1).some(b => concurrent(a, b, facts)))) {
          conflicts.push({ key: `exclusive:${key}`, kind: 'immutable-disagreement', facts: heads.map(f => f.id).sort(), detail: 'concurrent singleton writers; no presentation winner' }); taint.add('contested');
        } else if (heads[0]) values[key] = object(heads[0].body)[d.value]!;
      } else if (d.merge === 'set-union') values[key] = [...new Map(data.map(v => [encoding(v).bytes, v])).entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, v]) => v);
      else {
        const numbers = data.map(exact);
        const aggregate = numbers.reduce((a, b) => d.merge === 'max' ? a > b ? a : b : d.merge === 'min' ? a < b ? a : b : a + b, d.merge === 'max' || d.merge === 'min' ? numbers[0]! : 0n);
        values[key] = aggregate.toString();
        if (d.merge === 'cap-checked aggregate' && aggregate > exact(d.cap)) {
          conflicts.push({ key: `aggregate:${key}`, kind: 'aggregate-breach', facts: members.map(f => f.id).sort(), detail: `total ${aggregate} exceeds cap ${d.cap}` }); taint.add('contested');
        }
      }
    }
    // A dangling correction is not an ordinary occurrence.
    for (const fact of facts) { const target = object(fact.body).corrects; if (typeof target === 'string') requireFact(byId.has(target), 'correction target missing'); }
    return { projection: def.id, generation: generation.reference.id, policy: { class: def.class, stalenessBound: def.stalenessBound }, values,
      conflicts: conflicts.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0), taint: [...taint].sort(), foldedThrough,
      knownLineages: generation.lineages, retractions: retractions.map(f => f.id).sort(), corrections: corrections.sort((a, b) => a.original < b.original ? -1 : 1) };
  });
}
export function readProjection(view: ProjectedView, definition: ProjectionDefinition, now: Clock, context: FactBoundary, demand: CausalFrontier = {}): Result<{ view: ProjectedView; stale: readonly string[] }> {
  return boundary('ProjectionRead', null, context, () => {
    requireFact(definition.id === view.projection, 'projection definition does not name this view');
    requireFact(Number.isFinite(definition.stalenessBound) && definition.stalenessBound > 0, 'invalid reader staleness bound');
    // A caller may demand a stronger read, but cannot relabel an authority view or widen
    // the source's declared bound. The producing fold's policy travels with its output.
    const stalenessBound = Math.min(view.policy.stalenessBound, definition.stalenessBound);
    const stale: string[] = [];
    for (const [machine, known] of Object.entries(view.knownLineages)) {
      const folded = view.foldedThrough[machine];
      if (!known.head || !folded || comparePosition(folded, known.head) < 0 || (!known.closed && (known.observedAt === null || now.value < known.observedAt || now.value - known.observedAt > stalenessBound))) stale.push(machine);
    }
    for (const [machine, position] of Object.entries(demand)) requireFact(view.foldedThrough[machine] && comparePosition(view.foldedThrough[machine]!, position) >= 0, 'currency demand not reached', 'stale-base');
    if (definition.class === 'authority-answering' || view.policy.class === 'authority-answering') {
      requireFact(stale.length === 0, 'unknown or exceeded staleness bound', 'stale-base');
      requireFact(view.taint.length === 0 && view.conflicts.length === 0, 'conflicted or tainted authority', 'standing');
    }
    return { view, stale: stale.sort() };
  });
}
export interface Checkpoint { readonly vector: CausalFrontier; readonly view: ProjectedView; readonly hash: string }
export function checkpoint(view: ProjectedView): Checkpoint { return frozen({ vector: view.foldedThrough, view, hash: encoding(view).hash }); }
export function verifyRebuild(live: Checkpoint, rebuilt: Checkpoint, context: FactBoundary): Result<'equal'> {
  return boundary('ProjectionRebuild', null, context, () => {
    requireFact(encoding(live.vector).bytes === encoding(rebuilt.vector).bytes, 'comparison vectors differ');
    requireFact(encoding(live.view).hash === live.hash && encoding(rebuilt.view).hash === rebuilt.hash && live.hash === rebuilt.hash, 'pinned rebuild divergence', 'integrity'); return 'equal';
  });
}
