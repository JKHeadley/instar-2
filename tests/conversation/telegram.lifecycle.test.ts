import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { createTelegramIngress, createTelegramIntakeAdapter } from '../../src/conversation/index.js';
import { conversationFixture, telegramRaw } from './fixture.js';
import { value } from '../intake/fixtures.js';
// @ts-expect-error Reference fsync host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error Reference fsync capture host is JavaScript, outside pure core compilation.
import { createEffectFileCaptures } from '../../scripts/effect-file-captures.mjs';

it('P12-NF-13 P12-NF-18 P12-NF-38 lifecycle rebuild derives the Telegram cursor from fsync-backed owner facts', () => {
  const f = conversationFixture();
  const directory = mkdtempSync(join(tmpdir(), 'p12-telegram-'));
  const result = <T>(run: () => T) => f.intake.f.success(run());
  const storage = createTransportFileStorage(join(directory, 'facts'), result);
  const custody = createEffectFileCaptures([join(directory, 'capture-a'), join(directory, 'capture-b')], result);
  Object.assign(f.intake.deps, {
    storage,
    capture: {
      owner: 'part-ten' as const,
      preserve(raw: string) {
        const captured = custody.capture(raw);
        if (captured.kind === 'Success') Object.assign(f.intake.context.captures, custody.captures);
        return captured;
      },
    },
    adapter: createTelegramIntakeAdapter(f.admitted, f.api),
    governance: f.governed.governance,
  });
  const firstPort = value(createIntakePort(f.intake.deps));
  const firstFacts = createFactStore(f.intake.context, storage);
  const firstIngress = createTelegramIngress({ boundary: f.admissionDependencies.boundary,
    admitted: f.admitted, api: f.api, intake: firstPort, facts: firstFacts,
    observer: f.intake.deps.author.principal.id });
  f.queue(telegramRaw('reply'));
  const first = value(firstIngress.pollOnce());
  expect(first).toMatchObject({ committedThrough: 100, nextOffset: 101, blockedOnUpdate: null });
  expect(first.captured[0]).toMatchObject({ custody: 'durable', intake: 'owned-refusal' });
  expect(storage.read()).toHaveLength(value(firstFacts.read()).length);

  const readmitted = value(f.admit());
  const restartedDependencies = { ...f.intake.deps, adapter: createTelegramIntakeAdapter(readmitted, f.api) };
  const restartedPort = value(createIntakePort(restartedDependencies));
  const restartedFacts = createFactStore(f.intake.context, storage);
  const restartedIngress = createTelegramIngress({ boundary: f.admissionDependencies.boundary,
    admitted: readmitted, api: f.api, intake: restartedPort, facts: restartedFacts,
    observer: f.intake.deps.author.principal.id });
  expect(value(restartedIngress.currentOffset())).toBe(101);
  expect(value(restartedFacts.read()).filter(fact => fact.kind === 'intake-receipt')).toHaveLength(1);
  expect(Object.keys(custody.captures)).toHaveLength(1);
});
