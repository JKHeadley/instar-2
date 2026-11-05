import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { telegramConversation } from '../../src/conversation/index.js';
import { offerEnvelope, type Run } from '../../src/rungraph/index.js';
import type { ProductionDelegationProjection } from '../../src/assembly/production-delegation.js';
import { createNetwork } from '../transport/agent-fault-harness.js';
import { connectProductionCollaboration } from './production-collaboration.js';

// Promoted from Astra's two actual projection regressions. This read-only fact
// view tests projection only; production authority is covered in assembly.
async function fixture(body: Record<string, unknown>) {
  const network = createNetwork('local');
  const sender = network.add('sender', ['code'], () => null);
  const receiver = network.add('receiver', ['code'], () => null);
  network.add('third', ['code'], () => null);
  const envelope = offerEnvelope(network.delegate(sender, network.request(network.rootAuthority('sender'), 'receiver')));
  const child = network.delegate(receiver, { ...network.request(network.rootAuthority('receiver'), 'third'), conversation: 'nested-thread' });
  const parent = { opening: { id: 'actual-intake' } } as Run;
  const view = { genesis: { bot: '12345678', chat: '-1007654321000', forum: true },
    turns: new Map<string, { accepted: boolean; thread: number; update: number; raw: string; id: string }>(),
    collaboration: { inbox: [{ envelope, receipt: { key: envelope.key, digest: envelope.digest, durability: 'local-durable', state: 'durably-queued' } }], threads: [{ threadId: envelope.conversation, parent: 42 }],
      origins: [] as { edge: string; digest: string; topic: number; source: string }[] } };
  let consumer: ProductionDelegationProjection;
  let clean = true;
  const owners = { composition: { spine: { store: { readForProjection: () => ({
    type: 'Result', schemaVersion: 1, kind: 'Success', capacity: { kind: 'none' },
    value: { entries: [{ fact: { id: parent.opening.id, kind: 'intake-admitted', body }, taint: clean ? [] : ['tainted'], conflicts: [] }] },
  }) } } }, delegation: { connectProjection(value: ProductionDelegationProjection) { consumer = value; },
    pump() {}, collectDue() {}, ledger: { view: () => new Map() } } };
  type Input = Parameters<typeof connectProductionCollaboration>[0];
  const binding = connectProductionCollaboration({ owners: owners as unknown as Input['owners'],
    hub: { async drain() {}, capture() {} } as unknown as Input['hub'],
    view: () => view as unknown as ReturnType<Input['view']>,
    append(row) {
      if (row.action === 'origin') view.collaboration.origins.push({ edge: row.envelope.edge,
        digest: child.digest, topic: row.topic, source: row.source });
    }, now: () => 1000, admitted: () => true });
  await binding.maintain();
  return { view, body, child, parent, envelope, origin: () => consumer.origin(child, parent), taint: () => { clean = false; } };
}

it.each(['scheduled:daily-job', 'other:channel', 'telegram:v1:bot:12345678:chat:-1007654321001:topic:42',
  'telegram:v1:bot:12345678:chat:-1007654321000:general'])(
  'authenticated work outside the configured forum topic skips projection: %s', async channel => {
    const f = await fixture({ channel, intent: { via: 'scheduled-intake-v1' } });
    expect(f.origin).not.toThrow();
    expect(f.view.collaboration.origins).toEqual([]);
    f.taint();
    expect(f.origin).toThrow('clean actual Four parent required');
  });

it('an exact forum claim needs the matching admitted raw turn and cannot redirect its first origin', async () => {
  const f = await fixture({ channel: 'telegram:v1:bot:12345678:chat:-1007654321000:topic:42', eventId: '7', rawHash: hashBytes('raw') });
  expect(f.origin).toThrow('parent has no exact admitted conversation topic');
  f.view.turns.set('turn', { accepted: true, thread: 42, update: 7, raw: 'wrong', id: 'turn' });
  expect(f.origin).toThrow('parent has no exact admitted conversation topic');
  f.view.turns.get('turn')!.raw = 'raw';
  f.origin(); f.origin();
  expect(f.view.collaboration.origins).toHaveLength(1);
  f.view.turns.get('turn')!.thread = 43;
  f.body.channel = telegramConversation(f.view.genesis.bot, { chatId: f.view.genesis.chat, forum: true, messageThreadId: 43 });
  expect(f.origin).toThrow('automatic origin cannot redirect a conversation');
});

it('nested replay retains first origin after a parent move but rejects different source or digest claims', async () => {
  const f = await fixture({});
  f.body.intent = { via: 'threadline-intake-v1', ask: consumeResult(canonical(f.envelope), {
    Success: value => value.bytes, Refused: refusal => { throw Error(refusal.detail); } }) };
  f.origin();
  expect(f.view.collaboration.origins[0]).toMatchObject({ topic: 42, source: `threadline:${f.envelope.key}` });
  f.view.collaboration.threads[0]!.parent = 43;
  f.origin(); f.origin();
  expect(f.view.collaboration.origins).toHaveLength(1);
  expect(f.view.collaboration.origins[0]!.topic).toBe(42);
  f.view.collaboration.origins[0]!.digest = 'different';
  expect(f.origin).toThrow('automatic origin cannot redirect a conversation');
  f.view.collaboration.origins[0]!.digest = f.child.digest;
  f.view.collaboration.origins[0]!.source = 'threadline:another-source';
  expect(f.origin).toThrow('automatic origin cannot redirect a conversation');
});

it('authenticated parentless Threadline work keeps its worker path without inventing a topic', async () => {
  const f = await fixture({ intent: { via: 'threadline-intake-v1', ask: 'no retained parent' } });
  expect(f.origin).not.toThrow();
  expect(f.view.collaboration.origins).toEqual([]);
});
