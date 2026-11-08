// @ts-nocheck -- The conversation fixture harness is untyped test scaffolding shared with the round tests.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createIntakePort } from '../../src/intake/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createTelegramIngress, createTelegramIntakeAdapter, extractTelegramUpdate } from '../../src/conversation/telegram.js';
import { conversationFixture } from './fixture.js';
import { value } from '../intake/fixtures.js';

// Rule 36: the Telegram update reader runs on a genuine Bot API update (telegram-update.json), received
// 2026-10-01T02:09:52Z by a proof-room bot from a person's account, with the person's names and user/chat
// id redacted; see tests/fixtures/captures/README.md.
const captured = readFileSync(new URL('../fixtures/captures/telegram-update.json', import.meta.url), 'utf8');

function wire(f) {
  Object.assign(f.intake.deps, { adapter: createTelegramIntakeAdapter(f.admitted, f.api), governance: f.governed.governance });
  const intake = value(createIntakePort(f.intake.deps));
  const facts = createFactStore(f.intake.context, f.intake.storage);
  const ingress = createTelegramIngress({ boundary: f.admissionDependencies.boundary, admitted: f.admitted, api: f.api,
    intake, facts, observer: f.intake.deps.author.principal.id });
  return { facts, ingress };
}

describe('P12-TELEGRAM-UPDATE-ON-CAPTURE Telegram update reader on the genuine capture', () => {
  it('reads the genuine private-chat text update as a person message routed by the provider update_id', () => {
    const f = conversationFixture();
    const extracted = extractTelegramUpdate(captured, f.declaration);
    expect(extracted).toMatchObject({ updateId: 715672737, kind: 'reply',
      principal: { id: 'telegram:v1:user:1000000001', kind: 'person' },
      target: { chatId: '1000000001', forum: false, messageThreadId: null } });
    expect(extracted.route).toMatchObject({ sender: 'telegram:v1:user:1000000001', eventId: '715672737',
      channel: extracted.conversation });
  });

  it('admits the genuine bytes once through the live ingress and records the duplicate delivery as a receipt', () => {
    const f = conversationFixture();
    f.bind(extractTelegramUpdate(captured, f.declaration).route);
    const w = wire(f);
    f.queue(captured);
    expect(value(w.ingress.pollOnce()).captured[0].intake).toBe('admitted');
    f.queue(captured);
    expect(value(w.ingress.pollOnce()).captured[0].intake).toBe('duplicate');
    expect(value(w.facts.read()).filter(x => x.kind === 'intake-admitted')).toHaveLength(1);
  });

  it('refuses the genuine shape once its sender loses the is_bot discriminator or its bytes pass the bound', () => {
    const f = conversationFixture();
    const stripped = JSON.parse(captured);
    delete stripped.message.from.is_bot;
    expect(() => extractTelegramUpdate(JSON.stringify(stripped), f.declaration)).toThrow(/is_bot/u);
    const padded = captured + ' '.repeat(f.declaration.limits.maxUpdateBytes);
    expect(() => extractTelegramUpdate(padded, f.declaration)).toThrow(/capture bound/u);
  });
});
