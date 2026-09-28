/**
 * Rule 114 — agency composes recursively. Design 09 §6 (delegation binds both
 * ends) realized as one durable, append-only edge ledger. Every parent-child
 * edge is a durable record naming scope, owner, grant, budget, exit test,
 * placement, transport, cancellation and result destination BEFORE any offer
 * can be produced for it. The ledger is a pure fold over records read from an
 * owner-supplied store port; it has no clock, timer, transport or storage of
 * its own. Delivery evidence arrives from the agent-transport port (part six).
 *
 * Deliberate bounds of this slice: references (principals, grants, intents,
 * evidence) are opaque owner-issued ids, never live authority; the receiving
 * agent maps the reserved child identity to its own run through a durable
 * acceptance record, so the Run decoder's depth-one slice is unchanged.
 */
import type { BoundaryContext, Result } from '../index.js';
import { boundary, encoded, freeze, need } from './boundary.js';
import { INITIAL_MAX_CHILDREN, INITIAL_MAX_DEPTH } from './limits.js';

export type DelegationDurability = 'local-durable' | 'replicated';
export type DeliveryState = 'accepted-by-transport' | 'durably-queued' | 'delivered-to-worker' | 'answered' | 'refused' | 'uncertain';
export const DELIVERY_STATES: readonly DeliveryState[] = freeze(['accepted-by-transport', 'durably-queued',
  'delivered-to-worker', 'answered', 'refused', 'uncertain']);

/** The bounded authority a run may delegate from: the root run's own, or an accepted edge's. */
export interface DelegationAuthority {
  readonly run: string;
  readonly edge: string | null;
  readonly depth: number;
  readonly owner: string;
  readonly scope: readonly string[];
  readonly actions: readonly string[];
  readonly grants: readonly string[];
  readonly budget: number;
  readonly maxChildren: number;
  readonly maxDepth: number;
  readonly expiresAt: number;
}
export interface CapabilityAdvertisement {
  readonly agent: string; readonly machine: string; readonly harness: string; readonly model: string;
  readonly transport: string; readonly capabilities: readonly string[];
  readonly observedAt: number; readonly freshFor: number; readonly capacity: number;
  readonly trust: 'trusted' | 'revoked';
}
/** Capability and trust are inputs to placement, never grant records. */
export interface PlacementDecision {
  readonly agent: string; readonly machine: string; readonly harness: string; readonly model: string;
  readonly transport: string; readonly required: readonly string[]; readonly advertised: readonly string[];
  readonly observedAt: number; readonly decidedAt: number; readonly reason: string;
}
export interface DelegationRequest {
  readonly parent: DelegationAuthority;
  readonly intent: string;
  readonly recipient: string;
  readonly question: string;
  readonly method: readonly string[];
  readonly scope: readonly string[];
  readonly actions: readonly string[];
  readonly grants: readonly string[];
  readonly budget: number;
  readonly exitTest: Readonly<{ check: string; version: string; evidence: readonly string[] }>;
  readonly placement: PlacementDecision;
  readonly conversation: string;
  readonly resultDestination: Readonly<{ run: string; edge: string | null }>;
  readonly childLimit: Readonly<{ maxChildren: number; maxDepth: number }>;
  readonly collectionCadence: number;
  readonly durability: DelegationDurability;
  readonly sequence: number;
  readonly at: number;
  readonly generation: string;
}
export interface DelegationContract {
  readonly type: 'DelegationContract'; readonly schemaVersion: 1; readonly id: string;
  readonly parentRun: string; readonly parentEdge: string | null; readonly childRun: string; readonly depth: number;
  readonly intent: string; readonly owner: string; readonly recipient: string;
  readonly task: Readonly<{ question: string; method: readonly string[] }>;
  readonly scope: readonly string[]; readonly actions: readonly string[]; readonly grants: readonly string[];
  readonly budget: number; readonly ancestors: readonly string[];
  readonly exitTest: Readonly<{ check: string; version: string; evidence: readonly string[] }>;
  readonly placement: PlacementDecision;
  readonly transport: Readonly<{ adapter: string; conversation: string }>;
  readonly resultDestination: Readonly<{ run: string; edge: string | null }>;
  /** Cancelling the parent edge cancels this one; this edge never outlives its return endpoint. */
  readonly cancellation: Readonly<{ followsEdge: string | null }>;
  readonly childLimit: Readonly<{ maxChildren: number; maxDepth: number }>;
  readonly collectionCadence: number; readonly durability: DelegationDurability;
  readonly expiresAt: number; readonly createdAt: number; readonly generation: string; readonly digest: string;
}
export interface DeliveryEvidence {
  readonly type: 'DeliveryEvidence'; readonly schemaVersion: 1;
  /** Semantic message key: sender, edge, kind, sequence. Stable across routes and retries. */
  readonly key: string; readonly digest: string; readonly edge: string; readonly conversation: string;
  readonly state: DeliveryState;
  /** The party that can prove the state. */
  readonly witness: Readonly<{ kind: 'transport' | 'custodian' | 'recipient' | 'observer'; principal: string }>;
  readonly authoritative: string; readonly attempt: string; readonly observedAt: number; readonly freshFor: number;
  readonly durability?: 'memory' | DelegationDurability;
  readonly refusedWhat?: 'transport-send' | 'receiving-admission' | 'delegated-work';
  readonly unresolved?: string;
}
export interface DelegationResult {
  readonly type: 'DelegationResult'; readonly schemaVersion: 1;
  readonly edge: string; readonly childRun: string; readonly contractDigest: string;
  readonly terminal: 'completed' | 'refused' | 'cancelled' | 'failed';
  readonly result: string; readonly evidence: readonly string[]; readonly effects: readonly string[];
  readonly submittedBy: string; readonly digest: string;
}
export type DelegationRecord =
  | Readonly<{ record: 'edge'; contract: DelegationContract }>
  | Readonly<{ record: 'acceptance'; edge: string; recipient: string; childRun: string; localRun: string; at: number }>
  | Readonly<{ record: 'evidence'; evidence: DeliveryEvidence }>
  | Readonly<{ record: 'result'; result: DelegationResult }>
  | Readonly<{ record: 'collection'; edge: string; terminal: string; digest: string; at: number }>
  | Readonly<{ record: 'cancel'; edge: string; by: string; reason: string; at: number }>
  | Readonly<{ record: 'conflict'; edge: string; subject: string; left: string; right: string; at: number }>;
