import { expect, it } from 'vitest';
import { decodeLoopPolicy } from '../../src/transport/index.js';
import type { FenceToken, SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/index.js';
import { transportLoopFixture as transportFixture, refused, value } from '../transport/loop-fixture.js';

const scope = { target: 'target:shared', conversation: 'conversation:1', machine: 'fleet', pool: 'recovery' } as const;
const episodeRef = (record: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode });
function schedule(f: ReturnType<typeof transportFixture>, token: FenceToken, episodeKey = 'episode-1') {
  return value(f.api.scheduleEpisode({ command: `schedule:${episodeKey}`, fence: token, currentOwnerRun: f.run,
    policy: f.sharedPolicy, episodeKey, operationFamily: 'holder-recovery', pressureScope: scope, sourceVector: f.vector }));
}
function attempt(f: ReturnType<typeof transportFixture>, token: FenceToken, episode: SharedLoopRecord,
  id: string, holderFamily: string, worker: string, machine: string, resource = 5) {
  return f.api.admitLoopAttempt({ command: `admit:${id}`, fence: token, episode: episodeRef(episode), attempt: id,
    holderFamily, worker, machine, resource, sourceVector: f.vector });
}
function outcome(f: ReturnType<typeof transportFixture>, token: FenceToken, episode: SharedLoopRecord,
  id: string, kind: 'accepted' | 'failed', restoration: readonly { owner: 'part-nine'; name: 'VerificationAssessment'; id: string }[] = [],
  completion = f.appendOutcome(kind, id)) {
  return f.api.recordLoopOutcome({ command: `outcome:${id}`, fence: token, episode: episodeRef(episode), attempt: id,
    kind, failureClass: kind === 'failed' ? 'transport' : '', completion,
    jitterPermille: 1000, restoration, sourceVector: f.vector });
}

it('SLB-SHARED-04 P6-NF-18 P6-NF-20 P6-NF-21 shared pressure opens once, refuses every contender, bounds half-open, reopens and closes only with independent restoration', () => {
  const f = transportFixture(), token = value(f.api.acquire('acquire-shared', '', 500));
  let loop = schedule(f, token); f.advance(1);
  loop = value(attempt(f, token, loop, 'attempt-1', 'sentinel', 'worker-a', 'machine-a'));
  loop = value(outcome(f, token, loop, 'attempt-1', 'failed'));
  f.advance(2);
  loop = value(attempt(f, token, loop, 'attempt-2', 'watchdog', 'worker-b', 'machine-b'));
  loop = value(outcome(f, token, loop, 'attempt-2', 'failed'));
  expect(loop).toMatchObject({ state: 'open-breaker', failureCount: 2, totalFailures: 2, attempts: 2, breakerOpenCount: 1 });

  for (const [id, family, worker, machine] of [
    ['cooldown-a', 'sentinel', 'worker-c', 'machine-a'],
    ['cooldown-b', 'watchdog', 'worker-d', 'machine-b'],
    ['cooldown-route', 'watchdog', 'worker-e', 'machine-a'],
  ] as const) refused(attempt(f, token, loop, id, family, worker, machine), 'cooldown');
  expect(value(f.api.inspect()).filter(row => row.record.type === 'LoopRecord')).toHaveLength(5);

  f.advance(20);
  loop = value(attempt(f, token, loop, 'trial-failed', 'sentinel', 'worker-f', 'machine-b'));
  expect(loop).toMatchObject({ state: 'half-open', transition: 'half-opened', halfOpenAdmitted: 1 });
  refused(attempt(f, token, loop, 'trial-too-many', 'watchdog', 'worker-g', 'machine-a'), 'half-open trial');
  loop = value(outcome(f, token, loop, 'trial-failed', 'failed'));
  expect(loop).toMatchObject({ state: 'open-breaker', transition: 'reopened', totalFailures: 3, breakerOpenCount: 2 });

  f.advance(20);
  loop = value(attempt(f, token, loop, 'trial-pass-1', 'watchdog', 'worker-h', 'machine-a'));
  loop = value(outcome(f, token, loop, 'trial-pass-1', 'accepted'));
  expect(loop.state).toBe('half-open');
  loop = value(attempt(f, token, loop, 'trial-pass-2', 'sentinel', 'worker-i', 'machine-b'));
  const evidence = [f.restorationReference('assessment:restored-holder')];
  loop = value(outcome(f, token, loop, 'trial-pass-2', 'accepted', evidence));
  expect(loop).toMatchObject({ state: 'closed', transition: 'closed', halfOpenAdmitted: 2, halfOpenSucceeded: 2,
    closureEvidence: evidence });
  refused(outcome(f, token, loop, 'trial-pass-2', 'accepted'), 'changed after admission');

  value(f.api.release('release-after-close', token));
  const restarted = transportFixture(f.directory, 'worker:replacement', 'authority:replacement');
  restarted.time(f.host.loopClock!.now().value);
  const replacement = value(restarted.api.acquire('takeover-after-close', restarted.head(), 500));
  const next = schedule(restarted, replacement, 'episode-2');
  expect(next).toMatchObject({ state: 'scheduled', attempts: 5, totalFailures: 3, breakerOpenCount: 2, episodeAttempts: 0 });
  expect(next.episode).not.toBe(loop.episode);
  expect(next.pressureKey).toBe(loop.pressureKey);
}, 20000);

