import { expect, it } from 'vitest';
import { extractTelegramUpdate, normalizeTelegramTopic } from '../../src/conversation/index.js';
import { conversationFixture } from './fixture.js';
import { telegramUpdate } from './round3-fixture.js';

it('P12-NF-16 P12-NF-17 round6 rejects malformed forum and chat/sender discriminators before canonical routing', () => {
  for (const forum of ['false', 'true', 0, 1, null, undefined]) {
    expect(() => normalizeTelegramTopic(forum as never, null), String(forum)).toThrow('forum discriminator');
  }

  const f = conversationFixture();
  const invalid = [
    (update: any) => { update.message.chat.is_forum = 'true'; delete update.message.message_thread_id; },
    (update: any) => { update.message.chat.is_forum = 1; delete update.message.message_thread_id; },
    (update: any) => { update.message.chat.is_forum = null; delete update.message.message_thread_id; },
    (update: any) => { update.message.chat.type = 'private'; },
    (update: any) => {
      update.message.chat.type = 'channel'; delete update.message.chat.is_forum; delete update.message.message_thread_id;
    },
  ];
  for (const mutate of invalid) expect(() => extractTelegramUpdate(telegramUpdate(100, mutate), f.declaration)).toThrow();

  expect(extractTelegramUpdate(telegramUpdate(100, update => {
    update.message.chat = { id: 123, type: 'private' }; delete update.message.message_thread_id;
  }), f.declaration).conversation).toMatch(/:chat:123:direct$/);
  expect(extractTelegramUpdate(telegramUpdate(100, update => {
    delete update.message.message_thread_id;
  }), f.declaration).conversation).toMatch(/:general$/);
  expect(extractTelegramUpdate(telegramUpdate(100, update => {
    update.message.message_thread_id = 1;
  }), f.declaration).conversation).toMatch(/:general$/);
  expect(extractTelegramUpdate(telegramUpdate(100), f.declaration).conversation).toMatch(/:topic:42$/);
});
