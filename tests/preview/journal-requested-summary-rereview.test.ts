import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps, settleSummarySchedule, HELD_NOTICE_AFTER_MS } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(31);
const zone = 'America/Los_Angeles';
const start = Date.UTC(2026, 8, 26, 17); // Saturday 2026-09-26 10:00 in Los Angeles.
const sixPm = (days = 0) => Date.UTC(2026, 8, 27 + days, 1); // 18:00 local on 2026-09-26 + days.
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:summary', configurationDigest: 'sha256:summary', expires: Date.UTC(2026, 9, 10),
  maxCalls: 30, maxReplies: 30, maxTurns: 30, maxBytes: 12000, cursor: 0 };
const update = (id: number, text: string, thread?: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    date: Math.floor(start / 1000) + id * 60, ...(thread === undefined ? {} : { message_thread_id: thread }) } });
const daily = 'send me a summary of today every day at 6 pm';
const header = (due: string, asked = '2026-09-26 10:01', quote = daily) =>
  `PREVIEW summary you asked for on ${asked}: "${quote}" (due ${due} ${zone}`;
type Input = { id: string; question: string; context: string };
/** The model decides meaning: it proposes a scheduled summary only for a direct request to send one later. */
const decide = (input: Input) => {
  const packet = JSON.parse(input.context) as { period?: { from: string; through: string; total: number };
    summaryRequests?: { id: string; quote: string }[] };
  if (input.question.startsWith('[Scheduled summary')) {
    const period = packet.period!;
    // Authority-shaped fields on a runner-authored turn must be ignored, never applied.
    return JSON.stringify({ reply: `Summary of ${period.from} to ${period.through}: ${String(period.total)} earlier messages.`,
      memory: [{ mode: 'forget', source: 'x', quote: 'lunch with Mia' }], summaries: [{ quote: 'send me a summary', when: 'at 9 pm',
        period: 'today', repeat: 'daily' }], cancelSummaries: ['summary-anything'], dated: [{ quote: 'the ferry at 6 pm', when: 'today at 6 pm', remind: true }] });
  }
  const listed = packet.summaryRequests ?? [];
  const schedule = /^(?:send me a summary of (today|yesterday|this week) (every day|every friday|today) at (\d+(?: ?[ap]m)?))/u.exec(input.question);
  const cancel = /^stop the (\d+ ?[ap]m) summary/u.exec(input.question);
  const change = /^move the (\d+ ?[ap]m) summary: (.+)$/u.exec(input.question);
  if (cancel || change) {
    const target = (cancel ?? change)![1]!;
    const ids = listed.filter(item => item.quote.includes(target)).map(item => item.id);
    const proposal = change ? /every day at (\d+ ?[ap]m)/u.exec(change[2]!) : null;
    return JSON.stringify({ reply: 'Okay.', memory: [], dated: [], cancelSummaries: ids.length ? ids : ['summary-unlisted'],
      ...(change ? { summaries: [{ quote: change[2], when: `every day at ${proposal![1]}`, period: 'today', repeat: 'daily' }] } : {}) });
  }
  if (schedule) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [], summaries: [{ quote: input.question,
    when: `${schedule[2]} at ${schedule[3]}`, period: schedule[1], repeat: schedule[2] === 'today' ? 'once' : schedule[2] === 'every friday' ? 'weekly' : 'daily' }] });
  const reminder = /^remind me (today at \d+ ?[ap]m) to /u.exec(input.question);
  if (reminder) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: input.question, when: reminder[1], remind: true }] });
  return JSON.stringify({ reply: 'Noted.', memory: [], dated: [] });
};
const harness = (root: string, limits: Partial<typeof genesis> = {}) => {
  const state = { now: start, stopped: false, uncertain: false, fail: false, crash: null as string | null,
    sent: [] as { text: string; thread?: number }[], contexts: [] as Input[] };
  const ports = { now: () => state.now, stopped: () => state.stopped, timeZone: zone,
    model: async (input: Input) => { state.contexts.push(input);
      return state.uncertain && input.question.startsWith('[Scheduled summary') ? { state: 'uncertain' as const } : decide(input); },
    checkOutbound: () => {},
    send: async (value: { expectedText: string; thread?: number }) => {
      state.sent.push({ text: value.expectedText, ...(value.thread === undefined ? {} : { thread: value.thread }) });
      return state.fail ? null : state.sent.length;
    } };
  const path = join(root, 'journal.encrypted');
  const boundary = (stage: string) => { if (stage === state.crash) { state.crash = null; throw Error('crash'); } };
  const open = (first = false, compactBytes?: number) => {
    const journal = first ? openPreviewJournal(path, key, { ...genesis, ...limits }, boundary, false, compactBytes)
      : openPreviewJournal(path, key, undefined, boundary, false, compactBytes);
    return { journal, worker: createJournalWorker(journal, ports) };
  };
  const summaries = () => state.sent.filter(item => item.text.startsWith('PREVIEW summary you asked for')).map(item => item.text);
  return { state, open, summaries };
};
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-summary-${name}-`)));
const status = (root: string) => {
  const run = spawnSync(process.execPath,
    ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
  expect(run.status, run.stderr).toBe(0);
  return JSON.parse(run.stdout) as { requestedSummaries: { requested: number; cancelled: number; active: unknown[];
    slots: { slot: string; state: string; late: unknown }[] } };
};


it('regression: cancellation received after slot creation prevents its send', async () => {
  const root = tmp('review-cancel');
  try {
    const { state, open, summaries } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, daily)]); await worker.drain();
    state.now = sixPm(); state.crash = 'after:summary-due';
    await expect(worker.drain()).rejects.toThrow('crash');
    journal.close(); ({ journal, worker } = open());
    worker.intake([update(2, 'stop the 6 pm summary')]);
    await worker.drain();
    expect(journal.view.summaryCancels).toHaveLength(1);
    expect(summaries()).toHaveLength(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
it('regression: two summaries due in one topic slot aggregate into one send', async () => {
  const root = tmp('review-group');
  try {
    const { state, open, summaries } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, daily, 17), update(2, 'send me a summary of yesterday every day at 6 pm', 17)]);
    await worker.drain();
    state.now = sixPm(); await worker.drain();
    expect(summaries()).toHaveLength(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
it('regression: an explicit later start date never becomes an earlier daily grant', () => {
  expect(settleSummarySchedule('every day at 6 pm starting tomorrow', 'daily', start, zone))
    .toEqual({time: '18:00', first: '2026-09-27'});
});

it('regression: cancelling a created summary does not strand an independent reminder in that topic', async () => {
  const root = tmp('review-cancel-reminder');
  let journal: ReturnType<typeof openPreviewJournal> | undefined;
  try {
    const { state, open, summaries } = harness(root);
    let opened = open(true); journal = opened.journal; let worker = opened.worker;
    worker.intake([update(1, daily, 17), update(2, 'remind me today at 6 pm to water the plants', 17)]);
    await worker.drain();
    state.now = sixPm(); state.crash = 'after:summary-due';
    await expect(worker.drain()).rejects.toThrow('crash');
    journal.close(); opened = open(); journal = opened.journal; worker = opened.worker;
    worker.intake([update(3, 'stop the 6 pm summary', 17)]);
    await worker.drain(); await worker.sendReminders();
    expect(journal.view.summaryCancels).toHaveLength(1);
    expect(summaries()).toHaveLength(0);
    journal.close(); opened = open(); journal = opened.journal; worker = opened.worker;
    state.now = sixPm() + 3600_000;
    await worker.drain(); await worker.sendReminders();
    expect(state.sent.filter(item => item.text.startsWith('PREVIEW reminder you asked for'))).toHaveLength(1);
  } finally { journal?.close(); rmSync(root, { recursive: true, force: true }); }
});
