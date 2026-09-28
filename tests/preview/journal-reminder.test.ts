import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, reminderOverflowLine } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(29);
const start = Date.UTC(2026, 8, 26, 17); // Saturday 10:00 in Los Angeles.
const friday9 = Date.UTC(2026, 9, 2, 16); // Friday 2026-10-02 09:00 in Los Angeles.
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:reminder', configurationDigest: 'sha256:reminder', expires: Date.UTC(2026, 9, 10),
  maxCalls: 20, maxReplies: 8, maxTurns: 10, maxBytes: 12000, cursor: 0 };
const update = (id: number, text: string, sender = 7654321, thread?: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: sender }, text,
    date: Math.floor(start / 1000) + id * 60, ...(thread === undefined ? {} : { message_thread_id: thread }) } });
const priya = 'remind me Friday at 9 am to call Priya';
const priyaLine = `PREVIEW reminder you asked for on 2026-09-26 10:01: "${priya}" (due 2026-10-02 09:00 America/Los_Angeles)`;
type Input = { id: string; question: string; context: string };
/** A decision that marks a remind request only when the message asks for one; the model decides meaning. */
const decide = (input: Input) => {
  const request = /^remind me (.+?) to /u.exec(input.question) ?? /^remind me (.+)$/u.exec(input.question);
  if (request) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: input.question, when: request[1]!, remind: true }] });
  const cancel = /^cancel the (\w+) reminder/u.exec(input.question);
  if (cancel) {
    const listed = (JSON.parse(input.context) as { reminders?: { id: string; quote: string }[] }).reminders ?? [];
    const ids = listed.filter(item => item.quote.includes(cancel[1]!)).map(item => item.id);
    return JSON.stringify({ reply: 'Okay.', memory: [], dated: [], cancelReminders: ids.length ? ids : ['reminder-unlisted'] });
  }
  const dated = /(Friday at \d+ am|Oct \d+)/u.exec(input.question);
  return JSON.stringify({ reply: 'Recorded.', memory: [], dated: dated ? [{ quote: input.question, when: dated[1] }] : [] });
};
const harness = (root: string, maxReplies = genesis.maxReplies, limits: Partial<typeof genesis> = {}) => {
  const state = { now: start, stopped: false, stopAfterModel: false, fail: false, uncertain: false, plain: false,
    plainText: 'Okay, I cancelled the Priya reminder.', summaryCancel: undefined as undefined | 'keep' | 'cancel' | 'omit', sent: [] as { text: string; thread?: number }[] };
  const ports = { now: () => state.now, stopped: () => state.stopped, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => { if (state.stopAfterModel) state.stopped = true;
      if (input.id.startsWith('summary:') && state.summaryCancel) {
        const listed = (JSON.parse(input.context) as { reminders?: { id: string }[] }).reminders ?? [];
        return JSON.stringify({ summary: `The operator asked: ${priya}.`, people: [], memory: [], commitments: [], questions: [],
          ...(state.summaryCancel === 'omit' ? {} : { cancelReminders: state.summaryCancel === 'cancel' ? listed.map(item => item.id) : [] }) });
      }
      return state.uncertain ? { state: 'uncertain' as const }
        : state.plain ? state.plainText : decide(input); }, checkOutbound: () => {},
    send: async (value: { expectedText: string; thread?: number }) => {
      state.sent.push({ text: value.expectedText, ...(value.thread === undefined ? {} : { thread: value.thread }) });
      return state.fail && value.expectedText.startsWith('PREVIEW reminder') ? null : state.sent.length;
    } };
  const path = join(root, 'journal.encrypted');
  const open = (first = false) => { const journal = first ? openPreviewJournal(path, key, { ...genesis, maxReplies, ...limits }) : openPreviewJournal(path, key);
    return { journal, worker: createJournalWorker(journal, ports) }; };
  const pushes = () => state.sent.filter(item => item.text.startsWith('PREVIEW reminder')).map(item => item.text);
  return { state, open, pushes };
};
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-requested-${name}-`)));

it('sends a requested reminder once at its due time with its reason, across restarts at every step', async () => {
  const root = tmp('once');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya)]); await worker.drain();
    expect(journal.view.dated).toMatchObject([{ day: '2026-10-02', time: '09:00', remind: true }]);
    expect(state.sent[0]!.text).toContain('I will send you one reminder at 2026-10-02 09:00 (America/Los_Angeles).');
    journal.close(); ({ journal, worker } = open()); // restart after the grant, before due.
    state.now = friday9 - 60_000;
    await worker.sendReminders();
    expect(pushes()).toEqual([]);
    state.now = friday9;
    await worker.sendReminders();
    expect(pushes()).toEqual([priyaLine]);
    expect(journal.view.replies).toBe(2);
    journal.close(); ({ journal, worker } = open()); // restart after the receipt.
    state.now = friday9 + 3600_000;
    await worker.sendReminders();
    expect(pushes()).toHaveLength(1);
    expect(journal.view.replies).toBe(2);
    journal.close();
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
        env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(status.status, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout).reminders).toEqual({ intents: 1, accepted: 1, unknown: 0, refused: 0, grant: null,
      requested: 1, pending: [], cancelled: 0 });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps the grant when a crash follows the recorded decision, and never retries an UNKNOWN reminder', async () => {
  const root = tmp('unknown');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya)]);
    // Stop after the decision is journaled and before the reply dispatch: the next gate refuses.
    state.stopAfterModel = true;
    await expect(worker.drain()).rejects.toThrow('preview stopped');
    expect(journal.view.order[0]?.answer).toBeDefined();
    expect(state.sent).toHaveLength(0);
    journal.close(); state.stopped = false; state.stopAfterModel = false; ({ journal, worker } = open());
    await worker.drain();
    expect(state.sent).toHaveLength(1);
    state.now = friday9; state.fail = true;
    await worker.sendReminders();
    expect(pushes()).toEqual([priyaLine]);
    expect([...journal.view.reminders.values()][0]?.sent).toBeUndefined();
    journal.close(); ({ journal, worker } = open());
    state.fail = false;
    await worker.sendReminders();
    expect(pushes()).toHaveLength(1); // UNKNOWN consumed its slot; it is never retried.
    expect(journal.view.replies).toBe(2);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('never pushes an unrequested dated item, even when it is due or overdue', async () => {
  const root = tmp('unrequested');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    // A legacy trial-wide grant frame still replays, but no longer authorizes pushing unrequested items.
    journal.append({ kind: 'reminder-grant', reference: 'operator:legacy', trial: genesis.grant, surface: 'telegram-private-chat',
      scope: 'initiated-dated-reminders', custodian: genesis.operator, recovery: 'unknown-never-retry', at: start });
    journal.close(); ({ journal, worker } = open());
    worker.intake([update(1, 'My dentist is Friday at 9 am.'), update(2, 'Invoice due Oct 2.')]); await worker.drain();
    expect(journal.view.dated).toHaveLength(2);
    expect(journal.view.dated.every(item => item.remind === undefined)).toBe(true);
    expect(state.sent[0]!.text).toContain('I send a reminder only when you ask for one.');
    for (const at of [friday9, friday9 + 6 * 3600_000, friday9 + 3 * 86400_000]) { state.now = at; await worker.sendReminders(); }
    expect(pushes()).toEqual([]);
    expect(journal.view.reminders.size).toBe(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('groups reminders due together in one topic into one message, and keeps topics apart', async () => {
  const root = tmp('group');
  try {
    const { state, open, pushes } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, priya, 7654321, 17), update(2, 'remind me Oct 2 to pay rent', 7654321, 17),
      update(3, 'remind me Friday at 9 am to water plants', 7654321, 23)]);
    await worker.drain();
    state.now = friday9;
    await worker.sendReminders();
    expect(pushes()).toHaveLength(2);
    const topic17 = state.sent.find(item => item.thread === 17 && item.text.startsWith('PREVIEW reminder'))!;
    expect(topic17.text).toBe(`${priyaLine}\nPREVIEW reminder you asked for on 2026-09-26 10:02: "remind me Oct 2 to pay rent" (due 2026-10-02 09:00 America/Los_Angeles)`);
    expect(state.sent.find(item => item.thread === 23 && item.text.startsWith('PREVIEW reminder'))!.text).toContain('water plants');
    expect(journal.view.reminders.size).toBe(2);
    await worker.sendReminders();
    expect(pushes()).toHaveLength(2);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('sends only the reminder that is due; a later one in the same topic gets its own message later', async () => {
  const root = tmp('staggered');
  try {
    const { state, open, pushes } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, priya), update(2, 'remind me Friday at 11 am to file taxes')]); await worker.drain();
    state.now = friday9; await worker.sendReminders();
    expect(pushes()).toEqual([priyaLine]);
    state.now = friday9 + 2 * 3600_000; await worker.sendReminders();
    expect(pushes()).toHaveLength(2);
    expect(pushes()[1]).toContain('file taxes');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('cancels or changes a reminder by a later verified operator message, durably across restart', async () => {
  const root = tmp('cancel');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya), update(2, 'remind me Friday at 9 am to buy milk')]); await worker.drain();
    worker.intake([update(3, 'cancel the Priya reminder')]); await worker.drain();
    expect(state.sent.at(-1)!.text).toContain(`Cancelled reminder: "${priya}".`);
    expect(journal.view.reminderCancels).toHaveLength(1);
    // A change is a cancel plus a new request.
    worker.intake([update(4, 'cancel the milk reminder')]); await worker.drain();
    worker.intake([update(5, 'remind me Friday at 10 am to buy milk')]); await worker.drain();
    // A cancel naming nothing listed cancels nothing.
    worker.intake([update(6, 'cancel the dentist reminder')]); await worker.drain();
    expect(state.sent.at(-1)!.text).toContain('I could not tell which reminder to cancel, so none was cancelled.');
    journal.close(); ({ journal, worker } = open());
    state.now = friday9; await worker.sendReminders();
    expect(pushes()).toEqual([]);
    state.now = friday9 + 3600_000; await worker.sendReminders();
    expect(pushes()).toEqual(['PREVIEW reminder you asked for on 2026-09-26 10:05: "remind me Friday at 10 am to buy milk" (due 2026-10-02 10:00 America/Los_Angeles)']);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a request whose time is unsettled, already past, or after the preview ends, and says why', async () => {
  const root = tmp('refuse');
  try {
    const { state, open, pushes } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, 'remind me Friday at 9 to call Priya'), update(2, 'remind me Sep 26 to stretch'),
      update(3, 'remind me Oct 20 to renew')]);
    await worker.drain();
    expect(journal.view.dated.every(item => item.remind === undefined)).toBe(true);
    expect(state.sent[0]!.text).toContain('I did not set the reminder you asked for: its day or time is not settled');
    expect(state.sent[1]!.text).toContain('I did not set the reminder you asked for: that time has already passed.');
    expect(state.sent[2]!.text).toContain('I did not set the reminder you asked for: this preview ends before then.');
    state.now = friday9; await worker.sendReminders();
    expect(pushes()).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('sends nothing while stopped, after an operator stop, or when the reply cap is reached', async () => {
  for (const guard of ['stopped', 'operator-stop', 'cap'] as const) {
    const root = tmp(guard);
    try {
      const { state, open, pushes } = harness(root, guard === 'cap' ? 1 : genesis.maxReplies);
      const { journal, worker } = open(true);
      worker.intake([update(1, priya)]); await worker.drain();
      expect(journal.view.dated).toMatchObject([{ remind: true }]);
      state.now = friday9;
      if (guard === 'stopped') {
        state.stopped = true;
        await expect(worker.sendReminders()).rejects.toThrow('preview stopped');
      } else if (guard === 'operator-stop') {
        worker.stop('operator');
        await expect(worker.sendReminders()).rejects.toThrow();
      } else await worker.sendReminders(); // the request's own reply used the only reply slot.
      expect(pushes()).toEqual([]);
      expect([...journal.view.reminders.values()].filter(item => item.requested)).toHaveLength(0);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('refuses the retired trial-wide reminder grant option before any work, and accepts a launch without it', () => {
  const root = tmp('retired');
  try {
    openPreviewJournal(join(root, 'journal.encrypted'), key, genesis).close();
    const run = (extra: string[]) => spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'status', '--root', root, ...extra],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
      env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    const plain = run([]);
    expect(plain.status, plain.stderr).toBe(0);
    expect(JSON.parse(plain.stdout).reminders).toMatchObject({ requested: 0, pending: [] });
    const retired = run(['--reminder-grant-reference', 'operator:reminders']);
    expect(retired.status).toBe(1);
    expect(retired.stdout).toBe('');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a reminder intent frame for an unrequested, not-yet-due or repeated item, and accepts the exact due one', async () => {
  const root = tmp('frames');
  try {
    const { state, open } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, priya), update(2, 'My dentist is Friday at 9 am.')]); await worker.drain();
    const [requested, unrequested] = journal.view.dated;
    const frame = (item: typeof requested, at: number, text = priyaLine) => ({ kind: 'requested-reminder-intent' as const, batch: 0,
      items: [{ source: item!.source, quote: item!.quote, when: item!.when }], text, body: text, chat: genesis.chat, grant: genesis.grant, at });
    // int12 clamps an append's time to the journal's durable floor, so the early frame goes first.
    expect(() => journal.append(frame(requested, friday9 - 60_000))).toThrow('requested reminder intent refused');
    expect(() => journal.append(frame(unrequested, friday9, 'PREVIEW reminder you asked for'))).toThrow('requested reminder intent refused');
    expect(() => journal.append(frame(requested, friday9, `${priyaLine} extra`))).toThrow('requested reminder intent refused');
    journal.append(frame(requested, friday9));
    expect(() => journal.append({ ...frame(requested, friday9), batch: 1 })).toThrow('requested reminder intent refused');
    state.now = friday9; await worker.sendReminders();
    expect(state.sent.filter(item => item.text.startsWith('PREVIEW reminder'))).toEqual([]); // the durable intent is UNKNOWN; never sent twice.
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds a reminder while a later operator cancellation is unsettled by a call cap or an UNKNOWN model result', async () => {
  for (const unsettled of ['cap', 'uncertain'] as const) {
    const root = tmp(`unsettled-${unsettled}`);
    try {
      const { state, open, pushes } = harness(root, genesis.maxReplies, unsettled === 'cap' ? { maxCalls: 1 } : {});
      let { journal, worker } = open(true);
      worker.intake([update(1, priya)]); await worker.drain();
      expect(journal.view.dated).toMatchObject([{ remind: true }]);
      state.uncertain = unsettled === 'uncertain';
      worker.intake([update(2, 'cancel the Priya reminder')]); await worker.drain();
      if (unsettled === 'cap') expect(journal.view.order[1]?.held).toBe('call cap');
      else expect(journal.view.order[1]?.modelState).toBe('uncertain');
      journal.close(); ({ journal, worker } = open()); // reopen keeps the hold.
      state.now = friday9 + 3600_000;
      await worker.drain(); // an UNKNOWN answer's content-free notice does not settle it either.
      await worker.sendReminders();
      expect(pushes()).toEqual([]);
      expect(journal.view.replies).toBeLessThanOrEqual(2);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('holds a reminder when a later operator message gets a plain reply with no recorded decision', async () => {
  const root = tmp('plain');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya)]); await worker.drain();
    state.plain = true;
    worker.intake([update(2, 'cancel the Priya reminder')]); await worker.drain();
    expect(journal.view.order[1]?.memoryPending).toBe(true);
    expect(journal.view.reminderCancels).toEqual([]);
    expect(state.sent.some(item => item.text.includes('I cancelled'))).toBe(false); // no unfounded cancel claim.
    journal.close(); ({ journal, worker } = open());
    state.now = friday9 + 3600_000;
    await worker.drain(); await worker.sendReminders();
    expect(pushes()).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('releases a reminder held by a plain reply once recovery records that the turn cancels nothing, sending it exactly once', async () => {
  const root = tmp('recovered');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya)]); await worker.drain();
    state.plain = true; state.plainText = 'You are welcome.'; state.summaryCancel = 'keep';
    worker.intake([update(2, 'Thanks, that is helpful.')]); await worker.drain();
    await worker.summarizeIfNeeded(); // the launcher's per-cycle recovery call
    const thanks = journal.view.order[1]!;
    expect(thanks.memoryPending).toBe(true); // still rendered safely
    expect(journal.view.summaries.some(item => item.memoryFor?.includes(thanks.id) && item.reminderCancels?.length === 0)).toBe(true);
    state.plain = false;
    worker.intake([update(3, 'Please keep the Priya reminder as requested.')]); await worker.drain();
    journal.close(); ({ journal, worker } = open());
    state.now = friday9;
    await worker.drain(); await worker.sendReminders();
    expect(pushes()).toEqual([priyaLine]);
    journal.close(); ({ journal, worker } = open());
    state.now = friday9 + 3600_000;
    await worker.drain(); await worker.sendReminders();
    expect(pushes()).toEqual([priyaLine]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps a plain-reply cancellation: recovery that cancels, or records no reminder decision, never releases the reminder', async () => {
  for (const summaryCancel of ['cancel', 'omit'] as const) {
    const root = tmp(`recovered-${summaryCancel}`);
    try {
      const { state, open, pushes } = harness(root);
      let { journal, worker } = open(true);
      worker.intake([update(1, priya)]); await worker.drain();
      state.plain = true; state.summaryCancel = summaryCancel;
      worker.intake([update(2, 'cancel the Priya reminder')]); await worker.drain();
      await worker.summarizeIfNeeded(); // the launcher's per-cycle recovery call
      expect(journal.view.reminderCancels).toHaveLength(summaryCancel === 'cancel' ? 1 : 0);
      expect(journal.view.summaries.some(item => item.memoryFor?.includes(journal.view.order[1]!.id))).toBe(summaryCancel === 'cancel');
      journal.close(); ({ journal, worker } = open());
      state.now = friday9 + 3600_000;
      await worker.drain(); await worker.sendReminders();
      expect(pushes()).toEqual([]);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('releases the reminder once a later operator message is interpreted and cancels nothing', async () => {
  const root = tmp('settled');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya), update(2, 'My dentist is Oct 9.')]); await worker.drain();
    journal.close(); ({ journal, worker } = open());
    state.now = friday9;
    await worker.sendReminders();
    expect(pushes()).toEqual([priyaLine]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('sends an oversized same-topic group as one fitting message with a count line, never another push across restart', async () => {
  const root = tmp('overflow');
  try {
    const { state, open, pushes } = harness(root, 40, { maxCalls: 40, maxTurns: 30, maxBytes: 32768 });
    let { journal, worker } = open(true);
    const tasks = Array.from({ length: 8 }, (_, n) => `remind me Friday at 9 am to do task ${n} ${'detailed description '.repeat(21)}`.trim());
    worker.intake(tasks.map((text, n) => update(n + 1, text))); await worker.drain();
    expect(journal.view.dated.filter(item => item.remind)).toHaveLength(8);
    state.now = friday9;
    for (let poll = 0; poll < 4; poll++) {
      await worker.sendReminders();
      journal.close(); ({ journal, worker } = open());
    }
    // Rule 52: one push per topic; what does not fit is one count line, never a later push.
    expect(pushes()).toHaveLength(1);
    const lines = pushes()[0]!.split('\n'), listed = lines.filter(line => line.startsWith('PREVIEW reminder you asked for'));
    expect(Buffer.byteLength(pushes()[0]!)).toBeLessThanOrEqual(4096);
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.length).toBeLessThan(8);
    expect(lines.at(-1)).toBe(reminderOverflowLine(8 - listed.length));
    expect(new Set(listed).size).toBe(listed.length);
    await worker.sendReminders();
    expect(pushes()).toHaveLength(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
