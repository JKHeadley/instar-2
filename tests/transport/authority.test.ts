import { expect, it } from 'vitest';
import { createTransportAuthority, decodeLoopPolicy, telegramReferenceAdapter, transportShapes } from '../../src/transport/index.js';
import type { DispatchClaim, FenceToken, Lease } from '../../src/transport/index.js';
import { transportFixture, value, refused } from './fixture.js';

it('P6-NF-03 P6-NF-05 P6-NF-08 exclusive predecessor, stale fence, renewal and release dedup', () => {
  const f = transportFixture(), first = value(f.api.acquire('a', '', 100));
  refused(f.api.acquire('b', '', 100), 'predecessor');
  refused(f.api.acquire('b', f.head(), 100), 'still held');
  expect(value(f.api.renew('renew', first, 200)).epoch).toBe(1);
  const count = value(f.api.inspect()).length;
  value(f.api.renew('renew', first, 200)); expect(value(f.api.inspect())).toHaveLength(count);
  refused(f.api.renew('renew', first, 201), 'different lease');
  value(f.api.release('release', first)); value(f.api.release('release', first));
  const second = value(f.api.acquire('b', f.head(), 100)); expect(second.epoch).toBe(2);
  refused(f.api.admitWrite('stale-write', first), 'stale');
  // No loss callback was ever delivered. The boundary still refuses the stale owner.
  refused(f.api.release('old-release', first));
  expect(value(f.api.admitWrite('current-write', second)).epoch).toBe(2);
});

it('P6-NF-09 P6-NF-11 P6-NF-39 claim is one-use independently of accurate budget counters', () => {
  const f = transportFixture(), { token, reservation } = f.prepared();
  const claim = value(f.api.claim('claim', token, reservation.operation));
  const spent = () => value(f.api.inspect()).filter(r => r.record.type === 'AdmissionReservation').at(-1)?.record;
  const consumed = value(f.api.consume(claim, token)); expect(consumed.charge).toBe(20);
  refused(f.api.consume(claim, token), 'already consumed');
  expect(spent()).toEqual(consumed);
  refused(f.api.claim('claim-again', token, reservation.operation), 'already issued');
  refused(f.api.consume({ ...claim } as DispatchClaim, token), 'absent');
  refused(f.api.claim('no-reservation', token, 'invented'), 'reservation absent');
});

it('P6-NF-04 P6-NF-06 P6-NF-10 restart restores epochs, never old clock authority or callable handles', () => {
  const f = transportFixture(), { token, reservation } = f.prepared();
  const claim = value(f.api.claim('claim', token, reservation.operation));
  const restarted = transportFixture(f.directory, 'worker:2', 'authority:2');
  expect(value(restarted.api.inspect()).length).toBe(4);
  refused(restarted.api.admitWrite('old', token), 'authority');
  const next = value(restarted.api.acquire('takeover', restarted.head(), 500)); expect(next.epoch).toBe(2);
  refused(restarted.api.consume(claim, next), 'absent');
  refused(restarted.api.claim('duplicate', next, reservation.operation), 'already issued');
  expect(value(restarted.api.inspect()).some(r => r.record.type === 'AdmissionReservation' && r.record.charge === 20)).toBe(true);
});

it('P6-NF-05 P6-NF-07 current principal, scope, incarnation, stop and generation gate every admission', () => {
  for (const mutation of ['epoch', 'domain', 'incarnation', 'holder', 'assignment'] as const) {
    const f = transportFixture(), token = value(f.api.acquire('a', '', 500));
    refused(f.api.admitWrite('bad', { ...token, [mutation]: mutation === 'epoch' ? 999 : 'other' } as FenceToken));
    value(f.api.admitWrite('good', token));
  }
  const f = transportFixture(), token = value(f.api.acquire('a', '', 500));
  const other = createTransportAuthority({ ...f.host, principal: f.bob }, f.spine, f.c);
  refused(other.admitWrite('wrong-principal', token), 'standing');
  f.generation('generation:2'); refused(f.api.admitWrite('moved', token), 'generation');
  f.generation('generation:1'); value(f.api.admitWrite('current', token));
  f.stop(); refused(f.api.admitWrite('stopped', token), 'stop');
});

