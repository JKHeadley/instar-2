// Rules 24/31/33/45/95. A closed data-only fold language is the effect boundary:
// callers cannot inject callbacks, imports, clocks, caches, or other projections.
import type { Clock, Json, RegisterGenerationReference, Result } from '../index.js';
import { boundary, encoding, frozen, object, requireFact, take } from '../facts/boundary.js';
import type { FactBoundary } from '../facts/boundary.js';
import type { AuthorityTaint, CausalFrontier, ConflictClass, FactEnvelope, LineagePosition } from '../facts/contracts.js';
import { comparePosition, foldKey } from '../facts/envelope.js';
import { causalCone } from '../facts/admission.js';
import { snapshotCurrent } from '../facts/snapshot.js';
import type { FactSnapshot, FactStatus } from '../facts/snapshot.js';
import { openCache, signCache } from '../facts/cache.js';
import type { CacheKey } from '../facts/cache.js';

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
export type FoldInput = FactSnapshot;
class ViewIdentity { private readonly product!: void }
const producedViews = new WeakSet<object>();
const sources = new WeakMap<object, FactSnapshot>();
const definitions = new WeakMap<object, ProjectionDefinition>();
const recoveryOnly = new WeakSet<object>();
export interface ProjectedView extends ViewIdentity {
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
// A bounded, data-only path selector for a fold decision's identity/value. Dot-separated
// static segments only (no wildcards, indices, callbacks, or dynamic evaluation), bounded
// to a small fixed depth. A single segment is the degenerate top-level field and resolves
// byte-identically to body[selector]. Each descent step must land on a plain object; a
// path resolving to a missing or wrong-typed value is the same poison-fact refusal as a
// missing top-level field — the caller's requireFact on the resolved value carries it.
const MAX_PATH_DEPTH = 3;
function validSelector(selector: string): boolean {
  const segments = selector.split('.');
  return segments.length >= 1 && segments.length <= MAX_PATH_DEPTH && segments.every(s => s.length > 0);
}
function resolveField(body: Record<string, Json>, selector: string): Json | undefined {
  let cursor: Json | undefined = body;
  for (const segment of selector.split('.')) {
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, Json>)[segment];
  }
  return cursor;
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
      requireFact(validSelector(d.identity) && validSelector(d.value), 'fold path must be 1 to 3 non-empty static segments');
      if (d.merge === 'cap-checked aggregate') exact(d.cap);
    }
  }
}
function concurrent(a: FactEnvelope, b: FactEnvelope, facts: readonly FactEnvelope[]): boolean {
  return !causalCone(a, facts).some(f => f.id === b.id) && !causalCone(b, facts).some(f => f.id === a.id);
}
export function foldProjection(def: ProjectionDefinition, input: FactSnapshot, generation: ProjectionGeneration, context: FactBoundary): Result<ProjectedView> {
  return boundary('ProjectionFold', null, context, () => {
    requireFact(snapshotCurrent(input), 'fold requires current admitted status snapshot', 'integrity');
    const inputs = input.entries;
    validate(def, generation);
    const dedup = new Map<string, FactStatus>();
    const conflicts: ConflictClass[] = [], taint = new Set<AuthorityTaint>();
    for (const input of inputs) {
      const prior = dedup.get(input.fact.id);
      requireFact(!prior || prior.fact.contentHash === input.fact.contentHash, 'same fact id with immutable-field disagreement');
      dedup.set(input.fact.id, input); input.taint.forEach(t => taint.add(t)); conflicts.push(...input.conflicts);
    }
    const rows = [...dedup.values()].sort((a, b) => Buffer.compare(Buffer.from(foldKey(a.fact)), Buffer.from(foldKey(b.fact))));
    const facts = rows.map(r => r.fact), foldedThrough: Record<string, LineagePosition> = {};
    // A largest observed offset is not a prefix witness. Verify every interior and causal edge.
    for (const machine of new Set(facts.map(f => f.machine))) {
      const lineage = facts.filter(f => f.machine === machine).sort((a, b) => comparePosition(a.segment, b.segment));
      requireFact(lineage[0]!.segment.epoch === 0 && lineage[0]!.segment.position === 0, 'incomplete lineage prefix');
      for (let i = 1; i < lineage.length; i++) {
        const prior = lineage[i - 1]!, next = lineage[i]!;
        requireFact(next.prevInSegment === prior.contentHash, 'incomplete lineage hash prefix');
        requireFact(next.segment.epoch === prior.segment.epoch
          ? next.segment.position === prior.segment.position + 1 && next.predecessors.inSegment === prior.id
          : next.segment.epoch === prior.segment.epoch + 1 && next.segment.position === 0
            && next.predecessors.frontier[machine]?.epoch === prior.segment.epoch && next.predecessors.frontier[machine]?.position === prior.segment.position, 'incomplete lineage prefix');
      }
    }
    for (const fact of facts) causalCone(fact, facts);
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
    const excluded = new Set(rows.filter(r => r.conflicts.some(c => c.kind === 'poison-fact' || c.kind === 'immutable-disagreement')).map(r => r.fact.id)), corrections: { original: string; replacement: string }[] = [];
    for (const original of facts) {
      const replacements = facts.filter(f => object(f.body).corrects === original.id && !excluded.has(f.id) && !isRetracted(f.id));
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
    for (const fact of facts) {
      const decision = def.decisions[fact.kind]; requireFact(decision, 'projection received undeclared kind');
      if (decision.kind === 'ignores' || excluded.has(fact.id) || isRetracted(fact.id)) continue;
      try {
        const body = object(dedup.get(fact.id)!.body), identity = resolveField(body, decision.identity), value = resolveField(body, decision.value);
        requireFact(typeof identity === 'string' && identity.length > 0 && value !== undefined, 'poison fact: missing fold field');
        if (['additive', 'max', 'min', 'cap-checked aggregate'].includes(decision.merge)) exact(value);
        const key = `${fact.kind}:${identity}`;
        const group = groups.get(key) ?? { decision, rows: [] }; group.rows.push(fact); groups.set(key, group);
      } catch (error) {
        conflicts.push({ key: `poison:${def.id}:${fact.id}`, kind: 'poison-fact', facts: [fact.id], detail: error instanceof Error ? error.message : 'fold input failed' }); taint.add('contested');
      }
    }
    const values: Record<string, Json> = {};
    for (const [key, group] of [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
      const d = group.decision, members = group.rows;
      const data = members.map(f => resolveField(object(dedup.get(f.id)!.body), d.value)!);
      if (d.merge === 'exclusive-singleton') {
        const heads = members.filter(a => !members.some(b => a.id !== b.id && causalCone(b, facts).some(f => f.id === a.id)));
        if (heads.some((a, i) => heads.slice(i + 1).some(b => concurrent(a, b, facts)))) {
          conflicts.push({ key: `exclusive:${key}`, kind: 'immutable-disagreement', facts: heads.map(f => f.id).sort(), detail: 'concurrent singleton writers; no presentation winner' }); taint.add('contested');
        } else if (heads[0]) values[key] = resolveField(object(dedup.get(heads[0].id)!.body), d.value)!;
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
    const view = { projection: def.id, generation: generation.reference.id, policy: { class: def.class, stalenessBound: def.stalenessBound }, values,
      conflicts: [...new Map(conflicts.map(c => [c.key, c])).values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0), taint: [...taint].sort(), foldedThrough,
      knownLineages: generation.lineages, retractions: retractions.map(f => f.id).sort(), corrections: corrections.sort((a, b) => a.original < b.original ? -1 : 1) } as unknown as ProjectedView;
    producedViews.add(view); sources.set(view, input); definitions.set(view, frozen(JSON.parse(encoding(def).bytes) as ProjectionDefinition)); return view;
  });
}
export function readProjection(view: ProjectedView, definition: ProjectionDefinition, now: Clock, context: FactBoundary, demand: CausalFrontier = {}): Result<{ view: ProjectedView; stale: readonly string[] }> {
  return boundary('ProjectionRead', null, context, () => {
    requireFact(producedViews.has(view), 'view was not produced by fold or verified restore', 'integrity');
    requireFact(snapshotCurrent(sources.get(view)!), 'projection source changed; reconcile before serving', 'stale-base');
    requireFact(!recoveryOnly.has(view), 'checkpoint covers only a prefix; resume before serving', 'stale-base');
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
export function checkpoint(view: ProjectedView): Checkpoint { requireFact(producedViews.has(view), 'checkpoint requires a produced view'); return frozen({ vector: view.foldedThrough, view, hash: encoding(view).hash }); }
export function verifyRebuild(live: Checkpoint, rebuilt: Checkpoint, context: FactBoundary): Result<'equal'> {
  return boundary('ProjectionRebuild', null, context, () => {
    requireFact(encoding(live.vector).bytes === encoding(rebuilt.vector).bytes, 'comparison vectors differ');
    requireFact(encoding(live.view).hash === live.hash && encoding(rebuilt.view).hash === rebuilt.hash && live.hash === rebuilt.hash, 'pinned rebuild divergence', 'integrity'); return 'equal';
  });
}
export function signCheckpoint(saved: Checkpoint, keyId: string, privateKey: string): Json {
  requireFact(producedViews.has(saved.view) && sources.has(saved.view), 'checkpoint must have a validated producer');
  requireFact(encoding(saved.view).hash === saved.hash && encoding(saved.vector).bytes === encoding(saved.view.foldedThrough).bytes, 'checkpoint has been altered');
  return signCache('P2ProjectionCheckpoint:1', { checkpoint: saved, definition: definitions.get(saved.view),
    records: sources.get(saved.view)!.entries.map(e => ({ id: e.fact.id, hash: e.fact.contentHash, status: encoding(e).hash })) }, keyId, privateKey);
}
export function restoreCheckpoint(input: unknown, snapshot: FactSnapshot, context: FactBoundary, independentlyTrustedKeys: readonly CacheKey[]): Result<Checkpoint> {
  return boundary('RestoreProjectionCheckpoint', input, context, raw => {
    requireFact(snapshotCurrent(snapshot), 'restore requires admitted snapshot');
    const saved = object(openCache('P2ProjectionCheckpoint:1', raw, independentlyTrustedKeys));
    const stored = object(saved.checkpoint!), view = object(stored.view!);
    requireFact(encoding(view).hash === stored.hash && encoding(stored.vector).bytes === encoding(view.foldedThrough).bytes, 'checkpoint divergence', 'integrity');
    requireFact(Array.isArray(saved.records), 'checkpoint record witnesses absent');
    const prefix = saved.records.map(record => {
      const r = object(record), entry = snapshot.entries.find(e => e.fact.id === r.id);
      requireFact(entry && entry.fact.contentHash === r.hash && encoding(entry).hash === r.status, 'checkpoint source changed; rebuild earlier prefix'); return entry;
    });
    // Trusted certificate pins a product of this fold. Record witnesses are re-bound to
    // current admitted status; serialized values alone cannot enter the authority reader.
    requireFact(Array.isArray(view.conflicts), 'checkpoint conflict list absent');
    const currentConflicts = snapshot.entries.flatMap(e => e.conflicts);
    const rebound = view.conflicts.map(c => {
      const wire = object(c); if (!wire.constitutional && !wire.historicalConstitutional) return c;
      const current = currentConflicts.find(c => c.key === wire.key && encoding(c).bytes === encoding(wire).bytes);
      requireFact(current, 'checkpoint constitutional conflict requires current producer'); return current;
    });
    const restored = { ...view, conflicts: rebound } as unknown as ProjectedView;
    producedViews.add(restored); sources.set(restored, snapshot); definitions.set(restored, saved.definition as unknown as ProjectionDefinition);
    restoredPrefixes.set(restored, prefix);
    if (prefix.length !== snapshot.entries.length) recoveryOnly.add(restored);
    return { vector: restored.foldedThrough, view: restored, hash: String(stored.hash) };
  });
}
const restoredPrefixes = new WeakMap<object, readonly FactStatus[]>();
export interface RebuildReceipt { readonly view: ProjectedView; readonly folded: number; readonly resumedFrom: CausalFrontier | null }
export function rebuildProjection(def: ProjectionDefinition, snapshot: FactSnapshot, generation: ProjectionGeneration, context: FactBoundary,
  checkpoints: readonly Checkpoint[] = [], budget = Number.MAX_SAFE_INTEGER): Result<RebuildReceipt> {
  return boundary('BoundedProjectionRebuild', null, context, () => {
    requireFact(snapshotCurrent(snapshot), 'rebuild requires admitted snapshot'); validate(def, generation);
    const entries = [...new Map(snapshot.entries.map(e => [e.fact.id, e])).values()];
    const ordered = [...entries].sort((a, b) => foldKey(a.fact) < foldKey(b.fact) ? -1 : 1);
    const candidates = checkpoints.filter(cp => producedViews.has(cp.view) && encoding(cp.view).hash === cp.hash
      && encoding(definitions.get(cp.view)).bytes === encoding(def).bytes && cp.view.generation === generation.reference.id)
      .map(cp => ({ cp, prefix: restoredPrefixes.get(cp.view) ?? sources.get(cp.view)!.entries }))
      .filter(({ cp, prefix }) => cp.view.conflicts.length === 0 && cp.view.taint.length === 0 && prefix.every(p => entries.some(e => e.fact.id === p.fact.id && encoding(e).hash === encoding(p).hash)))
      .filter(({ prefix }) => {
        const ids = new Set(prefix.map(p => p.fact.id)), last = prefix.map(p => foldKey(p.fact)).sort().at(-1);
        return entries.filter(e => !ids.has(e.fact.id)).every(e => (!last || foldKey(e.fact) > last)
          && e.fact.kind !== 'retraction' && object(e.body).corrects === undefined && e.constitutional.length === 0 && e.historical.length === 0 && e.conflicts.length === 0 && e.taint.length === 0);
      }).sort((a, b) => b.prefix.length - a.prefix.length);
    const chosen = candidates[0];
    const ids = new Set(chosen?.prefix.map(e => e.fact.id) ?? []), suffix = ordered.filter(e => !ids.has(e.fact.id));
    requireFact(suffix.length <= budget, 'rebuild budget exhausted', 'budget-exhausted');
    if (!chosen) return { view: take(foldProjection(def, snapshot, generation, context)), folded: entries.length, resumedFrom: null };
    // Completeness remains mandatory on resume; a certified prefix replaces folding,
    // never the causal/vector proof. Any non-incremental repair uses an earlier checkpoint.
    const facts = entries.map(e => e.fact);
    for (const f of facts) { requireFact(Object.hasOwn(generation.lineages, f.machine), 'fact from unknown lineage'); causalCone(f, facts); }
    for (const machine of new Set(facts.map(f => f.machine))) {
      const line = facts.filter(f => f.machine === machine).sort((a, b) => comparePosition(a.segment, b.segment));
      requireFact(line[0]!.segment.epoch === 0 && line[0]!.segment.position === 0, 'incomplete resume prefix');
      for (let i = 1; i < line.length; i++) {
        const previous = line[i - 1]!, next = line[i]!;
        requireFact(next.prevInSegment === previous.contentHash && (next.segment.epoch === previous.segment.epoch
          ? next.segment.position === previous.segment.position + 1 && next.predecessors.inSegment === previous.id
          : next.segment.epoch === previous.segment.epoch + 1 && next.segment.position === 0
            && next.predecessors.frontier[machine]?.epoch === previous.segment.epoch && next.predecessors.frontier[machine]?.position === previous.segment.position), 'incomplete resume prefix');
      }
    }
    const values: Record<string, Json> = { ...chosen.cp.view.values }, conflicts: ConflictClass[] = [];
    let fallback = false;
    for (const row of suffix) {
      const d = def.decisions[row.fact.kind]; requireFact(d, 'undeclared resume kind'); if (d.kind === 'ignores') continue;
      const b = object(row.body), identity = resolveField(b, d.identity), resolved = resolveField(b, d.value);
      requireFact(typeof identity === 'string' && resolved !== undefined, 'resume poison field');
      const key = `${row.fact.kind}:${identity}`, old = values[key], value = resolved;
      if (d.merge === 'set-union') values[key] = [...new Map([...(Array.isArray(old) ? old : []), value].map(v => [encoding(v).bytes, v])).entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([, v]) => v);
      else if (d.merge === 'exclusive-singleton') { fallback = true; break; }
      else {
        const a = old === undefined ? undefined : exact(old), v = exact(value);
        values[key] = (a === undefined ? v : d.merge === 'max' ? a > v ? a : v : d.merge === 'min' ? a < v ? a : v : a + v).toString();
        if (d.merge === 'cap-checked aggregate' && exact(values[key]) > exact(d.cap)) { fallback = true; break; }
      }
    }
    if (fallback) { requireFact(entries.length <= budget, 'rebuild budget exhausted', 'budget-exhausted'); return { view: take(foldProjection(def, snapshot, generation, context)), folded: entries.length, resumedFrom: null }; }
    const vector: Record<string, LineagePosition> = {};
    for (const e of entries) { const prev = vector[e.fact.machine]; if (!prev || comparePosition(prev, e.fact.segment) < 0) vector[e.fact.machine] = { epoch: e.fact.segment.epoch, position: e.fact.segment.position }; }
    const view = { ...chosen.cp.view, values, conflicts, foldedThrough: vector, knownLineages: generation.lineages } as unknown as ProjectedView;
    producedViews.add(view); sources.set(view, snapshot); definitions.set(view, frozen(JSON.parse(encoding(def).bytes) as ProjectionDefinition));
    return { view, folded: suffix.length, resumedFrom: chosen.cp.vector };
  });
}
