import { expect, it } from 'vitest';
import { createEffectDoorway, decodeEffectPayload, effectOperationContracts } from '../../src/effects/index.js';
import type { TypedEffectPayload } from '../../src/effects/index.js';
import { payloadInput, payloadKinds } from '../effects/payload-fixtures.js';
import { refused, typedEffectFixture, value } from '../effects/typed-effect-fixture.js';

const setup = (kind: typeof payloadKinds[number] = 'post-text', supported = true) => {
  const contract = effectOperationContracts[kind];
  const effect = typedEffectFixture(undefined, 'executor:1', { payloadKind: kind, inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, supported ? [kind] : []);
  const payload = value(decodeEffectPayload(payloadInput(kind, effect.host), effect.host));
  return { effect, payload };
};

const prepare = (effect: ReturnType<typeof typedEffectFixture>, payload: TypedEffectPayload,
  api = effect.api) => api.preparePayload({ definition: effect.d.id, payload, run: effect.run, pending: payload.sourceResult,
    attempt: 'attempt:1', verificationOwner: 'verifier:1', obligation: effect.obligation, closure: [], fence: effect.fence });

it.each(payloadKinds)('P8-TP-PORTS-%s P8-NF-42 P8-NF-49 traverses real signed P2, P6, P9, and P8', kind => {
  const { effect, payload } = setup(kind), request = value(prepare(effect, payload));
  const observation = value(effect.api.dispatch(request, effect.fence));
  effect.assess('happened', 3, true);
  const settlement = value(effect.api.settle(observation.operation));
  expect(settlement.outcome.kind).toBe('happened');
  expect(settlement.finalCharge).toBe(3);
  expect(effect.calls()).toBe(1);
  expect(value(effect.api.inspect()).map(row => row.record.type)).toEqual(expect.arrayContaining([
    'EffectPayload', 'EffectRequest', 'EffectValidation', 'OperationObservation', 'EffectSettlement',
  ]));
}, 20_000);

it('P8-TP-UNSUPPORTED P8-NF-05 retains the proposal and refuses an unsupported landed adapter before reservation or call', () => {
  const { effect, payload } = setup('post-text', false);
  refused(prepare(effect, payload), 'unsupported adapter capability');
  expect(effect.calls()).toBe(0);
  expect(value(effect.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation')).toHaveLength(0);
  expect(value(effect.api.inspect()).some(row => row.record.type === 'EffectPayload')).toBe(true);
});

it('P8-TP-R6-DISPATCH-ROUTE P8-NF-15 refuses a newly conflicting signed route at dispatch with zero adapter calls', () => {
  const { effect, payload } = setup(), request = value(prepare(effect, payload));
  effect.reference('conversation-route-generation', { id: 'conversation-route:2', account: 'bot:fixture', conversation: 'chat:fixture',
    status: 'current', validFrom: 0, validUntil: 1000, supersedes: 'conversation-route:1' });
  refused(effect.api.dispatch(request, effect.fence), 'route generation');
  expect(effect.calls()).toBe(0);
});

it.each(['EffectPayload', 'EffectRequest', 'EffectValidation'] as const)(
  'P8-TP-R6-DURABLE-CUT-%s P8-NF-14 preserves each preparation append cut without invoking an adapter', type => {
    const { effect, payload } = setup();
    const cut = createEffectDoorway({ ...effect.composition, spine: { ...effect.spine, append: (record, refs) => {
      const result = effect.spine.append(record, refs);
      if (record.type === type) throw new Error('durable cut');
      return result;
    } } });
    refused(prepare(effect, payload, cut));
    expect(effect.calls()).toBe(0);
    const cold = createEffectDoorway(effect.composition);
    const recorded = value(cold.inspect());
    expect(recorded.some(row => row.record.type === type)).toBe(true);
  });
