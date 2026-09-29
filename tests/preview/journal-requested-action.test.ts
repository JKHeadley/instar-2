import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openRequests, REQUEST_ITEM_LIMIT, requestOverflowLine } from './journal-test-worker.js';
import type { openPreviewJournal as OpenJournal } from './journal.js';

const key = new Uint8Array(32).fill(29);
const start = Date.UTC(2026, 8, 26, 17); // Saturday 10:00 in Los Angeles.
const friday9 = Date.UTC(2026, 9, 2, 16); // Friday 2026-10-02 09:00 in Los Angeles.
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:requested-action', configurationDigest: 'sha256:requested-action', expires: Date.UTC(2026, 9, 10),
  maxCalls: 20, maxReplies: 8, maxTurns: 10, maxBytes: 12000, cursor: 0 };
const update = (id: number, text: string, sender = 7654321, thread?: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: sender }, text,
    date: Math.floor(start / 1000) + id * 60, ...(thread === undefined ? {} : { message_thread_id: thread }) } });
const priya = 'remind me Friday at 9 am to call Priya';
const header = (asked: string, request: string, due = '2026-10-02 09:00') =>
  `PREVIEW — You asked on 2026-09-26 ${asked}: "${request}" (due ${due} America/Los_Angeles)`;
const priyaHeader = header('10:01', priya);
type Input = { id: string; question: string; context: string };
/** A model stand-in. It decides meaning the way the answer packet asks; a due turn gets the operator's own
 * request text and answers it as an ordinary turn. */
