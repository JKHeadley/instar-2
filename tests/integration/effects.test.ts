import { expect, it } from 'vitest';
import { authorAndAppend } from '../../src/facts/index.js';
import { consumeEffectSettlement, createEffectDoorway } from '../../src/effects/index.js';
import { effectFixture, value, refused } from '../effects/fixture.js';
import { json, privateKey } from '../facts/fixtures.js';

for (const missing of ['note', 'effect-OperationDefinition', 'effect-EffectRequest', 'effect-EffectValidation', 'transport-AdmissionReservation']) {
  it(`P8-NF-25 P8-NF-26 exact closure matrix refuses missing ${missing} peer acknowledgement`, () => {
    const f = effectFixture(), q = f.prepare();
    const api = createEffectDoorway({ ...f.composition, durability: { owner: 'part-ten', ensure: facts => {
      const receipts = value(f.composition.durability.ensure(facts));
      return f.success(receipts.map(r => r.fact.kind === missing ? { ...r, durability: { kind: 'local-durable' as const } } : r));
    } } });
    refused(api.dispatch(q, f.fence), 'replicated demand'); expect(f.calls()).toBe(0);
  });
}

for (const mutation of ['duplicate-peer', 'wrong-hash', 'absent-receipt']) {
  it(`P8-NF-26 bad durability witness ${mutation} never reaches adapter`, () => {
    const f = effectFixture(), q = f.prepare();
    const api = createEffectDoorway({ ...f.composition, durability: { owner: 'part-ten', ensure: facts => {
      const receipts = value(f.composition.durability.ensure(facts));
      return f.success(mutation === 'absent-receipt' ? [] : receipts.map(r => mutation === 'duplicate-peer'
        ? { ...r, durability: { kind: 'replicated' as const, n: 2, peers: ['same-peer', 'same-peer'] } }
        : { ...r, fact: { ...r.fact, contentHash: `sha256:${'0'.repeat(64)}` as const } }));
    } } });
    refused(api.dispatch(q, f.fence)); expect(f.calls()).toBe(0);
  });
}

it('P8-NF-04 P8-NF-21 P8-NF-23 direct signed P2 append cannot mint an unassessed settlement', () => {
  const f = effectFixture(), q = f.prepare(), observation = value(f.api.dispatch(q, f.fence));
  f.assess('happened', 0); const genuine = value(f.api.settle(observation.operation));
  const fake = { ...genuine, id: 'forged-settlement', finalCharge: '0' };
  refused(authorAndAppend({ kind: 'effect-EffectSettlement', schemaVersion: 1, machine: f.host.machine,
    principal: json(f.host.principal), provenance: json(f.host.principal.provenance), at: json(f.now),
    body: { record: json(fake) }, required: [] }, f.ctx, f.store, privateKey), 'eight-owned evidence admission');
  expect(value(f.api.inspect()).filter(r => r.record.type === 'EffectSettlement')).toHaveLength(1);
});

it('P8-NF-14 P8-NF-31 P8-NF-35 reentrant delivery through a second doorway cannot invoke twice', () => {
  const f = effectFixture(), q = f.prepare(), second = createEffectDoorway(f.composition);
  f.onInvoke(() => {
    expect(value(second.dispatch(q, f.fence)).stage).toBe('executor-accepted');
  });
  expect(value(f.api.dispatch(q, f.fence)).stage).toBe('response'); expect(f.calls()).toBe(1);
});

it('P8-NF-03 P8-NF-05 P8-NF-16 pending definition and adapter target mismatch cannot activate a call', () => {
  const f = effectFixture(), q = f.prepare();
  const wrong = createEffectDoorway({ ...f.composition, adapter: { ...f.composition.adapter,
    describe: () => ({ ...f.composition.adapter.describe(), conversation: 'other-chat' }) } });
  refused(wrong.dispatch(q, f.fence), 'target mismatch'); expect(f.calls()).toBe(0);
  f.versions([]); refused(f.api.dispatch(q, f.fence), 'approved current version'); expect(f.calls()).toBe(0);
});

it('P8-NF-19 P8-NF-21 settlement consumer refuses copied history and rechecks genuine issuance', () => {
  const f = effectFixture(), q = f.prepare(), o = value(f.api.dispatch(q, f.fence));
  const s = value(f.api.settle(o.operation)); let consumers = 0;
  refused(consumeEffectSettlement(JSON.parse(JSON.stringify(s)) as typeof s, f.host.boundary, () => { consumers++; }), 'live eight-owned');
  expect(value(consumeEffectSettlement(s, f.host.boundary, current => { consumers++; return current.id; }))).toBe(s.id);
  expect(consumers).toBe(1);
}, 15000);

it('P8-NF-20 P8-NF-24 P8-NF-35 P8-NF-37 read-only lookup needs one durable six wake and cannot run again after completion', () => {
  const f = effectFixture(), q = f.prepare(), o = value(f.api.dispatch(q, f.fence));
  refused(f.api.observe(o.operation), 'active observation wake'); expect(f.queries()).toBe(0);
  f.time(110); value(f.transport.recover('read', f.fence, o.operation, f.api));
  expect(f.queries()).toBe(1); expect(f.calls()).toBe(1);
  refused(f.api.observe(o.operation), 'already completed'); expect(f.queries()).toBe(1);
}, 15000);
