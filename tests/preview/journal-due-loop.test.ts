// Plan row #548 (observer #179): a deferred task that falls due RUNS on its schedule whatever the chat connection is
// doing; only DELIVERING its result needs Telegram, and the result waits durably in the journal until a reply carries
// it. These tests drive the runner's own loop pieces (createOrdinaryLane, sentinelCycle, waitWorking and the poll
// breaker of poll-failure-reason.mjs, all as journal-agent.mjs wires them) with every poll failing for the whole due
// window, on the live D1 deferral, so the work runs on its slot, nothing is sent while the connection is down, and the
// result reaches the operator exactly once after it recovers, also across a restart while the result waits.
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, obligationSchedule, openPreviewJournal } from './journal-test-worker.js';
import { createOrdinaryLane, sentinelCycle, untilStopped, waitWorking, WORK_TICK_MS } from './live-sentinels.js';
import { loopHealth } from './obligations.js';
// @ts-expect-error The poll breaker is a JS host module.
import { exhaustedPollReason, pollBackoffMs, pollEndsRun, temporaryPollStatus } from './poll-failure-reason.mjs';

const key = new Uint8Array(32).fill(73);
const T0 = 1791059512000, MINUTE = 60_000, REVISIT = 15 * MINUTE;
/** The live D1 message (update 6231951), verbatim. */
const D1 = 'Please do not answer this one now. Keep it as an open item: think over which three of the things I have told you matter most for planning my week, and give me that answer in a later message, not in this reply. For now just confirm you have it as an open item.';
const HOLD = 'Got it — holding this as an open item. I won\'t answer it now; in a later message I\'ll give you the three things from what you\'ve told me that matter most for planning your week.';
const RESULT = 'The three that matter most for your week: the Thursday dentist visit, the invoice due Friday, and your sister\'s visit.';