export interface DelegationAppendReceipt { readonly durability: DelegationDurability; readonly replicas: number }
/** Owner-supplied durable store. `append` returns only after the record is durable at the stated level. */
export interface DelegationStorePort {
  read(): readonly DelegationRecord[];
  append(record: DelegationRecord): DelegationAppendReceipt;
}
export interface EdgeView {
  readonly contract: DelegationContract;
  readonly acceptance: Readonly<{ recipient: string; localRun: string }> | null;
  readonly proven: readonly DeliveryState[];
  readonly lastProven: DeliveryState | null;
  readonly uncertain: readonly string[];
  readonly refusals: readonly NonNullable<DeliveryEvidence['refusedWhat']>[];
  readonly result: DelegationResult | null;
  readonly collected: boolean;
  readonly cancellation: 'none' | 'requested' | 'confirmed';
  readonly conflicts: readonly string[];
  /** Owned while its result is uncollected or its cancellation unconfirmed — even after parent or worker loss. */
  readonly owned: boolean;
}
export type RetryPlan = Readonly<{ mode: 'wait'; reason: string }>
  | Readonly<{ mode: 'lookup'; key: string; reason: string }>
  | Readonly<{ mode: 'resubmit'; key: string; reason: string }>
  | Readonly<{ mode: 'none'; reason: string }>;

const sorted = (values: readonly string[]) => [...new Set(values)].sort();
const subset = (child: readonly string[], parent: readonly string[]) => child.every(item => parent.includes(item));
const text = (value: unknown, name: string) => need(typeof value === 'string' && value.length > 0 && value.length <= 4096, `${name} required`);
const count = (value: unknown, name: string) => need(Number.isSafeInteger(value) && (value as number) >= 0, `${name} must be a finite count`);

