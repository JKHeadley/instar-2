import { setTimeout as yieldWorker } from 'node:timers/promises';
import { beforeEach, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import type { Json } from '../../src/index.js';
import { authorAndAppend, createFactStore, decodeHistoricalBody, prepareSnapshot } from '../../src/facts/index.js';
import type { FactContext, FactEnvelope, FactSnapshot } from '../../src/facts/index.js';
import { decodeOwnedBody } from '../../src/facts/owned.js';
import { createEffectDoorway, decodeEffectPayload, effectOperationContracts, effectPayloadIdentity } from '../../src/effects/index.js';
import type { TypedEffectPayload } from '../../src/effects/index.js';
import { payloadInput, payloadKinds } from '../effects/payload-fixtures.js';
import { refused, typedEffectFixture, value } from '../effects/typed-effect-fixture.js';
import { intakeFixture, message as intakeMessage, route as intakeRoute, stop as intakeStop } from '../intake/fixtures.js';
import { intakeStopRegistration, intakeWorkRegistration } from '../../src/intake/index.js';
import { judgmentFixture } from '../judgment/fixture.js';
import { json as runJson, ref as runRef, setup as runFixture } from '../rungraph/fixtures.js';
import { json, privateKey } from '../facts/fixtures.js';

beforeEach(async () => { await yieldWorker(1); });

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

const identify = (input: Record<string, unknown>) => {
  const draft = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
  return { ...draft, ...effectPayloadIdentity(draft as Parameters<typeof effectPayloadIdentity>[0]) };
};
const captureBytes = (captures: Readonly<Record<string, { bytes: string | null; status: string }>>) =>
  Object.fromEntries(Object.entries(captures).flatMap(([reference, captured]) =>
    captured.status === 'available' && captured.bytes !== null ? [[reference, captured.bytes]] : []));
const snapshot = (facts: readonly FactEnvelope[], context: FactContext, ids?: ReadonlySet<string>): FactSnapshot => {
  const current = value(prepareSnapshot(facts, context));
  return ids ? { ...current, entries: current.entries.filter(entry => ids.has(entry.fact.id)) } as unknown as FactSnapshot : current;
};
const padEffect = (effect: ReturnType<typeof typedEffectFixture>, count: number) => {
  for (let index = 0; index < count; index++) effect.note(`owner-padding:${index}`);
};
const padIntake = (intake: ReturnType<typeof intakeFixture>, count: number) => {
  const store = createFactStore(intake.context, intake.storage);
  for (let index = 0; index < count; index++) value(authorAndAppend({ kind: 'note', schemaVersion: 1,
    machine: 'machine-a', principal: json(intake.f.alice), provenance: json(intake.f.alice.provenance), at: json(intake.f.now),
    body: { identity: `intake-padding:${index}`, amount: '0' }, required: [] }, intake.context, store, privateKey));
};
const intakeProjectionContext = (intake: ReturnType<typeof intakeFixture>, observer: string): FactContext => {
  const boundary = { site: 'intake.admit', preserved: intake.context.preserved, register: intake.context.decode.register };
  return { ...intake.context, ownedBodies: [...intake.context.ownedBodies ?? [],
    value(intakeWorkRegistration(boundary, observer)), value(intakeStopRegistration(boundary, observer))] };
};

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
}, 20_000);

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

