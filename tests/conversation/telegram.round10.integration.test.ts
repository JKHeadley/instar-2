import { expect, it } from 'vitest';
import {
  admitTelegramAdapter, createTelegramIngress, createTelegramIntakeAdapter,
} from '../../src/conversation/index.js';
import type { TelegramBotApiCustodianPort } from '../../src/conversation/index.js';
import { createFactStore, hashBytes } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramPreparedOutbound } from './round5-fixture.js';
import { telegramUpdate } from './round3-fixture.js';

function pollEvidence(mode: 'valid' | 'missing' | 'wrong-hash' | 'different-updates') {
  const f = conversationFixture({ initialOffset: 100, skipInitialAdmission: true });
  const raw = telegramUpdate(100);
  const capturedResponse = JSON.stringify({ ok: true, result: [JSON.parse(raw) as unknown] });
  const reference = 'capture:telegram:round10-poll-response';
  const api: TelegramBotApiCustodianPort = {
    ...f.api,
    readCapture(candidate: string) {
      if (candidate !== reference) return f.api.readCapture(candidate);
      if (mode === 'missing') throw new Error('poll response capture unavailable');
      return f.intake.f.success(capturedResponse);
    },
    poll() {
      const returned = mode === 'different-updates'
        ? telegramUpdate(100, update => { update.message.text = 'different'; })
        : raw;
      return f.intake.f.success({
        updates: [returned],
        response: { reference, hash: hashBytes(mode === 'wrong-hash' ? 'wrong' : capturedResponse) },
      });
    },
  };
  const admitted = value(admitTelegramAdapter(f.declaration, { ...f.admissionDependencies, api }));
  Object.assign(f.intake.deps, {
    adapter: createTelegramIntakeAdapter(admitted, api), governance: f.governed.governance,
  });
  const intake = value(createIntakePort(f.intake.deps));
  const facts = createFactStore(f.intake.context, f.intake.storage);
  const ingress = createTelegramIngress({ boundary: f.admissionDependencies.boundary,
    admitted, api, intake, facts, observer: f.intake.deps.author.principal.id });
  const result = ingress.pollOnce();
  return { result, offset: value(ingress.currentOffset()), facts: value(facts.read()) };
}

it('P12-NF-06 P12-NF-07 P12-NF-18 round10 finding 1 requires the exact captured long-poll response before intake', () => {
  const valid = pollEvidence('valid');
  expect(valid.result.kind).toBe('Success');
  expect(valid.offset).toBe(101);
  expect(valid.facts.filter(row => row.kind === 'intake-receipt')).toHaveLength(1);
  expect(valid.facts.filter(row => row.kind === 'intake-admitted')).toHaveLength(1);

  for (const mode of ['missing', 'wrong-hash', 'different-updates'] as const) {
    const refused = pollEvidence(mode);
    expect(refused.result.kind, mode).toBe('Refused');
    expect(refused.offset, mode).toBe(100);
    expect(refused.facts.filter(row => row.kind === 'intake-receipt'), mode).toHaveLength(0);
    expect(refused.facts.filter(row => row.kind === 'intake-admitted'), mode).toHaveLength(0);
  }
});

it('P12-NF-29 P12-NF-30 round10 finding 2 enforces the declared entity limit on every registered reply', () => {
  const cases = [
    ['plain-zero', 'Hello', 0, 1],
    ['one-zero', '<b>Hello</b>', 0, 0],
    ['one-one', '<b>Hello</b>', 1, 1],
    ['two-one', '<b>Hello</b> <i>World</i>', 1, 0],
    ['hundred', Array.from({ length: 100 }, (_, index) => index % 2 ? '<i>x</i>' : '<b>x</b>').join(' '), 100, 1],
    ['hundred-one', Array.from({ length: 101 }, (_, index) => index % 2 ? '<i>x</i>' : '<b>x</b>').join(' '), 100, 0],
  ] as const;
  for (const [name, text, limit, expectedCalls] of cases) {
    const f = telegramPreparedOutbound(false, text, limit);
    const result = value(f.doorway.dispatch(f.request, f.effects.fence));
    expect(f.telegram.calls.send, name).toHaveLength(expectedCalls);
    expect(result.stage, name).toBe(expectedCalls === 1 ? 'response' : 'unknown');
  }
}, 30_000);
