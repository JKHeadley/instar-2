import { setTimeout as yieldWorker } from 'node:timers/promises';
import { beforeEach, expect, it } from 'vitest';
import { canonical, consumeOutcome, decode } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeEnvelope, decodeHistoricalBody, signEnvelope } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { createEffectDoorway, decodeEffectPayload, effectOperationContracts, effectPayloadIdentity, referencedPayloadFacts } from '../../src/effects/index.js';
import { consumeEffectSettlement } from '../../src/effects/index.js';
import type { EffectRequest, TypedEffectPayload } from '../../src/effects/index.js';
import { createTransportAuthority, createTransportSpine } from '../../src/transport/index.js';
import { effectFixture, refused, value } from '../effects/fixture.js';
import { typedEffectFixture } from '../effects/typed-effect-fixture.js';
import { payloadInput } from '../effects/payload-fixtures.js';
import { typedJointFixture } from '../effects/typed-joint-fixture.js';
import { privateKey } from '../facts/fixtures.js';
import { intakeFixture, message as intakeMessage, route as intakeRoute } from '../intake/fixtures.js';
import { judgmentFixture } from '../judgment/fixture.js';

// These real-stack cases are intentionally synchronous and collectively exceed
// Vitest's fixed 60s worker-RPC deadline. Yield between cases so the worker can
// receive the prior task-update acknowledgement without changing test semantics.
beforeEach(async () => { await yieldWorker(1); });

const identify = (input: Record<string, unknown>, host: ReturnType<typeof typedEffectFixture>['host']): TypedEffectPayload => {
  const draft = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
  return value(decodeEffectPayload({ ...draft,
    ...effectPayloadIdentity(draft as unknown as Parameters<typeof effectPayloadIdentity>[0]) }, host));
};

function typedFixture(supported = true) {
  const contract = effectOperationContracts['post-text'];
  const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'post-text', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, supported ? ['post-text'] : []);
  const raw = { ...payloadInput('post-text', f.host), sourceResult: f.pending.id };
  const draft = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
  const payload = value(decodeEffectPayload({ ...draft,
    ...effectPayloadIdentity(draft as unknown as Parameters<typeof effectPayloadIdentity>[0]) }, f.host));
  const prepare = (api = f.api) => api.preparePayload({ definition: f.d.id, payload, run: f.run, pending: f.pending.id,
    attempt: 'attempt:1', verificationOwner: 'reply-verifier', obligation: f.obligation, closure: [], fence: f.fence });
  return { ...f, payload, prepare };
}

