import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, replyTimings } from './journal-test-worker.js';
import { createOrdinaryLane, sentinelCycle } from './live-sentinels.js';
import { REPLY_RULES } from './reply-check.js';

const key = new Uint8Array(32).fill(43);
const update = (id: number) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text: 'Please answer the question.' } });
const defer = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
const scores = { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(REPLY_RULES)
  .map(id => [id, { type: 'noul', noul: 0.01 }])) };

it('durable intake wakes a busy lane without a tick, then answer, check and send finish in the same drain', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'dispatch-now-'))), path = join(root, 'journal.encrypted');
  const slow = defer(), started = defer();
  let clock = 1000, modelCalls = 0, sends = 0;
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  const ports = { now: () => clock, stopped: () => false, checkOutbound: () => {},
    model: async () => {
      modelCalls++; started.resolve();
      // Verify at the consumer: the input and reservation are readable from disk before the call.
      const durable = openPreviewJournal(path, key, undefined, undefined, true);
      expect(durable.view.order[0]).toMatchObject({ accepted: true, reserved: true }); durable.close();
      clock += 100; return 'Here is the answer.';
    }, replyCheck: { elapsedMs: () => clock,
      jev: async () => { clock += 200; return { value: scores, latencyMs: 200 }; },
      escalate: async () => { throw Error('unexpected escalation'); } },
    send: async () => {
      // No poll or work tick advanced the clock between the check and its send.
      expect(replyTimings(journal.view).perReply[0]?.checkDoneAt).toBe(clock);
      sends++; clock += 50; return 7;
    } };
  const worker = createJournalWorker(journal, ports);
  const lane = createOrdinaryLane({ elapsed: () => clock, peerCurrent: () => true, after: () => {} });
  try {
    lane.submit(() => slow.promise);
    worker.intake([update(1)]);
    const cycle = () => sentinelCycle(lane, { tick: () => {}, requested: [], drain: () => worker.drain(), after: async () => {} }, true);
    expect(cycle()).toBe(false); // Coalesced wake, not a second worker.
    expect(cycle()).toBe(false);
    expect(modelCalls).toBe(0);
    slow.resolve();
    await started.promise; // No cycle/timer call after intake.
    await lane.settle();
    expect(modelCalls).toBe(1); expect(sends).toBe(1);
    expect(replyTimings(journal.view).perReply[0]).toMatchObject({ intakeAt: 1000, turnStartAt: 1000,
      answerAt: 1100, checkDoneAt: 1300, sentAt: 1350 });
    journal.close();
    const replay = openPreviewJournal(path, key);
    expect(replyTimings(replay.view).perReply[0]).toMatchObject({ intakeAt: 1000, turnStartAt: 1000,
      answerAt: 1100, checkDoneAt: 1300, sentAt: 1350 });
    const again = createJournalWorker(replay, ports);
    again.intake([update(1)]); await again.drain();
    expect(modelCalls).toBe(1); expect(sends).toBe(1);
    replay.close();
  } finally { slow.resolve(); await lane.settle(); journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each(['peer', 'stop', 'backoff'] as const)('a retained wake still respects %s admission; the journal remains the retry queue', async reason => {
  const slow = defer(); let allowed = true, clock = 1000, calls = 0;
  const lane = createOrdinaryLane({ elapsed: () => clock, peerCurrent: () => allowed, after: () => {} });
  lane.submit(async () => { await slow.promise; if (reason === 'backoff') throw Error('failed step'); });
  expect(lane.submit(async () => { calls++; }, true)).toBe(false);
  if (reason !== 'backoff') allowed = false;
  slow.resolve(); await lane.settle();
  expect(calls).toBe(0);
  allowed = true; clock += 1000;
  expect(lane.submit(async () => { calls++; }, true)).toBe(true);
  await lane.settle(); expect(calls).toBe(1);
});

it('an idle intake starts immediately, and an ordinary busy submission still does not queue work', async () => {
  const slow = defer(); let calls = 0;
  const lane = createOrdinaryLane({ elapsed: () => 1000, peerCurrent: () => true, after: () => {} });
  expect(lane.submit(async () => { calls++; await slow.promise; }, true)).toBe(true);
  expect(calls).toBe(1);
  expect(lane.submit(async () => { calls++; })).toBe(false);
  slow.resolve(); await lane.settle(); expect(calls).toBe(1);
});

it('the launcher offers intake before its minimal await, after durable peer sync and read-ahead stop protection', () => {
  const source = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
  const intake = source.slice(source.indexOf('      worker.intake(batch);'));
  const wake = intake.indexOf('if (batch.length > 0) workCycle(false, true)');
  expect(wake).toBeGreaterThan(intake.indexOf('await shared.sync()'));
  expect(wake).toBeGreaterThan(intake.indexOf('worker.readAhead()'));
  expect(wake).toBeGreaterThan(intake.indexOf('const minimalStep = untilStopped(() => worker.minimal(), ended)'));
  expect(wake).toBeLessThan(intake.indexOf('await minimalStep'));
  expect(source).toContain('!signalled && !workerStop.value && !existsSync(stopPath) && !journal.view.stop');
  expect(source).toContain('ownerHeld() && activationMatchesJournal(journal.view, activation)');
});

it('immediate dispatch and the minimal path do not duplicate a stop confirmation', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'dispatch-now-stop-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '12345678', chat: '7654321',
    operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  let sends = 0;
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
    model: async () => { throw Error('stop must not call the answer model'); }, checkOutbound: () => {},
    replyCheck: { elapsedMs: () => 1000, jev: async () => ({ value: scores, latencyMs: 0 }),
      escalate: async () => { throw Error('unexpected escalation'); } },
    send: async () => { sends++; return sends; } });
  const lane = createOrdinaryLane({ elapsed: () => 1000, peerCurrent: () => true, after: () => {} });
  try {
    worker.intake([{ ...update(1), message: { ...update(1).message, text: '/stop' } }]);
    const minimalStep = worker.minimal();
    lane.submit(() => worker.drain(), true);
    await minimalStep;
    await lane.settle();
    expect(sends).toBe(1);
  } finally { await lane.settle(); journal.close(); rmSync(root, { recursive: true, force: true }); }
});
