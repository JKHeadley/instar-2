import { expect, it } from 'vitest';
import { extractTelegramUpdate } from '../../src/conversation/index.js';
import { conversationFixture } from './fixture.js';
import { telegramUpdate } from './round3-fixture.js';

it('P12-NF-16 P12-NF-17 P12-NF-18 round8 validates a destination chat id and type as one Telegram identity', () => {
  const f = conversationFixture();
  for (const [name, chat, accepted] of [
    ['private', { id: 123, type: 'private' }, true],
    ['group', { id: -123, type: 'group' }, true],
    ['group-prefix-neighbor', { id: -1001, type: 'group' }, true],
    ['supergroup', { id: -1000000000123, type: 'supergroup' }, true],
    ['channel', { id: -1000000000123, type: 'channel' }, true],
    ['private-negative', { id: -123, type: 'private' }, false],
    ['group-positive', { id: 123, type: 'group' }, false],
    ['group-channel-range', { id: -1000000000123, type: 'group' }, false],
    ['supergroup-positive', { id: 123, type: 'supergroup' }, false],
    ['supergroup-basic-range', { id: -123, type: 'supergroup' }, false],
    ['channel-positive', { id: 123, type: 'channel' }, false],
    ['channel-basic-range', { id: -123, type: 'channel' }, false],
  ] as const) {
    const raw = telegramUpdate(100, update => {
      update.message.chat = chat;
      delete update.message.message_thread_id;
      if (chat.type === 'channel') {
        update.channel_post = { ...update.message, sender_chat: { id: chat.id, type: 'channel' } };
        delete update.channel_post.from;
        delete update.message;
      }
    });
    if (accepted) expect(extractTelegramUpdate(raw, f.declaration).conversation, name).toContain(`:chat:${chat.id}:direct`);
    else expect(() => extractTelegramUpdate(raw, f.declaration), name).toThrow('Telegram destination');
  }
});
