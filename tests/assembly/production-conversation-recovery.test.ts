/**
 * Carryover row 03: the 1.x SessionRecovery ladder inside the production conversation port, fed by
 * the adapter's transcript observation. Each case is one decision boundary: the stall and error-loop
 * detectors over the worker's own transcript tail, the kill-to-queued-revival path behind the exact
 * no-replay floor, the P1/P2 child-work veto, the 3-attempt/15-minute ladder keyed per conversation
 * and durable across restart, the context-wall latch (first observation and transcript growth defer
 * with zero attempts spent, the 30-minute ceiling forces action), compaction before the grounded
 * replacement, a refused compaction retained as uncertain, and the 30-second observation cadence.
 * Offline over the public adapter contract; no live harness or channel proof is claimed.
 */
import { expect, it } from 'vitest';
import { liveWorker, stalled, looping, childEdge } from './conversation-recovery-fixture.js';
const MINUTE = 60_000;

it('a tool call stalled on the transcript tail retires the worker and queues its revival; the revival drains and the turn completes', async () => {
  const f = liveWorker();
  f.transcript(stalled(f.now()));
  f.finishWhen(() => f.launches.length >= 2);
  const outcome = await f.port.run(f.request('lost'));
  expect(outcome).toMatchObject({ state: 'complete', text: '{"answer":"hello"}' });
  expect(f.launches).toHaveLength(2); expect(f.delivered).toHaveLength(1);
  // The Read threshold is 60 seconds; checks run at the 30-second cadence, so the kill lands at the third check.
  expect(f.events('recovery:stall')).toHaveLength(1);
  expect(f.events('recovery:stall')[0]).toMatchObject({ attemptNumber: 1, transcript: 'transcript-1', stall: { lastToolName: 'Read' } });
  expect(f.events('recovery:stall')[0]!.stall).not.toHaveProperty('lastToolInput');
  expect(f.events('recovery')[0]).toMatchObject({ failureType: 'stall', recovered: true, attempt: 1 });
  expect(f.state().revivalQueue?.entries[0]).toMatchObject({ status: 'respawned', reason: expect.stringContaining('stall on Read for 1 min') });
  expect(f.attempts()['stall:operator-1']).toMatchObject({ count: 1 });
  expect(f.notices.map(n => n.kind)).toEqual(['resumed']);
  expect(f.state().inputs[0]).toMatchObject({ state: 'settled', workerRecovery: 'continued' });
  await f.port.close();
});

it('a stall whose worker prepared tools since dispatch is retired and the input settles uncertain: no automatic replay', async () => {
  const f = liveWorker();
  f.transcript(stalled(f.now()));
  f.finishWhen(() => { f.prepared(1); return false; });
  const outcome = await f.port.run(f.request('lost'));
  expect(outcome).toMatchObject({ state: 'uncertain' });
  expect(outcome.detail).toContain('prepared tools since dispatch');
  expect(f.launches).toHaveLength(1); expect(f.state().worker).toBeNull();
  expect(f.state().revivalQueue?.entries ?? []).toHaveLength(0);
  expect(f.events('recovery')[0]).toMatchObject({ failureType: 'stall', recovered: false });
  await f.port.close();
});

it('three identical tool failures are an error loop: the worker is retired and revived through the same queue', async () => {
  const f = liveWorker();
  f.transcript(looping(f.now()));
  f.finishWhen(() => f.launches.length >= 2);
  expect(await f.port.run(f.request('loop'))).toMatchObject({ state: 'complete' });
  expect(f.launches).toHaveLength(2);
  expect(f.events('recovery:error_loop')[0]).toMatchObject({ attemptNumber: 1, loop: { loopCount: 3 } });
  expect(f.state().revivalQueue?.entries[0]).toMatchObject({ status: 'respawned', reason: expect.stringContaining('error loop: 3 identical failures') });
  expect(f.attempts()['loop:operator-1']).toMatchObject({ count: 1 });
  await f.port.close();
});

