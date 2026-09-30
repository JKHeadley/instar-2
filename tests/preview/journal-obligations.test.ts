// Build 4: every accepted obligation stays owned until deliberately settled (Rules 6, 8, 20-23, 46, 55, 64, 68, 83, 93, 99, 103).
import { expect, it } from 'vitest';
import { chmodSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openBlockers, openDirectives, declaredObligations, dueObligationWork, obligationSchedule,
  LOOP_REVISIT_MS, BLOCKER_RECHECK_MAX_MS, DIRECTIVE_SHARE } from './journal-test-worker.js';
import { loopHealth, loopStatusLines, BACKLOG_AGE_LIMIT_MS } from './obligations.js';
import { statusReply } from './status-command.js';
import { DECLARED_OBLIGATIONS_GUIDE, HOLDING_REPLY, REPLY_RULES, replyReviewContext, replyReviewQuestion, type ObjectionDisposition, type ReplyRule } from './reply-check.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { redact } from '../../src/recall/redact.js';
import { appendRun, readRuns } from './self-state.js';
// @ts-expect-error Physical launchd watcher is JavaScript.
import { lastJournalRun, superviseJournal } from '../../scripts/host-watch.mjs';

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
type Review = { jev?: (text: string) => Partial<Record<ReplyRule, number>>;
  verdict?: (context: Record<string, unknown>) => 'pass' | 'violation';
  /** The agent's one response to the objections on its draft (OR1). Absent: no revision round. */
  revise?: (input: { text: string; objections?: string[] }) => Promise<{ state: 'complete' | 'rejected' | 'uncertain'; text?: string;
    dispositions?: ObjectionDisposition[] }> };
