import { beforeEach, expect, it } from 'vitest';
import { setTimeout as yieldWorker } from 'node:timers/promises';
import { canonical, decode } from '../../src/index.js';
import { createFactStore, decodeHistoricalBody } from '../../src/facts/index.js';
import { createEffectDoorway, decodeEffectPayload, effectOperationContracts, effectPayloadIdentity,
  referencedPayloadFacts, registerEffectBodies } from '../../src/effects/index.js';
import type { TypedEffectPayload } from '../../src/effects/index.js';
import { payloadInput, payloadKinds } from './payload-fixtures.js';
import { typedEffectFixture, value } from './typed-effect-fixture.js';

beforeEach(async () => { await yieldWorker(1); });

const identify = (input: Record<string, unknown>) => {
  const { id: _id, targetDigest: _targetDigest, ...draft } = input;
  return { ...draft, ...effectPayloadIdentity(draft as Parameters<typeof effectPayloadIdentity>[0]) };
};
const setup = (kind: keyof typeof effectOperationContracts = 'post-text', supported = true) => {
  if (kind === 'ordinary-reply') throw new Error('typed fixture required');
  const contract = effectOperationContracts[kind];
  return typedEffectFixture(undefined, 'executor:1', { payloadKind: kind, inputSchema: contract.inputSchema,
    canonicalization: contract.canonicalization, observationCapabilities: contract.observations }, supported ? [kind] : []);
};
const prepare = (f: ReturnType<typeof setup>, payload: TypedEffectPayload,
  attempt = 'attempt:1', api = f.api) => api.preparePayload({ definition: f.d.id, payload, run: f.run,
    pending: payload.sourceResult, attempt, verificationOwner: 'verifier',
    obligation: f.obligation, closure: [], fence: f.fence });

it.each(payloadKinds)('P8-TP-R5-V01 %s closed payload matrix', kind => {
  const f = setup(kind), host = kind === 'infrastructure-notice'
    ? { ...f.host, principal: f.principal('infrastructure', 'system') } : f.host;
  const raw = payloadInput(kind, host);
  expect(decodeEffectPayload(raw, host).kind).toBe('Success');
  for (const field of Object.keys(raw)) { const candidate = { ...raw }; delete candidate[field]; expect(decodeEffectPayload(candidate, host).kind).toBe('Refused'); }
  expect(decodeEffectPayload({ ...raw, extra: true }, host).kind).toBe('Refused');
  expect(decodeEffectPayload({ ...raw, kind: 'not-declared' }, host).kind).toBe('Refused');
  expect(decodeEffectPayload({ ...raw, targetDigest: value(canonical('bad')).hash }, host).kind).toBe('Refused');
});

it.each(payloadKinds)('P8-TP-R5-V02 %s requires its signed source and ignores unrelated signed data', kind => {
  const f = setup(kind), host = kind === 'infrastructure-notice'
    ? { ...f.host, principal: f.principal('infrastructure', 'system') } : f.host;
  const raw = payloadInput(kind, host); f.note('unrelated neighbor');
  expect(decodeEffectPayload(raw, host).kind).toBe('Success');
  const facts = value(f.store.read());
  expect(decodeEffectPayload(raw, { ...host, referenceFacts: () => f.success(facts.filter(fact => fact.id !== raw.sourceResult)) }).kind).toBe('Refused');
});

