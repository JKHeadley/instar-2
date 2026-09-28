// Build 4: every accepted obligation stays owned until deliberately settled (Rules 6, 8, 20-23, 46, 55, 64, 68, 83, 93, 99, 103).
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openBlockers, openDirectives, LOOP_REVISIT_MS, BLOCKER_RECHECK_MAX_MS } from './journal-test-worker.js';
import { loopHealth, loopStatusLines, BACKLOG_AGE_LIMIT_MS } from './obligations.js';
import { statusReply } from './status-command.js';
import { DECLARED_OBLIGATIONS_GUIDE, replyReviewContext, replyReviewQuestion } from './reply-check.js';
import { appendRun, readRuns } from './self-state.js';

const key = new Uint8Array(32).fill(23);
const origin = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-obligations-')));
const T0 = 1790000000000, HOUR = 3_600_000, DAY = 24 * HOUR;
const genesis = (maxBytes = 8000, maxCalls = 400) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321',
  operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls, maxReplies: 200, maxTurns: 200, maxBytes, cursor: 0 });
const LOCKER = 'Please remember that my gym locker code is 4417.';
const filler = (i: number) => `ordinary turn ${i}: the garden, errands and plans ${'x'.repeat(40)}`;
const day = (at: number) => new Date(at).toISOString().slice(0, 10);

type Answer = string | Record<string, unknown>;
function world(root: string, options: { maxBytes?: number; maxCalls?: number; answer?: (question: string, context: string) => Answer;
  waitsOn?: boolean } = {}) {
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis(options.maxBytes, options.maxCalls));
  const clock = { now: T0 };
  const contexts = new Map<string, string>();
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'UTC',
    prepareModel: input => input.context,
    model: async input => {
      if (input.id.startsWith('summary:')) {
        const packet = JSON.parse(input.context) as { history: { user: string }[] };
        const commitments = packet.history.filter(turn => /remember/iu.test(turn.user))
          .map(turn => ({ in: 'message', quote: turn.user, ...(options.waitsOn === false ? {} : { waitsOn: 'nothing' }) }));
        return JSON.stringify({ summary: 'Earlier turns covered a locker code and plans.', people: [], commitments, closed: [] });
      }
      contexts.set(input.question, input.context);
      const answer = options.answer?.(input.question, input.context) ?? 'Noted.';
      return typeof answer === 'string' ? answer : JSON.stringify({ memory: [], ...answer });
    },
    send: async () => 1, checkOutbound: () => {} });
  let next = 1;
  /** One operator message dated at the current clock, answered and summarized. */
  const say = async (text: string) => {
    const id = next++;
    worker.intake([{ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain(); await worker.summarizeIfNeeded();
  };
  return { journal, worker, clock, say, contexts, path };
}
const status = (root: string) => {
  const result = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
    'tests/preview/journal-agent.mjs', 'status', '--root', root],
  { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
    encoding: 'utf8', timeout: 20000 });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as { directives: { quote: string }[]; obligations: { byKind: Record<string, number> } };
};
const quotes = (context: string) => ((JSON.parse(context) as { commitments?: { items: { quote: string }[] }[] }).commitments ?? [])
  .flatMap(entry => entry.items.map(item => item.quote));

