import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

// Live proof room 2 of 2026-10-07 (root proofroom2-q-20261007-135832, build f3299d37; group Q results
// Q-proofroom2-20261007-153049 and -153506). The root reported "13 unresolved operator memory corrections" with
// `summaryThrough` 6232683 and `lastSummaryFailure` {through: 6232684, reason: 'malformed'}: thirteen turns were
// latched `memoryPending` by failed summaries, and no accepted summary ever named them in `memoryFor`, so
// `pendingMemory()` stayed truthy for the life of the root. Update 6232680 stayed held "memory correction pending"
// for over 90 minutes (status `holds`), update 6232688's answer missed the 120 s MINIMAL_WORKER_WAIT_MS floor
// (Q77c FAIL) because a held turn is not eligible for the minimal path, and update 6232689 -- a plain "Quick check
// from the desk: are you there?" -- was held "earlier turn pending" (Q77d FAIL, `heldRepliesToday`
// {update: 6232689, reasons: ['earlier turn pending']}).
//
// `settleExhaustedEdit` cannot reach this case: its counter (`summaryFormatFailures`) is cleared by every accepted
// summary, so on a root that keeps summarizing successfully the two-failure threshold never arrives. The records
// below replay that exact shape: a failed summary naming the turn, then an ACCEPTED summary at a later frontier
// whose `memoryFor` does not name it.
const key = new Uint8Array(32).fill(43);
const start = Date.UTC(2026, 9, 7, 22, 0);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:passed-frontier', configurationDigest: 'sha256:passed-frontier', expires: Date.UTC(2026, 10, 10),
  maxCalls: 60, maxReplies: 30, maxTurns: 30, maxBytes: 12000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(start / 1000) + id * 60 } });
const locker = 'Actually my gym locker code is 4412, not 3310.';
const plain = 'Quick check from the desk: are you there? One short sentence is plenty.';
type Input = { id: string; question: string; context: string };

const world = (root: string, clock = { now: start + 20 * 60_000 }) => {
  const calls: Input[] = [], sent: string[] = [];
  const ports = { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => {
      calls.push(input);
      // The live root's own failure shape for the frontier that would decide the correction.
      if (input.id.startsWith('summary:')) return { state: 'complete' as const, failureClass: 'malformed' as const };
      return JSON.stringify({ reply: `Answered: ${input.question}`, memory: [], dated: [] });
    },
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  return { journal, worker: createJournalWorker(journal, ports), calls, sent };
};
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-passed-frontier-${name}-`)));

/** The live latch: a failed summary marks the correction `memoryPending`, then an accepted summary moves the
 * frontier past it without naming it. */
const latch = (w: ReturnType<typeof world>, correctionId: string, failedAt: number, acceptedAt: number) => {
  w.journal.append({ kind: 'summary-reserve', through: failedAt, at: start });
  w.journal.append({ kind: 'summary-failed', format: 1, through: failedAt, memoryPendingFor: correctionId,
    reason: 'malformed', state: 'complete', failureClass: 'malformed', at: start });
  w.journal.append({ kind: 'summary-reserve', through: acceptedAt, at: start });
  w.journal.append({ kind: 'summary', through: acceptedAt, text: 'The operator asked a few things.',
    people: [], memory: [], commitments: [], questions: [], state: 'complete', at: start });
};

it('settles a memory correction an accepted summary frontier has passed, and answers the plain question behind it', async () => {
  const root = tmp('wedged');
  try {
    const w = world(root);
    w.worker.intake([update(1, 'Hello.')]); await w.worker.drain();
    w.worker.intake([update(2, locker)]); await w.worker.drain();
    const correction = w.journal.view.order[1]!;
    latch(w, correction.id, 2, 3);
    expect(correction.memoryPending).toBe(true);
    expect(w.journal.view.summaries.some(summary => summary.memoryFor?.includes(correction.id))).toBe(false);
    // Before the fix this hung the root: the plain question was held "earlier turn pending" with no reply.
    w.worker.intake([update(4, plain)]); await w.worker.drain();
    expect(correction.memoryUndecided).toBe(true);
    const question = w.journal.view.order.find(turn => turn.text === plain)!;
    expect(question.held).toBeUndefined();
    expect(question.intent).toBeDefined();
    expect(w.sent.some(text => text.includes(`Answered: ${plain}`))).toBe(true);
    // Rule 7 still holds: settling undecided records that the judgment could not be reached; it never applies the
    // correction, so no corrected-away clause is committed as fact.
    expect(w.journal.view.memory).toEqual([]);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);

it('leaves the correction pending, and the later turn held, while the accepted frontier is still behind it', async () => {
  const root = tmp('reachable');
  try {
    const w = world(root);
    w.worker.intake([update(1, 'Hello.')]); await w.worker.drain();
    w.worker.intake([update(2, locker)]); await w.worker.drain();
    const correction = w.journal.view.order[1]!;
    // The same failed summary, but the accepted frontier stops BEFORE the correction, so a later summary can
    // still re-ask about it: a reachable judgment is never cut short. (A deciding summary still IN FLIGHT is
    // settled by the pre-existing `summary-uncertain` path, not by this one; the guard below keeps this settle
    // out of that case.)
    w.journal.append({ kind: 'summary-reserve', through: 1, at: start });
    w.journal.append({ kind: 'summary', through: 1, text: 'The operator said hello.',
      people: [], memory: [], commitments: [], questions: [], state: 'complete', at: start });
    w.journal.append({ kind: 'summary-reserve', through: 2, at: start });
    w.journal.append({ kind: 'summary-failed', format: 1, through: 2, memoryPendingFor: correction.id,
      reason: 'malformed', state: 'complete', failureClass: 'malformed', at: start });
    expect(correction.memoryPending).toBe(true);
    expect(w.journal.view.summaryReservations.size).toBe(0);
    w.worker.intake([update(5, plain)]); await w.worker.drain();
    expect(correction.memoryUndecided).toBeUndefined();
    expect(correction.held).toBe('memory correction pending');
    expect(w.journal.view.order.find(turn => turn.text === plain)!.held).toBe('earlier turn pending');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);

it('never settles a correction an accepted summary actually decided', async () => {
  const root = tmp('decided');
  try {
    const w = world(root);
    w.worker.intake([update(1, 'Hello.')]); await w.worker.drain();
    w.worker.intake([update(2, locker)]); await w.worker.drain();
    const correction = w.journal.view.order[1]!;
    w.journal.append({ kind: 'summary-reserve', through: 2, at: start });
    w.journal.append({ kind: 'summary-failed', format: 1, through: 2, memoryPendingFor: correction.id,
      reason: 'malformed', state: 'complete', failureClass: 'malformed', at: start });
    w.journal.append({ kind: 'summary-reserve', through: 3, at: start });
    w.journal.append({ kind: 'summary', through: 3, text: 'The operator corrected the locker code.',
      people: [], memory: [], commitments: [], questions: [], memoryFor: [correction.id], state: 'complete', at: start });
    w.worker.intake([update(4, plain)]); await w.worker.drain();
    // Decided by its own summary: the undecided settle must not fire, and nothing is held.
    expect(correction.memoryUndecided).toBeUndefined();
    expect(correction.held).toBeUndefined();
    expect(w.journal.view.order.find(turn => turn.text === plain)!.held).toBeUndefined();
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);
