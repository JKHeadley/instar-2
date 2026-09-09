import { expect, it } from 'vitest';
import { canonical, consumeOutcome, decode } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeEnvelope } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { createEffectDoorway, decodeEffectPayload, effectOperationContracts, effectPayloadIdentity } from '../../src/effects/index.js';
import { consumeEffectSettlement } from '../../src/effects/index.js';
import type { EffectRequest, TypedEffectPayload } from '../../src/effects/index.js';
import { createTransportAuthority, createTransportSpine } from '../../src/transport/index.js';
import { refused, value } from '../effects/fixture.js';
import { typedEffectFixture } from '../effects/typed-effect-fixture.js';
import { payloadInput } from '../effects/payload-fixtures.js';
import { typedJointFixture } from '../effects/typed-joint-fixture.js';
import { privateKey } from '../facts/fixtures.js';

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

it('P8-TP-REPAIR-02 V19 V34 stale or unavailable assessment cannot promote a stored settlement', () => {
  const j = typedJointFixture(), settlement = value(j.settling.settle(j.observed.operation));
  const aggregate = value(j.settling.createAggregate({ semanticMessage: j.request.semanticMessage, run: j.effect.run,
    children: [{ request: j.request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'review:owner' }));
  j.effect.evidence.splice(0);
  refused(j.settling.updateAggregate({ aggregate: aggregate.aggregate, request: j.request.id, settlement }));
});

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
});

it('P8-TP-REPAIR-05 V23 an unrelated refusal cannot terminalize a dispatched child', () => {
  const f = typedFixture(), request = value(f.prepare()); value(f.api.dispatch(request, f.fence));
  const aggregate = value(f.api.createAggregate({ semanticMessage: request.semanticMessage, run: f.run,
    children: [{ request, demandedStage: 'complete', inhibitLater: true, required: true }], reconciliationOwner: 'review:owner' }));
  const refusal = value(decode('Result', f.refusedInput({ detail: 'unrelated operation', preserved: 'capture:unrelated' }), f.ctx.decode));
  if (refusal.kind !== 'Refused') throw new Error('fixture refusal');
  refused(f.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id, refusal }), 'dispatched work');
});

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

it('P8-TP-REPAIR-08 V10 V11 V27 V28 V36 V37 unresolved source, identity, policy, target, generation, and fence refuse', () => {
  const wrongSource = typedFixture(), definitionFact = value(wrongSource.api.inspect()).find(row => row.record.type === 'OperationDefinition')!.fact.id;
  const badSource = identify({ ...wrongSource.payload, sourceResult: definitionFact }, wrongSource.host);
  refused(wrongSource.api.preparePayload({ definition: wrongSource.d.id, payload: badSource, run: wrongSource.run,
    pending: wrongSource.pending.id, attempt: 'bad-source', verificationOwner: 'reply-verifier', obligation: wrongSource.obligation,
    closure: [], fence: wrongSource.fence }), 'source result');
  const badIdentity = identify({ ...wrongSource.payload, logicalEffect: 'missing:logical', step: 'missing:step' }, wrongSource.host);
  refused(wrongSource.api.preparePayload({ definition: wrongSource.d.id, payload: badIdentity, run: wrongSource.run,
    pending: wrongSource.pending.id, attempt: 'bad-identity', verificationOwner: 'reply-verifier', obligation: wrongSource.obligation,
    closure: [], fence: wrongSource.fence }), 'identity');
  const badFence = { ...wrongSource.fence, assignment: 'missing:lease' };
  refused(wrongSource.api.preparePayload({ definition: wrongSource.d.id, payload: wrongSource.payload, run: wrongSource.run,
    pending: wrongSource.pending.id, attempt: 'bad-fence', verificationOwner: 'reply-verifier', obligation: wrongSource.obligation,
    closure: [], fence: badFence }), 'lease');
  const contract = effectOperationContracts['filesystem-mutation'];
  const fs = typedEffectFixture(undefined, 'executor:1', { payloadKind: 'filesystem-mutation', inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, ['filesystem-mutation']);
  const payload = identify({ ...payloadInput('filesystem-mutation', fs.host), sourceResult: fs.pending.id,
    protectedTargetPolicy: 'missing:policy' }, fs.host);
  refused(fs.api.preparePayload({ definition: fs.d.id, payload, run: fs.run, pending: fs.pending.id, attempt: 'missing-policy',
    verificationOwner: 'reply-verifier', obligation: fs.obligation, closure: [], fence: fs.fence }), 'policy');
});

it('P8-TP-REPAIR-09 V33 distinct logical children of one semantic parent receive distinct stable admissions', () => {
  const f = typedFixture(), first = value(f.prepare()), observed = value(f.api.dispatch(first, f.fence));
  f.assess('happened', 3, true); const settlement = value(f.api.settle(observed.operation));
  Object.assign(f.transportHost, { accountingDurability: f.replicas.durability });
  const accounting = createTransportAuthority(f.transportHost,
    createTransportSpine(f.transportHost, { context: f.ctx, privateKey }, f.store), f.host.boundary, consumeEffectSettlement);
  expect(value(accounting.settle(f.fence, settlement)).unresolved).toBe(0);
  const second = identify({ ...f.payload, logicalEffect: 'logical:second', text: 'second child' }, f.host);
  const result = f.api.preparePayload({ definition: f.d.id, payload: second, run: f.run, pending: f.pending.id,
    attempt: 'attempt:2', verificationOwner: 'reply-verifier', obligation: f.obligation, closure: [], fence: f.fence });
  expect(result.kind).toBe('Success');
  expect(value(canonical(first.binding!.reservation.semanticMessage)).bytes)
    .not.toBe(value(canonical(value(result).binding!.reservation.semanticMessage)).bytes);
});

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
