import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

// Live proof room 2 of 2026-10-07 (root proofroom2-q-20261007-135832, build f3299d37; group Q results
// Q-proofroom2-20261007-153049 and -153506, Q77c and Q77d). Two memory requests stood exhausted in one drain pass
// and `settleExhaustedEdit` settled only the first of them:
//
//   1791412453691  summary-failed through 6232688  (failure 1 of 2 at that frontier)
//   1791412512572  summary-failed through 6232688  (failure 2 of 2 -- exhausted)
//   1791412530108  summary-failed through 6232687
//   1791412530114  memory-undecided 6232687        <- the one settle this pass made
//   1791412530119  hold 6232680 "memory correction pending"
//   1791412530124  hold 6232689 "earlier turn pending"   <- a plain "are you there?"
//   1791412592079  memory-undecided 6232688        <- the next pass, 62 s later
//   1791412603856  sent 6232689                    <- held 73.7 s; an 87,917 ms reply
//
// Both requests satisfied the same exhaustion predicate at 1791412530114 (frontier 6232688 carried two failures and
// the accepted frontier was 6232683, so `through > previous` held for each). The caller's catch-up loop breaks as
// soon as a pass adds no accepted summary, so the request left pending reached the correction hold, set
// `blockedEarlier`, and held the operator's plain question behind it. The predicate is unchanged by the fix; the
// settle now drains every request already exhausted in that pass.
const key = new Uint8Array(32).fill(43);
const start = Date.UTC(2026, 9, 7, 22, 0);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:exhausted-drain', configurationDigest: 'sha256:exhausted-drain', expires: Date.UTC(2026, 10, 10),
  maxCalls: 60, maxReplies: 30, maxTurns: 30, maxBytes: 12000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(start / 1000) + id * 60 } });
const locker = 'Actually my gym locker code is 4412, not 3310.';
const spare = 'Actually, forget the spare key under the mat.';
const plain = 'Quick check from the desk: are you there? One short sentence is plenty.';
type Input = { id: string; question: string; context: string };

const world = (root: string, clock = { now: start + 20 * 60_000 }) => {
  const calls: Input[] = [], sent: string[] = [];
  const ports = { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => {
      calls.push(input);
      // The live root's own summary outcome: malformed, 37 of its 52 summary calls.
      if (input.id.startsWith('summary:')) return { state: 'complete' as const, failureClass: 'malformed' as const };
      return JSON.stringify({ reply: `Answered: ${input.question}`, memory: [], dated: [] });
    },
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  return { journal, worker: createJournalWorker(journal, ports), calls, sent };
};
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-exhausted-drain-${name}-`)));

/** Four ordinary turns, then the rolling summary prefix fails its two attempts, as it did on the proof room. */
const exhaust = async (w: ReturnType<typeof world>, attempts: number) => {
  for (const [id, text] of [[1, 'Hello.'], [2, 'What is a good bird seed?'], [3, 'How tall do sunflowers grow?'], [4, 'Thanks.']] as const) {
    w.worker.intake([update(id, text)]); await w.worker.drain();
  }
  for (let attempt = 0; attempt < attempts; attempt++) await w.worker.summarizeIfNeeded(true);
  expect([...w.journal.view.summaryFailures.values()]).toEqual(attempts === 0 ? [] : [attempts]);
};

it('settles every request an exhausted frontier already covers in one pass, and answers the plain question behind them', async () => {
  const root = tmp('wedged');
  try {
    const w = world(root);
    await exhaust(w, 2);
    // Both corrections and the plain question arrive together, so one drain pass meets both requests -- the live shape.
    w.worker.intake([update(5, locker), update(6, spare), update(7, plain)]);
    await w.worker.drain();
    const first = w.journal.view.order.find(turn => turn.text === locker)!;
    const second = w.journal.view.order.find(turn => turn.text === spare)!;
    const question = w.journal.view.order.find(turn => turn.text === plain)!;
    // Before the fix only `first` settled; `second` stayed pending and held `question` "earlier turn pending".
    expect(first.memoryUndecided).toBe(true);
    expect(second.memoryUndecided).toBe(true);
    expect(first.held).toBeUndefined();
    expect(second.held).toBeUndefined();
    expect(question.held).toBeUndefined();
    expect(question.intent).toBeDefined();
    expect(w.sent.some(text => text.includes(`Answered: ${plain}`))).toBe(true);
    // Constraint 2, nothing that mattered is silently lost: `memoryUndecided` records that the summary judgment could
    // not be reached, so `memoryHealth` keeps counting the request, and each correction is still offered to its own
    // answer rather than dropped. Rule 7: no corrected-away clause is committed from a judgment never reached.
    expect(first.intent).toBeDefined();
    expect(second.intent).toBeDefined();
    expect(w.journal.view.memory).toEqual([]);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);

it('keeps the correction hold while the frontier still has an attempt left, then releases both requests in one pass', async () => {
  const root = tmp('reachable');
  try {
    const w = world(root);
    await exhaust(w, 0);
    w.worker.intake([update(5, locker), update(6, spare), update(7, plain)]);
    // Pass one spends the frontier's first attempt only, so the predicate is still false: a later summary can still
    // decide these requests, and the ordering hold keeps its full discipline while a correction is genuinely pending.
    await w.worker.drain();
    const first = w.journal.view.order.find(turn => turn.text === locker)!;
    const second = w.journal.view.order.find(turn => turn.text === spare)!;
    const question = w.journal.view.order.find(turn => turn.text === plain)!;
    expect([...w.journal.view.summaryFailures.values()]).toEqual([1]);
    expect(first.memoryUndecided).toBeUndefined();
    expect(second.memoryUndecided).toBeUndefined();
    expect(first.held).toBe('memory correction pending');
    expect(question.held).toBe('earlier turn pending');
    // Pass two spends the second attempt and the frontier is exhausted. Both requests are settled in this one pass,
    // so the plain question is answered here -- before the fix it took a third pass, which is the 73.7 s the live
    // root held update 6232689.
    await w.worker.drain();
    expect([...w.journal.view.summaryFailures.values()]).toEqual([2]);
    expect(first.memoryUndecided).toBe(true);
    expect(second.memoryUndecided).toBe(true);
    expect(question.held).toBeUndefined();
    expect(w.sent.some(text => text.includes(`Answered: ${plain}`))).toBe(true);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);
