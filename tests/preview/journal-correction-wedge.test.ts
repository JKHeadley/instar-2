import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

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

const world = (root: string, summaryAnswers: boolean) => {
  const calls: Input[] = [], sent: string[] = [];
  const ports = { now: () => start + 20 * 60_000, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => {
      calls.push(input);
      if (input.id.startsWith('summary:')) {
        if (!summaryAnswers) return { state: 'complete' as const, failureClass: 'malformed' as const };
        const packet = JSON.parse(input.context) as { reminders?: { id: string; quote: string }[] };
        return JSON.stringify({ summary: 'The operator asked for a reminder and then cancelled it.', people: [], memory: [],
          commitments: [], questions: [], cancelReminders: (packet.reminders ?? []).filter(item => item.quote.includes('bird feeder')).map(item => item.id) });
      }
      if (input.question === feeder)
        return JSON.stringify({ reply: 'Okay, 12:30 pm today.', memory: [], dated: [{ quote: feeder, when: 'today at 12:30 pm', remind: true }] });
      if (input.question === cancel) {
        const listed = (JSON.parse(input.context) as { reminders?: { id: string; quote: string }[] }).reminders ?? [];
        return JSON.stringify({ reply: 'Okay.', memory: [], dated: [],
          cancelReminders: listed.filter(item => item.quote.includes('bird feeder')).map(item => item.id) });
      }
      return JSON.stringify({ reply: `Answered: ${input.question}`, memory: [], dated: [] });
    },
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
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
