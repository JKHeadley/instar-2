import { afterEach, expect, it } from 'vitest';
import { pair, outbound } from './pair-fixture.js';
import { providerFixture } from '../model-provider/fixture.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { transportFixture } from './fixture.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import type { EffectRequest } from '../../src/effects/index.js';
import type { Lease, TransportFact } from '../../src/transport/index.js';
import { createTransportAuthority, invokeConsumedDispatch } from '../../src/transport/index.js';
import { value, refused } from '../facts/fixtures.js';

afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });

it('review: a parent cap breach during post-consume durability inhibits the physical reply', async () => {
  const s = await pair();
  value(s.admit());
  let breached = false;
  const original = s.f.dependencies.durability;
  const durability = { ...original, ensure: (facts: any) => {
    const receipt = original.ensure(facts);
    if (!breached && facts.some((fact: any) => fact.kind === 'transport-AdmissionReservation'
      && fact.body.record.run === s.reply.id && fact.body.record.state === 'consumed')) {
      breached = true;
      s.f.time(101);
      s.f.evidence(s.settlement.operation, s.subject.submitted.operationDigest, 'charge-settled', 21);
      const assessment = value(s.api.assessResponse(s.settlement.operation));
      const settlement = value(s.api.settle(s.settlement.operation, assessment));
      expect(value(s.f.six.settle(s.f.fence, settlement))).toMatchObject({ capViolation: 1 });
    }
    return receipt;
  } };
  const send = outbound({ ...s, f: { ...s.f, dependencies: { ...s.f.dependencies, durability } } });
  const request = value(send.prepare());
  refused(send.api.dispatch(request, s.f.fence), 'parent cap violation');
  expect(breached).toBe(true);
  expect(send.calls()).toBe(0);
  retained(s, send, request);
}, 60_000);

function retained(s: Awaited<ReturnType<typeof pair>>, send: ReturnType<typeof outbound>,
  request: EffectRequest) {
  const rows = value<readonly TransportFact[]>(s.f.six.inspect());
  const reply = rows.filter(row => row.record.type === 'AdmissionReservation' && row.record.run === s.reply.id);
  expect(reply.map(row => row.record.type === 'AdmissionReservation' && row.record.state))
    .toEqual(['prepared', 'dispatch-claimed', 'consumed']);
  expect(reply.at(-1)?.record).toMatchObject({ charge: 20, state: 'consumed' });
  expect(rows.filter(row => row.record.type === 'SettlementApplication'
    && row.record.operation === (reply.at(-1)?.record as any).operation)).toHaveLength(0);
  expect(value<{ pending: readonly unknown[] }>(s.f.graph.read(s.f.id)).pending.length).toBeGreaterThan(0);
  expect(s.accounting).toMatchObject({ unresolved: 1, exposure: 20, released: 0, actualCharge: -1 });
  const accounting = rows.filter(row => row.record.type === 'SettlementApplication'
    && row.record.operation === s.settlement.operation).at(-1)?.record;
  expect(accounting?.type === 'SettlementApplication' && accounting.exposure).toBeGreaterThanOrEqual(20);
  expect(accounting).toMatchObject({ released: 0 });
  // Retry is observation-only even after the one-use claim was consumed but refused.
  send.api.dispatch(request, s.f.fence);
  expect(send.calls()).toBe(0);
  const reopened = providerFixture({ directory: s.f.directory });
  const retry = outbound({ ...s, f: reopened });
  retry.api.dispatch(request, reopened.fence);
  expect(retry.calls()).toBe(0);
  const operation = (reply.at(-1)?.record as any).operation;
  refused(reopened.six.claim('late-refusal:remint', reopened.fence, operation));
  refused(reopened.six.close('late-refusal:release', reopened.fence, operation));
  expect(value(reopened.six.inspect()).filter(row => row.record.type === 'AdmissionReservation'
    && row.record.run === s.reply.id)).toHaveLength(3);
}

