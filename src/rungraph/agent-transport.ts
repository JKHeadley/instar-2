/**
 * Part five: Rule 114 — the protocol-independent agent-transport port (design 09 §7) and
 * the receiving endpoint every adapter delivers into. Work-engine code talks to
 * `AgentTransportPort` only; it never branches on a protocol, harness or model
 * name. A positive response names the narrow operation that succeeded, never
 * completion of the delegated task. Uncertainty is carried inside delivered
 * evidence, never encoded as a refusal (which means "did not happen").
 *
 * Accepted delivery, acknowledgement, worker consumption and result are distinct
 * stages with distinct witnesses. Lookup mode is read-only: it can return
 * stored custody or results, never create work or resubmit an uncertain offer.
 */
import type { BoundaryContext, Result } from '../index.js';
import { consumeResult } from '../index.js';
import type { CapabilityAdvertisement, DelegationContract, DelegationLedger, DelegationResult,
  DeliveryEvidence, DeliveryState } from './delegation.js';
import { offerKey } from './delegation.js';
import { boundary, encoded, freeze, need as ensure } from './boundary.js';

export type AgentEnvelopeKind = 'offer' | 'progress' | 'result' | 'cancel' | 'receipt';
export interface AgentTransportEnvelope {
  readonly type: 'AgentTransportEnvelope'; readonly schemaVersion: 1;
  readonly kind: AgentEnvelopeKind;
  /** Semantic key: sender, edge, kind, sequence. Stable across routes, attempts and duplicates. */
  readonly key: string;
  readonly sender: string; readonly recipient: string; readonly edge: string;
  readonly parentRun: string; readonly childRun: string; readonly conversation: string;
  readonly contractDigest: string; readonly scope: readonly string[]; readonly grants: readonly string[];
  readonly resultDestination: Readonly<{ run: string; edge: string | null }>;
  /** A result or cancellation names the original offer. */
  readonly answers: string | null;
  readonly contract: DelegationContract | null;
  readonly result: DelegationResult | null;
  readonly reason: string | null;
  readonly at: number;
  /** Canonical digest over every field above. */
  readonly digest: string;
}
export type SendMode = 'submit' | 'lookup';
/** The port every adapter implements. */
export interface AgentTransportPort {
  /** Adapter declaration, recorded with evidence; never a branch condition in the work engine. */
  readonly adapter: string;
  describe(peer: string, required: readonly string[]): Result<readonly CapabilityAdvertisement[]>;
  send(envelope: AgentTransportEnvelope, attempt: string, mode: SendMode): Result<DeliveryEvidence>;
  observe(envelope: AgentTransportEnvelope, attempt: string): Result<DeliveryEvidence>;
}
/** What the receiving agent can prove about a message key, from its own durable records. */
export type EndpointReceipt = Readonly<{
  key: string; digest: string; state: Exclude<DeliveryState, 'accepted-by-transport' | 'uncertain'> | 'unknown';
  refusedWhat?: 'receiving-admission' | 'delegated-work'; authoritative: string; result: DelegationResult | null;
  durability: 'local-durable' | 'replicated' | null;
}>;
export type WorkerOutcome = Readonly<{ terminal: DelegationResult['terminal']; result: string; evidence?: readonly string[]; effects?: readonly string[] }>;
/** The actual worker. `null` means still working (e.g. waiting on its own children).
 * Throwing models worker loss: nothing is recorded as done and the child stays owned. */
export type DelegatedWorker = (contract: DelegationContract, authority: Readonly<{ localRun: string }>) => WorkerOutcome | null;
export interface AgentEndpoint {
  readonly principal: string;
  readonly advertisement: () => CapabilityAdvertisement;
  /** Durable admission of an inbound envelope. Duplicates return the stored disposition. */
  receive(envelope: AgentTransportEnvelope, at: number): EndpointReceipt;
  /** Read-only lookup by semantic key. No work creation, launch or provider call. */
  lookup(key: string, digest: string): EndpointReceipt;
  /** Offer each admitted, unanswered, uncancelled child to the worker once per call; returns result envelopes to return. */
  work(worker: DelegatedWorker, at: number): readonly AgentTransportEnvelope[];
}

