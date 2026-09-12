import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createTelegramIngress, createTelegramIntakeAdapter } from '../../src/conversation/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramUpdate } from './round3-fixture.js';
// @ts-expect-error Reference fsync host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error Reference fsync capture host is JavaScript, outside pure core compilation.
import { createEffectFileCaptures } from '../../scripts/effect-file-captures.mjs';

it('P12-NF-07 P12-NF-16 P12-NF-17 P12-NF-18 P12-NF-38 P12-NF-48 round9 identity refusals cannot become cursor custody after restart', () => {
  const invalid = [
    telegramUpdate(101, update => {
      update.message.sender_chat = { id: -123, type: 'channel' }; delete update.message.from;
    }),
    telegramUpdate(101, update => {
      update.message_reaction = { chat: update.message.chat, message_id: 700,
        actor_chat: { id: -1000000000123, type: 'group' }, date: 1_700_000_000,
        old_reaction: [], new_reaction: [] };
      delete update.message;
    }),
    telegramUpdate(101, update => {
      update.channel_post = { ...update.message, chat: { id: 123, type: 'private' },
        sender_chat: { id: -1000000001001, type: 'channel' } };
      delete update.channel_post.message_thread_id; delete update.message;
    }),
    telegramUpdate(101, update => {
      update.edited_channel_post = { ...update.message, chat: { id: -123, type: 'group' },
        sender_chat: { id: -1000000001001, type: 'channel' } };
      delete update.edited_channel_post.message_thread_id; delete update.message;
    }),
  ];
  for (const badRaw of invalid) {
    const f = conversationFixture({ initialOffset: 100 });
    const directory = mkdtempSync(join(tmpdir(), 'p12-telegram-round9-'));
    const result = <T>(run: () => T) => f.intake.f.success(run());
    const storage = createTransportFileStorage(join(directory, 'facts'), result);
    const custody = createEffectFileCaptures([join(directory, 'capture-a'), join(directory, 'capture-b')], result);
    Object.assign(f.intake.deps, {
      storage,
      capture: { owner: 'part-ten' as const, preserve(raw: string) {
        const captured = custody.capture(raw);
        if (captured.kind === 'Success') Object.assign(f.intake.context.captures, custody.captures);
        return captured;
      } },
      adapter: createTelegramIntakeAdapter(f.admitted, f.api), governance: f.governed.governance,
    });
    const firstIntake = value(createIntakePort(f.intake.deps));
    const firstFacts = createFactStore(f.intake.context, storage);
    const firstIngress = createTelegramIngress({ boundary: f.admissionDependencies.boundary,
      admitted: f.admitted, api: f.api, intake: firstIntake, facts: firstFacts,
      observer: f.intake.deps.author.principal.id });

    f.queue(telegramUpdate(100));
    expect(firstIngress.pollOnce().kind).toBe('Success');
    f.queue(badRaw);
    expect(firstIngress.pollOnce().kind).toBe('Refused');

    const restartedIntake = value(createIntakePort(f.intake.deps));
    const restartedFacts = createFactStore(f.intake.context, storage);
    const restartedIngress = createTelegramIngress({ boundary: f.admissionDependencies.boundary,
      admitted: f.admitted, api: f.api, intake: restartedIntake, facts: restartedFacts,
      observer: f.intake.deps.author.principal.id });
    expect(value(restartedIngress.currentOffset())).toBe(101);
    expect(value(restartedFacts.read()).filter(row => row.kind === 'intake-receipt')).toHaveLength(1);
    expect(Object.values(custody.captures as Readonly<Record<string, { readonly bytes?: string }>>)
      .filter(capture => capture.bytes === badRaw)).toHaveLength(0);
  }
});
