// One public write port. Storage adapters own fsync/transport; the core never labels RAM durable.
import { consumeResult } from '../index.js';
import type { Json, Result } from '../index.js';
import { boundary, encoding, frozen, object, requireFact, take } from './boundary.js';
import { causalStanding, decodeBody, extendsChain, validateRepair, validateSchemas } from './admission.js';
import { decodeEnvelope, factId, genesisHash, signEnvelope } from './envelope.js';
import type { AuthorityTaint, CausalFrontier, ConflictClass, DurabilityState, FactContext, FactEnvelope } from './contracts.js';
import { contextBoundary } from './contracts.js';
import { decodeHistoricalBody } from './historical.js';

export interface SegmentStoragePort {
  readonly owner: 'part-ten';
  read(): readonly unknown[];
  // Atomic compare-head + durable append. A receipt is returned only after durable storage.
  append(bytes: string, expectedHead: string | null): Result<DurabilityState>;
}
export interface AppendReceipt { readonly fact: FactEnvelope; readonly durability: DurabilityState; readonly taint: readonly AuthorityTaint[] }
export interface FactStorePort {
  append(input: unknown, replication?: { readonly peer: string }): Result<AppendReceipt>;
  read(): Result<readonly FactEnvelope[]>;
}
export function createFactStore(context: FactContext, storage: SegmentStoragePort): FactStorePort {
  const c = contextBoundary(context);
  const read = (): Result<readonly FactEnvelope[]> => boundary('FactStoreRead', null, c, () => {
    const facts: FactEnvelope[] = [];
    for (const input of storage.read()) {
      const at = { ...context, facts: [...context.facts, ...facts] };
      const fact = take(decodeEnvelope(input, at, 'replication')); extendsChain(fact, at); facts.push(fact);
    }
    return facts;
  });
  return Object.freeze({ read,
    append(input: unknown, replication?: { readonly peer: string }): Result<AppendReceipt> {
      return boundary('FactStoreAppend', input, c, safe => {
        requireFact(storage.owner === 'part-ten', 'storage adapter owner mismatch');
        take(validateSchemas(context.schemas, context));
        const persisted = take(read()), at = { ...context, facts: [...context.facts, ...persisted] };
        const fact = take(decodeEnvelope(safe, at, replication ? 'replication' : 'origin'));
        if (replication) requireFact(fact.machine === replication.peer, 'peer delivered segment it does not own', 'integrity');
        const duplicate = replication && persisted.find(f => f.id === fact.id);
        if (duplicate) requireFact(encoding(duplicate).bytes === encoding(safe).bytes, 'duplicate id changed bytes', 'integrity');
        else extendsChain(fact, at);
        const standing = causalStanding(fact, at, !replication);
        const bodyTaint = replication ? take(decodeHistoricalBody(fact, at, standing.decode)).taint
          : (take(decodeBody(fact, at, standing.decode)), []);
        validateRepair(fact, at);
        if (duplicate) return { fact: duplicate, durability: { kind: 'local-durable' as const }, taint: [...new Set([...standing.taint, ...bodyTaint])] };
        const receipt = take(storage.append(encoding(safe).bytes, persisted.at(-1)?.contentHash ?? null));
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
    const existing = context.facts.find(f => f.id === raw.id);
    if (existing) { requireFact(encoding(existing).bytes === encoding(safe).bytes, 'duplicate id changed bytes', 'integrity'); return existing; }
    const fact = take(decodeEnvelope(safe, context, 'replication'));
    extendsChain(fact, context); const standing = causalStanding(fact, context, false);
    take(decodeHistoricalBody(fact, context, standing.decode)); validateRepair(fact, context); return fact;
  });
}
export function reconcileAuthority(fact: FactEnvelope, context: FactContext, horizon: CausalFrontier): { taint: readonly AuthorityTaint[]; conflicts: readonly ConflictClass[] } {
  const state = causalStanding(fact, context, false);
  const named = context.grants.filter(g => fact.predecessors.required.includes(g.factId));
  const conflicts: ConflictClass[] = [];
  for (const row of context.revocations) {
    if (!named.some(g => g.grant.id === row.revocation.grantId)) continue;
    const rev = context.facts.find(f => f.id === row.factId); if (!rev) continue;
    const contains = (candidate: FactEnvelope, id: string) => {
      const seen = new Set<string>(); const queue = [candidate];
      while (queue.length) { const f = queue.pop()!; for (const parent of [f.predecessors.inSegment, ...f.predecessors.required]) if (parent !== null && !seen.has(parent)) { seen.add(parent); const p = context.facts.find(x => x.id === parent); if (p) queue.push(p); } }
      return seen.has(id);
    };
    const coneCovers = fact.predecessors.frontier[rev.machine];
    const after = contains(rev, fact.id) || (rev.predecessors.frontier[fact.machine] && (rev.predecessors.frontier[fact.machine]!.epoch > fact.segment.epoch || (rev.predecessors.frontier[fact.machine]!.epoch === fact.segment.epoch && rev.predecessors.frontier[fact.machine]!.position >= fact.segment.position)));
    const inCone = contains(fact, rev.id) || (coneCovers && (coneCovers.epoch > rev.segment.epoch || (coneCovers.epoch === rev.segment.epoch && coneCovers.position >= rev.segment.position)));
    if (!inCone && !after) conflicts.push({ key: `revocation:${fact.id}:${rev.id}`, kind: 'revocation-conflict', facts: [fact.id, rev.id], detail: 'revocation concurrent or prior-but-unseen' });
  }
  const fullyObserved = Object.entries(context.folded).every(([m, p]) => horizon[m] && (horizon[m]!.epoch > p.epoch || (horizon[m]!.epoch === p.epoch && horizon[m]!.position >= p.position)));
  return frozen({ taint: conflicts.length ? ['contested'] : fullyObserved ? [] : state.taint, conflicts });
}