export function sealEnvelope(fields: Omit<AgentTransportEnvelope, 'type' | 'schemaVersion' | 'digest'>): AgentTransportEnvelope {
  const body = { type: 'AgentTransportEnvelope' as const, schemaVersion: 1 as const, ...fields };
  return freeze({ ...body, digest: encoded(body).hash });
}
/** The digest a semantic key is deduplicated by: a result's own digest, else the envelope's. */
export function semanticDigest(envelope: AgentTransportEnvelope): string { return envelope.result?.digest ?? envelope.digest; }
export function envelopeIntact(envelope: AgentTransportEnvelope): boolean {
  const { digest, ...body } = envelope;
  try { return encoded(body).hash === digest; } catch { return false; }
}
export function offerEnvelope(contract: DelegationContract): AgentTransportEnvelope {
  return sealEnvelope({ kind: 'offer', key: offerKey(contract), sender: contract.owner, recipient: contract.recipient,
    edge: contract.id, parentRun: contract.parentRun, childRun: contract.childRun, conversation: contract.transport.conversation,
    contractDigest: contract.digest, scope: contract.scope, grants: contract.grants, resultDestination: contract.resultDestination,
    answers: null, contract, result: null, reason: null, at: contract.createdAt });
}
export function cancelEnvelope(contract: DelegationContract, reason: string, at: number): AgentTransportEnvelope {
  return sealEnvelope({ kind: 'cancel', key: `${contract.owner}|${contract.id}|cancel|0`, sender: contract.owner, recipient: contract.recipient,
    edge: contract.id, parentRun: contract.parentRun, childRun: contract.childRun, conversation: contract.transport.conversation,
    contractDigest: contract.digest, scope: contract.scope, grants: contract.grants, resultDestination: contract.resultDestination,
    answers: offerKey(contract), contract: null, result: null, reason, at });
}
export function resultEnvelope(contract: DelegationContract, result: DelegationResult, at: number): AgentTransportEnvelope {
  return sealEnvelope({ kind: 'result', key: `${contract.recipient}|${contract.id}|result|0`, sender: contract.recipient, recipient: contract.owner,
    edge: contract.id, parentRun: contract.parentRun, childRun: contract.childRun, conversation: contract.transport.conversation,
    contractDigest: contract.digest, scope: contract.scope, grants: contract.grants, resultDestination: contract.resultDestination,
    answers: offerKey(contract), contract: null, result, reason: null, at });
}
export function resultFor(contract: DelegationContract, outcome: WorkerOutcome): DelegationResult {
  const body = { type: 'DelegationResult' as const, schemaVersion: 1 as const, edge: contract.id, childRun: contract.childRun,
    contractDigest: contract.digest, terminal: outcome.terminal, result: outcome.result, evidence: [...(outcome.evidence ?? [])],
    effects: [...(outcome.effects ?? [])], submittedBy: contract.recipient };
  return freeze({ ...body, digest: encoded(body).hash });
}

const succeeded = <T>(result: Result<T>): T | undefined => consumeResult(result, { Success: value => value, Refused: () => undefined });

/**
 * The receiving side, shared by every adapter. Its durable records live in the
 * agent's own delegation ledger: an inbound offer becomes a durable edge copy
 * and acceptance BEFORE any receipt is returned; results and cancellations for
 * edges this agent owns are admitted through the same ledger.
 */