it('open child work vetoes a detector kill: the worker is producing real work and is kept', async () => {
  const f = liveWorker();
  f.transcript(stalled(f.now())); f.delegations([childEdge()]);
  // The child closes after two and a half minutes; the turn ends on the next observation after three.
  f.finishWhen(() => { if (f.now() >= 1000 + 2.5 * MINUTE) f.delegations([]); return f.now() >= 1000 + 3 * MINUTE; });
  expect(await f.port.run(f.request('busy'))).toMatchObject({ state: 'complete' });
  expect(f.launches).toHaveLength(1);
  expect(f.events('recovery:deferred').length).toBeGreaterThanOrEqual(1);
  expect(f.events('recovery')[0]).toMatchObject({ failureType: 'stall', recovered: false });
  expect(f.attempts()['stall:operator-1']).toMatchObject({ count: 1 });
  await f.port.close();
});

it('the ladder is per conversation and durable: a second stall inside the 15-minute cooldown keeps the worker across a host restart and tells the operator once', async () => {
  const f = liveWorker();
  f.transcript(stalled(f.now()));
  f.finishWhen(() => f.launches.length >= 2);
  expect(await f.port.run(f.request('first'))).toMatchObject({ state: 'complete' });
  expect(f.attempts()['stall:operator-1']).toMatchObject({ count: 1 });
  const next = f.restart();
  // A restarted host retires the prior host's worker and launches its own (the third launch); that
  // worker's transcript is new and stalls afresh, but the conversation's ladder is cooling down.
  const stallAt = f.now() + 2 * MINUTE;
  f.transcript(stalled(stallAt));
  f.finishWhen(() => f.notices.some(n => n.kind === 'recovery-exhausted') && f.now() >= stallAt + 3 * MINUTE);
  expect(await next.run(f.request('second'))).toMatchObject({ state: 'complete' });
  expect(f.launches).toHaveLength(3);
  expect(f.notices.filter(n => n.kind === 'recovery-exhausted')).toHaveLength(1);
  expect(f.notices.at(-1)?.detail).toContain('exhausted or cooling down');
  expect(f.attempts()['stall:operator-1']).toMatchObject({ count: 1 });
  expect(f.events('recovery:stall')).toHaveLength(1);
  await next.close();
});

it('without a transcript observer the detectors never run and a quiet worker is kept', async () => {
  const f = liveWorker({ transcript: false });
  f.finishWhen(() => f.now() >= 1000 + 5 * MINUTE);
  expect(await f.port.run(f.request('quiet'))).toMatchObject({ state: 'complete' });
  expect(f.launches).toHaveLength(1);
  expect(f.audits.filter(row => String(row.event).startsWith('recovery'))).toHaveLength(0);
  await f.port.close();
});

it('the transcript is observed at the 30-second cadence, not on every poll', async () => {
  const f = liveWorker();
  f.finishWhen(() => f.now() >= 1000 + 2 * MINUTE);
  expect(await f.port.run(f.request('cadence'))).toMatchObject({ state: 'complete' });
  expect(f.reads()).toBeGreaterThanOrEqual(4); expect(f.reads()).toBeLessThanOrEqual(6);
  await f.port.close();
});

it('a context wall defers compaction on its first observation and compacts once the transcript stays static, spending one attempt and clearing the latch', async () => {
  const f = liveWorker();
  f.wall('context-too-long');
  f.finishWhen(() => true);
  const started = f.now();
  const outcome = await f.port.run(f.request('wall'));
  expect(outcome).toMatchObject({ state: 'complete', contextRecovery: 'wall' });
  expect(f.controls).toEqual(['compact']);
  const event = f.events('recovery:context_exhaustion')[0]!;
  expect(event).toMatchObject({ attemptNumber: 1, ceilingReached: false, transcriptGrowth: 'static', matchedPattern: 'context-too-long' });
  expect(event.latchAgeMs).toBeGreaterThanOrEqual(100);
  expect(f.events('recovery:context_compacted')).toHaveLength(1);
  // The deferral is logged as its own non-attempt; the compaction is the recovery.
  expect(f.events('recovery').map(row => row.recovered)).toEqual([false, true]);
  expect(f.events('recovery').at(-1)).toMatchObject({ failureType: 'context_exhaustion', recovered: true, attempt: 1 });
  expect(f.attempts()['context:operator-1']).toMatchObject({ count: 1 });
  expect(f.state().workerRecoveryState?.wedgedSeen).toEqual({});
  expect(f.now() - started).toBeLessThan(MINUTE);
  await f.port.close();
});

