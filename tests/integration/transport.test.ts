import { expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createBoundedDueScanPort, createTransportAuthority, createTransportSpine, decodeLoopPolicy } from '../../src/transport/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportFixture, value, refused } from '../transport/fixture.js';

it('P6-NF-20 P6-NF-33 durable scan cursor resumes missed ordered work after restart and refuses absent neighbors', () => {
  const f = transportFixture();
  const firstPort = createBoundedDueScanPort(f.host, f.spine, f.c);
  const request = { scan: 'verification-due', generation: 'due:g1', orderedKeys: ['a', 'b', 'c'] as readonly string[],
    cursor: null, maxItems: 2, maxDuration: 100 };
  const first = value(firstPort.page(request));
  expect(first.selected).toEqual(['a', 'b']);

  const restarted = transportFixture(f.directory, 'worker:2', 'authority:2');
  const resumed = createBoundedDueScanPort(restarted.host, restarted.spine, restarted.c);
  const second = value(resumed.page({ ...request, cursor: first.cursor }));
  expect(second).toMatchObject({ selected: ['c', 'a'], wrapped: true });
  expect(value(restarted.api.inspect()).filter(entry => entry.record.type === 'ScanCursor')).toHaveLength(2);

  const before = value(restarted.api.inspect()).length;
  refused(resumed.page({ ...request, cursor: { owner: 'part-six', name: 'ScanCursor', id: 'absent' } }), 'absent');
  expect(value(restarted.api.inspect())).toHaveLength(before);
});

it('P6-NF-20 P6-NF-33 N2 safe signed generation history reopens and lost-ACK replay is byte-identical', () => {
  const f = transportFixture(), port = createBoundedDueScanPort(f.host, f.spine, f.c);
  const request = { scan: 'verification-due', generation: 'g1', orderedKeys: ['a', 'b', 'c', 'd'] as readonly string[],
    cursor: null, maxItems: 2, maxDuration: 100 };
  const first = value(port.page(request));
  const admitted = value(port.page({ ...request, generation: 'g2', cursor: first.cursor }));
  expect(admitted).toMatchObject({ selected: ['c', 'd'], wrapped: true });
  const before = readFileSync(join(f.directory, 'facts.json'), 'utf8');

  const reopened = transportFixture(f.directory, 'worker:legacy-reopen', 'authority:legacy-reopen');
  expect(value(reopened.store.read())).toHaveLength(2);
  expect(value(reopened.api.inspect()).filter(entry => entry.record.type === 'ScanCursor')).toHaveLength(2);
  const replayed = value(createBoundedDueScanPort(reopened.host, reopened.spine, reopened.c).page({
    ...request, generation: 'g2', cursor: first.cursor,
  }));
  expect(replayed).toEqual(admitted);
  expect(readFileSync(join(f.directory, 'facts.json'), 'utf8')).toBe(before);
});

it('P6-NF-14 P6-NF-15 P6-NF-20 P6-NF-21 durable level wake observes uncertainty without settlement or execution', () => {
  const f = transportFixture(), { token, reservation } = f.prepared();
  value(f.api.claim('claim', token, reservation.operation));
  let observations = 0;
  const observer = { owner: 'part-eight' as const, observe: (operation: string) => f.result(() => {
    expect(operation).toBe(reservation.operation); observations++;
    return { owner: 'part-eight' as const, name: 'OperationObservation' as const, id: 'inconclusive:original-operation' };
  }) };
  refused(f.api.recover('early', token, reservation.operation, observer), 'not due'); expect(observations).toBe(0);
  f.advance(10); const recovered = value(f.api.recover('recover', token, reservation.operation, observer));
  expect(recovered.disposition).toBe('waiting'); expect(observations).toBe(1);
  refused(f.api.recover('competing', token, reservation.operation, observer), 'not due');
  const restarted = transportFixture(f.directory); restarted.advance(20);
  const next = value(restarted.api.recover('resume', token, reservation.operation, observer));
  expect(next.episode).toBe(recovered.episode); expect(observations).toBe(2);
  const records = value(restarted.api.inspect()).map(r => r.record);
  expect(records.filter(r => r.type === 'LoopRecord').at(-1)).toMatchObject({ attempts: 2, state: 'running' });
  expect(records.filter(r => r.type === 'RecoveryRecord').at(-1)).toMatchObject({ disposition: 'waiting' });
  expect(records.filter(r => r.type === 'AdmissionReservation').at(-1)).toMatchObject({ charge: 20, state: 'dispatch-claimed' });
  expect(records.some(r => 'outcome' in r || 'completed' in r || 'settlement' in r)).toBe(false);
  refused(restarted.api.reserve(restarted.input(token, { command: 'new-attempt', attempt: 'attempt:2' })), 'unresolved');
});