function world(root: string, options: { maxBytes?: number; maxCalls?: number; answer?: (question: string, context: string) => Answer;
  waitsOn?: boolean; work?: (context: Record<string, unknown>) => Answer | Promise<Answer>; review?: Review; stopped?: () => boolean;
  receipt?: (text: string) => boolean; nextUpdate?: number } = {}) {
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis(options.maxBytes, options.maxCalls));
  const clock = { now: T0 };
  const contexts = new Map<string, string>(), reviews: Record<string, unknown>[] = [], work: string[] = [], sent: string[] = [];
  const review = options.review;
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: options.stopped ?? (() => false), timeZone: 'UTC',
    prepareModel: input => input.context,
    ...(review ? { replyCheck: { elapsedMs: () => 0,
      jev: async (text: string, questions?: Record<string, unknown>) => ({ latencyMs: 0, value: { model: 'jev-1.13.0',
        answers: Object.fromEntries(Object.keys(questions ?? REPLY_RULES).map(rule => [rule,
          { type: 'noul', noul: review.jev?.(text)[rule as ReplyRule] ?? 0.01 }])) } }),
      escalate: async (text: string, id: string, originalPrompt?: string, rules?: readonly ReplyRule[]) => {
        // The same context the live runner builds: the answer's packet plus its declared record. This world's
        // prepared prompt is the bare packet, so it is wrapped the way the live envelope carries it.
        const envelope = JSON.stringify({ messages: [{ role: 'user', content: journal.view.turns.get(id)!.text },
          { role: 'context', content: JSON.stringify({ packet: JSON.parse(originalPrompt!) }) }] });
        const context = JSON.parse(replyReviewContext(envelope, text, rules, declaredObligations(journal.view, id))) as Record<string, unknown>;
        reviews.push(context);
        const verdict = review.verdict?.(context) ?? 'pass';
        return { verdict, ruleIds: verdict === 'pass' ? [] : [rules?.includes('defers_work') ? 'defers_work' : rules?.[0] ?? 'defers_work'],
          confidence: null, latencyMs: 0 };
      }, ...(review.revise ? { revise: review.revise } : {}) } } : {}),
    model: async input => {
      if (input.id.startsWith('obligation:')) {
        work.push(input.id);
        const answer = await options.work?.(JSON.parse(input.context) as Record<string, unknown>) ?? { outcome: 'continue', note: 'Still working.' };
        return typeof answer === 'string' ? answer : JSON.stringify(answer);
      }
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
    send: async input => { if (options.receipt && !options.receipt(input.text)) return null; sent.push(input.text); return sent.length; },
    checkOutbound: () => {} });
  let next = options.nextUpdate ?? 1;
  /** One operator message dated at the current clock, answered and summarized. */
  const say = async (text: string) => {
    const id = next++;
    worker.intake([{ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain(); await worker.summarizeIfNeeded();
  };
  return { journal, worker, clock, say, contexts, path, reviews, work, sent };
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
  avenues: [{ avenue: 'booking tool', disposition: 'outside-standing', evidence: 'externalTools' }],
  constraint: 'no-tools', outsideAction: 'Book it on the clinic site.', recheck: day(T0 + 30 * DAY), ...overrides });
it('settles a cannot-do claim only with a finite, governed investigation record, and makes its recheck due (Rules 20, 21, 23, 99, 103)', async () => {
  for (const [label, proposal, recorded] of [
    ['complete', blocker(), true],
    ['ungoverned boundary', blocker({ constraint: 'my-own-rule' }), false],
    ['no avenues', blocker({ avenues: [] }), false],
    ['attempt asserted without a runner-owned record', blocker({ avenues: [{ avenue: 'clinic website', disposition: 'tried', evidence: 'externalTools' }] }), false],
    ['authored evidence text', blocker({ avenues: [{ avenue: 'clinic website', disposition: 'outside-standing', evidence: 'the site was down' }] }), false],
    ['constraint its evidence does not support', blocker({ constraint: 'reply-only-grant' }), false],
    ['runtime inhibition as a wall', blocker({ constraint: 'spend-allowance' }), false],
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
    expect(lines.join('\n')).toContain('Backlog: 1 unfinished (1 message, 0 due work steps); oldest 31 min, over the 30 min limit; waiting on model-call allowance used.');
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


const LATER = 'I’ll look into the invoice question later today.';
const INVOICE = 'Can you check the invoice question?';
it('works a due deferral with no further inbound, keeps its result for the next reply, and settles it on delivery (Rules 8, 22, 46, 64, 92)', async () => {
  const root = origin();
  try {
    const w = world(root, { answer: question => question === INVOICE
      ? { reply: LATER, openLoops: [{ kind: 'deferral', quote: LATER, waitsOn: 'nothing' }] } : 'The tomatoes look fine.',
    work: context => (context.obligation as { quote: string }).quote === LATER
      ? { outcome: 'report', report: 'The invoice is for 120 dollars and is due on Friday.' } : { outcome: 'continue', note: 'x' } });
    await w.say(INVOICE);
    expect(w.journal.view.commitments).toMatchObject([{ in: 'reply', quote: LATER, owner: 'agent', waitsOn: 'nothing', loop: 'deferral' }]);
    const calls = w.journal.view.calls;
    // Before its cadence nothing is due, and the scheduled tick makes no call.
    w.clock.now += LOOP_REVISIT_MS - 60_000;
    expect(await w.worker.workObligations()).toBe(false);
    expect(loopHealth(w.journal.view, w.clock.now)).toMatchObject({ unfinished: 0, dueWork: 0, scheduledWork: 1, state: 'idle' });
    // Past it, with no inbound message at all, the obligation is unfinished work and the tick consumes it.
    w.clock.now += 2 * 60_000;
    expect(loopHealth(w.journal.view, w.clock.now)).toMatchObject({ unfinished: 1, dueWork: 1, state: 'progressing', inhibition: null });
    w.clock.now += 31 * 60_000;
    expect(loopHealth(w.journal.view, w.clock.now)).toMatchObject({ state: 'stalled', backlogOverdue: true });
    expect(await w.worker.workObligations()).toBe(true);
    expect(w.work).toHaveLength(1);
    expect(w.journal.view.calls).toBe(calls + 1);
    // Done, but the reply-only grant has no unsolicited send: the result waits, visibly, for the next reply.
    expect(w.sent).toHaveLength(1);
    expect(loopHealth(w.journal.view, w.clock.now)).toMatchObject({ unfinished: 0, awaitingDelivery: 1,
      deliveryInhibition: 'no grant for unsolicited sends; 1 finished result waits for your next message' });
    expect(await w.worker.workObligations()).toBe(false);
    // The next unrelated message carries it, and the reply actually sent settles the commitment.
    await w.say('How are the tomatoes?');
    expect(w.sent.at(-1)).toContain('Follow-up on "I’ll look into the invoice question later today.": The invoice is for 120 dollars and is due on Friday.');
    expect(w.journal.view.closed.get(0)).toMatchObject({ id: 0, quote: 'The invoice is for 120 dollars and is due on Friday.' });
    expect(loopHealth(w.journal.view, w.clock.now + 3 * DAY)).toMatchObject({ open: 0, unfinished: 0, awaitingDelivery: 0, scheduledWork: 0, state: 'idle' });
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    expect(reopened.view.closed.has(0)).toBe(true);
    expect(reopened.view.obligationWork['commitment:0']).toMatchObject({ attempts: 1, outcome: 'report' });
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('binds a result to the reply that carries it, settles it only on that reply\'s receipt, and keeps an UNKNOWN send unresolved and unrepeated (Rules 8, 68, 97)', async () => {
  const REPORT = 'The invoice is for 120 dollars and is due on Friday.';
  const root = origin();
  try {
    let receipts = true;
    const w = world(root, { receipt: () => receipts, answer: question => question === INVOICE
      ? { reply: LATER, openLoops: [{ kind: 'deferral', quote: LATER, waitsOn: 'nothing' }] } : 'The tomatoes look fine.',
    work: () => ({ outcome: 'report', report: REPORT }) });
    await w.say(INVOICE);
    w.clock.now += LOOP_REVISIT_MS + 60_000;
    expect(await w.worker.workObligations()).toBe(true);
    // A finished result waiting for the next message is still owned: a runner exit must revive for it.
    expect(loopHealth(w.journal.view, w.clock.now)).toMatchObject({ unfinished: 0, awaitingDelivery: 1, ownedWork: 1 });
    // The follow-up's send returns no receipt: the intent carried it, but nothing proves it arrived.
    receipts = false;
    await w.say('Any news?');
    const carrier = w.journal.view.order.at(-1)!;
    expect(carrier.intent).toContain(REPORT);
    expect(carrier.sent).toBeUndefined();
    expect(w.journal.view.obligationWork['commitment:0']!.report).toEqual({ text: REPORT, at: expect.any(Number), boundTo: carrier.id });
    expect(w.journal.view.closed.has(0)).toBe(false);
    const unknown = loopHealth(w.journal.view, w.clock.now);
    expect(unknown).toMatchObject({ open: 1, awaitingDelivery: 0, deliveryUnknown: 1, dueWork: 0 });
    expect(loopStatusLines(w.journal.view, w.clock.now).join('\n')).toContain('Delivery unknown: 1 finished result was sent without a confirmed receipt');
    // Never attached to another reply and never re-worked, even days later.
    receipts = true;
    await w.say('How are the tomatoes?');
    expect(w.sent.at(-1)).not.toContain(REPORT);
    w.clock.now += 3 * DAY;
    expect(await w.worker.workObligations()).toBe(false);
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    expect(reopened.view.closed.has(0)).toBe(false);
    expect(reopened.view.obligationWork['commitment:0']!.report).toMatchObject({ boundTo: carrier.id });
    expect(reopened.view.obligationWork['commitment:0']!.report!.delivered).toBeUndefined();
    expect(loopHealth(reopened.view, w.clock.now)).toMatchObject({ deliveryUnknown: 1, awaitingDelivery: 0 });
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps waiting work owned: the packet shows its current need, the operator\'s supply resumes it, and the result is delivered (Rules 8, 22, 64, 68, 92)', async () => {
  const NEED = 'Please supply the invoice reference code before I can finish.';
  const root = origin();
  const seen: Record<string, unknown>[] = [];
  try {
    let hang = false;
    const answer = (question: string): Answer => question === INVOICE
      ? { reply: LATER, openLoops: [{ kind: 'deferral', quote: LATER, waitsOn: 'nothing' }] } : 'Thanks.';
    const work = (context: Record<string, unknown>): Answer | Promise<Answer> => { seen.push(context);
      if (hang) return new Promise<Answer>(() => {});
      const since = (context.operatorMessagesSince as { text: string }[] | undefined) ?? [];
      return since.some(item => item.text.includes('INV-42'))
        ? { outcome: 'report', report: 'Invoice INV-42 is for 120 dollars and is due on Friday.' }
        : { outcome: 'waiting', waitsOn: 'operator', note: NEED }; };
    const w = world(root, { answer, work });
    await w.say(INVOICE);
    w.clock.now += LOOP_REVISIT_MS + 60_000;
    expect(await w.worker.workObligations()).toBe(true);
    // The one current account of the obligation: the packet, the pull surface and the exit all see the need.
    const probe = w.worker.probe('What do you need from me?');
    if ('reason' in probe) throw Error(probe.reason);
    const items = (JSON.parse(probe.context) as { commitments: { items: { waitsOn: string; need?: string }[] }[] }).commitments.flatMap(entry => entry.items);
    expect(items).toMatchObject([{ waitsOn: 'operator', need: NEED }]);
    const waiting = loopHealth(w.journal.view, w.clock.now);
    expect(waiting).toMatchObject({ waitingWork: [{ key: 'commitment:0', waitsOn: 'operator', need: NEED }], ownedWork: 1, dueWork: 0 });
    expect(loopStatusLines(w.journal.view, w.clock.now).join('\n')).toContain(`Waiting on you: ${NEED}`);
    // Any later operator message, even one in the same instant as the result, earns exactly one reassessment.
    await w.say('Sorry, which code do you need?');
    expect(await w.worker.workObligations()).toBe(true);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toMatchObject({ operatorMessagesSince: [{ text: 'Sorry, which code do you need?' }] });
    expect(w.journal.view.obligationWork['commitment:0']).toMatchObject({ outcome: 'waiting', waitsOn: 'operator' });
    // Nothing new from the operator: no reassessment is spent, however long it waits.
    w.clock.now += 3 * DAY;
    expect(await w.worker.workObligations()).toBe(false);
    // The operator supplies it: the next tick reassesses with that message. That reassessment is interrupted: the
    // provider never returns and the process ends with the step durably started.
    await w.say('The invoice reference code is INV-42. Please continue.');
    expect(dueObligationWork(w.journal.view, w.clock.now)).toMatchObject([{ key: 'commitment:0' }]);
    hang = true;
    void w.worker.workObligations();
    while (w.journal.view.obligationWork['commitment:0']!.inFlight === undefined) await new Promise(resolve => setTimeout(resolve, 5));
    expect(seen).toHaveLength(3);
    w.journal.close();
    hang = false;
    // Replayed by a new process, the interrupted step is still owned work: scheduled, counted, never idle.
    const again = world(root, { answer, work, nextUpdate: 4 });
    again.clock.now = w.clock.now;
    expect(obligationSchedule(again.journal.view)).toMatchObject([{ key: 'commitment:0', inFlight: true }]);
    expect(loopHealth(again.journal.view, again.clock.now)).toMatchObject({ open: 1, workInFlight: 1, ownedWork: 1, unfinished: 1 });
    expect(loopHealth(again.journal.view, again.clock.now).state).not.toBe('idle');
    // Its recovery owner records it UNKNOWN and does not repeat it at once; the need and the operator's supply survive.
    expect(await again.worker.workObligations()).toBe(false);
    expect(again.journal.view.obligationWork['commitment:0']).toMatchObject({ outcome: 'uncertain', waitsOn: 'operator', note: NEED });
    expect(loopHealth(again.journal.view, again.clock.now)).toMatchObject({ open: 1, workInFlight: 0, ownedWork: 1, dueWork: 0 });
    expect(again.work).toHaveLength(0);
    // On the revisit cadence a new bounded attempt sees the same need and the supply, and finishes the work.
    again.clock.now += LOOP_REVISIT_MS + 60_000;
    expect(await again.worker.workObligations()).toBe(true);
    expect(seen.at(-1)).toMatchObject({ waitingFor: { waitsOn: 'operator', need: NEED } });
    expect(seen.at(-1)!.operatorMessagesSince).toEqual(expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining('INV-42') })]));
    expect(again.journal.view.obligationWork['commitment:0']).toMatchObject({ outcome: 'report' });
    expect(again.journal.view.obligationWork['commitment:0']!.waitsOn).toBeUndefined();
    await again.say('Thanks, anything else?');
    expect(again.sent.at(-1)).toContain('Invoice INV-42 is for 120 dollars');
    expect(again.journal.view.closed.has(0)).toBe(true);
    expect(loopHealth(again.journal.view, again.clock.now)).toMatchObject({ open: 0, ownedWork: 0, waitingWork: [] });
    again.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('starts scheduled work only inside the stop, allowance and capacity fences, and never repeats an interrupted start (Rules 55, 68)', async () => {
  const root = origin();
  try {
    let stopped = false;
    const w = world(root, { maxCalls: 5, stopped: () => stopped, answer: () => ({ reply: LATER, openLoops: [{ kind: 'deferral', quote: LATER, waitsOn: 'nothing' }] }),
      work: () => { throw Error('provider lost mid-call'); } });
    await w.say(INVOICE);
    w.clock.now += LOOP_REVISIT_MS + 60_000;
    // Stop latched: no start.
    stopped = true;
    await expect(w.worker.workObligations()).rejects.toThrow('preview stopped');
    expect(w.work).toHaveLength(0);
    stopped = false;
    // A call whose outcome is lost is UNKNOWN: recorded once, not repeated in that slot.
    expect(await w.worker.workObligations()).toBe(true);
    expect(w.journal.view.obligationWork['commitment:0']).toMatchObject({ attempts: 1, outcome: 'uncertain' });
    expect(await w.worker.workObligations()).toBe(false);
    expect(dueObligationWork(w.journal.view, w.clock.now)).toEqual([]);
    // A start left without a result by a crash is closed as uncertain by the next process, never re-run.
    w.clock.now += LOOP_REVISIT_MS + 60_000;
    const slot = dueObligationWork(w.journal.view, w.clock.now)[0]!.slot;
    w.journal.append({ kind: 'obligation-start', obligation: 'commitment:0', slot, at: w.clock.now });
    w.journal.close();
    const again = world(root, { maxCalls: 5, work: () => ({ outcome: 'continue', note: 'Checked the ledger; one line remains.' }) });
    again.clock.now = w.clock.now;
    expect(await again.worker.workObligations()).toBe(false);
    expect(again.journal.view.obligationWork['commitment:0']).toMatchObject({ attempts: 2, outcome: 'uncertain' });
    expect(again.work).toHaveLength(0);
    // Measured capacity: at three quarters of the call allowance scheduled work yields to replies, visibly.
    again.clock.now += LOOP_REVISIT_MS + 60_000;
    expect(again.journal.view.calls).toBe(3);
    expect(await again.worker.workObligations()).toBe(false);
    expect(loopHealth(again.journal.view, again.clock.now)).toMatchObject({ dueWork: 1, inhibition: 'model-call capacity reserved for replies' });
    again.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const REASSESSMENT = { avenues: [{ avenue: 'booking tool', disposition: 'outside-standing', evidence: 'externalTools' },
  { avenue: 'email the clinic', disposition: 'outside-standing', evidence: 'sends' }], constraint: 'no-tools',
reason: 'Rechecked: this runner still has no browser or accounts, and it can only reply to you.' };
it('rechecks a settled blocker through the scheduled owner when due, renews it only with a retained reassessment, and delivers a cleared wall (Rules 20, 21, 99, 103)', async () => {
  const root = origin();
  let outcome: Answer = { outcome: 'still-blocked', recheck: day(T0 + 61 * DAY) };
  try {
    const w = world(root, { answer: question => question.startsWith('Can you book') ? { reply: CLAIM, blocker: blocker() } : 'Noted.',
      work: () => outcome });
    await w.say('Can you book the dentist appointment online?');
    expect(openBlockers(w.journal.view)).toHaveLength(1);
    w.clock.now += 29 * DAY;
    expect(await w.worker.workObligations()).toBe(false);
    w.clock.now += 2 * DAY;
    expect(loopHealth(w.journal.view, w.clock.now)).toMatchObject({ overdueRechecks: 1, dueWork: 1 });
    // A new date alone is not a reassessment: the step is a recorded failure and the wall is not renewed.
    const recheckAt = w.journal.view.blockers[0]!.recheckAt;
    expect(await w.worker.workObligations()).toBe(true);
    expect(w.journal.view.obligationWork['blocker:0']).toMatchObject({ outcome: 'failed' });
    expect(w.journal.view.blockers[0]).toMatchObject({ recheckAt, rechecks: [] });
    expect(loopHealth(w.journal.view, w.clock.now).overdueRechecks).toBe(1);
    // An asserted attempt in the reassessment is refused the same way.
    outcome = { outcome: 'still-blocked', recheck: day(T0 + 61 * DAY), ...REASSESSMENT,
      avenues: [{ avenue: 'clinic website', disposition: 'tried', evidence: 'externalTools' }] };
    w.clock.now += LOOP_REVISIT_MS + 60_000;
    expect(await w.worker.workObligations()).toBe(true);
    expect(w.journal.view.blockers[0]!.rechecks).toEqual([]);
    // An evidenced reassessment renews it and is retained beside the recheck.
    outcome = { outcome: 'still-blocked', recheck: day(T0 + 61 * DAY), ...REASSESSMENT };
    w.clock.now += LOOP_REVISIT_MS + 60_000;
    expect(await w.worker.workObligations()).toBe(true);
    expect(w.journal.view.blockers[0]).toMatchObject({ avenues: REASSESSMENT.avenues, constraint: 'no-tools',
      rechecks: [{ outcome: 'still-blocked', assessment: REASSESSMENT }] });
    expect(w.journal.view.blockers[0]!.recheckAt).toBe(Date.parse(`${day(T0 + 61 * DAY)}T09:00:00Z`));
    expect(loopHealth(w.journal.view, w.clock.now)).toMatchObject({ overdueRechecks: 0, dueWork: 0 });
    outcome = { outcome: 'cleared', report: 'The clinic now takes bookings by email, which I can draft for you.' };
    w.clock.now = w.journal.view.blockers[0]!.recheckAt + 60_000;
    expect(await w.worker.workObligations()).toBe(true);
    expect(openBlockers(w.journal.view)).toEqual([]);
    await w.say('Anything new?');
    expect(w.sent.at(-1)).toContain('The clinic now takes bookings by email');
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(0);
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    expect(reopened.view.blockers[0]!.rechecks).toMatchObject([{ outcome: 'still-blocked', assessment: REASSESSMENT }, { outcome: 'cleared' }]);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('never releases a deferral the runner cannot track on a text-only pass (Rule 6)', async () => {
  const untracked = (verdict: 'pass' | 'violation') => ({ review: { verdict: (context: Record<string, unknown>) =>
    ((context.declaredObligations as { loops: unknown[] }).loops.length ? 'pass' : verdict) as 'pass' | 'violation',
  jev: (text: string) => (text.includes('later today') ? { defers_work: 0.9 } : {}) } });
  for (const [label, openLoops, sendsDeferral, tracked] of [
    ['unmatched declaration', [{ kind: 'deferral', quote: 'A clause that was never in this reply.', waitsOn: 'nothing' }], false, 0],
    ['no declaration', undefined, false, 0],
    ['tracked declaration', [{ kind: 'deferral', quote: LATER, waitsOn: 'nothing' }], true, 1],
  ] as const) {
    const root = origin();
    try {
      // cint-L2 merge: the live repair's longer system prompt plus the review headroom no longer fit 8000 bytes here.
      const w = world(root, { maxBytes: 8400, ...untracked('violation'), answer: () => ({ reply: LATER, ...(openLoops ? { openLoops } : {}) }) });
      await w.say(INVOICE);
      // The contextual reviewer always judged it, with what the runner admitted and refused.
      expect(w.reviews, label).toHaveLength(1);
      expect((w.reviews[0]!.declaredObligations as { rejected?: unknown }).rejected, label)
        .toEqual(label === 'unmatched declaration' ? { loops: 1 } : undefined);
      expect(w.sent.some(text => text.includes(LATER)), label).toBe(sendsDeferral);
      if (!sendsDeferral) expect(w.sent.at(-1), label).toContain(HOLDING_REPLY.replace(/^PREVIEW — /u, ''));
      // The sent reply and its durable commitment agree.
      expect(w.journal.view.commitments.filter(note => note.loop), label).toHaveLength(tracked);
      if (label === 'unmatched declaration') expect(loopStatusLines(w.journal.view, w.clock.now).join('\n')).toContain('Declared obligations I could not record: 1');
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

// OR1 (ruling 2 section C; Rules 4, 6, 41, 57, 58, 86, 108): a candidate held by the obligation floor gets the same one
// bounded correction as an advisory objection. The agent answers the objection; only a revalidated correction leaves.
const DONE = 'I checked the invoice question: the March invoice was paid on the 4th, so nothing is owed.';
it('gives a held deferral one bounded correction: a revalidated correction is sent, anything else stays held (Rules 4, 6, 86)', async () => {
  for (const [label, correction, outcome] of [
    ['correction clears the floor', { state: 'complete', text: DONE, dispositions: [{ objection: 'defers_work', decision: 'accept', reason: 'I can do it now.' }] }, 'sent'],
    ['correction still defers', { state: 'complete', text: `${LATER} Promise.`, dispositions: [{ objection: 'defers_work', decision: 'reject', reason: 'It needs a later look.' }] }, 'held'],
    ['agent keeps the draft unchanged', { state: 'complete', text: LATER, dispositions: [{ objection: 'defers_work', decision: 'reject', reason: 'The deferral is fine.' }] }, 'held'],
    ['response unavailable', undefined, 'held'],
  ] as const) {
    const root = origin();
    try {
      const revisions: { text: string; objections?: string[] }[] = [];
      const w = world(root, { maxBytes: 8400, answer: () => ({ reply: LATER }), review: {
        jev: text => (text.includes('later today') ? { defers_work: 0.9 } : {}),
        verdict: context => (String(context.candidateReply).includes('later today') ? 'violation' : 'pass'),
        revise: async input => { revisions.push(input); if (!correction) throw Error('reviser unavailable');
          return { ...correction, dispositions: [...correction.dispositions] }; } } });
      await w.say(INVOICE);
      const turn = w.journal.view.order[0]!;
      expect(revisions, label).toHaveLength(1);
      expect(revisions[0]!.objections, label).toEqual(['defers_work']);
      // An identical draft is the agent's answer, not a new candidate: no second review of the same text.
      expect(w.reviews, label).toHaveLength(label === 'agent keeps the draft unchanged' || !correction ? 1 : 2);
      if (outcome === 'sent') {
        expect(w.sent, label).toEqual([`PREVIEW — ${DONE}`]);
        expect(turn.release, label).toMatchObject({ review: 'violation', objections: ['defers_work'], revised: true,
          dispositions: [{ objection: 'defers_work', decision: 'accept', reason: 'I can do it now.' }] });
        expect(turn.heldReview, label).toBeUndefined();
      } else {
        expect(w.sent, label).toHaveLength(1);
        expect(w.sent[0], label).toContain(HOLDING_REPLY.replace(/^PREVIEW — /u, ''));
        expect(w.sent.join('\n'), label).not.toContain('later today');
        expect(turn.release, label).toBeUndefined();
        // The agent's answer is recorded as given; an unavailable response is no decision, never a rejection.
        expect(turn.heldReview, label).toEqual({ objections: ['defers_work'],
          dispositions: correction ? correction.dispositions : [{ objection: 'defers_work', decision: 'no-decision' }] });
      }
      expect(w.journal.view.commitments.filter(note => note.loop), label).toHaveLength(0);
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('sends a final cannot-do claim only with its admitted investigation, judged by the contextual reviewer (Rules 20, 21, 23, 103)', async () => {
  const reviewer = { verdict: (context: Record<string, unknown>) =>
    ((context.declaredObligations as { blocker: unknown }).blocker ? 'pass' : 'violation') as 'pass' | 'violation',
  jev: (text: string) => (text.includes('can’t book') ? { unrecorded_blocker: 0.92 } : {}) };
  for (const [label, proposal, sends] of [
    ['admitted investigation', blocker(), true],
    ['empty avenue set', blocker({ avenues: [] }), false],
    ['unsupported attempted avenue', blocker({ avenues: [{ avenue: 'clinic website', disposition: 'tried', evidence: 'externalTools' }] }), false],
    ['no investigation declared', undefined, false],
  ] as const) {
    const root = origin();
    try {
      // cint-L2 merge: the live repair's longer system prompt plus the review headroom no longer fit 8000 bytes here.
      const w = world(root, { maxBytes: 8400, review: reviewer, answer: () => ({ reply: CLAIM, ...(proposal ? { blocker: proposal } : {}) }) });
      await w.say('Can you book the dentist appointment online?');
      expect(w.reviews, label).toHaveLength(1);
      const declared = w.reviews[0]!.declaredObligations as { blocker: unknown; capabilities: { externalTools: string } };
      expect(declared.capabilities.externalTools).toBe('none');
      expect(w.sent.some(text => text.includes(CLAIM)), label).toBe(sends);
      expect(openBlockers(w.journal.view), label).toHaveLength(sends ? 1 : 0);
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('keeps an older directive in the complete packet after compaction, and refuses one past the room it has (Rule 93)', async () => {
  const root = origin();
  try {
    const label = (i: number) => `For project ${String.fromCharCode(65 + i)}, always label every report ${String.fromCharCode(65 + i)}${'a'.repeat(360)}.`;
    const w = world(root, { maxBytes: 32000, answer: question => /^For project/u.test(question)
      ? { reply: 'Standing instruction recorded.', directives: [{ quote: question }] } : 'Noted.' });
    for (let i = 0; i < 20; i++) { w.clock.now += 60_000; await w.say(label(i)); }
    expect(openDirectives(w.journal.view)).toHaveLength(20);
    for (let i = 0; i < 20; i++) { w.clock.now += 60_000; await w.say(filler(i)); }
    await w.worker.summarizeIfNeeded(true);
    expect(w.journal.view.summaries.length).toBeGreaterThan(0);
    const probe = w.worker.probe('Write the status report for project A.');
    if ('reason' in probe) throw Error(probe.reason);
    const packet = JSON.parse(probe.context) as { directives: { id: number; quote: string }[]; moreDirectives?: number };
    expect(packet.directives.map(item => item.id)).toEqual([...Array(20).keys()]);
    expect(packet.directives[0]!.quote).toBe(label(0));
    expect(packet.moreDirectives).toBeUndefined();
    // Past half the context bound a new directive is refused aloud, never admitted to be dropped later.
    const small = origin();
    try {
      const s = world(small, { maxBytes: 8000, answer: question => /^For project/u.test(question)
        ? { reply: 'Standing instruction recorded.', directives: [{ quote: question }] } : 'Noted.' });
      for (let i = 0; i < 12; i++) { s.clock.now += 60_000; await s.say(label(i)); }
      const admitted = openDirectives(s.journal.view).length;
      expect(admitted).toBeGreaterThan(0);
      expect(admitted).toBeLessThan(12);
      expect(openDirectives(s.journal.view).reduce((total, item) => total + Buffer.byteLength(JSON.stringify(item.note.quote)) + 120, 0))
        .toBeLessThanOrEqual(8000 * DIRECTIVE_SHARE);
      expect(s.journal.view.order.at(-1)!.intent).toContain('I have not saved that standing instruction');
      s.journal.close();
    } finally { rmSync(small, { recursive: true, force: true }); }
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

it('redacts every declared field before the reviewer context reaches a provider (secret floor)', () => {
  const sentinel = 'password=syntheticReviewSecret123';
  expect(redact(sentinel).count).toBeGreaterThan(0);
  const prompt = JSON.stringify({ messages: [{ role: 'user', content: 'Can you book it?' },
    { role: 'context', content: JSON.stringify({ packet: { audience: { surface: 'telegram-private-chat' }, history: [] } }) }] });
  const declared = { loops: [], blocker: { ...blocker(), avenues: [{ avenue: 'booking site', disposition: 'outside-standing', evidence: `site said ${sentinel}` }] } };
  const context = replyReviewContext(prompt, CLAIM, ['claims_blocked'], declared);
  expect(context).not.toContain(sentinel);
  expect(context).toContain('booking site');
  const prepared = prepareJournalEnvelope({ question: 'Judge the reply.', context, id: 'review' }, 'claude-sonnet-5', 'grant:preview', T0, 409600);
  expect(prepared).not.toContain(sentinel);
});

it('folds every recorded poll attempt into one episode, so a launch killed before its exit record loses nothing (Rule 55)', () => {
  const root = origin();
  try {
    const path = join(root, 'runs.jsonl');
    appendRun(path, { v: 1, launch: 1, pid: 1 });
    for (let i = 0; i < 5; i++) appendRun(path, { v: 1, launch: 1, poll: 'conflicted', at: 2 + i });
    appendRun(path, { v: 1, launch: 1, exit: 9, reason: 'Telegram polling conflict after 5 attempts', unfinished: 0, revival: 'none' });
    appendRun(path, { v: 1, launch: 10, pid: 2 });
    appendRun(path, { v: 1, launch: 10, poll: 'conflicted', at: 11 }); // killed before any exit record
    appendRun(path, { v: 1, launch: 12, pid: 3 });
    const log = readRuns(path);
    expect(log.pollPressure).toEqual({ failed: 6, conflicted: 6 });
    expect(log.unreadable).toBe(0);
    expect(log.launches.map(run => run.exit)).toEqual([9, undefined, undefined]);
    appendRun(path, { v: 1, launch: 12, poll: 'restored', at: 13 });
    appendRun(path, { v: 1, launch: 12, poll: 'failed', at: 14 });
    expect(readRuns(path).pollPressure).toEqual({ failed: 1, conflicted: 0 });
    // A log that exists but cannot be read is not an empty history: its pressure is unknown, never zero.
    expect(readRuns(join(root, 'absent.jsonl'))).toEqual({ launches: [], unreadable: 0, pollPressure: { failed: 0, conflicted: 0 } });
    chmodSync(path, 0o200);
    try { expect(readRuns(path)).toMatchObject({ readFailed: true }); } finally { chmodSync(path, 0o600); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('revives a queued runner, stops on inhibited or none, and bounds relaunches after crashes (Rules 55, 68)', async () => {
  const root = origin();
  try {
    const agent = join(process.cwd(), 'tests/preview/journal-agent.mjs');
    const config = { journal: true, root, agent: [process.execPath, agent, 'run', '--root', root], maxRestarts: 3, backoffMs: 1, maxBackoffMs: 4 };
    const path = join(root, 'runs.jsonl');
    let launch = 0;
    const script: ((at: number) => { code: number | null; signal: string | null })[] = [];
    const waits: number[] = [];
    const run = (revival?: 'queued' | 'inhibited' | 'none', code = 0) => (at: number) => {
      appendRun(path, { v: 1, launch: at, pid: at });
      if (revival) appendRun(path, { v: 1, launch: at, exit: at + 1, reason: 'cycle limit reached', unfinished: 1, revival });
      return { code, signal: null };
    };
    const supervise = () => superviseJournal(config, { launch: async () => script[launch]!(++launch * 10),
      wait: async (_root: string, ms: number) => { waits.push(ms); } });
    // Queued work after a clean exit is relaunched; an inhibited exit ends supervision.
    script.push(run('queued'), run('queued'), run('inhibited'));
    expect(await supervise()).toBe(0);
    expect(launch).toBe(3);
    expect(lastJournalRun(root)).toEqual({ launch: 30, revival: 'inhibited' });
    // Crashes (no exit record) are relaunched with backoff, at most maxRestarts times in a row.
    launch = 0; script.length = 0; waits.length = 0;
    for (let i = 0; i < 10; i++) script.push(run(undefined, 1));
    expect(await supervise()).toBe(0);
    expect(launch).toBe(4);
    expect(waits).toEqual([1, 2, 4]);
    await expect(() => superviseJournal({ ...config, agent: [process.execPath, agent, 'run', '--root', '/elsewhere'] })).rejects.toThrow('invalid journal launch configuration');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
