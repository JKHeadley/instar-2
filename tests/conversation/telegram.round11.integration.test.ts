import { expect, it } from 'vitest';
import { renderTelegramDeliveryStatus } from '../../src/conversation/index.js';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramPreparedOutbound, telegramUnpreparedOutbound } from './round5-fixture.js';

it('P12-NF-29 P12-NF-34 P12-NF-35 round11 real Eight dispatch refuses unwitnessed evidence over both provider outcomes', () => {
  for (const outcome of ['accepted', 'rejected'] as const) {
    const fixture = telegramPreparedOutbound();
    if (outcome === 'rejected') fixture.telegram.setSendResult(
      '{"ok":false,"error_code":400,"description":"message refused by provider"}');
    const observation = value(fixture.doorway.dispatch(fixture.request, fixture.effects.fence));
    const counterfeit = {
      type: 'Evidence', schemaVersion: 1, id: `evidence:round11-counterfeit:${outcome}`,
      claim: { subject: observation.operation, predicate: 'operation-occurred', value: { digest: observation.digest } },
      observedAt: { value: 100 }, freshFor: 100, capture: observation.capture,
    } as any;
    expect(renderTelegramDeliveryStatus({ observation, evidence: counterfeit, now: fixture.effects.clock(100),
      status: 'accepted-by-platform', form: 'words' }, fixture.effects.host.boundary).kind, outcome).toBe('Refused');
    expect(fixture.telegram.calls.send, outcome).toHaveLength(1);
    expect(fixture.effects.ctx.captures[observation.capture.reference]?.bytes, outcome)
      .toBe(outcome === 'accepted' ? '{"ok":true,"result":{"message_id":700}}'
        : '{"ok":false,"error_code":400,"description":"message refused by provider"}');
  }
}, 30_000);

it('P12-NF-29 P12-NF-30 P12-NF-41 round11 public adapter preparation preserves exact refusal without a claim', () => {
  const refused = telegramUnpreparedOutbound(false, '<b>Hello</b>', 0);
  const result = refused.prepare();
  expect(result.kind).toBe('Refused');
  if (result.kind === 'Refused') expect(result.detail)
    .toBe('Telegram reply exceeds the declared HTML entity limit; chunking and truncation are unsupported');
  expect(value(refused.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation')).toHaveLength(0);
  expect(refused.telegram.calls.send).toHaveLength(0);

  const accepted = telegramUnpreparedOutbound(false, '<b>Hello</b>', 1);
  const request = value(accepted.prepare());
  expect(value(accepted.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation')
    .map(row => row.record.type === 'AdmissionReservation' ? row.record.state : '')).toEqual(['prepared']);
  expect(value(accepted.doorway.dispatch(request, accepted.effects.fence)).stage).toBe('response');
  expect(accepted.telegram.calls.send).toHaveLength(1);
});

it('P12-NF-04 P12-NF-46 P12-NF-49 round11 changed charge and timeout cannot reuse current conformance', () => {
  for (const field of ['maxCharge', 'timeout'] as const) {
    const fixture = conversationFixture();
    const before = value(fixture.assembly.store.readForProjection()).entries
      .filter(row => row.fact.kind === 'assembly-AdapterConformance').map(row => row.fact.id);
    const result = fixture.admit({ ...fixture.declaration,
      limits: { ...fixture.declaration.limits, [field]: 999 } });
    expect(result.kind, field).toBe('Refused');
    expect(value(fixture.assembly.store.readForProjection()).entries
      .filter(row => row.fact.kind === 'assembly-AdapterConformance').map(row => row.fact.id), field).toEqual(before);
  }
});
