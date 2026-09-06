import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { decodeEnvelope, decodeHistoricalBody } from '../../src/facts/index.js';
import type { Lease } from '../../src/transport/index.js';
import { transportFixture, value, refused } from './fixture.js';

it('P6-NF-05 P6-NF-06 R1 genuine foreign signatures cannot renew authority through replication or replay', () => {
  for (const [actor, machine] of [['bob', 'machine-b'], ['bob', 'machine-a'], ['alice', 'machine-b']] as const) {
    const f = transportFixture(), token = value(f.api.acquire('lease', '', 50));
    const first = value(f.api.inspect())[0]!;
    const principal = f[actor];
    const sameMachine = machine === 'machine-a';
    const renewal = { ...first.record, operation: 'renew', term: 1000, expires: 1100,
      command: 'foreign-renew', predecessor: first.fact.id };
    const wire = f.wire({ kind: 'transport-Lease', machine, principal, provenance: principal.provenance,
      segment: { machine, epoch: 0, position: sameMachine ? 1 : 0 },
      prevInSegment: sameMachine ? first.fact.contentHash : f.ctx.genesis.hash,
      predecessors: { inSegment: sameMachine ? first.fact.id : null, frontier: {}, required: [first.fact.id] }, body: { record: renewal } });
    // Cryptographically valid frame; the rejection must be transport authority,
    // not a corrupt signature, mismatched chain or counterfeit principal.
    const context = { ...f.ctx, facts: [first.fact] };
    const frame = value(decodeEnvelope(wire, context, 'replication'));
    refused(decodeHistoricalBody(frame, context, context.decode), 'issuer is not this authority');
    refused(f.store.append(wire), 'issuer is not this authority');
    refused(f.store.append(wire, { peer: machine }), 'issuer is not this authority');
    expect(value(f.api.inspect())).toHaveLength(1);
    f.time(149); value(f.api.admitWrite('before-expiry', token));
    f.time(151); refused(f.api.admitWrite('after-original-expiry', token), 'expired');
    const reopened = transportFixture(f.directory); reopened.time(151);
    refused(reopened.api.admitWrite('after-rebuild', token), 'expired');

    // A fresh receiver verifies the owner even when bytes already exist on disk
    // (e.g. an older receiver admitted them). No current incarnation shortcut.
    const receiver = transportFixture();
    value(receiver.store.append(first.fact, { peer: 'machine-a' }));
    value(receiver.storage.append(value(canonical(wire)).bytes, first.fact.contentHash));
    refused(receiver.spine.append({ ...first.record, operation: 'renew', term: 100, expires: 200,
      command: 'launder-foreign-parent', predecessor: frame.id } as Lease, [frame.id]), 'issuer is not this authority');
    const restored = transportFixture(receiver.directory);
    refused(restored.api.inspect());
    refused(restored.api.acquire('must-not-enable', '', 500));
  }
});

it('P6-NF-04 P6-NF-05 R1 legitimate signed renewal and old incarnations survive receiver rebuild/takeover', () => {
  const f = transportFixture(), token = value(f.api.acquire('lease', '', 50));
  value(f.api.renew('renew', token, 1000));
  const receiver = transportFixture();
  for (const fact of value(f.store.read())) value(receiver.store.append(fact, { peer: 'machine-a' }));
  receiver.time(151); expect(value(receiver.api.admitWrite('valid-extension', token)).expires).toBe(1100);
  const takeover = transportFixture(receiver.directory, 'worker:2', 'authority:2');
  const next = value(takeover.api.acquire('takeover', takeover.head(), 500));
  expect(next.epoch).toBe(2);
  expect(value(takeover.api.inspect())[0]!.record).toMatchObject({ incarnation: 'worker:1', authority: 'authority:1' });
  value(takeover.api.admitWrite('new-owner', next));
});
