import { afterEach, expect, it } from 'vitest';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { authorAndAppend } from '../../src/facts/index.js';
import { consumeOutcome, decode, readEvidence } from '../../src/index.js';
import { consumeEffectSettlement, createEffectDoorway } from '../../src/effects/index.js';
import { effectFixture, value, refused } from '../effects/fixture.js';
import { json, privateKey } from '../facts/fixtures.js';

// Let the runner flush IPC between synchronous signed-prefix workloads.
// This does not yield inside any tested atomic/reentrant handoff.
afterEach(async () => { await new Promise<void>(done => setImmediate(done)); });

for (const loss of ['both-missing', 'peer-missing', 'peer-corrupt'] as const) {
  it(`P8-NF-23 P8-NF-25 P8-NF-27 P8-NF-30 P8-NF-39 current physical custody refuses ${loss} and permits restoration`, () => {
    const f = effectFixture(), q = f.prepare(), o = value(f.api.dispatch(q, f.fence));
    f.assess('happened', 0);
    const s = value(f.api.settle(o.operation)); let consumers = 0;
    const paths = (loss === 'both-missing' ? ['origin-captures', 'peer-captures'] : ['peer-captures'])
      .map(dir => join(f.directory, dir, `${o.capture.hash.slice(7)}.capture`));
    const originals = paths.map(path => readFileSync(path, 'utf8'));
    paths.forEach(path => loss === 'peer-corrupt' ? writeFileSync(path, 'changed receipt') : renameSync(path, `${path}.withheld`));
    refused(consumeEffectSettlement(s, f.host.boundary, () => { consumers++; }));
    refused(f.api.settle(o.operation)); expect(consumers).toBe(0); expect(f.calls()).toBe(1);
    if (loss === 'both-missing') {
      expect(f.ctx.captures[o.capture.reference]!.status).toBe('missing');
      expect(value(f.store.readForProjection()).entries.some(e => e.taint.includes('evidence-unavailable'))).toBe(true);
    }
    paths.forEach((path, i) => loss === 'peer-corrupt' ? writeFileSync(path, originals[i]!) : renameSync(`${path}.withheld`, path));
    expect(value(consumeEffectSettlement(s, f.host.boundary, current => { consumers++; return current.id; }))).toBe(s.id);
    expect(consumers).toBe(1);
    expect(value(f.api.inspect()).filter(r => r.record.type === 'EffectSettlement')).toHaveLength(1);
    const latest = value(f.transport.inspect()).filter(r => r.record.type === 'AdmissionReservation').at(-1)!.record;
    expect(latest).toMatchObject({ state: 'consumed', charge: 20 });
  }, 30000);
}

it('P8-NF-25 P8-NF-27 approved local custody does not silently require or infer a peer policy', () => {
  const f = effectFixture(undefined, undefined, { durability: 'local-durable', replicas: 0 });
  const q = f.prepare(), o = value(f.api.dispatch(q, f.fence));
  const peer = join(f.directory, 'peer-captures', `${o.capture.hash.slice(7)}.capture`);
  renameSync(peer, `${peer}.withheld`);
  const s = value(f.api.settle(o.operation));
  expect(value(consumeEffectSettlement(s, f.host.boundary, current => current.id))).toBe(s.id);
}, 30000);

for (const wait of [1, 2]) for (const at of [199, 200, 201]) {
  it(`P8-NF-19 P8-NF-21 P8-NF-23 consumption checks evidence at ${at} after durability wait ${wait}`, () => {
    const f = effectFixture(), q = f.prepare(), o = value(f.api.dispatch(q, f.fence));
    f.assess('happened', 0);
    let armed = false, waits = 0, consumers = 0;
    const api = createEffectDoorway({ ...f.composition, durability: { owner: 'part-ten', ensure: facts => {
      const result = f.composition.durability.ensure(facts);
      if (armed && ++waits === wait) f.time(at);
      return result;
    } } });
    const s = value(api.settle(o.operation)); armed = true;
    const result = consumeEffectSettlement(s, f.host.boundary, current => { consumers++; return current.id; });
    const ids = consumeOutcome(s.outcome, { happened: e => e, 'did-not-happen': e => e, uncertain: e => e });
    const evidence = value(decode('Evidence', f.evidence.find(e => e.id === ids[0]), f.host.current().decode));
    const independentRead = readEvidence(evidence, f.host.current().clock, f.host.boundary.preserved);
    expect(waits).toBe(wait === 1 && at > 200 ? 1 : 2);
    if (at <= 200) {
      expect(value(result)).toBe(s.id); value(independentRead); expect(consumers).toBe(1);
    } else {
      refused(result, 'expired'); refused(independentRead, 'expired'); expect(consumers).toBe(0);
    }
    expect(value(f.api.inspect()).filter(r => r.record.type === 'EffectSettlement')).toHaveLength(1);
    expect(value(f.transport.inspect()).filter(r => r.record.type === 'AdmissionReservation').at(-1)!.record)
      .toMatchObject({ state: 'consumed', charge: 20 });
    expect(f.calls()).toBe(1);
  }, 30000);
}

