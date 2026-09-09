import { decode } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import type { CapturedContent } from '../../src/facts/index.js';
import { createEffectDoorway, decodeEffectPayload, effectOperationContracts } from '../../src/effects/index.js';
import type { AdmissionReservation } from '../../src/transport/index.js';
import type { OperationObservation } from '../../src/effects/index.js';
import { createEffectAssessmentPort, createVerificationRuntime, createVerificationSpine,
  registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import type { VerificationHost } from '../../src/verification/index.js';
import { privateKey, value } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
import { effectFixture } from './fixture.js';
import { payloadInput } from './payload-fixtures.js';
import { effectPayloadIdentity } from '../../src/effects/index.js';

export function typedJointFixture(evidenceKinds: readonly ('occurred' | 'not-occurred' | 'quiescent' | 'charged')[] = ['occurred', 'quiescent', 'charged']) {
  const contract = effectOperationContracts['post-text'];
  let active: ReturnType<typeof effectFixture> | undefined;
  let host!: VerificationHost;
  const effect = effectFixture(undefined, 'executor:1', { payloadKind: 'post-text', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['post-text'], effectHost => {
      host = { machine: effectHost.machine, principal: effectHost.principal, scope: effectHost.scope, boundary: effectHost.boundary,
        current: () => {
          if (!active) throw new Error('integrated fixture not initialized');
          const evidenceCaptures: Record<string, CapturedContent> = Object.fromEntries(Object.entries(active.captures).map(([reference, bytes]) => [reference,
            { hash: hashBytes(bytes), bytes, status: 'available' as const, byteLength: Buffer.byteLength(bytes) }]));
          const facts = { ...active.ctx, facts: value(active.store.read()), captures: { ...active.ctx.captures, ...evidenceCaptures } };
          return { decode: facts.decode, clock: effectHost.current().clock, generation: facts.decode.register.generation.id,
            stopped: effectHost.current().stopped, facts, evidence: facts.decode.evidence ?? [] };
        } };
      return { schemas: verificationSchemas(host), ownedBodies: value(registerVerificationBodies(host)) };
    });
  active = effect;
  const raw = { ...payloadInput('post-text', effect.host), sourceResult: effect.pending.id };
  const draft = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
  const typed = value(decodeEffectPayload({ ...draft,
    ...effectPayloadIdentity(draft as unknown as Parameters<typeof effectPayloadIdentity>[0]) }, effect.host));
  const request = value(effect.api.preparePayload({ definition: effect.d.id, payload: typed, run: effect.run,
    pending: effect.pending.id, attempt: 'attempt:1', verificationOwner: 'reply-verifier',
    obligation: effect.obligation, closure: [], fence: effect.fence }));
  const observed = value(effect.api.dispatch(request, effect.fence));
  const reservation = value(effect.transport.inspect()).filter((row): row is typeof row & { record: AdmissionReservation } =>
    row.record.type === 'AdmissionReservation' && row.record.operation === observed.operation).at(-1)!.record;
  const observations = value(effect.api.inspect()).filter((row): row is typeof row & { record: OperationObservation } =>
    row.record.type === 'OperationObservation' && row.record.operation === observed.operation).map(row => row.record);
  const evidence = {
    occurred: ['operation-occurred', undefined], 'not-occurred': ['operation-did-not-occur', undefined],
    quiescent: ['old-executor-quiescent', undefined], charged: ['charge-settled', 3],
  } as const;
  for (const kind of evidenceKinds) {
    const [predicate, amount] = evidence[kind];
    effect.evidence.push(value(decode('Evidence', effect.evidenceInput({ id: `typed-evidence:${kind}`,
      claim: { subject: observed.operation, predicate, value: { digest: request.digest, ...(amount === undefined ? {} : { amount }) } },
      source: 'probe', observedAt: effect.clock(100), freshFor: 100, strength: 'proof' }), effect.ctx.decode)));
  }
  const spine = createVerificationSpine(host, { context: effect.ctx, privateKey }, effect.store);
  const runtime = createVerificationRuntime(host, spine);
  value(runtime.record('VerificationPlan', { ...verificationInput('VerificationPlan'), id: 'typed-effect-verification-plan',
    subject: { ...verificationInput('VerificationPlan').subject, generation: host.current().generation },
    bar: { ...verificationInput('VerificationPlan').bar, version: request.verificationBar, sources: ['probe'] } }));
  const assessment = createEffectAssessmentPort(host, runtime);
  const settling = createEffectDoorway({ ...effect.composition, assessment });
  return { effect, typed, request, observed, reservation, observations, host, store: effect.store, runtime, assessment, settling };
}
