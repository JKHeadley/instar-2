import { expect, it } from 'vitest';
import { createTransportAuthority, decodeLoopPolicy } from '../../src/transport/index.js';
import type { ObservationPort } from '../../src/transport/index.js';
import { transportFixture, value, refused } from './fixture.js';

it('P6-NF-17 P6-NF-18 P6-NF-21 R2 duration zero/before/exact/after ceilings gate actual observer calls and credits', () => {
  for (const maxDuration of [0, 9, 10, 11, 100]) {
    const f = transportFixture(), token = value(f.api.acquire('lease', '', 500));
    value(f.api.schedule('schedule', token, f.run, value(decodeLoopPolicy({ ...f.policy, maxDuration }, f.c))));
    const op = value(f.api.reserve(f.input(token))); value(f.api.claim('claim', token, op.operation));
    f.advance(10); let calls = 0;
    const result = value(f.api.recover('recover', token, op.operation, { owner: 'part-eight', observe: () => f.result(() => {
      calls++; return { owner: 'part-eight' as const, name: 'OperationObservation' as const, id: 'observed-original' };
    }) }));
    const allowed = maxDuration > 10;
    expect(calls).toBe(allowed ? 1 : 0);
    expect(result.disposition).toBe(allowed ? 'waiting' : 'stopped-at-bound');
    const records = value(f.api.inspect()).map(r => r.record);
    expect(records.filter(r => r.type === 'LoopRecord').at(-1)?.attempts).toBe(allowed ? 1 : 0);
    expect(records.filter(r => r.type === 'AdmissionReservation').at(-1)).toMatchObject({ operation: op.operation, charge: 20, state: 'dispatch-claimed' });
    if (!allowed) {
      const resumed = transportFixture(f.directory, 'worker:2', 'authority:2');
      const next = value(resumed.api.acquire('takeover', resumed.head(), 500));
      refused(resumed.api.recover('reset', next, op.operation, { owner: 'part-eight', observe: () => { throw new Error('must not observe'); } }), 'stopped');
    }
  }
});

it('P6-NF-10 P6-NF-17 R2 restored-clock allowance is an explicit one-shot state, not ordinary expired permission', () => {
  const f = transportFixture(), { token, reservation } = f.prepared(); value(f.api.claim('claim', token, reservation.operation));
  const restart = transportFixture(f.directory, 'worker:2', 'authority:2');
  const next = value(restart.api.acquire('takeover', restart.head(), 500));
  let calls = 0;
  const observer: ObservationPort = { owner: 'part-eight', observe: () => restart.result(() => {
    calls++; return { owner: 'part-eight' as const, name: 'OperationObservation' as const, id: 'lookup' };
  }) };
  expect(value(restart.api.recover('restore', next, reservation.operation, observer)).disposition).toBe('stopped-at-bound');
  expect(value(restart.api.inspect()).map(r => r.record).filter(r => r.type === 'LoopRecord').at(-1)).toMatchObject({ state: 'restoring', attempts: 1 });
  refused(restart.api.recover('again', next, reservation.operation, observer), 'stopped');
  expect(calls).toBe(1);
});

it('P6-NF-18 P6-NF-20 R3 due re-entry across same/recreated/reopened issuers never overlaps active observation', () => {
  const f = transportFixture(), { token, reservation } = f.prepared(); value(f.api.claim('claim', token, reservation.operation));
  f.advance(10); let active = 0, maxActive = 0, calls = 0;
  const observer: ObservationPort = { owner: 'part-eight', observe: () => f.result(() => {
    active++; calls++; maxActive = Math.max(maxActive, active);
    if (calls === 1) {
      f.advance(10); // Now genuinely due, while the first call is still on-stack.
      refused(f.api.recover('nested', token, reservation.operation, observer), 'already active');
      const second = createTransportAuthority(f.host, f.spine, f.c);
      refused(second.recover('other-issuer', token, reservation.operation, observer), 'already active');
      const reopened = transportFixture(f.directory); reopened.time(120);
      refused(reopened.api.recover('reopened', token, reservation.operation, observer), 'already active');
      const running = value(f.api.inspect()).map(r => r.record).filter(r => r.type === 'LoopRecord').at(-1)!;
      refused(f.spine.append({ ...running, command: 'bypass:wake', predecessor: f.head(), tick: 120,
        attempts: 2, state: 'running', nextWake: 130 }, [f.head()]), 'already active');
      // An unrelated valid write cannot make the outer observation lose its result.
      value(f.api.admitWrite('while-observing', token));
    }
    active--; return { owner: 'part-eight' as const, name: 'OperationObservation' as const, id: `observation:${calls}` };
  }) };
  const first = value(f.api.recover('first', token, reservation.operation, observer));
  expect(first.observation).toBe('observation:1'); expect(calls).toBe(1); expect(maxActive).toBe(1);
  // Once the first completion is durable, the already-due neighbor can proceed.
  expect(value(f.api.recover('second', token, reservation.operation, observer)).observation).toBe('observation:2');
  expect(calls).toBe(2); expect(maxActive).toBe(1);
  expect(value(f.api.inspect()).map(r => r.record).filter(r => r.type === 'RecoveryRecord').map(r => r.observation)).toEqual(['observation:1', 'observation:2']);
});

it('P6-NF-11 P6-NF-20 R3 lost completion write retains active reservation across restart instead of starting another observer', () => {
  const f = transportFixture(), { token, reservation } = f.prepared(); value(f.api.claim('claim', token, reservation.operation));
  const api = createTransportAuthority(f.host, { ...f.spine, append: (record, required) => record.type === 'RecoveryRecord'
    ? f.result(() => { throw new Error('completion write unavailable'); }) : f.spine.append(record, required) }, f.c);
  f.advance(10); let calls = 0;
  const observer: ObservationPort = { owner: 'part-eight', observe: () => f.result(() => {
    calls++; return { owner: 'part-eight' as const, name: 'OperationObservation' as const, id: 'eight-retains-observation' };
  }) };
  refused(api.recover('first', token, reservation.operation, observer), 'completion write unavailable');
  const restarted = transportFixture(f.directory, 'worker:2', 'authority:2');
  const next = value(restarted.api.acquire('takeover', restarted.head(), 500)); restarted.advance(20);
  refused(restarted.api.recover('after-restart', next, reservation.operation, observer), 'already active');
  expect(calls).toBe(1);
  expect(value(restarted.api.inspect()).map(r => r.record).filter(r => r.type === 'LoopRecord').at(-1)).toMatchObject({ state: 'running', attempts: 1 });
});

it('P6-NF-02 P6-NF-35 R4 approved eight record succeeds; invented name and wrong owner refuse', () => {
  for (const [owner, name] of [['part-eight', 'OperationObservation'], ['part-eight', 'EffectObservation'], ['part-five', 'OperationObservation']]) {
    const f = transportFixture(), { token, reservation } = f.prepared(); value(f.api.claim('claim', token, reservation.operation));
    f.advance(10); let calls = 0;
    const result = f.api.recover('observe', token, reservation.operation, { owner: 'part-eight', observe: () => f.result(() => {
      calls++; return { owner, name, id: 'actual-owner-record' };
    }) } as unknown as ObservationPort);
    if (owner === 'part-eight' && name === 'OperationObservation') expect(value(result).observation).toBe('actual-owner-record');
    else refused(result, 'observation reference owner');
    expect(calls).toBe(1);
  }
});