it('P8-TP-R7-OWNER-P4 accepts an actual Part Four admitted/receipt/binding chain and refuses its unavailable recorder witness', () => {
  const intake = intakeFixture(); intake.bind(); value(intake.port().receive(intakeMessage(), intakeRoute));
  const admitted = intake.facts().find(fact => fact.kind === 'intake-admitted')!;
  const { effect } = setup('acknowledge');
  padEffect(effect, 40);
  const lineage = effect.sourceFor('step:owner-p4', 'logical:owner-p4');
  const opening = effect.reference('run-opening', { type: 'Run', id: 'run:1', run: 'run:1' });
  const semantic = effect.reference('semantic-message-admission', { id: 'semantic:owner-p4', run: 'run:1',
    sourceLineage: 'run:1', status: 'current', validFrom: 0, validUntil: 1000 });
  const route = effect.reference('conversation-route-generation', { id: 'route:owner-p4', account: 'host', conversation: intakeRoute.channel,
    status: 'current', validFrom: 0, validUntil: 1000 });
  const effectIds = new Set([lineage.source.id, lineage.transition.id, opening.id, semantic.id, route.id]);
  const intakeIds = new Set(intake.facts().filter(fact => fact.kind !== 'note').map(fact => fact.id));
  const intakeContext = intakeProjectionContext(intake, admitted.principal.id);
  const effectSnapshot = snapshot(value(effect.store.read()), effect.ctx, effectIds);
  const intakeSnapshot = snapshot(intake.facts(), intakeContext, intakeIds);
  const baseCurrent = effect.host.current;
  const host = { ...effect.host, current: () => ({ ...baseCurrent(), decode: { ...baseCurrent().decode,
    captures: { ...baseCurrent().decode.captures, ...captureBytes(intake.context.captures) } } }),
  referenceFacts: () => effect.success([
    effectSnapshot, intakeSnapshot,
  ]) };
  const raw = identify({ ...payloadInput('acknowledge', host), run: 'run:1', step: 'step:owner-p4',
    sourceResult: lineage.source.id, logicalEffect: 'logical:owner-p4', semanticMessage: 'semantic:owner-p4',
    account: 'host', conversation: intakeRoute.channel, routeGeneration: 'route:owner-p4', inboundFact: admitted.id });
  expect(value(decodeEffectPayload(raw, host)).kind).toBe('acknowledge');

  const receipt = intake.facts().find(fact => fact.kind === 'intake-receipt')!;
  const capture = (receipt.body as { capture: { reference: string } }).capture, prior = intake.context.captures[capture.reference]!;
  const unavailable = { ...intakeContext, captures: { ...intakeContext.captures,
    [capture.reference]: { ...prior, bytes: null, status: 'missing' as const } } };
  refused(decodeEffectPayload(raw, { ...host,
    referenceFacts: () => effect.success([
      effectSnapshot, snapshot(intake.facts(), unavailable, intakeIds),
    ]) }), 'status');
}, 30_000);

it('P8-TP-R7-OWNER-P4-PROTECTED-DENIAL refuses an actual Part Four bound stop at the target', () => {
  const intake = intakeFixture(); intake.bind(); value(intake.port().receive(intakeStop, intakeRoute));
  const stop = intake.facts().find(fact => fact.kind === 'intake-stop')!;
  const { effect } = setup('post-text'); padEffect(effect, 40);
  const lineage = effect.sourceFor('step:owner-stop', 'logical:owner-stop');
  const opening = effect.reference('run-opening', { type: 'Run', id: 'run:1', run: 'run:1' });
  const semantic = effect.reference('semantic-message-admission', { id: 'semantic:owner-stop', run: 'run:1',
    sourceLineage: 'run:1', status: 'current', validFrom: 0, validUntil: 1000 });
  const route = effect.reference('conversation-route-generation', { id: 'route:owner-stop', account: 'host',
    conversation: intakeRoute.channel, status: 'current', validFrom: 0, validUntil: 1000 });
  const effectIds = new Set([lineage.source.id, lineage.transition.id, opening.id, semantic.id, route.id]);
  const intakeIds = new Set(intake.facts().filter(fact => fact.kind !== 'note').map(fact => fact.id));
  const intakeContext = intakeProjectionContext(intake, stop.principal.id), baseCurrent = effect.host.current;
  const host = { ...effect.host, current: () => ({ ...baseCurrent(), decode: { ...baseCurrent().decode,
    captures: { ...baseCurrent().decode.captures, ...captureBytes(intake.context.captures) } } }),
  referenceFacts: () => effect.success([
    snapshot(value(effect.store.read()), effect.ctx, effectIds), snapshot(intake.facts(), intakeContext, intakeIds),
  ]) };
  const raw = identify({ ...payloadInput('post-text', host), step: 'step:owner-stop', sourceResult: lineage.source.id,
    logicalEffect: 'logical:owner-stop', semanticMessage: 'semantic:owner-stop', account: 'host',
    conversation: intakeRoute.channel, routeGeneration: 'route:owner-stop' });
  refused(decodeEffectPayload(raw, host), 'protected');
}, 30_000);

