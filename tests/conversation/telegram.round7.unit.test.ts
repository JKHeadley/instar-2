import { expect, it } from 'vitest';
import { extractTelegramUpdate } from '../../src/conversation/index.js';
import { conversationFixture } from './fixture.js';
import { telegramUpdate } from './round3-fixture.js';

function callbackUpdate(chatType: 'private' | 'supergroup' | 'channel'): string {
  return JSON.stringify({ update_id: 100, callback_query: {
    id: 'query:100', from: { id: 7, is_bot: false, first_name: 'Caller' },
    message: { message_id: 700, date: 1_700_000_000,
      chat: { id: chatType === 'private' ? 123 : -1000000001001, type: chatType }, text: 'Select an option' },
    chat_instance: 'chat-instance-1', data: 'choice:one',
  } });
}

function reactionUpdate(actor: 'user7' | 'user8' | 'channel200' | 'channel201' | 'invalid-user'): string {
  return JSON.stringify({ update_id: 100, message_reaction: {
    chat: { id: -1000000001001, type: 'supergroup' }, message_id: 700,
    ...(actor.startsWith('channel')
      ? { actor_chat: { id: actor === 'channel200' ? -1000000000200 : -1000000000201, type: 'channel', title: 'Actor' } }
      : { user: { id: actor === 'user7' ? 7 : 8, is_bot: actor === 'invalid-user' ? 'false' : false, first_name: 'Caller' } }),
    date: 1_700_000_000, old_reaction: [], new_reaction: [{ type: 'emoji', emoji: '👍' }],
  } });
}

it('P12-NF-07 P12-NF-08 P12-NF-10 P12-NF-16 P12-NF-17 round7 resolves sender evidence from each Telegram update variant', () => {
  const f = conversationFixture();
  for (const chatType of ['private', 'supergroup', 'channel'] as const) {
    const extracted = extractTelegramUpdate(callbackUpdate(chatType), f.declaration);
    expect(extracted.route.sender, chatType).toBe('telegram:v1:user:7');
    expect(extracted.principal, chatType).toEqual({ id: 'telegram:v1:user:7', kind: 'person' });
  }
  for (const [actor, sender] of [
    ['user7', 'telegram:v1:user:7'], ['user8', 'telegram:v1:user:8'],
    ['channel200', 'telegram:v1:channel:-1000000000200'], ['channel201', 'telegram:v1:channel:-1000000000201'],
  ] as const) {
    const extracted = extractTelegramUpdate(reactionUpdate(actor), f.declaration);
    expect(extracted.route.sender, actor).toBe(sender);
    expect(extracted.principal.kind, actor).toBe(actor.startsWith('channel') ? 'system' : 'person');
  }
  expect(() => extractTelegramUpdate(reactionUpdate('invalid-user'), f.declaration)).toThrow('boolean is_bot');
});

it('P12-NF-07 P12-NF-16 P12-NF-17 P12-NF-18 round7 validates sender-chat source discriminators before canonical identity', () => {
  const f = conversationFixture();
  const valid = extractTelegramUpdate(telegramUpdate(100, update => {
    update.message.sender_chat = { id: -1000000000200, type: 'channel' }; delete update.message.from;
  }), f.declaration);
  expect(valid.route.sender).toBe('telegram:v1:channel:-1000000000200');
  for (const senderChat of [
    { id: 0, type: 'channel' }, { id: -200 }, { id: -200, type: 'private' },
  ]) expect(() => extractTelegramUpdate(telegramUpdate(100, update => {
    update.message.sender_chat = senderChat; delete update.message.from;
  }), f.declaration)).toThrow();
});
