import { expect, it } from 'vitest';
import type { SharedLoopRecord } from '../../src/transport/index.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const scope = { target: 'e2e', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
const ref = (loop: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
const mode = process.env.SLB_E2E_MODE;
const directory = process.env.SLB_E2E_DIR;
if (!directory) throw new Error('SLB_E2E_DIR is required');

it.skipIf(mode !== 'produce')('producer persists an owner-witnessed loop', () => {
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
});

it.skipIf(mode !== 'recover')('new process reconstructs producer state', () => {
  const f = transportLoopFixture(directory, 'worker:e2e-recovery', 'authority:e2e-recovery');
  f.time(103);
  const loop = value(f.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record;
  expect(loop).toMatchObject({ state: 'open-breaker', transition: 'opened', attempts: 2, totalFailures: 2 });
});

it.skipIf(mode !== 'repair9-budget-produce')('repair9 budget producer refuses an incomparable parent clock', () => {
  const f = transportLoopFixture(directory);
  const bounded = { ...f.sharedPolicy, id: 'e2e-repair9-budget',
    parentAttemptBudget: 1, parentResourceBudget: 1 } as const;
  f.registerPolicy(bounded);
  const token = value(f.api.acquire('e2e-repair9-budget-lease', '', 1000));
  let loop = value(f.api.scheduleEpisode({ command: 'e2e-repair9-budget-schedule', fence: token,
    currentOwnerRun: f.run, policy: bounded, episodeKey: 'one', operationFamily: 'recovery',
    pressureScope: scope, sourceVector: f.vector }));
  f.advance(1);
  loop = value(f.api.admitLoopAttempt({ command: 'e2e-repair9-budget-admit', fence: token, episode: ref(loop),
    attempt: 'budget-a', holderFamily: 'sentinel', worker: 'worker:a', machine: 'machine-a', resource: 1,
    sourceVector: f.vector }));
  value(f.api.recordLoopOutcome({ command: 'e2e-repair9-budget-finish', fence: token, episode: ref(loop),
    attempt: 'budget-a', kind: 'accepted', failureClass: '', completion: f.appendOutcome('accepted', 'budget-a'),
    jitterPermille: 1000, restoration: [], sourceVector: f.vector }));
  const clock = f.host.loopClock!;
  Object.assign(f.host, { loopClock: { owner: 'part-ten', now: () => ({ ...clock.now(),
    subject: { kind: 'clock', instance: 'machine-b' } }) } });
  expect(() => value(f.api.scheduleEpisode({ command: 'e2e-repair9-budget-second', fence: token,
    currentOwnerRun: f.run, policy: bounded, episodeKey: 'two', operationFamily: 'recovery',
    pressureScope: { ...scope, target: 'other' }, sourceVector: f.vector }))).toThrow();
});

it.skipIf(mode !== 'repair9-budget-recover')('repair9 budget recovery retains the original expenditure', () => {
  const f = transportLoopFixture(directory, 'worker:e2e-repair9-budget', 'authority:e2e-repair9-budget');
  const loop = value(f.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record as SharedLoopRecord;
  expect(loop).toMatchObject({ attempts: 1, rollingAttempts: 1 });
});

it.skipIf(mode !== 'repair9-cycle-produce')('repair9 cycle producer admits the later-cycle trial', () => {
  const f = transportLoopFixture(directory);
  const restorationScope = { ...scope, target: 'target:review' } as const;
  const policy = { ...f.sharedPolicy, id: 'e2e-repair9-cycle', failureThreshold: 1,
    halfOpenTrials: 1, maxOpenDuration: 30 } as const;
  f.registerPolicy(policy);
  const token = value(f.api.acquire('e2e-repair9-cycle-lease', '', 1000));
  let loop = value(f.api.scheduleEpisode({ command: 'e2e-repair9-cycle-schedule', fence: token,
    currentOwnerRun: f.run, policy, episodeKey: 'one', operationFamily: 'recovery', pressureScope: restorationScope,
    sourceVector: f.vector }));
  const admit = (attempt: string) => value(f.api.admitLoopAttempt({ command: `e2e-repair9-admit:${attempt}`,
    fence: token, episode: ref(loop), attempt, holderFamily: 'sentinel', worker: `worker:${attempt}`,
    machine: 'machine-a', resource: 1, sourceVector: f.vector }));
  const finish = (attempt: string, kind: 'accepted' | 'failed', restoration: SharedLoopRecord['closureEvidence'] = []) =>
    value(f.api.recordLoopOutcome({ command: `e2e-repair9-finish:${attempt}`, fence: token, episode: ref(loop),
      attempt, kind, failureClass: kind === 'failed' ? 'transport' : '', completion: f.appendOutcome(kind, attempt),
      jitterPermille: 1000, restoration, sourceVector: f.vector }));
  f.advance(1); loop = admit('fail-1'); finish('fail-1', 'failed');
  f.advance(20); loop = admit('trial-1'); finish('trial-1', 'accepted', [f.restorationReference('assessment:witnessed-review')]);
  f.advance(20); loop = value(f.api.scheduleEpisode({ command: 'e2e-repair9-cycle-two', fence: token,
    currentOwnerRun: f.run, policy, episodeKey: 'two', operationFamily: 'recovery', pressureScope: restorationScope,
    sourceVector: f.vector }));
  f.advance(1); loop = admit('fail-2'); const opened = finish('fail-2', 'failed');
  expect(opened.breakerFirstOpened.value).toBe(142);
  f.advance(20); loop = admit('trial-2');
  expect(loop).toMatchObject({ state: 'half-open', pendingAttempts: ['trial-2'] });
}, 20000);

it.skipIf(mode !== 'repair9-cycle-recover')('repair9 cycle recovery keeps the later open interval', () => {
  const f = transportLoopFixture(directory, 'worker:e2e-repair9-cycle', 'authority:e2e-repair9-cycle');
  f.time(162);
  const loop = value(f.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record as SharedLoopRecord;
  expect(loop).toMatchObject({ state: 'half-open', breakerFirstOpened: { value: 142 }, pendingAttempts: ['trial-2'] });
});

it.skipIf(mode !== 'repair10-resource-produce')('repair10 producer persists exact shared resource admission', () => {
  const f = transportLoopFixture(directory);
  const policy = { ...f.sharedPolicy, id: 'e2e-repair10-resource', parentResourceBudget: 1 } as const;
  f.registerPolicy(policy);
  const token = value(f.api.acquire('e2e-repair10-resource-lease', '', 1000));
  const loop = value(f.api.scheduleEpisode({ command: 'e2e-repair10-resource-schedule', fence: token,
    currentOwnerRun: f.run, policy, episodeKey: 'one', operationFamily: 'recovery', pressureScope: scope,
    sourceVector: f.vector }));
  f.advance(1);
  value(f.api.admitLoopAttempt({ command: 'e2e-repair10-resource-admit', fence: token, episode: ref(loop),
    attempt: 'resource-attempt', holderFamily: 'sentinel', worker: 'worker:resource', machine: 'machine-a',
    resource: 1, sourceVector: f.vector }));
});

it.skipIf(mode !== 'repair10-resource-recover')('repair10 recovery refuses resource inflation', () => {
  const f = transportLoopFixture(directory, 'worker:e2e-repair10', 'authority:e2e-repair10');
  f.time(101);
  const token = value(f.api.acquire('e2e-repair10-resource-takeover', f.head(), 1000));
  expect(() => value(f.api.reserve(f.input(token, { attempt: 'resource-attempt', charge: 20 })))).toThrow();
});