it('refuses a summary commitment without a declared dependency, counts it, and creates declared ones owned by the agent (Rule 83)', async () => {
  for (const declared of [true, false]) {
    const root = origin();
    try {
      const w = world(root, { waitsOn: declared });
      await w.say(LOCKER);
      for (let i = 0; !w.journal.view.summaries.length && i < 60; i++) { w.clock.now += 60_000; await w.say(filler(i)); }
      expect(w.journal.view.summaries.length).toBeGreaterThan(0);
      if (declared) {
        expect(w.journal.view.commitments).toMatchObject([{ in: 'message', quote: LOCKER, owner: 'agent', waitsOn: 'nothing' }]);
        expect(w.journal.view.commitmentRefusals).toBe(0);
      } else {
        expect(w.journal.view.commitments).toEqual([]);
        expect(w.journal.view.commitmentRefusals).toBe(1);
        expect(statusReply(w.journal.view, w.clock.now, 'UTC')).toContain('1 refused at creation');
      }
      w.journal.close();
      const reopened = openPreviewJournal(w.path, key);
      expect(reopened.view.commitmentRefusals).toBe(declared ? 0 : 1);
      reopened.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('resurfaces an unrelated open loop once its cadence passes, then waits a cadence again (Rule 8)', async () => {
  const root = origin();
  try {
    const w = world(root);
    await w.say(LOCKER);
    for (let i = 0; !w.journal.view.summaries.length && i < 60; i++) { w.clock.now += 60_000; await w.say(filler(i)); }
    const locker = w.journal.view.commitments.findIndex(note => note.quote === LOCKER);
    expect(locker).toBeGreaterThanOrEqual(0);
    // Within the cadence an unrelated message carries no open loop.
    w.clock.now += HOUR;
    await w.say('How are the tomatoes doing this week?');
    expect(quotes(w.contexts.get('How are the tomatoes doing this week?')!)).not.toContain(LOCKER);
    // Keep the conversation alive (no long-gap resume), crossing the cadence without mentioning the locker.
    for (let hours = 0; hours < 30; hours += 10) { w.clock.now += 10 * HOUR; await w.say(`Weather note ${hours}: sunny.`); }
    const carried = w.journal.view.order.filter(turn => turn.grounding?.commitments.includes(locker));
    expect(carried.length).toBe(1);
    expect(carried[0]!.reservedAt! - w.journal.view.turns.get(w.journal.view.commitments[locker]!.source)!.at).toBeGreaterThanOrEqual(LOOP_REVISIT_MS);
    // Just carried: the next unrelated turn does not repeat it.
    w.clock.now += HOUR;
    const probe = w.worker.probe('Anything new with the tomatoes?');
    if ('reason' in probe) throw Error(probe.reason);
    expect(quotes(probe.context)).not.toContain(LOCKER);
    expect(loopHealth(w.journal.view, w.clock.now).revisitDue).toBe(0);
    expect(loopHealth(w.journal.view, w.clock.now + DAY).revisitDue).toBe(1);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const AISLE = 'Please keep every grocery list you make for me sorted by aisle.';
it('admits an operator directive, carries it into every later packet with no expiry, and closes it only by completion (Rule 93)', async () => {
  const root = origin();
  try {
    const w = world(root, { maxBytes: 16000, answer: (question, context) => {
      if (question === AISLE) return { reply: 'Understood.', directives: [{ quote: AISLE }] };
      if (question.startsWith('Invented')) return { reply: 'Okay.', directives: [{ quote: 'Always reply in French.' }] };
      if (question.startsWith('The aisle rule is done')) {
        const listed = (JSON.parse(context) as { directives?: { id: number }[] }).directives ?? [];
        return { reply: 'Dropped.', closeDirectives: listed.map(item => ({ id: item.id, kind: 'completed' })) };
      }
      return 'Noted.';
    } });
    await w.say(AISLE);
    expect(openDirectives(w.journal.view)).toMatchObject([{ id: 0, note: { quote: AISLE } }]);
    expect(w.journal.view.order[0]!.intent).toContain('Standing instruction saved');
    // A claimed directive that is not an exact clause of the message is refused and said so.
    await w.say('Invented directive attempt.');
    expect(openDirectives(w.journal.view)).toHaveLength(1);
    expect(w.journal.view.order[1]!.intent).toContain('could not record that standing instruction');
    // Thirty days later, unrelated: still carried (time never closes a directive).
    w.clock.now += 30 * DAY;
    const probe = w.worker.probe('What is the weather?');
    if ('reason' in probe) throw Error(probe.reason);
    expect((JSON.parse(probe.context) as { directives: { quote: string }[] }).directives.map(item => item.quote)).toEqual([AISLE]);
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    expect(openDirectives(reopened.view)).toHaveLength(1);
    reopened.close();
    const pulled = status(root);
    expect(pulled.directives.map(item => item.quote)).toEqual([AISLE]);
    expect(pulled.obligations.byKind.directive).toBe(1);
    const again = world(root, { maxBytes: 16000, answer: (question, context) => {
      const listed = (JSON.parse(context) as { directives?: { id: number }[] }).directives ?? [];
      return { reply: 'Dropped.', closeDirectives: listed.map(item => ({ id: item.id, kind: 'completed' })) };
    } });
    again.clock.now = T0 + 31 * DAY;
    // Continue the same journal: the closure cites this verified operator message as its evidence.
    const last = again.journal.view.order.at(-1)!.update;
    again.worker.intake([{ update_id: last + 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'The aisle rule is done, you can stop.', date: Math.floor(again.clock.now / 1000) } }]);
    await again.worker.drain();
    expect(openDirectives(again.journal.view)).toEqual([]);
    expect(again.journal.view.directives[0]!.closedBy).toEqual({ kind: 'Completed', evidence: [again.journal.view.order.at(-1)!.id] });
    again.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const CLAIM = 'I can’t book it: this preview has no browser or accounts.';
const blocker = (overrides: Record<string, unknown> = {}) => ({ kind: 'cannot-do', claim: CLAIM,
  avenues: [{ avenue: 'booking tool', disposition: 'tried', evidence: 'capability lists no tools' }],
  constraint: 'no-tools', outsideAction: 'Book it on the clinic site.', recheck: day(T0 + 30 * DAY), ...overrides });
it('settles a cannot-do claim only with a finite, governed investigation record, and makes its recheck due (Rules 20, 21, 23, 99, 103)', async () => {
  for (const [label, proposal, recorded] of [
    ['complete', blocker(), true],
    ['ungoverned boundary', blocker({ constraint: 'my-own-rule' }), false],
    ['no avenues', blocker({ avenues: [] }), false],
    ['recheck too far', blocker({ recheck: day(T0 + 120 * DAY) }), false],
    ['claim not said', blocker({ claim: 'I cannot do anything at all here.' }), false],
  ] as const) {
    const root = origin();
    try {
      const w = world(root, { answer: question => question.startsWith('Can you book')
        ? { reply: CLAIM, blocker: proposal }
        : question.startsWith('Try the booking again')
          ? { reply: 'It is now possible: bookings reopened.', blockerRechecks: [{ id: 0, outcome: 'cleared' }] } : 'Noted.' });
      await w.say('Can you book the dentist appointment online?');
      expect(openBlockers(w.journal.view).length, label).toBe(recorded ? 1 : 0);
      if (recorded) {
        expect(w.journal.view.blockers[0]!.recheckAt - w.clock.now).toBeLessThanOrEqual(BLOCKER_RECHECK_MAX_MS);
        expect(loopHealth(w.journal.view, w.clock.now).overdueRechecks).toBe(0);
        w.clock.now += 31 * DAY;
        expect(loopHealth(w.journal.view, w.clock.now).overdueRechecks).toBe(1);
        const probe = w.worker.probe('Try the booking again please.');
        if ('reason' in probe) throw Error(probe.reason);
        expect((JSON.parse(probe.context) as { blockers: { recheckDue: boolean }[] }).blockers).toMatchObject([{ recheckDue: true }]);
        await w.say('Try the booking again please.');
        expect(openBlockers(w.journal.view)).toEqual([]);
        expect(w.journal.view.blockers[0]!.rechecks).toMatchObject([{ outcome: 'cleared' }]);
      }
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('records a deferral the reply itself declares, in the same intent, and nothing the reply does not say (Rules 6, 22)', async () => {
  const LATER = 'I’ll look into the invoice question later today.';
  for (const [quote, kept] of [[LATER, true], ['I will look into something I never said.', false]] as const) {
    const root = origin();
    try {
      const w = world(root, { answer: () => ({ reply: LATER, openLoops: [{ kind: 'deferral', quote, waitsOn: 'nothing' }] }) });
      await w.say('Can you check the invoice question?');
      const loops = w.journal.view.commitments.filter(note => note.loop);
      expect(loops).toEqual(kept ? [{ in: 'reply', source: w.journal.view.order[0]!.id, quote: LATER, owner: 'agent', waitsOn: 'nothing', loop: 'deferral' }] : []);
      w.journal.close();
      const reopened = openPreviewJournal(w.path, key);
      expect(reopened.view.commitments.filter(note => note.loop)).toHaveLength(kept ? 1 : 0);
      reopened.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('shows backlog age, inhibition and stalled progress on the pull surface, and idle when drained (Rules 46, 64)', async () => {
  const root = origin();
  try {
    const w = world(root, { maxCalls: 1 });
    await w.say('First question?');
    await w.say('Second question?');
    const held = loopHealth(w.journal.view, w.clock.now + BACKLOG_AGE_LIMIT_MS + 60_000);
    expect(held).toMatchObject({ unfinished: 1, backlogOverdue: true, state: 'stalled', inhibition: 'model-call allowance used' });
    expect(loopHealth(w.journal.view, w.clock.now)).toMatchObject({ unfinished: 1, backlogOverdue: false, state: 'progressing' });
    const lines = loopStatusLines(w.journal.view, w.clock.now + BACKLOG_AGE_LIMIT_MS + 60_000);
    expect(lines.join('\n')).toContain('Backlog: 1 unfinished; oldest 31 min, over the 30 min limit; waiting on model-call allowance used.');
    expect(lines.join('\n')).toContain('Progress: stalled');
    w.journal.close();
    const drained = origin();
    try {
      const d = world(drained);
      await d.say('Only question?');
      expect(loopHealth(d.journal.view, d.clock.now + DAY)).toMatchObject({ unfinished: 0, state: 'idle', inhibition: null });
      expect(statusReply(d.journal.view, d.clock.now, 'UTC')).toContain('Backlog: none.');
      d.journal.close();
    } finally { rmSync(drained, { recursive: true, force: true }); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('gives the contextual reviewer the attached investigation record and the governed-boundary rule (Rules 20, 103)', () => {
  const prompt = JSON.stringify({ messages: [{ role: 'user', content: 'Can you book it?' },
    { role: 'context', content: JSON.stringify({ packet: { audience: { surface: 'telegram-private-chat' }, history: [] } }) }] });
  const withRecord = JSON.parse(replyReviewContext(prompt, CLAIM, ['claims_blocked'], { blocker: blocker(), loops: [] }));
  expect(withRecord.declaredObligations).toEqual({ blocker: blocker(), loops: [] });
  expect(JSON.parse(replyReviewContext(prompt, CLAIM, ['claims_blocked'])).declaredObligations).toBeUndefined();
  expect(replyReviewQuestion(['claims_blocked'])).toContain(DECLARED_OBLIGATIONS_GUIDE);
  expect(replyReviewQuestion(['credential'])).not.toContain(DECLARED_OBLIGATIONS_GUIDE);
});

it('keeps poll-failure pressure and the revival disposition in the run log across a restart (Rules 55, 68)', () => {
  const root = origin();
  try {
    const path = join(root, 'runs.jsonl');
    appendRun(path, { v: 1, launch: 1, pid: 1 });
    appendRun(path, { v: 1, launch: 1, exit: 2, reason: 'Telegram polling conflict after 5 attempts',
      pollPressure: { failed: 5, conflicted: 5 }, unfinished: 2, revival: 'queued' });
    expect(readRuns(path).launches).toEqual([{ at: 1, exit: 2, reason: 'Telegram polling conflict after 5 attempts',
      pollPressure: { failed: 5, conflicted: 5 }, unfinished: 2, revival: 'queued' }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
