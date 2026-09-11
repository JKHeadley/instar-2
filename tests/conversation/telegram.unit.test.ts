import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import {
  extractTelegramUpdate, normalizeTelegramTopic, renderTelegramHtml,
  telegramAccount, telegramConversation,
} from '../../src/conversation/index.js';
import type { TelegramBotDeclaration, TelegramIdentityProbe } from '../../src/conversation/index.js';
import { conversationFixture, telegramRaw } from './fixture.js';

const refused = <T>(result: Result<T>, detail: string) =>
  consumeResult(result, {
    Success: () => { throw new Error('expected refusal'); },
    Refused: value => { expect(value.detail).toContain(detail); return value; },
  });

it('P12-NF-04 P12-NF-07 P12-NF-45 P12-NF-46 declaration defaults to one long-poll mode and requires a matching fresh identity probe', () => {
  const f = conversationFixture();
  expect(f.admitted).toMatchObject({ id: 'telegram:v1:bot:9001', account: 'telegram:v1:bot:9001', mode: 'long-poll' });
  expect(f.admitted.declaration.supportedOperations).toEqual(['ordinary-reply']);
  expect(f.calls.identity).toEqual([{ token: f.declaration.token, apiVersion: '9.2' }]);
  expect(JSON.stringify(f.calls.identity)).not.toMatch(/[0-9]{6,}:[A-Za-z0-9_-]{20,}/);

  const mismatch: TelegramIdentityProbe = { ...f.admitted.probe, botId: '9002', reference: 'probe:1' };
  f.setProbe(mismatch);
  refused(f.admit(), 'does not match');

  f.setProbe({ ...f.admitted.probe, observedAt: 1, freshFor: 1, reference: 'probe:1' });
  refused(f.admit(), 'stale');
});

it('P12-NF-04 P12-NF-18 an endpoint is never public by omission and a bot cannot admit two intake modes', () => {
  const f = conversationFixture();
  expect(f.admitted.mode).toBe('long-poll');
  const webhook = {
    ...f.declaration,
    recordedEndpointChoice: {
      mode: 'webhook' as const,
      signedChoice: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: 'fact:webhook-choice' },
      endpointAvailabilityEvidence: ['probe:webhook'], captureBeforeResponseEvidence: ['check:capture-first'],
    },
  } satisfies TelegramBotDeclaration;
  refused(f.admit(webhook), 'two intake modes');
  const missingEvidence = { ...webhook, recordedEndpointChoice: { ...webhook.recordedEndpointChoice,
    captureBeforeResponseEvidence: [] } } satisfies TelegramBotDeclaration;
  refused(f.admit(missingEvidence), 'capture-before-response');
});

it('P12-NF-16 P12-NF-17 exact bot/chat/topic identity classifies every captured Telegram update kind', () => {
  const f = conversationFixture();
  const rows = f.fixtureNames.map(name => [name, extractTelegramUpdate(telegramRaw(name), f.declaration)] as const);
  expect(rows.map(([name, row]) => [name, row.kind])).toEqual([
    ['reply', 'reply'], ['callback', 'callback'], ['edit', 'edit'], ['channel-post', 'channel-post'],
    ['service-event', 'service-event'], ['media-metadata', 'media-metadata'], ['unsupported', 'unsupported'],
  ]);
  const reply = rows[0]![1];
  expect(reply).toMatchObject({
    route: {
      channel: 'telegram:v1:bot:9001:chat:-1001:topic:42',
      sender: 'telegram:v1:user:7',
      identityEpoch: 'telegram:v1:bot:9001:epoch:installation-1',
      eventId: '100',
    },
    principal: { id: 'telegram:v1:user:7', kind: 'person' },
  });
  expect(JSON.stringify(reply)).not.toContain('888');
  expect(JSON.stringify(reply)).not.toContain('999');
  expect(rows[3]![1].principal).toEqual({ id: 'telegram:v1:channel:-200', kind: 'system' });
  expect(rows[4]![1].conversation).toBe('telegram:v1:bot:9001:chat:-1001:general');
  expect(rows[2]![1].conversation).toBe('telegram:v1:bot:9001:chat:123:direct');
});

it('P12-NF-16 canonical topic forms reject drift and keep bot identity in every conversation', () => {
  const f = conversationFixture();
  expect(normalizeTelegramTopic(false, null)).toBe('direct');
  expect(normalizeTelegramTopic(true, null)).toBe('general');
  expect(normalizeTelegramTopic(true, 1)).toBe('general');
  expect(normalizeTelegramTopic(true, 42)).toBe('topic:42');
  expect(telegramAccount('9001')).toBe('telegram:v1:bot:9001');
  expect(telegramConversation('9001', { chatId: '-1001', forum: true, messageThreadId: 42 }))
    .toBe('telegram:v1:bot:9001:chat:-1001:topic:42');
  expect(() => normalizeTelegramTopic(false, 42)).toThrow('non-forum');
});

it('P12-NF-27 P12-NF-29 P12-NF-30 exact HTML rendering escapes bytes and refuses instead of truncating or chunking', () => {
  const f = conversationFixture();
  expect(consumeResult(renderTelegramHtml('A < B & C > D', f.declaration, f.admissionDependencies.boundary), {
    Success: value => value, Refused: value => { throw new Error(value.detail); },
  })).toBe('A &lt; B &amp; C &gt; D');
  refused(renderTelegramHtml('x'.repeat(4097), f.declaration, f.admissionDependencies.boundary), 'chunking and truncation are unsupported');
  refused(renderTelegramHtml('bad\u0000data', f.declaration, f.admissionDependencies.boundary), 'control data');
});
