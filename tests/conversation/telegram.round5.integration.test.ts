import { expect, it } from 'vitest';
import { extractTelegramUpdate } from '../../src/conversation/index.js';
import { createEffectDoorway } from '../../src/effects/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramUpdate, wireTelegram } from './round3-fixture.js';
import { telegramPreparedOutbound } from './round5-fixture.js';

it.each(['inline_query', 'poll', 'chosen_inline_result'])(
  'P12-NF-16 P12-NF-17 round5 contradictory-%s is refused before Part Four custody',
  variant => {
    const f = conversationFixture({ initialOffset: 100 });
    const wire = wireTelegram(f);
    f.queue(telegramUpdate(100, update => {
      update[variant] = { id: 'another-event', from: { id: 8, is_bot: false }, query: 'other payload' };
    }));
    expect(wire.ingress.pollOnce().kind).toBe('Refused');
    expect(value(wire.ingress.currentOffset())).toBe(100);
    expect(value(wire.facts.read()).filter(row => row.kind === 'intake-receipt')).toHaveLength(0);
  },
);

it.each(['chat', 'topic', 'sender'] as const)(
  'P12-NF-06 P12-NF-16 P12-NF-18 P12-NF-38 round5 mismatch-%s receipt cannot advance the declared route cursor',
  field => {
    const f = conversationFixture({ initialOffset: 100 });
    const wire = wireTelegram(f);
    const raw = telegramUpdate(100);
    const route = { ...extractTelegramUpdate(raw, f.declaration).route };
    if (field === 'chat') route.channel = route.channel.replace('-1001', '-9999');
    if (field === 'topic') route.channel = route.channel.replace('topic:42', 'topic:43');
    if (field === 'sender') route.sender = 'telegram:v1:user:999';
    expect(wire.intake.receive(raw, route).kind).toBe('Refused');
    expect(value(wire.facts.read()).filter(row => row.kind === 'intake-receipt')).toHaveLength(1);
    expect(value(wire.ingress.currentOffset())).toBe(100);
    expect(value(wireTelegram(f).ingress.currentOffset())).toBe(100);
  },
);

it('P12-NF-28 P12-NF-48 round5 public prepare and dispatch invoke the unchanged Telegram reply once', () => {
  const f = telegramPreparedOutbound();
  const observation = value(f.doorway.dispatch(f.request, f.effects.fence));
  expect(observation.stage).toBe('response');
  expect(f.telegram.calls.send).toHaveLength(1);
  expect(value(f.doorway.dispatch(f.request, f.effects.fence)).id).toBe(observation.id);
  expect(f.telegram.calls.send).toHaveLength(1);
});

it.each(['unchanged', 'stopped', 'expired', 'definition-removed'] as const)(
  'P12-NF-28 round5 concrete-current-state-%s revalidates immediately before the provider call',
  mode => {
    const f = telegramPreparedOutbound();
    let concreteInput: Parameters<typeof f.adapter.invoke>[0] | undefined;
    let suppressResponseObservation = false;
    const interceptingAdapter = { ...f.adapter,
      invoke(input: Parameters<typeof f.adapter.invoke>[0]) {
        concreteInput = input;
        suppressResponseObservation = true;
        throw new Error('interrupted before concrete invocation');
      },
    };
    const interruptedSpine = { ...f.effects.spine,
      append(...args: Parameters<typeof f.effects.spine.append>) {
        if (suppressResponseObservation) throw new Error('response observation unavailable');
        return f.effects.spine.append(...args);
      },
    };
    const doorway = createEffectDoorway({ ...f.effects.composition, spine: interruptedSpine,
      adapter: interceptingAdapter, assessment: null });
    expect(value(doorway.dispatch(f.request, f.effects.fence)).stage).toBe('executor-accepted');
    expect(concreteInput).toBeDefined();
    if (mode === 'stopped') f.effects.stop();
    if (mode === 'expired') f.effects.time(1_000);
    if (mode === 'definition-removed') f.effects.versions([]);
    const result = f.adapter.invoke(concreteInput!);
    expect(result.kind).toBe(mode === 'unchanged' ? 'Success' : 'Refused');
    expect(f.telegram.calls.send).toHaveLength(mode === 'unchanged' ? 1 : 0);
  },
);