it('P8-TP-PORTS typed post-text traverses real P2 append, P6 reservation/claim, P9 assessment, and P8 settlement', () => {
  const f = typedJointFixture();
  expect(f.effect.calls()).toBe(1); expect(f.observed.stage).toBe('response');
  expect(f.request.binding).toMatchObject({ subject: f.typed.semanticMessage, target: f.typed.targetDigest,
    principal: f.effect.host.principal.id, logicalEffect: f.typed.logicalEffect, run: f.effect.run.id, step: f.typed.step,
    definition: { id: f.effect.d.id, version: f.effect.definition.version },
    reservation: { request: f.request.id, attempt: f.request.attempt }, claim: { executor: f.effect.host.incarnation } });
  const settlement = value(f.settling.settle(f.observed.operation));
  expect(consumeOutcome(settlement.outcome, { happened: () => 'happened', 'did-not-happen': () => 'no', uncertain: () => 'unknown' })).toBe('happened');
  expect(settlement).toMatchObject({ finalCharge: 3, delayedExecutionExcluded: true, retainedExposure: 3, retryEligible: false });
  const aggregate = value(f.settling.createAggregate({ semanticMessage: f.request.semanticMessage, run: f.effect.run,
    children: [{ request: f.request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'reconciler:1' }));
  const closed = value(f.settling.updateAggregate({ aggregate: aggregate.aggregate, request: f.request.id, settlement }));
  expect(closed).toMatchObject({ state: 'satisfied', openEvidence: [], openCharge: [], openRecovery: [] });
}, 30000);

it('P8-TP-UNSUPPORTED landed ordinary-reply adapter refuses a new variant before reservation, claim, or provider call while preserving proposal', () => {
  const f = typedFixture(false);
  refused(f.prepare(), 'unsupported adapter capability');
  expect(f.calls()).toBe(0);
  expect(value(f.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation')).toHaveLength(0);
  expect(value(f.api.inspect()).map(row => row.record.type)).toEqual(expect.arrayContaining(['EffectPayload', 'EffectRequest']));
});

it('P8-TP-REFUSAL adapter refusal survives byte-for-byte into observation, settlement, and aggregate recovery', () => {
  const f = typedFixture();
  const adapterRefusal = value(decode('Result', f.refusedInput({ detail: 'provider policy refused exact operation', preserved: 'capture:provider-proposal' }), f.ctx.decode));
  if (adapterRefusal.kind !== 'Refused') throw new Error('fixture refusal');
  const api = createEffectDoorway({ ...f.composition, adapter: { ...f.composition.adapter,
    invokePayload: () => adapterRefusal as Result<string> } });
  const request = value(f.prepare(api));
  const observed = value(api.dispatch(request, f.fence));
  expect(observed.stage).toBe('refused'); expect(observed.refusal).toEqual({ reason: adapterRefusal.reason,
    detail: adapterRefusal.detail, site: adapterRefusal.site, failDirection: adapterRefusal.failDirection, preserved: adapterRefusal.preserved });
  const settlement = value(api.settle(observed.operation));
  expect(settlement.refusal).toEqual(observed.refusal); expect(settlement.retainedExposure).toBe(20);
  const aggregate = value(api.createAggregate({ semanticMessage: request.semanticMessage, run: f.run,
    children: [{ request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'reconciler:1' }));
  const updated = value(api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, settlement }));
  expect(updated.state).toBe('uncertain'); expect(updated.settlements[0]?.refusal).toEqual(observed.refusal);
}, 30000);

it.each([
  [['not-occurred', 'charged'] as const, false, 3, 'uncertain', { didNotHappen: false, quiescent: false, chargeSettled: true }],
  [['not-occurred', 'quiescent'] as const, true, null, 'partial', { didNotHappen: true, quiescent: true, chargeSettled: false }],
  [['not-occurred', 'quiescent', 'charged'] as const, true, 3, 'satisfied', { didNotHappen: true, quiescent: true, chargeSettled: true }],
])('P8-TP-REPAIR-04 P8-TP-EVIDENCE P8-TP-THREE-CLOSURE charge, quiescence, and non-occurrence remain independent (%j)', (evidence, quiescent, charge, state, closure) => {
  const f = typedJointFixture(evidence);
  const settlement = value(f.settling.settle(f.observed.operation));
  expect(settlement.delayedExecutionExcluded).toBe(quiescent); expect(settlement.finalCharge).toBe(charge);
  expect(settlement.retryClosure).toEqual(closure); expect(settlement.retryEligible).toBe(false);
  const aggregate = value(f.settling.createAggregate({ semanticMessage: f.request.semanticMessage, run: f.effect.run,
    children: [{ request: f.request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'reconciler:1' }));
  expect(value(f.settling.updateAggregate({ aggregate: aggregate.aggregate, request: f.request.id, settlement })).state).toBe(state);
}, 30000);

it('P8-TP-REPAIR-01 V17 a signed aggregate cannot self-report satisfaction with unwitnessed references', () => {
  const f = typedFixture(), request = value(f.prepare());
  const aggregate = value(f.api.createAggregate({ semanticMessage: request.semanticMessage, run: f.run,
    children: [{ request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'review:owner' }));
  const forged = { ...aggregate, id: `${aggregate.aggregate}:1`, revision: 1, predecessor: aggregate.id,
    settlements: [{ request: request.id, settlement: request.id, assessment: request.id,
      disposition: 'satisfied', applied: true }], state: 'satisfied', openEvidence: [], openCharge: [], openRecovery: [] } as never;
  refused(f.spine.append(forged, [value(f.api.inspect()).find(row => row.record.id === aggregate.id)!.fact.id]));
});

it('P8-TP-REPAIR-02 P8-TP-AGGREGATE-CURRENT-ALL V19 V34 stale or unavailable assessment cannot promote a stored settlement', () => {
  const j = typedJointFixture(), settlement = value(j.settling.settle(j.observed.operation));
  const aggregate = value(j.settling.createAggregate({ semanticMessage: j.request.semanticMessage, run: j.effect.run,
    children: [{ request: j.request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'review:owner' }));
  j.effect.evidence.splice(0);
  refused(j.settling.updateAggregate({ aggregate: aggregate.aggregate, request: j.request.id, settlement }));
}, 30000);

it('P8-TP-REPAIR-03 V21 a causally linked current assessment refines uncertain to decisive without redispatch', () => {
  const f = typedFixture(), request = value(f.prepare()), observed = value(f.api.dispatch(request, f.fence));
  const aggregate = value(f.api.createAggregate({ semanticMessage: request.semanticMessage, run: f.run,
    children: [{ request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'review:owner' }));
  const uncertain = value(f.api.settle(observed.operation));
  expect(value(f.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, settlement: uncertain })).state).toBe('uncertain');
  f.assess('happened', 3, true);
  const decisive = value(f.api.settle(observed.operation));
  expect(value(f.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, settlement: decisive })).state).toBe('satisfied');
  expect(f.calls()).toBe(1);
}, 30000);

it('P8-TP-REPAIR-05 V23 an unrelated refusal cannot terminalize a dispatched child', () => {
  const f = typedFixture(), request = value(f.prepare()); value(f.api.dispatch(request, f.fence));
  const aggregate = value(f.api.createAggregate({ semanticMessage: request.semanticMessage, run: f.run,
    children: [{ request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'review:owner' }));
  const refusal = value(decode('Result', f.refusedInput({ detail: 'unrelated operation', preserved: 'capture:unrelated' }), f.ctx.decode));
  if (refusal.kind !== 'Refused') throw new Error('fixture refusal');
  refused(f.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, refusal }), 'exact child');
}, 30000);

it('P8-TP-BOUND-REFUSAL only an exact recorded refusal plus a Part Six no-claim disposition can refuse a prepared child', () => {
  const f = typedFixture(), request = value(f.prepare());
  const aggregate = value(f.api.createAggregate({ semanticMessage: request.semanticMessage, run: f.run,
    children: [{ request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'review:owner' }));
  const refusal = value(decode('Result', f.refusedInput({ detail: 'policy denied exact child', preserved: request.pending }), f.ctx.decode));
  if (refusal.kind !== 'Refused') throw new Error('fixture refusal');
  refused(f.api.recordRefusal({ ...request, id: 'request:unrelated' }, refusal), 'recorded EffectRequest');
  refused(f.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, refusal }), 'exact child');
  const exact = value(f.api.recordRefusal(request, refusal));
  const updated = value(f.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, refusal, refusalFact: exact.id, fence: f.fence }));
  expect(updated.state).toBe('refused');
  const reservation = value(f.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation').at(-1)?.record;
  expect(reservation?.type === 'AdmissionReservation' ? reservation.state : '').toBe('closed');
}, 30000);

it('P8-TP-REPAIR-06 V31 signed typed history remains readable under a replacement executor incarnation', () => {
  const source = typedFixture(), request = value(source.prepare());
  const replacement = typedEffectFixture(undefined, 'executor:2', { payloadKind: 'post-text',
    inputSchema: effectOperationContracts['post-text'].inputSchema, canonicalization: effectOperationContracts['post-text'].canonicalization,
    observationCapabilities: effectOperationContracts['post-text'].observations }, ['post-text']);
  const decoded: FactEnvelope[] = [];
  for (const fact of value(source.store.read())) {
    decoded.push(value(decodeEnvelope(fact, { ...replacement.ctx, captures: source.ctx.captures,
      decode: { ...replacement.ctx.decode, evidence: source.evidence, captures: source.captures }, facts: decoded }, 'replication')));
  }
  expect(decoded.some(fact => fact.kind === 'effect-EffectRequest'
    && (fact.body as { record: { id: string } }).record.id === request.id)).toBe(true);
}, 30000);

it('P8-TP-SIGNED-REPLAY-REFUSAL a correctly signed typed payload refuses replication when its owner dependency is absent', () => {
  const contract = effectOperationContracts.acknowledge;
  const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'acknowledge', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['acknowledge']);
  const payload = identify({ ...payloadInput('acknowledge', f.host), sourceResult: f.pending.id }, f.host);
  value(f.api.preparePayload({ definition: f.d.id, payload, run: f.run, pending: f.pending.id, attempt: 'ack:replay',
    verificationOwner: 'reply-verifier', obligation: f.obligation, closure: [], fence: f.fence }));
  const history = value(f.store.read()), envelope = history.find(fact => fact.kind === 'effect-EffectPayload'
    && (fact.body as { record?: { id?: string } }).record?.id === payload.id)!;
  const intake = history.find(fact => fact.kind === 'intake-admitted')!;
  refused(decodeHistoricalBody(envelope, { ...f.ctx, facts: history.filter(fact => fact.id !== intake.id) }, f.ctx.decode));
});

it('P8-TP-REPAIR-08 V10 V11 V27 V28 V36 V37 unresolved source, identity, policy, target, generation, and fence refuse', () => {
  const wrongSource = typedFixture(), definitionFact = value(wrongSource.api.inspect()).find(row => row.record.type === 'OperationDefinition')!.fact.id;
  const badSourceRaw = { ...wrongSource.payload, sourceResult: definitionFact };
  const badSourceDraft = Object.fromEntries(Object.entries(badSourceRaw).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
  refused(decodeEffectPayload({ ...badSourceDraft,
    ...effectPayloadIdentity(badSourceDraft as unknown as Parameters<typeof effectPayloadIdentity>[0]) }, wrongSource.host), 'lineage');
  const badIdentityRaw = { ...wrongSource.payload, logicalEffect: 'missing:logical', step: 'missing:step' };
  const badIdentityDraft = Object.fromEntries(Object.entries(badIdentityRaw).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
  refused(decodeEffectPayload({ ...badIdentityDraft,
    ...effectPayloadIdentity(badIdentityDraft as unknown as Parameters<typeof effectPayloadIdentity>[0]) }, wrongSource.host), 'lineage');
  const badFence = { ...wrongSource.fence, assignment: 'missing:lease' };
  refused(wrongSource.api.preparePayload({ definition: wrongSource.d.id, payload: wrongSource.payload, run: wrongSource.run,
    pending: wrongSource.pending.id, attempt: 'bad-fence', verificationOwner: 'reply-verifier', obligation: wrongSource.obligation,
    closure: [], fence: badFence }), 'lease');
  const contract = effectOperationContracts['filesystem-mutation'];
  const fs = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'filesystem-mutation', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['filesystem-mutation']);
  const missingPolicyRaw = { ...payloadInput('filesystem-mutation', fs.host), sourceResult: fs.pending.id,
    protectedTargetPolicy: 'missing:policy' };
  const missingPolicyDraft = Object.fromEntries(Object.entries(missingPolicyRaw).filter(([key]) => key !== 'id' && key !== 'targetDigest'));
  refused(decodeEffectPayload({ ...missingPolicyDraft,
    ...effectPayloadIdentity(missingPolicyDraft as unknown as Parameters<typeof effectPayloadIdentity>[0]) }, fs.host), 'policy');
});

it('P8-TP-REPAIR-09 V33 distinct logical children of one semantic parent receive distinct stable admissions', () => {
  const f = typedFixture(), first = value(f.prepare()), observed = value(f.api.dispatch(first, f.fence));
  f.assess('happened', 3, true); const settlement = value(f.api.settle(observed.operation));
  Object.assign(f.transportHost, { accountingDurability: f.replicas.durability });
  const accounting = createTransportAuthority(f.transportHost,
    createTransportSpine(f.transportHost, { context: f.ctx, privateKey }, f.store), f.host.boundary, consumeEffectSettlement);
  expect(value(accounting.settle(f.fence, settlement)).unresolved).toBe(0);
  const lineage = f.sourceFor('step:second', 'logical:second');
  const second = identify({ ...f.payload, logicalEffect: 'logical:second', step: 'step:second', sourceResult: lineage.source.id, text: 'second child' }, f.host);
  const result = f.api.preparePayload({ definition: f.d.id, payload: second, run: f.run, pending: lineage.source.id,
    attempt: 'attempt:2', verificationOwner: 'reply-verifier', obligation: f.obligation, closure: [], fence: f.fence });
  expect(result.kind).toBe('Success');
  expect(value(canonical(first.binding!.reservation.semanticMessage)).bytes)
    .not.toBe(value(canonical(value(result).binding!.reservation.semanticMessage)).bytes);
}, 30000);

it('P8-TP-RENDERING-REQUEST changed immutable rendering records a distinct request without altering the first request', () => {
  const f = typedFixture(), first = value(f.prepare());
  const changed = identify({ ...f.payload, text: 'different immutable rendering' }, f.host);
  const second = f.api.preparePayload({ definition: f.d.id, payload: changed, run: f.run, pending: f.pending.id,
    attempt: 'attempt:rendering:2', verificationOwner: 'reply-verifier', obligation: f.obligation, closure: [], fence: f.fence });
  const requests = value(f.api.inspect()).filter(row => row.record.type === 'EffectRequest').map(row => row.record as EffectRequest);
  expect(requests.some(request => request.id === first.id && request.payload === first.payload)).toBe(true);
  expect(requests.some(request => request.id !== first.id && request.payload === changed.id)).toBe(true);
  if (second.kind === 'Success') expect(value(second).id).not.toBe(first.id);
  expect(f.calls()).toBe(0);
}, 30000);

it('P8-TP-RETURNED-MEDIA-LINEAGE successful media return retains signed intake lineage and captured returned bytes', () => {
  const contract = effectOperationContracts['fetch-inbound-media'];
  const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'fetch-inbound-media', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['fetch-inbound-media']);
  const payload = identify({ ...payloadInput('fetch-inbound-media', f.host), sourceResult: f.pending.id }, f.host);
  if (payload.kind !== 'fetch-inbound-media') throw new Error('media fixture kind');
  const returned = JSON.stringify({ platformFile: 'provider-file:1', mediaType: 'image/png', bytes: 'returned-media-bytes', intake: payload.inboundReceipt });
  const api = createEffectDoorway({ ...f.composition, adapter: { ...f.composition.adapter, invokePayload: () => f.success(returned) } });
  const request = value(api.preparePayload({ definition: f.d.id, payload, run: f.run, pending: f.pending.id,
    attempt: 'media:1', verificationOwner: 'reply-verifier', obligation: f.obligation, closure: [], fence: f.fence }));
  const references = referencedPayloadFacts(payload, f.host);
  expect(references.every(id => request.closure.includes(id))).toBe(true);
  const receipt = value(f.host.referenceFacts!()).find(fact => fact.kind === 'intake-receipt')!;
  expect(request.closure).toContain(receipt.id);
  const observation = value(api.dispatch(request, f.fence));
  expect(f.ctx.captures[observation.capture.reference]).toMatchObject({ bytes: returned, hash: observation.capture.hash, status: 'available' });
}, 30000);

it('P8-TP-RETURNED-TRANSCRIPT-LINEAGE successful transcript return retains capture, provider, intake, and destination lineage', () => {
  const contract = effectOperationContracts['derive-transcript'];
  const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'derive-transcript', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['derive-transcript']);
  const sourceCapture = (f.host as typeof f.host & { fixtureAudioCapture: { reference: string; hash: string } }).fixtureAudioCapture;
  const providerOperation = 'provider:transcribe';
  const payload = identify({ ...payloadInput('derive-transcript', f.host), sourceResult: f.pending.id, sourceCapture, providerOperation }, f.host);
  if (payload.kind !== 'derive-transcript') throw new Error('transcript fixture kind');
  const returned = JSON.stringify({ transcript: 'exact returned transcript', model: payload.model,
    sourceCapture: payload.sourceCapture, originatingIntake: payload.originatingIntake });
  const api = createEffectDoorway({ ...f.composition, adapter: { ...f.composition.adapter, invokePayload: () => f.success(returned) } });
  const request = value(api.preparePayload({ definition: f.d.id, payload, run: f.run, pending: f.pending.id,
    attempt: 'transcript:1', verificationOwner: 'reply-verifier', obligation: f.obligation, closure: [], fence: f.fence }));
  const facts = value(f.host.referenceFacts!()), references = referencedPayloadFacts(payload, f.host);
  for (const kind of ['judgment-JudgmentRequest', 'judgment-JudgmentAttemptRecord', 'intake-admitted', 'run-transition']) {
    expect(facts.some(fact => fact.kind === kind && references.includes(fact.id) && request.closure.includes(fact.id))).toBe(true);
  }
  const observation = value(api.dispatch(request, f.fence));
  expect(f.ctx.captures[observation.capture.reference]).toMatchObject({ bytes: returned, hash: observation.capture.hash, status: 'available' });
}, 30000);

it('P8-TP-AGGREGATE-OPEN-CLOSURES occurrence with unknown charge or quiescence remains partial', () => {
  const f = typedFixture(), request = value(f.prepare()), observed = value(f.api.dispatch(request, f.fence));
  f.assess('happened', null, false);
  const settlement = value(f.api.settle(observed.operation));
  const aggregate = value(f.api.createAggregate({ semanticMessage: request.semanticMessage, run: f.run,
    children: [{ request, demandedStage: 'occurrence', inhibitLater: true, required: true }], reconciliationOwner: 'review:owner' }));
  const updated = value(f.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, settlement }));
  expect(updated.state).toBe('partial'); expect(updated.openCharge).toEqual([request.id]); expect(updated.openRecovery).toEqual([request.id]);
}, 30000);

it('P8-TP-LEGACY-ASSESSMENT historical ordinary-reply accepts an independently recorded legacy note acceptance', () => {
  const f = effectFixture(), request = f.prepare(), observed = value(f.api.dispatch(request, f.fence));
  f.assess('happened', 0, true);
  const settlement = value(f.api.settle(observed.operation));
  const acceptance = value(f.store.read()).find(fact => fact.id === settlement.acceptance);
  expect(acceptance?.kind).toBe('note'); expect(settlement.request).toBe(request.id);
}, 30000);

it('P8-TP-RECOVERY lost receipt and hostile request substitution retain one identity, maximum exposure, and observation-only recovery', () => {
  const f = typedFixture(); f.onInvoke(() => { throw new Error('hostile cut after application before receipt'); });
  const request = value(f.prepare()), observed = value(f.api.dispatch(request, f.fence));
  expect(observed.stage).toBe('unknown'); expect(f.calls()).toBe(1);
  const replacement = createEffectDoorway(f.composition);
  expect(value(replacement.dispatch(request, f.fence)).id).toBe(observed.id); expect(f.calls()).toBe(1);
  refused(replacement.dispatch({ ...request, digest: request.payloadDigest! }, f.fence)); expect(f.calls()).toBe(1);
  const settlement = value(replacement.settle(observed.operation));
  expect(settlement).toMatchObject({ retainedExposure: 20, retryEligible: false, finalCharge: null });
}, 30000);

it.each(['charge-mismatch', 'wrong-kind-assessment'] as const)('P8-TP-F1-ASSESSMENT-REPLAY %s refuses signed settlement substitution', mode => {
  const j = typedJointFixture(), settlement = value(j.settling.settle(j.observed.operation));
  const history = value(j.store.read());
  const original = history.find(fact => fact.kind === 'effect-EffectSettlement'
    && (fact.body as { record?: { id?: string } }).record?.id === settlement.id)!;
  const context = { ...j.effect.ctx, facts: history.filter(fact => fact.id !== original.id) };
  expect(decodeHistoricalBody(original, context, context.decode).kind).toBe('Success');
  const raw = JSON.parse(JSON.stringify(original)) as FactEnvelope & { body: { record: Record<string, unknown> } };
  if (mode === 'charge-mismatch') { raw.body.record.finalCharge = '99'; raw.body.record.retainedExposure = 99; }
  else raw.body.record.acceptance = j.effect.note('wrong-kind acceptance').id;
  refused(decodeHistoricalBody(signEnvelope(raw, privateKey) as FactEnvelope, context, context.decode));
}, 30000);

it('P8-TP-F3-REAL-P4 accepts the actual Part Four admitted→receipt→binding contract', () => {
  const intake = intakeFixture(); intake.bind(); value(intake.port().receive(intakeMessage(), intakeRoute));
  const admitted = intake.facts().find(fact => fact.kind === 'intake-admitted')!;
  const contract = effectOperationContracts.acknowledge;
  const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'acknowledge', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['acknowledge']);
  const facts = value(f.host.referenceFacts!()).filter(fact => fact.kind !== 'intake-admitted');
  const host = { ...f.host, referenceFacts: () => f.success([...facts, ...intake.facts()]) };
  const raw = { ...payloadInput('acknowledge', host), sourceResult: f.pending.id, inboundFact: admitted.id,
    account: 'host', conversation: intakeRoute.channel };
  const decoded = identify(raw, host);
  expect(decoded.kind === 'acknowledge' ? decoded.inboundFact : '').toBe(admitted.id);
});

it('P8-TP-F3-REAL-P7 resolves an actual Part Seven attempt through its request, receipt, model, and P4 source', async () => {
  const rawInbound = intakeMessage('audio');
  const intake = intakeFixture(); intake.bind(); value(intake.port().receive(rawInbound, intakeRoute));
  const admitted = intake.facts().find(fact => fact.kind === 'intake-admitted')!;
  const judgment = judgmentFixture(); value(await judgment.door.judge({ ...judgment.input, question: rawInbound }, judgment.start()));
  const judgmentRows = value(judgment.door.inspect());
  const request = judgmentRows.find(row => row.record.type === 'JudgmentRequest')!;
  const attempt = judgmentRows.find(row => row.record.type === 'JudgmentAttemptRecord' && row.record.phase === 'response-observed')!;
  if (request.record.type !== 'JudgmentRequest') throw new Error('judgment request fixture');
  const contract = effectOperationContracts['derive-transcript'];
  const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'derive-transcript', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['derive-transcript']);
  f.reference('run-transition', { run: f.run.id, step: { id: judgment.input.step, run: f.run.id,
    operation: { key: 'logical:transcript-destination' }, evidence: [f.pending.id] } });
  const captureBytes = (rows: Record<string, { bytes: string | null; status: string }>) => Object.fromEntries(Object.entries(rows)
    .flatMap(([reference, captured]) => captured.status === 'available' && captured.bytes !== null ? [[reference, captured.bytes]] : []));
  const baseCurrent = f.host.current;
  const host = { ...f.host, current: () => ({ ...baseCurrent(), decode: { ...baseCurrent().decode, captures: {
    ...baseCurrent().decode.captures, ...captureBytes(intake.context.captures), ...captureBytes(judgment.ctx.captures) } } }),
  referenceFacts: () => f.success([...value(f.host.referenceFacts!()), ...intake.facts(), ...value(judgment.store.read())]) };
  const raw = { ...payloadInput('derive-transcript', host), sourceResult: f.pending.id, account: 'host', conversation: intakeRoute.channel,
    sourceCapture: request.record.question, providerOperation: attempt.fact.id, model: judgment.host.description.model,
    destinationStep: judgment.input.step, originatingIntake: admitted.id };
  const decoded = identify(raw, host);
  expect(decoded.kind === 'derive-transcript' ? decoded.providerOperation : '').toBe(attempt.fact.id);
}, 60000);

it('P8-TP-F9-AGGREGATE-READ downgrades a stored satisfied child when its current P9 assessment is withdrawn', () => {
  const j = typedJointFixture(), settlement = value(j.settling.settle(j.observed.operation));
  const aggregate = value(j.settling.createAggregate({ semanticMessage: j.request.semanticMessage, run: j.effect.run,
    children: [{ request: j.request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'owner' }));
  expect(value(j.settling.updateAggregate({ aggregate: aggregate.aggregate, request: j.request.id, settlement })).state).toBe('satisfied');
  j.effect.withdrawAssessment();
  const current = value(j.settling.inspect()).filter(row => row.record.type === 'OrderedEffectAggregate').at(-1)!.record;
  expect(current.type === 'OrderedEffectAggregate' ? current.state : '').toBe('uncertain');
}, 30000);

it('P8-TP-F11-CLOSE-APPEND-CUT resumes the exact refusal after a durable P6 close', () => {
  const f = typedFixture(), request = value(f.prepare());
  const aggregate = value(f.api.createAggregate({ semanticMessage: request.semanticMessage, run: f.run,
    children: [{ request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'owner' }));
  const refusal = value(decode('Result', f.refusedInput({ detail: 'exact refusal', preserved: request.pending }), f.ctx.decode));
  if (refusal.kind !== 'Refused') throw new Error('refusal fixture');
  const refusalFact = value(f.api.recordRefusal(request, refusal));
  const cut = createEffectDoorway({ ...f.composition, spine: { ...f.spine, append: (record, references) => {
    if (record.type === 'OrderedEffectAggregate' && record.revision === 1) throw new Error('cut after close');
    return f.spine.append(record, references);
  } } });
  const input = { aggregate: aggregate.aggregate, request: request.id, refusal, refusalFact: refusalFact.id, fence: f.fence };
  refused(cut.updateAggregate(input), 'cut after close');
  expect(value(createEffectDoorway(f.composition).updateAggregate(input)).state).toBe('refused');
  expect(f.calls()).toBe(0);
}, 30000);

it('P8-TP-F13-DEFINITION-PAYLOAD refuses an ordinary reply under an explicit typed definition before dispatch', () => {
  const contract = effectOperationContracts['process-control'];
  const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'process-control', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, []);
  const prepared = f.api.prepare({ definition: f.d.id, message: f.message, run: f.run, pending: f.pending.id,
    attempt: 'legacy:under:process-definition', verificationOwner: 'owner', obligation: f.obligation, closure: [], fence: f.fence });
  expect(prepared.kind).toBe('Refused'); expect(f.calls()).toBe(0);
}, 30000);