/** Deterministic, capability-aware placement. Trust and capability are inputs; the choice records its reason. */
export function placeDelegation(required: readonly string[], candidates: readonly CapabilityAdvertisement[],
  now: number, context: BoundaryContext): Result<PlacementDecision> {
  return boundary('DelegationPlacement', { required: sorted(required), candidates: candidates.length, now }, context, () => {
    const reasons: string[] = [];
    const eligible = candidates.filter(candidate => {
      const why = candidate.trust !== 'trusted' ? 'trust revoked'
        : now > candidate.observedAt + candidate.freshFor ? 'advertisement stale'
          : candidate.capacity <= 0 ? 'no capacity'
            : !subset(required, candidate.capabilities) ? `missing ${required.filter(c => !candidate.capabilities.includes(c)).join(',')}` : '';
      if (why) reasons.push(`${candidate.agent}@${candidate.machine}: ${why}`);
      return !why;
    }).sort((a, b) => b.capacity - a.capacity || a.agent.localeCompare(b.agent) || a.machine.localeCompare(b.machine));
    const chosen = eligible[0];
    need(chosen, `no placement satisfies required capabilities (${reasons.join('; ') || 'no candidates'})`);
    return { agent: chosen.agent, machine: chosen.machine, harness: chosen.harness, model: chosen.model,
      transport: chosen.transport, required: sorted(required), advertised: sorted(chosen.capabilities),
      observedAt: chosen.observedAt, decidedAt: now,
      reason: `chosen: all ${required.length} required capabilities advertised, fresh, trusted, capacity ${chosen.capacity}` };
  });
}

/** The authority the child run may delegate from, derived only from its durable edge. */
export function childAuthority(contract: DelegationContract): DelegationAuthority {
  return freeze({ run: contract.childRun, edge: contract.id, depth: contract.depth, owner: contract.recipient,
    scope: contract.scope, actions: contract.actions, grants: contract.grants, budget: contract.budget,
    maxChildren: contract.childLimit.maxChildren, maxDepth: contract.childLimit.maxDepth, expiresAt: contract.expiresAt });
}

export function foldDelegation(records: readonly DelegationRecord[]): ReadonlyMap<string, EdgeView> {
  type Mutable = { contract: DelegationContract; acceptance: EdgeView['acceptance']; lastProven: DeliveryState | null;
    uncertain: string[]; refusals: NonNullable<DeliveryEvidence['refusedWhat']>[]; result: DelegationResult | null;
    collected: boolean; conflicts: string[]; proofs: Set<DeliveryState>; cancelRequested: boolean };
  const edges = new Map<string, Mutable>();
  for (const row of records) {
    if (row.record === 'edge') {
      const prior = edges.get(row.contract.id);
      if (prior) { if (prior.contract.digest !== row.contract.digest) prior.conflicts.push(`edge digest ${row.contract.digest}`); continue; }
      edges.set(row.contract.id, { contract: row.contract, acceptance: null, lastProven: null, uncertain: [], refusals: [],
        result: null, collected: false, conflicts: [], proofs: new Set(), cancelRequested: false });
      continue;
    }
    const edgeId = row.record === 'evidence' ? row.evidence.edge : row.record === 'result' ? row.result.edge : row.edge;
    const edge = edges.get(edgeId);
    if (!edge) continue;
    if (row.record === 'acceptance') {
      if (!edge.acceptance) edge.acceptance = { recipient: row.recipient, localRun: row.localRun };
      else if (edge.acceptance.recipient !== row.recipient || edge.acceptance.localRun !== row.localRun)
        edge.conflicts.push(`second acceptance ${row.recipient}/${row.localRun}`);
    } else if (row.record === 'evidence') {
      const e = row.evidence;
      if (e.state === 'uncertain') edge.uncertain.push(e.unresolved ?? 'unknown');
      else {
        edge.proofs.add(e.state); edge.lastProven = e.state;
        if (e.state === 'refused' && e.refusedWhat) edge.refusals.push(e.refusedWhat);
      }
    } else if (row.record === 'result') {
      if (!edge.result) edge.result = row.result;
      else if (edge.result.digest !== row.result.digest) edge.conflicts.push(`result digest ${row.result.digest}`);
      edge.proofs.add('answered');
    } else if (row.record === 'collection') edge.collected = true;
    else if (row.record === 'cancel') edge.cancelRequested = true;
    else if (row.record === 'conflict') edge.conflicts.push(`${row.subject}: ${row.left} vs ${row.right}`);
  }
  const view = new Map<string, EdgeView>();
  for (const [id, edge] of edges) {
    const refusedBeforeWork = edge.refusals.some(what => what === 'transport-send' || what === 'receiving-admission')
      && !edge.proofs.has('delivered-to-worker') && !edge.result;
    const cancellation = !edge.cancelRequested ? 'none'
      : edge.result || refusedBeforeWork ? 'confirmed' : 'requested';
    const settledWithoutResult = refusedBeforeWork && edge.cancelRequested;
    view.set(id, freeze({ contract: edge.contract, acceptance: edge.acceptance,
      proven: DELIVERY_STATES.filter(state => edge.proofs.has(state)), lastProven: edge.lastProven,
      uncertain: [...edge.uncertain], refusals: [...edge.refusals], result: edge.result, collected: edge.collected,
      cancellation, conflicts: [...edge.conflicts],
      owned: !(edge.collected || settledWithoutResult) || cancellation === 'requested' }));
  }
  return view;
}

