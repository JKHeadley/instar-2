// The mandatory store -> projection handoff. Status is derived, never an input annotation.
import { compareHistoricalReads, consumeResult, decode } from '../index.js';
import type { ConstitutionalValue, HistoricalRead, Inventory, Json, Result, Scope } from '../index.js';
import { boundary, encoding, same, take } from './boundary.js';
import { bodyConstitutionalFields, causalCone, causalStanding, decodeBody, migrateBody, validateRepair } from './admission.js';
import { decodeEnvelope, schemaFor } from './envelope.js';
import { decodeHistoricalBody, historicalAuthority } from './historical.js';
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
export function prepareSnapshot(facts: readonly FactEnvelope[], context: FactContext, isCurrent: () => boolean = () => true): Result<FactSnapshot> {
  return boundary('FactStatusSnapshot', null, contextBoundary(context), () => {
    const all = [...new Map([...context.facts, ...facts].map(f => [f.id, f])).values()];
    // Discover authority from registered bodies, not optional caller status annotations.
    const c = historicalAuthority({ ...context, facts: all });
    const entries: FactStatus[] = [];
    for (const input of facts) {
      const fact = take(decodeEnvelope(input, c, 'replication'));
      const conflicts: ConflictClass[] = [], taint = new Set<AuthorityTaint>();
      const constitutional: { field: string; value: ConstitutionalValue; subject: Scope }[] = [];
      const historical: HistoricalRead<ConstitutionalValue>[] = [];
      let body = fact.body;
      const status = boundary('FactSemanticStatus', null, contextBoundary(c), () => {
        const standing = causalStanding(fact, c, false), reconciled = reconcileAuthority(fact, c, c.folded);
        validateRepair(fact, c);
        const recorded = validateConflictFact(fact, c);
        if (recorded) { conflicts.push(recorded); taint.add('contested'); }
        reconciled.taint.forEach(t => taint.add(t)); conflicts.push(...reconciled.conflicts);
        const migrated = migrateBody(fact, c, fact.body); body = migrated.body;
        const schema = schemaFor(c, fact.kind, migrated.version);
        const hasLiveOrigin = c.decode.provenance && same(c.decode.provenance, fact.provenance)
          || c.decode.principals?.some(p => same(p.provenance, fact.provenance));
        // Historical capture loss must be visible even if an old live value still exists.
        const historicalBody = take(decodeHistoricalBody(fact, c, standing.decode));
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
      entries.push({ fact, body, conflicts, taint: [...taint].sort(), constitutional, historical });
    }
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
    const snapshot = { entries: entries.map(e => additions.has(e.fact.id) ? { ...e, conflicts: [...e.conflicts, ...additions.get(e.fact.id)!], taint: [...new Set<AuthorityTaint>([...e.taint, 'contested'])].sort() } : e) } as unknown as FactSnapshot;
    const policy = snapshotPolicyHash(context), owners = context.ownedBodies, migrations = context.migrations;
    issued.set(snapshot, () => isCurrent() && policy === snapshotPolicyHash(context) && owners === context.ownedBodies && migrations === context.migrations); return snapshot;
  });
}
