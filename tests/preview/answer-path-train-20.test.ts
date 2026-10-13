import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { memoryReport } from './memory-export.js';
import { memoryHealthLine } from './self-state.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/answer-path-train-20-2026-10-13.json', import.meta.url), 'utf8'));
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const oldId = 'telegram:8994258214:update:715675893', changedId = 'telegram:8994258214:update:715675894';
const oldQuote = 'the desk test word is orchid-383265c47f70', newQuote = 'the desk test word is orchid-a6b3fdb13d0f';
const reminder = 'Remind me on October 14, 2026 at 9 am to water the fern.';

// The desk exported messages, outcomes and the exact failure reason, not the raw
// model frames. These constructed decisions isolate that observed boundary. The
// neighboring memory-update/deferral suites separately replay recorded outputs.
function world(valid = true, withReminder = false) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'answer-path-train-20-')); roots.push(root);
  const path = join(root, 'journal'), key = new Uint8Array(32).fill(98);
  let now = capture.turns[0].at as number;
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '8994258214', chat: '7812716706',
    operator: '7812716706', grant: 'grant:fixture', configurationDigest: 'sha256:fixture', expires: now + 86400000,
    maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 });
  const sends: string[] = [], events: { stage: string; at: number }[] = [];
  const ports = { now: () => now, stopped: () => false, checkOutbound: () => {},
    model: async (input: { id: string; context: string }) => {
      events.push({ stage: input.id.startsWith('summary:') ? 'summary' : 'answer', at: now }); now += 1000;
      if (input.id.startsWith('summary:')) return JSON.stringify({
        summary: `The operator first said ${oldQuote}, then changed it to ${newQuote}.`, people: [],
        memory: [{ mode: 'correct', source: oldId, quote: oldQuote,
          replacement: valid ? newQuote : 'the desk test word is invented' }],
        ...(withReminder ? { cancelReminders: [{ id: JSON.parse(input.context).reminders[0].id, quote: 'Cancel that reminder.' }] } : {}) });
      if (input.id === oldId) return JSON.stringify({ reply: 'Saved.', memory: [{ mode: 'remember', source: oldId, quote: oldQuote }],
        ...(withReminder ? { dated: [{ quote: reminder, when: 'October 14, 2026 at 9 am', remind: true }] } : {}) });
      if (input.id === changedId) return JSON.stringify({ reply: 'Changed.', memory: [{ mode: 'correct', source: 'not-offered',
        quote: oldQuote, replacement: newQuote }], ...(withReminder ? { cancelReminders: [] } : {}) });
      const packet = JSON.parse(input.context);
      expect(packet.memory.some((item: { replacement?: string }) => item.replacement === newQuote)).toBe(true);
      return JSON.stringify({ reply: newQuote, memory: [] });
    }, send: async (input: { expectedText: string }) => {
      events.push({ stage: 'send', at: now }); now += 100;
      sends.push(input.expectedText); return sends.length;
    } };
  const worker = createJournalWorker(journal, ports);
  const intake = (update: number, text: string) => worker.intake([{ update_id: update, message: {
    chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text } }]);
  return { journal, worker, ports, sends, events, intake, path, key };
}

it.each([false, true])('keeps a validated explicit correction before acknowledgement and dependent recall (snapshot=%s)', async snapshot => {
  const w = world();
  try {
    w.intake(715675893, capture.messages.remember); await w.worker.drain();
    w.intake(715675894, capture.messages['remember-update']); await w.worker.drain();
    expect(w.journal.view.order[1]?.held).toBe('memory correction pending');
    expect(w.sends).toHaveLength(1);
    await w.worker.summarizeIfNeeded(true);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe(capture.lastSummaryFailure.reason);
    expect(w.journal.view.summaries).toHaveLength(0);
    expect(w.journal.view.memory.at(-1)).toMatchObject({ mode: 'correct', source: oldId, trigger: changedId, replacement: newQuote });
    expect(memoryHealthLine(w.journal.view)).toContain('0 unresolved operator memory corrections');
    expect(w.journal.view.order[1]?.held).toBeUndefined();
    // Crash after recording the refused summary, before acknowledging its correction.
    if (snapshot) w.journal.compact();
    w.journal.close();
    const reopened = openPreviewJournal(w.path, w.key);
    try {
      const worker = createJournalWorker(reopened, w.ports);
      worker.intake([{ update_id: 715675896, message: {
        chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text: capture.messages.recall } }]);
      await worker.drain(); await worker.drain();
      expect(w.sends).toEqual(['Saved the requested fact.', `Changed ${oldQuote} → ${newQuote}.`, newQuote]);
      expect(reopened.view.memory.filter(item => item.trigger === changedId)).toHaveLength(1);
      expect(reopened.view.order.every(turn => turn.held === undefined && turn.sent !== undefined)).toBe(true);
      expect(memoryReport(reopened.view)).toContain(newQuote);
      expect(memoryReport(reopened.view)).not.toContain(oldQuote);
      expect(w.events.map(event => event.stage)).toEqual(['answer', 'send', 'answer', 'answer', 'summary', 'send', 'answer', 'send']);
      expect(w.events.map(event => event.at - capture.turns[0].at)).toEqual([0, 1000, 1100, 2100, 3100, 4100, 4200, 5200]);
    } finally { reopened.close(); }
  } finally { w.journal.close(); }
});

it('never saves an ungrounded correction merely because recovery returned a structured proposal', async () => {
  const w = world(false);
  try {
    w.intake(715675893, capture.messages.remember); await w.worker.drain();
    w.intake(715675894, capture.messages['remember-update']); await w.worker.drain();
    await w.worker.summarizeIfNeeded(true);
    expect(w.journal.view.memory).toHaveLength(1);
    expect(w.journal.view.summaries).toHaveLength(0);
    expect(w.sends).toEqual(['Saved the requested fact.']);
  } finally { w.journal.close(); }
});

it('retains the validated withdrawal when one message both corrects a fact and cancels a reminder', async () => {
  const w = world(true, true);
  try {
    w.intake(715675893, `${capture.messages.remember}\n${reminder}`); await w.worker.drain();
    expect(w.journal.view.dated).toHaveLength(1);
    w.intake(715675894, `${capture.messages['remember-update']} Cancel that reminder.`); await w.worker.drain();
    await w.worker.summarizeIfNeeded(true);
    expect(w.journal.view.reminderCancels).toHaveLength(1);
    expect(w.journal.view.memory.at(-1)?.replacement).toBe(newQuote);
    w.journal.close();
    const reopened = openPreviewJournal(w.path, w.key);
    try {
      expect(reopened.view.reminderCancels).toHaveLength(1);
      expect(reopened.view.order[1]?.reminderDecided).toBe(true);
      expect(memoryHealthLine(reopened.view)).toContain('0 unresolved operator memory corrections');
    } finally { reopened.close(); }
  } finally { w.journal.close(); }
});