export function createAgentEndpoint(input: Readonly<{ principal: string; ledger: DelegationLedger;
  advertisement: () => CapabilityAdvertisement; localRunFor?: (edge: string) => string }>): AgentEndpoint {
  const { principal, ledger } = input;
  const seen = (): Map<string, string> => {
    // Semantic dedup is derived from durable records only, so a restart cannot forget it.
    const keys = new Map<string, string>();
    for (const edge of ledger.view().values()) {
      if (edge.contract.recipient === principal && edge.acceptance) keys.set(offerKey(edge.contract), offerEnvelope(edge.contract).digest);
      if (edge.contract.owner === principal && edge.result) keys.set(`${edge.contract.recipient}|${edge.contract.id}|result|0`, edge.result.digest);
    }
    return keys;
  };
  const receipt = (key: string, digest: string): EndpointReceipt => {
    for (const edge of ledger.view().values()) {
      const offer = offerKey(edge.contract);
      const asRecipient = edge.contract.recipient === principal && key === offer;
      const asOwner = edge.contract.owner === principal && key === `${edge.contract.recipient}|${edge.contract.id}|result|0`;
      if (!asRecipient && !asOwner) continue;
      if (asOwner && !edge.result) break;
      // Custody is claimed only once the recipient's durable acceptance exists.
      if (asRecipient && !edge.acceptance) break;
      const stored = asRecipient ? offerEnvelope(edge.contract).digest : edge.result?.digest;
      if (stored !== digest) return freeze({ key, digest, state: 'refused', refusedWhat: 'receiving-admission',
        authoritative: `conflict:${edge.contract.id}`, result: null, durability: null });
      const state = edge.result ? 'answered' : edge.proven.includes('delivered-to-worker') ? 'delivered-to-worker' : 'durably-queued';
      return freeze({ key, digest, state: asOwner ? 'durably-queued' : state, authoritative: `ledger:${edge.contract.id}`,
        result: asRecipient ? edge.result : null, durability: edge.contract.durability });
    }
    return freeze({ key, digest, state: 'unknown', authoritative: 'none', result: null, durability: null });
  };
  return freeze({
    principal,
    advertisement: input.advertisement,
    lookup: receipt,
    receive: (envelope, at) => {
      if (!envelopeIntact(envelope) || envelope.recipient !== principal)
        return freeze({ key: envelope.key, digest: envelope.digest, state: 'refused', refusedWhat: 'receiving-admission',
          authoritative: 'integrity', result: null, durability: null });
      const known = seen().get(envelope.key);
      if (known !== undefined) return receipt(envelope.key, semanticDigest(envelope));
      if (envelope.kind === 'offer') {
        const contract = envelope.contract;
        const { digest: _digest, ...body } = contract ?? ({} as DelegationContract);
        void _digest;
        if (!contract || encoded(body).hash !== contract.digest || contract.id !== envelope.edge || contract.recipient !== principal)
          return freeze({ key: envelope.key, digest: envelope.digest, state: 'refused', refusedWhat: 'receiving-admission',
            authoritative: 'contract', result: null, durability: null });
        // Receiving admission rechecks placement compatibility before any worker start.
        const own = input.advertisement();
        if (!contract.placement.required.every(capability => own.capabilities.includes(capability)))
          return freeze({ key: envelope.key, digest: envelope.digest, state: 'refused', refusedWhat: 'receiving-admission',
            authoritative: 'capability', result: null, durability: null });
        if (!succeeded(ledger.receiveEdge(contract, at))) return freeze({ key: envelope.key, digest: envelope.digest, state: 'refused',
          refusedWhat: 'receiving-admission', authoritative: 'edge', result: null, durability: null });
        if (!succeeded(ledger.accept(contract.id, principal, input.localRunFor?.(contract.id) ?? `local:${contract.childRun}`, at)))
          return freeze({ key: envelope.key, digest: envelope.digest, state: 'refused', refusedWhat: 'receiving-admission',
            authoritative: 'acceptance', result: null, durability: null });
        return receipt(envelope.key, envelope.digest);
      }
      const edge = ledger.view().get(envelope.edge);
      if (envelope.kind === 'cancel') {
        if (!edge || edge.contract.recipient !== principal || edge.contract.owner !== envelope.sender)
          return freeze({ key: envelope.key, digest: envelope.digest, state: 'refused', refusedWhat: 'receiving-admission',
            authoritative: 'cancel', result: null, durability: null });
        if (!edge.result) ledger.cancel(envelope.edge, envelope.sender, envelope.reason ?? 'cancelled', at);
        return freeze({ key: envelope.key, digest: envelope.digest, state: 'durably-queued', authoritative: `cancel:${envelope.edge}`,
          result: null, durability: edge.contract.durability });
      }
      if (envelope.kind === 'result' && envelope.result && edge && edge.contract.owner === principal) {
        if (!succeeded(ledger.submit(envelope.result, at))) return freeze({ key: envelope.key, digest: envelope.digest,
          state: 'refused', refusedWhat: 'receiving-admission', authoritative: 'result', result: null, durability: null });
        return receipt(envelope.key, envelope.result.digest);
      }
      return freeze({ key: envelope.key, digest: envelope.digest, state: 'refused', refusedWhat: 'receiving-admission',
        authoritative: 'unsupported', result: null, durability: null });
    },
    work: (worker, at) => {
      const out: AgentTransportEnvelope[] = [];
      for (const edge of ledger.view().values()) {
        if (edge.contract.recipient !== principal || !edge.acceptance || edge.result) continue;
        if (edge.cancellation !== 'none') {
          const cancelled = resultFor(edge.contract, { terminal: 'cancelled', result: 'cancelled before completion' });
          if (succeeded(ledger.submit(cancelled, at))) out.push(resultEnvelope(edge.contract, cancelled, at));
          continue;
        }
        if (!edge.proven.includes('delivered-to-worker'))
          ledger.record({ type: 'DeliveryEvidence', schemaVersion: 1, key: offerKey(edge.contract), digest: offerEnvelope(edge.contract).digest,
            edge: edge.contract.id, conversation: edge.contract.transport.conversation, state: 'delivered-to-worker',
            witness: { kind: 'recipient', principal }, authoritative: `worker:${edge.acceptance.localRun}`, attempt: `consume:${at}`,
            observedAt: at, freshFor: edge.contract.collectionCadence });
        const outcome = worker(edge.contract, { localRun: edge.acceptance.localRun });
        if (outcome === null) continue;
        const result = resultFor(edge.contract, outcome);
        if (succeeded(ledger.submit(result, at))) out.push(resultEnvelope(edge.contract, result, at));
      }
      return out;
    },
  });
}

