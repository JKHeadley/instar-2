import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  dryRunLegacyConversationMigration, extractTelegramUpdate, renderTelegramHtml,
} from '../../src/conversation/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramUpdate } from './round3-fixture.js';

const sourceChats = [
  ['group', { id: -123, type: 'group' }, true],
  ['supergroup', { id: -1000000000123, type: 'supergroup' }, true],
  ['channel', { id: -1000000000123, type: 'channel' }, true],
  ['group-with-channel-id', { id: -1000000000123, type: 'group' }, false],
  ['supergroup-with-group-id', { id: -123, type: 'supergroup' }, false],
  ['channel-with-group-id', { id: -123, type: 'channel' }, false],
] as const;

function reactionUpdate(actorChat: { readonly id: number; readonly type: string }): string {
  return JSON.stringify({ update_id: 100, message_reaction: {
    chat: { id: -1000000001001, type: 'supergroup' }, message_id: 700,
    actor_chat: actorChat, date: 1_700_000_000, old_reaction: [], new_reaction: [],
  } });
}

function channelPostUpdate(variant: 'channel_post' | 'edited_channel_post',
  chat: { readonly id: number; readonly type: string }, explicitSource: boolean): string {
  return telegramUpdate(100, update => {
    update[variant] = { ...update.message, chat };
    delete update[variant].message_thread_id;
    delete update.message;
    if (explicitSource) update[variant].sender_chat = { id: -1000000001001, type: 'channel' };
  });
}

it('P12-NF-07 P12-NF-16 P12-NF-17 P12-NF-18 round9 finding 1 validates every sender_chat and reaction actor_chat id/type pair', () => {
  const f = conversationFixture();
  for (const [name, chat, accepted] of sourceChats) for (const source of ['sender_chat', 'actor_chat'] as const) {
    const raw = source === 'sender_chat' ? telegramUpdate(100, update => {
      update.message.sender_chat = chat; delete update.message.from;
    }) : reactionUpdate(chat);
    if (accepted) expect(extractTelegramUpdate(raw, f.declaration).principal.kind, `${source}:${name}`).toBe('system');
    else expect(() => extractTelegramUpdate(raw, f.declaration), `${source}:${name}`)
      .toThrow('inconsistent chat id representation');
  }
});

it('P12-NF-16 P12-NF-17 P12-NF-18 round9 finding 2 binds channel-post destination rules to the actual variant', () => {
  const f = conversationFixture();
  for (const variant of ['channel_post', 'edited_channel_post'] as const) {
    for (const [name, chat, accepted] of [
      ['channel', { id: -1000000001001, type: 'channel' }, true],
      ['group', { id: -123, type: 'group' }, false],
      ['private', { id: 123, type: 'private' }, false],
    ] as const) for (const explicitSource of [false, true]) {
      const raw = channelPostUpdate(variant, chat, explicitSource);
      if (accepted) expect(extractTelegramUpdate(raw, f.declaration).principal.kind,
        `${variant}:${name}:${explicitSource}`).toBe('system');
      else expect(() => extractTelegramUpdate(raw, f.declaration),
        `${variant}:${name}:${explicitSource}`).toThrow('channel destination');
    }
  }
});

it('P12-NF-07 P12-NF-16 P12-NF-17 round9 every update family crosses the one variant-aware source identity resolver', () => {
  const f = conversationFixture();
  const cases = [
    ['message-destination', telegramUpdate(100, update => { update.message.chat = { id: -7, type: 'private' }; })],
    ['edited-message-source', telegramUpdate(100, update => {
      update.edited_message = { ...update.message, sender_chat: { id: -7, type: 'channel' } };
      delete update.edited_message.from; delete update.message;
    })],
    ['channel-post-variant', channelPostUpdate('channel_post', { id: -7, type: 'group' }, true)],
    ['edited-channel-post-variant', channelPostUpdate('edited_channel_post', { id: -7, type: 'group' }, true)],
    ['reaction-source', reactionUpdate({ id: -7, type: 'supergroup' })],
    ['callback-sender', JSON.stringify({ update_id: 100, callback_query: { id: 'callback:1',
      from: { id: -7, is_bot: false }, message: { message_id: 1, chat: { id: 7, type: 'private' } } } })],
    ['inline-missing-destination', JSON.stringify({ update_id: 100, inline_query: {
      id: 'inline:1', from: { id: 7, is_bot: false }, query: '', offset: '',
    } })],
  ] as const;
  for (const [name, raw] of cases) expect(() => extractTelegramUpdate(raw, f.declaration), name).toThrow();
});

it('P12-NF-29 P12-NF-30 round9 finding 3 direct renderer and dispatch share the control-data contract', () => {
  const f = conversationFixture();
  expect(value(renderTelegramHtml('A &lt; B &amp; C', f.declaration, f.admissionDependencies.boundary)))
    .toBe('A &amp;lt; B &amp;amp; C');
  for (const text of ['bad\u0000text', 'bad\u0001text'])
    expect(renderTelegramHtml(text, f.declaration, f.admissionDependencies.boundary).kind).toBe('Refused');
});

it('P12-NF-52 round9 finding 4 reports the exact payload-less legacy send without import or replay', () => {
  const f = conversationFixture();
  const source = readFileSync('tests/conversation/fixtures/legacy/conversation-registry-send-intent.jsonl', 'utf8');
  const report = value(dryRunLegacyConversationMigration({ source, maxBytes: 4096, maxRecords: 4 },
    f.admissionDependencies.boundary));
  expect(report.mode).toBe('read-only');
  expect(report.records).toHaveLength(1);
  expect(report.records[0]).toMatchObject({ line: 1, raw: source.trim(), operation: 'send-intent',
    disposition: 'unmappable', importPermitted: false, replayPermitted: false });
  expect(report.records[0]!.missingEvidence).toEqual(expect.arrayContaining([
    'payload', '2.0 run', 'OperationDefinition', 'reservation', 'dispatch claim',
    'request digest', 'provider receipt', 'Part Nine assessment', 'final charge closure',
  ]));
  expect(report).toMatchObject({ imported: 0, replayed: 0, providerCalls: 0 });

  expect(dryRunLegacyConversationMigration({ source: '{not-json}\n', maxBytes: 4096, maxRecords: 4 },
    f.admissionDependencies.boundary).kind).toBe('Refused');
});
