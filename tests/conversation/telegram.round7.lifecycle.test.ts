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

it('P12-NF-07 P12-NF-16 P12-NF-17 P12-NF-18 P12-NF-48 round7 restart retains real actor custody and never reconstructs malformed sender evidence', () => {
  const f = conversationFixture({ initialOffset: 100 });
  const directory = mkdtempSync(join(tmpdir(), 'p12-telegram-round7-'));
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
  const intake = value(createIntakePort(f.intake.deps));
  const facts = createFactStore(f.intake.context, storage);
  const ingress = createTelegramIngress({ boundary: f.admissionDependencies.boundary,
    admitted: f.admitted, api: f.api, intake, facts, observer: f.intake.deps.author.principal.id });
  f.queue(JSON.stringify({ update_id: 100, message_reaction: {
    chat: { id: -1000000001001, type: 'supergroup' }, message_id: 700,
    actor_chat: { id: -200, type: 'channel' }, date: 1_700_000_000,
    old_reaction: [], new_reaction: [{ type: 'emoji', emoji: '👍' }],
  } }));
  expect(ingress.pollOnce().kind).toBe('Success');
  f.queue(telegramUpdate(101, update => {
    update.message.sender_chat = { id: -200, type: 'private' }; delete update.message.from;
  }));
  expect(ingress.pollOnce().kind).toBe('Refused');

  const restartedIntake = value(createIntakePort(f.intake.deps));
  const restartedFacts = createFactStore(f.intake.context, storage);
  const restarted = createTelegramIngress({ boundary: f.admissionDependencies.boundary,
    admitted: f.admitted, api: f.api, intake: restartedIntake, facts: restartedFacts,
    observer: f.intake.deps.author.principal.id });
  expect(value(restarted.currentOffset())).toBe(101);
  const receipts = value(restartedFacts.read()).filter(row => row.kind === 'intake-receipt');
  expect(receipts).toHaveLength(1);
  expect(JSON.parse((receipts[0]!.body as { ingress: string }).ingress).sender).toBe('telegram:v1:channel:-200');
});

