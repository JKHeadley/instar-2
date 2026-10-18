import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openRequests, reminderId } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';

// Exact model bytes from the proof-room journal; the runner's metadata records train-59, not the brief's train-61.
const capture = JSON.parse(readFileSync(new URL('./fixtures/cancel-deliveries-live-2026-10-17.json', import.meta.url), 'utf8')) as {
  turns: { id: string; update: number; at: number; text: string; output: string; reply: string }[] };
const [feeder, plumber, cancel] = capture.turns;
const key = new Uint8Array(32).fill(73);
const genesis = { kind: 'genesis' as const, bot: '8989505249', chat: '7812716706', operator: '7812716706',
  grant: 'grant:cancel-deliveries', configurationDigest: 'sha256:cancel-deliveries', expires: cancel!.at + 86400000,
  maxCalls: 100, maxReplies: 100, maxTurns: 60, maxBytes: 40000, cursor: 0 };
const valueOf = (raw: string) => {
  const read = readAnswer(raw);
  if (!read.ok) throw Error(read.defect);
  return read.value;
};
type Proposal = { reply: string; cancelDeliveries?: { id: string | number; quote: string }[]; cancelReminders?: unknown };
const recorded = () => JSON.parse(valueOf(cancel!.output)) as Proposal;

async function replay(answer: string | { state: 'uncertain' }, cancelled: boolean, due = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'cancel-deliveries-live-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis);
  let now = feeder!.at;
  const sent: string[] = [], consumed: string[] = [];
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async input => {
      consumed.push(input.id);
      const turn = capture.turns.find(t => t.id === input.id);
      if (turn === cancel) {
        expect(JSON.parse(input.context).reminders.map((r: { id: string }) => r.id)).toContain('reminder-1f91820188');
        return answer;
      }
      if (turn) return valueOf(turn.output);
      // Due-turn reply is a supporting stub; cancellation itself always replays captured model bytes.
      return JSON.stringify({ reply: 'Time to call the plumber.', memory: [], dated: [] });
    }, checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; } });
  try {
    for (const turn of capture.turns) {
      now = turn.at;
      worker.intake([{ update_id: turn.update, message: { chat: { id: 7812716706, type: 'private' },
        from: { id: 7812716706 }, text: turn.text, date: Math.floor(now / 1000) } }]);
      // The live cancellation arrived after the summary had stopped resolving memory questions.
      if (turn === cancel) journal.append({ kind: 'memory-undecided', id: turn.id, reason: 'summary-failed', at: now });
      await worker.drain();
    }
    expect(consumed).toContain(cancel!.id);
    expect(journal.view.reminderCancels).toHaveLength(cancelled ? 1 : 0);
    expect(openRequests(journal.view).map(reminderId)).toEqual(cancelled
      ? ['reminder-e28cf75698'] : ['reminder-1f91820188', 'reminder-e28cf75698']);
    if (cancelled) {
      expect(journal.view.turns.get(cancel!.id)?.memoryPending).toBeUndefined();
      expect(sent.at(-1)).toContain('bird feeder');
    }
    journal.close();
    const reopened = openPreviewJournal(path, key);
    try {
      expect(reopened.view.reminderCancels).toEqual(journal.view.reminderCancels);
      expect(openRequests(reopened.view).map(reminderId)).toEqual(openRequests(journal.view).map(reminderId));
      const afterRestart: string[] = [];
      const restarted = createJournalWorker(reopened, { now: () => now, stopped: () => false,
        model: async () => JSON.stringify({ reply: 'Time to call the plumber.', memory: [], dated: [] }),
        checkOutbound: () => {}, send: async input => { afterRestart.push(input.expectedText); return 100 + afterRestart.length; } });
      await restarted.drain();
      expect(afterRestart).toEqual([]);
      if (due) {
        now = Date.UTC(2026, 9, 17, 16, 52);
        await restarted.sendRequested(); await restarted.drain(); await restarted.sendRequested();
        const dueTurns = reopened.view.order.filter(t => t.requestedAction);
        expect(dueTurns).toHaveLength(1);
        expect(dueTurns[0]!.requestedAction!.items).toHaveLength(1);
        expect(afterRestart.join(' ')).toContain('plumber');
        expect(afterRestart.join(' ')).not.toContain('bird feeder');
      }
    } finally { reopened.close(); }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}

it('applies update 6234241 through the existing cancellation floor, persists it and sends only the surviving request once', async () => {
  expect(recorded().cancelDeliveries).toEqual([{ id: 'reminder-1f91820188', quote: cancel!.text }]);
  await replay(valueOf(cancel!.output), true, true);
});

it.each(['unlisted', 'unquoted', 'numeric-commitment', 'no-decision', 'too-many', 'malformed-primary'] as const)(
  'keeps both requests when the recorded cancellation has %s evidence', async mode => {
    const answer = recorded();
    if (mode === 'unlisted') answer.cancelDeliveries![0]!.id = 'reminder-unknown';
    if (mode === 'unquoted') answer.cancelDeliveries![0]!.quote = answer.reply;
    if (mode === 'numeric-commitment') answer.cancelDeliveries![0]!.id = 1;
    if (mode === 'no-decision') answer.cancelDeliveries = [];
    if (mode === 'too-many') answer.cancelDeliveries = Array.from({ length: 11 }, () => answer.cancelDeliveries![0]!);
    if (mode === 'malformed-primary') answer.cancelReminders = 'invalid';
    await replay(JSON.stringify(answer), false);
  });

it.each(['empty', 'duplicate'] as const)('combines the captured alias with an %s primary field', async mode => {
  await replay(JSON.stringify({ ...recorded(), cancelReminders: mode === 'empty' ? [] : recorded().cancelDeliveries }), true);
});

const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
it.each(shapes.otherShapes)('never turns recorded $kind ($id) into a reminder withdrawal', async shape => {
  await replay(shape.kind === 'summary-uncertain' ? JSON.parse(shape.raw) as { state: 'uncertain' } : shape.raw, false);
});
