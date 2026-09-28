/**
 * Rule 114 contract suite (design 09 §6–7, P5-NF-30..42; design 10 §6–7,
 * P6-NF-23..29): the SAME scenarios run against local delivery and the
 * Threadline reference adapter. Rule 31: partition/rejoin, duplicates,
 * reordering, worker loss and unmet replication demand through the fault harness.
 */
import { describe, expect, it } from 'vitest';
import { childAuthority, placeDelegation } from '../../src/rungraph/index.js';
import type { DelegationContract } from '../../src/rungraph/index.js';
import { offerEnvelope, sealEnvelope } from '../../src/rungraph/index.js';
import type { WorkerOutcome } from '../../src/rungraph/index.js';
import { context, createNetwork, Disk, refusal, value } from './agent-fault-harness.js';

const done = (result: string): WorkerOutcome => ({ terminal: 'completed', result, evidence: ['file-reference:src/x.ts'] });

describe.each(['local', 'threadline'] as const)('agent transport contract over %s delivery', kind => {
  it('P5-NF-30 P5-NF-35 nested fan-out: a child delegates onward, bounded by its own edge, and every result returns to its durable destination', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code', 'orchestrate'], () => null);
    // b fans out to d (depth 2); d delegates to e (depth 3). Each waits for its children.
    const waitFor = (principal: string, recipients: string[], label: string) => (contract: DelegationContract) => {
      const me = net.agents.get(principal)!;
      const mine = [...me.ledger.view().values()].filter(edge => edge.contract.parentRun === contract.childRun);
      if (mine.length === 0) {
        recipients.forEach((recipient, sequence) =>
          net.delegate(me, net.request(childAuthority(contract), recipient, { sequence, budget: 3, scope: ['repo:instar/src'] })));
        return null;
      }
      return mine.every(edge => edge.collected) ? done(`${label}(${mine.map(edge => edge.result!.result).join(',')})`) : null;
    };
    net.add('agent-b', ['code'], waitFor('agent-b', ['agent-d'], 'b'));
    net.add('agent-c', ['code'], () => done('c'));
    net.add('agent-d', ['code'], waitFor('agent-d', ['agent-e'], 'd'));
    net.add('agent-e', ['code'], () => done('e'));
    const root = net.rootAuthority('agent-a');
    const toB = net.delegate(a, net.request(root, 'agent-b', { sequence: 0 }));
    const toC = net.delegate(a, net.request(root, 'agent-c', { sequence: 1 }));
    net.tick(12);
    const view = a.ledger.view();
    expect(view.get(toB.id)!.result!.result).toBe('b(d(e))');
    expect(view.get(toC.id)!.result!.result).toBe('c');
    expect(view.get(toB.id)!.collected && view.get(toC.id)!.collected).toBe(true);
    expect(a.ledger.outstanding()).toHaveLength(0);
    const depths = [...net.agents.values()].flatMap(agent => [...agent.ledger.view().values()]
      .filter(edge => edge.contract.owner === agent.principal).map(edge => edge.contract.depth));
    expect(depths.sort()).toEqual([1, 1, 2, 3]);
    // The grandchild edge carries every required field, and its authority is a subset of its ancestors'.
    const deToE = [...net.agents.get('agent-d')!.ledger.view().values()].find(edge => edge.contract.recipient === 'agent-e')!.contract;
    for (const field of ['scope', 'owner', 'grants', 'budget', 'exitTest', 'placement', 'transport', 'cancellation', 'resultDestination'] as const)
      expect(deToE[field]).toBeDefined();
    expect(deToE.ancestors).toHaveLength(2);
    expect(deToE.budget).toBeLessThanOrEqual(3);
  });

  it('P5-NF-14 P5-NF-31 authority never grows by being delegated; depth, fan-out and ancestor budget are enforced at every level', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null);
    net.add('agent-b', ['code'], () => null);
    const root = net.rootAuthority('agent-a', { maxChildren: 2, budget: 12 });
    const limit = { childLimit: { maxChildren: 2, maxDepth: 8 } };
    expect(refusal(a.ledger.delegate(net.request(root, 'agent-b', { scope: ['repo:other'], ...limit })))).toContain('scope exceeds');
    expect(refusal(a.ledger.delegate(net.request(root, 'agent-b', { actions: ['deploy'], ...limit })))).toContain('actions exceed');
    expect(refusal(a.ledger.delegate(net.request(root, 'agent-b', { grants: ['grant:admin'], ...limit })))).toContain('grant not held');
    expect(refusal(a.ledger.delegate(net.request(root, 'agent-b', { childLimit: { maxChildren: 64, maxDepth: 2 } })))).toContain('limit exceeds');
    const first = value(a.ledger.delegate(net.request(root, 'agent-b', { sequence: 0, budget: 10, ...limit })));
    expect(refusal(a.ledger.delegate(net.request(root, 'agent-b', { sequence: 1, budget: 3, ...limit })))).toContain('remaining parent allocation 2');
    value(a.ledger.delegate(net.request(root, 'agent-b', { sequence: 1, budget: 2, ...limit })));
    expect(refusal(a.ledger.delegate(net.request(root, 'agent-b', { sequence: 2, budget: 0, ...limit })))).toContain('already has 2 children');
    // A child at its depth limit cannot delegate again; its authority is only what its edge carries.
    const child = childAuthority(first);
    expect(child.budget).toBe(10);
    expect(refusal(a.ledger.delegate(net.request({ ...child, depth: 16 }, 'agent-b', limit)))).toContain('depth 17 exceeds');
    expect(refusal(a.ledger.delegate(net.request(child, 'agent-b', { scope: ['repo:instar'], ...limit })))).toContain('scope exceeds');
    // Same identity, same content returns the existing edge; nothing is appended twice.
    const before = a.disk.records.length;
    expect(value(a.ledger.delegate(net.request(root, 'agent-b', { sequence: 0, budget: 10, ...limit }))).id).toBe(first.id);
    expect(a.disk.records.length).toBe(before);
  });

  it('P5-NF-30 no child exists before its owning edge is durable; an unmet replication demand refuses before any offer', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null, new Disk('local-durable', 0));
    const b = net.add('agent-b', ['code'], () => done('b'));
    // One-machine path: local-durable demand is satisfied without a peer.
    const local = net.delegate(a, net.request(net.rootAuthority('agent-a'), 'agent-b', { sequence: 0 }));
    net.tick(4);
    expect(a.ledger.view().get(local.id)!.collected).toBe(true);
    // A replicated demand with only a local receipt refuses, and no offer ever leaves.
    const offersBefore = [...b.ledger.view().values()].length;
    expect(refusal(a.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b', { sequence: 1, durability: 'replicated' }))))
      .toContain('replication demand unmet');
    net.tick(2);
    expect([...b.ledger.view().values()].length).toBe(offersBefore);
    // A real replicated receipt (independently failing peer) is the only thing that satisfies it.
    const replicated = net.add('agent-r', ['code'], () => null, new Disk('replicated', 1));
    value(replicated.ledger.delegate(net.request(net.rootAuthority('agent-r'), 'agent-b', { sequence: 0, durability: 'replicated' })));
    // A disk that fails before append leaves no edge and so no child.
    a.disk.down = true;
    expect(refusal(a.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b', { sequence: 2 })))).toContain('disk unavailable');
  });

  it('P5-NF-19 P5-NF-30 worker loss and parent loss: the child is never re-created, and a late result stays owned until collected', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null);
    let attempts = 0;
    const b = net.add('agent-b', ['code'], () => { attempts++; throw new Error('worker lost'); });
    const edge = net.delegate(a, net.request(net.rootAuthority('agent-a'), 'agent-b'));
    net.tick(3);
    expect(b.crashed).toBe(true);
    expect(attempts).toBe(1);
    expect(a.ledger.view().get(edge.id)!.result).toBeNull();
    expect(a.ledger.outstanding().map(e => e.contract.id)).toEqual([edge.id]);
    // The parent dies too. Neither restart re-creates the child: the durable edge and acceptance survive.
    net.restart('agent-a');
    const b2 = net.restart('agent-b');
    b2.worker = () => { attempts++; return done('late answer'); };
    expect([...b2.ledger.view().values()].filter(e => e.contract.recipient === 'agent-b')).toHaveLength(1);
    net.tick(6);
    const a2 = net.agents.get('agent-a')!;
    expect(attempts).toBe(2);
    expect(a2.ledger.view().get(edge.id)!.result!.result).toBe('late answer');
    expect(a2.ledger.view().get(edge.id)!.collected).toBe(true);
    expect(a2.ledger.outstanding()).toHaveLength(0);
    // Exactly one edge, one acceptance, one result and one collection were ever written at the parent.
    const kinds = a2.disk.records.filter(r => r.record !== 'evidence').map(r => r.record);
    expect(kinds.filter(k => k === 'edge')).toHaveLength(1);
    expect(kinds.filter(k => k === 'result')).toHaveLength(1);
    expect(kinds.filter(k => k === 'collection')).toHaveLength(1);
  });

  it('P5-NF-21 cancellation cascades to descendants and stays owned until each child confirms', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null);
    net.add('agent-b', ['code'], contract => {
      const b = net.agents.get('agent-b')!;
      if (![...b.ledger.view().values()].some(edge => edge.contract.parentRun === contract.childRun))
        net.delegate(b, net.request(childAuthority(contract), 'agent-d', { budget: 2 }));
      return null;
    });
    net.add('agent-d', ['code'], () => null);
    const edge = net.delegate(a, net.request(net.rootAuthority('agent-a'), 'agent-b'));
    net.tick(4);
    const dEdge = [...net.agents.get('agent-b')!.ledger.view().values()].find(e => e.contract.recipient === 'agent-d')!;
    expect(dEdge).toBeDefined();
    // The cancel cannot reach b yet: cancellation is requested, unconfirmed and still owned.
    net.partition('agent-b');
    expect(value(a.ledger.cancel(edge.id, 'agent-a', 'operator stopped the work', net.now()))).toEqual([edge.id]);
    net.tick(3);
    expect(a.ledger.view().get(edge.id)!.cancellation).toBe('requested');
    expect(a.ledger.outstanding().map(e => e.contract.id)).toContain(edge.id);
    // Only the accountable parent may cancel.
    expect(refusal(a.ledger.cancel(edge.id, 'agent-z', 'no', net.now()))).toContain('accountable parent');
    net.restart('agent-a');
    expect(net.agents.get('agent-a')!.ledger.view().get(edge.id)!.cancellation).toBe('requested');
    net.rejoin('agent-b');
    net.tick(10);
    const a2 = net.agents.get('agent-a')!;
    expect(a2.ledger.view().get(edge.id)!.cancellation).toBe('confirmed');
    expect(a2.ledger.view().get(edge.id)!.result!.terminal).toBe('cancelled');
    const dAfter = net.agents.get('agent-b')!.ledger.view().get(dEdge.contract.id)!;
    expect(dAfter.cancellation).toBe('confirmed');
    expect(dAfter.result!.terminal).toBe('cancelled');
    expect(a2.ledger.outstanding()).toHaveLength(0);
  });

  it('P5-NF-35 P5-NF-39 duplicate delivery: one child, one worker run, one collection; same key with a different digest is a conflict', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null);
    let runs = 0;
    const b = net.add('agent-b', ['code'], () => { runs++; return done('once'); });
    if (kind === 'threadline') net.relay.duplicate = true;
    const edge = value(a.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b')));
    const envelope = offerEnvelope(edge);
    net.send(a, envelope); net.send(a, envelope); net.send(a, envelope);
    net.tick(6);
    expect(runs).toBe(1);
    expect([...b.ledger.view().values()]).toHaveLength(1);
    expect(b.disk.records.filter(r => r.record === 'acceptance')).toHaveLength(1);
    expect(a.disk.records.filter(r => r.record === 'result')).toHaveLength(1);
    expect(a.disk.records.filter(r => r.record === 'collection')).toHaveLength(1);
    // Same semantic key, different content: refused at receiving admission, never a second child.
    net.relay.duplicate = false;
    const { digest: _d, type: _t, schemaVersion: _v, ...fields } = offerEnvelope(edge);
    const forged = sealEnvelope({ ...fields, reason: 'tampered' });
    const evidence = value(a.port.send(forged, 'attempt:forged', 'submit'));
    net.tick(2);
    if (kind === 'local') expect(evidence).toMatchObject({ state: 'refused', refusedWhat: 'receiving-admission' });
    expect(runs).toBe(1);
    expect([...b.ledger.view().values()]).toHaveLength(1);
  });

  it('P5-NF-37 P5-NF-40 P5-NF-41 honest delivery states: each stage has its own witness and knowledge never regresses', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null);
    let release = false;
    net.add('agent-b', ['code'], () => (release ? done('answer') : null));
    const edge = value(a.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b')));
    const first = net.send(a, offerEnvelope(edge));
    if (kind === 'threadline') {
      // Relay acceptance proves only transport acceptance — never custody or worker delivery.
      expect(first.state).toBe('accepted-by-transport');
      expect(first.witness.kind).toBe('transport');
      expect(net.observe(a, edge.id).state).toBe('uncertain');
      net.tick(2);
      expect(net.observe(a, edge.id)).toMatchObject({ state: 'durably-queued', witness: { kind: 'custodian', principal: 'agent-b' } });
    } else {
      expect(first).toMatchObject({ state: 'durably-queued', witness: { kind: 'custodian', principal: 'agent-b' } });
    }
    net.tick(2);
    // Over a relay, knowing about consumption takes a lookup round trip; until then it stays at the last proof.
    if (kind === 'threadline') { expect(['durably-queued', 'delivered-to-worker']).toContain(net.observe(a, edge.id).state); net.tick(2); }
    expect(net.observe(a, edge.id)).toMatchObject({ state: 'delivered-to-worker', witness: { kind: 'recipient', principal: 'agent-b' } });
    expect(a.ledger.view().get(edge.id)!.result).toBeNull();
    // `answered` cannot be claimed without the durable result, whoever claims it.
    const fake = { ...net.observe(a, edge.id), state: 'answered' as const };
    expect(refusal(a.ledger.record(fake))).toContain('DelegationResult');
    expect(refusal(a.ledger.record({ ...fake, state: 'delivered-to-worker', witness: { kind: 'transport', principal: 'relay' } })))
      .toContain("recipient's own record");
    expect(refusal(a.ledger.record({ ...fake, state: 'durably-queued', witness: { kind: 'custodian', principal: 'relay' }, durability: 'memory' })))
      .toContain('memory buffer');
    release = true;
    net.tick(6);
    const view = a.ledger.view().get(edge.id)!;
    expect(view.proven).toEqual(expect.arrayContaining(['durably-queued', 'delivered-to-worker', 'answered']));
    // A later uncertain query is recorded beside, never over, the proven answer.
    value(a.ledger.record({ ...fake, state: 'uncertain', witness: { kind: 'observer', principal: 'agent-a' }, unresolved: 'lookup timed out' }));
    expect(a.ledger.view().get(edge.id)!.proven).toContain('answered');
  });

  it('P5-NF-36 P6-NF-29 partition and rejoin: uncertain delivery retries by lookup under the same key, never a fresh offer, and both sides converge', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null);
    const b = net.add('agent-b', ['code'], () => done('after rejoin'));
    const edge = value(a.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b')));
    if (kind === 'threadline') net.relay.cut.add('agent-a'); else net.partition('agent-b');
    const evidence = net.send(a, offerEnvelope(edge));
    const plan = value(a.ledger.retry(edge.id));
    if (kind === 'threadline') {
      expect(evidence.state).toBe('uncertain');
      expect(plan).toMatchObject({ mode: 'lookup', key: offerEnvelope(edge).key });
    } else {
      // Local delivery can prove the send did not happen; only then may the SAME key be resubmitted.
      expect(evidence).toMatchObject({ state: 'refused', refusedWhat: 'transport-send' });
      expect(plan).toMatchObject({ mode: 'resubmit', key: offerEnvelope(edge).key });
    }
    net.tick(3);
    expect([...b.ledger.view().values()]).toHaveLength(0);
    net.rejoin('agent-a'); net.rejoin('agent-b');
    net.send(a, offerEnvelope(edge), plan.mode === 'resubmit' ? 'submit' : 'lookup');
    if (plan.mode === 'lookup') {
      // The lookup found no custody: the sender still never resubmits blindly; the uncertain offer's
      // original bytes are re-sent under the same semantic key, which the receiver deduplicates.
      net.tick(1);
      expect(net.observe(a, edge.id).state).toBe('uncertain');
      net.send(a, offerEnvelope(edge));
    }
    net.tick(8);
    expect(a.ledger.view().get(edge.id)!.collected).toBe(true);
    expect(b.ledger.view().get(edge.id)!.result!.result).toBe('after rejoin');
    expect(b.disk.records.filter(r => r.record === 'acceptance')).toHaveLength(1);
    expect(value(a.ledger.retry(edge.id))).toMatchObject({ mode: 'none' });
  });

  it('P5-NF-30 a lost append acknowledgement preserves the durable fact and never forks the edge', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null);
    net.add('agent-b', ['code'], () => done('b'));
    a.disk.loseNextAck = true;
    const request = net.request(net.rootAuthority('agent-a'), 'agent-b');
    expect(refusal(a.ledger.delegate(request))).toContain('acknowledgement lost');
    // Re-issuing the same request finds the durable edge rather than minting a second one.
    const edge = value(a.ledger.delegate(request));
    expect(a.disk.records.filter(r => r.record === 'edge')).toHaveLength(1);
    net.send(a, offerEnvelope(edge));
    net.tick(5);
    expect(a.ledger.view().get(edge.id)!.collected).toBe(true);
  });
});