it('P6-NF-17 P6-NF-18 P6-NF-19 finite observation credit, zero means zero, and restart cannot reset it', () => {
  for (const limit of [0, 1]) {
    const f = transportFixture(), token = value(f.api.acquire('a', '', 500));
    const policy = value(decodeLoopPolicy({ ...f.policy, maxAttempts: limit }, f.c));
    value(f.api.schedule('schedule', token, f.run, policy));
    const reservation = value(f.api.reserve(f.input(token))); value(f.api.claim('claim', token, reservation.operation));
    let calls = 0;
    const observer = { owner: 'part-eight' as const, observe: () => f.result(() => {
      calls++; return { owner: 'part-eight' as const, name: 'OperationObservation' as const, id: 'unknown' };
    }) };
    f.advance(10); value(f.api.recover('one', token, reservation.operation, observer));
    if (limit) { f.advance(10); expect(value(f.api.recover('two', token, reservation.operation, observer)).disposition).toBe('stopped-at-bound'); }
    expect(calls).toBe(limit);
    const restarted = transportFixture(f.directory); restarted.advance(40);
    refused(restarted.api.recover('reset', token, reservation.operation, observer), 'stopped');
    refused(restarted.api.schedule('new-episode', token, f.run, policy), 'already exists');
    expect(value(restarted.api.inspect()).map(r => r.record).filter(r => r.type === 'LoopRecord').at(-1)).toMatchObject({ attempts: limit, state: 'stopped' });
  }
});

it('P6-NF-11 P6-NF-20 observation failure consumes credit durably and preserves the next level wake', () => {
  const f = transportFixture(), { token, reservation } = f.prepared(); value(f.api.claim('claim', token, reservation.operation));
  f.advance(10);
  refused(f.api.recover('failed-observation', token, reservation.operation, {
    owner: 'part-eight', observe: () => f.result(() => { throw new Error('observation unavailable'); }),
  }), 'observation unavailable');
  const restarted = transportFixture(f.directory); restarted.advance(20);
  value(restarted.api.recover('retry-observation-not-effect', token, reservation.operation, {
    owner: 'part-eight', observe: () => restarted.result(() => ({ owner: 'part-eight' as const, name: 'OperationObservation' as const, id: 'still-uncertain' })),
  }));
  expect(value(restarted.api.inspect()).map(r => r.record).filter(r => r.type === 'LoopRecord').at(-1)).toMatchObject({ attempts: 2 });
});

it('P6-NF-10 monotonic regression and expiry refuse without a loss notice', () => {
  const f = transportFixture(), token = value(f.api.acquire('a', '', 50));
  f.time(99); refused(f.api.admitWrite('regressed', token), 'regressed');
  f.time(149); value(f.api.admitWrite('before', token));
  f.time(150); refused(f.api.admitWrite('at-expiry', token), 'expired');
});

it('P6-NF-06 P6-NF-30 altered durable prefix refuses before a restarted worker can acquire', () => {
  const f = transportFixture(), token = value(f.api.acquire('a', '', 500));
  value(f.api.admitWrite('neighbor', token));
  const file = join(f.directory, 'facts.json');
  const facts = JSON.parse(readFileSync(file, 'utf8')) as { body: { record: { epoch: number } } }[];
  facts[0]!.body.record.epoch = 999;
  writeFileSync(file, JSON.stringify(facts));
  const restarted = transportFixture(f.directory, 'worker:2', 'authority:2');
  refused(restarted.api.acquire('bad-prefix', '', 500), 'hash mismatch');
});

it('P6-NF-03 P6-NF-11 storage failure never issues a claim and retains prepared operation after restart', () => {
  const f = transportFixture(), { token, reservation } = f.prepared();
  // Fail the actual storage callback, not the high-level result after a fake success.
  const blocked = { ...f.storage, append: () => f.result<never>(() => { throw new Error('fsync failed'); }) };
  const store = createFactStore(f.ctx, blocked);
  const api = createTransportAuthority(f.host, createTransportSpine(f.host, { context: f.ctx, privateKey }, store), f.c);
  refused(api.claim('blocked-claim', token, reservation.operation), 'fsync failed');
  expect(value(f.api.inspect()).map(r => r.record).filter(r => r.type === 'AdmissionReservation').at(-1)).toMatchObject({ state: 'prepared' });
  expect(token.epoch).toBe(1); expect(reservation.charge).toBe(20);
  const restarted = transportFixture(f.directory);
  const claim = value(restarted.api.claim('real-claim', token, reservation.operation));
  value(restarted.api.consume(claim, token));
});