it('SLB-FRONTIER-05 V12 P6-NF-18 equal causal frontiers produce the same breaker outcome window regardless of completion order', () => {
  const run = (order: readonly string[]) => {
    const f = transportFixture(), token = value(f.api.acquire('acquire-frontier', '', 500));
    let loop = schedule(f, token); f.advance(1);
    loop = value(attempt(f, token, loop, 'a-accepted', 'sentinel', 'worker-a', 'machine-a'));
    loop = value(attempt(f, token, loop, 'b-failed', 'watchdog', 'worker-b', 'machine-b'));
    const completions = { 'a-accepted': f.appendOutcome('accepted', 'a-accepted'),
      'b-failed': f.appendOutcome('failed', 'b-failed') };
    for (const id of order) loop = value(outcome(f, token, loop, id, id === 'a-accepted' ? 'accepted' : 'failed', [], completions[id as keyof typeof completions]));
    return loop;
  };
  const left = run(['a-accepted', 'b-failed']), right = run(['b-failed', 'a-accepted']);
  expect(right.outcomeWindowDigest).toBe(left.outcomeWindowDigest);
  expect(right.failureCount).toBe(left.failureCount);
  expect(right.state).toBe(left.state);
});

it('SLB-RESTART-06 P6-NF-18 P6-NF-19 restart, route and machine changes cannot reset parent resource budget or an in-flight transition', () => {
  const f = transportFixture();
  const bounded = value(decodeLoopPolicy({ ...f.sharedPolicy, id: 'shared-budget:10', parentResourceBudget: 10 }, f.c)) as SharedBreakerLoopPolicy;
  f.registerPolicy(bounded);
  const token = value(f.api.acquire('acquire-budget', '', 500));
  let loop = value(f.api.scheduleEpisode({ command: 'schedule-budget', fence: token, currentOwnerRun: f.run,
    policy: bounded, episodeKey: 'budget-episode', operationFamily: 'budget-holder', pressureScope: scope, sourceVector: f.vector }));
  f.advance(1);
  loop = value(f.api.admitLoopAttempt({ command: 'admit-budget-1', fence: token, episode: episodeRef(loop), attempt: 'budget-1',
    holderFamily: 'sentinel', worker: 'worker-a', machine: 'machine-a', resource: 10, sourceVector: f.vector }));
  loop = value(f.api.recordLoopOutcome({ command: 'outcome-budget-1', fence: token, episode: episodeRef(loop), attempt: 'budget-1',
    kind: 'accepted', failureClass: '', completion: f.appendOutcome('accepted', 'budget-1'),
    jitterPermille: 1000, restoration: [], sourceVector: f.vector }));
  value(f.api.release('release-budget', token));

  const restarted = transportFixture(f.directory, 'worker:route-b', 'authority:route-b');
  restarted.time(103);
  const replacement = value(restarted.api.acquire('takeover-budget', restarted.head(), 500));
  const rebuilt = value(restarted.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record as SharedLoopRecord;
  refused(restarted.api.admitLoopAttempt({ command: 'admit-budget-2', fence: replacement, episode: episodeRef(rebuilt),
    attempt: 'budget-2', holderFamily: 'watchdog', worker: 'worker-b', machine: 'machine-b', resource: 1,
    sourceVector: restarted.vector }), 'shared parent budget');
  expect(value(restarted.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record)
    .toMatchObject({ attempts: 1, rollingAttempts: 1, rollingResource: 10 });
});

it('SLB-CUTS-07 P6-NF-18 P6-NF-20 restart cuts preserve scheduled, admitted, open and half-open transition boundaries', () => {
  const first = transportFixture(), firstFence = value(first.api.acquire('acquire-cuts', '', 500));
  const scheduled = schedule(first, firstFence);

  const afterSchedule = transportFixture(first.directory, 'worker:cut-scheduled', 'authority:cut-scheduled');
  afterSchedule.time(100);
  const scheduledFence = value(afterSchedule.api.acquire('takeover-scheduled', afterSchedule.head(), 500));
  let loop = value(afterSchedule.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record as SharedLoopRecord;
  expect(loop).toMatchObject({ state: 'scheduled', transition: 'scheduled', attempts: 0 });
  expect(loop.episode).toBe(scheduled.episode);
  afterSchedule.advance(1);
  loop = value(attempt(afterSchedule, scheduledFence, loop, 'cut-admitted', 'sentinel', 'worker-a', 'machine-a'));

  const afterAdmission = transportFixture(first.directory, 'worker:cut-admitted', 'authority:cut-admitted');
  afterAdmission.time(101);
  let fence = value(afterAdmission.api.acquire('takeover-admitted', afterAdmission.head(), 500));
  loop = value(afterAdmission.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record as SharedLoopRecord;
  expect(loop).toMatchObject({ state: 'running', transition: 'attempt-admitted', pendingAttempts: ['cut-admitted'] });
  loop = value(outcome(afterAdmission, fence, loop, 'cut-admitted', 'failed'));
  afterAdmission.advance(2);
  loop = value(attempt(afterAdmission, fence, loop, 'cut-open', 'watchdog', 'worker-b', 'machine-b'));
  loop = value(outcome(afterAdmission, fence, loop, 'cut-open', 'failed'));
  expect(loop).toMatchObject({ state: 'open-breaker', transition: 'opened' });

  const afterOpen = transportFixture(first.directory, 'worker:cut-open', 'authority:cut-open');
  afterOpen.time(103);
  fence = value(afterOpen.api.acquire('takeover-open', afterOpen.head(), 500));
  loop = value(afterOpen.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record as SharedLoopRecord;
  expect(loop).toMatchObject({ state: 'open-breaker', transition: 'opened', attempts: 2 });
  refused(attempt(afterOpen, fence, loop, 'cut-cooldown', 'sentinel', 'worker-c', 'machine-a'), 'cooldown');
  afterOpen.advance(20);
  loop = value(attempt(afterOpen, fence, loop, 'cut-half-open', 'watchdog', 'worker-d', 'machine-b'));

  const afterHalfOpen = transportFixture(first.directory, 'worker:cut-half-open', 'authority:cut-half-open');
  afterHalfOpen.time(123);
  fence = value(afterHalfOpen.api.acquire('takeover-half-open', afterHalfOpen.head(), 500));
  loop = value(afterHalfOpen.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record as SharedLoopRecord;
  expect(loop).toMatchObject({ state: 'half-open', transition: 'half-opened', pendingAttempts: ['cut-half-open'] });
  refused(attempt(afterHalfOpen, fence, loop, 'cut-extra-trial', 'sentinel', 'worker-e', 'machine-a'), 'half-open trial');
}, 20000);

it('SLB-BUDGET-11 P6-NF-19 rolling parent attempt capacity expires without resetting cumulative counters', () => {
  const f = transportFixture();
  const rollingPolicy = value(decodeLoopPolicy({ ...f.sharedPolicy, id: 'shared-budget:rolling-one',
    parentAttemptBudget: 1 }, f.c)) as SharedBreakerLoopPolicy;
  f.registerPolicy(rollingPolicy);
  const token = value(f.api.acquire('acquire-rolling-budget', '', 1000));
  let loop = value(f.api.scheduleEpisode({ command: 'schedule-rolling-budget', fence: token, currentOwnerRun: f.run,
    policy: rollingPolicy, episodeKey: 'rolling-budget', operationFamily: 'holder-recovery',
    pressureScope: scope, sourceVector: f.vector }));
  f.advance(1);
  loop = value(attempt(f, token, loop, 'rolling-first', 'sentinel', 'worker-a', 'machine-a', 1));
  loop = value(outcome(f, token, loop, 'rolling-first', 'accepted'));
  f.advance(1);
  refused(attempt(f, token, loop, 'rolling-blocked', 'watchdog', 'worker-b', 'machine-b', 1), 'shared parent budget');
  f.time(601);
  loop = value(attempt(f, token, loop, 'rolling-after-window', 'watchdog', 'worker-c', 'machine-b', 1));
  expect(loop).toMatchObject({ attempts: 2, episodeAttempts: 2, rollingAttempts: 1, rollingResource: 1 });
});

it('SLB-CONTINUE-20 V18 P6-NF-17 P6-NF-21 stops an exhausted episode and permits a further bounded episode for the continuing parent', () => {
  const f = transportFixture();
  const oneAttempt = value(decodeLoopPolicy({ ...f.sharedPolicy, id: 'shared-episode:one', maxAttempts: 1 }, f.c)) as SharedBreakerLoopPolicy;
  f.registerPolicy(oneAttempt);
  const token = value(f.api.acquire('acquire-stop-bound', '', 500));
  let loop = value(f.api.scheduleEpisode({ command: 'schedule-stop-bound', fence: token, currentOwnerRun: f.run,
    policy: oneAttempt, episodeKey: 'stop-bound', operationFamily: 'holder-recovery',
    pressureScope: scope, sourceVector: f.vector }));
  f.advance(1);
  loop = value(attempt(f, token, loop, 'stop-only-attempt', 'sentinel', 'worker-a', 'machine-a'));
  loop = value(outcome(f, token, loop, 'stop-only-attempt', 'accepted'));
  f.advance(1);
  loop = value(attempt(f, token, loop, 'stop-refused-work', 'watchdog', 'worker-b', 'machine-b'));
  expect(loop).toMatchObject({ state: 'stopped', transition: 'stopped', attempts: 1, episodeAttempts: 1 });
  refused(attempt(f, token, loop, 'cannot-revive-stopped', 'watchdog', 'worker-c', 'machine-b'), 'terminal');
  const next = value(f.api.scheduleEpisode({ command: 'schedule-after-healthy-stop', fence: token, currentOwnerRun: f.run,
    policy: oneAttempt, episodeKey: 'after-stop', operationFamily: 'holder-recovery', pressureScope: scope,
    sourceVector: f.vector }));
  expect(next).toMatchObject({ state: 'scheduled', transition: 'scheduled', attempts: 1, episodeAttempts: 0 });
});
