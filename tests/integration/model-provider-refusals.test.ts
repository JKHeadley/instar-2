import { expect, it, vi } from 'vitest';
import { consumeOutcome, consumeResult } from '../../src/index.js';
import type { EffectSettlementAssessmentInput } from '../../src/verification/index.js';
import { createProviderEffectDoorway } from '../../src/effects/index.js';
import { providerFixture, value, refused, enc } from '../model-provider/fixture.js';
import { localProvider } from '../model-provider/http-provider.js';
vi.setConfig({ testTimeout: 90000 });
type Fixture = ReturnType<typeof providerFixture>;
function input(f: Fixture, operation: string): EffectSettlementAssessmentInput {
  const rows = value(f.six.inspect()).filter(r => r.record.type === 'AdmissionReservation' && r.record.operation === operation);
  const consumed = rows.at(-1)!.record;
  if (consumed.type !== 'AdmissionReservation') throw new Error('reservation absent');
  const claim = rows.find(r => r.record.type === 'AdmissionReservation' && r.record.state === 'dispatch-claimed')!.fact.id;
  const observations = f.all().filter(f => f.kind === 'effect-provider-ProviderOperationObservation')
    .map(f => (f.body as unknown as { record: EffectSettlementAssessmentInput['observations'][number] }).record);
  return { request: { id: consumed.request, attempt: consumed.attempt, digest: consumed.digest, verificationBar: 'provider-bar' },
    reservation: consumed, claim, observations, plan: f.plan.id, bar: 'provider-bar', generation: f.th.current().generation.id };
}
const pending = (f: Fixture) => {
  expect(f.all().filter(f => f.kind === 'effect-provider-ProviderEffectSettlement' || f.kind === 'transport-SettlementApplication'
    || f.kind === 'judgment-provider-ProviderJudgmentResolution')).toHaveLength(0);
  expect(f.all().filter(f => f.kind === 'run-transition').at(-1)?.body).not.toMatchObject({ record: { id: 'provider-accepted' } });
};
it('MODEL-PROVIDER-PATH integration provider timeout captures uncertainty; unknown charge never releases, retries or advances', async () => {
  const http = await localProvider();
  try {
    http.delay(100);
    const f = providerFixture({ ...http, timeout: 20 }), { request, prepared } = f.prepare();
    const observation = value(await f.api.dispatch(request, f.fence));
    const receipt = JSON.parse(value(f.captures.read(observation.capture as Parameters<typeof f.captures.read>[0])));
    expect(receipt.state).toBe('uncertain'); expect(receipt.usage.charge).toBeNull();
    const a = value(f.api.assess(observation.operation));
    refused(f.api.settle(observation.operation, a));
    const reservation = value(f.six.inspect()).filter(r => r.record.type === 'AdmissionReservation').at(-1)!.record;
    expect(reservation).toMatchObject({ state: 'consumed', charge: 20 });
    pending(f); refused(await f.api.dispatch(request, f.fence));
    expect(value(f.graph.read(f.id)).pending).toHaveLength(1); expect(http.requests).toHaveLength(1);
  } finally { await http.close(); }
});
it('MODEL-PROVIDER-PATH integration unknown charge despite proved occurrence retains maximum exposure and pending Five step', async () => {
  const http = await localProvider();
  try {
    const f = providerFixture(http), { request, prepared } = f.prepare();
    const observation = value(await f.api.dispatch(request, f.fence));
    f.evidence(observation.operation, request.digest, 'operation-occurred');
    f.evidence(observation.operation, request.digest, 'old-executor-quiescent');
    const s = value(f.api.settle(observation.operation, value(f.api.assess(observation.operation))));
    expect(s.finalCharge).toBeNull(); expect(s.retainedExposure).toBe(20);
    expect(value(f.six.settle(f.fence, s))).toMatchObject({ exposure: 20, released: 0, unresolved: 1, retryEligible: 0 });
    refused(f.seven.resolve(prepared.request, s, f.fence)); expect(value(f.graph.read(f.id)).pending).toHaveLength(1);
    expect(http.requests).toHaveLength(1);
  } finally { await http.close(); }
});
it.each(['stale', 'tainted', 'withdrawn', 'differently-bound', 'changed observations', 'wrong digest', 'wrong operation', 'wrong attempt', 'pinned vector'])(
  'MODEL-PROVIDER-PATH integration %s assessment input refuses without settlement or release', async label => {
    const http = await localProvider();
    try {
      const f = providerFixture(http), { request } = f.prepare();
      const observation = value(await f.api.dispatch(request, f.fence));
      const source = f.evidence(observation.operation, request.digest, 'operation-occurred');
      f.evidence(observation.operation, request.digest, 'charge-settled', 3);
      const a = value(f.api.assess(observation.operation)), bound = input(f, observation.operation);
      let altered = bound;
      if (label === 'stale') f.time(210);
      if (label === 'tainted') f.metadata[observation.capture.reference] = { ...f.metadata[observation.capture.reference]!, bytes: null, status: 'missing' };
      if (label === 'withdrawn') { const list = f.vh.current().evidence as typeof source[]; list.splice(list.findIndex(e => e.id === source.id), 1); }
      if (label === 'differently-bound') altered = { ...bound, claim: 'foreign-claim' };
      if (label === 'changed observations') altered = { ...bound, observations: [...bound.observations].reverse() };
      if (label === 'wrong digest') altered = { ...bound, request: { ...bound.request, digest: 'wrong' } };
      if (label === 'wrong operation') altered = { ...bound, reservation: { ...bound.reservation, operation: 'wrong' } };
      if (label === 'wrong attempt') altered = { ...bound, request: { ...bound.request, attempt: 'wrong' } };
      if (label === 'pinned vector') Object.assign(f.context.folded, { unexpected: { epoch: 0, position: 1 } });
      let consumerCalls = 0;
      refused(f.nine.consumeEffectSettlementAssessment(a, altered, () => { consumerCalls++; return true; }));
      expect(consumerCalls).toBe(0);
      if (altered === bound) refused(f.api.settle(observation.operation, a));
      else {
        const port = { ...f.nine, consumeEffectSettlementAssessment: <T>(reference: typeof a, _input: EffectSettlementAssessmentInput, callback: Parameters<typeof f.nine.consumeEffectSettlementAssessment<T>>[2]) => f.nine.consumeEffectSettlementAssessment(reference, altered, callback) };
        refused(createProviderEffectDoorway({ ...f.dependencies, assessment: port }).settle(observation.operation, a));
      }
      pending(f); expect(http.requests).toHaveLength(1);
    } finally { await http.close(); }
  });
