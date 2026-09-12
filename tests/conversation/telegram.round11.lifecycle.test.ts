import { expect, it } from 'vitest';
import { createTelegramReplyOperationAdapter } from '../../src/conversation/index.js';
import { createEffectDoorway } from '../../src/effects/index.js';
import { value } from '../intake/fixtures.js';
import { telegramUnpreparedOutbound } from './round5-fixture.js';

it('P12-NF-29 P12-NF-30 P12-NF-38 P12-NF-41 P12-NF-48 round11 refusal survives doorway rebuild without reservation or claim', () => {
  for (const [text, maxEntities, reason] of [
    ['<b>Hello</b>', 0, 'declared HTML entity limit'],
    ['bad\u0000text', 100, 'unsupported control data'],
  ] as const) {
    const fixture = telegramUnpreparedOutbound(false, text, maxEntities);
    const first = fixture.prepare();
    expect(first.kind).toBe('Refused');
    if (first.kind === 'Refused') expect(first.detail).toContain(reason);

    const adapter = createTelegramReplyOperationAdapter(fixture.telegram.admitted, fixture.telegram.api,
      fixture.target, fixture.effects.host.boundary);
    const rebuilt = createEffectDoorway({ ...fixture.effects.composition, adapter, assessment: null });
    const second = adapter.prepare(rebuilt, fixture.prepareInput);
    expect(second.kind).toBe('Refused');
    if (first.kind === 'Refused' && second.kind === 'Refused') expect(second.detail).toBe(first.detail);
    expect(value(fixture.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation')).toHaveLength(0);
    expect(value(fixture.effects.spine.store.read()).filter(row => row.kind === 'effect-OperationObservation')).toHaveLength(0);
    expect(fixture.telegram.calls.send).toHaveLength(0);
  }
});
