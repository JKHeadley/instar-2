import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, HELD_NOTICE_AFTER_MS, HELD_NOTICE_WINDOW_MS, OUTBOUND_DISPOSITIONS,
  reminderOverflowLine, summaryOverviewLead } from './journal-test-worker.js';

// Rules 52/87 and P-14: one aggregate per topic and slot, overflow as an overview, no repeat of
// unchanged status, and every push classified at the one send boundary.
const key = new Uint8Array(32).fill(31);
const zone = 'America/Los_Angeles';
const start = Date.UTC(2026, 8, 26, 17);
const sixPm = Date.UTC(2026, 8, 27, 1);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:summary', configurationDigest: 'sha256:summary', expires: Date.UTC(2026, 9, 10),
  maxCalls: 60, maxReplies: 60, maxTurns: 60, maxBytes: 32768, cursor: 0 };
const update = (id: number, text: string, thread?: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    date: Math.floor(start / 1000) + id * 60, ...(thread === undefined ? {} : { message_thread_id: thread }) } });
type Input = { id: string; question: string; context: string };
const decide = (input: Input) => {
  if (input.question.startsWith('[Scheduled summary')) return JSON.stringify({ reply: 'Summary detail. '.repeat(160), memory: [], dated: [] });
  const schedule = /^send me a summary of (today|yesterday) every day at (\d+ ?[ap]m)/u.exec(input.question);
  if (schedule) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [], summaries: [{ quote: input.question,
    when: `every day at ${schedule[2]}`, period: schedule[1], repeat: 'daily' }] });
  const reminder = /^remind me (today at \d+ ?[ap]m) to /u.exec(input.question);
  if (reminder) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: input.question, when: reminder[1], remind: true }] });
  return JSON.stringify({ reply: 'Noted.', memory: [], dated: [] });
};
const withHarness = async (run: (h: { state: { now: number; sent: { text: string; disposition?: string }[] };
  journal: ReturnType<typeof openPreviewJournal>; worker: ReturnType<typeof createJournalWorker>; path: string }) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-quiet-')));
  const path = join(root, 'journal.encrypted');
  const state = { now: start, sent: [] as { text: string; disposition?: string }[] };
  const journal = openPreviewJournal(path, key, genesis);
  const worker = createJournalWorker(journal, { now: () => state.now, stopped: () => false, timeZone: zone,
    model: async (input: Input) => decide(input), checkOutbound: () => {},
    send: async value => { state.sent.push({ text: value.expectedText, ...(value.disposition ? { disposition: value.disposition } : {}) });
      return state.sent.length; } });
  try { await run({ state, journal, worker, path }); } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
};
const tick = async (worker: ReturnType<typeof createJournalWorker>) => { await worker.drain(); await worker.sendReminders(); };

it('sends two oversized requested summaries due in one topic and slot as one push with an overview', () => withHarness(async ({ state, journal, worker }) => {
  worker.intake([update(1, 'send me a summary of today every day at 6 pm', 17),
    update(2, 'send me a summary of yesterday every day at 6 pm', 17)]);
  await tick(worker);
  const before = state.sent.length;
  state.now = sixPm; await tick(worker); await tick(worker);
  const pushes = state.sent.slice(before);
  // The coverage reproduction measured two pushes (2705 and 2701 bytes) here before this build.
  expect(pushes).toHaveLength(1);
  expect(pushes[0]!.text).toContain(summaryOverviewLead);
  expect(Buffer.byteLength(pushes[0]!.text)).toBeLessThanOrEqual(4096);
  expect(journal.view.order.filter(turn => turn.requestedSummary && turn.intent === undefined)).toHaveLength(0);
  // The overview's full summary text stays retained in the journal.
  expect(journal.view.order.filter(turn => turn.requestedSummary).every(turn => turn.answer?.startsWith('Summary detail.'))).toBe(true);
}));

it('sends more due reminders than fit as one push with a count line, and none later', () => withHarness(async ({ state, journal, worker }) => {
  const long = 'x'.repeat(300);
  worker.intake(Array.from({ length: 16 }, (_, index) => update(10 + index, `remind me today at 5 pm to do task ${index} ${long}`, 9)));
  await tick(worker);
  const before = state.sent.length;
  state.now = sixPm; await tick(worker); await tick(worker); await tick(worker);
  const pushes = state.sent.slice(before);
  expect(pushes).toHaveLength(1);
  expect(pushes[0]!.text).toMatch(/\nAnd \d+ more reminders due now; ask me and I'll list them\.$/u);
  const listed = (pushes[0]!.text.match(/PREVIEW reminder you asked for/gu) ?? []).length;
  expect(pushes[0]!.text.endsWith(reminderOverflowLine(16 - listed))).toBe(true);
  expect(journal.view.reminders.size).toBe(1);
}));

it('answers a held backlog with one notice and never re-pushes it unchanged, across restart', () => withHarness(async ({ state, journal, worker, path }) => {
  worker.intake([update(1, 'one'), update(2, 'two'), update(3, 'three')]);
  for (const turn of journal.view.order) journal.append({ kind: 'hold', id: turn.id, reason: 'reply check unavailable', at: state.now });
  state.now += HELD_NOTICE_AFTER_MS + 1; await worker.drain();
  expect(state.sent).toHaveLength(1);
  expect(state.sent[0]!.text).toContain("I'm holding 3 answers");
  // P-14: before this build an unchanged backlog drew a second push after an hour.
  state.now += 3 * HELD_NOTICE_WINDOW_MS; await worker.drain(); await worker.drain();
  expect(state.sent).toHaveLength(1);
  expect(worker.nextHeldNoticeAt()).toBeNull();
  journal.close();
  const reopened = openPreviewJournal(path, key);
  const resumed = createJournalWorker(reopened, { now: () => state.now, stopped: () => false, timeZone: zone,
    model: async () => { throw Error('model ran'); }, checkOutbound: () => {}, send: async () => { throw Error('re-pushed'); } });
  await resumed.drain();
  expect(resumed.nextHeldNoticeAt()).toBeNull();
  reopened.close();
}));

it('classifies every push at the one send boundary; status is never a pushed kind', () => withHarness(async ({ state, worker }) => {
  expect(Object.values(OUTBOUND_DISPOSITIONS)).not.toContain('status');
  worker.intake([update(1, 'hello')]); await tick(worker);
  expect(state.sent.map(item => item.disposition)).toEqual(['result']);
}));