it('MODEL-PROVIDER-PATH integration evidence withdrawal during durability recheck refuses before settlement append', async () => {
  const http = await localProvider();
  try {
    const f = providerFixture(http), { request } = f.prepare();
    const observation = value(await f.api.dispatch(request, f.fence));
    const source = f.evidence(observation.operation, request.digest, 'operation-occurred');
    const a = value(f.api.assess(observation.operation));
    const api = createProviderEffectDoorway({ ...f.dependencies, durability: { ...f.dependencies.durability, ensure: facts => {
      const list = f.vh.current().evidence as typeof source[]; list.splice(list.findIndex(e => e.id === source.id), 1);
      return f.dependencies.durability.ensure(facts);
    } } });
    refused(api.settle(observation.operation, a)); pending(f); expect(http.requests).toHaveLength(1);
  } finally { await http.close(); }
});
it('MODEL-PROVIDER-PATH integration decisive non-occurrence plus quiescence settles final zero charge with retry arm HELD', async () => {
  const http = await localProvider();
  try {
    const f = providerFixture(http), { request } = f.prepare();
    const observation = value(await f.api.dispatch(request, f.fence));
    f.evidence(observation.operation, request.digest, 'operation-did-not-occur');
    f.evidence(observation.operation, request.digest, 'old-executor-quiescent');
    f.evidence(observation.operation, request.digest, 'charge-settled', 0);
    const a = value(f.api.assess(observation.operation)), s = value(f.api.settle(observation.operation, a));
    expect(consumeOutcome(s.outcome, { 'did-not-happen': () => true, happened: () => false, uncertain: () => false })).toBe(true);
    const first = value(f.six.settle(f.fence, s)); expect(first).toMatchObject({ actualCharge: 0, exposure: 0, released: 20, unresolved: 0, retryEligible: 0 });
    const duplicate = value(f.api.settle(observation.operation, a)); expect(enc(duplicate).bytes).toBe(enc(s).bytes);
    expect(enc(value(f.six.settle(f.fence, duplicate))).bytes).toBe(enc(first).bytes);
    expect(f.all().filter(f => f.kind === 'effect-provider-ProviderEffectSettlement')).toHaveLength(1);
    refused(await f.api.dispatch(request, f.fence)); expect(http.requests).toHaveLength(1);
  } finally { await http.close(); }
});