export interface DelegationLedger {
  /** Validate the child against its parent authority and make the edge durable. No offer exists before this returns. */
  delegate(request: DelegationRequest): Result<DelegationContract>;
  /** Receiver side: the durable, exclusive mapping of the reserved child to the recipient's own run. */
  /** Receiver side: durably copy an offered contract whose digest is intact. Same identity, different content is a Conflict. */
  receiveEdge(contract: DelegationContract, at: number): Result<EdgeView>;
  accept(edge: string, recipient: string, localRun: string, at: number): Result<EdgeView>;
  record(evidence: DeliveryEvidence): Result<EdgeView>;
  /** Idempotent by (edge, terminal): equal content returns the stored result; different content is a Conflict. */
  submit(result: DelegationResult, at: number): Result<EdgeView>;
  /** Exactly once per (edge, terminal) as a logical transition; replays return the existing collection. */
  collect(edge: string, at: number): Result<EdgeView>;
  /** Cancels the edge and every descendant edge; each stays owned until its cancellation is confirmed. */
  cancel(edge: string, by: string, reason: string, at: number): Result<readonly string[]>;
  retry(edge: string): Result<RetryPlan>;
  view(): ReadonlyMap<string, EdgeView>;
  outstanding(): readonly EdgeView[];
}

export function createDelegationLedger(store: DelegationStorePort, context: BoundaryContext): DelegationLedger {
  const view = () => foldDelegation(store.read());
  const edgeOf = (id: string) => { const edge = view().get(id); need(edge, `unknown delegation edge ${id}`); return edge; };
  const durable = (record: DelegationRecord, demand: DelegationDurability) => {
    const receipt = store.append(record);
    need(demand === 'local-durable' || (receipt.durability === 'replicated' && receipt.replicas >= 1),
      `replication demand unmet: ${receipt.durability} with ${receipt.replicas} replica(s)`);
    return receipt;
  };
  const descendants = (edge: DelegationContract, all: ReadonlyMap<string, EdgeView>): string[] => {
    const children = [...all.values()].filter(child => child.contract.parentRun === edge.childRun).map(child => child.contract);
    return children.flatMap(child => [child.id, ...descendants(child, all)]);
  };
  return freeze({
    delegate: request => boundary('DelegationEdge', { recipient: request.recipient, sequence: request.sequence }, context, () => {
      const p = request.parent;
      for (const [value, name] of [[request.intent, 'intent'], [request.recipient, 'recipient'], [request.question, 'question'],
        [request.conversation, 'conversation'], [request.generation, 'generation'], [p.run, 'parent run'], [p.owner, 'parent owner'],
        [request.exitTest.check, 'exit check'], [request.resultDestination.run, 'result destination']] as const) text(value, name);
      for (const [value, name] of [[request.budget, 'budget'], [request.sequence, 'sequence'], [request.at, 'clock'],
        [request.collectionCadence, 'collection cadence'], [request.childLimit.maxChildren, 'child limit'], [request.childLimit.maxDepth, 'depth limit']] as const)
        count(value, name);
      need(request.at < p.expiresAt, 'parent authority expired');
      need(request.placement.agent === request.recipient, 'placement agent differs from recipient');
      need(subset(request.placement.required, request.placement.advertised), 'placement lacks a required capability');
      // Authority never grows by being delegated (design 09 §6; P5-NF-31).
      need(subset(request.scope, p.scope), 'delegated scope exceeds parent scope');
      need(subset(request.actions, p.actions), 'delegated actions exceed parent actions');
      need(subset(request.grants, p.grants), 'delegated grant not held by parent');
      const id = `delegation:${encoded({ parent: p.run, recipient: request.recipient, sequence: request.sequence, intent: request.intent }).hash}`;
      const all = view();
      const retrieved = all.get(id);
      const depth = p.depth + 1;
      need(depth <= Math.min(p.maxDepth, INITIAL_MAX_DEPTH), `delegation depth ${depth} exceeds limit`);
      need(request.childLimit.maxDepth <= p.maxDepth && request.childLimit.maxChildren <= p.maxChildren,
        'child delegation limit exceeds parent limit');
      const siblings = [...all.values()].filter(edge => edge.contract.parentRun === p.run && edge.contract.id !== id);
      need(siblings.length < Math.min(p.maxChildren, INITIAL_MAX_CHILDREN), `parent already has ${siblings.length} children`);
      // Ancestor allocation: concurrent children share the parent's finite budget.
      const allocated = siblings.reduce((sum, edge) => sum + edge.contract.budget, 0);
      need(allocated + request.budget <= p.budget, `budget ${request.budget} exceeds remaining parent allocation ${p.budget - allocated}`);
      need(request.method.every(item => typeof item === 'string' && item.length <= 1024), 'method constraints malformed');
      const ancestors = p.edge ? [...(all.get(p.edge)?.contract.ancestors ?? []), p.edge] : [];
      const body = { type: 'DelegationContract' as const, schemaVersion: 1 as const,
        parentRun: p.run, parentEdge: p.edge, depth, intent: request.intent, owner: p.owner, recipient: request.recipient,
        task: { question: request.question, method: [...request.method] }, scope: sorted(request.scope),
        actions: sorted(request.actions), grants: sorted(request.grants), budget: request.budget, ancestors,
        exitTest: { check: request.exitTest.check, version: request.exitTest.version, evidence: sorted(request.exitTest.evidence) },
        placement: request.placement, transport: { adapter: request.placement.transport, conversation: request.conversation },
        resultDestination: { ...request.resultDestination }, cancellation: { followsEdge: p.edge },
        childLimit: { ...request.childLimit }, collectionCadence: request.collectionCadence, durability: request.durability,
        expiresAt: p.expiresAt, createdAt: request.at, generation: request.generation };
      const childRun = `child:${encoded({ edge: id }).hash}`;
      const contract: DelegationContract = { ...body, id, childRun, digest: encoded({ ...body, id, childRun }).hash };
      if (retrieved) {
        need(retrieved.contract.digest === contract.digest, 'same delegation identity with different content is a Conflict');
        return retrieved.contract;
      }
      durable({ record: 'edge', contract }, request.durability);
      return contract;
    }),
    receiveEdge: (contract, at) => boundary('DelegationReceivedEdge', { edge: contract.id }, context, () => {
      const { digest, ...body } = contract;
      need(encoded(body).hash === digest, 'contract digest does not match its fields');
      need(contract.id.startsWith('delegation:') && contract.childRun === `child:${encoded({ edge: contract.id }).hash}`, 'child identity not reserved by this edge');
      need(at < contract.expiresAt, 'delegation expired before receipt');
      const existing = view().get(contract.id);
      if (existing) {
        if (existing.contract.digest !== digest) {
          store.append({ record: 'conflict', edge: contract.id, subject: 'edge', left: existing.contract.digest, right: digest, at });
          throw new Error('Conflict: a different contract under the same edge identity');
        }
        return existing;
      }
      durable({ record: 'edge', contract }, contract.durability);
      return edgeOf(contract.id);
    }),
    accept: (edgeId, recipient, localRun, at) => boundary('DelegationAcceptance', { edge: edgeId }, context, () => {
      const edge = edgeOf(edgeId);
      need(edge.contract.recipient === recipient, 'acceptance by a principal other than the contract recipient');
      need(at < edge.contract.expiresAt, 'delegation expired before acceptance');
      if (edge.acceptance) {
        if (edge.acceptance.localRun !== localRun) {
          store.append({ record: 'conflict', edge: edgeId, subject: 'acceptance', left: edge.acceptance.localRun, right: localRun, at });
          throw new Error('exclusive edge already accepted by a different run');
        }
        return edge;
      }
      durable({ record: 'acceptance', edge: edgeId, recipient, childRun: edge.contract.childRun, localRun, at }, edge.contract.durability);
      return edgeOf(edgeId);
    }),
    record: evidence => boundary('DeliveryEvidence', { key: evidence.key, state: evidence.state }, context, () => {
      const edge = edgeOf(evidence.edge);
      text(evidence.key, 'message key'); text(evidence.authoritative, 'authoritative record'); text(evidence.attempt, 'delivery attempt');
      need(evidence.conversation === edge.contract.transport.conversation, 'evidence names another conversation');
      // Each state names the party that can prove it (design 09 §7; P5-NF-37/40/41).
      const w = evidence.witness;
      if (evidence.state === 'accepted-by-transport') need(w.kind === 'transport', 'transport acceptance needs the transport witness');
      if (evidence.state === 'durably-queued') need(w.kind === 'custodian' && evidence.durability !== undefined
        && evidence.durability !== 'memory', 'a memory buffer cannot claim durable queueing');
      if (evidence.state === 'delivered-to-worker' || evidence.state === 'answered')
        need(w.kind === 'recipient' && w.principal === edge.contract.recipient, `${evidence.state} requires the recipient's own record`);
      if (evidence.state === 'answered') need(edge.result !== null, 'answered requires the durable DelegationResult');
      if (evidence.state === 'refused') need(evidence.refusedWhat !== undefined, 'a refusal names what did not happen');
      if (evidence.state === 'uncertain') text(evidence.unresolved, 'uncertain evidence names its unresolved question');
      store.append({ record: 'evidence', evidence });
      return edgeOf(evidence.edge);
    }),
    submit: (result, at) => boundary('DelegationResult', { edge: result.edge, terminal: result.terminal }, context, () => {
      const edge = edgeOf(result.edge);
      need(result.childRun === edge.contract.childRun && result.contractDigest === edge.contract.digest, 'result is bound to another contract');
      need(result.submittedBy === edge.contract.recipient, 'result submitted by a principal other than the recipient');
      if (edge.result) {
        if (edge.result.digest !== result.digest) {
          store.append({ record: 'conflict', edge: result.edge, subject: 'result', left: edge.result.digest, right: result.digest, at });
          throw new Error('Conflict: a different result for the same edge');
        }
        return edge;
      }
      // A late result after parent or worker loss is still admitted: the durable return endpoint outlives both.
      durable({ record: 'result', result }, edge.contract.durability);
      return edgeOf(result.edge);
    }),
    collect: (edgeId, at) => boundary('DelegationCollection', { edge: edgeId }, context, () => {
      const edge = edgeOf(edgeId);
      need(edge.result, 'nothing to collect: no terminal result');
      if (edge.collected) return edge;
      durable({ record: 'collection', edge: edgeId, terminal: edge.result.terminal, digest: edge.result.digest, at }, edge.contract.durability);
      return edgeOf(edgeId);
    }),
    cancel: (edgeId, by, reason, at) => boundary('DelegationCancel', { edge: edgeId }, context, () => {
      const all = view(), edge = all.get(edgeId);
      need(edge, `unknown delegation edge ${edgeId}`);
      need(by === edge.contract.owner, 'only the accountable parent may cancel its edge');
      const targets = [edgeId, ...descendants(edge.contract, all)];
      for (const target of targets) if (all.get(target)!.cancellation === 'none' && !all.get(target)!.result)
        store.append({ record: 'cancel', edge: target, by, reason, at });
      return targets;
    }),
    retry: edgeId => boundary('DelegationRetry', { edge: edgeId }, context, () => {
      const edge = edgeOf(edgeId), key = offerKey(edge.contract);
      if (edge.result) return { mode: 'none' as const, reason: 'terminal result already durable' };
      const custody = edge.proven.some(state => state === 'durably-queued' || state === 'delivered-to-worker');
      if (custody) return { mode: 'wait' as const, reason: 'durable custody proven; waiting, never resubmitting' };
      if (edge.refusals.includes('transport-send') && !edge.proven.includes('accepted-by-transport') && edge.uncertain.length === 0)
        return { mode: 'resubmit' as const, key, reason: 'transport proved the send did not happen; same semantic key' };
      return { mode: 'lookup' as const, key, reason: 'delivery uncertain; read-only lookup by the same semantic key' };
    }),
    view,
    outstanding: () => [...view().values()].filter(edge => edge.owned),
  });
}

/** The semantic key of an edge's offer: sender, edge, kind, sequence. Retries never change it. */
export function offerKey(contract: DelegationContract): string {
  return `${contract.owner}|${contract.id}|offer|0`;
}
