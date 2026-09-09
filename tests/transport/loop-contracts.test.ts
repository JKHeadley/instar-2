import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createBoundedDueScanPort, decodeLoopPolicy, decodeLoopRecord, decodeMissedRangeRecord, decodeScanCursor } from '../../src/transport/index.js';
import type { MissedRangeRecord } from '../../src/transport/index.js';
import { transportLoopFixture, refused, value } from './loop-fixture.js';
import { transportFixture } from './fixture.js';

it('SLB-PRESERVE-01 P6-NF-02 P6-NF-17 byte-preserves every legacy LoopPolicy LoopRecord and ScanCursor fixture', () => {
  const f = transportFixture(), { token } = f.prepared();
  const legacyLoop = value(f.api.inspect()).find(row => row.record.type === 'LoopRecord')!.record;
  const cursor = value(createBoundedDueScanPort(f.host, f.spine, f.c).page({ scan: 'legacy-scan', generation: 'legacy-g1',
    orderedKeys: ['machine-a:job', 'machine-b:job'], cursor: null, maxItems: 1, maxDuration: 10 }));
  const legacyCursor = value(f.api.inspect()).find(row => row.fact.id === cursor.cursor.id)!.record;
  const fixtures = [
    [f.policy, value(decodeLoopPolicy(f.policy, f.c))],
    [legacyLoop, value(decodeLoopRecord(legacyLoop, f.c))],
    [legacyCursor, value(decodeScanCursor(legacyCursor, f.c))],
  ] as const;
  for (const [before, after] of fixtures)
    expect(value(canonical(after)).bytes).toBe(value(canonical(before)).bytes);
  refused(decodeLoopPolicy({ ...f.policy, failDirection: 'open' }, f.c), 'unsupported loop policy');
  expect(value(f.api.admitWrite('legacy-neighbor', token)).operation).toBe('write');
});

it('SLB-PRESERVE-36 PRESERVE-2 keeps the exact legacy malformed-policy refusal value', () => {
  const f = transportFixture(), malformed = { ...f.policy } as Record<string, unknown>;
  delete malformed.maxAttempts;
  const refusal = consumeResult(decodeLoopPolicy(malformed, f.c), {
    Success: () => { throw new Error('expected refusal'); }, Refused: value => value,
  });
  expect(refusal).toEqual({ type: 'Result', schemaVersion: 1, kind: 'Refused', reason: 'decode',
    detail: 'undeclared or missing field', site: 'facts.admit', failDirection: 'closed',
    preserved: 'refusal:metadata' });
});

it('SLB-DECODE-02 P6-NF-02 P6-NF-17 closes every real-breaker policy arm and managed record field', () => {
  const f = transportLoopFixture();
  for (const mutation of [
    { breaker: 'unknown' }, { failureThreshold: 0 }, { countedFailureClasses: [] },
    { halfOpenConcurrency: 3 }, { jitterMaxPermille: 1001 },
    { closeEvidence: 'self-asserted' },
  ]) refused(decodeLoopPolicy({ ...f.sharedPolicy, ...mutation }, f.c));
  expect((value(decodeLoopPolicy({ ...f.sharedPolicy, parentAttemptBudget: 0 }, f.c)) as typeof f.sharedPolicy)
    .parentAttemptBudget).toBe(0);
  const token = value(f.api.acquire('shared-acquire', '', 500));
  const scheduled = value(f.api.scheduleEpisode({ command: 'shared-schedule', fence: token,
    currentOwnerRun: f.run, policy: f.sharedPolicy, episodeKey: 'episode-1', operationFamily: 'holder-recovery',
    pressureScope: { target: 'target:1', conversation: 'conversation:1', machine: 'fleet', pool: 'default' },
    sourceVector: f.vector }));
  expect(value(decodeLoopRecord(scheduled, f.c))).toEqual(scheduled);
  refused(decodeLoopRecord({ ...scheduled, pressureKey: 'pressure:forged' }, f.c), 'pressure');
  refused(decodeLoopRecord({ ...scheduled, unknown: true }, f.c), 'undeclared');
  refused(f.spine.append({ ...scheduled, command: 'raw-shared-loop-bypass', predecessor: f.head() }, [f.head()]),
    'owner evidence');
});

it('SLB-LEGACY-REFUSALS-41 P2 keeps missing and unknown legacy breaker refusals byte-identical to main', () => {
  const f = transportFixture();
  const refusal = (input: unknown) => consumeResult(decodeLoopPolicy(input, f.c), {
    Success: () => { throw new Error('expected refusal'); }, Refused: value => value,
  });
  const missing = { ...f.policy } as Record<string, unknown>;
  delete missing.breaker;
  expect(refusal(missing)).toEqual({ type: 'Result', schemaVersion: 1, kind: 'Refused', reason: 'decode',
    detail: 'undeclared or missing field', site: 'facts.admit', failDirection: 'closed',
    preserved: 'refusal:metadata' });
  expect(refusal({ ...f.policy, breaker: 'unknown' })).toEqual({ type: 'Result', schemaVersion: 1,
    kind: 'Refused', reason: 'decode', detail: 'unsupported loop policy', site: 'facts.admit',
    failDirection: 'closed', preserved: 'refusal:metadata' });
});

it('SLB-DECODE-03 P6-NF-02 P6-NF-33 closes the exact MissedRangeRecord payload', () => {
  const f = transportLoopFixture();
  const record = {
    type: 'MissedRangeRecord', schemaVersion: 1, id: 'missed:one', parentDuty: f.parentDuty,
    episode: { owner: 'part-six', name: 'LoopRecord', id: 'loop:one' },
    scanCursor: { owner: 'part-six', name: 'ScanCursor', id: 'cursor:one' },
    jobInstance: 'machine-a:job', packageDigest: `sha256:${'a'.repeat(64)}`, calendarPolicy: 'every-10',
    asOf: f.clock(130), currentLateness: { type: 'Measurement', schemaVersion: 1,
      subject: { kind: 'duration', instance: 'machine-a:job' }, value: 10, unit: 'ms', at: f.clock(130), by: 'probe' },
    first: f.clock(110), last: f.clock(120), memberCount: 2,
    orderedMembersDigest: value(canonical([f.clock(110), f.clock(120)])).hash,
    derivationInputDigest: `sha256:${'c'.repeat(64)}`,
    catchUpPolicy: 'none', dispositions: [110, 120].map(at => ({ scheduledInstant: f.clock(at),
      kind: 'missed-no-execution' as const, result: { type: 'Result' as const, id: 'result:missed', field: 'result',
        fact: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: 'result-fact:one' } } })),
    catchUpRun: null,
  } as unknown as MissedRangeRecord;
  expect(value(decodeMissedRangeRecord(record, f.c))).toEqual(record);
  refused(decodeMissedRangeRecord({ ...record, catchUpPolicy: 'all' }, f.c));
  refused(decodeMissedRangeRecord({ ...record, extra: true }, f.c));
});
