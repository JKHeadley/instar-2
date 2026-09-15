import { expect, it } from 'vitest';
import { value } from '../intake/fixtures.js';
import { conversationFixture } from './fixture.js';
import { telegramUnpreparedOutbound } from './round5-fixture.js';

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
