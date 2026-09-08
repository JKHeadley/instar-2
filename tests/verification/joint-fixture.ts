import { decode } from '../../src/index.js';
import { createFactStore, hashBytes } from '../../src/facts/index.js';
import type { CapturedContent, FactContext, FactStorePort, SegmentStoragePort } from '../../src/facts/index.js';
import { createEffectAssessmentPort, createVerificationRuntime, createVerificationSpine,
  registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import type { VerificationHost } from '../../src/verification/index.js';
import type { OperationObservation } from '../../src/effects/index.js';
import type { AdmissionReservation } from '../../src/transport/index.js';
import { effectFixture } from '../effects/fixture.js';
import { privateKey, value } from '../facts/fixtures.js';
import { verificationInput } from './fixture.js';

export function jointVerificationFixture() {
  const effect = effectFixture(); const request = effect.prepare(); const observed = value(effect.api.dispatch(request, effect.fence));
  const reservation = value(effect.transport.inspect()).filter((row): row is typeof row & { record: AdmissionReservation } =>
    row.record.type === 'AdmissionReservation' && row.record.operation === observed.operation).at(-1)!.record;
  const observations = value(effect.api.inspect()).filter((row): row is typeof row & { record: OperationObservation } =>
    row.record.type === 'OperationObservation' && row.record.operation === observed.operation).map(row => row.record);
  for (const [id, predicate, amount] of [
    ['occurred', 'operation-occurred', undefined], ['quiescent', 'old-executor-quiescent', undefined], ['charged', 'charge-settled', 3],
  ] as const) effect.evidence.push(value(decode('Evidence', effect.evidenceInput({ id: `evidence:${id}`,
    claim: { subject: observed.operation, predicate, value: { digest: request.digest, ...(amount === undefined ? {} : { amount }) } },
    source: 'probe', observedAt: effect.clock(100), freshFor: 100, strength: 'proof' }), effect.ctx.decode)));
  const effectFacts = value(effect.store.read());
  const evidenceCaptures: Record<string, CapturedContent> = Object.fromEntries(Object.entries(effect.captures).map(([reference, bytes]) => [reference,
    { hash: hashBytes(bytes), bytes, status: 'available' as const, byteLength: Buffer.byteLength(bytes) }]));
  const captures: Record<string, CapturedContent> = { ...effect.ctx.captures, ...evidenceCaptures };
  let factsContext: FactContext = { ...effect.ctx, facts: effectFacts, captures };
  let store: FactStorePort | undefined;
  const host: VerificationHost = { machine: effect.host.machine, principal: effect.host.principal, scope: effect.host.scope, boundary: effect.host.boundary,
    current: () => { const verificationFacts = store ? value(store.read()) : []; const facts = { ...factsContext, facts: [...effectFacts, ...verificationFacts] };
      return { decode: facts.decode, clock: effect.host.current().clock, generation: facts.decode.register.generation.id,
        stopped: effect.host.current().stopped, facts, evidence: facts.decode.evidence ?? [] }; } };
  const registrations = value(registerVerificationBodies(host));
  factsContext = { ...factsContext, schemas: [...factsContext.schemas, ...verificationSchemas(host)],
    ownedBodies: [...factsContext.ownedBodies ?? [], ...registrations] };
  const raw: unknown[] = [];
  const storage: SegmentStoragePort = { owner: 'part-ten', read: () => raw,
    append: (bytes, expected) => { const prior = raw.at(-1) as { contentHash?: string } | undefined;
      if ((prior?.contentHash ?? null) !== expected) throw new Error('compare-head mismatch'); raw.push(JSON.parse(bytes));
      return effect.success({ kind: 'local-durable' as const }); } };
  store = createFactStore(factsContext, storage);
  const spine = createVerificationSpine(host, { context: factsContext, privateKey }, store);
  const runtime = createVerificationRuntime(host, spine);
  const plan = value(runtime.record('VerificationPlan', { ...verificationInput('VerificationPlan'), id: 'effect-verification-plan',
    subject: { ...verificationInput('VerificationPlan').subject, generation: host.current().generation },
    bar: { ...verificationInput('VerificationPlan').bar, version: request.verificationBar, sources: ['probe'] } }));
  const assessment = createEffectAssessmentPort(host, runtime);
  const input = { request, reservation, claim: reservation.command, observations, bar: request.verificationBar };
  return { effect, request, observed, reservation, observations, host, factsContext, captures, store, spine, runtime, plan, assessment, input,
    evidenceCapture: effect.evidence.find(e => e.id === 'evidence:occurred')!.capture.reference };
}
