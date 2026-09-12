import { expect, it } from 'vitest';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramUnpreparedOutbound } from './round5-fixture.js';

it('P12-NF-29 P12-NF-30 P12-NF-41 round11 deterministic preparation refuses before Part Eight or Six custody', () => {
  for (const [name, text, maxEntities, reason] of [
    ['entity-limit', '<b>Hello</b>', 0, 'declared HTML entity limit'],
    ['control-data', 'bad\u0000text', 100, 'unsupported control data'],
  ] as const) {
    const fixture = telegramUnpreparedOutbound(false, text, maxEntities);
    const before = value(fixture.effects.transport.inspect());
    const prepared = fixture.prepare();
    expect(prepared.kind, name).toBe('Refused');
    if (prepared.kind === 'Refused') {
      expect(prepared.detail, name).toContain(reason);
      expect(prepared.detail, name).toMatch(/unsupported|chunking and truncation/);
    }
    expect(value(fixture.effects.transport.inspect()), name).toEqual(before);
    expect(fixture.telegram.calls.send, name).toHaveLength(0);
  }
});

it('P12-NF-04 P12-NF-46 P12-NF-49 round11 every consumed Telegram limit binds the immutable contract', () => {
  const unchanged = conversationFixture();
  const reused = value(unchanged.admit({ ...unchanged.declaration, limits: { ...unchanged.declaration.limits } }));
  expect(reused.contract.id).toBe(unchanged.admitted.contract.id);
  expect(reused.conformance.id).toBe(unchanged.admitted.conformance.id);

  for (const [field, replacement] of [
    ['maxUpdateBytes', 1024], ['maxReplyCharacters', 4095], ['maxReplyBytes', 2048],
    ['maxEntities', 99], ['maxConcurrentPolls', 2], ['maxCharge', 999], ['timeout', 999],
  ] as const) {
    const fixture = conversationFixture();
    const limits = { ...fixture.declaration.limits, [field]: replacement } as any;
    expect(fixture.admit({ ...fixture.declaration, limits }).kind, field).toBe('Refused');
  }
});