it.each(payloadKinds.filter(kind => kind !== 'infrastructure-notice'))('P8-TP-R5-V03 %s unsupported adapters refuse before reservation/call', kind => {
  const f = setup(kind, false), payload = value(decodeEffectPayload(payloadInput(kind, f.host), f.host));
  expect(prepare(f, payload).kind).toBe('Refused'); expect(f.calls()).toBe(0);
  expect(value(f.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation')).toHaveLength(0);
  expect(value(f.api.inspect()).filter(row => row.record.type === 'EffectRequest')).toHaveLength(1);
});

it('P8-TP-R5-V04 process lineage refuses absent, wrong-subject, and conflicting owner facts', () => {
  const f = setup('process-control'), raw = payloadInput('process-control', f.host), facts = value(f.store.read());
  expect(decodeEffectPayload(raw, f.host).kind).toBe('Success');
  for (const kind of ['process-incarnation', 'process-parent', 'process-start'])
    expect(decodeEffectPayload(raw, { ...f.host, referenceFacts: () => f.success(facts.filter(fact => fact.kind !== kind)) }).kind).toBe('Refused');
  expect(decodeEffectPayload(identify({ ...raw, parentIdentity: f.pending.id }), f.host).kind).toBe('Refused');
  const parent = facts.find(fact => fact.kind === 'process-parent')!, witness = JSON.parse(String((parent.body as { witness: string }).witness));
  f.reference('process-parent', { ...witness, executable: '/changed' });
  expect(decodeEffectPayload(raw, f.host).kind).toBe('Refused');
});

it('P8-TP-R5-V05 current route conflict invalidates the named old generation', () => {
  const f = setup('account-route-change'), raw = payloadInput('account-route-change', f.host);
  expect(decodeEffectPayload(raw, f.host).kind).toBe('Success');
  const old = value(f.store.read()).find(fact => fact.kind === 'account-route-generation')!, witness = JSON.parse(String((old.body as { witness: string }).witness));
  f.reference('registered-account', { id: 'bot:third', account: 'bot:third', provider: witness.provider, run: witness.run,
    status: 'current', validFrom: 0, validUntil: 1000 });
  f.reference('rollback-route', { id: 'route:new', run: witness.run, provider: witness.provider, fromAccount: 'bot:third',
    toAccount: 'bot:old', generation: 'route-generation:3', status: 'current', validFrom: 0, validUntil: 1000 });
  f.reference('account-route-generation', { ...witness, id: 'route-generation:3', generation: 'route-generation:3',
    toAccount: 'bot:third', rollbackRoute: 'route:new', supersedes: witness.id });
  expect(decodeEffectPayload(raw, f.host).kind).toBe('Refused');
});

it('P8-TP-R5-V06 current protected-target denial invalidates the named old allow', () => {
  const f = setup('filesystem-mutation'), raw = payloadInput('filesystem-mutation', f.host);
  expect(decodeEffectPayload(raw, f.host).kind).toBe('Success');
  f.reference('protected-target-policy', { id: 'policy:new-denial', decision: 'refused', targets: ['/project/state.json'],
    supersedes: raw.protectedTargetPolicy, status: 'current', validFrom: 0, validUntil: 1000 });
  expect(decodeEffectPayload(raw, f.host).kind).toBe('Refused');
});

it('P8-TP-R5-V07 historical media loss remains readable with evidence-unavailable taint', () => {
  const f = setup('post-media'), payload = value(decodeEffectPayload(payloadInput('post-media', f.host), f.host));
  const fact = value(f.spine.append(payload, referencedPayloadFacts(payload, f.host))).fact, facts = value(f.store.read());
  const good = { ...f.ctx, facts }; expect(decodeHistoricalBody(fact, good, good.decode).kind).toBe('Success');
  if (payload.kind !== 'post-media') throw new Error('fixture');
  const reference = payload.attachments[0]!.capture.reference;
  const missing = { ...good, captures: { ...good.captures, [reference]: { ...good.captures[reference]!, bytes: null, status: 'missing' as const } } };
  const result = decodeHistoricalBody(fact, missing, missing.decode);
  expect(result.kind).toBe('Success'); if (result.kind === 'Success') expect(result.value.taint).toContain('evidence-unavailable');
});

it('P8-TP-R5-V08 historical target interpretation ignores today\'s resolver while live use refuses', () => {
  const f = setup('configuration-change'), payload = value(decodeEffectPayload(payloadInput('configuration-change', f.host), f.host));
  const fact = value(f.spine.append(payload, referencedPayloadFacts(payload, f.host))).fact, facts = value(f.store.read());
  const changedHost = { ...f.host, resolvePath: () => f.success('/different/current/object') };
  const ownedBodies = [...(f.ctx.ownedBodies ?? []).filter(registration => registration.owner !== 'part-eight'), ...value(registerEffectBodies(changedHost))];
  expect(decodeEffectPayload(payload, changedHost).kind).toBe('Refused');
  expect(decodeHistoricalBody(fact, { ...f.ctx, ownedBodies, facts }, f.ctx.decode).kind).toBe('Success');
});

it('P8-TP-R5-V09 P8-TP-R5-V10 P8-TP-R5-V11 immutable preparation, aggregate bounds, and cold append recovery', () => {
  const f = setup(), payload = value(decodeEffectPayload(payloadInput('post-text', f.host), f.host));
  const first = value(prepare(f, payload)); expect(value(canonical(value(prepare(f, payload)))).bytes).toBe(value(canonical(first)).bytes);
  const child = { request: first, demandedStage: 'complete' as const, inhibitLater: true, required: true };
  expect(f.api.createAggregate({ semanticMessage: first.semanticMessage, run: f.run, reconciliationOwner: 'owner', children: [child] }).kind).toBe('Success');
  expect(f.api.createAggregate({ semanticMessage: first.semanticMessage, run: f.run, reconciliationOwner: 'owner', children: Array.from({ length: 65 }, () => child) }).kind).toBe('Refused');
  const cold = createFactStore(f.ctx, f.replicas.storage); expect(value(canonical(value(cold.read()))).bytes).toBe(value(canonical(value(f.store.read()))).bytes);
  expect(f.calls()).toBe(0);
});

it('P8-TP-R5-V12 another target run with a complete route remains an independent valid neighbor', () => {
  const f = setup('account-route-change'), raw = payloadInput('account-route-change', f.host), facts = value(f.store.read());
  for (const kind of ['account-route-generation', 'registered-account', 'rollback-route']) for (const fact of facts.filter(row => row.kind === kind)) {
    const body = JSON.parse(String((fact.body as { witness: string }).witness));
    f.reference(kind, { ...body, id: `${body.id}:other`, account: body.account ? `${body.account}:other` : undefined,
      run: 'run:other', generation: 'route-generation:2:other', fromAccount: body.fromAccount ? `${body.fromAccount}:other` : undefined,
      toAccount: body.toAccount ? `${body.toAccount}:other` : undefined, rollbackRoute: body.rollbackRoute ? `${body.rollbackRoute}:other` : undefined });
  }
  expect(decodeEffectPayload(identify({ ...raw, routeRun: 'run:other', fromAccount: 'bot:old:other', toAccount: 'bot:new:other',
    sourceGeneration: 'route-generation:2:other', rollbackRoute: 'route:old:other' }), f.host).kind).toBe('Success');
});

it('P8-TP-R5-V13 dispatch rechecks ordered predecessor inhibition', () => {
  const f = setup(), payload = value(decodeEffectPayload(payloadInput('post-text', f.host), f.host)), first = value(prepare(f, payload));
  const lineage = f.sourceFor('step:next', 'logical:next');
  const next = value(decodeEffectPayload(identify({ ...payload, step: 'step:next', logicalEffect: 'logical:next',
    sourceResult: lineage.source.id, text: 'next child' }), f.host));
  expect(prepare(f, next, 'attempt:2').kind).toBe('Refused');
  const second = value(f.api.inspect()).find(row => row.record.type === 'EffectRequest' && row.record.payload === next.id)!.record;
  if (second.type !== 'EffectRequest') throw new Error('fixture');
  const aggregate = value(f.api.createAggregate({ semanticMessage: first.semanticMessage, run: f.run, reconciliationOwner: 'owner',
    children: [first, second].map(request => ({ request, demandedStage: 'complete' as const, required: true, inhibitLater: true })) }));
  const refusal = value(decode('Result', f.refusedInput({ detail: 'exact first-child refusal', preserved: first.pending }), f.ctx.decode));
  if (refusal.kind !== 'Refused') throw new Error('fixture');
  const recorded = value(f.api.recordRefusal(first, refusal));
  expect(value(f.api.updateAggregate({ aggregate: aggregate.aggregate, request: first.id, refusal, refusalFact: recorded.id, fence: f.fence })).state).toBe('refused');
  expect(prepare(f, next, 'attempt:2').kind).toBe('Success');
  expect(f.api.dispatch(second, f.fence).kind).toBe('Refused'); expect(f.calls()).toBe(0);
}, 30_000);

it('P8-TP-R5-V14 signed EffectRefusal uses the existing closed Refused vocabulary', () => {
  const f = setup(), payload = value(decodeEffectPayload(payloadInput('post-text', f.host), f.host)), request = value(prepare(f, payload));
  const refusal = value(decode('Result', f.refusedInput({ detail: 'exact refusal', preserved: request.pending }), f.ctx.decode));
  if (refusal.kind !== 'Refused') throw new Error('fixture');
  const valid = value(f.api.recordRefusal(request, refusal));
  const malformed = { ...valid.refusal, reason: 'not-a-constitutional-reason', failDirection: 'not-a-fail-direction' };
  const record = { ...valid, refusal: malformed, id: `refusal:${value(canonical([request.id, request.digest, request.pending, malformed])).hash}` };
  const requestFact = value(f.api.inspect()).find(row => row.record.id === request.id)!.fact.id;
  expect(f.spine.append(record as never, [requestFact, request.pending]).kind).toBe('Refused');
});

it('P8-TP-R5-V15 P8-TP-R5-V16 P8-TP-R5-V17 cold lost-response recovery refuses replay, copied claims, and stopped dispatch', () => {
  const f = setup(), payload = value(decodeEffectPayload(payloadInput('post-text', f.host), f.host)), request = value(prepare(f, payload));
  f.onInvoke(() => { throw new Error('lost response after application'); });
  const observed = value(f.api.dispatch(request, f.fence)), replacement = createEffectDoorway(f.composition);
  expect(value(replacement.dispatch(request, f.fence)).id).toBe(observed.id); expect(f.calls()).toBe(1);
  expect(replacement.handoff(request, {} as never, { operation: 'missing', digest: request.digest, attempt: request.attempt, executor: f.host.incarnation } as never, f.fence).kind).toBe('Refused');
  f.stop(); expect(replacement.dispatch(request, f.fence).kind).toBe('Success'); expect(f.calls()).toBe(1);
});

it('P8-TP-R5-V18 P8-TP-R5-V19 closed process actions and acknowledgment modes preserve their valid neighbors', () => {
  const process = setup('process-control'), rawProcess = payloadInput('process-control', process.host);
  for (const action of ['start', 'interrupt', 'terminate', 'close', 'compact']) expect(decodeEffectPayload(identify({ ...rawProcess, action }), process.host).kind).toBe('Success');
  expect(decodeEffectPayload(identify({ ...rawProcess, action: 'arbitrary-shell' }), process.host).kind).toBe('Refused');
  const ack = setup('acknowledge'), rawAck = payloadInput('acknowledge', ack.host);
  for (const acknowledgment of ['reaction', 'read-receipt', 'typing', 'text']) expect(decodeEffectPayload(identify({ ...rawAck, acknowledgment }), ack.host).kind).toBe('Success');
  expect(decodeEffectPayload(identify({ ...rawAck, inboundFact: ack.pending.id }), ack.host).kind).toBe('Refused');
});

it('P8-TP-R5-V20 P8-TP-R5-V21 legacy bytes and signed historical owner records remain readable', () => {
  const f = setup(), payload = value(decodeEffectPayload(payloadInput('post-text', f.host), f.host));
  const fact = value(f.spine.append(payload, referencedPayloadFacts(payload, f.host))).fact, facts = value(f.store.read());
  const result = decodeHistoricalBody(JSON.parse(JSON.stringify(fact)), { ...f.ctx, facts: JSON.parse(JSON.stringify(facts)) }, f.ctx.decode);
  expect(result.kind).toBe('Success'); if (result.kind === 'Success') expect(value(canonical(result.value.fields.record)).bytes).toBe(value(canonical(payload)).bytes);
});

it('P8-TP-R5-V22 P8-TP-R5-V23 dispatch refuses route or protected-policy conflicts added after preparation', () => {
  const route = setup('account-route-change'), routeRaw = payloadInput('account-route-change', route.host);
  const routeRequest = value(prepare(route, value(decodeEffectPayload(routeRaw, route.host))));
  const old = value(route.store.read()).find(fact => fact.kind === 'account-route-generation')!, witness = JSON.parse(String((old.body as { witness: string }).witness));
  route.reference('registered-account', { id: 'bot:third', account: 'bot:third', provider: witness.provider, run: witness.run, status: 'current', validFrom: 0, validUntil: 1000 });
  route.reference('rollback-route', { id: 'route:new', run: witness.run, provider: witness.provider, fromAccount: 'bot:third', toAccount: 'bot:old', generation: 'route-generation:3', status: 'current', validFrom: 0, validUntil: 1000 });
  route.reference('account-route-generation', { ...witness, id: 'route-generation:3', generation: 'route-generation:3', toAccount: 'bot:third', rollbackRoute: 'route:new', supersedes: witness.id });
  expect(route.api.dispatch(routeRequest, route.fence).kind).toBe('Refused'); expect(route.calls()).toBe(0);

  const policy = setup('filesystem-mutation'), policyRaw = payloadInput('filesystem-mutation', policy.host);
  const policyRequest = value(prepare(policy, value(decodeEffectPayload(policyRaw, policy.host))));
  policy.reference('protected-target-policy', { id: 'policy:new-denial', decision: 'refused', targets: ['/project/state.json'],
    supersedes: policyRaw.protectedTargetPolicy, status: 'current', validFrom: 0, validUntil: 1000 });
  expect(policy.api.dispatch(policyRequest, policy.fence).kind).toBe('Refused'); expect(policy.calls()).toBe(0);
});

it.each(['EffectPayload', 'EffectRequest', 'EffectValidation'])('P8-TP-R5-V24 %s durable preparation cut has no call and resumes from signed history', type => {
  const f = setup(), payload = value(decodeEffectPayload(payloadInput('post-text', f.host), f.host));
  const api = createEffectDoorway({ ...f.composition, spine: { ...f.spine, append: (record, required) => {
    const result = f.spine.append(record, required); if (record.type === type) throw new Error(`cut-after-${type}`); return result;
  } } });
  expect(prepare(f, payload, 'attempt:1', api).kind).toBe('Refused'); expect(f.calls()).toBe(0);
  expect(prepare(f, payload).kind).toBe('Success'); expect(f.calls()).toBe(0);
});

it('P8-TP-R5-V25 initial aggregate cut restores its pending child', () => {
  const f = setup(), payload = value(decodeEffectPayload(payloadInput('post-text', f.host), f.host)), request = value(prepare(f, payload));
  const input = { semanticMessage: request.semanticMessage, run: f.run, reconciliationOwner: 'owner',
    children: [{ request, demandedStage: 'complete' as const, inhibitLater: true, required: true }] };
  const api = createEffectDoorway({ ...f.composition, spine: { ...f.spine, append: (record, required) => {
    const result = f.spine.append(record, required); if (record.type === 'OrderedEffectAggregate') throw new Error('cut'); return result;
  } } });
  expect(api.createAggregate(input).kind).toBe('Refused'); const aggregate = value(f.api.createAggregate(input));
  expect(value(f.api.nextAggregateChild(aggregate.aggregate))?.id).toBe(request.id); expect(f.calls()).toBe(0);
});

it.each(['EffectRefusal', 'OrderedEffectAggregate'])('P8-TP-R5-V26 %s durable refusal cut resumes without duplicate close', type => {
  const f = setup(), payload = value(decodeEffectPayload(payloadInput('post-text', f.host), f.host)), request = value(prepare(f, payload));
  const aggregate = value(f.api.createAggregate({ semanticMessage: request.semanticMessage, run: f.run, reconciliationOwner: 'owner',
    children: [{ request, demandedStage: 'complete', inhibitLater: true, required: true }] }));
  const refusal = value(decode('Result', f.refusedInput({ detail: 'exact refusal', preserved: request.pending }), f.ctx.decode));
  if (refusal.kind !== 'Refused') throw new Error('fixture');
  const api = createEffectDoorway({ ...f.composition, spine: { ...f.spine, append: (record, required) => {
    const result = f.spine.append(record, required); if (record.type === type) throw new Error(`cut-after-${type}`); return result;
  } } });
  if (type === 'EffectRefusal') expect(api.recordRefusal(request, refusal).kind).toBe('Refused');
  const recorded = value(f.api.recordRefusal(request, refusal));
  if (type === 'OrderedEffectAggregate') expect(api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id,
    refusal, refusalFact: recorded.id, fence: f.fence }).kind).toBe('Refused');
  else expect(value(f.api.updateAggregate({ aggregate: aggregate.aggregate, request: request.id,
    refusal, refusalFact: recorded.id, fence: f.fence })).state).toBe('refused');
  expect(value(f.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation' && row.record.state === 'closed')).toHaveLength(1);
  expect(f.calls()).toBe(0);
});