const decide = (input: Input) => {
  if (input.id.startsWith('requested-action:')) {
    const asked = [...input.question.matchAll(/\] (.+)$/gmu)].map(match => match[1]!);
    return `Doing what you asked: ${asked.join(' / ')}.`;
  }
  const request = /^(?:remind me|tell me) (.+?) (?:to|what|whether) /u.exec(input.question) ?? /^remind me (.+)$/u.exec(input.question);
  if (request) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: input.question, when: request[1]!, remind: true }] });
  const cancel = /^cancel the (\w+) (?:reminder|request)/u.exec(input.question);
  if (cancel) {
    const listed = (JSON.parse(input.context) as { reminders?: { id: string; quote: string }[] }).reminders ?? [];
    const ids = listed.filter(item => item.quote.includes(cancel[1]!)).map(item => item.id);
    return JSON.stringify({ reply: 'Okay.', memory: [], dated: [], cancelReminders: ids.length ? ids : ['reminder-unlisted'] });
  }
  const dated = /(Friday at \d+ am|Oct \d+)/u.exec(input.question);
  return JSON.stringify({ reply: 'Recorded.', memory: [], dated: dated ? [{ quote: input.question, when: dated[1] }] : [] });
};
const harness = (root: string, maxReplies = genesis.maxReplies, limits: Partial<typeof genesis> = {}) => {
  const state = { now: start, stopped: false, stopWhenQueued: false, fail: false, uncertain: false, plain: false, crashDue: false,
    plainText: 'Okay, I cancelled the Priya reminder.', summaryCancel: undefined as undefined | 'keep' | 'cancel' | 'omit',
    sent: [] as { text: string; thread?: number }[], dueCalls: 0 };
  let current: ReturnType<typeof OpenJournal> | undefined;
  const queued = () => current?.view.order.some(turn => turn.requestedAction && turn.intent === undefined) ?? false;
  const ports = { now: () => state.now, stopped: () => state.stopped || state.stopWhenQueued && queued(), timeZone: 'America/Los_Angeles',
    model: async (input: Input) => {
      if (input.id.startsWith('summary:') && state.summaryCancel) {
        const listed = (JSON.parse(input.context) as { reminders?: { id: string }[] }).reminders ?? [];
        return JSON.stringify({ summary: `The operator asked: ${priya}.`, people: [], memory: [], commitments: [], questions: [],
          ...(state.summaryCancel === 'omit' ? {} : { cancelReminders: state.summaryCancel === 'cancel' ? listed.map(item => item.id) : [] }) });
      }
      if (input.id.startsWith('requested-action:')) {
        state.dueCalls++;
        if (state.crashDue) throw Error('crash during the due turn\'s model call');
      }
      return state.uncertain ? { state: 'uncertain' as const } : state.plain ? state.plainText : decide(input); },
    checkOutbound: () => {},
    send: async (value: { expectedText: string; thread?: number }) => {
      state.sent.push({ text: value.expectedText, ...(value.thread === undefined ? {} : { thread: value.thread }) });
      return state.fail && value.expectedText.startsWith('PREVIEW — You asked on') ? null : state.sent.length;
    } };
  const path = join(root, 'journal.encrypted');
  const open = (first = false) => {
    const journal = first ? openPreviewJournal(path, key, { ...genesis, maxReplies, ...limits }) : openPreviewJournal(path, key);
    current = journal;
    return { journal, worker: createJournalWorker(journal, ports) };
  };
  const pushes = () => state.sent.filter(item => item.text.startsWith('PREVIEW — You asked on')).map(item => item.text);
  return { state, open, pushes };
};
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-requested-${name}-`)));
const status = (root: string, extra: string[] = []) => spawnSync(process.execPath,
  ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root, ...extra],
  { cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });

it('answers a requested action once at its due time as an ordinary turn, stating the request and when it was made, across restarts', async () => {
  const root = tmp('once');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya)]); await worker.drain();
    expect(journal.view.dated).toMatchObject([{ day: '2026-10-02', time: '09:00', remind: true }]);
    expect(state.sent[0]!.text).toContain('I will act on this once at 2026-10-02 09:00 (America/Los_Angeles) and send you the result here.');
    journal.close(); ({ journal, worker } = open()); // restart after the grant, before due.
    state.now = friday9 - 60_000;
    await worker.sendRequested();
    expect(pushes()).toEqual([]);
    expect(journal.view.order.some(turn => turn.requestedAction)).toBe(false); // not due: no turn, no call.
    state.now = friday9;
    await worker.sendRequested();
    // The due turn is the operator's own request, answered through the ordinary answer path.
    const due = journal.view.order.find(turn => turn.requestedAction)!;
    expect(due).toMatchObject({ id: 'requested-action:0', accepted: true, writer: { kind: 'system' } });
    expect(due.text).toBe(`[Due now: on 2026-09-26 10:01 the operator asked for this at 2026-10-02 09:00 America/Los_Angeles.] ${priya}`);
    expect(pushes()).toEqual([`${priyaHeader}\nDoing what you asked: ${priya}.`]);
    expect(state.dueCalls).toBe(1);
    expect(journal.view.replies).toBe(2);
    journal.close(); ({ journal, worker } = open()); // restart after the receipt.
    state.now = friday9 + 3600_000;
    await worker.drain(); await worker.sendRequested();
    expect(pushes()).toHaveLength(1);
    expect(state.dueCalls).toBe(1);
    expect(journal.view.replies).toBe(2);
    journal.close();
    const read = status(root);
    expect(read.status, read.stderr).toBe(0);
    const report = JSON.parse(read.stdout);
    expect(report.requestedActions).toEqual({ requested: 1, cancelled: 0, accepted: 1, refused: 0, unknown: 0, open: [],
      dueTurns: [{ update: 1 + 1 / 1024, requests: 1, state: 'accepted' }] });
    expect(report.self).toContain('Requested actions Telegram accepted: 1 today, 1 in this trial; 0 requested and not yet sent.');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('schedules a same-day clock time when the model restates it as an absolute date, and refuses a restatement that disagrees', async () => {
  // Live B3 (2026-09-29): the model returned when "2026-09-29 09:03 America/Los_Angeles" for "today at 9:03 am".
  const walk = 'Remind me today at 11:03 am to take a short walk';
  const recorded = (when: string) => JSON.stringify({ reply: 'Okay.', dated: [{ quote: walk, when, remind: true }] });
  for (const [when, schedules] of [['2026-09-26 11:03 America/Los_Angeles', true], ['2026-09-26 11:03 am', true],
    ['today at 11:03 am', true], ['2026-09-26 11:30 America/Los_Angeles', false], ['2026-09-27 11:03 America/Los_Angeles', false],
    ['2026-09-26 11:03 Europe/London', false]] as const) {
    const root = tmp('same-day');
    try {
      const { state, open, pushes } = harness(root);
      const { journal, worker } = open(true);
      state.plain = true; state.plainText = recorded(when);
      worker.intake([update(1, walk)]); await worker.drain();
      state.plain = false;
      if (!schedules) {
        expect(journal.view.dated, when).toEqual([]);
        expect(state.sent[0]!.text, when).toContain('I could not verify the date you gave.');
        journal.close(); continue;
      }
      expect(journal.view.dated, when).toMatchObject([{ day: '2026-09-26', time: '11:03', when: 'today at 11:03 am', remind: true }]);
      expect(state.sent[0]!.text).toContain('I will act on this once at 2026-09-26 11:03 (America/Los_Angeles)');
      state.now = Date.UTC(2026, 8, 26, 18, 3);
      await worker.sendRequested();
      expect(pushes()).toHaveLength(1);
      expect(pushes()[0]).toContain(walk);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('survives a restart between creating the due turn and answering it, and never repeats an UNKNOWN model call or send', async () => {
  const root = tmp('restarts');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya)]); await worker.drain();
    // Step 1: the due turn is created, then the process stops before its model call.
    state.now = friday9; state.stopWhenQueued = true;
    await expect(worker.sendRequested()).rejects.toThrow('preview stopped');
    expect(journal.view.order.filter(turn => turn.requestedAction)).toHaveLength(1);
    expect(state.dueCalls).toBe(0);
    journal.close(); state.stopWhenQueued = false; ({ journal, worker } = open());
    // Step 2: the model call dies after its durable reservation: an orphaned UNKNOWN, never repeated.
    state.crashDue = true;
    await worker.sendRequested();
    expect(state.dueCalls).toBe(1);
    expect(journal.view.order.filter(turn => turn.requestedAction)).toHaveLength(1); // no second due turn.
    journal.close(); state.crashDue = false; ({ journal, worker } = open());
    await worker.sendRequested();
    expect(state.dueCalls).toBe(1);
    expect(pushes()).toEqual([]);
    journal.close();
    expect(JSON.parse(status(root).stdout).requestedActions.dueTurns).toEqual([{ update: 1 + 1 / 1024, requests: 1, state: 'model UNKNOWN' }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('states an UNKNOWN model result truthfully under the reason header, once, and never repeats the call', async () => {
  const root = tmp('uncertain-answer');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya)]); await worker.drain();
    state.now = friday9; state.uncertain = true;
    await worker.sendRequested();
    expect(state.dueCalls).toBe(1);
    journal.close(); state.uncertain = false; ({ journal, worker } = open());
    await worker.sendRequested();
    expect(state.dueCalls).toBe(1);
    expect(pushes()).toEqual([`${priyaHeader}\nI lost my answer to this: the model call's outcome is unknown, and I never repeat it. Ask me again if you still want it.`]);
    journal.close(); ({ journal, worker } = open());
    await worker.sendRequested();
    expect(pushes()).toHaveLength(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps an UNKNOWN send as the one attempt: never resent after restart', async () => {
  const root = tmp('unknown-send');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya)]); await worker.drain();
    state.now = friday9; state.fail = true;
    await worker.sendRequested();
    expect(pushes()).toHaveLength(1);
    expect(journal.view.order.find(turn => turn.requestedAction)?.sent).toBeUndefined();
    journal.close(); state.fail = false; ({ journal, worker } = open());
    await worker.sendRequested();
    expect(pushes()).toHaveLength(1);
    expect(state.dueCalls).toBe(1);
    journal.close();
    expect(JSON.parse(status(root).stdout).requestedActions).toMatchObject({ unknown: 1, accepted: 0,
      dueTurns: [{ state: 'delivery UNKNOWN' }] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('never pushes an unrequested dated item, even when it is due or overdue', async () => {
  const root = tmp('unrequested');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    // A legacy trial-wide grant frame still replays, but authorizes nothing.
    journal.append({ kind: 'reminder-grant', reference: 'operator:legacy', trial: genesis.grant, surface: 'telegram-private-chat',
      scope: 'initiated-dated-reminders', custodian: genesis.operator, recovery: 'unknown-never-retry', at: start });
    journal.close(); ({ journal, worker } = open());
    worker.intake([update(1, 'My dentist is Friday at 9 am.'), update(2, 'Invoice due Oct 2.')]); await worker.drain();
    expect(journal.view.dated).toHaveLength(2);
    expect(journal.view.dated.every(item => item.remind === undefined)).toBe(true);
    expect(state.sent[0]!.text).toContain('I recorded this date; I act on a date only when you ask me to.');
    for (const at of [friday9, friday9 + 6 * 3600_000, friday9 + 3 * 86400_000]) { state.now = at; await worker.sendRequested(); }
    expect(pushes()).toEqual([]);
    expect(journal.view.order.some(turn => turn.requestedAction)).toBe(false);
    expect(state.dueCalls).toBe(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('groups requests due together in one conversation into one answered message, and keeps conversations apart', async () => {
  const root = tmp('group');
  try {
    const { state, open, pushes } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, priya, 7654321, 17), update(2, 'tell me Oct 2 whether the rent is paid', 7654321, 17),
      update(3, 'remind me Friday at 9 am to water plants', 7654321, 23)]);
    await worker.drain();
    state.now = friday9;
    await worker.sendRequested();
    expect(pushes()).toHaveLength(2);
    expect(state.dueCalls).toBe(2);
    const topic17 = state.sent.find(item => item.thread === 17 && item.text.startsWith('PREVIEW — You asked on'))!;
    expect(topic17.text).toBe(`${priyaHeader}\n${header('10:02', 'tell me Oct 2 whether the rent is paid')}\n`
      + `Doing what you asked: ${priya} / tell me Oct 2 whether the rent is paid.`);
    expect(state.sent.find(item => item.thread === 23 && item.text.startsWith('PREVIEW — You asked on'))!.text).toContain('water plants');
    await worker.sendRequested();
    expect(pushes()).toHaveLength(2);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('answers only the request that is due; a later one in the same conversation gets its own turn later', async () => {
  const root = tmp('staggered');
  try {
    const { state, open, pushes } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, priya), update(2, 'remind me Friday at 11 am to file taxes')]); await worker.drain();
    state.now = friday9; await worker.sendRequested();
    expect(pushes()).toEqual([`${priyaHeader}\nDoing what you asked: ${priya}.`]);
    state.now = friday9 + 2 * 3600_000; await worker.sendRequested();
    expect(pushes()).toHaveLength(2);
    expect(pushes()[1]).toContain('file taxes');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('cancels or changes a request by a later verified operator message, durably across restart', async () => {
  const root = tmp('cancel');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya), update(2, 'remind me Friday at 9 am to buy milk')]); await worker.drain();
    worker.intake([update(3, 'cancel the Priya reminder')]); await worker.drain();
    expect(state.sent.at(-1)!.text).toContain(`Cancelled request: "${priya}".`);
    expect(journal.view.reminderCancels).toHaveLength(1);
    // A change is a cancel plus a new request.
    worker.intake([update(4, 'cancel the milk reminder')]); await worker.drain();
    worker.intake([update(5, 'remind me Friday at 10 am to buy milk')]); await worker.drain();
    // A cancel naming nothing listed cancels nothing.
    worker.intake([update(6, 'cancel the dentist reminder')]); await worker.drain();
    expect(state.sent.at(-1)!.text).toContain('I could not tell which request to cancel, so none was cancelled.');
    journal.close(); ({ journal, worker } = open());
    state.now = friday9; await worker.sendRequested();
    expect(pushes()).toEqual([]);
    state.now = friday9 + 3600_000; await worker.sendRequested();
    expect(pushes()).toEqual([`${header('10:05', 'remind me Friday at 10 am to buy milk', '2026-10-02 10:00')}\n`
      + 'Doing what you asked: remind me Friday at 10 am to buy milk.']);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('withdraws a queued due turn when one of its requests is cancelled before it is sent; the other request falls due again alone', async () => {
  const root = tmp('queued-cancel');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya), update(2, 'remind me Friday at 9 am to buy milk')]); await worker.drain();
    state.now = friday9; state.stopWhenQueued = true;
    await expect(worker.sendRequested()).rejects.toThrow('preview stopped');
    const queued = journal.view.order.find(turn => turn.requestedAction)!;
    expect(queued.requestedAction!.items).toHaveLength(2);
    journal.close(); state.stopWhenQueued = false; ({ journal, worker } = open());
    // The operator cancels one request that is already in the queued due turn.
    worker.intake([update(3, 'cancel the Priya reminder')]); await worker.drain();
    expect(state.sent.at(-1)!.text).toContain(`Cancelled request: "${priya}".`);
    journal.close(); ({ journal, worker } = open());
    await worker.sendRequested();
    // The withdrawn turn is never answered or sent; the milk request gets a new turn of its own.
    expect(journal.view.turns.get(queued.id)!.intent).toBeUndefined();
    expect(journal.view.order.filter(turn => turn.requestedAction)).toHaveLength(2);
    expect(pushes()).toEqual([`${header('10:02', 'remind me Friday at 9 am to buy milk')}\nDoing what you asked: remind me Friday at 9 am to buy milk.`]);
    expect(state.dueCalls).toBe(1);
    journal.close();
    expect(JSON.parse(status(root).stdout).requestedActions.dueTurns.map((turn: { state: string }) => turn.state))
      .toEqual(['withdrawn, not sent', 'accepted']);
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
    expect(state.sent[0]!.text).toContain('I did not schedule what you asked for: its day or time is not settled');
    expect(state.sent[1]!.text).toContain('I did not schedule what you asked for: that time has already passed.');
    expect(state.sent[2]!.text).toContain('I did not schedule what you asked for: this preview ends before then.');
    state.now = friday9; await worker.sendRequested();
    expect(pushes()).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('sends nothing while stopped, after an operator stop, after expiry, or at the reply or call cap', async () => {
  for (const guard of ['stopped', 'operator-stop', 'expired', 'reply-cap', 'call-cap'] as const) {
    const root = tmp(guard);
    try {
      const { state, open, pushes } = harness(root, guard === 'reply-cap' ? 1 : genesis.maxReplies, guard === 'call-cap' ? { maxCalls: 1 } : {});
      const { journal, worker } = open(true);
      worker.intake([update(1, priya)]); await worker.drain();
      expect(journal.view.dated).toMatchObject([{ remind: true }]);
      state.now = friday9;
      // A stopped or stopping runner either refuses the due point outright or creates nothing: no turn, no call, no push.
      if (guard === 'stopped') {
        state.stopped = true;
        await worker.sendRequested().catch((error: Error) => expect(error.message).toBe('preview stopped'));
      } else if (guard === 'operator-stop') {
        worker.stop('operator');
        await worker.sendRequested().catch(() => undefined);
        expect(journal.view.stop).not.toBeNull();
      } else if (guard === 'expired') {
        state.now = genesis.expires + 60_000;
        await worker.sendRequested();
      } else await worker.sendRequested(); // the request's own reply used the only reply slot, or its only call.
      expect(pushes()).toEqual([]);
      expect(state.dueCalls).toBe(0);
      expect(journal.view.order.some(turn => turn.requestedAction)).toBe(false);
      // The request stays open and visible; nothing about it was dropped.
      if (guard === 'reply-cap' || guard === 'call-cap') expect(openRequests(journal.view)).toHaveLength(1);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('refuses the retired trial-wide reminder grant option before any work, and accepts a launch without it', () => {
  const root = tmp('retired');
  try {
    openPreviewJournal(join(root, 'journal.encrypted'), key, genesis).close();
    const plain = status(root);
    expect(plain.status, plain.stderr).toBe(0);
    expect(JSON.parse(plain.stdout).requestedActions).toMatchObject({ requested: 0, open: [], dueTurns: [] });
    const retired = status(root, ['--reminder-grant-reference', 'operator:reminders']);
    expect(retired.status).toBe(1);
    expect(retired.stdout).toBe('');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a due-turn frame for an unrequested, not-yet-due, repeated or unsigned request, and refuses removed frame kinds', async () => {
  const root = tmp('frames');
  try {
    const { open } = harness(root);
    const { journal, worker } = open(true);
    worker.intake([update(1, priya), update(2, 'My dentist is Friday at 9 am.')]); await worker.drain();
    const [requested, unrequested] = journal.view.dated;
    const ref = (item: typeof requested) => ({ source: item!.source, quote: item!.quote, when: item!.when });
    const frame = (items: ReturnType<typeof ref>[], at: number) => ({ kind: 'action-due' as const, id: 'requested-action:0',
      items, update: 2 + 1 / 1024, at });
    // An unsigned frame is refused: only the owner's verified scheduler writes a due turn (Rule 29).
    expect(() => journal.append(frame([ref(requested)], friday9 - 60_000))).toThrow('requested action refused');
    expect(() => journal.append(frame([ref(unrequested)], friday9))).toThrow('requested action refused');
    expect(() => journal.append(frame([ref(requested), ref(requested)], friday9))).toThrow('requested action refused');
    expect(() => journal.append(frame([ref(requested)], friday9))).toThrow('requested action refused');
    // Frames of removed features are never written again.
    expect(() => journal.append({ kind: 'requested-reminder-intent', batch: 0, items: [ref(requested)], text: 'x', body: 'x',
      chat: genesis.chat, grant: genesis.grant, at: friday9 })).toThrow('removed frame kind refused');
    expect(() => journal.append({ kind: 'summary-due', id: 'requested-summary:s:2026-10-02', grant: 's', slot: '2026-10-02',
      update: 2 + 1 / 1024, at: friday9 })).toThrow('removed frame kind refused');
    expect(journal.view.order.some(turn => turn.requestedAction)).toBe(false);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds a request while a later operator cancellation is unsettled by a call cap or an UNKNOWN model result', async () => {
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
      await worker.sendRequested();
      expect(pushes()).toEqual([]);
      expect(journal.view.order.some(turn => turn.requestedAction)).toBe(false);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('holds a request when a later operator message gets a plain-text reply with no recorded decision', async () => {
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
    await worker.drain(); await worker.sendRequested();
    expect(pushes()).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('releases a request held by a plain reply once recovery records that the turn cancels nothing, answering it exactly once', async () => {
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
    await worker.drain(); await worker.sendRequested();
    expect(pushes()).toEqual([`${priyaHeader}\nDoing what you asked: ${priya}.`]);
    journal.close(); ({ journal, worker } = open());
    state.now = friday9 + 3600_000;
    await worker.drain(); await worker.sendRequested();
    expect(pushes()).toHaveLength(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps a plain-text cancellation: recovery that cancels, or records no decision, never releases the request', async () => {
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
      await worker.drain(); await worker.sendRequested();
      expect(pushes()).toEqual([]);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('answers the request once a later operator message is interpreted and cancels nothing', async () => {
  const root = tmp('settled');
  try {
    const { state, open, pushes } = harness(root);
    let { journal, worker } = open(true);
    worker.intake([update(1, priya), update(2, 'My dentist is Oct 9.')]); await worker.drain();
    journal.close(); ({ journal, worker } = open());
    state.now = friday9;
    await worker.sendRequested();
    expect(pushes()).toEqual([`${priyaHeader}\nDoing what you asked: ${priya}.`]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('writes out at most the bounded number of due requests and counts the rest in one line, never another push across restart', async () => {
  const root = tmp('overflow');
  try {
    const { state, open, pushes } = harness(root, 40, { maxCalls: 40, maxTurns: 30, maxBytes: 32768 });
    let { journal, worker } = open(true);
    const tasks = Array.from({ length: 8 }, (_, n) => `remind me Friday at 9 am to do task ${n}`);
    worker.intake(tasks.map((text, n) => update(n + 1, text))); await worker.drain();
    expect(journal.view.dated.filter(item => item.remind)).toHaveLength(8);
    state.now = friday9;
    for (let poll = 0; poll < 4; poll++) {
      await worker.sendRequested();
      journal.close(); ({ journal, worker } = open());
    }
    // Rule 52: one push per conversation; what is not written out is one count line, never a later push.
    expect(pushes()).toHaveLength(1);
    expect(state.dueCalls).toBe(1);
    const lines = pushes()[0]!.split('\n'), listed = lines.filter(line => line.startsWith('PREVIEW — You asked on'));
    expect(listed).toHaveLength(REQUEST_ITEM_LIMIT);
    expect(lines[REQUEST_ITEM_LIMIT]).toBe(requestOverflowLine(8 - REQUEST_ITEM_LIMIT));
    await worker.sendRequested();
    expect(pushes()).toHaveLength(1);
    journal.close();
    expect(JSON.parse(status(root).stdout).requestedActions).toMatchObject({ open: [], dueTurns: [{ requests: 8, state: 'accepted' }] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
