// The mandatory store -> projection handoff. Status is derived, never an input annotation.
import { compareHistoricalReads, consumeResult, decode } from '../index.js';
import type { ConstitutionalValue, HistoricalRead, Inventory, Json, Result, Scope } from '../index.js';
import { boundary, encoding, same, take } from './boundary.js';
import { bodyConstitutionalFields, causalStanding, decodeBody, migrateBody, validateRepair } from './admission.js';
import { decodeEnvelope, schemaFor } from './envelope.js';
import { decodeHistoricalBody, historicalAuthority, historicalScope } from './historical.js';
import type { HistoricalScope } from './historical.js';
import { reconcileAuthority } from './store.js';
import { validateConflictFact } from './conflicts.js';
import { contextBoundary } from './contracts.js';
import type { AuthorityTaint, ConflictClass, FactContext, FactEnvelope } from './contracts.js';

class SnapshotIdentity { private readonly product!: void }
export interface FactStatus {
  readonly fact: FactEnvelope; readonly body: Json;
  readonly taint: readonly AuthorityTaint[]; readonly conflicts: readonly ConflictClass[];
  readonly constitutional: readonly { readonly field: string; readonly value: ConstitutionalValue; readonly subject: Scope }[];
  readonly historical: readonly HistoricalRead<ConstitutionalValue>[];
}
export interface FactSnapshot extends SnapshotIdentity { readonly entries: readonly FactStatus[] }
const issued = new WeakMap<object, () => boolean>();
export function snapshotPolicyHash(context: FactContext): string {
  return encoding({ decode: context.decode, facts: context.facts.map(f => f.contentHash), keys: context.keys, schemas: context.schemas,
    captures: context.captures, grants: context.grants, revocations: context.revocations, historicalGrants: context.historicalGrants ?? [],
    historicalRevocations: context.historicalRevocations ?? [], folded: context.folded, genesis: context.genesis, anchors: context.timeAnchors }).hash;
}
export function snapshotCurrent(snapshot: FactSnapshot): boolean { return issued.get(snapshot)?.() === true; }
// One fact's status under the authority context `c` (scope = historicalScope(c)). Every input
// it reads is the fact's own history or the context tables, never a later fact, except the
// revocations handled by extendSnapshot's rebuild trigger.
function factStatus(input: FactEnvelope, c: FactContext, scope: HistoricalScope): FactStatus {
  const index = scope.index;
  const fact = take(decodeEnvelope(input, c, 'replication'));
  const conflicts: ConflictClass[] = [], taint = new Set<AuthorityTaint>();
  const constitutional: { field: string; value: ConstitutionalValue; subject: Scope }[] = [];
  const historical: HistoricalRead<ConstitutionalValue>[] = [];
  let body = fact.body;
  const status = boundary('FactSemanticStatus', null, contextBoundary(c), () => {
    const standing = causalStanding(fact, c, false, index), reconciled = reconcileAuthority(fact, c, c.folded, index);
    validateRepair(fact, c);
    const recorded = validateConflictFact(fact, c);
    if (recorded) { conflicts.push(recorded); taint.add('contested'); }
    reconciled.taint.forEach(t => taint.add(t)); conflicts.push(...reconciled.conflicts);
    const migrated = migrateBody(fact, c, fact.body); body = migrated.body;
    const schema = schemaFor(c, fact.kind, migrated.version);
    const hasLiveOrigin = c.decode.provenance && same(c.decode.provenance, fact.provenance)
      || c.decode.principals?.some(p => same(p.provenance, fact.provenance));
    // Historical capture loss must be visible even if an old live value still exists.
    const historicalBody = take(decodeHistoricalBody(fact, c, standing.decode, scope));
    historicalBody.taint.forEach(t => taint.add(t));
    // Every origin takes part in ONE identity set, even when live decoding is
    // also available. Live/historical availability may never partition comparison.
    historical.push(...historicalBody.records);
    if (hasLiveOrigin && historicalBody.taint.length === 0) {
      // Historical validation already succeeded. Partial live context must not
      // turn an inspectable historical record into a poison fact.
      consumeResult(decodeBody(fact, c, standing.decode), {
        Success: decoded => constitutional.push(...bodyConstitutionalFields(decoded).map(f => ({ ...f, subject: schema.scope }))),
        Refused: () => {},
      });
    }
  });
  consumeResult(status, { Success: () => {}, Refused: refusal => {
    conflicts.push({ key: `poison:status:${fact.id}`, kind: 'poison-fact', facts: [fact.id], detail: refusal.detail });
    taint.add(refusal.detail.includes('evidence-unavailable') ? 'evidence-unavailable' : 'contested');
  } });
  return { fact, body, conflicts, taint: [...taint].sort(), constitutional, historical };
}
// The pairwise immutable-field pass, over every entry on every call: it is the only place a later
// fact adds to an earlier fact's status.
function withDisagreements(entries: readonly FactStatus[], c: FactContext): FactStatus[] {
  const seen = new Map<string, { status: FactStatus; record: HistoricalRead<ConstitutionalValue> }[]>();
  const additions = new Map<string, ConflictClass[]>();
  for (const status of [...entries].sort((a, b) => a.fact.id < b.fact.id ? -1 : 1)) for (const record of status.historical) {
    if (!('id' in record.view)) continue;
    const key = `${record.view.type}:${record.view.id}`;
    for (const prior of seen.get(key) ?? []) {
      const leftScope = schemaFor(c, prior.status.fact.kind, prior.status.fact.schemaVersion).scope;
      const rightScope = schemaFor(c, status.fact.kind, status.fact.schemaVersion).scope;
      const subject = take(decode('Scope', leftScope.kind === 'organization' || rightScope.kind === 'organization' || leftScope.kind !== rightScope.kind
        ? { type: 'Scope', schemaVersion: 1, kind: 'organization' }
        : { type: 'Scope', schemaVersion: 1, kind: leftScope.kind, members: [...new Set([...leftScope.members, ...rightScope.members])].sort() }, c.decode));
      // ONE owner operation for every reconstruction route. The scope proposal
      // comes from admitted schemas; P1 checks it against independent record-hash
      // bindings/intrinsic scopes. No candidate Conflict supplies its own scope.
      const compared = take(compareHistoricalReads<keyof Inventory>(record.view.type, prior.record, record, 'identity', subject,
        { register: c.decode.register, preserved: c.preserved, recordSubjects: c.decode.recordSubjects ?? {} }));
      if (typeof compared !== 'boolean') {
        const pair = [prior.status.fact.id, status.fact.id].sort();
        const conflict: ConflictClass = { key: `constitutional:${key}:${pair.join(',')}`, kind: 'immutable-disagreement', facts: pair, detail: 'part-one immutable-field conflict', historicalConstitutional: compared };
        for (const id of conflict.facts) additions.set(id, [...additions.get(id) ?? [], conflict]);
      }
    }
    seen.set(key, [...seen.get(key) ?? [], { status, record }]);
  }
  return entries.map(e => additions.has(e.fact.id) ? { ...e, conflicts: [...e.conflicts, ...additions.get(e.fact.id)!], taint: [...new Set<AuthorityTaint>([...e.taint, 'contested'])].sort() } : e);
}
function issue(entries: readonly FactStatus[], context: FactContext, isCurrent: () => boolean): FactSnapshot {
  const snapshot = { entries } as unknown as FactSnapshot;
  const policy = snapshotPolicyHash(context), owners = context.ownedBodies, migrations = context.migrations;
  issued.set(snapshot, () => isCurrent() && policy === snapshotPolicyHash(context) && owners === context.ownedBodies && migrations === context.migrations); return snapshot;
}
export function prepareSnapshot(facts: readonly FactEnvelope[], context: FactContext, isCurrent: () => boolean = () => true): Result<FactSnapshot> {
  return boundary('FactStatusSnapshot', null, contextBoundary(context), () => {
    const all = [...new Map([...context.facts, ...facts].map(f => [f.id, f])).values()];
    // Discover authority from registered bodies, not optional caller status annotations.
    const c = historicalAuthority({ ...context, facts: all }), scope = historicalScope(c);
    return issue(withDisagreements(facts.map(input => factStatus(input, c, scope)), c), context, isCurrent);
  });
}
// Occam cuts #1/#2: a store keeps each fact's status from when it was admitted and derives only
// the new facts' statuses. An old status is re-derived only on the events that can change it: a
// change to any context table, owner registration or migration (the policy below, exactly what a
// snapshot's currency already checks: captures, keys, schemas, grants, revocations, anchors), a
// newly admitted revocation, or any prefix the running snapshot did not itself cover. Those
// rebuild in full through prepareSnapshot's own path. prepareSnapshot stays the oracle.
export interface RunningSnapshot {
  readonly facts: readonly FactEnvelope[]; readonly authority: FactContext; readonly statuses: readonly FactStatus[];
  readonly policy: string; readonly owners: FactContext['ownedBodies']; readonly migrations: FactContext['migrations'];
}
// `state.running` is replaced only on success; it holds the caller's context, so it never passes
// through the boundary (which freezes what it returns).
export function extendSnapshot(state: { running?: RunningSnapshot | undefined }, facts: readonly FactEnvelope[], context: FactContext,
  isCurrent: () => boolean = () => true): Result<FactSnapshot> {
  const previous = state.running;
  return boundary('FactStatusSnapshot', null, contextBoundary(context), () => {
    const policy = snapshotPolicyHash(context), owners = context.ownedBodies, migrations = context.migrations;
    const known = previous && previous.policy === policy && previous.owners === owners && previous.migrations === migrations
      && facts.length >= previous.facts.length && previous.facts.every((f, i) => facts[i] === f) ? previous : undefined;
    const added = facts.slice(known?.facts.length ?? 0);
    const ids = new Set(known?.authority.facts.map(f => f.id));
    let running: RunningSnapshot | undefined;
    if (known && added.every(f => !ids.has(f.id) && (ids.add(f.id), true))) {
      const historicalGrants = [...known.authority.historicalGrants ?? []], historicalRevocations = [...known.authority.historicalRevocations ?? []];
      const c: FactContext = { ...known.authority, facts: [...known.authority.facts, ...added], historicalGrants, historicalRevocations };
      const scope = historicalScope(c), index = scope.index;
      for (const fact of added) {
        const schema = schemaFor(c, fact.kind, fact.schemaVersion);
        if (!Object.values(schema.fields).some(f => f.kind === 'constitutional' && ['StandingGrant', 'Revocation'].includes(f.type))) continue;
        const body = take(decodeHistoricalBody(fact, c, causalStanding(fact, c, false, index).decode, scope));
        historicalGrants.push(...body.grants.map(grant => ({ factId: fact.id, grant })));
        historicalRevocations.push(...body.revocations.map(revocation => ({ factId: fact.id, revocation })));
      }
      // A new revocation can taint or contest any earlier fact relying on the grant: rebuild.
      if (historicalRevocations.length === (known.authority.historicalRevocations ?? []).length)
        running = { facts, authority: c, statuses: [...known.statuses, ...added.map(input => factStatus(input, c, scope))], policy, owners, migrations };
    }
    if (!running) {
      const all = [...new Map([...context.facts, ...facts].map(f => [f.id, f])).values()];
      const c = historicalAuthority({ ...context, facts: all }), scope = historicalScope(c);
      running = { facts, authority: c, statuses: facts.map(input => factStatus(input, c, scope)), policy, owners, migrations };
    }
    const snapshot = issue(withDisagreements(running.statuses, running.authority), context, isCurrent);
    state.running = running; return snapshot;
  });
}
