// One public write port. Storage adapters own fsync/transport; the core never labels RAM durable.
import { consumeResult } from '../index.js';
import type { Json, Result } from '../index.js';
import { boundary, encoding, frozen, object, requireFact, take } from './boundary.js';
import { causalIndex, causalStanding, decodeBody, extendsChain, historyOf, validateRepair, validateSchemas } from './admission.js';
import type { CausalIndex } from './admission.js';
import { decodeEnvelope, factId, genesisHash, signEnvelope } from './envelope.js';
import type { AuthorityTaint, CausalFrontier, ConflictClass, DurabilityState, FactContext, FactEnvelope } from './contracts.js';
import { contextBoundary } from './contracts.js';
import { decodeHistoricalBody, historicalAuthority } from './historical.js';
import { extendSnapshot, prepareSnapshot, snapshotCurrent } from './snapshot.js';
import type { FactSnapshot, RunningSnapshot } from './snapshot.js';
import { issuePrefix, prefixValid, prefixContext } from './prefix.js';
import type { VerifiedPrefix } from './prefix.js';
import { drainConflictFacts, validateConflictFact } from './conflicts.js';
import type { ConflictAppenderPort } from './conflicts.js';

export interface SegmentStoragePort {
  readonly owner: 'part-ten';
  read(): readonly unknown[];
  // Atomic compare-head + durable append. A receipt is returned only after durable storage.
  append(bytes: string, expectedHead: string | null): Result<DurabilityState>;
  // Optional durable intent journal. A receipt NEVER substitutes for conflict fact append.
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
export interface StoreRecovery { readonly prefix?: VerifiedPrefix; readonly verificationBudget?: number; readonly onVerified?: (fact: FactEnvelope) => void; readonly conflictAppender?: ConflictAppenderPort }

// Compare raw storage with a verified JSON frame without re-encoding either one.
// Keep canonical's non-JSON refusals; the verified right-hand side is frozen.
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true; // canonical also identifies -0 with 0
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const proto = Object.getPrototypeOf(a);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) return false;
  const ka = Reflect.ownKeys(a), kb = Reflect.ownKeys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (typeof k !== 'string') return false;
    if (Array.isArray(a) && k === 'length') {
      if (a.length !== (b as unknown[]).length) return false;
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(a, k)!;
    if (!('value' in descriptor) || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(b, k)
      || !jsonEqual(descriptor.value, (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}
export function createFactStore(context: FactContext, storage: SegmentStoragePort, recovery: StoreRecovery = {}): FactStorePort {
  let revision = 0;
  let prefix = recovery.prefix;
  let cached: readonly FactEnvelope[] = [];
  let projectionMemo: { key: string; snapshot: FactSnapshot } | undefined;
  // Each admitted fact's status, kept from when it was derived (Occam cuts #1/#2; see extendSnapshot).
  const statuses: { running?: RunningSnapshot | undefined } = {};
  let checkedContext = prefixContext(context);
  const c = contextBoundary(context);
  const read = (): Result<readonly FactEnvelope[]> => boundary('FactStoreRead', null, c, () => {
    const raw = storage.read();
    if (checkedContext !== prefixContext(context)) { revision++; cached = []; checkedContext = prefixContext(context); }
    if (prefix) { requireFact(prefixValid(prefix, context), 'prefix not verified under current context'); cached = prefix.facts; prefix = undefined; }
    requireFact(raw.length >= cached.length, 'stored verified prefix was truncated', 'integrity');
    for (let i = 0; i < cached.length; i++) requireFact(jsonEqual(raw[i], cached[i]), 'stored verified prefix changed', 'integrity');
    requireFact(raw.length - cached.length <= (recovery.verificationBudget ?? Number.MAX_SAFE_INTEGER), 'verification budget exhausted', 'budget-exhausted');
    const facts: FactEnvelope[] = [...cached];
    for (const input of raw.slice(cached.length)) {
      const at = { ...context, facts: [...context.facts, ...facts] };
      const fact = take(decodeEnvelope(input, at, 'replication')); extendsChain(fact, at); facts.push(fact); recovery.onVerified?.(fact);
    }
    cached = facts;
    return facts;
  });
  const store: FactStorePort = Object.freeze({ read,
    verifiedPrefix: () => boundary('FactStoreVerifiedPrefix', null, c, () => issuePrefix(take(read()), context)),
    // The sweep re-verifies storage from genesis and holds the running statuses to the oracle: a
    // full prepareSnapshot must equal them byte for byte. The next projection read rebuilds in full.
    sweep: () => boundary('FactStoreSweep', null, c, () => {
      const running = statuses.running;
      revision++; cached = []; prefix = undefined; statuses.running = undefined; projectionMemo = undefined;
      const facts = take(read());
      if (running) requireFact(encoding(take(extendSnapshot({ running }, running.facts, context)).entries).bytes
        === encoding(take(prepareSnapshot(running.facts, context)).entries).bytes, 'running fact statuses differ from a full rebuild', 'integrity');
      return facts;
    }),
    readForProjection: () => boundary('FactStoreProjectionRead', null, c, () => {
      // Currency key: the store's own revision, the stored tail (count + last content hash) and the
      // context tables. read() checks every retained frame; discarding that verified prefix
      // advances revision. snapshotCurrent also checks the complete issuance context.
      const projectionKey = (facts: readonly FactEnvelope[]) => `${revision}|${facts.length}|${facts.at(-1)?.contentHash ?? ''}|${encoding({
        captures: context.captures, grants: context.grants, revocations: context.revocations, historicalGrants: context.historicalGrants ?? [] }).bytes}`;
      const first = take(read()), firstKey = projectionKey(first);
      // Served only while the issued snapshot is still current under ITS OWN issuance terms (policy
      // hash, owned bodies, migrations) as well as under the key: a context change invalidates it.
      if (projectionMemo && projectionMemo.key === firstKey && snapshotCurrent(projectionMemo.snapshot)) return projectionMemo.snapshot;
      let snapshot = take(extendSnapshot(statuses, first, context, () => projectionKey(take(read())) === firstKey));
      const conflicts = [...new Map(snapshot.entries.flatMap(e => e.conflicts).map(c => [c.key, c])).values()];
      if (conflicts.length) {
        if (storage.recordConflicts) {
          const receipt = take(storage.recordConflicts(conflicts)); requireFact(receipt.kind === 'local-durable' || receipt.kind === 'replicated', 'conflict recording did not acknowledge durability');
        }
        requireFact(recovery.conflictAppender, 'signed conflict fact appender required; outbox receipt is insufficient');
        take(drainConflictFacts(context, store, recovery.conflictAppender));
      }
      // Preparation and conflict draining can themselves move the stored tail or the context tables
      // (a capture preserved during the call), so the key is re-derived AFTER them, exactly where the
      // former fingerprint was taken. Only when it moved is the snapshot prepared a second time.
      const again = take(read()), againKey = projectionKey(again);
      if (conflicts.length || againKey !== firstKey)
        snapshot = take(extendSnapshot(statuses, again, context, () => projectionKey(take(read())) === againKey));
      projectionMemo = { key: againKey, snapshot };
      return snapshot;
    }),
    append(input: unknown, replication?: { readonly peer: string }): Result<AppendReceipt> {
      return boundary('FactStoreAppend', input, c, safe => {
        requireFact(storage.owner === 'part-ten', 'storage adapter owner mismatch');
        take(validateSchemas(context.schemas, context));
        const persisted = take(read());
        let at = historicalAuthority({ ...context, facts: [...context.facts, ...persisted] });
        const appender = recovery.conflictAppender;
        if (!replication && object(safe).kind === 'conflict-record' && appender) {
          // The independently supplied live system identity is validated by P1's
          // normal origin decoder; historical receiver identities stay historical.
          at = { ...at, decode: { ...at.decode, principals: [...at.decode.principals ?? [], appender.principal], provenance: appender.provenance } };
        }
        const fact = take(decodeEnvelope(safe, at, replication ? 'replication' : 'origin'));
        if (replication) requireFact(fact.machine === replication.peer, 'peer delivered segment it does not own', 'integrity');
        const duplicate = replication && persisted.find(f => f.id === fact.id);
        if (duplicate) requireFact(encoding(duplicate).bytes === encoding(safe).bytes, 'duplicate id changed bytes', 'integrity');
        else extendsChain(fact, at);
        const standing = causalStanding(fact, at, !replication);
        validateRepair(fact, at);
        validateConflictFact(fact, { ...at, decode: context.decode });
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
  return store;
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
    validateRepair(fact, context); validateConflictFact(fact, context); take(decodeHistoricalBody(fact, context, standing.decode)); return fact;
  });
}
export function reconcileAuthority(fact: FactEnvelope, context: FactContext, horizon: CausalFrontier, index?: CausalIndex): { taint: readonly AuthorityTaint[]; conflicts: readonly ConflictClass[] } {
  const state = causalStanding(fact, context, false, index);
  const named = [...context.grants.map(g => ({ factId: g.factId, id: g.grant.id })), ...(context.historicalGrants ?? []).map(g => ({ factId: g.factId, id: g.grant.view.id }))].filter(g => fact.predecessors.required.includes(g.factId));
  const conflicts: ConflictClass[] = [];
  // Occam cut #3: both "is one in the other's history?" questions answer by position.
  let within: { facts: readonly FactEnvelope[]; index: CausalIndex } | undefined;
  for (const row of [...context.revocations.map(r => ({ factId: r.factId, grantId: r.revocation.grantId })), ...(context.historicalRevocations ?? []).map(r => ({ factId: r.factId, grantId: r.revocation.view.grantId }))]) {
    if (!named.some(g => g.id === row.grantId)) continue;
    const rev = context.facts.find(f => f.id === row.factId); if (!rev || rev.id === fact.id) continue;
    if (!within) {
      const facts = context.facts.some(f => f.id === fact.id) ? context.facts : [...context.facts, fact];
      within = { facts, index: facts === context.facts && index ? index : causalIndex(facts) };
    }
    const after = historyOf(rev, within.facts, within.index)(fact.id) !== undefined;
    const inCone = historyOf(fact, within.facts, within.index)(rev.id) !== undefined;
    if (!inCone && !after) conflicts.push({ key: `revocation:${fact.id}:${rev.id}`, kind: 'revocation-conflict', facts: [fact.id, rev.id], detail: 'revocation concurrent or prior-but-unseen' });
  }
  const fullyObserved = Object.entries(context.folded).every(([m, p]) => horizon[m] && (horizon[m]!.epoch > p.epoch || (horizon[m]!.epoch === p.epoch && horizon[m]!.position >= p.position)));
  return frozen({ taint: conflicts.length ? ['contested'] : fullyObserved ? [] : state.taint, conflicts });
}
