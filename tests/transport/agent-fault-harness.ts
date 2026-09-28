/**
 * Fault harness for Rules 31 and 114: independently failing simulated agents,
 * each with its own durable disk, joined by either local delivery or the
 * Threadline reference adapter over a faultable relay. Faults: partition and
 * rejoin, duplicate and reordered frames, relay outage, lost append ACK,
 * disk outage, worker loss and agent restart. Simulation proves distributed
 * logic only; it is never a real replication receipt.
 */
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { cancelEnvelope, childAuthority, createAgentEndpoint, createDelegationLedger, createLocalAgentTransport, offerEnvelope,
  offerKey, resultEnvelope } from '../../src/rungraph/index.js';
import type { CapabilityAdvertisement, DelegationAuthority, DelegationContract, DelegationDurability,
  DelegationLedger, DelegationRecord, DelegationRequest, DeliveryEvidence } from '../../src/rungraph/index.js';
import { createThreadlineReferenceAdapter } from '../../src/transport/index.js';
import type { AgentEndpoint, AgentTransportEnvelope, AgentTransportPort, DelegatedWorker } from '../../src/rungraph/index.js';
import type { ThreadlineAdapter, ThreadlineFrame, ThreadlineRejection } from '../../src/transport/index.js';

export const context = { site: 'test.delegation', preserved: 'test:host', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'test:register' },
  entries: ['test.delegation'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'test.delegation': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} } as never;

export const value = <T>(result: Result<T>): T => consumeResult(result, { Success: v => v, Refused: r => { throw new Error(`refused: ${r.detail}`); } });
export const refusal = <T>(result: Result<T>): string => consumeResult(result, { Success: () => { throw new Error('expected refusal'); }, Refused: r => r.detail });

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** One machine's disk: survives agent restarts, fails independently. */
export class Disk {
  records: DelegationRecord[] = [];
  down = false; loseNextAck = false;
  constructor(readonly durability: DelegationDurability = 'local-durable', readonly replicas = 0) {}
  port() {
    return { read: () => clone(this.records), append: (record: DelegationRecord) => {
      if (this.down) throw new Error('disk unavailable');
      this.records.push(clone(record));
      if (this.loseNextAck) { this.loseNextAck = false; throw new Error('append acknowledgement lost'); }
      return { durability: this.durability, replicas: this.replicas };
    } };
  }
}

export class Relay {
  queues = new Map<string, ThreadlineFrame[]>();
  cut = new Set<string>(); down = false; duplicate = false; reorder = false; submitted = 0;
  submit(frame: ThreadlineFrame): 'accepted' | 'rejected' {
    if (this.down || this.cut.has(frame.sender)) throw new Error('relay unreachable');
    this.submitted++;
    const queue = this.queues.get(frame.recipient) ?? [];
    queue.push(clone(frame)); if (this.duplicate) queue.push(clone(frame));
    this.queues.set(frame.recipient, queue); return 'accepted';
  }
  collect(recipient: string): readonly ThreadlineFrame[] {
    if (this.cut.has(recipient)) return [];
    const queue = this.queues.get(recipient) ?? []; this.queues.set(recipient, []);
    return this.reorder ? [...queue].reverse() : queue;
  }
  inject(frame: ThreadlineFrame) { const q = this.queues.get(frame.recipient) ?? []; q.push(frame); this.queues.set(frame.recipient, q); }
}

export type Kind = 'local' | 'threadline';
export interface Agent {
  readonly principal: string; readonly disk: Disk; capabilities: string[];
  ledger: DelegationLedger; endpoint: AgentEndpoint; port: AgentTransportPort; threadline?: ThreadlineAdapter;
  worker: DelegatedWorker; cancelsSent: Set<string>; resultCustody: Set<string>; rejections: ThreadlineRejection[]; crashed: boolean;
}

