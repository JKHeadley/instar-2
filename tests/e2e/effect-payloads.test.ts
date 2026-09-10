import { expect, it } from 'vitest';
import { createEffectDoorway, decodeEffectPayload, effectOperationContracts } from '../../src/effects/index.js';
import { payloadInput, payloadKinds } from '../effects/payload-fixtures.js';
import { typedEffectFixture, value } from '../effects/typed-effect-fixture.js';

it.each(payloadKinds)('P8-TP-R6-LIFECYCLE-%s P8-NF-49 reconstructs a prepared slice-A request and dispatches it once', kind => {
  const contract = effectOperationContracts[kind];
  const effect = typedEffectFixture(undefined, 'executor:1', { payloadKind: kind, inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, [kind]);
  const payload = value(decodeEffectPayload(payloadInput(kind, effect.host), effect.host));
  const request = value(effect.api.preparePayload({ definition: effect.d.id, payload, run: effect.run,
    pending: payload.sourceResult, attempt: 'attempt:1', verificationOwner: 'verifier:1', obligation: effect.obligation,
    closure: [], fence: effect.fence }));
  const restarted = createEffectDoorway(effect.composition);
  const observation = value(restarted.dispatch(request, effect.fence));
  expect(observation.request).toBe(request.id);
  expect(effect.calls()).toBe(1);
  expect(value(restarted.dispatch(request, effect.fence)).id).toBe(observation.id);
  expect(effect.calls()).toBe(1);
});