describe('P5-NF-33 capability-aware placement', () => {
  const ad = (agent: string, capabilities: string[], over = {}) => ({ agent, machine: `m-${agent}`, harness: 'codex', model: 'gpt',
    transport: 'local-v1', capabilities, observedAt: 1000, freshFor: 1000, capacity: 2, trust: 'trusted' as const, ...over });
  it('chooses only a fresh, trusted, capable candidate with capacity and records why', () => {
    const decision = value(placeDelegation(['code', 'browser'], [ad('x', ['code']), ad('y', ['code', 'browser']),
      ad('z', ['code', 'browser'], { trust: 'revoked' })], 1500, context));
    expect(decision).toMatchObject({ agent: 'y', required: ['browser', 'code'] });
    expect(decision.reason).toContain('capacity');
  });
  it('refuses stale, revoked, full and incapable candidates, naming each reason', () => {
    const detail = refusal(placeDelegation(['browser'], [ad('x', ['code']), ad('y', ['browser'], { observedAt: 0 }),
      ad('z', ['browser'], { trust: 'revoked' }), ad('w', ['browser'], { capacity: 0 })], 1500, context));
    for (const reason of ['missing browser', 'advertisement stale', 'trust revoked', 'no capacity']) expect(detail).toContain(reason);
  });
  it.each(['local', 'threadline'] as const)('the receiving admission rechecks capability before any worker start (%s)', kind => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null);
    let started = false;
    const b = net.add('agent-b', ['code'], () => { started = true; return done('x'); });
    const edge = value(a.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b',
      { placement: { ...net.request(net.rootAuthority('agent-a'), 'agent-b').placement, required: ['gpu'], advertised: ['gpu'] } })));
    const sent = net.send(a, offerEnvelope(edge));
    net.tick(3);
    expect(started).toBe(false);
    expect([...b.ledger.view().values()]).toHaveLength(0);
    // The recipient's refusal is witnessed by the recipient: at send for local delivery, by signed receipt over Threadline.
    expect(kind === 'local' ? sent : net.observe(a, edge.id)).toMatchObject({ state: 'refused', refusedWhat: 'receiving-admission',
      witness: { kind: 'recipient', principal: 'agent-b' } });
    expect(value(a.ledger.retry(edge.id)).mode).toBe('lookup');
  });
});