it('P8-TP-R7-OWNER-P5 resolves an actual Part Five run, step, and source evidence binding', () => {
  const run = runFixture(), sourceResult = value(decode('Result', run.refusedInput({
    detail: 'real run source pending effect', preserved: 'capture:run-source',
  }), run.ctx.decode));
  const source = run.append('result-record', runJson({ result: sourceResult })).fact;
  const ready = value(run.graph.open(run.run)), grounding = value(run.graph.ground(run.id, 'w', 'h', 'start', run.lease));
  const key = 'logical:owner-p5', transition = run.start(ready, grounding, key);
  value(run.graph.transition({ ...transition, step: { ...transition.step, evidence: [runRef(source)] } }));
  const { effect } = setup('post-text');
  padEffect(effect, 40);
  const semantic = effect.reference('semantic-message-admission', { id: 'semantic:owner-p5', run: run.id, sourceLineage: run.id,
    status: 'current', validFrom: 0, validUntil: 1000 });
  const route = effect.reference('conversation-route-generation', { id: 'route:owner-p5', account: 'bot:fixture',
    conversation: 'chat:fixture', status: 'current', validFrom: 0, validUntil: 1000 });
  const effectIds = new Set([semantic.id, route.id]);
  const effectSnapshot = snapshot(value(effect.store.read()), effect.ctx, effectIds);
  const runSnapshot = snapshot(value(run.store.read()), run.ctx);
  const baseCurrent = effect.host.current, host = { ...effect.host,
    current: () => ({ ...baseCurrent(), decode: { ...baseCurrent().decode,
      captures: { ...baseCurrent().decode.captures, ...captureBytes(run.ctx.captures) } } }),
    referenceFacts: () => effect.success([
      effectSnapshot, runSnapshot,
    ]) };
  const raw = identify({ ...payloadInput('post-text', host), run: run.id, semanticMessage: 'semantic:owner-p5',
    step: transition.step.id, logicalEffect: key, sourceResult: source.id, routeGeneration: 'route:owner-p5' });
  expect(value(decodeEffectPayload(raw, host)).sourceResult).toBe(source.id);
  const unrelated = run.append('result-record', runJson({ result: sourceResult })).fact;
  refused(decodeEffectPayload(identify({ ...raw, sourceResult: unrelated.id }), host), 'lineage');
}, 30_000);

