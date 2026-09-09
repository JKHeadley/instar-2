import { decodeEffectPayload, effectOperationContracts, effectPayloadIdentity } from '../../src/effects/index.js';
import { value } from '../facts/fixtures.js';
import { typedEffectFixture } from './typed-effect-fixture.js';
import { payloadInput } from './payload-fixtures.js';

export function typedJointFixture(evidenceKinds: readonly ('occurred' | 'not-occurred' | 'quiescent' | 'charged')[] = ['occurred', 'quiescent', 'charged']) {
  const contract = effectOperationContracts['post-text'];
  const effect = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'post-text', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['post-text']);
  const raw = { ...payloadInput('post-text', effect.host), sourceResult: effect.pending.id };
  const draft = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
  const typed = value(decodeEffectPayload({ ...draft,
    ...effectPayloadIdentity(draft as unknown as Parameters<typeof effectPayloadIdentity>[0]) }, effect.host));
  const request = value(effect.api.preparePayload({ definition: effect.d.id, payload: typed, run: effect.run,
    pending: effect.pending.id, attempt: 'attempt:1', verificationOwner: 'reply-verifier',
    obligation: effect.obligation, closure: [], fence: effect.fence }));
  const observed = value(effect.api.dispatch(request, effect.fence));
  effect.assess(evidenceKinds.includes('occurred') ? 'happened' : evidenceKinds.includes('not-occurred') ? 'did-not-happen' : 'uncertain',
    evidenceKinds.includes('charged') ? 3 : null,
    evidenceKinds.includes('quiescent'));
  const reservation = value(effect.transport.inspect()).find(row => row.record.type === 'AdmissionReservation'
    && row.record.operation === observed.operation)!.record;
  const observations = value(effect.api.inspect()).filter(row => row.record.type === 'OperationObservation'
    && row.record.operation === observed.operation).map(row => row.record);
  return { effect, typed, request, observed, reservation, observations, host: effect.verificationHost,
    store: effect.store, runtime: effect.verificationRuntime, assessment: effect.assessment, settling: effect.api };
}
