import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { loopHealth } from './obligations.js';

// The proof-room sequence of 2026-09-29 (updates 715672485-715672489): an exhausted rolling-summary prefix,
// a same-day reminder, "Actually, cancel the bird feeder one." (a cued memory correction), then ordinary
// turns. Before the fix the correction was never decided, held forever, and every later turn was held
// "earlier turn pending" with no model call (Rule 10; the durable-intake and answer floors).
const key = new Uint8Array(32).fill(41);
const start = Date.UTC(2026, 8, 29, 18, 55); // 11:55 in Los Angeles.
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:correction-wedge', configurationDigest: 'sha256:correction-wedge', expires: Date.UTC(2026, 9, 10),
  maxCalls: 60, maxReplies: 30, maxTurns: 30, maxBytes: 12000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(start / 1000) + id * 60 } });
const feeder = 'Remind me today at 12:30 pm to refill the bird feeder';
const cancel = 'Actually, cancel the bird feeder one.';
type Input = { id: string; question: string; context: string };

const walk = 'Remind me today at 12:45 pm to take a short walk';
const locker = 'Actually my gym locker code is 4412, not 3310.';

const world = (root: string, summaryAnswers: boolean, clock = { now: start + 20 * 60_000 }, first = true) => {
  const calls: Input[] = [], sent: string[] = [];
  const ports = { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => {
      calls.push(input);
      if (input.id.startsWith('summary:')) {
        if (!summaryAnswers) return { state: 'complete' as const, failureClass: 'malformed' as const };
        const packet = JSON.parse(input.context) as { reminders?: { id: string; quote: string }[] };
        return JSON.stringify({ summary: 'The operator asked for a reminder and then cancelled it.', people: [], memory: [],
          commitments: [], questions: [], cancelReminders: (packet.reminders ?? []).filter(item => item.quote.includes('bird feeder')).map(item => item.id) });
      }
      if (input.question === walk)
        return JSON.stringify({ reply: 'Okay, 12:45 pm today.', memory: [], dated: [{ quote: walk, when: 'today at 12:45 pm', remind: true }] });
      if (input.question === feeder)
        return JSON.stringify({ reply: 'Okay, 12:30 pm today.', memory: [], dated: [{ quote: feeder, when: 'today at 12:30 pm', remind: true }] });
      if (input.question === cancel) {
        const listed = (JSON.parse(input.context) as { reminders?: { id: string; quote: string }[] }).reminders ?? [];
        // The answer path now admits a cancellation only against the operator's own withdrawing words.
        return JSON.stringify({ reply: 'Okay.', memory: [], dated: [],
          cancelReminders: listed.filter(item => item.quote.includes('bird feeder'))
            .map(item => ({ id: item.id, quote: 'cancel the bird feeder one' })) });
      }
      return JSON.stringify({ reply: `Answered: ${input.question}`, memory: [], dated: [] });
    },
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  const journal = first ? openPreviewJournal(join(root, 'journal.encrypted'), key, genesis) : openPreviewJournal(join(root, 'journal.encrypted'), key);
  return { journal, worker: createJournalWorker(journal, ports), calls, sent };
};
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-correction-wedge-${name}-`)));

it('settles a cued correction behind an exhausted summary prefix as undecided, cancels the reminder, and answers every later turn', async () => {
  const root = tmp('exhausted');
  try {
    const w = world(root, false);
    for (const [id, text] of [[1, 'Hello.'], [2, 'What is a good bird seed?'], [3, 'How tall do sunflowers grow?'], [4, 'Thanks.']] as const) {
      w.worker.intake([update(id, text)]); await w.worker.drain();
    }
    // The rolling summary through the oldest prefix fails twice, as it did on the proof room (715672482).
    await w.worker.summarizeIfNeeded(true); await w.worker.summarizeIfNeeded(true);
    expect([...w.journal.view.summaryFailures.values()]).toEqual([2]);
    w.worker.intake([update(5, feeder)]); await w.worker.drain();
    expect(w.journal.view.dated).toMatchObject([{ quote: feeder, remind: true }]);
    w.worker.intake([update(6, cancel)]); await w.worker.drain();
    const correction = w.journal.view.order[5]!;
    expect(correction.memoryUndecided).toBe(true);
    expect(correction.held).toBeUndefined();
    expect(correction.intent).toBeDefined();
    // The cancel is decided by the answer, which is offered the open reminder.
    expect(w.journal.view.reminderCancels).toHaveLength(1);
    expect(w.sent.at(-1)).toContain('Cancelled request');
    const before = w.calls.length;
    w.worker.intake([update(7, 'My garden shed padlock code is 2958.')]); await w.worker.drain();
    w.worker.intake([update(8, 'What should I plant next week?')]); await w.worker.drain();
    expect(w.calls.length).toBeGreaterThan(before);
    for (const turn of w.journal.view.order.slice(6)) {
      expect(turn.held).toBeUndefined();
      expect(turn.intent).toBeDefined();
    }
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20000);

it('recovers a journal already wedged by the old build: the next drain settles the held correction with no hand edit', async () => {
  const root = tmp('recover');
  try {
    const w = world(root, false);
    for (const [id, text] of [[1, 'Hello.'], [2, 'What is a good bird seed?'], [3, 'How tall do sunflowers grow?'], [4, 'Thanks.']] as const) {
      w.worker.intake([update(id, text)]); await w.worker.drain();
    }
    await w.worker.summarizeIfNeeded(true); await w.worker.summarizeIfNeeded(true);
    w.worker.intake([update(5, feeder)]); await w.worker.drain();
    // The durable state the old build left on the proof room: the correction and a later turn intaken and held.
    w.worker.intake([update(6, cancel), update(7, 'My garden shed padlock code is 2958.')]);
    w.journal.append({ kind: 'hold', id: w.journal.view.order[5]!.id, reason: 'memory correction pending', at: start });
    w.journal.append({ kind: 'hold', id: w.journal.view.order[6]!.id, reason: 'earlier turn pending', at: start });
    await w.worker.drain();
    expect(w.journal.view.order.slice(5).map(turn => [turn.held, turn.intent !== undefined])).toEqual([[undefined, true], [undefined, true]]);
    expect(w.journal.view.reminderCancels).toHaveLength(1);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20000);

it('still decides a cued correction before later turns while its summary judgment is reachable', async () => {
  const root = tmp('reachable');
  try {
    const w = world(root, true);
    w.worker.intake([update(1, feeder)]); await w.worker.drain();
    w.worker.intake([update(2, cancel), update(3, 'What should I plant next week?')]); await w.worker.drain();
    const correction = w.journal.view.order[1]!;
    // Decided by the summary, not settled as undecided; the later turn is answered after it.
    expect(correction.memoryUndecided).toBeUndefined();
    expect(w.journal.view.summaries.some(summary => summary.memoryFor?.includes(correction.id))).toBe(true);
    expect(w.journal.view.reminderCancels).toHaveLength(1);
    expect(w.calls.findIndex(input => input.id.startsWith('summary:')))
      .toBeLessThan(w.calls.findIndex(input => input.question === 'What should I plant next week?'));
    expect(w.journal.view.order[2]!.intent).toBeDefined();
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 20000);

// Live group B on cint-L4 422570a0 (2026-09-29 14:42): "Remind me today at 2:45 pm to take a short walk" was saved
// after three earlier corrections had settled as undecided, and it never fired: any undecided correction anywhere in
// the journal held every requested action forever. An undecided correction can withdraw only a request made before
// it, so it holds that one and never a later one (Rules 29, 57, 93; the no-duplicate-sends floor).
const exhaustedPrefix = async (w: ReturnType<typeof world>) => {
  for (const [id, text] of [[1, 'Hello.'], [2, 'What is a good bird seed?'], [3, 'How tall do sunflowers grow?'], [4, 'Thanks.']] as const) {
    w.worker.intake([update(id, text)]); await w.worker.drain();
  }
  await w.worker.summarizeIfNeeded(true); await w.worker.summarizeIfNeeded(true);
};
const pushes = (sent: string[]) => sent.filter(text => text.startsWith('You asked on'));

it('fires a request made after an undecided correction once at its due minute through the scheduler writer, and never again after a restart', async () => {
  const root = tmp('due-after-undecided');
  try {
    const clock = { now: start + 20 * 60_000 };
    let w = world(root, false, clock);
    await exhaustedPrefix(w);
    w.worker.intake([update(5, feeder)]); await w.worker.drain();
    w.worker.intake([update(6, cancel)]); await w.worker.drain();
    w.worker.intake([update(7, locker)]); await w.worker.drain();
    expect(w.journal.view.order.filter(turn => turn.memoryUndecided).length).toBeGreaterThan(0);
    w.worker.intake([update(8, walk)]); await w.worker.drain();
    expect(w.journal.view.dated.find(item => item.quote === walk)).toMatchObject({ day: '2026-09-29', time: '12:45', remind: true });
    clock.now = Date.UTC(2026, 8, 29, 19, 44); // 12:44: not yet due.
    await w.worker.sendRequested();
    expect(pushes(w.sent)).toEqual([]);
    // The open request is owned work whose due minute wakes the runner (live: nextWorkAt ignored it).
    const waiting = loopHealth(w.journal.view, clock.now);
    expect(waiting.nextWorkAt).toBe(Date.UTC(2026, 8, 29, 19, 45));
    expect(waiting.ownedWork).toBeGreaterThanOrEqual(1);
    clock.now = Date.UTC(2026, 8, 29, 19, 45); // 12:45: due.
    await w.worker.sendRequested();
    const due = w.journal.view.order.filter(turn => turn.requestedAction);
    expect(due).toHaveLength(1);
    expect(due[0]!.writer).toMatchObject({ kind: 'system', id: 'preview-scheduler:12345678' });
    expect(due[0]!.requestedAction!.items.map(item => item.quote)).toEqual([walk]);
    expect(pushes(w.sent)).toHaveLength(1);
    expect(pushes(w.sent)[0]).toContain(walk);
    await w.worker.sendRequested();
    w.journal.close();
    clock.now = Date.UTC(2026, 8, 29, 20, 10); // restart well past the due minute.
    w = world(root, false, clock, false);
    await w.worker.drain(); await w.worker.sendRequested(); await w.worker.sendRequested();
    expect(w.sent).toEqual([]);
    expect(w.journal.view.order.filter(turn => turn.requestedAction)).toHaveLength(1);
    const done = loopHealth(w.journal.view, clock.now);
    expect(done.nextWorkAt).toBeNull();
    expect(done.byKind.request).toBe(0);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);

/** Both sides of the wait. A later correction may have withdrawn an earlier request, so the request waits
 * for that correction's own reply -- and no longer. cint-L27 (w3-cancelpath): the wait used to have no end at
 * all when the correction settled undecided, so one unrecordable correction killed every request made before
 * it. A request the operator really made stands and falls due (Rules 2, 57, 93, 95). */
it('holds a request until the later correction that may have withdrawn it is answered, then fires it once', async () => {
  const root = tmp('undecided-after-due');
  try {
    const clock = { now: start + 20 * 60_000 };
    const w = world(root, false, clock);
    await exhaustedPrefix(w);
    w.worker.intake([update(5, walk)]); await w.worker.drain();
    // The correction is durable but unanswered when the due minute passes: it may have withdrawn the walk.
    w.worker.intake([update(6, locker)]);
    clock.now = Date.UTC(2026, 8, 29, 19, 50);
    await w.worker.sendRequested();
    expect(w.journal.view.order.filter(turn => turn.requestedAction)).toEqual([]);
    expect(pushes(w.sent)).toEqual([]);
    // Now it is answered: settled undecided, with its reply sent. It withdrew nothing.
    await w.worker.drain();
    expect(w.journal.view.order[5]!.memoryUndecided).toBe(true);
    expect(w.journal.view.order[5]!.intent).toBeDefined();
    await w.worker.sendRequested(); await w.worker.sendRequested();
    expect(pushes(w.sent)).toHaveLength(1);
    expect(pushes(w.sent)[0]).toContain(walk);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);
