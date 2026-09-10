import { expect, it } from 'vitest';
import { canonical, decodeMeasurement } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createBoundedDueScanPort, createTransportAuthority, createTransportSpine } from '../../src/transport/index.js';
import type { FenceToken, MissedRangeInput, SharedLoopRecord } from '../../src/transport/index.js';
import { transportLoopFixture as transportFixture, refused, value } from '../transport/loop-fixture.js';
import { privateKey } from '../facts/fixtures.js';

const pressureScope = { target: 'scheduled-work', conversation: 'conversation:1', machine: 'fleet', pool: 'jobs' } as const;
function duration(f: ReturnType<typeof transportFixture>, valueMs: number) {
  return value(decodeMeasurement('duration', { type: 'Measurement', schemaVersion: 1,
    subject: { kind: 'duration', instance: 'job:one' }, value: valueMs, unit: 'ms', at: f.clock(130 + valueMs), by: 'probe' },
  f.host.current().decode));
}
function setup(f: ReturnType<typeof transportFixture>, key = 'job:one') {
  const missed = key === 'job:one';
  const page = value(createBoundedDueScanPort(f.host, f.spine, f.c).page({ scan: missed ? 'scan' : `scheduled:${key}`,
    generation: missed ? 'g1' : 'calendar:g1', orderedKeys: missed ? ['job:one'] : [`machine-a:${key}`, `machine-b:${key}`],
    cursor: null, maxItems: 2, maxDuration: 10 }));
  const token = value(f.api.acquire(`acquire:${key}`, f.head(), 500));
  const loop = value(f.api.scheduleEpisode({ command: `episode:${key}`, fence: token, currentOwnerRun: f.run,
    policy: f.sharedPolicy, episodeKey: key, operationFamily: 'scheduled-work', pressureScope, sourceVector: f.vector }));
  return { page, token, loop, cursorFact: value(f.api.inspect()).find(row => row.fact.id === page.cursor.id)!.fact };
}
function input(f: ReturnType<typeof transportFixture>, setupValue: ReturnType<typeof setup>, asOfValue: number,
  overrides: Partial<MissedRangeInput> = {}): MissedRangeInput {
  const members = [110, 120, 130].map(at => f.clock(at));
  const missedResult = f.appendResult(`result:missed:${asOfValue}`);
  const base = { parentDuty: f.parentDuty,
    episode: { owner: 'part-six' as const, name: 'LoopRecord' as const, id: setupValue.loop.episode },
    scanCursor: setupValue.page.cursor, jobInstance: 'job:one', packageDigest: `sha256:${'d'.repeat(64)}` as const,
    calendarPolicy: 'every-10', asOf: f.clock(asOfValue), currentLateness: duration(f, asOfValue - 130),
    priorExpansionCursor: f.clock(100), missedBoundary: f.clock(130), catchUpPolicy: 'none' as const,
    dispositions: members.map(scheduledInstant => ({ scheduledInstant, kind: 'missed-no-execution' as const,
      result: missedResult })),
    catchUpRun: null };
  return { ...base, ...overrides };
}
function deterministicCatchUp(f: ReturnType<typeof transportFixture>, source: MissedRangeInput) {
  void source;
  return f.catchUpRun(130);
}

it('SLB-MISSED-08 P6-NF-20 P6-NF-33 boundary and boundary-plus-one lateness retain exact stable ordered membership', () => {
  const record = (asOf: number) => {
    const f = transportFixture(undefined, undefined, undefined, { existingInstants: [] }), ready = setup(f);
    const ref = value(f.api.recordMissedRange(input(f, ready, asOf)));
    return value(f.api.readMissedRange(ref)).record;
  };
  const boundary = record(130), plusOne = record(131);
  expect(plusOne.orderedMembersDigest).toBe(boundary.orderedMembersDigest);
  expect(plusOne.dispositions.map(value => value.scheduledInstant.value)).toEqual([110, 120, 130]);
  expect(plusOne.memberCount).toBe(3);
});

