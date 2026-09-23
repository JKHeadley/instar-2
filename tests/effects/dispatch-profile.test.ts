import { afterEach, expect, it } from 'vitest';
import { createEffectDoorway } from '../../src/effects/index.js';
import type { DispatchClaim, FenceToken, TransportAuthority, TransportFact } from '../../src/transport/index.js';
import { effectFixture, value, refused } from './fixture.js';
import { pair, outbound } from '../transport/pair-fixture.js';

afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });

it('ordinary dispatch preserves a delegating transport port and sends once', () => {
  const f = effectFixture(), request = f.prepare();
  let consumed = 0;
  // The production slice similarly wraps Six to record durable cut boundaries.
  const transport: typeof f.transport = Object.freeze({ ...f.transport,
    consume: (claim: DispatchClaim, fence: FenceToken) => { consumed++; return f.transport.consume(claim, fence); } });
  const api = createEffectDoorway({ ...f.composition, transport });
  const observation = value(api.dispatch(request, f.fence));
  expect(observation.stage).toBe('response');
  expect(f.calls()).toBe(1);
  expect(consumed).toBe(1);
  expect(value(api.dispatch(request, f.fence)).id).toBe(observation.id);
  expect(f.calls()).toBe(1);
  expect(consumed).toBe(1);
}, 30_000);

it.each([false, true])('a pair cannot select ordinary dispatch through a filtered inspection (changed domain: %s)', async changedDomain => {
  const s = await pair(); value(s.admit());
  const transport: TransportAuthority<unknown> = Object.freeze({ ...s.f.six,
    inspect: () => s.f.result(() => value<readonly TransportFact[]>(s.f.six.inspect())
      .filter(row => row.record.type !== 'RunPairAdmission')
      .map(row => changedDomain && row.record.type === 'AdmissionReservation'
        ? { ...row, record: { ...row.record, domain: 'inspection-only-other-domain' } } : row)) });
  const send = outbound({ ...s, f: { ...s.f, six: transport } });
  const request = value(send.prepare());
  refused(send.api.dispatch(request, s.f.fence), 'genuine Six invocation authority required');
  expect(send.calls()).toBe(0);
  const reservations = value<readonly TransportFact[]>(s.f.six.inspect())
    .filter(row => row.record.type === 'AdmissionReservation' && row.record.run === s.reply.id);
  expect(reservations.map(row => row.record.type === 'AdmissionReservation' && row.record.state))
    .toEqual(['prepared', 'dispatch-claimed', 'consumed']);
  const last = reservations.at(-1)!.record;
  if (last.type !== 'AdmissionReservation') throw new Error('missing reply reservation');
  expect(last.charge).toBe(20);
  refused(s.f.six.claim('wrapper:remint', s.f.fence, last.operation));
  refused(s.f.six.close('wrapper:release', s.f.fence, last.operation));
  send.api.dispatch(request, s.f.fence);
  const genuine = outbound(s);
  genuine.api.dispatch(request, s.f.fence);
  expect(send.calls()).toBe(0);
  expect(genuine.calls()).toBe(0);
  expect(value<readonly TransportFact[]>(s.f.six.inspect()).filter(row =>
    row.record.type === 'SettlementApplication' && row.record.operation === last.operation)).toHaveLength(0);
}, 60_000);
