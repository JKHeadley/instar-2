import { expect, it } from 'vitest';
import { canonical, decodeMeasurement } from '../../src/index.js';
import { createBoundedDueScanPort } from '../../src/transport/index.js';
import type { FenceToken, MissedRangeInput, SharedLoopRecord } from '../../src/transport/index.js';
import { transportFixture, refused, value } from '../transport/fixture.js';

const pressureScope = { target: 'scheduled-work', conversation: 'conversation:1', machine: 'fleet', pool: 'jobs' } as const;
function duration(f: ReturnType<typeof transportFixture>, valueMs: number) {
  return value(decodeMeasurement('duration', { type: 'Measurement', schemaVersion: 1,
    subject: { kind: 'duration', instance: 'job:shared' }, value: valueMs, unit: 'ms', at: f.clock(100 + valueMs), by: 'probe' },
  f.host.current().decode));
}
function setup(f: ReturnType<typeof transportFixture>, key = 'job:shared') {
  const page = value(createBoundedDueScanPort(f.host, f.spine, f.c).page({ scan: `scheduled:${key}`, generation: 'calendar:g1',
    orderedKeys: [`machine-a:${key}`, `machine-b:${key}`], cursor: null, maxItems: 2, maxDuration: 10 }));
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
    scanCursor: setupValue.page.cursor, jobInstance: 'job:shared', packageDigest: `sha256:${'d'.repeat(64)}` as const,
    calendarPolicy: 'every-10', asOf: f.clock(asOfValue), currentLateness: duration(f, asOfValue - 130),
    priorExpansionCursor: f.clock(100), missedBoundary: f.clock(130), catchUpPolicy: 'none' as const,
    dispositions: members.map(scheduledInstant => ({ scheduledInstant, kind: 'missed-no-execution' as const,
      result: missedResult })),
    catchUpRun: null };
  return { ...base, ...overrides };
}
function deterministicCatchUp(f: ReturnType<typeof transportFixture>, source: MissedRangeInput) {
  const id = `missed:${value(canonical([source.parentDuty.id, source.jobInstance, source.calendarPolicy,
    source.priorExpansionCursor, source.missedBoundary, source.asOf])).hash}`;
  return { owner: 'part-five' as const, name: 'Run' as const,
    id: `run:${value(canonical(['missed-catch-up', id, f.clock(130)])).hash}` };
}

it('SLB-MISSED-08 P6-NF-20 P6-NF-33 boundary and boundary-plus-one lateness retain exact stable ordered membership', () => {
  const record = (asOf: number) => {
    const f = transportFixture(), ready = setup(f);
    const ref = value(f.api.recordMissedRange(input(f, ready, asOf)));
    return value(f.api.readMissedRange(ref)).record;
  };
  const boundary = record(130), plusOne = record(131);
  expect(plusOne.orderedMembersDigest).toBe(boundary.orderedMembersDigest);
  expect(plusOne.dispositions.map(value => value.scheduledInstant.value)).toEqual([110, 120, 130]);
  expect(plusOne.memberCount).toBe(3);
});

it('SLB-MISSED-09 P6-NF-20 P6-NF-33 partial successors resume first undisposed, replay identically, keep admitted Runs and cannot mint a second catch-up', () => {
  const f = transportFixture(), ready = setup(f);
  const base = input(f, ready, 131), catchUpRun = deterministicCatchUp(f, base);
  const firstInput: MissedRangeInput = { ...base, catchUpPolicy: 'latest', catchUpRun,
    dispositions: base.dispositions.map((value, index) => index === 1 ? { scheduledInstant: value.scheduledInstant,
      kind: 'existing-run' as const, run: { ...f.run, id: 'run:original-admission' } }
      : index === 2 ? { scheduledInstant: value.scheduledInstant, kind: 'catch-up-run' as const, run: catchUpRun } : value) };
  const reference = value(f.api.recordMissedRange(firstInput));
  const first = value(f.api.readMissedRange(reference));
  expect(first.firstUndisposed?.value).toBe(110);
  const count = value(f.api.inspect()).length;
  expect(value(f.api.recordMissedRange(firstInput))).toEqual(reference);
  expect(value(f.api.inspect())).toHaveLength(count);

  const completedInput: MissedRangeInput = { ...firstInput,
    dispositions: firstInput.dispositions.map((value, index) => index === 0 ? { scheduledInstant: value.scheduledInstant,
      kind: 'existing-run' as const, run: { ...f.run, id: 'run:resumed-admission' } } : value) };
  value(f.api.recordMissedRange(completedInput));
  const completed = value(f.api.readMissedRange(reference));
  expect(completed.firstUndisposed).toBeNull();
  expect(completed.record.dispositions[1]).toMatchObject({ kind: 'existing-run', run: { id: 'run:original-admission' } });
  refused(f.spine.append(completed.record, [completed.fact.id]), 'conditional writer');

  const changedExisting: MissedRangeInput = { ...completedInput,
    dispositions: completedInput.dispositions.map((value, index) => index === 1
      ? { scheduledInstant: value.scheduledInstant, kind: 'existing-run' as const,
        run: { ...f.run, id: 'run:replacement-is-forbidden' } } : value) };
  refused(f.api.recordMissedRange(changedExisting), 'completed missed member');
  const secondCatchUp: MissedRangeInput = { ...completedInput,
    dispositions: completedInput.dispositions.map((value, index) => index === 0 ? { scheduledInstant: value.scheduledInstant,
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
  const reservation = value(f.api.reserve(f.input(ready.token)));
  expect(value(f.api.reserve(f.input(ready.token))).operation).toBe(reservation.operation);
  expect(value(f.api.inspect()).filter(row => row.record.type === 'AdmissionReservation')).toHaveLength(1);
  expect(firstAttempt.pressureKey).toBe(secondAttempt.pressureKey);
});
