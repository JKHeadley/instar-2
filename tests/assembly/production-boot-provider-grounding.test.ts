// @ts-nocheck -- integration composition of landed owner fixtures; no owner source edits.
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { prepareSnapshot } from '../../src/facts/index.js';
import { canonical, decode } from '../../src/index.js';
import { createProviderJudgmentPort, providerJudgmentSchemas, registerProviderJudgmentBodies } from '../../src/judgment/index.js';
import { groundedAssemblyRuntimeFixture, genuineProductionComposition, installProduction } from './genuine-production-fixture.js';
import { value, privateKey, json } from '../facts/fixtures.js';
import { createProviderEffectDoorway, providerEffectSchemas, providerEffectMigrations, registerProviderEffectBodies, createEffectSpine, installOperationDefinition } from '../../src/effects/index.js';
import { createEffectSettlementAssessmentPort, createEffectAssessmentPort, createVerificationRuntime, createVerificationSpine, verificationSchemas, registerVerificationBodies } from '../../src/verification/index.js';
import { createProductionProviderOwners } from '../../src/assembly/production-provider-owners.js';
import { createConfinedProviderInvocation } from '../../src/assembly/index.js';
import { verificationInput } from '../verification/fixture.js';
import { localProvider } from '../model-provider/http-provider.js';
import { productionBindingSet } from './production-fixture.js';
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';

