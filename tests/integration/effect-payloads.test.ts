import { expect, it } from 'vitest';
import { consumeOutcome, decode } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { createEffectDoorway, decodeEffectPayload, effectOperationContracts, effectPayloadIdentity } from '../../src/effects/index.js';
import type { TypedEffectPayload } from '../../src/effects/index.js';
import { effectFixture, refused, value } from '../effects/fixture.js';
import { payloadInput } from '../effects/payload-fixtures.js';
import { typedJointFixture } from '../effects/typed-joint-fixture.js';

function typedFixture(supported = true) {
  const contract = effectOperationContracts['post-text'];
  const f = effectFixture(undefined, 'executor:1', { payloadKind: 'post-text', inputSchema: contract.inputSchema,
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
])('P8-TP-EVIDENCE P8-TP-THREE-CLOSURE charge, quiescence, and non-occurrence remain independent (%j)', (evidence, quiescent, charge, state, closure) => {
  const f = typedJointFixture(evidence);
  const settlement = value(f.settling.settle(f.observed.operation));
  expect(settlement.delayedExecutionExcluded).toBe(quiescent); expect(settlement.finalCharge).toBe(charge);
  expect(settlement.retryClosure).toEqual(closure); expect(settlement.retryEligible).toBe(false);
  const aggregate = value(f.settling.createAggregate({ semanticMessage: f.request.semanticMessage, run: f.effect.run,
    children: [{ request: f.request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'reconciler:1' }));
  expect(value(f.settling.updateAggregate({ aggregate: aggregate.aggregate, request: f.request.id, settlement })).state).toBe(state);
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
