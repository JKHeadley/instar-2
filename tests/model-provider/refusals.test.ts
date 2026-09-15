import { expect, it, vi, afterEach } from 'vitest';
import { createConfinedProviderInvocation } from '../../src/assembly/index.js';
import { createProviderEffectDoorway } from '../../src/effects/index.js';
import type { ProviderReceipt, ProviderEffectRequest } from '../../src/effects/index.js';
import type { DispatchClaim } from '../../src/transport/index.js';
import { providerFixture, value, refused } from './fixture.js';
vi.setConfig({ testTimeout: 60000 });
// Full signed-history checks are synchronous. Let the worker service its RPC
// queue between cases; no deadline or assertion is weakened.
afterEach(() => new Promise<void>(resolve => setImmediate(resolve)));

it.each(['missing submitted bytes', 'changed submitted bytes', 'unavailable capture'])(
  'MODEL-PROVIDER-PATH unit refusal: %s at Seven preserves the pending step', label => {
    const f = providerFixture(), { prepared } = f.prepare(), cap = prepared.value.submitted;
    if (label === 'changed submitted bytes') f.metadata[cap.reference] = { ...f.metadata[cap.reference]!, bytes: 'changed' };
    else f.metadata[cap.reference] = { ...f.metadata[cap.reference]!, status: 'missing', bytes: null };
    refused(f.seven.readPrepared(prepared.request, f.fence));
    expect(f.calls()).toBe(0);
  });
it.each(['request', 'attempt', 'operation', 'settings', 'model', 'credential', 'provider client escape', 'worker authority', 'ordinary reply'])(
  'MODEL-PROVIDER-PATH unit refusal: mismatched %s at Eight never invokes', async label => {
    const f = providerFixture(), { request } = f.prepare();
    const changed = JSON.parse(JSON.stringify(request)) as ProviderEffectRequest;
    const mutation = changed as unknown as Record<string, unknown>;
    if (label === 'request') mutation.id = 'different-request';
    else if (label === 'attempt') mutation.attempt = 'different-attempt';
    else if (label === 'operation') mutation.digest = 'different-operation-digest';
    else Object.assign(mutation.payload as object, label === 'settings' ? { settingsDigest: 'changed' } : label === 'model' ? { model: 'changed' }
      : label === 'credential' ? { credential: 'worker-secret' } : label === 'provider client escape' ? { client: { invoke: 'worker-controlled' } } : label === 'worker authority' ? { authority: 'operator' } : { kind: 'ordinary-reply' });
    refused(await f.api.dispatch(changed, f.fence)); expect(f.calls()).toBe(0);
  });
it.each(['generation', 'fence', 'standing', 'deadline'])(
  'MODEL-PROVIDER-PATH unit refusal: stale %s before provider admission', async label => {
    const f = providerFixture(), { request } = f.prepare();
    if (label === 'generation') f.generation('stale-generation');
    if (label === 'standing') f.grants.splice(0);
    if (label === 'deadline') f.time(400);
    const fence = label === 'fence' ? { ...f.fence, epoch: -1 } as typeof f.fence : f.fence;
    refused(await f.api.dispatch(request, fence)); expect(f.calls()).toBe(0);
  });
it('MODEL-PROVIDER-PATH unit refusal: hidden retry at Ten construction', () => {
  const f = providerFixture();
  refused(createConfinedProviderInvocation({ ...f.route, automaticRetries: 1 } as unknown as typeof f.route,
    f.six, f.th, f.captures, f.host.boundary, f.store), 'hidden retry'); expect(f.calls()).toBe(0);
});
it('MODEL-PROVIDER-PATH unit refusal: unapproved provider route at Ten', async () => {
  const f = providerFixture(), { request } = f.prepare();
  const invocation = value(createConfinedProviderInvocation({ ...f.route, route: 'unapproved' }, f.six, f.th, f.captures, f.host.boundary, f.store));
  const api = createProviderEffectDoorway({ ...f.dependencies, invocation });
  refused(await api.dispatch(request, f.fence), 'unapproved provider route'); expect(f.calls()).toBe(0);
});
it('MODEL-PROVIDER-PATH unit refusal: exceeded input bound at Ten', async () => {
  const f = providerFixture(), { request } = f.prepare();
  const op = value(f.six.inspect()).filter(r => r.record.type === 'AdmissionReservation').at(-1)!;
  if (op.record.type !== 'AdmissionReservation') throw new Error('reservation absent');
  const claim = value(f.six.claim('claim-test', f.fence, op.record.operation));
  const invocation = value(createConfinedProviderInvocation(f.route, f.six, f.th, f.captures, f.host.boundary, f.store));
  refused(await invocation.invoke({ ...request.payload, maxInputBytes: 0 }, claim, f.fence, () => f.success('forged-acceptance')), 'input bound');
  expect(f.calls()).toBe(0);
});
it('MODEL-PROVIDER-PATH unit refusal: missing consumed claim at Ten and forged Seven receipt', async () => {
  const f = providerFixture(), { request } = f.prepare();
  const invocation = value(createConfinedProviderInvocation(f.route, f.six, f.th, f.captures, f.host.boundary, f.store));
  const forged = { operation: 'unknown', attempt: request.attempt, digest: request.digest, executor: f.th.incarnation } as DispatchClaim;
  refused(await invocation.invoke(request.payload, forged, f.fence, () => f.success('forged-acceptance')), 'claim absent');
  refused(f.seven.recordReceipt({} as ProviderReceipt), 'guarded Eight executor'); expect(f.calls()).toBe(0);
});
it('MODEL-PROVIDER-PATH unit refusal: absent Nine assessment', () => {
  const f = providerFixture(), { request } = f.prepare();
  const api = createProviderEffectDoorway({ ...f.dependencies, assessment: null });
  const op = value(f.six.inspect()).find(r => r.record.type === 'AdmissionReservation' && r.record.request === request.id)!;
  if (op.record.type !== 'AdmissionReservation') throw new Error('reservation absent');
  refused(api.assess(op.record.operation), 'Nine assessment absent'); expect(f.calls()).toBe(0);
});