it('P6-NF-05 stale writes fail through the actual P2 append boundary, not just an API wrapper', () => {
  const f = transportFixture(), first = value(f.api.acquire('a', '', 50));
  const original = value(f.api.inspect())[0]!.record as Lease;
  f.advance(51); const current = value(f.api.acquire('b', f.head(), 50));
  const forged = { ...original, command: 'bypass', predecessor: f.head(), tick: 151, expires: 201 } as Lease;
  refused(f.spine.append(forged, [f.head()]), 'epoch');
  expect(value(f.api.admitWrite('real', current)).epoch).toBe(2);
  refused(f.api.admitWrite('old', first));
});

it('P6-NF-12 effect durability is not inferred from the lease acknowledgement', () => {
  const f = transportFixture(), token = value(f.api.acquire('a', '', 500));
  value(f.api.schedule('loop', token, f.run, f.policy));
  refused(f.api.reserve(f.input(token, { durability: 'replicated', replicas: 1 })), 'stronger durability');
  // An uncertain acknowledgement cannot turn the persisted reservation into permission.
  const stored = value(f.api.reserve(f.input(token, { durability: 'replicated', replicas: 1 })));
  refused(f.api.claim('claim', token, stored.operation), 'stronger durability');
});

it('P6-NF-13 P6-NF-39 changing request, attempt, semantic key or digest cannot evade uncertainty', () => {
  const f = transportFixture(), { token, reservation } = f.prepared();
  expect(value(f.api.reserve(f.input(token))).operation).toBe(reservation.operation);
  refused(f.api.reserve(f.input(token, { payloadDigest: `sha256:${'b'.repeat(64)}` })), 'mapping changed');
  refused(f.api.reserve(f.input(token, { command: 'fresh', attempt: 'fresh-attempt' })), 'unresolved');
  refused(f.api.reserve(f.input(token, { command: 'fresh-request', request: { owner: 'part-eight', name: 'EffectRequest', id: 'new-key' }, semanticMessage: 'new-message' })), 'unresolved');
});

it('P6-NF-15 P6-NF-19 reservation needs a durable recovery wake and fits the actual finite budget', () => {
  const f = transportFixture(), token = value(f.api.acquire('a', '', 500));
  refused(f.api.reserve(f.input(token)), 'recovery wake');
  value(f.api.schedule('schedule', token, f.run, f.policy));
  refused(f.api.reserve(f.input(token, { charge: 101 })), 'bound exhausted');
  expect(value(f.api.reserve(f.input(token, { charge: 100 }))).charge).toBe(100);
  refused(f.api.schedule('different-run', token, { ...f.run, id: 'run:2' }, f.policy), 'one run');
});

it('P6-NF-02 P6-NF-17 six-owned closed schemas and finite policies refuse open, zero-delay and missing bounds', () => {
  const f = transportFixture();
  expect(Object.keys(transportShapes)).toEqual(['Lease', 'FenceToken', 'LoopPolicy', 'AdmissionReservation', 'LoopRecord', 'RecoveryRecord']);
  for (const change of [{ minDelay: 0 }, { maxAttempts: -1 }, { maxAttempts: Infinity }, { failDirection: 'open' }, { unexpected: true }])
    refused(decodeLoopPolicy({ ...f.policy, ...change }, f.c));
  expect(value(decodeLoopPolicy({ ...f.policy, maxAttempts: 0, maxDuration: 0 }, f.c)).maxAttempts).toBe(0);
});

it('P6-NF-25 P6-NF-27 P6-NF-35 P6-NF-40 Telegram carries five identity unchanged and calls eight, not a network sender', () => {
  const f = transportFixture(), { token, reservation } = f.prepared();
  const claim = value(f.api.claim('claim', token, reservation.operation));
  const message = Object.freeze({ semanticId: 'message:five-owned', opaqueFiveField: 'unchanged' });
  let sends = 0;
  const adapter = telegramReferenceAdapter<typeof message>({ owner: 'part-eight', send: input => {
    expect(input.message).toBe(message); expect(input.reservation.deliveryAttempt).not.toBe(message.semanticId);
    return f.result(() => { value(f.api.consume(input.claim, input.fence)); sends++; return 'receipt'; });
  } });
  value(adapter.dispatch(message, reservation, claim, token));
  refused(adapter.dispatch(message, reservation, claim, token)); expect(sends).toBe(1);
});
