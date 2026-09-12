import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  admitTelegramAdapter, createTelegramIngress, createTelegramIntakeAdapter,
  createTelegramReplyOperationAdapter,
} from '../../src/conversation/index.js';
import type { TelegramBotApiCustodianPort } from '../../src/conversation/index.js';
import { createEffectDoorway } from '../../src/effects/index.js';
import { createFactStore, hashBytes } from '../../src/facts/index.js';
import { createIntakePort } from '../../src/intake/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramPreparedOutbound } from './round5-fixture.js';
import { telegramUpdate } from './round3-fixture.js';
// @ts-expect-error Reference fsync host is JavaScript, outside pure core compilation.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
// @ts-expect-error Reference fsync capture host is JavaScript, outside pure core compilation.
import { createEffectFileCaptures } from '../../scripts/effect-file-captures.mjs';

it('P12-NF-06 P12-NF-07 P12-NF-18 P12-NF-38 P12-NF-48 round10 inconsistent poll evidence cannot create restart custody', () => {
  for (const mode of ['missing', 'wrong-hash', 'different-updates'] as const) {
    const f = conversationFixture({ initialOffset: 100, skipInitialAdmission: true });
    const raw = telegramUpdate(100);
    const capturedResponse = JSON.stringify({ ok: true, result: [JSON.parse(raw) as unknown] });
    const reference = `capture:telegram:round10-${mode}`;
    const api: TelegramBotApiCustodianPort = {
      ...f.api,
      readCapture(candidate: string) {
        if (candidate !== reference) return f.api.readCapture(candidate);
        if (mode === 'missing') throw new Error('poll response capture unavailable');
        return f.intake.f.success(capturedResponse);
      },
      poll() {
        return f.intake.f.success({
          updates: [mode === 'different-updates'
            ? telegramUpdate(100, update => { update.message.text = 'different'; })
            : raw],
          response: { reference, hash: hashBytes(mode === 'wrong-hash' ? 'wrong' : capturedResponse) },
        });
      },
    };
    const admitted = value(admitTelegramAdapter(f.declaration, { ...f.admissionDependencies, api }));
    const directory = mkdtempSync(join(tmpdir(), 'p12-telegram-round10-'));
    const result = <T>(run: () => T) => f.intake.f.success(run());
    const storage = createTransportFileStorage(join(directory, 'facts'), result);
    const custody = createEffectFileCaptures([join(directory, 'capture-a'), join(directory, 'capture-b')], result);
    Object.assign(f.intake.deps, {
      storage,
      capture: { owner: 'part-ten' as const, preserve(update: string) {
        const captured = custody.capture(update);
        if (captured.kind === 'Success') Object.assign(f.intake.context.captures, custody.captures);
        return captured;
      } },
      adapter: createTelegramIntakeAdapter(admitted, api), governance: f.governed.governance,
    });
    const firstIntake = value(createIntakePort(f.intake.deps));
    const firstFacts = createFactStore(f.intake.context, storage);
    const firstIngress = createTelegramIngress({ boundary: f.admissionDependencies.boundary,
      admitted, api, intake: firstIntake, facts: firstFacts, observer: f.intake.deps.author.principal.id });
    expect(firstIngress.pollOnce().kind, mode).toBe('Refused');

    const restartedIntake = value(createIntakePort(f.intake.deps));
    const restartedFacts = createFactStore(f.intake.context, storage);
    const restartedIngress = createTelegramIngress({ boundary: f.admissionDependencies.boundary,
      admitted, api, intake: restartedIntake, facts: restartedFacts, observer: f.intake.deps.author.principal.id });
    expect(value(restartedIngress.currentOffset()), mode).toBe(100);
    expect(value(restartedFacts.read()).filter(row => row.kind === 'intake-receipt'), mode).toHaveLength(0);
    expect(Object.keys(custody.captures), mode).toHaveLength(0);
  }
});

it('P12-NF-29 P12-NF-30 P12-NF-38 P12-NF-48 round10 entity refusal remains non-replaying after doorway rebuild', () => {
  const text = Array.from({ length: 101 }, (_, index) => index % 2 ? '<i>x</i>' : '<b>x</b>').join(' ');
  const f = telegramPreparedOutbound(false, text, 100);
  const first = value(f.doorway.dispatch(f.request, f.effects.fence));
  expect(first.stage).toBe('unknown');
  expect(f.telegram.calls.send).toHaveLength(0);

  const adapter = createTelegramReplyOperationAdapter(f.telegram.admitted, f.telegram.api, f.target,
    f.effects.host.boundary);
  const rebuilt = createEffectDoorway({ ...f.effects.composition, adapter, assessment: null });
  expect(value(rebuilt.dispatch(f.request, f.effects.fence)).id).toBe(first.id);
  expect(f.telegram.calls.send).toHaveLength(0);
  expect(value(f.effects.spine.store.read()).filter(row => row.kind === 'effect-OperationObservation'
    && (row.body as { record?: { stage?: string } }).record?.stage === 'unknown')).toHaveLength(1);
});
