import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { extractTelegramUpdate, renderTelegramDeliveryStatus } from '../../src/conversation/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramPreparedOutbound } from './round5-fixture.js';
import { telegramUpdate, wireTelegram } from './round3-fixture.js';

const decodeCaptures = (captures: Readonly<Record<string, { readonly bytes?: string | null }>>) => Object.fromEntries(
  Object.entries(captures).flatMap(([reference, capture]) => typeof capture.bytes === 'string' ? [[reference, capture.bytes]] : []),
);

it('P12-NF-16 P12-NF-17 P12-NF-18 round8 inconsistent destination identities refuse before receipt and offset advance', () => {
  for (const chat of [
    { id: -123, type: 'private' }, { id: 123, type: 'group' },
    { id: -1000000000123, type: 'group' }, { id: 123, type: 'supergroup' },
    { id: -123, type: 'supergroup' }, { id: 123, type: 'channel' }, { id: -123, type: 'channel' },
  ] as const) {
    const f = conversationFixture({ initialOffset: 100 });
    const wired = wireTelegram(f);
    f.queue(telegramUpdate(100, update => {
      update.message.chat = chat;
      delete update.message.message_thread_id;
      if (chat.type === 'channel') {
        update.message.sender_chat = { id: chat.id, type: 'channel' };
        delete update.message.from;
      }
    }));
    expect(wired.ingress.pollOnce().kind, chat.type).toBe('Refused');
    expect(value(wired.ingress.currentOffset()), chat.type).toBe(100);
    expect(value(wired.facts.read()).filter(row => row.kind === 'intake-receipt'), chat.type).toHaveLength(0);
  }
});

it('P12-NF-29 P12-NF-34 round8 real Six/Eight response history binds every displayed status subject field', () => {
  const f = telegramPreparedOutbound();
  const observation = value(f.doorway.dispatch(f.request, f.effects.fence));
  const evidence = value(decode('Evidence', f.effects.evidenceInput({
    id: 'evidence:telegram-round8-integration',
    claim: { subject: observation.operation, predicate: 'operation-occurred', value: { digest: observation.digest } },
    source: 'probe', observedAt: f.effects.clock(100), freshFor: 100,
    capture: observation.capture, strength: 'proof',
  }), { ...f.effects.ctx.decode, captures: decodeCaptures(f.effects.ctx.captures) }));
  const substitutions = [
    { ...observation, account: 'telegram:v1:bot:9002' },
    { ...observation, conversation: 'telegram:v1:bot:9001:chat:-1000000001001:topic:999' },
    { ...observation, request: 'request:unrelated' },
    { ...observation, claim: 'claim:unrelated' },
  ];
  for (const candidate of substitutions) expect(renderTelegramDeliveryStatus({ observation: candidate, evidence,
    now: f.effects.clock(100), status: 'accepted-by-platform', form: 'words' }, f.effects.host.boundary).kind).toBe('Refused');
  const incomplete: any = { ...observation }; delete incomplete.id;
  expect(renderTelegramDeliveryStatus({ observation: incomplete, evidence, now: f.effects.clock(100),
    status: 'accepted-by-platform', form: 'words' }, f.effects.host.boundary).kind).toBe('Refused');
});

it('P12-NF-14 P12-NF-15 P12-NF-17 P12-NF-26 round8 rename and forwarded content cannot merge Telegram histories or bindings', () => {
  const f = conversationFixture({ initialOffset: 100 });
  const original = telegramUpdate(100, update => { update.message.chat.id = -1000000001001; });
  const sameChatRenamed = telegramUpdate(101, update => {
    update.message.chat.id = -1000000001001;
    update.message.chat.title = 'Renamed group';
    update.message.from.first_name = 'New display label';
    update.message.forward_origin = { type: 'user', date: 1_700_000_000,
      sender_user: { id: 888, is_bot: false, first_name: 'Quoted person' } };
  });
  const otherChatSameTitle = telegramUpdate(102, update => {
    update.message.chat.id = -1000000001002;
    update.message.chat.title = 'Renamed group';
    update.message.from.id = 8;
    update.message.forward_origin = { type: 'user', date: 1_700_000_000,
      sender_user: { id: 7, is_bot: false, first_name: 'Original operator' } };
  });
  f.bind(extractTelegramUpdate(original, f.declaration).route);
  const wired = wireTelegram(f);
  f.queue(original, sameChatRenamed, otherChatSameTitle);
  const cycle = value(wired.ingress.pollOnce());
  expect(cycle.captured.map(row => row.intake)).toEqual(['admitted', 'admitted', 'admitted']);

  const first = extractTelegramUpdate(original, f.declaration);
  const renamed = extractTelegramUpdate(sameChatRenamed, f.declaration);
  const other = extractTelegramUpdate(otherChatSameTitle, f.declaration);
  expect(renamed.conversation).toBe(first.conversation);
  expect(renamed.route.sender).toBe(first.route.sender);
  expect(other.conversation).not.toBe(first.conversation);
  expect(other.route.sender).not.toBe(first.route.sender);
  const admissions = value(wired.facts.read()).filter(row => row.kind === 'intake-admitted');
  const bindings = admissions.map(row => (row.body as any).binding);
  expect(bindings[0]).not.toBe('none');
  expect(bindings[1]).toBe(bindings[0]);
  expect(bindings[2]).toBe('none');
  expect(admissions.map(row => (row.body as any).work.standing)).toEqual(['requester', 'requester', 'requester']);
});
