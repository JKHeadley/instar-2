import { expect, it } from 'vitest';
import { decodeMeasurement } from '../../src/index.js';
import { createBoundedDueScanPort } from '../../src/transport/index.js';
import type { SharedLoopRecord } from '../../src/transport/index.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const scope = { target: 'e2e', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
const ref = (loop: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
const mode = process.env.SLB_E2E_MODE;
const directory = process.env.SLB_E2E_DIR;
if (!directory) throw new Error('SLB_E2E_DIR is required');

it.skipIf(mode !== 'produce')('producer persists owner-witnessed loop and missed range', () => {
  const f = transportLoopFixture(directory), token = value(f.api.acquire('e2e:lease', '', 1000));
  let loop = value(f.api.scheduleEpisode({ command: 'e2e:schedule', fence: token, currentOwnerRun: f.run,
    policy: f.sharedPolicy, episodeKey: 'e2e', operationFamily: 'recovery', pressureScope: scope,
    sourceVector: f.vector }));
  for (const [attempt, at] of [['a', 101], ['b', 103]] as const) {
    f.time(at);
    loop = value(f.api.admitLoopAttempt({ command: `e2e:admit:${attempt}`, fence: token, episode: ref(loop), attempt,
      holderFamily: 'watchdog', worker: `worker:${attempt}`, machine: 'machine-a', resource: 1,
      sourceVector: f.vector }));
    loop = value(f.api.recordLoopOutcome({ command: `e2e:outcome:${attempt}`, fence: token, episode: ref(loop), attempt,
      kind: 'failed', failureClass: 'transport', completion: f.appendOutcome('failed', attempt), jitterPermille: 1000,
      restoration: [], sourceVector: f.vector }));
  }
  expect(loop).toMatchObject({ state: 'open-breaker', transition: 'opened', attempts: 2, totalFailures: 2 });
  const missedLoop = value(f.api.scheduleEpisode({ command: 'e2e:missed:schedule', fence: token, currentOwnerRun: f.run,
    policy: f.sharedPolicy, episodeKey: 'e2e-missed', operationFamily: 'scheduled-work', pressureScope: scope,
    sourceVector: f.vector }));
  const page = value(createBoundedDueScanPort(f.host, f.spine, f.c).page({ scan: 'scan', generation: 'g1',
    orderedKeys: ['job:one'], cursor: null, maxItems: 1, maxDuration: 10 }));
  const lateness = value(decodeMeasurement('duration', { type: 'Measurement', schemaVersion: 1,
    subject: { kind: 'duration', instance: 'job:one' }, value: 0, unit: 'ms', at: f.clock(130), by: 'probe' },
  f.host.current().decode));
  const reference = value(f.api.recordMissedRange({ parentDuty: f.parentDuty, episode: ref(missedLoop), scanCursor: page.cursor,
    jobInstance: 'job:one', packageDigest: `sha256:${'d'.repeat(64)}`, calendarPolicy: 'every-10', asOf: f.clock(130),
    currentLateness: lateness, priorExpansionCursor: f.clock(100), missedBoundary: f.clock(130), catchUpPolicy: 'none',
    dispositions: [110, 120, 130].map(at => ({ scheduledInstant: f.clock(at), kind: 'existing-run' as const,
      run: f.admittedRun(at) })),
    catchUpRun: null }));
  console.log(`SLB_E2E_REF=${reference.id}`);
});

it.skipIf(mode !== 'recover')('new process reconstructs producer state', () => {
  const f = transportLoopFixture(directory, 'worker:e2e-recovery', 'authority:e2e-recovery');
  f.time(103);
  const loop = value(f.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-2)!.record;
  expect(loop).toMatchObject({ state: 'open-breaker', transition: 'opened', attempts: 2, totalFailures: 2 });
  const id = process.env.SLB_E2E_REF;
  if (!id) throw new Error('SLB_E2E_REF is required');
  const rebuilt = value(f.api.readMissedRange({ owner: 'part-six', name: 'MissedRangeRecord', id }));
  expect(rebuilt.record.dispositions.map(value => value.scheduledInstant.value)).toEqual([110, 120, 130]);
  expect(rebuilt.firstUndisposed).toBeNull();
});
