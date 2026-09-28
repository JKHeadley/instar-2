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
/** One launcher cycle whose poll returned nothing new: drain, then the requested-push send point. */
const tick = async (worker: { drain: () => Promise<void>; sendReminders: () => Promise<void> }) => {
  await worker.drain(); await worker.sendReminders();
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

it('sends a requested daily summary once per day, stating its reason, through the answer path', async () => {
  const root = tmp('daily');
  try {
    const { state, open, summaries } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, daily), update(2, 'I had lunch with Mia')]); await worker.drain();
    expect(state.sent[0]!.text).toContain('I will send you a summary of today every day at 18:00 (America/Los_Angeles), first on 2026-09-26');
    expect(journal.view.summaryGrants).toMatchObject([{ repeat: 'daily', time: '18:00', first: '2026-09-26', period: 'today' }]);
    // The decision option is presented only with a summary cue or an active request; the model decides meaning.
    expect(JSON.parse(state.contexts[0]!.context).summaryDecision).toBeDefined();
    expect(JSON.parse(state.contexts[1]!.context).summaryRequests).toHaveLength(1);
    journal.close(); ({ journal, worker } = open());
    state.now = sixPm() - 60_000; await tick(worker);
    expect(summaries()).toEqual([]);
    state.now = sixPm(); await tick(worker);
    expect(summaries()).toEqual([`${header('2026-09-26 18:00')})\nSummary of 2026-09-26 to 2026-09-26: 2 earlier messages.`]);
    // The runner-authored turn carries no operator authority and appears as such in later packets.
    const synthetic = journal.view.order.at(-1)!;
    expect(synthetic.requestedSummary).toMatchObject({ slot: '2026-09-26', window: { from: '2026-09-26', through: '2026-09-26' } });
    expect(journal.view.summaryGrants).toHaveLength(1);
    expect(journal.view.summaryCancels).toEqual([]);
    expect(journal.view.memory).toEqual([]);
    expect(journal.view.dated).toEqual([]);
    state.now = sixPm() + 3600_000; await tick(worker);
    journal.close(); ({ journal, worker } = open());
    await worker.drain(); await worker.sendReminders();
    expect(summaries()).toHaveLength(1);
    worker.intake([update(3, 'thanks')]); await worker.drain();
    const later = JSON.parse(state.contexts.at(-1)!.context) as { history: { user: string; from?: string; answer: string | null }[] };
    expect(later.history.find(item => item.user.startsWith('[Scheduled summary'))).toMatchObject({
      from: 'the runner, starting a summary the operator asked for (no operator authority)' });
    state.now = sixPm(1); await tick(worker);
    expect(summaries()).toHaveLength(2);
    expect(summaries()[1]).toContain(`${header('2026-09-27 18:00')})\nSummary of 2026-09-27 to 2026-09-27`);
    expect(journal.view.replies).toBe(5); // request, lunch, summary, thanks, summary
    journal.close();
    expect(status(root).requestedSummaries).toMatchObject({ requested: 1, cancelled: 0, active: [{ repeat: 'daily', time: '18:00' }],
      slots: [{ slot: '2026-09-26', state: 'accepted', late: null }, { slot: '2026-09-27', state: 'accepted', late: null }] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('survives a restart at every durable step of a due summary, sending at most once and never repeating UNKNOWN', async () => {
  const outcomes: Record<string, number> = {};
  for (const stage of ['after:summary-due', 'after:reserve', 'after:answer', 'after:intent', 'after:sent']) {
    const root = tmp(stage.replace(':', '-'));
    try {
      const { state, open, summaries } = harness(root);
      let { journal, worker } = open(true, stage === 'after:answer' ? 4096 : undefined);
      worker.intake([update(1, daily)]); await worker.drain();
      state.now = sixPm(); state.crash = stage;
      // A crash after the receipt is inside the send's own UNKNOWN guard; every earlier one aborts the pass.
      if (stage === 'after:sent') await tick(worker);
      else await expect(tick(worker)).rejects.toThrow('crash');
      journal.close(); ({ journal, worker } = open(false, stage === 'after:answer' ? 4096 : undefined));
      for (const at of [sixPm(), sixPm() + 60_000, sixPm() + 7200_000]) { state.now = at; await tick(worker); }
      outcomes[stage] = summaries().length;
      journal.close(); ({ journal, worker } = open());
      state.now = sixPm(1); await tick(worker);
      // A lost or UNKNOWN slot never blocks the next due slot, and is never re-sent.
      expect(summaries()).toHaveLength(outcomes[stage]! + 1);
      expect(summaries().at(-1)).toContain('(due 2026-09-27 18:00 America/Los_Angeles)');
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  // Before the call: generated once. After the reservation: model UNKNOWN, never repeated. After the
  // intent: send UNKNOWN, never repeated. After acceptance: nothing more.
  expect(outcomes).toEqual({ 'after:summary-due': 1, 'after:reserve': 0, 'after:answer': 1, 'after:intent': 0, 'after:sent': 1 });
});

it('never pushes a summary the operator did not ask for, including a summary requested for now', async () => {
  const root = tmp('unrequested');
  try {
    const { state, open, summaries } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, 'I had lunch with Mia'), update(2, 'summarize today'), update(3, 'remember the ferry leaves at 6 pm')]);
    await tick(worker);
    // Rule 10: every verified operator message is offered the decision (no keyword prerequisite);
    // the model's reading, validated by code, is what schedules, and nothing here asked for later.
    expect(JSON.parse(state.contexts[0]!.context).summaryDecision).toBeDefined();
    expect(JSON.parse(state.contexts[1]!.context).summaryDecision).toBeDefined();
    expect(state.sent).toHaveLength(3);
    for (const at of [sixPm(), sixPm(1), sixPm(3)]) { state.now = at; await worker.drain(); await worker.sendReminders(); }
    expect(summaries()).toEqual([]);
    expect(state.sent).toHaveLength(3);
    expect(journal.view.summaryGrants).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('changes or cancels a requested summary by a later operator message, durably across restart', async () => {
  const root = tmp('change');
  try {
    const { state, open, summaries } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, daily), update(2, 'send me a summary of yesterday every day at 8 am')]); await worker.drain();
    worker.intake([update(3, 'stop the 8 am summary')]); await worker.drain();
    expect(state.sent.at(-1)!.text).toContain('Cancelled summary: "send me a summary of yesterday every day at 8 am".');
    worker.intake([update(4, 'move the 6 pm summary: send me a summary of today every day at 9 pm')]); await worker.drain();
    expect(state.sent.at(-1)!.text).toContain(`Cancelled summary: "${daily}".`);
    expect(state.sent.at(-1)!.text).toContain('every day at 21:00');
    worker.intake([update(5, 'stop the 7 pm summary')]); await worker.drain();
    expect(state.sent.at(-1)!.text).toContain('I could not tell which summary to cancel, so none was cancelled.');
    journal.close(); ({ journal, worker } = open());
    state.now = sixPm(); await tick(worker); // 18:00: the moved summary is not due, the old one is cancelled
    expect(summaries()).toEqual([]);
    state.now = sixPm() + 3 * 3600_000; await tick(worker); // 21:00
    expect(summaries()).toHaveLength(1);
    state.now = Date.UTC(2026, 8, 27, 15); await tick(worker); // 08:00 next day: that request was cancelled
    expect(summaries()).toHaveLength(1);
    expect(summaries()[0]).toContain('"send me a summary of today every day at 9 pm" (due 2026-09-26 21:00 America/Los_Angeles)');
    journal.close();
    expect(status(root).requestedSummaries).toMatchObject({ requested: 3, cancelled: 2, active: [{ time: '21:00' }] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('after downtime sends at most one late summary with a note, never a backlog', async () => {
  const root = tmp('downtime');
  try {
    const { state, open, summaries } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, daily), update(2, 'send me a summary of today today at 7 pm')]); await worker.drain();
    expect(journal.view.summaryGrants.map(grant => grant.repeat)).toEqual(['daily', 'once']);
    journal.close();
    // Down from Saturday 10:02 until Tuesday 10:00: daily slots Sat, Sun, Mon and the one-off were missed.
    ({ journal, worker } = open());
    state.now = Date.UTC(2026, 8, 29, 17); await tick(worker); await tick(worker);
    expect(summaries()).toHaveLength(2);
    const [late, once] = [summaries().find(text => text.includes(daily))!, summaries().find(text => !text.includes(daily))!];
    expect(late).toContain(`${header('2026-09-28 18:00')}; sent late at 2026-09-29 10:00, and 2 earlier due summaries were skipped, not sent)`);
    expect(late).toContain('Summary of 2026-09-28 to 2026-09-28');
    expect(once).toContain('(due 2026-09-26 19:00 America/Los_Angeles; sent late at 2026-09-29 10:00)');
    journal.close(); ({ journal, worker } = open());
    state.now = Date.UTC(2026, 8, 29, 18); await tick(worker);
    expect(summaries()).toHaveLength(2);
    state.now = sixPm(3); await tick(worker); // Tuesday 18:00, on time.
    expect(summaries()).toHaveLength(3);
    expect(summaries()[2]).toContain(`${header('2026-09-29 18:00')})\n`);
    state.now = Date.UTC(2026, 9, 11); await worker.drain(); // at or after expiry nothing more is created
    await expect(worker.sendReminders()).rejects.toThrow('preview stopped');
    expect(summaries()).toHaveLength(3);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('sends the truthful held notice at the call cap, never a made-up summary, and the summary after a raise', async () => {
  const root = tmp('cap');
  try {
    const { state, open, summaries } = harness(root, { maxCalls: 1 });
    let { journal, worker } = open(true);
    worker.intake([update(1, daily)]); await worker.drain();
    state.now = sixPm(); await tick(worker);
    expect(journal.view.order.at(-1)).toMatchObject({ held: 'call cap', requestedSummary: { slot: '2026-09-26' } });
    expect(summaries()).toEqual([]);
    state.now = sixPm() + HELD_NOTICE_AFTER_MS + 1000; await tick(worker);
    expect(state.sent.at(-1)!.text).toBe("PREVIEW — I'm holding the summary you asked for (due 2026-09-26 18:00); it will follow or I'll tell you why");
    journal.close(); ({ journal, worker } = open());
    await tick(worker);
    expect(state.sent).toHaveLength(2);
    // The held slot holds the next day's slot rather than stacking a backlog.
    state.now = sixPm(1); await tick(worker);
    expect(journal.view.order.filter(turn => turn.requestedSummary)).toHaveLength(1);
    raiseJournalCaps(journal, { maxCalls: 4, maxReplies: genesis.maxReplies, maxTurns: genesis.maxTurns, authority: 'operator:raise', at: state.now });
    await tick(worker); await tick(worker);
    expect(summaries()).toHaveLength(2);
    expect(summaries()[0]).toContain(`${header('2026-09-26 18:00')})\nSummary of 2026-09-26`);
    // The day-two slot follows once the held one is sent; it is on time for its own slot.
    expect(summaries()[1]).toContain('(due 2026-09-27 18:00 America/Los_Angeles)');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('sends a truthful notice under the reason line when the summary model outcome is UNKNOWN', async () => {
  const root = tmp('uncertain');
  try {
    const { state, open, summaries } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, daily)]); await worker.drain();
    state.now = sixPm(); state.uncertain = true; await tick(worker);
    expect(summaries()).toEqual([`${header('2026-09-26 18:00')})\nI lost this summary: the model call's outcome is unknown, and I never repeat it. Ask me for a summary if you still want one.`]);
    await tick(worker);
    expect(summaries()).toHaveLength(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('groups requested reminders due in the same slot and topic into the summary message', async () => {
  const root = tmp('group');
  try {
    const { state, open, summaries } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, daily, 17), update(2, 'remind me today at 6 pm to water the plants', 17),
      update(3, 'remind me today at 6 pm to call Priya', 23)]);
    await tick(worker);
    state.now = sixPm(); await worker.drain(); await worker.sendReminders();
    const topic17 = state.sent.filter(item => item.thread === 17).slice(2);
    expect(topic17).toHaveLength(1);
    // The existing upcoming-date aside may follow the summary line; the grouped reminder line ends the one message.
    expect(topic17[0]!.text.startsWith(`${header('2026-09-26 18:00')})\nSummary of 2026-09-26 to 2026-09-26: 3 earlier messages.`)).toBe(true);
    expect(topic17[0]!.text.endsWith('\nPREVIEW reminder you asked for on 2026-09-26 10:02: "remind me today at 6 pm to water the plants" (due 2026-09-26 18:00 America/Los_Angeles)')).toBe(true);
    const topic23 = state.sent.filter(item => item.thread === 23).slice(1);
    expect(topic23.map(item => item.text)).toEqual(['PREVIEW reminder you asked for on 2026-09-26 10:03: "remind me today at 6 pm to call Priya" (due 2026-09-26 18:00 America/Los_Angeles)']);
    expect([...journal.view.reminders.values()].map(batch => batch.sent !== undefined)).toEqual([true, true]);
    await worker.drain(); await worker.sendReminders();
    expect(summaries()).toHaveLength(1);
    expect(state.sent).toHaveLength(5);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses an unsettled or unsupported request and says why', async () => {
  const root = tmp('refuse');
  try {
    const { state, open, summaries } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, 'send me a summary of today every day at 8'), update(2, 'send me a summary of this week every friday at 5 pm'),
      update(3, 'send me a summary of today today at 9 am')]);
    await tick(worker);
    expect(state.sent[0]!.text).toContain('I did not set up the summary you asked for: AM or PM is not settled');
    expect(state.sent[1]!.text).toContain('I will send you a summary of this week every Friday at 17:00');
    expect(state.sent[2]!.text).toContain('I did not set up the summary you asked for: that time has already passed.');
    expect(journal.view.summaryGrants).toHaveLength(1);
    for (const at of [sixPm(), sixPm(1)]) { state.now = at; await tick(worker); }
    expect(summaries()).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
  const at = start; // Saturday 10:00
  expect(settleSummarySchedule('every morning at 8', 'daily', at, zone)).toEqual({ time: '08:00', first: '2026-09-27' });
  expect(settleSummarySchedule('every evening at 6:30', 'daily', at, zone)).toEqual({ time: '18:30', first: '2026-09-26' });
  expect(settleSummarySchedule('tomorrow at noon', 'once', at, zone)).toEqual({ time: '12:00', first: '2026-09-27' });
  expect(settleSummarySchedule('Saturday at 6 pm', 'once', at, zone)).toMatchObject({ refusal: 'that weekday could mean today or next week' });
  expect(settleSummarySchedule('every Friday', 'weekly', at, zone)).toMatchObject({ refusal: expect.stringContaining('no time of day') });
  expect(settleSummarySchedule('every day at 18:00', 'weekly', at, zone)).toMatchObject({ refusal: expect.stringContaining('weekday') });
});

it('holds a due summary while stopped or while a later operator message is unsettled', async () => {
  const root = tmp('hold');
  try {
    const { state, open, summaries } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, daily)]); await worker.drain();
    state.now = sixPm(); state.stopped = true;
    await worker.drain(); await expect(worker.sendReminders()).rejects.toThrow('preview stopped');
    expect(journal.view.order.filter(turn => turn.requestedSummary)).toHaveLength(0);
    state.stopped = false;
    // An operator message not yet answered might cancel it: the slot waits for that decision, which cancels it.
    worker.intake([update(5, 'stop the 6 pm summary')]);
    await tick(worker);
    expect(journal.view.summaryCancels).toHaveLength(1);
    await tick(worker);
    expect(journal.view.order.filter(turn => turn.requestedSummary)).toHaveLength(0);
    expect(summaries()).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a forged, premature or repeated summary slot frame and accepts the exact due one', async () => {
  const root = tmp('frames');
  try {
    const { state, open } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, daily)]); await worker.drain();
    const grant = journal.view.summaryGrants[0]!;
    const frame = (at: number, slot = '2026-09-26', extra: object = {}) => ({ kind: 'summary-due' as const,
      id: `requested-summary:${grant.id}:${slot}`, grant: grant.id, slot, update: 1 + 1 / 1024,
      window: { from: slot, through: slot, zone }, at, ...extra });
    expect(() => journal.append(frame(sixPm() - 60_000))).toThrow('requested summary slot refused');
    expect(() => journal.append(frame(sixPm(), '2026-09-27'))).toThrow('requested summary slot refused');
    expect(() => journal.append(frame(sixPm(), '2026-09-26', { grant: 'summary-forged' }))).toThrow('requested summary slot refused');
    expect(() => journal.append(frame(sixPm(), '2026-09-26', { update: 2 }))).toThrow('requested summary slot refused');
    journal.append(frame(sixPm()));
    expect(() => journal.append(frame(sixPm() + 60_000))).toThrow('requested summary slot refused');
    expect(state.sent).toHaveLength(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('never sends an already-created slot whose request a later operator message cancels, and sends it after an unrelated one', async () => {
  for (const [later, expected] of [['stop the 6 pm summary', 0], ['how was lunch?', 1]] as const) {
    const root = tmp('slot-cancel');
    try {
      const { state, open, summaries } = harness(root);
      let { journal, worker } = open(true);
      worker.intake([update(1, daily)]); await worker.drain();
      state.now = sixPm(); state.crash = 'after:summary-due';
      await expect(tick(worker)).rejects.toThrow('crash');
      journal.close(); ({ journal, worker } = open());
      expect(journal.view.order.filter(turn => turn.requestedSummary)).toHaveLength(1);
      worker.intake([update(2, later)]);
      await tick(worker);
      expect(journal.view.summaryCancels).toHaveLength(expected === 0 ? 1 : 0);
      expect(summaries()).toHaveLength(expected);
      await tick(worker); state.now = sixPm() + 3600_000; await tick(worker);
      expect(summaries()).toHaveLength(expected);
      journal.close();
      expect(status(root).requestedSummaries.slots.map(slot => slot.state)).toEqual([expected === 0 ? 'withdrawn, not sent' : 'accepted']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('sends summaries due in the same slot and topic as one message with its reminders, once, across replay', async () => {
  for (const crash of [null, 'after:intent'] as const) {
    const root = tmp('slot-group');
    try {
      const { state, open, summaries } = harness(root);
      let { journal, worker } = open(true);
      const yesterday = 'send me a summary of yesterday every day at 6 pm';
      worker.intake([update(1, daily, 17), update(2, yesterday, 17), update(3, 'remind me today at 6 pm to water the plants', 17),
        update(4, 'send me a summary of this week every day at 6 pm', 23)]);
      await tick(worker);
      const before = state.sent.length;
      state.now = sixPm(); state.crash = crash;
      if (crash) await expect(tick(worker)).rejects.toThrow('crash'); else await tick(worker);
      journal.close(); ({ journal, worker } = open());
      await worker.drain(); await worker.sendReminders();
      const topic17 = state.sent.slice(before).filter(item => item.thread === 17);
      // A crash after the one intent leaves that single message UNKNOWN: it is never sent or repeated.
      expect(topic17).toHaveLength(crash ? 0 : 1);
      const turns = journal.view.order.filter(turn => turn.requestedSummary && turn.thread === 17);
      const text = turns[0]!.intent!;
      expect(turns.map(turn => turn.intent === text)).toEqual([true, true]);
      if (!crash) expect(topic17[0]!.text).toBe(text);
      expect(text.startsWith(`${header('2026-09-26 18:00')})\n`)).toBe(true);
      expect(text).toContain(`\n\n${header('2026-09-26 18:00', '2026-09-26 10:02', yesterday)})\n`);
      expect(text.endsWith('\nPREVIEW reminder you asked for on 2026-09-26 10:03: "remind me today at 6 pm to water the plants" (due 2026-09-26 18:00 America/Los_Angeles)')).toBe(true);
      expect(turns.map(turn => turn.sent !== undefined)).toEqual(crash ? [false, false] : [true, true]);
      expect(state.sent.slice(before).filter(item => item.text.includes('water the plants'))).toHaveLength(crash ? 0 : 1);
      // The other topic's summary is its own message.
      expect(state.sent.slice(before).filter(item => item.thread === 23)).toHaveLength(1);
      await worker.drain(); await worker.sendReminders();
      expect(state.sent.slice(before).filter(item => item.thread === 17)).toHaveLength(crash ? 0 : 1);
      journal.close();
      expect(status(root).requestedSummaries.slots.filter(slot => slot.state === (crash ? 'UNKNOWN send' : 'accepted')))
        .toHaveLength(crash ? 2 : 3);
      if (!crash) expect(summaries()).toHaveLength(2);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('binds an explicit start day of a repeating summary, and refuses one it cannot settle', () => {
  const at = start; // Saturday 2026-09-26 10:00
  expect(settleSummarySchedule('every day at 6 pm', 'daily', at, zone)).toEqual({ time: '18:00', first: '2026-09-26' });
  expect(settleSummarySchedule('every day at 6 pm from now on', 'daily', at, zone)).toEqual({ time: '18:00', first: '2026-09-26' });
  expect(settleSummarySchedule('every day at 6 pm starting tomorrow', 'daily', at, zone)).toEqual({ time: '18:00', first: '2026-09-27' });
  expect(settleSummarySchedule('every day at 6 pm starting 2026-10-01', 'daily', at, zone)).toEqual({ time: '18:00', first: '2026-10-01' });
  expect(settleSummarySchedule('every day at 6 pm starting Monday', 'daily', at, zone)).toEqual({ time: '18:00', first: '2026-09-28' });
  expect(settleSummarySchedule('every Friday at 5 pm starting 2026-10-05', 'weekly', at, zone)).toEqual({ time: '17:00', first: '2026-10-09' });
  expect(settleSummarySchedule('every Friday at 5 pm', 'weekly', at, zone)).toEqual({ time: '17:00', first: '2026-10-02' });
  for (const when of ['every day at 6 pm starting next week', 'every day at 6 pm until Friday', 'every day at 6 pm starting Oct 3',
    'every Monday at 6 pm', 'every day at 6 pm starting 2026-09-20'])
    expect(settleSummarySchedule(when, 'daily', at, zone)).toHaveProperty('refusal');
});
