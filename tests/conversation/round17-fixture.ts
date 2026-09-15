import { decode } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import type { FactContext, FactStorePort, SegmentStoragePort } from '../../src/facts/index.js';
import { createEffectAssessmentPort, createVerificationRuntime, createVerificationSpine,
  registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import type { EffectAssessmentPort, OperationObservation } from '../../src/effects/index.js';
import type { AdmissionReservation } from '../../src/transport/index.js';
import type { VerificationHost } from '../../src/verification/index.js';
import { privateKey, value } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
import { telegramPreparedOutbound } from './round5-fixture.js';

export function telegramResponseAssessmentFixture(
  evidence: 'matching' | 'missing' | 'wrong-digest' = 'matching',
) {
  const outbound = telegramPreparedOutbound();
  const observation = value(outbound.doorway.dispatch(outbound.request, outbound.effects.fence));
  const reservation = value(outbound.effects.transport.inspect()).filter((row): row is typeof row & { record: AdmissionReservation } =>
    row.record.type === 'AdmissionReservation' && row.record.operation === observation.operation).at(-1)!.record;
  const observations = value(outbound.doorway.inspect()).filter((row): row is typeof row & { record: OperationObservation } =>
    row.record.type === 'OperationObservation' && row.record.operation === observation.operation).map(row => row.record);
  const definition = value(outbound.doorway.inspect()).find(row =>
    row.record.type === 'OperationDefinition' && row.record.id === outbound.request.definition)?.record;
  if (!definition || definition.type !== 'OperationDefinition') throw new Error('Telegram reply definition missing');
  const captured = outbound.effects.ctx.captures[observation.capture.reference];
  if (!captured || captured.status !== 'available' || captured.bytes === null) throw new Error('Telegram response capture missing');
  outbound.effects.captures[observation.capture.reference] = captured.bytes;
  if (evidence !== 'missing') {
    outbound.effects.evidence.push(value(decode('Evidence', outbound.effects.evidenceInput({
      id: `evidence:telegram-response:${evidence}`,
      claim: {
        subject: observation.operation,
        predicate: 'operation-occurred',
        value: { digest: evidence === 'matching' ? outbound.request.digest : `sha256:${'0'.repeat(64)}` },
      },
      source: 'probe', observedAt: outbound.effects.clock(100), freshFor: 100,
      capture: observation.capture, strength: 'proof',
    }), outbound.effects.ctx.decode)));
  }

  const effectFacts = value(outbound.effects.store.read());
  let factsContext: FactContext = { ...outbound.effects.ctx, facts: effectFacts };
  let store: FactStorePort;
  const host: VerificationHost = {
    machine: outbound.effects.host.machine,
    principal: outbound.effects.host.principal,
    scope: outbound.effects.host.scope,
    boundary: outbound.effects.host.boundary,
    current: () => {
      const verificationFacts = store ? value(store.read()) : [];
      const facts = { ...factsContext, facts: [...effectFacts, ...verificationFacts] };
      return {
        decode: facts.decode, clock: outbound.effects.host.current().clock,
        generation: facts.decode.register.generation.id, stopped: outbound.effects.host.current().stopped,
        facts, evidence: facts.decode.evidence ?? [],
      };
    },
  };
  const registrations = value(registerVerificationBodies(host));
  factsContext = {
    ...factsContext,
    schemas: [...factsContext.schemas, ...verificationSchemas(host)],
    ownedBodies: [...factsContext.ownedBodies ?? [], ...registrations],
  };
  const rows: unknown[] = [];
  const storage: SegmentStoragePort = {
    owner: 'part-ten',
    read: () => rows,
    append: (bytes, expected) => {
      const prior = rows.at(-1) as { contentHash?: string } | undefined;
      if ((prior?.contentHash ?? null) !== expected) throw new Error('compare-head mismatch');
      rows.push(JSON.parse(bytes));
      return outbound.effects.success({ kind: 'local-durable' as const });
    },
  };
  store = createFactStore(factsContext, storage);
  const spine = createVerificationSpine(host, { context: factsContext, privateKey }, store);
  const runtime = createVerificationRuntime(host, spine);
  value(runtime.record('VerificationPlan', {
    ...verificationInput('VerificationPlan'), id: 'telegram-response-verification-plan',
    subject: { ...verificationInput('VerificationPlan').subject, generation: host.current().generation },
    bar: {
      ...verificationInput('VerificationPlan').bar,
      version: outbound.request.verificationBar,
      sources: ['probe'], captureRequired: true,
    },
  }));
  const assessment = createEffectAssessmentPort(host, runtime);
  const effect = {
    request: outbound.request, reservation, claim: observation.claim,
    observations, bar: outbound.request.verificationBar,
  };
  const dependencies = {
    admitted: outbound.telegram.admitted, api: outbound.telegram.api, target: outbound.target,
    effects: outbound.doorway, transport: outbound.effects.transport,
    assessment, verification: runtime, custody: outbound.effects.composition.custody!, definition,
    boundary: outbound.effects.host.boundary,
  };
  const rebuildAssessment = (): EffectAssessmentPort => {
    store = createFactStore(factsContext, storage);
    const rebuiltSpine = createVerificationSpine(host, { context: factsContext, privateKey }, store);
    return createEffectAssessmentPort(host, createVerificationRuntime(host, rebuiltSpine));
  };
  return { ...outbound, observation, effect, dependencies, verification: { host, store, runtime, rows }, rebuildAssessment };
}