export function createNetwork(kind: Kind) {
  let now = 1_000;
  const agents = new Map<string, Agent>(), keys = new Map<string, { publicKey: KeyObject; privateKey: KeyObject }>();
  const relay = new Relay(), cutLocal = new Set<string>();
  const advertisement = (agent: Agent): CapabilityAdvertisement => ({ agent: agent.principal, machine: `machine-${agent.principal}`,
    harness: 'claude-code', model: 'opus', transport: kind === 'local' ? 'local-v1' : 'threadline-ref-v1',
    capabilities: [...agent.capabilities], observedAt: now, freshFor: 60_000, capacity: 4, trust: 'trusted' });
  const build = (agent: Omit<Agent, 'ledger' | 'endpoint' | 'port' | 'threadline'> & Partial<Agent>): Agent => {
    const full = agent as Agent;
    full.ledger = createDelegationLedger(agent.disk.port(), context);
    full.endpoint = createAgentEndpoint({ principal: agent.principal, ledger: full.ledger, advertisement: () => advertisement(full) });
    if (kind === 'local') {
      full.port = createLocalAgentTransport({ route: p => (cutLocal.has(p) || agents.get(p)?.crashed ? undefined : agents.get(p)?.endpoint),
        now: () => now, freshFor: 60_000, context });
    } else {
      const pair = keys.get(agent.principal)!;
      full.threadline = createThreadlineReferenceAdapter({ relay, now: () => now, freshFor: 60_000, context,
        advertisements: peer => (agents.get(peer) ? [advertisement(agents.get(peer)!)] : []),
        keys: { principal: agent.principal, sign: bytes => sign(null, Buffer.from(bytes), pair.privateKey).toString('base64'),
          verify: (principal, bytes, signature) => {
            const peer = keys.get(principal);
            if (!peer) return 'unknown-key';
            return verify(null, Buffer.from(bytes), peer.publicKey, Buffer.from(signature, 'base64')) ? 'valid' : 'invalid';
          } } });
      full.port = full.threadline.port;
    }
    return full;
  };
  const net = {
    kind, relay, agents, keys, cutLocal,
    now: () => now, advance: (ms: number) => { now += ms; },
    add(principal: string, capabilities: string[], worker: DelegatedWorker, disk = new Disk()) {
      keys.set(principal, generateKeyPairSync('ed25519'));
      const agent = build({ principal, disk, capabilities, worker, cancelsSent: new Set(), resultCustody: new Set(), rejections: [], crashed: false });
      agents.set(principal, agent); return agent;
    },
    /** A restart rebuilds everything from the agent's own disk; no memory survives. */
    restart(principal: string) {
      const old = agents.get(principal)!;
      const agent = build({ principal, disk: old.disk, capabilities: old.capabilities, worker: old.worker,
        cancelsSent: new Set(), resultCustody: new Set(), rejections: [], crashed: false });
      agents.set(principal, agent); return agent;
    },
    partition(principal: string) { if (kind === 'local') cutLocal.add(principal); else relay.cut.add(principal); },
    rejoin(principal: string) { if (kind === 'local') cutLocal.delete(principal); else relay.cut.delete(principal); },
    rootAuthority(owner: string, over: Partial<DelegationAuthority> = {}): DelegationAuthority {
      return { run: `root:${owner}`, edge: null, depth: 0, owner, scope: ['repo:instar', 'repo:instar/docs', 'repo:instar/src'],
        actions: ['read', 'write', 'test'], grants: ['grant:work'], budget: 100, maxChildren: 32, maxDepth: 16, expiresAt: now + 3_600_000, ...over };
    },
    request(parent: DelegationAuthority, recipient: string, over: Partial<DelegationRequest> = {}): DelegationRequest {
      const target = agents.get(recipient);
      const required = over.placement?.required ?? ['code'];
      return { parent, intent: `intent:${parent.run}`, recipient, question: `What does ${recipient} find?`, method: ['cite evidence'],
        scope: ['repo:instar/src'], actions: ['read', 'test'], grants: ['grant:work'], budget: 10,
        exitTest: { check: 'report-cites-files', version: '1', evidence: ['file-reference'] },
        placement: { agent: recipient, machine: `machine-${recipient}`, harness: 'claude-code', model: 'opus',
          transport: kind === 'local' ? 'local-v1' : 'threadline-ref-v1', required,
          advertised: target ? [...target.capabilities] : required, observedAt: now, decidedAt: now, reason: 'test placement' },
        conversation: `a2a:${parent.owner}:${recipient}`, resultDestination: { run: parent.run, edge: parent.edge },
        childLimit: { maxChildren: 8, maxDepth: 8 }, collectionCadence: 60_000, durability: 'local-durable',
        sequence: 0, at: now, generation: 'gen:1', ...over };
    },
    /** Send one envelope through the sender's port; offer evidence lands in the sender's own ledger. */
    send(from: Agent, envelope: AgentTransportEnvelope, mode: 'submit' | 'lookup' = 'submit'): DeliveryEvidence {
      const evidence = value(from.port.send(envelope, `attempt:${from.principal}:${now}:${Math.random()}`, mode));
      if (envelope.kind === 'offer') value(from.ledger.record(evidence));
      return evidence;
    },
    delegate(from: Agent, request: DelegationRequest): DelegationContract {
      const contract = value(from.ledger.delegate(request));
      net.send(from, offerEnvelope(contract));
      return contract;
    },
    observe(from: Agent, edge: string): DeliveryEvidence {
      const contract = from.ledger.view().get(edge)!.contract;
      const evidence = value(from.port.observe(offerEnvelope(contract), `observe:${now}`));
      value(from.ledger.record(evidence));
      return evidence;
    },
    /** One round: pump inboxes, send owned cancels, run workers, return results, collect. */
    tick(rounds = 1) {
      for (let i = 0; i < rounds; i++) {
        now += 10;
        for (const agent of agents.values()) if (!agent.crashed && agent.threadline && !relay.cut.has(agent.principal))
          agent.rejections.push(...agent.threadline.pump(agent.endpoint));
        for (const agent of agents.values()) {
          if (agent.crashed) continue;
          for (const edge of agent.ledger.view().values())
            if (edge.contract.owner === agent.principal && edge.cancellation === 'requested' && !agent.cancelsSent.has(edge.contract.id)) {
              const evidence = value(agent.port.send(cancelEnvelope(edge.contract, 'parent cancelled', now), `cancel:${now}`, 'submit'));
              if (evidence.state !== 'refused' && evidence.state !== 'uncertain') agent.cancelsSent.add(edge.contract.id);
            }
          let results: readonly AgentTransportEnvelope[] = [];
          try { results = agent.endpoint.work(agent.worker, now); }
          catch { agent.crashed = true; continue; }
          for (const envelope of results) {
            const sent = net.send(agent, envelope);
            if (sent.state === 'durably-queued') agent.resultCustody.add(envelope.edge);
          }
          // A stored result is kept until the collector's custody is proven: look it up by its
          // semantic key; resubmit the SAME stored result only when the collector has no record.
          for (const edge of agent.ledger.view().values()) {
            if (edge.contract.recipient !== agent.principal || !edge.result || agent.resultCustody.has(edge.contract.id)
              || results.some(r => r.edge === edge.contract.id)) continue;
            const envelope = resultEnvelope(edge.contract, edge.result, now);
            const looked = net.send(agent, envelope, 'lookup');
            if (looked.state === 'durably-queued' || looked.state === 'answered') { agent.resultCustody.add(edge.contract.id); continue; }
            const sent = net.send(agent, envelope);
            if (sent.state === 'durably-queued') agent.resultCustody.add(edge.contract.id);
          }
          for (const edge of agent.ledger.view().values())
            if (edge.contract.owner === agent.principal && edge.result && !edge.collected) value(agent.ledger.collect(edge.contract.id, now));
        }
      }
    },
    childAuthority, offerKey,
  };
  return net;
}
