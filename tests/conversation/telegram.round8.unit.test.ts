import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { extractTelegramUpdate, renderTelegramDeliveryStatus } from '../../src/conversation/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramPreparedOutbound } from './round5-fixture.js';
import { telegramUpdate } from './round3-fixture.js';

const decodeCaptures = (captures: Readonly<Record<string, { readonly bytes?: string | null }>>) => Object.fromEntries(
  Object.entries(captures).flatMap(([reference, capture]) => typeof capture.bytes === 'string' ? [[reference, capture.bytes]] : []),
);

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

it('P12-NF-29 P12-NF-34 round8 status rendering accepts only the exact complete recorded operation observation', () => {
  const f = telegramPreparedOutbound();
  const observation = value(f.doorway.dispatch(f.request, f.effects.fence));
  const evidence = value(decode('Evidence', f.effects.evidenceInput({
    id: 'evidence:telegram-round8-platform-accepted',
    claim: { subject: observation.operation, predicate: 'operation-occurred', value: { digest: observation.digest } },
    source: 'probe', observedAt: f.effects.clock(100), freshFor: 100,
    capture: observation.capture, strength: 'proof',
  }), { ...f.effects.ctx.decode, captures: decodeCaptures(f.effects.ctx.captures) }));
  expect(renderTelegramDeliveryStatus({ observation, evidence, now: f.effects.clock(100),
    status: 'accepted-by-platform', form: 'words' }, f.effects.host.boundary).kind).toBe('Success');

  for (const [name, mutate] of [
    ['wrong-account', (candidate: any) => { candidate.account = 'telegram:v1:bot:9002'; }],
    ['wrong-conversation', (candidate: any) => { candidate.conversation = 'telegram:v1:bot:9001:chat:-1001:topic:999'; }],
    ['wrong-request', (candidate: any) => { candidate.request = 'request:unrelated'; }],
    ['wrong-claim', (candidate: any) => { candidate.claim = 'claim:unrelated'; }],
    ['missing-id', (candidate: any) => { delete candidate.id; }],
  ] as const) {
    const candidate: any = { ...observation, capture: { ...observation.capture } };
    mutate(candidate);
    expect(renderTelegramDeliveryStatus({ observation: candidate, evidence, now: f.effects.clock(100),
      status: 'accepted-by-platform', form: 'words' }, f.effects.host.boundary).kind, name).toBe('Refused');
  }
});