it.each(['parent recovery stop', 'parent Run stop', 'fence release', 'Six standing'] as const)(
  'SIX-PAIR %s during post-consume durability inhibits physical invocation and retains consumed exposure', async cause => {
    const s = await pair(); value(s.admit());
    let changed = false;
    const original = s.f.dependencies.durability;
    const durability = { ...original, ensure: (facts: readonly FactEnvelope[]) => {
      const receipt = original.ensure(facts);
      if (!changed && facts.some(fact => fact.kind === 'transport-AdmissionReservation'
        && (fact.body as any).record.run === s.reply.id && (fact.body as any).record.state === 'consumed')) {
        changed = true;
        if (cause === 'parent recovery stop') {
          const observer = { owner: 'part-eight' as const, observe: () => s.f.result(() => (
            { owner: 'part-eight', name: 'OperationObservation', id: 'parent-observation' })) };
          s.f.time(102); value(s.f.six.recover('late-parent:1', s.f.fence, s.settlement.operation, observer));
          s.f.time(104); value(s.f.six.recover('late-parent:2', s.f.fence, s.settlement.operation, observer));
          expect(value<readonly TransportFact[]>(s.f.six.inspect()).filter(row => row.record.type === 'LoopRecord'
            && row.record.run === s.f.id).at(-1)?.record).toMatchObject({ state: 'stopped' });
        } else if (cause === 'parent Run stop') {
          const ref = { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: s.f.opening.id };
          // Same real Five owner; only the physical control-verification port is a fixture.
          const graph = value(createRunGraph({ ...s.f.deps,
            control: { owner: 'part-four', verify: () => s.f.success(ref) } }));
          const parent = value(graph.read(s.f.id));
          const stopped = value(graph.transition({ type: 'RunTransition', schemaVersion: 1, id: 'late-parent-stop',
            run: s.f.id, expected: parent.head, trigger: ref, kind: 'stop', from: parent.state, to: 'halted',
            responsible: s.f.owner, standing: ref, ownership: s.f.lease, generation: s.f.run.generation,
            at: s.f.clock(100), blockedOn: { kind: 'stop', reference: 'operator-stop', owner: s.f.owner,
              nextObservation: s.f.clock(1000) }, nextWake: s.f.run.nextWake }));
          expect(stopped.state).toBe('halted');
          expect(stopped.pending.length).toBeGreaterThan(0);
        } else if (cause === 'fence release') {
          expect(value<Lease>(s.f.six.release('late-release', s.f.fence)).state).toBe('released');
        } else {
          const current = s.f.th.current;
          Object.assign(s.f.th, { current: () => { const state = current();
            return { ...state, decode: { ...state.decode, grants: [] } }; } });
        }
      }
      return receipt;
    } };
    // Isolate Six standing from Eight's independently current effect standing.
    const effectCurrent = s.f.host.current();
    const host = cause === 'Six standing' ? { ...s.f.host, current: () => effectCurrent } : s.f.host;
    const send = outbound({ ...s, f: { ...s.f, host, dependencies: { ...s.f.dependencies, durability } } });
    const request = value(send.prepare());
    refused(send.api.dispatch(request, s.f.fence), cause === 'parent recovery stop' ? 'parent stop'
      : cause === 'parent Run stop' ? 'parent predecessor' : cause === 'fence release' ? 'released' : 'standing');
    expect(changed).toBe(true); expect(send.calls()).toBe(0);
    if (cause === 'parent Run stop') {
      // Reuse needs no Five control re-verification: Eight only observes the consumed claim.
      send.api.dispatch(request, s.f.fence);
      expect(send.calls()).toBe(0);
      expect(value<readonly TransportFact[]>(s.f.six.inspect()).filter(row => row.record.type === 'AdmissionReservation'
        && row.record.run === s.reply.id).at(-1)?.record).toMatchObject({ state: 'consumed', charge: 20 });
    } else retained(s, send, request);
  }, 60_000);

it('Six burns a refused final invocation and rejects copied authority/claim even when standing returns', () => {
  const f = transportFixture(), { token, reservation } = f.prepared();
  const claim = value(f.api.claim('guard:claim', token, reservation.operation));
  value(f.api.consume(claim, token));
  let calls = 0;
  const invoke = () => ++calls;
  refused(invokeConsumedDispatch({ ...f.api }, claim, token, f.c, invoke), 'genuine Six');
  refused(invokeConsumedDispatch(f.api, { ...claim }, token, f.c, invoke), 'claim absent');
  const current = f.host.current;
  Object.assign(f.host, { current: () => { const state = current();
    return { ...state, decode: { ...state.decode, grants: [] } }; } });
  refused(invokeConsumedDispatch(f.api, claim, token, f.c, invoke), 'standing');
  Object.assign(f.host, { current });
  refused(invokeConsumedDispatch(f.api, claim, token, f.c, invoke), 'already attempted');
  refused(f.api.claim('guard:remint', token, reservation.operation), 'claim already issued');
  expect(calls).toBe(0);
  expect(value(f.api.inspect()).at(-1)?.record).toMatchObject({ state: 'consumed', charge: 20 });
});

it('Six cannot invoke a consumed row whose append acknowledgment was lost', () => {
  const f = transportFixture(), { token, reservation } = f.prepared();
  const authority = createTransportAuthority(f.host, { ...f.spine, append: (record, required) => {
    const receipt = f.spine.append(record, required);
    if (record.type === 'AdmissionReservation' && record.state === 'consumed')
      return f.result(() => { throw Error('lost consumed acknowledgment'); });
    return receipt;
  } }, f.c);
  const claim = value(authority.claim('lost-ack:claim', token, reservation.operation));
  refused(authority.consume(claim, token), 'lost consumed acknowledgment');
  let calls = 0;
  refused(invokeConsumedDispatch(authority, claim, token, f.c, () => ++calls), 'claim absent');
  refused(authority.consume(claim, token), 'already consumed');
  expect(calls).toBe(0);
  expect(value(authority.inspect()).at(-1)?.record).toMatchObject({ state: 'consumed', charge: 20 });
});
