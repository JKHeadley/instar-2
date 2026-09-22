import { afterEach, expect, it } from 'vitest';
afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });
import { createTransportAuthority, createTransportSpine, admitAcceptedProviderReply } from '../../src/transport/index.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { consumeEffectSettlement } from '../../src/effects/index.js';
import { pair, outbound } from './pair-fixture.js';
import { providerFixture } from '../model-provider/fixture.js';
import { value, refused, privateKey } from '../facts/fixtures.js';

it('SIX-PAIR reopens after lost pair-append acknowledgment without refilling its budget or changing the committed reply policy', async () => {
  const s = await pair({ budget: 35 });
  const spine = createTransportSpine(s.f.th, { context: s.f.context, privateKey }, s.f.store);
  const crashing = createTransportAuthority(s.f.th, { ...spine, append: (record, required) => {
    const receipt = spine.append(record, required);
    if (record.type === 'RunPairAdmission') return s.f.result(() => { throw Error('crash after durable pair append'); });
    return receipt;
  } }, s.f.host.boundary, consumeEffectSettlement);
  refused(s.admit(crashing), 'crash after durable pair append');
  expect((value(s.f.six.inspect()) as any[]).filter((r: any) => r.record.type === 'RunPairAdmission')).toHaveLength(1);
  expect((value(s.f.six.inspect()) as any[]).filter((r: any) => r.record.type === 'LoopRecord' && r.record.run === s.reply.id)).toHaveLength(0);
  const f = providerFixture({ directory: s.f.directory });
  const graph = value(createRunGraph(f.deps));
  refused(admitAcceptedProviderReply(f.six, graph, 'restart:changed', f.fence, s.run,
    { ...s.policy, maxAttempts: 2 }, f.host.boundary), 'bounds cannot reset');
  value(admitAcceptedProviderReply(f.six, graph, 'restart:exact', f.fence, s.run, s.policy, f.host.boundary));
  refused(outbound({ ...s, f }).prepare(), 'spend bound exhausted');
  expect(f.calls()).toBe(0);
  expect(value(f.six.inspect()).filter(row => row.record.type === 'RunPairAdmission')).toHaveLength(1);
}, 60_000);

it('SIX-PAIR a lost dispatch claim cannot be reminted by another issuer or after store reopen', async () => {
  const s = await pair(); value(s.admit());
  const send = outbound(s), request = value(send.prepare());
  const reservation = (value(s.f.six.inspect()) as any[]).find(row => row.record.type === 'AdmissionReservation'
    && row.record.run === s.reply.id).record;
  value(s.f.six.claim('reply:lost-claim', s.f.fence, reservation.operation));
  const f = providerFixture({ directory: s.f.directory });
  refused(f.six.claim('reply:remint', f.fence, reservation.operation), 'claim already issued');
  const recovered = outbound({ ...s, f });
  // Eight has no response and no transferable live Six claim. It must not send.
  refused(recovered.api.dispatch(request, f.fence));
  expect(recovered.calls()).toBe(0); expect(f.calls()).toBe(0);
  expect(value(f.six.inspect()).filter(row => row.record.type === 'AdmissionReservation'
    && row.record.run === s.reply.id).at(-1)?.record).toMatchObject({ state: 'dispatch-claimed', charge: 20 });
}, 60_000);