/** Maps an endpoint's own receipt to delivery evidence witnessed by that recipient. */
export function evidenceFromReceipt(envelope: AgentTransportEnvelope, receipt: EndpointReceipt, attempt: string,
  observedAt: number, freshFor: number, prior: DeliveryState | null): DeliveryEvidence {
  const base = { type: 'DeliveryEvidence' as const, schemaVersion: 1 as const, key: envelope.key, digest: envelope.digest,
    edge: envelope.edge, conversation: envelope.conversation, attempt, observedAt, freshFor };
  if (receipt.state === 'unknown')
    return freeze({ ...base, state: 'uncertain', witness: { kind: 'observer', principal: envelope.sender }, authoritative: receipt.authoritative,
      unresolved: `no custody record for ${envelope.key}; last proven ${prior ?? 'none'}` });
  if (receipt.state === 'refused')
    return freeze({ ...base, state: 'refused', witness: { kind: 'recipient', principal: envelope.recipient },
      authoritative: receipt.authoritative, refusedWhat: receipt.refusedWhat ?? 'receiving-admission' });
  if (receipt.state === 'durably-queued')
    return freeze({ ...base, state: 'durably-queued', witness: { kind: 'custodian', principal: envelope.recipient },
      authoritative: receipt.authoritative, durability: receipt.durability ?? 'memory' });
  return freeze({ ...base, state: receipt.state, witness: { kind: 'recipient', principal: envelope.recipient },
    authoritative: receipt.authoritative });
}

/**
 * Local delivery (the port suite's local transport; part six supplies the reference adapter): the recipient endpoint lives in this process or on this
 * machine. There is no separate transport custody, so the strongest honest
 * claim after a send is the recipient's own durable admission.
 */
export function createLocalAgentTransport(input: Readonly<{ route: (principal: string) => AgentEndpoint | undefined;
  now: () => number; freshFor: number; context: BoundaryContext }>): AgentTransportPort {
  const { context } = input;
  return freeze({
    adapter: 'local-v1',
    describe: (peer, required) => boundary('AgentTransportDescribe', { peer, required: [...required] }, context, () => {
      const endpoint = input.route(peer);
      ensure(endpoint, `peer ${peer} is not reachable by local delivery`);
      return [endpoint.advertisement()];
    }),
    send: (envelope, attempt, mode) => boundary('AgentTransportSend', { key: envelope.key, attempt, mode }, context, () => {
      ensure(envelopeIntact(envelope), 'envelope digest does not match its fields');
      const endpoint = input.route(envelope.recipient), now = input.now();
      if (!endpoint) return freeze({ type: 'DeliveryEvidence' as const, schemaVersion: 1 as const, key: envelope.key, digest: envelope.digest,
        edge: envelope.edge, conversation: envelope.conversation, state: 'refused' as const, witness: { kind: 'transport' as const, principal: 'local-v1' },
        authoritative: 'route:absent', attempt, observedAt: now, freshFor: input.freshFor, refusedWhat: 'transport-send' as const });
      let receipt: EndpointReceipt;
      try { receipt = mode === 'lookup' ? endpoint.lookup(envelope.key, semanticDigest(envelope)) : endpoint.receive(envelope, now); }
      catch (error) {
        return freeze({ type: 'DeliveryEvidence' as const, schemaVersion: 1 as const, key: envelope.key, digest: envelope.digest,
          edge: envelope.edge, conversation: envelope.conversation, state: 'uncertain' as const, witness: { kind: 'observer' as const, principal: envelope.sender },
          authoritative: 'send:interrupted', attempt, observedAt: now, freshFor: input.freshFor,
          unresolved: `recipient did not answer (${error instanceof Error ? error.message : 'interrupted'}); admission unknown` });
      }
      return evidenceFromReceipt(envelope, receipt, attempt, now, input.freshFor, null);
    }),
    observe: (envelope, attempt) => boundary('AgentTransportObserve', { key: envelope.key, attempt }, context, () => {
      const endpoint = input.route(envelope.recipient), now = input.now();
      ensure(endpoint, `peer ${envelope.recipient} is not reachable for lookup`);
      return evidenceFromReceipt(envelope, endpoint.lookup(envelope.key, semanticDigest(envelope)), attempt, now, input.freshFor, null);
    }),
  });
}