for (const wait of [1, 2]) {
  it(`P8-NF-21 P8-NF-23 new issuance refuses expiry during durability wait ${wait} without losing history`, () => {
    const f = effectFixture(), q = f.prepare(), o = value(f.api.dispatch(q, f.fence));
    f.assess('happened', 0); let waits = 0;
    const api = createEffectDoorway({ ...f.composition, durability: { owner: 'part-ten', ensure: facts => {
      const result = f.composition.durability.ensure(facts);
      if (++waits === wait) f.time(250);
      return result;
    } } });
    refused(api.settle(o.operation), 'expired');
    expect(value(f.api.inspect()).filter(r => r.record.type === 'EffectSettlement')).toHaveLength(wait === 1 ? 0 : 1);
    expect(f.calls()).toBe(1);
  }, 30000);
  it(`P8-NF-23 P8-NF-27 new issuance refuses peer receipt loss during durability wait ${wait}`, () => {
    const f = effectFixture(), q = f.prepare(), o = value(f.api.dispatch(q, f.fence));
    f.assess('happened', 0); let waits = 0;
    const path = join(f.directory, 'peer-captures', `${o.capture.hash.slice(7)}.capture`);
    const api = createEffectDoorway({ ...f.composition, durability: { owner: 'part-ten', ensure: facts => {
      const result = f.composition.durability.ensure(facts);
      if (++waits === wait) renameSync(path, `${path}.withheld`);
      return result;
    } } });
    refused(api.settle(o.operation), 'custody');
    expect(value(f.api.inspect()).filter(r => r.record.type === 'EffectSettlement')).toHaveLength(wait === 1 ? 0 : 1);
    renameSync(`${path}.withheld`, path);
    const s = value(f.api.settle(o.operation));
    expect(value(consumeEffectSettlement(s, f.host.boundary, current => current.id))).toBe(s.id);
    expect(f.calls()).toBe(1);
  }, 30000);
}

for (const change of ['assessment', 'evidence', 'custody']) {
  it(`P8-NF-19 P8-NF-23 P8-NF-27 final consumer wait invalidates changed ${change}`, () => {
    const f = effectFixture(), q = f.prepare(), o = value(f.api.dispatch(q, f.fence));
    f.assess('happened', 0); let armed = false, waits = 0, consumers = 0;
    const api = createEffectDoorway({ ...f.composition, durability: { owner: 'part-ten', ensure: facts => {
      const result = f.composition.durability.ensure(facts);
      if (armed && ++waits === 2) {
        if (change === 'assessment') f.assess('happened', 1);
        else if (change === 'evidence') {
          const i = f.evidence.findIndex(e => e.id.startsWith('assessment:'));
          f.evidence[i] = value(decode('Evidence', { ...f.evidence[i], freshFor: 150 }, f.host.current().decode));
        } else {
          const path = join(f.directory, 'peer-captures', `${o.capture.hash.slice(7)}.capture`);
          renameSync(path, `${path}.withheld`);
        }
      }
      return result;
    } } });
    const s = value(api.settle(o.operation)); armed = true;
    refused(consumeEffectSettlement(s, f.host.boundary, () => { consumers++; }), change === 'custody' ? 'custody' : `${change} changed`);
    expect(consumers).toBe(0); expect(waits).toBe(2); expect(f.calls()).toBe(1);
  }, 30000);
}