it('production boot integration: settled native grounding proceeds through one real provider call and Five acceptance', async () => {
  const f = groundedAssemblyRuntimeFixture(undefined, { minimal: true });
  f.deps.context.evidenceSources.settlement = f.bob.provenance.adapter;
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
    f.owners.host.capture = bytes => captures.put(bytes, 262144);
    for (const [reference, bytes] of Object.entries(dc.captures)) {
      if (!context.captures[reference]) context.captures[reference] = { bytes, hash: 'sha256:' + createHash('sha256').update(bytes).digest('hex'), byteLength: Buffer.byteLength(bytes), status: 'available' };
    }
    const settings = { automaticRetries: 0, maxTokens: 128 }, outputSchema = { type: 'Decision' };
    const question = { id: 'boot-question', run: { owner: 'part-five', name: 'Run', id: f.id },
      step: 'step:operation:1', ordinal: 0, semanticMessage: 'operation:1', question: 'May the worker produce its bounded reply?',
      context: 'Current delivered context was consumed by the native owner path.', evidence: ['e1', 'e2'], deadline: 400 };
    const submitted = value(canonical({ provider: host.description.provider, model: 'model', route: 'route',
      messages: [{ role: 'user', content: question.question }, { role: 'context', content: question.context }],
      attachments: [], tools: [], settings, outputSchema, floor: f.floor, evidence: question.evidence,
      point: 'judgment', generation: f.run.generation.id })).bytes;
    for (const evidence of f.evidence) f.append('evidence-record', json({ evidence }));
    const ready = value(graph.open(f.run)), ground = value(graph.ground(f.id, 'w', 'native', 'start', f.lease));
    const transition = f.start(ready, ground);
    value(graph.transition({ ...transition, step: { ...transition.step,
      operation: { ...transition.step.operation, digest: value(canonical(submitted)).hash } } }));
    await new Promise(resolve => setTimeout(resolve, 1));
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
    await new Promise(resolve => setTimeout(resolve, 1));
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
    await new Promise(resolve => setTimeout(resolve, 1));
    const input = { request, reservation, claim: response.claim, observations, bar: request.verificationBar };
    const acceptance = value(realAssessment.assess(input));
    const proof = value(realAssessment.read(acceptance, input));
    expect(proof.outcome.kind).toBe('happened');
    expect(proof.finalCharge).toBe(0);
    expect(proof.delayedExecutionExcluded).toBe(true);
    // Required lifecycle positive: the actual Eight doorway must consume Nine's
    // assessment without rewriting the source Evidence or substituting an assessor.
    value(f.effects.transport.settle(f.effects.fence, value(f.effects.api.settle(response.operation))));
    await new Promise(resolve => setTimeout(resolve, 1));
    const definition = { type: 'OperationDefinition', schemaVersion: 1, id: 'boot-provider-definition',
      feature: 'provider-call', version: 'boot-provider-version', generation: f.run.generation.id,
      adapter: 'route', account: 'test-provider', conversation: 'recorded provider', speaker: f.bob.id,
      scopeDigest: value(canonical(f.scope)).hash, durability: 'local-durable', replicas: 0,
      lossModel: 'Recorded local bytes, no remote durability claim.', maxBytes: 4096,
      maxCharge: 20, timeout: 100, verificationBar: 'provider-bar' };
    const approval = f.authorize({ id: 'boot-provider-approval', artifact: f.capture(value(canonical(definition)).bytes), base: 'boot-provider-base' });
    const current = f.owners.host.current;
    f.owners.host.current = () => ({ ...current(), versions: [...current().versions,
      { id: definition.version, subject: definition.feature, content: json(definition), contentHash: value(canonical(definition)).hash,
        since: f.opening.id, supersedes: [], approvedIn: approval, base: approval.base, landedIn: null }] });
    value(installOperationDefinition(definition, f.owners.host, createEffectSpine(f.owners.host, { context, privateKey }, f.store)));
    const route = { provider: 'test-provider', model: 'model', route: 'route', disclosure: 'recorded provider',
      automaticRetries: 0, environment: 'local-test', invoke: async bytes => {
        const response = await fetch(http.endpoint, { method: 'POST', body: bytes,
          headers: { Authorization: `Bearer ${http.credential}`, 'Content-Type': 'application/json' } });
        return response.json();
      } };
    const providerOwners = value(createProductionProviderOwners({
      judgment: { host, boundary, authority: f.effects.transport, captures, store: f.store, context, privateKey,
        runs: graph, settings, outputSchema, maxTokens: 128, maxCaptureBytes: 65536, timeout: 100, disclosure: 'recorded provider' },
      verification: vh, route, effect: { host: f.owners.host,
        durability: f.effects.composition.durability, custody: f.effects.composition.custody, plan: plan.id } }));
    const api = providerOwners.eight;
    const obligation = all().find(row => row.kind === 'transport-LoopRecord').id;
    await new Promise(resolve => setTimeout(resolve, 1));
    const providerRequest = value(api.prepare({ prepared, definition: definition.id, verificationOwner: 'independent-probe',
      resultDestination: f.opening.id, obligation }, f.effects.fence));
    http.respond({ state: 'complete', bytes: JSON.stringify(f.decisionInput()), providerOperation: 'recorded-provider-operation:1',
      usage: { inputTokens: 11, outputTokens: 9, charge: 3, source: 'authenticated local provider receipt' }, retryBlocked: false });
    const observed = value(await api.dispatch(providerRequest, f.effects.fence));
    expect(http.requests).toHaveLength(1);
    for (const [predicate, amount] of [['operation-occurred', null], ['charge-settled', 3], ['old-executor-quiescent', null]]) {
      const capture = value(captures.put(value(canonical({ operation: observed.operation, digest: providerRequest.digest, predicate, amount })).bytes, 4096));
      const evidence = value(decode('Evidence', f.evidenceInput({ id: `boot-provider-proof:${predicate}`, capture,
        claim: { subject: observed.operation, predicate, value: { digest: providerRequest.digest, ...(amount === null ? {} : { amount }) } },
        source: 'probe', observedAt: f.deps.clock(), freshFor: 100, strength: 'proof' }), dc));
      f.evidence.push(evidence); f.append('evidence-record', json({ evidence }));
    }
    await new Promise(resolve => setImmediate(resolve));
    const assessment = value(api.assess(observed.operation));
    await new Promise(resolve => setImmediate(resolve));
    const settlement = value(api.settle(observed.operation, assessment));
    await new Promise(resolve => setImmediate(resolve));
    const accounting = value(f.effects.transport.settle(f.effects.fence, settlement));
    expect(accounting.actualCharge).toBe(3);
    await new Promise(resolve => setImmediate(resolve));
    const answer = value(seven.resolve(prepared.request, settlement, f.effects.fence));
    expect(answer.resolution.id).toBeTruthy();
    await new Promise(resolve => setImmediate(resolve));
    f.deps.settlement.read = (reference, step) => api.readRunSettlement(reference, step);
    const sf = all().find(row => row.kind === 'effect-provider-ProviderEffectSettlement' && row.body.record.id === settlement.id);
    const conflicts = value(prepareSnapshot(all(), context)).entries.flatMap(row => row.conflicts);
    expect(conflicts).toEqual([]);
    await new Promise(resolve => setTimeout(resolve, 1));
    const view = value(graph.read(f.id));
    const ref = fact => ({ owner: 'part-two', name: 'FactEnvelope', id: fact.id });
    await new Promise(resolve => setTimeout(resolve, 1));
    const accepted = value(graph.transition({ type: 'RunTransition', schemaVersion: 1, id: 'boot-provider-accepted',
      run: f.id, expected: view.head, trigger: { owner: 'part-two', name: 'FactEnvelope', id: answer.resolution.id },
      kind: 'observe', from: view.state, to: 'ready', responsible: f.owner, standing: ref(f.opening), ownership: f.lease,
      generation: f.run.generation, at: f.deps.clock(), blockedOn: { kind: 'nothing' }, nextWake: f.run.nextWake,
      affectedStep: question.step, outcome: { type: 'Outcome', id: 'boot-provider-outcome', fact: ref(sf), field: 'outcome' }, settlement: ref(sf) }));
    expect(accepted.pending).toHaveLength(0);

  } finally { await http.close(); rmSync(directory, { recursive: true, force: true }); }
}, 240000);