it.each(['wrong source digest', 'insufficient occurrence', 'contradicted occurrence'])(
  'MODEL-PROVIDER-PATH integration %s cannot establish occurrence or release credit', async label => {
    const http = await localProvider();
    try {
      const f = providerFixture(http), { request } = f.prepare();
      const observation = value(await f.api.dispatch(request, f.fence));
      f.evidence(observation.operation, label === 'wrong source digest' ? 'foreign-digest' : request.digest, 'operation-occurred', undefined,
        label === 'insufficient occurrence' ? { strength: 'inference' } : {});
      if (label === 'contradicted occurrence') f.evidence(observation.operation, request.digest, 'operation-did-not-occur');
      const a = value(f.api.assess(observation.operation));
      consumeResult(f.api.settle(observation.operation, a), { Refused: () => pending(f), Success: s => {
        expect(consumeOutcome(s.outcome, { uncertain: () => true, happened: () => false, 'did-not-happen': () => false })).toBe(true);
        expect(value(f.six.settle(f.fence, s))).toMatchObject({ exposure: 20, released: 0, unresolved: 1, retryEligible: 0 });
      } });
      expect(value(f.graph.read(f.id)).pending).toHaveLength(1); expect(http.requests).toHaveLength(1);
    } finally { await http.close(); }
  });

it('MODEL-PROVIDER-PATH integration late independent charge proof renews Nine assessment for the same operation without another invocation', async () => {
  const http = await localProvider();
  try {
    const f = providerFixture(http), { request } = f.prepare();
    const observation = value(await f.api.dispatch(request, f.fence));
    f.evidence(observation.operation, request.digest, 'operation-occurred');
    const first = value(f.api.assess(observation.operation));
    f.evidence(observation.operation, request.digest, 'charge-settled', 3);
    f.evidence(observation.operation, request.digest, 'old-executor-quiescent');
    refused(f.api.settle(observation.operation, first));
    const renewed = value(f.api.assess(observation.operation)); expect(renewed.id).not.toBe(first.id);
    const settled = value(f.api.settle(observation.operation, renewed));
    expect(value(f.six.settle(f.fence, settled))).toMatchObject({ actualCharge: 3, released: 17, unresolved: 0, retryEligible: 0 });
    expect(http.requests).toHaveLength(1);
  } finally { await http.close(); }
});
it('MODEL-PROVIDER-PATH integration the admitted timeout bound cannot be widened by driver defaults', async () => {
  const http = await localProvider();
  try {
    http.delay(200);
    const f = providerFixture({ ...http, timeout: 2000 }), { request } = f.prepare();
    expect(request.payload.timeout).toBe(100);
    const observation = value(await f.api.dispatch(request, f.fence));
    const receipt = JSON.parse(value(f.captures.read(observation.capture as Parameters<typeof f.captures.read>[0])));
    expect(receipt).toMatchObject({ state: 'uncertain', bytes: null, usage: { charge: null }, limitation: { kind: 'transport-threw' } });
    refused(await f.api.dispatch(request, f.fence));
    expect(http.requests).toHaveLength(1); expect(value(f.graph.read(f.id)).pending).toHaveLength(1);
  } finally { await http.close(); }
});
