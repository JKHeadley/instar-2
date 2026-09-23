import { afterEach, expect, it } from 'vitest';
afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });
import { admitAcceptedProviderReply, createTransportAuthority, createTransportSpine, decodeLoopPolicy } from '../../src/transport/index.js';
import { createEffectDoorway, createEffectSpine, decodeOutboundMessage, consumeEffectSettlement } from '../../src/effects/index.js';
import { providerFixture } from '../model-provider/fixture.js';
import { pair, outbound } from './pair-fixture.js';
import { refused, value, privateKey } from '../facts/fixtures.js';

it('SIX-PAIR admits the reply-owned outbound operation with original pending work and maximum exposure retained', async () => {
  const s = await pair();
  value(s.admit());
  const before: any = value(s.f.graph.read(s.f.id));
  const send = outbound(s), request = value(send.prepare());
  const observation = value(send.api.dispatch(request, s.f.fence));
  expect(observation.stage).toBe('response');
  expect(send.calls()).toBe(1);
  expect(s.modelCalls()).toBe(1);
  expect((value(s.f.graph.read(s.f.id)) as any).pending).toEqual(before.pending);
  expect(before.pending.length).toBeGreaterThan(0);
  const rows: any[] = value(s.f.six.inspect());
  expect(rows.filter(row => row.record.type === 'RunPairAdmission')).toHaveLength(1);
  expect(rows.find(row => row.record.type === 'AdmissionReservation' && row.record.run === s.reply.id)).toBeDefined();
  expect(rows.filter(row => row.record.type === 'SettlementApplication').at(-1).record)
    .toMatchObject({ unresolved: 1, exposure: 20, actualCharge: -1 });
  expect(value(send.api.dispatch(request, s.f.fence)).id).toBe(observation.id);
  expect(send.calls()).toBe(1);
  refused(outbound(s, { id: 'second-message', semanticMessage: 'second-message' }).prepare(), 'one outbound operation');
}, 60_000);

it('SIX-PAIR refuses unrelated and third Runs, copied issuers, other stores, model work and changed answers', async () => {
  const s = await pair();
  refused(s.f.six.schedule('unrelated', s.f.fence, { ...s.run, id: 'unrelated' }, s.policy), 'one run only');
  refused(s.admit({ ...s.f.six }), 'genuine Six');
  refused(s.admit(s.f.six, { ...s.replyGraph }), 'genuine same-store');
  refused(s.admit(s.f.six, providerFixture().graph), 'genuine same-store');
  refused(admitAcceptedProviderReply(s.f.six, s.replyGraph, 'other-domain',
    { ...s.f.fence, domain: 'other-domain' }, s.run, s.policy, s.f.host.boundary), 'fence');
  value(s.admit());
  refused(s.f.six.schedule('third', s.f.fence, { ...s.run, id: 'third' }, s.policy), 'one run only');
  refused(s.f.seven.prepare({ ...s.f.question, run: s.run }, s.f.fence), 'cannot request another model');
  const provider = (value(s.f.six.inspect()) as any[]).find(row => row.record.type === 'AdmissionReservation').record;
  refused(s.f.six.reserve({ command: 'reply:model', fence: s.f.fence,
    request: { owner: 'part-eight', name: 'EffectRequest', id: provider.request }, attempt: 'reply:model-attempt',
    payloadDigest: provider.digest, charge: provider.charge, run: s.run, semanticMessage: 'reply:model',
    durability: 'local-durable', replicas: 0 }), 'no model operation');
  refused(outbound(s, { text: 'unaccepted answer' }).prepare(), 'exact accepted-answer');
}, 60_000);

it('SIX-PAIR shares one finite budget across two issuer objects and serializes reentrant recovery', async () => {
  const s = await pair();
  value(s.admit());
  const second = createTransportAuthority(s.f.th, createTransportSpine(s.f.th,
    { context: s.f.context, privateKey }, s.f.store), s.f.host.boundary, consumeEffectSettlement);
  value(s.admit(second));
  expect(value(second.inspect()).filter(row => row.record.type === 'RunPairAdmission')).toHaveLength(1);
  const send = outbound(s), request = value(send.prepare());
  const observed = value(send.api.dispatch(request, s.f.fence));
  s.f.time(102);
  let nested = 0;
  value(s.f.six.recover('parent-recover', s.f.fence, s.settlement.operation, { owner: 'part-eight', observe: () => {
    refused(second.recover('reply-reentrant', s.f.fence, observed.operation, { owner: 'part-eight', observe: () => {
      nested++; throw Error('must not observe concurrently');
    } }), 'already active');
    return s.f.result(() => ({ owner: 'part-eight', name: 'OperationObservation', id: 'parent-observation' }));
  } }));
  expect(nested).toBe(0);
}, 60_000);
