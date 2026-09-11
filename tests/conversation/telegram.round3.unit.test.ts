import { expect, it } from 'vitest';
import { extractTelegramUpdate, telegramConversation } from '../../src/conversation/index.js';
import { conversationFixture } from './fixture.js';
import { telegramUpdate } from './round3-fixture.js';

it('P12-NF-03 P12-NF-04 P12-NF-12 round3 token reference requires the closed owned SecretRef shape', () => {
  const f = conversationFixture();
  const result = f.admit({ ...f.declaration,
    token: { vault: 'vault', name: 'telegram-bot-token-fixture' } } as any);
  expect(result.kind).toBe('Refused');
  if (result.kind === 'Refused') expect(result.detail).toContain('closed owned SecretRef');
});

it('P12-NF-16 round3 public Telegram routes reject alternate numeric representations', () => {
  expect(telegramConversation('9001', { chatId: '123', forum: false, messageThreadId: null }))
    .toBe('telegram:v1:bot:9001:chat:123:direct');
  expect(() => telegramConversation('9001', { chatId: '00123', forum: false, messageThreadId: null }))
    .toThrow('canonical authenticated numeric');
  expect(() => telegramConversation('09001', { chatId: '123', forum: false, messageThreadId: null }))
    .toThrow('canonical positive numeric');
});

it('P12-NF-07 P12-NF-08 P12-NF-16 P12-NF-17 round3 edited channels and bot authors remain non-human with or without compatibility from', () => {
  const f = conversationFixture();
  const editedWithCompatibility = telegramUpdate(100, update => {
    update.message.sender_chat = { id: -200, type: 'channel' };
    update.message.from = { id: 136817688, is_bot: true };
    update.edited_message = update.message;
    delete update.message;
  });
  expect(extractTelegramUpdate(editedWithCompatibility, f.declaration).principal)
    .toEqual({ id: 'telegram:v1:channel:-200', kind: 'system' });

  const editedWithoutCompatibility = telegramUpdate(101, update => {
    update.message.sender_chat = { id: -200, type: 'channel' };
    delete update.message.from;
    update.edited_message = update.message;
    delete update.message;
  });
  expect(extractTelegramUpdate(editedWithoutCompatibility, f.declaration).principal)
    .toEqual({ id: 'telegram:v1:channel:-200', kind: 'system' });

  const botAuthored = telegramUpdate(102, update => { update.message.from.is_bot = true; });
  expect(extractTelegramUpdate(botAuthored, f.declaration).principal)
    .toEqual({ id: 'telegram:v1:bot-sender:7', kind: 'system' });
});

it('P12-NF-18 P12-NF-38 P12-NF-46 P12-NF-49 round3 still-fresh unchanged admission reuses its immutable conformance revision', () => {
  const f = conversationFixture();
  const first = f.admitted.conformance;
  Object.assign(f.admissionDependencies, { clock: () => f.intake.f.clock(101) });
  const result = f.admit();
  expect(result.kind).toBe('Success');
  if (result.kind === 'Success') {
    expect(result.value.conformance.id).toBe(first.id);
    expect(result.value.conformance.testedAt).toBe(first.testedAt);
    expect(result.value.conformance.validUntil).toBe(first.validUntil);
  }
});
