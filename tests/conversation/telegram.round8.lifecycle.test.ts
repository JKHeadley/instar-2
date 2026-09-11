import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { createTelegramIngress, createTelegramIntakeAdapter } from '../../src/conversation/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramUpdate } from './round3-fixture.js';
// @ts-expect-error Reference fsync host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error Reference fsync capture host is JavaScript, outside pure core compilation.
import { createEffectFileCaptures } from '../../scripts/effect-file-captures.mjs';

it('P12-NF-16 P12-NF-17 P12-NF-18 P12-NF-38 P12-NF-48 round8 restart cannot recover custody or a cursor from an inconsistent destination identity', () => {
  for (const chat of [
    { id: -123, type: 'private' }, { id: 123, type: 'group' },
    { id: -1000000000123, type: 'group' }, { id: 123, type: 'supergroup' },
    { id: -123, type: 'supergroup' }, { id: 123, type: 'channel' }, { id: -123, type: 'channel' },
  ] as const) {
    const f = conversationFixture({ initialOffset: 100 });
    const directory = mkdtempSync(join(tmpdir(), 'p12-telegram-round8-'));
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
    f.queue(telegramUpdate(100, update => {
      update.message.chat = chat;
      delete update.message.message_thread_id;
      if (chat.type === 'channel') {
        update.message.sender_chat = { id: -1000000000200, type: 'channel' };
        delete update.message.from;
      }
    }));
    expect(firstIngress.pollOnce().kind, chat.type).toBe('Refused');

    const restartedIntake = value(createIntakePort(f.intake.deps));
    const restartedFacts = createFactStore(f.intake.context, storage);
    const restartedIngress = createTelegramIngress({ boundary: f.admissionDependencies.boundary,
      admitted: f.admitted, api: f.api, intake: restartedIntake, facts: restartedFacts,
      observer: f.intake.deps.author.principal.id });
    expect(value(restartedIngress.currentOffset()), chat.type).toBe(100);
    expect(value(restartedFacts.read()).filter(row => row.kind === 'intake-receipt'), chat.type).toHaveLength(0);
    expect(Object.keys(custody.captures), chat.type).toHaveLength(0);
  }
});
