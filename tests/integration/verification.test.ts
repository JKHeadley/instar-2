import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { createFactStore, hashBytes } from '../../src/facts/index.js';
import type { CapturedContent, FactContext, SegmentStoragePort } from '../../src/facts/index.js';
import { createEffectAssessmentPort, createVerificationRuntime, createVerificationSpine,
  deriveVerificationAssessment, registerVerificationBodies, verificationSchemas } from '../../src/verification/index.js';
import type { VerificationHost } from '../../src/verification/index.js';
import { effectFixture } from '../effects/fixture.js';
import type { OperationObservation } from '../../src/effects/index.js';
import type { AdmissionReservation } from '../../src/transport/index.js';
import { privateKey, refused, value } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';

it('P9-NF-04 P9-NF-06 P9-NF-23 full ports assess occurrence, quiescence and charge without settling or releasing', () => {
  const e = effectFixture(); const request = e.prepare(); const observed = value(e.api.dispatch(request, e.fence));
  const reservation = value(e.transport.inspect()).filter((row): row is typeof row & { record: AdmissionReservation } =>
    row.record.type === 'AdmissionReservation' && row.record.operation === observed.operation).at(-1)!.record;
  const observations = value(e.api.inspect()).filter((row): row is typeof row & { record: OperationObservation } =>
    row.record.type === 'OperationObservation' && row.record.operation === observed.operation).map(row => row.record);
  for (const [id, predicate, amount] of [
    ['occurred', 'operation-occurred', undefined], ['quiescent', 'old-executor-quiescent', undefined], ['charged', 'charge-settled', 3],
  ] as const) e.evidence.push(value(decode('Evidence', e.evidenceInput({ id: `evidence:${id}`,
    claim: { subject: observed.operation, predicate, value: { digest: request.digest, ...(amount === undefined ? {} : { amount }) } },
    source: 'probe', observedAt: e.clock(100), freshFor: 100, strength: 'proof' }), e.ctx.decode)));

  const effectFacts = value(e.store.read());
  const captures: Record<string, CapturedContent> = Object.fromEntries(Object.entries(e.captures).map(([reference, bytes]) => [reference,
    { hash: hashBytes(bytes), bytes, status: 'available' as const, byteLength: Buffer.byteLength(bytes) }]));
  let factsContext: FactContext = { ...e.ctx, facts: effectFacts, captures };
  const host: VerificationHost = { machine: e.host.machine, principal: e.host.principal, scope: e.host.scope, boundary: e.host.boundary,
    current: () => { const verificationFacts = store ? value(store.read()) : []; const facts = { ...factsContext, facts: [...effectFacts, ...verificationFacts] };
      return { decode: facts.decode, clock: e.host.current().clock, generation: facts.decode.register.generation.id, stopped: e.host.current().stopped,
        facts, evidence: facts.decode.evidence ?? [] }; } };
  const registrations = value(registerVerificationBodies(host));
  factsContext = { ...factsContext, schemas: [...factsContext.schemas, ...verificationSchemas(host)],
    ownedBodies: [...factsContext.ownedBodies ?? [], ...registrations] };
  const raw: unknown[] = [];
  const storage: SegmentStoragePort = { owner: 'part-ten', read: () => raw,
    append: (bytes, expected) => { const prior = raw.at(-1) as { contentHash?: string } | undefined;
      if ((prior?.contentHash ?? null) !== expected) throw new Error('compare-head mismatch'); raw.push(JSON.parse(bytes));
      return e.success({ kind: 'local-durable' as const }); } };
  const store = createFactStore(factsContext, storage);
  const spine = createVerificationSpine(host, { context: factsContext, privateKey }, store);
  const runtime = createVerificationRuntime(host, spine);
  const plan = { ...verificationInput('VerificationPlan'), id: 'effect-verification-plan',
    subject: { ...verificationInput('VerificationPlan').subject, generation: host.current().generation },
    bar: { ...verificationInput('VerificationPlan').bar, version: request.verificationBar, sources: ['probe'] } };
  value(runtime.record('VerificationPlan', plan));
  const assessment = createEffectAssessmentPort(host, runtime);
  const input = { request, reservation, claim: reservation.command, observations, bar: request.verificationBar };
  const reference = value(assessment.assess(input));
  const view = value(assessment.read(reference, input));
  expect(view.outcome.kind).toBe('happened'); expect(view.finalCharge).toBe(3); expect(view.delayedExecutionExcluded).toBe(true);
  expect(value(assessment.consumeCurrent(reference, input, current => current.outcome.kind))).toBe('happened');
  expect(value(e.transport.inspect()).filter(row => row.record.type === 'SettlementApplication')).toHaveLength(0);
  expect(value(e.api.inspect()).filter(row => row.record.type === 'EffectSettlement')).toHaveLength(0);
});

it('P9-NF-06 weak absence and a live old executor remain insufficient, never retry authority', () => {
  const f = verificationRuntimeFixture();
  const plan = verificationInput('VerificationPlan'); value(f.runtime.record('VerificationPlan', plan));
  const request = verificationInput('VerificationRequest'); value(f.runtime.record('VerificationRequest', request));
  const assessment = value(deriveVerificationAssessment({ request, plan, evidence: [], observer: 'observer', vectorDigest: 'sha256:vector',
    knownLineages: [], captureStatuses: [], taints: [], now: f.clock(100), decode: f.context.decode }, f.c));
  expect(assessment.predicates.every(row => row.verdict === 'insufficient')).toBe(true);
  expect(assessment.missingEvidence).toEqual(['occurrence', 'non-occurrence', 'quiescence', 'charge']);
  refused(f.runtime.record('VerificationAssessment', { ...assessment, predicates: assessment.predicates.map(row => row.predicate === 'non-occurrence'
    ? { ...row, verdict: 'satisfied', evidence: [] } : row) }), 'satisfied predicate needs evidence');
});
