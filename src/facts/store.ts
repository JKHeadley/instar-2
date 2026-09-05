// One public write port. Storage adapters own fsync/transport; the core never labels RAM durable.
import { consumeResult } from '../index.js';
import type { Json, Result } from '../index.js';
import { boundary, encoding, frozen, object, requireFact, take } from './boundary.js';
import { causalCone, causalStanding, decodeBody, extendsChain, validateRepair, validateSchemas } from './admission.js';
import { decodeEnvelope, factId, genesisHash, signEnvelope } from './envelope.js';
import type { AuthorityTaint, CausalFrontier, ConflictClass, DurabilityState, FactContext, FactEnvelope } from './contracts.js';
import { contextBoundary } from './contracts.js';
import { decodeHistoricalBody, historicalAuthority } from './historical.js';
import { prepareSnapshot } from './snapshot.js';
import type { FactSnapshot } from './snapshot.js';
import { issuePrefix, prefixValid, prefixContext } from './prefix.js';
import type { VerifiedPrefix } from './prefix.js';

export interface SegmentStoragePort {
  readonly owner: 'part-ten';
  read(): readonly unknown[];
  // Atomic compare-head + durable append. A receipt is returned only after durable storage.
  append(bytes: string, expectedHead: string | null): Result<DurabilityState>;
  // Durable, idempotent sidecar outbox for P2 conflict-record obligations. Does not delete
  // or rewrite any fact; a later fact appender may drain it into registered Conflict facts.
  recordConflicts?(records: readonly ConflictClass[]): Result<DurabilityState>;
}
export interface AppendReceipt { readonly fact: FactEnvelope; readonly durability: DurabilityState; readonly taint: readonly AuthorityTaint[] }
export interface FactStorePort {
  append(input: unknown, replication?: { readonly peer: string }): Result<AppendReceipt>;
  read(): Result<readonly FactEnvelope[]>;
  readForProjection(): Result<FactSnapshot>;
  verifiedPrefix(): Result<VerifiedPrefix>;
  sweep(): Result<readonly FactEnvelope[]>;
}
export interface StoreRecovery { readonly prefix?: VerifiedPrefix; readonly verificationBudget?: number; readonly onVerified?: (fact: FactEnvelope) => void }
export function createFactStore(context: FactContext, storage: SegmentStoragePort, recovery: StoreRecovery = {}): FactStorePort {
  let revision = 0;
  let prefix = recovery.prefix;
  let cached: readonly FactEnvelope[] = [];
  let checkedContext = prefixContext(context);
  const c = contextBoundary(context);
  const read = (): Result<readonly FactEnvelope[]> => boundary('FactStoreRead', null, c, () => {
    const raw = storage.read();
    if (checkedContext !== prefixContext(context)) { cached = []; checkedContext = prefixContext(context); }
    if (prefix) { requireFact(prefixValid(prefix, context), 'prefix not verified under current context'); cached = prefix.facts; prefix = undefined; }
    requireFact(raw.length >= cached.length, 'stored verified prefix was truncated', 'integrity');
    for (let i = 0; i < cached.length; i++) requireFact(encoding(raw[i]).bytes === encoding(cached[i]).bytes, 'stored verified prefix changed', 'integrity');
    requireFact(raw.length - cached.length <= (recovery.verificationBudget ?? Number.MAX_SAFE_INTEGER), 'verification budget exhausted', 'budget-exhausted');
    const facts: FactEnvelope[] = [...cached];
    for (const input of raw.slice(cached.length)) {
      const at = { ...context, facts: [...context.facts, ...facts] };
      const fact = take(decodeEnvelope(input, at, 'replication')); extendsChain(fact, at); facts.push(fact); recovery.onVerified?.(fact);
    }
    cached = facts;
    return facts;
  });
  return Object.freeze({ read,
    verifiedPrefix: () => boundary('FactStoreVerifiedPrefix', null, c, () => issuePrefix(take(read()), context)),
    sweep: () => { cached = []; prefix = undefined; return read(); },
    readForProjection: () => boundary('FactStoreProjectionRead', null, c, () => {
      const facts = take(read()), at = revision;
      const fingerprint = encoding({ facts: storage.read(), captures: context.captures, grants: context.grants, revocations: context.revocations, historicalGrants: context.historicalGrants ?? [], historicalRevocations: context.historicalRevocations ?? [] }).hash;
      const snapshot = take(prepareSnapshot(facts, context, () => revision === at && fingerprint === encoding({ facts: storage.read(), captures: context.captures, grants: context.grants, revocations: context.revocations, historicalGrants: context.historicalGrants ?? [], historicalRevocations: context.historicalRevocations ?? [] }).hash));
      const conflicts = [...new Map(snapshot.entries.flatMap(e => e.conflicts).map(c => [c.key, c])).values()];
      if (conflicts.length) {
        requireFact(storage.recordConflicts, 'durable conflict recording provider required');
        const receipt = take(storage.recordConflicts(conflicts)); requireFact(receipt.kind === 'local-durable' || receipt.kind === 'replicated', 'conflict recording did not acknowledge durability');
      }
      return snapshot;
    }),
    append(input: unknown, replication?: { readonly peer: string }): Result<AppendReceipt> {
      return boundary('FactStoreAppend', input, c, safe => {
        requireFact(storage.owner === 'part-ten', 'storage adapter owner mismatch');
        take(validateSchemas(context.schemas, context));
        const persisted = take(read()), at = historicalAuthority({ ...context, facts: [...context.facts, ...persisted] });
        const fact = take(decodeEnvelope(safe, at, replication ? 'replication' : 'origin'));
        if (replication) requireFact(fact.machine === replication.peer, 'peer delivered segment it does not own', 'integrity');
        const duplicate = replication && persisted.find(f => f.id === fact.id);
        if (duplicate) requireFact(encoding(duplicate).bytes === encoding(safe).bytes, 'duplicate id changed bytes', 'integrity');
        else extendsChain(fact, at);
        const standing = causalStanding(fact, at, !replication);
        validateRepair(fact, at);
        const bodyTaint = replication ? take(decodeHistoricalBody(fact, at, standing.decode)).taint
          : (take(decodeBody(fact, at, standing.decode)), []);
        if (duplicate) return { fact: duplicate, durability: { kind: 'local-durable' as const }, taint: [...new Set([...standing.taint, ...bodyTaint])] };
        const receipt = take(storage.append(encoding(safe).bytes, persisted.at(-1)?.contentHash ?? null));
        revision++;
        cached = [...persisted, fact]; recovery.onVerified?.(fact);
        requireFact(receipt.kind === 'local-durable' || receipt.kind === 'replicated', 'storage returned no durability receipt', 'integrity');
        if (receipt.kind === 'replicated') requireFact(receipt.n > 0 && receipt.n === new Set(receipt.peers).size && receipt.peers.length === receipt.n && !receipt.peers.includes(fact.machine), 'invalid peer acknowledgement count');
        return { fact, durability: receipt, taint: [...new Set([...standing.taint, ...bodyTaint])] };
      });
    },
  });
}
export interface AuthorInput {
  readonly kind: string; readonly schemaVersion: number; readonly machine: string;
  readonly principal: Json; readonly provenance: Json; readonly at: Json; readonly body: Json;
  readonly required: readonly string[];
}
export function authorAndAppend(input: AuthorInput, context: FactContext, store: FactStorePort, privateKey: string): Result<AppendReceipt> {
  return boundary('FactAuthor', input, contextBoundary(context), safe => {
    const v = object(safe), facts = [...context.facts, ...take(store.read())];
    const head = facts.filter(f => f.machine === v.machine).at(-1);
    const segment = { machine: input.machine, epoch: head?.segment.epoch ?? 0, position: head ? head.segment.position + 1 : 0 };
    const envelope = { type: 'FactEnvelope', envelopeVersion: 1, id: factId(segment), kind: input.kind, schemaVersion: input.schemaVersion,
      at: input.at, machine: input.machine, principal: input.principal, provenance: input.provenance, segment,
      prevInSegment: head?.contentHash ?? context.genesis.hash ?? genesisHash,
      predecessors: { inSegment: head?.id ?? null, frontier: context.folded, required: input.required }, body: input.body };
    return take(store.append(signEnvelope(envelope, privateKey)));
  });
}
export function verifyAndAdmit(input: unknown, peer: string, context: FactContext): Result<FactEnvelope> {
  return boundary('FactReplication', input, contextBoundary(context), safe => {
    const raw = object(safe); requireFact(raw.machine === peer, 'peer delivered segment it does not own', 'integrity');
    context = historicalAuthority(context);
    const existing = context.facts.find(f => f.id === raw.id);
    if (existing) { requireFact(encoding(existing).bytes === encoding(safe).bytes, 'duplicate id changed bytes', 'integrity'); return existing; }
    const fact = take(decodeEnvelope(safe, context, 'replication'));
    extendsChain(fact, context); const standing = causalStanding(fact, context, false);
    validateRepair(fact, context); take(decodeHistoricalBody(fact, context, standing.decode)); return fact;
  });
}
export function reconcileAuthority(fact: FactEnvelope, context: FactContext, horizon: CausalFrontier): { taint: readonly AuthorityTaint[]; conflicts: readonly ConflictClass[] } {
  const state = causalStanding(fact, context, false);
  const named = [...context.grants.map(g => ({ factId: g.factId, id: g.grant.id })), ...(context.historicalGrants ?? []).map(g => ({ factId: g.factId, id: g.grant.view.id }))].filter(g => fact.predecessors.required.includes(g.factId));
  const conflicts: ConflictClass[] = [];
  for (const row of [...context.revocations.map(r => ({ factId: r.factId, grantId: r.revocation.grantId })), ...(context.historicalRevocations ?? []).map(r => ({ factId: r.factId, grantId: r.revocation.view.grantId }))]) {
    if (!named.some(g => g.id === row.grantId)) continue;
    const rev = context.facts.find(f => f.id === row.factId); if (!rev) continue;
    const facts = context.facts.some(f => f.id === fact.id) ? context.facts : [...context.facts, fact];
    const after = causalCone(rev, facts).some(f => f.id === fact.id);
    const inCone = causalCone(fact, facts).some(f => f.id === rev.id);
    if (!inCone && !after) conflicts.push({ key: `revocation:${fact.id}:${rev.id}`, kind: 'revocation-conflict', facts: [fact.id, rev.id], detail: 'revocation concurrent or prior-but-unseen' });
  }
  const fullyObserved = Object.entries(context.folded).every(([m, p]) => horizon[m] && (horizon[m]!.epoch > p.epoch || (horizon[m]!.epoch === p.epoch && horizon[m]!.position >= p.position)));
  return frozen({ taint: conflicts.length ? ['contested'] : fullyObserved ? [] : state.taint, conflicts });
}