describe('Threadline reference adapter authentication (P6-NF-23/24)', () => {
  it('rejects wrong recipient, forged signature, unknown key, unknown suite and future schema before admission', () => {
    const net = createNetwork('threadline');
    const a = net.add('agent-a', ['code'], () => null);
    const b = net.add('agent-b', ['code'], () => done('x'));
    const edge = value(a.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b')));
    net.send(a, offerEnvelope(edge));
    const [genuine] = net.relay.queues.get('agent-b')!;
    net.relay.queues.set('agent-b', []);
    net.relay.inject({ ...genuine!, recipient: 'agent-b', sender: 'agent-a', signature: Buffer.from('forged').toString('base64') });
    net.relay.inject({ ...genuine!, sender: 'agent-unknown' });
    net.relay.inject({ ...genuine!, suite: 'none-v0' });
    net.relay.inject({ ...genuine!, schemaVersion: 2 });
    net.relay.inject({ ...genuine!, envelope: { ...genuine!.envelope!, reason: 'swapped' } });
    net.relay.queues.get('agent-b')!.push({ ...genuine!, recipient: 'agent-c' });
    net.tick(1);
    expect(b.rejections.map(r => r.reason).sort()).toEqual(['bad-signature', 'bad-signature', 'future-schema', 'unknown-key', 'unknown-suite', 'wrong-recipient'].sort());
    expect([...b.ledger.view().values()]).toHaveLength(0);
    net.relay.inject(genuine!);
    net.tick(1);
    expect([...b.ledger.view().values()]).toHaveLength(1);
  });
});
