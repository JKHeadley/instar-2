#!/usr/bin/env node
// Removed-feature compatibility fixture. `write` runs on the base build that still shipped requested summaries,
// fixed-text requested reminders and the email import route, and drives its real worker so every removed frame
// kind is written the way that build wrote it. `exercise` runs on this build: it replays the journal, runs the due
// point, and makes one new request. No provider or Telegram port exists; the model is a fixed stand-in.
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [mode, checkoutArg, rootArg] = process.argv.slice(2);
if (!['write', 'exercise'].includes(mode) || !checkoutArg || !rootArg) throw Error('usage: removed-frames-fixture.mjs write|exercise CHECKOUT ROOT');
const checkout = resolve(checkoutArg), root = resolve(rootArg);
const { openPreviewJournal, createJournalWorker, importChannelFixture } = await import(pathToFileURL(join(checkout, 'tests/preview/journal-test-worker.ts')).href);
const key = new Uint8Array(32).fill(53);
const start = Date.UTC(2026, 8, 26, 17); // Saturday 2026-09-26 10:00 in Los Angeles.
const sixPm = Date.UTC(2026, 8, 27, 1); // Saturday 18:00 in Los Angeles.
const genesis = { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:removed-frames',
  configurationDigest: 'sha256:removed-frames', expires: Date.UTC(2026, 9, 10), maxCalls: 40, maxReplies: 30, maxTurns: 30,
  maxBytes: 32768, cursor: 0 };
const update = (n, text, thread) => ({ update_id: n, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
  date: Math.floor(start / 1000) + n * 60, ...(thread === undefined ? {} : { message_thread_id: thread }) } });
const path = join(root, 'journal.encrypted');
const state = { now: start, sent: [] };
const model = async input => {
  if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator set up requests.', people: [], memory: [], commitments: [], questions: [] });
  if (input.id.startsWith('requested-summary:')) return 'Today you asked me to call Priya.';
  if (input.id.startsWith('requested-action:')) return 'Time to stretch.';
  const q = input.question;
  const summary = /^summarize today at (\d) pm$/u.exec(q);
  if (summary) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [],
    summaries: [{ quote: q, when: `today at ${summary[1]} pm`, period: 'today', repeat: 'once' }] });
  if (q === 'cancel the 7 pm summary') {
    const listed = JSON.parse(input.context).summaryRequests ?? [];
    return JSON.stringify({ reply: 'Okay.', memory: [], dated: [], cancelSummaries: listed.filter(item => item.quote.includes('7 pm')).map(item => item.id) });
  }
  const remind = /^remind me (today at 6 pm|tomorrow at 9 am) to /u.exec(q);
  if (remind) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: q, when: remind[1], remind: true }] });
  return JSON.stringify({ reply: 'Noted.', memory: [], dated: [] });
};
const ports = { now: () => state.now, stopped: () => false, timeZone: 'America/Los_Angeles', model, checkOutbound: () => {},
  send: async value => { state.sent.push({ text: value.expectedText, ...(value.thread === undefined ? {} : { thread: value.thread }) });
    return 500 + state.sent.length; } };

if (mode === 'write') {
  const journal = openPreviewJournal(path, key, genesis);
  try {
    const worker = createJournalWorker(journal, ports);
    const say = async (n, text, thread) => { worker.intake([update(n, text, thread)]); await worker.drain(); };
    await say(1, 'summarize today at 6 pm');
    await say(2, 'remind me today at 6 pm to call Priya');
    await say(3, 'remind me today at 6 pm to water plants', 17);
    await say(4, 'summarize today at 7 pm');
    await say(5, 'cancel the 7 pm summary');
    importChannelFixture(journal, [{ source: 'email', account: 'agent@example.test', id: 'mail-1', from: 'sam@example.test',
      at: start, subject: 'Locker', text: 'The locker code is 4471.' }], 'agent@example.test', state.now);
    state.now = sixPm;
    await worker.drain(); await worker.sendReminders();
    const view = journal.view;
    process.stdout.write(`${JSON.stringify({ summaryGrants: view.summaryGrants.length, summaryCancels: view.summaryCancels.length,
      summaryTurns: view.order.filter(turn => turn.requestedSummary).length,
      summarySent: view.order.filter(turn => turn.requestedSummary && turn.sent !== undefined).length,
      reminderBatches: [...view.reminders.values()].map(batch => ({ items: batch.items.length, sent: batch.sent !== undefined })),
      groupedIntoSummary: view.order.filter(turn => turn.reminderBatch !== undefined).length,
      channelItems: [...view.channelItems.values()].map(item => item.source), sent: state.sent.map(item => item.text) })}\n`);
  } finally { journal.close(); }
} else {
  const journal = openPreviewJournal(path, key);
  try {
    const worker = createJournalWorker(journal, ports);
    const view = journal.view;
    const replayed = { legacySummaryTurns: view.order.filter(turn => turn.requestedAction?.legacy === 'summary')
      .map(turn => ({ intent: turn.intent !== undefined, sent: turn.sent !== undefined })),
    channelItems: view.channelItems.size, requested: view.dated.filter(item => item.remind).length };
    // The due point on this build: nothing from the removed frames is answered, sent or re-sent.
    for (const at of [sixPm + 90 * 60_000, sixPm + 86_400_000]) { state.now = at; await worker.drain(); await worker.sendRequested(); }
    const afterReplay = state.sent.length;
    // A new request works on the same journal.
    state.now = sixPm + 2 * 3_600_000;
    worker.intake([update(6, 'remind me tomorrow at 9 am to stretch')]); await worker.drain();
    state.now = Date.UTC(2026, 8, 27, 16); // Sunday 09:00 in Los Angeles.
    await worker.drain(); await worker.sendRequested(); await worker.sendRequested();
    process.stdout.write(`${JSON.stringify({ replayed, afterReplay, sent: state.sent.map(item => item.text),
      dueTurns: view.order.filter(turn => turn.requestedAction && !turn.requestedAction.legacy).length })}\n`);
  } finally { journal.close(); }
}
