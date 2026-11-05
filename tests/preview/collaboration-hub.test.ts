import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal, projectionDigest } from './journal.js';
import { CollaborationSurfacer, collaborationEndpoint, type HubEffect, type HubOutcome } from './collaboration-hub.js';
import { createNetwork } from '../transport/agent-fault-harness.js';
import { offerEnvelope } from '../../src/rungraph/index.js';

const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'hub-test', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
  maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const key = new Uint8Array(32).fill(71);
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'hub-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis), admitted = true, now = 1000, replicated = true;
  let answer: HubOutcome | null = null;
  const sent: { id: string; effect: HubEffect }[] = [];
  const make = () => new CollaborationSurfacer({ state: () => journal.view.collaboration,
    append: r => journal.append(r), now: () => now, admitted: () => admitted && journal.view.stop === null && now < journal.view.expires,
    replicated: async () => replicated, topics: () => [{ topicId: 42, topicName: 'Build' }],
    effect: async (id, effect) => { sent.push({ id, effect }); return answer ?? { kind: 'accepted', id: effect.kind === 'topic' ? 77 : sent.length }; } });
  return { get journal() { return journal; }, make, sent, setAnswer: (v: HubOutcome | null) => { answer = v; },
    setOwner: (v: boolean) => { admitted = v; }, setTime: (v: number) => { now = v; }, setReplicated: (v: boolean) => { replicated = v; },
    restart() { const digest = projectionDigest(journal.view); journal.compact(); journal.close(); journal = openPreviewJournal(path, key);
      expect(projectionDigest(journal.view)).toBe(digest); return make(); },
    close() { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}
const cold = { threadId: 'cold', senderName: 'peer', text: 'Please verify the build', warrants: true, hasParentTopic: false };

it('one silent hub survives restart; parent routing and housekeeping stay separate and deduplicate by identity', async () => {
  const f = fixture(); let hub = f.make();
  try {
    expect(await hub.surface({ ...cold, hasParentTopic: true })).toMatchObject({ reason: 'has-parent-topic' });
    expect(await hub.surface({ ...cold, warrants: false })).toMatchObject({ reason: 'not-warranted' });
    expect(f.sent).toHaveLength(0);
    await Promise.all([hub.surface(cold), hub.surface({ ...cold, threadId: 'cold2' })]);
    expect(f.sent.filter(x => x.effect.kind === 'topic')).toHaveLength(1);
    expect(f.sent.filter(x => x.effect.kind === 'message').every(x => x.effect.kind === 'message' && x.effect.silent && x.effect.topic === 77)).toBe(true);
    expect(await hub.bind({ targetTopicId: 42 })).toMatchObject({ ok: false, status: 409 });
    expect(await hub.bind({ threadId: 'cold', targetTopicId: 99 })).toMatchObject({ ok: false, status: 400 });
    expect(await hub.bind({ threadId: 'cold', targetTopicId: 42 })).toMatchObject({ ok: true, outcome: 'bound' });
    hub = f.restart();
    expect(await hub.surface(cold)).toMatchObject({ reason: 'has-parent-topic' });
    await hub.content({ threadId: 'cold', messageId: 'result1', text: 'The build passed' });
    await hub.notify({ threadId: 'cold', id: 'pause1', title: 'Loop paused', body: 'Housekeeping' });
    await hub.notify({ threadId: 'cold', id: 'pause1', title: 'Loop paused', body: 'Housekeeping' });
    expect(f.sent.at(-2)?.effect).toMatchObject({ topic: 42, silent: false });
    expect(f.sent.at(-1)?.effect).toMatchObject({ topic: 77, silent: true });
    expect(f.sent.filter(x => x.id.startsWith('notice:'))).toHaveLength(1);
    await hub.notify({ threadId: 'cold', id: 'pause2', title: 'Loop paused again', body: 'New episode' });
    expect(f.sent.filter(x => x.id.startsWith('notice:'))).toHaveLength(2);
  } finally { f.close(); }
});

it('unknown creation and sends never retry after restart; stopped, expired and unauthorized owners cannot append', async () => {
  const f = fixture(); let hub = f.make();
  try {
    f.setOwner(false); await expect(hub.surface(cold)).rejects.toThrow(/owner/); expect(f.sent).toHaveLength(0);
    f.setOwner(true); f.setTime(genesis.expires); await expect(hub.surface(cold)).rejects.toThrow(/owner/);
    f.setTime(1000); f.setAnswer({ kind: 'unknown', reason: 'response lost' });
    expect(await hub.surface(cold)).toMatchObject({ reason: 'hub-unconfirmed' });
    hub = f.restart(); await hub.surface({ ...cold, threadId: 'next' }); expect(f.sent).toHaveLength(1);
    f.journal.append({ kind: 'stop', reason: 'test stop', at: 1000 });
    await expect(hub.surface({ ...cold, threadId: 'stopped' })).rejects.toThrow(/owner/);
  } finally { f.close(); }
  const g = fixture();
  try {
    let bound = g.make(); await bound.surface(cold); await bound.bind({ threadId: 'cold', targetTopicId: 42 });
    g.setAnswer({ kind: 'unknown', reason: 'accepted but receipt lost' });
    expect(await bound.content({ threadId: 'cold', messageId: 'r1', text: 'Result' })).toMatchObject({ kind: 'unknown' });
    const count = g.sent.length; bound = g.restart();
    await bound.content({ threadId: 'cold', messageId: 'r1', text: 'Result' }); expect(g.sent).toHaveLength(count);
  } finally { g.close(); }
});

it('actual encrypted transport/custody feeds the bound consumer only after endpoint admission; uncertain judgment retains input', async () => {
  const f = fixture(), hub = f.make(), network = createNetwork('threadline');
  const sender = network.add('sender', ['code'], () => null), receiver = network.add('receiver', ['code'], () => null);
  receiver.endpoint = collaborationEndpoint(receiver.endpoint, hub, receiver.ledger);
  try {
    network.relay.duplicate = true;
    const contract = network.delegate(sender, network.request(network.rootAuthority('sender'), 'receiver'));
    network.tick(); expect(hub.list().inbox).toHaveLength(1); expect(f.sent).toHaveLength(0);
    await hub.drain(async () => null); expect(hub.list().inbox[0]?.handled).toBe(false);
    await hub.drain(async () => ({ warrants: true, parentTopicId: null }));
    expect(hub.list().inbox[0]?.handled).toBe(true); expect(f.sent).toHaveLength(2);
    const envelope = offerEnvelope(contract);
    expect(receiver.endpoint.receive(envelope, 1000, 'impostor').state).toBe('refused');
    expect(hub.list().inbox).toHaveLength(1);
    expect(receiver.endpoint.lookup(envelope.key, envelope.digest, 'impostor').state).toBe('unknown');
    expect(f.sent).toHaveLength(2);
    const restarted = f.restart();
    receiver.endpoint = collaborationEndpoint(network.restart('receiver').endpoint, restarted, receiver.ledger);
    network.send(sender, envelope); network.tick();
    await restarted.drain(async () => ({ warrants: true, parentTopicId: null }));
    expect(f.sent).toHaveLength(2); expect(restarted.list().inbox).toHaveLength(1);
  } finally { f.close(); }
});

it('boot recovers endpoint custody without redelivery, and prepared effects resume without repeating a dispatch', async () => {
  const f = fixture(), network = createNetwork('threadline');
  const sender = network.add('sender', ['code'], () => null), receiver = network.add('receiver', ['code'], () => null);
  try {
    const contract = network.delegate(sender, network.request(network.rootAuthority('sender'), 'receiver'));
    network.tick(); // Endpoint accepted; process lost before hub append.
    expect(f.journal.view.collaboration).toBeUndefined();
    const hub = f.restart();
    receiver.endpoint = collaborationEndpoint(receiver.endpoint, hub, receiver.ledger);
    expect(hub.list().inbox).toHaveLength(1);
    const before = projectionDigest(f.journal.view), envelope = offerEnvelope(contract);
    expect(receiver.endpoint.lookup(envelope.key, envelope.digest, 'sender').state).toBe('delivered-to-worker');
    expect(projectionDigest(f.journal.view)).toBe(before); // Lookup is read-only.
    f.setReplicated(false);
    await hub.drain(async () => ({ warrants: true, parentTopicId: null }));
    expect(hub.list().inbox[0]?.handled).toBe(false); expect(f.sent).toHaveLength(0);
    const recovered = f.restart(); f.setReplicated(true);
    await recovered.drain(async () => ({ warrants: true, parentTopicId: null }));
    expect(recovered.list().inbox[0]?.handled).toBe(true); expect(f.sent).toHaveLength(2);
  } finally { f.close(); }
});
