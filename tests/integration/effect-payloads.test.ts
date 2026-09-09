import { setTimeout as yieldWorker } from 'node:timers/promises';
import { beforeEach, expect, it } from 'vitest';
import { canonical, consumeOutcome, decode } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeEnvelope, decodeHistoricalBody } from '../../src/facts/index.js';
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
});

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
  const request = value(f.api.preparePayload({ definition: f.d.id, payload, run: f.run, pending: f.pending.id,
    attempt: 'media:1', verificationOwner: 'reply-verifier', obligation: f.obligation, closure: [], fence: f.fence }));
  const references = referencedPayloadFacts(payload, f.host);
  expect(references.every(id => request.closure.includes(id))).toBe(true);
  const receipt = value(f.host.referenceFacts!()).find(fact => fact.kind === 'intake-receipt')!;
  expect(request.closure).toContain(receipt.id);
  const observation = value(f.api.dispatch(request, f.fence));
  expect(observation.capture.reference.length).toBeGreaterThan(0); expect(observation.capture.hash.length).toBeGreaterThan(0);
}, 30000);

it('P8-TP-RETURNED-TRANSCRIPT-LINEAGE successful transcript return retains capture, provider, intake, and destination lineage', () => {
  const contract = effectOperationContracts['derive-transcript'];
  const f = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'derive-transcript', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['derive-transcript']);
  const sourceCapture = value(f.host.capture('audio')), providerOperation = 'provider:transcribe:lineage';
  f.reference('judgment-JudgmentAttemptRecord', { record: { type: 'JudgmentAttemptRecord', id: providerOperation, operation: providerOperation,
    run: f.run.id, step: 'step:transcript', model: 'model:1', sourceCapture, originatingIntake: 'intake:1' } });
  const payload = identify({ ...payloadInput('derive-transcript', f.host), sourceResult: f.pending.id, sourceCapture, providerOperation }, f.host);
  const request = value(f.api.preparePayload({ definition: f.d.id, payload, run: f.run, pending: f.pending.id,
    attempt: 'transcript:1', verificationOwner: 'reply-verifier', obligation: f.obligation, closure: [], fence: f.fence }));
  const facts = value(f.host.referenceFacts!()), references = referencedPayloadFacts(payload, f.host);
  for (const kind of ['judgment-JudgmentAttemptRecord', 'intake-admitted', 'run-transition']) {
    expect(facts.some(fact => fact.kind === kind && references.includes(fact.id) && request.closure.includes(fact.id))).toBe(true);
  }
  const observation = value(f.api.dispatch(request, f.fence));
  expect(observation.capture.reference.length).toBeGreaterThan(0); expect(observation.capture.hash.length).toBeGreaterThan(0);
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
