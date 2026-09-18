// @ts-nocheck -- integration composition of landed owner fixtures; no owner source edits.
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { createProviderJudgmentPort, providerJudgmentSchemas, registerProviderJudgmentBodies } from '../../src/judgment/index.js';
import { groundedAssemblyRuntimeFixture, genuineProductionComposition, installProduction } from './genuine-production-fixture.js';
import { value, privateKey, json } from '../facts/fixtures.js';
import { createProviderEffectDoorway, providerEffectSchemas, providerEffectMigrations, registerProviderEffectBodies, createEffectSpine, installOperationDefinition } from '../../src/effects/index.js';
import { createEffectSettlementAssessmentPort, createEffectAssessmentPort, createVerificationRuntime, createVerificationSpine, verificationSchemas, registerVerificationBodies } from '../../src/verification/index.js';
import { createConfinedProviderInvocation } from '../../src/assembly/index.js';
import { verificationInput } from '../verification/fixture.js';
import { localProvider } from '../model-provider/http-provider.js';
import { productionBindingSet } from './production-fixture.js';
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';

it('production boot integration prerequisite: actual Nine assessment must settle native context delivery before the model call', async () => {
  const f = groundedAssemblyRuntimeFixture(undefined, { minimal: true });
  const production = genuineProductionComposition(f, productionBindingSet()), graph = production.run.port;
  const context = f.ctx, dc = context.decode;
  dc.register.entries.push('provider-call');
  const boundary = { ...f.c, register: dc.register };
  const th = { ...f.owners.host, domain: 'conversation:1', authorityIncarnation: 'authority:1',
    monotonic: () => f.deps.clock().value, current: () => ({ ...f.owners.host.current(), generation: f.run.generation }) };
  const host = { transport: th, point: 'judgment', floor: f.floor,
    description: { owner: 'part-ten', provider: 'test-provider', model: 'model', route: 'route', automaticRetries: 0,
      maxInputBytes: 4096, maxOutputBytes: 4096, maxCharge: 20, measured: false, basis: 'recorded HTTP provider' },
    refreshFacts: () => f.success(undefined) };
  Object.assign(context, { schemas: [...context.schemas, ...providerJudgmentSchemas(host)],
    ownedBodies: [...context.ownedBodies, ...value(registerProviderJudgmentBodies(host, boundary))] });
  const directory = mkdtempSync(join(tmpdir(), 'boot-model-ground-'));
  const http = await localProvider();
  try {
    const captures = createJudgmentCaptures(directory, context.captures, fn => f.success(fn()), 1048576, dc.captures);
    const settings = { automaticRetries: 0, maxTokens: 128 }, outputSchema = { type: 'Decision' };
    const question = { id: 'boot-question', run: { owner: 'part-five', name: 'Run', id: f.id },
      step: 'step:operation:1', ordinal: 0, semanticMessage: 'operation:1', question: 'May the worker produce its bounded reply?',
      context: 'Current delivered context was consumed by the native owner path.', evidence: ['e1', 'e2'], deadline: 400 };
    const submitted = value(canonical({ provider: host.description.provider, model: 'model', route: 'route',
      messages: [{ role: 'user', content: question.question }, { role: 'context', content: question.context }],
      attachments: [], tools: [], settings, outputSchema, floor: f.floor, evidence: question.evidence,
      point: 'judgment', generation: f.run.generation.id })).bytes;
    const ready = value(graph.open(f.run)), ground = value(graph.ground(f.id, 'w', 'native', 'start', f.lease));
    const transition = f.start(ready, ground);
    value(graph.transition({ ...transition, step: { ...transition.step,
      operation: { ...transition.step.operation, digest: value(canonical(submitted)).hash } } }));
    const seven = createProviderJudgmentPort({ host, boundary, authority: f.effects.transport,
      captures, store: f.store, context, privateKey, runs: graph, settings, outputSchema,
      maxTokens: 128, maxCaptureBytes: 65536, timeout: 100, disclosure: 'recorded provider' });
    const prepared = value(seven.prepare(question, f.effects.fence));
    expect(value(captures.read(prepared.value.submitted))).toBe(submitted);
    expect(prepared.value.pending).toBe(value(f.store.read()).find(row => row.kind === 'run-transition').id);
    expect(prepared.value.run).toBe(f.id);
    const all = () => value(f.store.read());
    const vh = { machine: f.host.machine, principal: f.host.principal, scope: f.host.scope, boundary,
      current: () => ({ decode: dc, clock: f.deps.clock(), stopped: false, generation: f.run.generation.id,
        facts: { ...context, facts: all() }, evidence: f.evidence }) };
    Object.assign(context, { migrations: providerEffectMigrations,
      schemas: [...context.schemas.filter(s => s.kind !== 'verification-ProbeRecord'),
        ...providerEffectSchemas(f.owners.host), ...verificationSchemas(vh)],
      ownedBodies: [...context.ownedBodies, ...value(registerProviderEffectBodies(f.owners.host)),
        ...value(registerVerificationBodies(vh))] });
    const runtime = createVerificationRuntime(vh, createVerificationSpine(vh, { context, privateKey }, f.store));
    const plan = { ...verificationInput('VerificationPlan'), id: 'boot-provider-plan',
      subject: { ...verificationInput('VerificationPlan').subject, generation: f.run.generation.id },
      bar: { ...verificationInput('VerificationPlan').bar, version: 'provider-bar', sources: ['probe'] } };
    value(runtime.record('VerificationPlan', plan));
    const nine = createEffectSettlementAssessmentPort(vh, runtime, f.store);
    expect(nine.owner).toBe('part-nine');
    // The native context delivery has used Eight's ordinary EffectDoorway.
    // Replace the fixture assessor with the actual landed Nine implementation.
    const contextPlan = { ...plan, id: 'boot-context-plan', bar: { ...plan.bar, version: 'live-input-bar' } };
    value(runtime.record('VerificationPlan', contextPlan));
    const realAssessment = createEffectAssessmentPort(vh, runtime);
    f.effects.composition.assessment = realAssessment;
    f.effects.recreate(f.store);
    const rows = value(f.effects.api.inspect());
    const request = rows.find(row => row.record.type === 'EffectRequest').record;
    const observations = rows.filter(row => row.record.type === 'OperationObservation').map(row => row.record);
    const response = observations.find(row => row.stage === 'response');
    expect(response).toBeTruthy();
    const reservation = value(f.effects.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'
      && row.record.operation === response.operation).at(-1).record;
    for (const [predicate, amount] of [['operation-occurred', null], ['charge-settled', 0], ['old-executor-quiescent', null]]) {
      const capture = response.capture;
      const sourceBytes = context.captures[capture.reference].bytes;
      dc.captures[capture.reference] = sourceBytes;
      const evidence = value(decode('Evidence', f.evidenceInput({ id: `boot-context-proof:${predicate}`, capture,
        claim: { subject: response.operation, predicate, value: { digest: request.digest, ...(amount === null ? {} : { amount }) } },
        source: 'probe', observedAt: f.deps.clock(), freshFor: 100, strength: 'proof' }), dc));
      f.evidence.push(evidence); f.append('evidence-record', json({ evidence }));
    }
    const input = { request, reservation, claim: response.claim, observations, bar: request.verificationBar };
    const acceptance = value(realAssessment.assess(input));
    const proof = value(realAssessment.read(acceptance, input));
    expect(proof.outcome.kind).toBe('happened');
    expect(proof.finalCharge).toBe(0);
    expect(proof.delayedExecutionExcluded).toBe(true);
    // Required lifecycle positive: the actual Eight doorway must consume Nine's
    // assessment without rewriting the source Evidence or substituting an assessor.
    value(f.effects.api.settle(response.operation));
  } finally { await http.close(); rmSync(directory, { recursive: true, force: true }); }
}, 120000);
