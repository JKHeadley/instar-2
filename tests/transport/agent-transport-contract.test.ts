/**
 * Rule 114 contract suite (design 09 §6–7, P5-NF-30..42; design 10 §6–7,
 * P6-NF-23..29): the SAME scenarios run against local delivery and the
 * Threadline reference adapter. Rule 31: partition/rejoin, duplicates,
 * reordering, worker loss and unmet replication demand through the fault harness.
 */
import { describe, expect, it } from 'vitest';
import { childAuthority, placeDelegation } from '../../src/rungraph/index.js';
import type { DelegationContract } from '../../src/rungraph/index.js';
import { offerEnvelope, resultEnvelope, resultFor, sealEnvelope } from '../../src/rungraph/index.js';
import { createThreadlineKeyCustody, sealThreadlineFrame } from '../../src/transport/index.js';
import type { ThreadlineFrame } from '../../src/transport/index.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { WorkerOutcome } from '../../src/rungraph/index.js';
import { context, counterRandom, createNetwork, Disk, identityOf, refusal, value } from './agent-fault-harness.js';

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

describe('Threadline reference adapter authentication and confidentiality (P6-NF-23/24)', () => {
  const setup = () => {
    const net = createNetwork('threadline');
    const a = net.add('agent-a', ['code'], () => null);
    const b = net.add('agent-b', ['code'], () => done('x'));
    const c = net.add('agent-c', ['code'], () => null);
    const edge = value(a.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b')));
    return { net, a, b, c, edge };
  };
  it('rejects wrong recipient, tampered ciphertext or routing, unknown key, a forged inner signature, unknown suite and future schema before admission', () => {
    const { net, a, b, edge } = setup();
    net.send(a, offerEnvelope(edge));
    const [genuine] = net.relay.queues.get('agent-b')!;
    net.relay.queues.set('agent-b', []);
    const flipped = Buffer.from(genuine!.sealed, 'base64'); flipped[3] = flipped[3]! ^ 1;
    net.relay.inject({ ...genuine!, sealed: flipped.toString('base64') });
    net.relay.inject({ ...genuine!, conversation: 'a2a:other' });
    net.relay.inject({ ...genuine!, sender: 'agent-unknown' });
    net.relay.inject({ ...genuine!, sender: 'agent-c' });
    net.relay.inject({ ...genuine!, suite: 'none-v0' });
    net.relay.inject({ ...genuine!, schemaVersion: 2 });
    net.relay.queues.get('agent-b')!.push({ ...genuine!, recipient: 'agent-c' });
    // A holder of a's agreement key but not a's signing key: the frame opens, its inner signature does not verify.
    const stolen = createThreadlineKeyCustody({ principal: 'agent-a',
      identity: { ...identityOf('agent-c'), agreement: identityOf('agent-a').agreement }, peer: p => identityOf(p).public, random: counterRandom('stolen') });
    net.relay.inject(sealThreadlineFrame(stolen, { kind: 'envelope', recipient: 'agent-b', conversation: genuine!.conversation,
      key: genuine!.key, digest: genuine!.digest, attempt: 'stolen' }, { envelope: offerEnvelope(edge), receipt: null }) as ThreadlineFrame);
    net.tick(1);
    expect(b.rejections.map(r => r.reason).sort()).toEqual(['bad-ciphertext', 'bad-ciphertext', 'bad-ciphertext', 'bad-signature',
      'future-schema', 'unknown-key', 'unknown-suite', 'wrong-recipient'].sort());
    expect([...b.ledger.view().values()]).toHaveLength(0);
    net.relay.inject(genuine!);
    net.tick(1);
    expect([...b.ledger.view().values()]).toHaveLength(1);
  });

  it('the relay holds routing identifiers and ciphertext only: no contract, question, grant or result is relay-visible', () => {
    const { net, a, edge } = setup();
    net.delegate(a, net.request(net.rootAuthority('agent-a'), 'agent-b', { sequence: 1, question: 'SECRET-QUESTION-MARKER' }));
    net.send(a, offerEnvelope(edge));
    net.tick(6);
    expect(a.ledger.view().get(edge.id)!.collected).toBe(true);
    expect(net.relay.held.length).toBeGreaterThan(4);
    for (const frame of net.relay.held) {
      expect(Object.keys(frame).sort()).toEqual(['attempt', 'conversation', 'digest', 'key', 'kind', 'nonce', 'protocol', 'recipient',
        'salt', 'schemaVersion', 'sealed', 'sender', 'suite']);
      const visible = JSON.stringify(frame);
      for (const hidden of ['SECRET-QUESTION-MARKER', 'grant:work', 'repo:instar', 'report-cites-files', '"result"', 'What does'])
        expect(visible).not.toContain(hidden);
    }
    // A retry re-seals (fresh salt and nonce) but keeps the inner logical key and digest.
    const offers = net.relay.held.filter(frame => frame.key === offerEnvelope(edge).key && frame.kind === 'envelope');
    expect(offers.length).toBeGreaterThanOrEqual(1);
    net.send(a, offerEnvelope(edge));
    const again = net.relay.held.filter(frame => frame.key === offerEnvelope(edge).key && frame.kind === 'envelope');
    expect(again.at(-1)!.digest).toBe(offers[0]!.digest);
    expect(again.at(-1)!.sealed).not.toBe(offers[0]!.sealed);
  });

  it('a captured frame reproduces byte for byte, opens only for its recipient, and every tamper refuses', () => {
    const fixturePath = fileURLToPath(new URL('./fixtures/threadline-ref-v2-offer.json', import.meta.url));
    const net = createNetwork('threadline');
    const a = net.add('agent-a', ['code'], () => null);
    const b = net.add('agent-b', ['code'], () => null);
    const edge = value(a.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b')));
    const keysA = createThreadlineKeyCustody({ principal: 'agent-a', identity: identityOf('agent-a'), peer: p => identityOf(p).public,
      random: counterRandom('captured-fixture') });
    const frame = sealThreadlineFrame(keysA, { kind: 'envelope', recipient: 'agent-b', conversation: edge.transport.conversation,
      key: offerEnvelope(edge).key, digest: offerEnvelope(edge).digest, attempt: 'captured' }, { envelope: offerEnvelope(edge), receipt: null }) as ThreadlineFrame;
    if (process.env.CAPTURE_THREADLINE_FIXTURE) writeFileSync(fixturePath, `${JSON.stringify(frame, null, 2)}\n`);
    const captured = JSON.parse(readFileSync(fixturePath, 'utf8')) as ThreadlineFrame;
    expect(frame).toEqual(captured);
    const flip = (field: 'sealed' | 'nonce' | 'salt') => { const bytes = Buffer.from(captured[field], 'base64'); bytes[0] = bytes[0]! ^ 0x80;
      return { ...captured, [field]: bytes.toString('base64') }; };
    for (const tampered of [flip('sealed'), flip('nonce'), flip('salt'), { ...captured, key: `${captured.key}x` },
      { ...captured, digest: 'sha256:0' }, { ...captured, attempt: 'replayed-elsewhere' }]) net.relay.inject(tampered);
    net.tick(1);
    expect(b.rejections.map(r => r.reason)).toEqual(Array(6).fill('bad-ciphertext'));
    expect([...b.ledger.view().values()]).toHaveLength(0);
    net.relay.inject(captured);
    net.tick(1);
    expect(b.ledger.view().get(edge.id)!.acceptance).not.toBeNull();
  });

  it('a third peer cannot supply the recipient\'s receipt: signer, conversation and digest must be the exact send', () => {
    const { net, a, c, edge } = setup();
    net.partition('agent-b');
    net.send(a, offerEnvelope(edge));
    const e = offerEnvelope(edge);
    const forged = (fields: Partial<{ conversation: string; digest: string }>) => sealThreadlineFrame(c.keys!, { kind: 'receipt',
      recipient: 'agent-a', conversation: fields.conversation ?? e.conversation, key: e.key, digest: fields.digest ?? e.digest, attempt: 'forged' },
    { envelope: null, receipt: { key: e.key, digest: fields.digest ?? e.digest, state: 'durably-queued', authoritative: 'c-assertion',
      result: null, durability: 'replicated' } }) as ThreadlineFrame;
    net.relay.inject(forged({})); net.relay.inject(forged({ conversation: 'WRONG' })); net.relay.inject(forged({ digest: 'WRONG' }));
    expect(a.threadline!.pump(a.endpoint).map(r => r.reason)).toEqual(['unexpected-receipt', 'unexpected-receipt', 'unexpected-receipt']);
    expect(net.observe(a, edge.id).state).toBe('uncertain');
    expect(a.ledger.view().get(edge.id)!.proven).not.toContain('durably-queued');
  });
});

describe.each(['local', 'threadline'] as const)('contract parties and current run authority over %s delivery', kind => {
  it('a signed third peer cannot return the recipient\'s result, whatever the result names inside', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null);
    net.add('agent-b', ['code'], () => null); const c = net.add('agent-c', ['code'], () => null);
    const contract = net.delegate(a, net.request(net.rootAuthority('agent-a'), 'agent-b'));
    const raw = resultEnvelope(contract, resultFor(contract, { terminal: 'completed', result: 'forged by c' },
      { localRun: 'run:x', runExit: 'exit:x', spent: 1 }), net.now());
    const { digest: _d, type: _t, schemaVersion: _v, ...fields } = raw;
    const sent = value(c.port.send(sealEnvelope({ ...fields, sender: 'agent-c' }), 'forged', 'submit'));
    net.tick(2);
    if (kind === 'local') expect(sent).toMatchObject({ state: 'refused', refusedWhat: 'receiving-admission' });
    expect(a.ledger.view().get(contract.id)!.result).toBeNull();
    expect(a.ledger.view().get(contract.id)!.collected).toBe(false);
    // An envelope naming someone else as its sender is refused before it is even sent over Threadline.
    if (kind === 'threadline') expect(refusal(c.port.send(raw, 'impersonated', 'submit'))).toContain('own principal');
    else expect(value(c.port.send(raw, 'impersonated', 'submit'))).toMatchObject({ state: 'refused' });
  });

  it('expired or revoked authority never starts the worker; the edge stays inhibited and owned', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null);
    let calls = 0;
    const b = net.add('agent-b', ['code'], () => { calls++; return done('ran'); });
    const expiring = net.delegate(a, net.request(net.rootAuthority('agent-a', { expiresAt: net.now() + 15 }), 'agent-b', { sequence: 0 }));
    if (kind === 'threadline') { b.threadline!.pump(b.endpoint); }
    net.advance(100); net.tick(3);
    expect(calls).toBe(0);
    expect(a.ledger.outstanding().map(edge => edge.contract.id)).toContain(expiring.id);
    const revoked = net.delegate(a, net.request(net.rootAuthority('agent-a'), 'agent-b', { sequence: 1 }));
    b.revoked.add(revoked.id);
    net.tick(3);
    expect(calls).toBe(0);
    expect(b.ledger.view().get(revoked.id)!.acceptance).not.toBeNull();
    expect(b.ledger.view().get(revoked.id)!.result).toBeNull();
    b.revoked.delete(revoked.id);
    net.tick(4);
    expect(calls).toBe(1);
    // The result carries the recipient run's RunExit and its accounted spend, within the edge budget.
    expect(a.ledger.view().get(revoked.id)!.result!.exit).toMatchObject({ runExit: expect.stringContaining(':completed'), spent: 1 });
  });

  it('a parent\'s cancellation confirms no more than descendant settlement proves', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null);
    const b = net.add('agent-b', ['code'], contract => {
      if (![...b.ledger.view().values()].some(edge => edge.contract.parentRun === contract.childRun))
        net.delegate(b, net.request(childAuthority(contract), 'agent-d', { budget: 1 }));
      return null;
    });
    net.add('agent-d', ['code'], () => null);
    const ab = net.delegate(a, net.request(net.rootAuthority('agent-a'), 'agent-b'));
    net.tick(4);
    const bd = [...b.ledger.view().values()].find(edge => edge.contract.recipient === 'agent-d')!;
    net.partition('agent-d');
    value(a.ledger.cancel(ab.id, 'agent-a', 'stop', net.now()));
    net.tick(6);
    expect(b.ledger.view().get(bd.contract.id)!.cancellation).toBe('requested');
    expect(a.ledger.view().get(ab.id)!.cancellation).toBe('requested');
    expect(a.ledger.outstanding().map(edge => edge.contract.id)).toEqual([ab.id]);
    net.rejoin('agent-d');
    net.tick(10);
    expect(b.ledger.view().get(bd.contract.id)!.cancellation).toBe('confirmed');
    expect(a.ledger.view().get(ab.id)!.cancellation).toBe('confirmed');
    expect(a.ledger.outstanding()).toHaveLength(0);
  });

  it('a receiver whose replicated demand is unmet never runs the child or claims custody, across redelivery and restart', () => {
    const net = createNetwork(kind);
    let calls = 0;
    const a = net.add('agent-a', ['code'], () => null, new Disk('replicated', 1));
    const b = net.add('agent-b', ['code'], () => { calls++; return done('ran'); }, new Disk());
    const contract = value(a.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b', { durability: 'replicated' })));
    for (let i = 0; i < 3; i++) { net.send(a, offerEnvelope(contract)); net.tick(2); }
    const b2 = net.restart('agent-b');
    net.send(a, offerEnvelope(contract)); net.tick(3);
    expect(calls).toBe(0);
    const edge = b2.ledger.view().get(contract.id)!;
    expect(edge.dispatchable).toBe(false);
    expect(edge.executable).toBe(false);
    expect(edge.acceptance).toBeNull();
    expect(b2.endpoint.lookup(offerEnvelope(contract).key, offerEnvelope(contract).digest, 'agent-a').state).not.toBe('durably-queued');
    expect(net.observe(a, contract.id).state).not.toBe('durably-queued');
    expect(a.ledger.view().get(contract.id)!.proven).not.toContain('durably-queued');
    // Once the receiver's store achieves the demand, redelivery completes the SAME edge; nothing is re-created.
    b2.disk.durability = 'replicated'; b2.disk.replicas = 1;
    net.send(a, offerEnvelope(contract)); net.tick(6);
    expect(calls).toBe(1);
    expect(a.ledger.view().get(contract.id)!.collected).toBe(true);
    expect(b2.disk.records.filter(r => r.record === 'edge').length).toBeGreaterThanOrEqual(1);
    expect(new Set(b2.disk.records.filter(r => r.record === 'acceptance').map(r => JSON.stringify(r))).size).toBe(1);
  });

  it('an acceptance appended below its replicated demand is not custody: no worker start until the acceptance itself is replicated', () => {
    const net = createNetwork(kind);
    let calls = 0;
    const a = net.add('agent-a', ['code'], () => null, new Disk('replicated', 1));
    const b = net.add('agent-b', ['code'], () => { calls++; return done('ran'); }, new Disk());
    const contract = value(a.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b', { durability: 'replicated' })));
    // The edge and its proof reach a replica; the acceptance append is answered only locally.
    b.disk.nextReceipts = [{ durability: 'replicated', replicas: 1 }, { durability: 'replicated', replicas: 1 }, { durability: 'local-durable', replicas: 0 }];
    net.send(a, offerEnvelope(contract)); net.tick(3);
    const edge = b.ledger.view().get(contract.id)!;
    expect([edge.dispatchable, edge.acceptance !== null, edge.executable]).toEqual([true, true, false]);
    expect(calls).toBe(0);
    expect(net.observe(a, contract.id).state).not.toBe('durably-queued');
    b.disk.durability = 'replicated'; b.disk.replicas = 1;
    net.send(a, offerEnvelope(contract)); net.tick(6);
    expect(calls).toBe(1);
    expect(a.ledger.view().get(contract.id)!.collected).toBe(true);
  });

  it('a lookup is answered only to the edge\'s counterpart', () => {
    const net = createNetwork(kind);
    const a = net.add('agent-a', ['code'], () => null);
    const b = net.add('agent-b', ['code'], () => null);
    const contract = net.delegate(a, net.request(net.rootAuthority('agent-a'), 'agent-b'));
    net.tick(2);
    const e = offerEnvelope(contract);
    expect(b.endpoint.lookup(e.key, e.digest, 'agent-a').state).toBe('delivered-to-worker');
    expect(b.endpoint.lookup(e.key, e.digest, 'agent-c').state).toBe('unknown');
  });
});