it('MODEL-PROVIDER-PATH unit refusal: real consumed claim cannot bypass guarded Eight acceptance', async () => {
  const f = providerFixture(), { request } = f.prepare();
  const row = value(f.six.inspect()).find(r => r.record.type === 'AdmissionReservation' && r.record.request === request.id)!;
  if (row.record.type !== 'AdmissionReservation') throw new Error('reservation absent');
  const claim = value(f.six.claim('direct-call', f.fence, row.record.operation));
  const invocation = value(createConfinedProviderInvocation(f.route, f.six, f.th, f.captures, f.host.boundary, f.store));
  refused(await invocation.invoke(request.payload, claim, f.fence, () => f.success('forged-acceptance')), 'Eight executor acceptance missing');
  expect(f.calls()).toBe(0);
});
it.each(['output bytes', 'tokens', 'charge', 'reported hidden retry'])(
  'MODEL-PROVIDER-PATH unit refusal: exceeded %s bound after call retains consumed uncertainty', async label => {
    let calls = 0;
    const f = providerFixture({ route: { invoke: async () => {
      calls++; return { state: 'complete', bytes: label === 'output bytes' ? 'x'.repeat(4097) : '{}', providerOperation: 'bounded',
        usage: { inputTokens: 1, outputTokens: label === 'tokens' ? 129 : 1, charge: label === 'charge' ? 21 : 3, source: 'test' },
        retryBlocked: label === 'reported hidden retry' };
    } } });
    const { request } = f.prepare();
    refused(await f.api.dispatch(request, f.fence)); refused(await f.api.dispatch(request, f.fence));
    expect(calls).toBe(1);
    expect(f.all().filter(f => f.kind === 'judgment-provider-ProviderJudgmentAttemptRecord'
      && (f.body as unknown as { record: { phase: string } }).record.phase === 'response-observed')).toHaveLength(0);
    expect(value(f.six.inspect()).filter(r => r.record.type === 'AdmissionReservation').at(-1)!.record).toMatchObject({ state: 'consumed', charge: 20 });
  });
it('MODEL-PROVIDER-PATH unit refusal: commercial provider route remains NON-EXECUTABLE-UNTIL-production-boot-credential-custody', () => {
  const f = providerFixture();
  refused(createConfinedProviderInvocation({ ...f.route, environment: 'production' } as unknown as typeof f.route,
    f.six, f.th, f.captures, f.host.boundary, f.store), 'NON-EXECUTABLE-UNTIL-production-boot-credential-custody');
});
it('MODEL-PROVIDER-PATH unit refusal: adoption binds the existing Six reservation without a second admission', () => {
  const f = providerFixture(), { request } = f.prepare();
  const row = value(f.six.inspect()).find(r => r.record.type === 'AdmissionReservation' && r.record.request === request.id)!;
  if (row.record.type !== 'AdmissionReservation') throw new Error('reservation absent');
  expect(value(f.api.adopt(request, row.record, f.fence))).toEqual(request);
  refused(f.api.adopt(request, { ...row.record, charge: 19 }, f.fence));
  expect(value(f.six.inspect()).filter(r => r.record.type === 'AdmissionReservation')).toHaveLength(1);
  expect(f.calls()).toBe(0);
});