it('a transcript that keeps growing at the wall defers compaction, spending no attempt, until the 30-minute ceiling forces it', async () => {
  const f = liveWorker({ pollMs: 5000 });
  f.wall('context-too-long'); f.growing(true);
  f.finishWhen(() => true);
  const started = f.now();
  expect(await f.port.run(f.request('wall'))).toMatchObject({ state: 'complete' });
  expect(f.controls).toEqual(['compact']);
  expect(f.now() - started).toBeGreaterThanOrEqual(30 * MINUTE);
  expect(f.events('recovery:context_exhaustion')[0]).toMatchObject({ attemptNumber: 1, ceilingReached: true, transcriptGrowth: 'grew' });
  expect(f.attempts()['context:operator-1']).toMatchObject({ count: 1 });
  await f.port.close();
});

it('a failed compaction kills the worker and launches the grounded replacement for the same accepted input', async () => {
  const f = liveWorker();
  f.wall('context-too-long'); f.compaction('replace-required');
  f.finishWhen(() => f.launches.length >= 2);
  const outcome = await f.port.run(f.request('wall'));
  expect(outcome).toMatchObject({ state: 'complete', contextRecovery: 'wall' });
  expect(f.launches).toHaveLength(2); expect(f.delivered).toHaveLength(1);
  expect(f.restores[0]).toMatchObject({ operation: 'wall' });
  expect(f.controls).toEqual(['compact', 'close']);
  expect(f.events('recovery').at(-1)).toMatchObject({ failureType: 'context_exhaustion', recovered: true });
  expect(f.state().inputs[0]).toMatchObject({ contextRecovery: 'continued' });
  await f.port.close();
});

it('a refused compaction settles the input uncertain and never launches a replacement', async () => {
  const f = liveWorker();
  f.wall('context-too-long'); f.compaction('refused');
  f.finishWhen(() => true);
  const outcome = await f.port.run(f.request('wall'));
  expect(outcome).toMatchObject({ state: 'uncertain' });
  expect(outcome.detail).toContain('compaction refused; no automatic replacement');
  expect(f.launches).toHaveLength(1); expect(f.state().worker).toBeNull();
  await f.port.close();
});

it('a context wall after the ladder is exhausted retains the input as uncertain instead of looping', async () => {
  const f = liveWorker({ recovery: { maxAttempts: 1 } });
  f.wall('context-too-long');
  f.finishWhen(() => true);
  expect(await f.port.run(f.request('first'))).toMatchObject({ state: 'complete' });
  f.wall('context-too-long');
  const outcome = await f.port.run(f.request('second'));
  expect(outcome).toMatchObject({ state: 'uncertain' });
  expect(outcome.detail).toContain('exhausted or in cooldown');
  expect(f.controls.filter(action => action === 'compact')).toHaveLength(1);
  await f.port.close();
});


it.each(['exit', 'stall', 'error-loop', 'context-wall'])('%s reaches the checkout observer after exact retirement and before replacement', async origin => {
  const observations: { worker: unknown; claim: unknown; control: unknown; launches: number }[] = [];
  const f = liveWorker({ retiredWorktree: async () => {
    observations.push({ worker: f.state().worker, claim: f.state().claim,
      control: f.controls.at(-1), launches: f.launches.length });
  } });
  if (origin === 'stall') f.transcript(stalled(f.now()));
  if (origin === 'error-loop') f.transcript(looping(f.now()));
  if (origin === 'context-wall') { f.wall('context-too-long'); f.compaction('replace-required'); }
  f.finishWhen(() => { if (origin === 'exit' && f.launches.length === 1) f.loseWorker(); return f.launches.length >= 2; });
  expect(await f.port.run(f.request('checkout-origin'))).toMatchObject({ state: 'complete' });
  expect(observations).toEqual([{ worker: null, claim: null, control: 'close', launches: 1 }]);
  expect(f.launches).toHaveLength(2);
  // Close invokes the observer again, after the asserted loss-to-replacement interval.
  await f.port.close();
});

it('unconfirmed process cleanup never reaches the checkout observer', async () => {
  let observations = 0;
  const f = liveWorker({ retiredWorktree: async () => { observations++; },
    resources: { admit: async () => ({ attach: async () => {}, release: async () => false }) } });
  f.transcript(looping(f.now()));
  const result = await f.port.run(f.request('uncertain-cleanup'));
  expect(result.state).toBe('uncertain');
  expect(observations).toBe(0);
});