for (const missing of ['note', 'effect-OperationDefinition', 'effect-EffectRequest', 'effect-EffectValidation', 'transport-AdmissionReservation']) {
  it(`P8-NF-25 P8-NF-26 exact closure matrix refuses missing ${missing} peer acknowledgement`, () => {
    const f = effectFixture(), q = f.prepare();
    const api = createEffectDoorway({ ...f.composition, durability: { owner: 'part-ten', ensure: facts => {
      const receipts = value(f.composition.durability.ensure(facts));
      return f.success(receipts.map(r => r.fact.kind === missing ? { ...r, durability: { kind: 'local-durable' as const } } : r));
    } } });
    refused(api.dispatch(q, f.fence), 'replicated demand'); expect(f.calls()).toBe(0);
  }, 30000);
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
  }, 30000);
}

it('P8-NF-04 P8-NF-21 P8-NF-23 direct signed P2 append cannot mint an unassessed settlement', () => {
  const f = effectFixture(), q = f.prepare(), observation = value(f.api.dispatch(q, f.fence));
  f.assess('happened', 0); const genuine = value(f.api.settle(observation.operation));
  const fake = { ...genuine, id: 'forged-settlement', finalCharge: '0' };
  refused(authorAndAppend({ kind: 'effect-EffectSettlement', schemaVersion: 1, machine: f.host.machine,
    principal: json(f.host.principal), provenance: json(f.host.principal.provenance), at: json(f.now),
    body: { record: json(fake) }, required: [] }, f.ctx, f.store, privateKey), 'eight-owned evidence admission');
  expect(value(f.api.inspect()).filter(r => r.record.type === 'EffectSettlement')).toHaveLength(1);
}, 30000);

it('P8-NF-14 P8-NF-31 P8-NF-35 reentrant delivery through a second doorway cannot invoke twice', () => {
  const f = effectFixture(), q = f.prepare(), second = createEffectDoorway(f.composition);
  f.onInvoke(() => {
    expect(value(second.dispatch(q, f.fence)).stage).toBe('executor-accepted');
  });
  expect(value(f.api.dispatch(q, f.fence)).stage).toBe('response'); expect(f.calls()).toBe(1);
}, 30000);

it('P8-NF-03 P8-NF-05 P8-NF-16 pending definition and adapter target mismatch cannot activate a call', () => {
  const f = effectFixture(), q = f.prepare();
  const wrong = createEffectDoorway({ ...f.composition, adapter: { ...f.composition.adapter,
    describe: () => ({ ...f.composition.adapter.describe(), conversation: 'other-chat' }) } });
  refused(wrong.dispatch(q, f.fence), 'target mismatch'); expect(f.calls()).toBe(0);
  f.versions([]); refused(f.api.dispatch(q, f.fence), 'approved current version'); expect(f.calls()).toBe(0);
}, 30000);

it('P8-NF-19 P8-NF-21 settlement consumer refuses copied history and rechecks genuine issuance', () => {
  const f = effectFixture(), q = f.prepare(), o = value(f.api.dispatch(q, f.fence));
  const s = value(f.api.settle(o.operation)); let consumers = 0;
  refused(consumeEffectSettlement(JSON.parse(JSON.stringify(s)) as typeof s, f.host.boundary, () => { consumers++; }), 'live eight-owned');
  expect(value(consumeEffectSettlement(s, f.host.boundary, current => { consumers++; return current.id; }))).toBe(s.id);
  expect(consumers).toBe(1);
}, 30000);

it('P8-NF-20 P8-NF-24 P8-NF-35 P8-NF-37 read-only lookup needs one durable six wake and cannot run again after completion', () => {
  const f = effectFixture(), q = f.prepare(), o = value(f.api.dispatch(q, f.fence));
  refused(f.api.observe(o.operation), 'active observation wake'); expect(f.queries()).toBe(0);
  f.time(110); value(f.transport.recover('read', f.fence, o.operation, f.api));
  expect(f.queries()).toBe(1); expect(f.calls()).toBe(1);
  refused(f.api.observe(o.operation), 'already completed'); expect(f.queries()).toBe(1);
}, 30000);

it('P8-NF-01 P8-NF-19 nine reference must use its approved VerificationAssessment name', () => {
  const f = effectFixture(), q = f.prepare(), o = value(f.api.dispatch(q, f.fence));
  const wrong = createEffectDoorway({ ...f.composition, assessment: { ...f.composition.assessment!, assess: () => f.success({
    owner: 'part-nine', name: 'EvidenceAcceptance' as 'VerificationAssessment', id: 'invented-alias',
  }) } });
  refused(wrong.settle(o.operation), 'wrong acceptance owner');
  expect(value(f.api.settle(o.operation)).acceptance.length).toBeGreaterThan(0);
}, 30000);
