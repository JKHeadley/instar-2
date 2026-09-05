// The mandatory store -> projection handoff. Status is derived, never an input annotation.
import { compare, consumeResult } from '../index.js';
import type { ConstitutionalValue, HistoricalRead, Json, Result, Scope } from '../index.js';
import { boundary, encoding, object, same, take } from './boundary.js';
import { bodyConstitutionalFields, causalCone, causalStanding, decodeBody, migrateBody, validateRepair } from './admission.js';
import { decodeEnvelope, schemaFor } from './envelope.js';
import { decodeHistoricalBody, historicalAuthority } from './historical.js';
import { reconcileAuthority } from './store.js';
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
        reconciled.taint.forEach(t => taint.add(t)); conflicts.push(...reconciled.conflicts);
        const migrated = migrateBody(fact, c, fact.body); body = migrated.body;
        const schema = schemaFor(c, fact.kind, migrated.version);
        const hasLiveOrigin = c.decode.provenance && same(c.decode.provenance, fact.provenance)
          || c.decode.principals?.some(p => same(p.provenance, fact.provenance));
        // Historical capture loss must be visible even if an old live value still exists.
        const historicalBody = take(decodeHistoricalBody(fact, c, standing.decode));
        historicalBody.taint.forEach(t => taint.add(t));
        if (hasLiveOrigin && historicalBody.taint.length === 0) {
          const decoded = take(decodeBody(fact, c, standing.decode));
          constitutional.push(...bodyConstitutionalFields(decoded).map(f => ({ ...f, subject: schema.scope })));
        }
        else historical.push(...historicalBody.records);
      });
      consumeResult(status, { Success: () => {}, Refused: refusal => {
        conflicts.push({ key: `poison:status:${fact.id}`, kind: 'poison-fact', facts: [fact.id], detail: refusal.detail });
        taint.add(refusal.detail.includes('evidence-unavailable') ? 'evidence-unavailable' : 'contested');
      } });
      entries.push({ fact, body, conflicts, taint: [...taint].sort(), constitutional, historical });
    }
    const seen = new Map<string, { status: FactStatus; value: ConstitutionalValue }>();
    const additions = new Map<string, ConflictClass[]>();
    for (const status of [...entries].sort((a, b) => a.fact.id < b.fact.id ? -1 : 1)) for (const field of status.constitutional) {
      if (!('id' in field.value)) continue;
      const key = `${field.value.type}:${field.value.id}`, prior = seen.get(key);
      if (prior && 'id' in prior.value) {
        const compared = take(compare(field.value.type, prior.value, field.value, 'identity', field.subject, c.preserved));
        if (typeof compared !== 'boolean') {
          const pair = [prior.status.fact.id, status.fact.id].sort();
          const conflict: ConflictClass = { key: `constitutional:${key}:${pair.join(',')}`, kind: 'immutable-disagreement', facts: pair, detail: 'part-one immutable-field conflict', constitutional: compared };
          for (const id of conflict.facts) additions.set(id, [...additions.get(id) ?? [], conflict]);
        }
      } else seen.set(key, { status, value: field.value });
    }
    const snapshot = { entries: entries.map(e => additions.has(e.fact.id) ? { ...e, conflicts: [...e.conflicts, ...additions.get(e.fact.id)!], taint: [...new Set<AuthorityTaint>([...e.taint, 'contested'])].sort() } : e) } as unknown as FactSnapshot;
    const policy = snapshotPolicyHash(context), owners = context.ownedBodies, migrations = context.migrations;
    issued.set(snapshot, () => isCurrent() && policy === snapshotPolicyHash(context) && owners === context.ownedBodies && migrations === context.migrations); return snapshot;
  });
}
