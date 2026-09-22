import { afterEach, expect, it } from 'vitest';
afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });
import { createTransportAuthority, createTransportSpine, admitAcceptedProviderReply } from '../../src/transport/index.js';
import { consumeEffectSettlement } from '../../src/effects/index.js';
import { pair, outbound } from './pair-fixture.js';
import { value, refused, privateKey } from '../facts/fixtures.js';

it('SIX-PAIR retains original exposure and refuses insufficient combined budget, including a new issuer with a larger host limit', async () => {
  const s = await pair({ budget: 35 });
  value(s.admit());
  refused(outbound(s).prepare(), 'spend bound exhausted');
  Object.assign(s.f.th, { budget: 100 });
  const second = createTransportAuthority(s.f.th, createTransportSpine(s.f.th,
    { context: s.f.context, privateKey }, s.f.store), s.f.host.boundary, consumeEffectSettlement);
  value(s.admit(second));
  refused(outbound(s).prepare(), 'spend bound exhausted');
  expect(value(second.inspect()).filter(r => r.record.type === 'AdmissionReservation' && r.record.run === s.reply.id)).toHaveLength(0);
  expect(s.accounting).toMatchObject({ unresolved: 1, exposure: 20, released: 0 });
}, 60_000);

it('SIX-PAIR rechecks stop and stale fence at dispatch and never consumes a reply claim', async () => {
  const s = await pair(); value(s.admit());
  const send = outbound(s), request = value(send.prepare());
  refused(send.api.dispatch(request, { ...s.f.fence, epoch: s.f.fence.epoch + 1 }), 'fence');
  s.f.stop();
  refused(send.api.dispatch(request, s.f.fence), 'stop');
  expect(send.calls()).toBe(0);
  expect((value(s.f.six.inspect()) as any[]).filter((r: any) => r.record.type === 'AdmissionReservation'
    && r.record.run === s.reply.id).map((r: any) => r.record.state)).toEqual(['prepared']);
}, 60_000);

it('SIX-PAIR parent cap violation inhibits a prepared reply at dispatch', async () => {
  const s = await pair(); value(s.admit());
  const send = outbound(s), request = value(send.prepare());
  s.f.time(101);
  s.f.evidence(s.settlement.operation, s.subject.submitted.operationDigest, 'charge-settled', 21);
  const assessment = value(s.api.assessResponse(s.settlement.operation));
  const settlement = value(s.api.settle(s.settlement.operation, assessment));
  expect(value(s.f.six.settle(s.f.fence, settlement))).toMatchObject({ capViolation: 1 });
  refused(send.api.dispatch(request, s.f.fence), 'parent cap violation');
  expect(send.calls()).toBe(0);
}, 60_000);

it('SIX-PAIR a stopped parent recovery episode inhibits the reply without releasing pending credit', async () => {
  const s = await pair(); value(s.admit());
  const send = outbound(s), request = value(send.prepare());
  const observer = { owner: 'part-eight' as const, observe: () => s.f.result(() => (
    { owner: 'part-eight', name: 'OperationObservation', id: 'parent-observation' })) };
  s.f.time(102); value(s.f.six.recover('parent-wake:1', s.f.fence, s.settlement.operation, observer));
  s.f.time(104); value(s.f.six.recover('parent-wake:2', s.f.fence, s.settlement.operation, observer));
  refused(send.api.dispatch(request, s.f.fence), 'parent stop');
  expect(send.calls()).toBe(0);
  expect(s.accounting).toMatchObject({ unresolved: 1, exposure: 20 });
}, 60_000);