/** One runner over `root`. `deferred` says the D1 deferral was already answered (a relaunch over the same journal). */
function world(root: string, clock: { now: number }, deferred = false) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '8989505249', chat: '7812716706',
    operator: '7812716706', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 1000, maxReplies: 1000, maxTurns: 1000, maxBytes: 409600, cursor: 0, loopRevisitMs: REVISIT });
  const sent: string[] = [], work: number[] = [];
  let answered = deferred;
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    prepareModel: input => input.context,
    model: async input => {
      if (input.id.startsWith('obligation:')) { work.push(clock.now); return JSON.stringify({ outcome: 'report', report: RESULT }); }
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Earlier turns.', people: [], commitments: [], closed: [], memory: [] });
      if (!answered) { answered = true; return JSON.stringify({ reply: HOLD, memory: [], openLoops: [{ kind: 'deferral', quote: HOLD, waitsOn: 'nothing' }] }); }
      return JSON.stringify({ reply: 'Hi! What can I help you with?', memory: [] });
    },
    // The connection is the test's: a send while it is down never reaches the operator.
    send: async input => { if (!online.value) throw Error('Telegram unreachable'); sent.push(input.text); return sent.length; },
    checkOutbound: () => {} });
  const online = { value: true };
  // journal-agent.mjs's work job: the cycle's drain, then one bounded obligation step (workCycle).
  const lane = createOrdinaryLane({ elapsed: () => clock.now, peerCurrent: () => true, after: () => {} });
  const workCycle = () => { sentinelCycle(lane, { tick: () => {}, requested: [], drain: () => worker.drain(),
    after: async () => { try { await worker.workObligations(); } catch { /* as the runner: the start stays durable */ } } }); };
  let update = deferred ? 6231960 : 6231951;
  const say = async (text: string) => {
    worker.intake([{ update_id: update++, message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain();
  };
  return { journal, worker, sent, work, online, lane, workCycle, say };
}

/** The runner's poll loop while the connection is down: every attempt fails unreachable, never ends the run, and its
 * backoff (pollBackoffMs, capped at 30 s) is waited out with waitWorking offering the work job. Fake time advances
 * with each wait; the lane's job gets real turns of the event loop to finish its step. */
async function pollDownUntil(w: ReturnType<typeof world>, clock: { now: number }, end: number) {
  let failed = 0;
  const delay = async (ms: number) => { clock.now += ms; await new Promise(done => setImmediate(done)); };
  while (clock.now < end) {
    failed++;
    expect(pollEndsRun(failed, 0, true)).toBeNull();
    await waitWorking({ elapsed: () => clock.now, delay, stopped: () => false, work: w.workCycle }, pollBackoffMs(failed, false));
  }
  await w.lane.settle();
  return failed;
}

it('a due step runs on its slot while every poll fails for the whole due window; its result is delivered once after recovery', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-due-loop-')));
  const clock = { now: T0 };
  try {
    const w = world(root, clock);
    await w.say(D1);
    expect(w.sent.at(-1)).toContain('holding this as an open item');
    const id = w.journal.view.commitments.findIndex(note => note.quote === HOLD), item = `commitment:${String(id)}`;
    const slot = obligationSchedule(w.journal.view).find(entry => entry.key === item)!.slot;
    const sends = w.sent.length;
    // The connection goes down now, and stays down through the revisit and the live check's ten-minute margin.
    w.online.value = false;
    const failed = await pollDownUntil(w, clock, slot + 10 * MINUTE);
    // Long enough to have exhausted the old in-process breaker (the run used to end at 20 failures in a row).
    expect(failed).toBeGreaterThan(20);
    expect(exhaustedPollReason(failed, 0)).not.toBeNull();
    // The step started on its slot, to within one work tick, and its model call finished: exactly one step.
    expect(w.work).toHaveLength(1);
    expect(w.work[0]).toBeGreaterThanOrEqual(slot);
    expect(w.work[0]! - slot).toBeLessThanOrEqual(WORK_TICK_MS);
    expect(w.journal.view.obligationWork[item]).toMatchObject({ outcome: 'report' });
    // Nothing reached the operator while the connection was down; the result waits durably, and status says so.
    expect(w.sent).toHaveLength(sends);
    expect(loopHealth(w.journal.view, clock.now)).toMatchObject({ awaitingDelivery: 1, workInFlight: 0, dueWork: 0,
      deliveryInhibition: 'no grant for unsolicited sends; 1 finished result waits for your next message' });
    // The connection recovers and the operator writes: the reply carries the result exactly once.
    w.online.value = true;
    clock.now += MINUTE;
    await w.say('hi');
    expect(w.sent.at(-1)).toContain('Follow-up on "');
    expect(w.sent.at(-1)!.split(RESULT)).toHaveLength(2);
    expect(loopHealth(w.journal.view, clock.now).awaitingDelivery).toBe(0);
    // Never again: the next reply does not repeat it, and further ticks start no new step for the delivered work.
    clock.now += MINUTE;
    await w.say('thanks');
    expect(w.sent.at(-1)).not.toContain(RESULT);
    expect(w.sent.filter(text => text.includes(RESULT))).toHaveLength(1);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120_000);

it('a restart while the finished result waits for the connection still delivers it exactly once', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-due-loop-restart-')));
  const clock = { now: T0 };
  try {
    const w = world(root, clock);
    await w.say(D1);
    const id = w.journal.view.commitments.findIndex(note => note.quote === HOLD), item = `commitment:${String(id)}`;
    const slot = obligationSchedule(w.journal.view).find(entry => entry.key === item)!.slot;
    w.online.value = false;
    await pollDownUntil(w, clock, slot + 10 * MINUTE);
    expect(w.work).toHaveLength(1);
    expect(loopHealth(w.journal.view, clock.now).awaitingDelivery).toBe(1);
    // The process ends with the result waiting; a new launch replays the journal, still offline at first.
    w.journal.close();
    clock.now += 5 * MINUTE;
    const again = world(root, clock, true);
    again.online.value = false;
    await pollDownUntil(again, clock, clock.now + 5 * MINUTE);
    // The finished work is not redone and the result still waits.
    expect(again.work).toHaveLength(0);
    expect(loopHealth(again.journal.view, clock.now)).toMatchObject({ awaitingDelivery: 1, workInFlight: 0, dueWork: 0 });
    again.online.value = true;
    clock.now += MINUTE;
    await again.say('hi');
    expect(again.sent.at(-1)).toContain('Follow-up on "');
    expect(again.sent.at(-1)!.split(RESULT)).toHaveLength(2);
    clock.now += MINUTE;
    await again.say('thanks');
    expect(again.sent.filter(text => text.includes(RESULT))).toHaveLength(1);
    expect(loopHealth(again.journal.view, clock.now).awaitingDelivery).toBe(0);
    again.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120_000);

it('the poll breaker ends the run only on a sustained conflict or refusal, never on an unreachable connection', () => {
  // Both sides of the decision: unreachable stays up past any count; a definite refusal or conflict still ends it.
  expect(pollEndsRun(19, 0, false)).toBeNull();
  expect(pollEndsRun(20, 0, false)).toBe('Telegram polling failed 20 times in a row');
  expect(pollEndsRun(20, 0, true)).toBeNull();
  expect(pollEndsRun(500, 0, true)).toBeNull();
  expect(pollEndsRun(5, 5, false)).toBe('Telegram polling conflict after 5 attempts');
  expect(pollEndsRun(5, 5, true)).toBe('Telegram polling conflict after 5 attempts');
  expect([1, 2, 8, 9, 100].map(n => pollBackoffMs(n, false))).toEqual([250, 500, 30000, 30000, 30000]);
  expect(pollBackoffMs(9, true)).toBe(2000);
});

it('a temporary server failure is an outage like no answer; a conflict or an authorization refusal stays definite', () => {
  // Unit review MUST-FIX 1: 5xx and 429 keep the run going; 401, 403, 404, 400 and 409 do not count as temporary.
  for (const status of [500, 502, 503, 504, 599, 429]) expect(temporaryPollStatus(status)).toBe(true);
  for (const status of [200, 400, 401, 403, 404, 409, 600, Number.NaN, undefined]) expect(temporaryPollStatus(status)).toBe(false);
  expect(pollEndsRun(20, 0, temporaryPollStatus(503))).toBeNull();
  expect(pollEndsRun(20, 0, temporaryPollStatus(401))).toBe('Telegram polling failed 20 times in a row');
});

it('waitWorking offers the work job at most once per tick for the whole wait, and stops at a stop', async () => {
  const clock = { now: 0 }, offered: number[] = [];
  const delay = async (ms: number) => { clock.now += ms; };
  await waitWorking({ elapsed: () => clock.now, delay, stopped: () => false, work: () => { offered.push(clock.now); } }, 30_000);
  expect(clock.now).toBe(30_000);
  expect(offered).toHaveLength(30);
  expect(offered.every((at, i) => i === 0 || at - offered[i - 1]! >= WORK_TICK_MS)).toBe(true);
  // A throwing submission does not end the wait, and a stop ends it at once.
  let calls = 0;
  await waitWorking({ elapsed: () => clock.now, delay, stopped: () => calls >= 2, work: () => { calls++; throw Error('lane refused'); } }, 30_000);
  expect(calls).toBe(2);
  expect(clock.now).toBeLessThan(60_000);
});

// The 2026-10-05 gate (two-machine-floors, the stop floor): under load the operator's stop latched while the runner's
// minimal step was awaited, the worker's gate refused by throwing, and the stopped runner exited 1 instead of 0.
it('a stop that latches during the minimal step ends the loop cleanly; the same refusal without a stop is rethrown', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-due-loop-stop-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '8989505249', chat: '7812716706',
      operator: '7812716706', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 409600, cursor: 0 });
    const stop = { file: false, ended: false };
    const worker = createJournalWorker(journal, { now: () => T0, stopped: () => stop.file, model: async () => '{}',
      send: async () => 1, checkOutbound: () => {} });
    // The stop file appears while the step is awaited: the worker's own gate refuses it by throwing.
    const step = async () => { worker.gate(); await Promise.resolve(); stop.file = true; await worker.minimal(); };
    await expect(step()).rejects.toThrow('preview stopped');
    stop.file = false;
    // As the runner wires it: the loop's stop condition holds, so the refusal is that stop and the loop ends cleanly.
    expect(await untilStopped(step, () => stop.file)).toBe(false);
    stop.file = false;
    // No stop and no refusal: the step ran.
    expect(await untilStopped(() => worker.gate(), () => stop.file)).toBe(true);
    // The other side: a refusal while the loop's stop condition does NOT hold is a real failure, rethrown unchanged.
    await expect(untilStopped(step, () => stop.ended)).rejects.toThrow('preview stopped');
    await expect(untilStopped(() => { throw Error('lane failed'); }, () => true)).resolves.toBe(false);
    await expect(untilStopped(() => { throw Error('lane failed'); }, () => false)).rejects.toThrow('lane failed');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