it('SLB-MISSED-09 SLB-MISSED-SUCCESSOR-37 V21 P6-NF-20 P6-NF-33 partial successors resume first undisposed, replay identically, keep admitted Runs and cannot mint a second catch-up', () => {
  const f = transportFixture(undefined, undefined, undefined,
    { existingInstants: [120], catchUpInstants: [130] }), ready = setup(f);
  const base = input(f, ready, 131), catchUpRun = deterministicCatchUp(f, base);
  const firstInput: MissedRangeInput = { ...base, catchUpPolicy: 'latest', catchUpRun,
    dispositions: base.dispositions.map((value, index) => index === 1 ? { scheduledInstant: value.scheduledInstant,
      kind: 'existing-run' as const, run: f.admittedRun(120) }
      : index === 2 ? { scheduledInstant: value.scheduledInstant, kind: 'catch-up-run' as const, run: catchUpRun } : value) };
  const reference = value(f.api.recordMissedRange(firstInput));
  const first = value(f.api.readMissedRange(reference));
  expect(first.firstUndisposed?.value).toBe(110);
  const count = value(f.api.inspect()).length;
  expect(value(f.api.recordMissedRange(firstInput))).toEqual(reference);
  expect(value(f.api.inspect())).toHaveLength(count);

  const newlyAdmitted = f.admitScheduledRun(110);
  const successorInput: MissedRangeInput = { ...firstInput,
    dispositions: firstInput.dispositions.map((value, index) => index === 0
      ? { scheduledInstant: value.scheduledInstant, kind: 'existing-run' as const, run: newlyAdmitted }
      : value) };
  expect(value(f.api.recordMissedRange(successorInput))).toEqual(reference);
  const successor = value(f.api.readMissedRange(reference));
  expect(successor.firstUndisposed).toBeNull();
  expect(successor.record.catchUpRun).toEqual(catchUpRun);
  expect(successor.fact.id).not.toBe(first.fact.id);
  const successorFact = value(f.store.read()).find(fact => fact.id === successor.fact.id)!;
  expect(successorFact.predecessors.required).toContain(first.fact.id);
  const restartedStore = createFactStore(f.ctx, f.storage);
  const restartedApi = createTransportAuthority(f.host,
    createTransportSpine(f.host, { context: f.ctx, privateKey }, restartedStore), f.c);
  const rebuilt = value(restartedApi.readMissedRange(reference));
  expect(rebuilt.firstUndisposed).toBeNull();
  expect(rebuilt.record.catchUpRun).toEqual(catchUpRun);

  refused(f.spine.append(first.record, [first.fact.id]), 'completed missed member disposition changed');

  const changedExisting: MissedRangeInput = { ...firstInput,
    dispositions: firstInput.dispositions.map((value, index) => index === 1
      ? { scheduledInstant: value.scheduledInstant, kind: 'existing-run' as const,
        run: { owner: 'part-five' as const, name: 'Run' as const, id: 'run:other' } } : value) };
  refused(f.api.recordMissedRange(changedExisting), 'completed missed member');
  const secondCatchUp: MissedRangeInput = { ...firstInput,
    dispositions: firstInput.dispositions.map((value, index) => index === 0 ? { scheduledInstant: value.scheduledInstant,
      kind: 'catch-up-run' as const, run: catchUpRun } : value) };
  refused(f.api.recordMissedRange(secondCatchUp), 'latest policy');
  expect(value(f.api.readMissedRange(reference)).record.catchUpRun).toEqual(catchUpRun);
});

it('SLB-FANOUT-10 P6-NF-13 P6-NF-20 P6-NF-33 distinct machine-scoped due keys both run while one shared effect identity deduplicates once', () => {
  const f = transportFixture(), ready = setup(f, 'fanout');
  expect(ready.page.selected).toEqual(['machine-a:fanout', 'machine-b:fanout']);
  f.advance(1);
  const firstAttempt = value(f.api.admitLoopAttempt({ command: 'fanout-a', fence: ready.token,
    episode: { owner: 'part-six', name: 'LoopRecord', id: ready.loop.episode }, attempt: 'machine-a-job',
    holderFamily: 'scheduled', worker: 'worker-a', machine: 'machine-a', resource: 1, sourceVector: f.vector }));
  const secondAttempt = value(f.api.admitLoopAttempt({ command: 'fanout-b', fence: ready.token,
    episode: { owner: 'part-six', name: 'LoopRecord', id: ready.loop.episode }, attempt: 'machine-b-job',
    holderFamily: 'scheduled', worker: 'worker-b', machine: 'machine-b', resource: 1, sourceVector: f.vector }));
  expect(secondAttempt.pendingAttempts).toEqual(['machine-a-job', 'machine-b-job']);
  const reservation = value(f.api.reserve(f.input(ready.token, { attempt: 'machine-a-job' })));
  expect(value(f.api.reserve(f.input(ready.token, { attempt: 'machine-a-job' }))).operation).toBe(reservation.operation);
  expect(value(f.api.inspect()).filter(row => row.record.type === 'AdmissionReservation')).toHaveLength(1);
  expect(firstAttempt.pressureKey).toBe(secondAttempt.pressureKey);
});