it('P8-TP-R7-OWNER-P7 resolves an actual Part Seven request/attempt and refuses a wrong owner subject', async () => {
  const rawInbound = intakeMessage('audio'), intake = intakeFixture(); padIntake(intake, 30);
  intake.bind(); value(intake.port().receive(rawInbound, intakeRoute));
  const admitted = intake.facts().find(fact => fact.kind === 'intake-admitted')!;
  const judgment = judgmentFixture();
  value(await judgment.door.judge({ ...judgment.input, question: rawInbound }, judgment.start()));
  const rows = value(judgment.door.inspect()), request = rows.find(row => row.record.type === 'JudgmentRequest')!,
    attempt = rows.find(row => row.record.type === 'JudgmentAttemptRecord' && row.record.phase === 'response-observed')!;
  if (request.record.type !== 'JudgmentRequest' || attempt.record.type !== 'JudgmentAttemptRecord') throw new Error('owner fixture');
  const { effect } = setup('derive-transcript');
  padEffect(effect, 70);
  const lineage = effect.sourceFor('step:owner-p7', 'logical:owner-p7');
  const opening = effect.reference('run-opening', { type: 'Run', id: 'run:1', run: 'run:1' });
  const semantic = effect.reference('semantic-message-admission', { id: 'semantic:owner-p7', run: 'run:1',
    sourceLineage: 'run:1', status: 'current', validFrom: 0, validUntil: 1000 });
  const route = effect.reference('conversation-route-generation', { id: 'route:owner-p7', account: 'host', conversation: intakeRoute.channel,
    status: 'current', validFrom: 0, validUntil: 1000 });
  const destination = effect.reference('run-transition', { run: 'run:1', step: { id: judgment.input.step, run: 'run:1',
    operation: { key: 'logical:transcript-destination' }, evidence: [lineage.source.id] } });
  const effectIds = new Set([lineage.source.id, lineage.transition.id, opening.id, semantic.id, route.id, destination.id]);
  const intakeIds = new Set(intake.facts().filter(fact => fact.kind !== 'note').map(fact => fact.id));
  const intakeContext = intakeProjectionContext(intake, admitted.principal.id);
  const effectSnapshot = snapshot(value(effect.store.read()), effect.ctx, effectIds);
  const intakeSnapshot = snapshot(intake.facts(), intakeContext, intakeIds);
  const judgmentSnapshot = snapshot(value(judgment.store.read()), judgment.ctx);
  const baseCurrent = effect.host.current;
  const host = { ...effect.host, current: () => ({ ...baseCurrent(), decode: { ...baseCurrent().decode, captures: {
    ...baseCurrent().decode.captures, ...captureBytes(intake.context.captures), ...captureBytes(judgment.ctx.captures),
  } } }), referenceFacts: () => effect.success([
    effectSnapshot, intakeSnapshot, judgmentSnapshot,
  ]) };
  const raw = identify({ ...payloadInput('derive-transcript', host), run: 'run:1', step: 'step:owner-p7',
    sourceResult: lineage.source.id, logicalEffect: 'logical:owner-p7', semanticMessage: 'semantic:owner-p7',
    account: 'host', conversation: intakeRoute.channel,
    routeGeneration: 'route:owner-p7', sourceCapture: request.record.question, submittedCapture: request.record.submitted,
    responseCapture: attempt.record.receipt, providerOperation: attempt.fact.id, model: judgment.host.description.model,
    destinationStep: judgment.input.step, originatingIntake: admitted.id });
  const decoded = value(decodeEffectPayload(raw, host));
  expect(decoded.kind === 'derive-transcript' ? decoded.providerOperation : '').toBe(attempt.fact.id);
  refused(decodeEffectPayload(identify({ ...raw, providerOperation: request.fact.id }), host), 'wrong kind');
}, 60_000);

it('P8-TP-R7-REFUSAL-BYTES persists the exact typed adapter Refused result without a provider-shaped substitute', () => {
  const { effect, payload } = setup(), refusal = decode('Result', effect.refusedInput({
    detail: 'independently refused destination', preserved: 'capture:original-proposal',
  }), effect.host.current().decode);
  const raw = value(refusal);
  const api = createEffectDoorway({ ...effect.composition, adapter: { ...effect.composition.adapter,
    invokePayload: () => raw as never } });
  const request = value(prepare(effect, payload, api)), observation = value(api.dispatch(request, effect.fence));
  expect(effect.calls()).toBe(0);
  expect(effect.host.current().decode.captures[observation.capture.reference]).toBe(value(canonical(raw)).bytes);
});

it('P8-TP-R7-HISTORICAL-SETTLEMENT-LOSS retains known lost assessment bytes as tainted history without live promotion', () => {
  const { effect, payload } = setup(), request = value(prepare(effect, payload));
  const observation = value(effect.api.dispatch(request, effect.fence));
  effect.assess('happened', 3, true);
  const settlement = value(effect.api.settle(observation.operation));
  const fact = value(effect.api.inspect()).find(row => row.record.id === settlement.id)!.fact;
  const current = effect.verificationHost.current(), reference = 'capture:evidence';
  const captured = current.facts.captures[reference]!;
  const context = { ...current.facts, captures: { ...current.facts.captures,
    [reference]: { ...captured, bytes: null, status: 'missing' as const } } };
  const historical = value(decodeHistoricalBody(fact, context, context.decode));
  expect(historical.taint).toContain('evidence-unavailable');
  effect.withdrawAssessment();
  expect(() => decodeOwnedBody('part-eight', 'EffectSettlement',
    (fact.body as { record: Json }).record, fact, 'origin', context)).toThrow();
}, 20_000);
