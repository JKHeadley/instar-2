// @ts-expect-error The runner side stays plain JavaScript.
import { admitEffect, DEFAULT_EFFECT_POLICY, refusedEffectNotices } from './effect-doorway.mjs';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
// Build 4: every accepted obligation stays owned until deliberately settled (Rules 6, 8, 20-23, 46, 55, 64, 68, 83, 93, 99, 103).
import { expect, it } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, openBlockers, openDirectives, declaredObligations, dueObligationWork, obligationSchedule,
  LOOP_REVISIT_MS, BLOCKER_RECHECK_MAX_MS, DIRECTIVE_SHARE, OBLIGATION_WORK_QUESTION, OBLIGATION_WORK_QUESTION_TOOLS, previewCapabilities,
  TOOL_ATTEMPTS_MEANING, TOOL_ATTEMPTS_PARTIAL_MEANING, TOOL_ATTEMPTS_REVIEWED, governingConstraints, OBLIGATION_DECISION,
  OBLIGATION_FLOOR_PACKET_BYTES, OBLIGATION_DECISION_TOOLS } from './journal-test-worker.js';
// @ts-expect-error The runner side stays plain JavaScript.
import { runToolTurn, toolPacketFits, toolTurnFits } from './tool-turn.mjs';
import { SUBSCRIPTION_TOOL_LIMITS } from '../../src/assembly/production-provider.js';
// @ts-expect-error Plain JavaScript.
import { toolTrace } from './tool-admission.mjs';
import { loopHealth, loopStatusLines, BACKLOG_AGE_LIMIT_MS } from './obligations.js';
import { statusReply } from './status-command.js';
import { DECLARED_OBLIGATIONS_GUIDE, HOLDING_REPLY, REPLY_RULES, replySegments, replyReviewContext, replyReviewQuestion, type ObjectionDisposition, type ReplyRule } from './reply-check.js';
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
    dispositions?: ObjectionDisposition[]; blocker?: unknown }> };
function world(root: string, options: { maxBytes?: number; maxCalls?: number; answer?: (question: string, context: string) => Answer;
  waitsOn?: boolean; work?: (context: Record<string, unknown>) => Answer | Promise<Answer>; review?: Review; stopped?: () => boolean;
  receipt?: (text: string) => boolean; nextUpdate?: number; toolRoute?: (id: string) => boolean } = {}) {
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis(options.maxBytes, options.maxCalls));
  const clock = { now: T0 };
  const contexts = new Map<string, string>(), reviews: Record<string, unknown>[] = [], work: string[] = [], sent: string[] = [];
  const workQuestions: string[] = [];
  const review = options.review;
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: options.stopped ?? (() => false), timeZone: 'UTC',
    prepareModel: input => input.context,
    replyNotices: (turn) => refusedEffectNotices(journal.view.effectDoorway?.recent ?? [], turn),
    ...(options.toolRoute ? { toolRoute: options.toolRoute } : {}),
    ...(review ? { replyCheck: { elapsedMs: () => 0,
      jev: async (text: string, questions?: Record<string, unknown>) => ({ latencyMs: 0, value: { model: 'jev-1.13.0',
        answers: Object.fromEntries(Object.keys(questions ?? REPLY_RULES).map(rule => [rule,
          { type: 'noul', noul: review.jev?.(text)[rule as ReplyRule] ?? 0.01 }])) } }),
      escalate: async (text: string, id: string, originalPrompt?: string, rules?: readonly ReplyRule[]) => {
        // The same context the live runner builds: the answer's packet plus its declared record. This world's
        // prepared prompt is the bare packet, so it is wrapped the way the live envelope carries it.
        const envelope = JSON.stringify({ messages: [{ role: 'user', content: journal.view.turns.get(id)!.text },
          { role: 'context', content: JSON.stringify({ packet: JSON.parse(originalPrompt!) }) }] });
        const context = JSON.parse(replyReviewContext(envelope, text, rules, declaredObligations(journal.view, id, clock.now))) as Record<string, unknown>;
        reviews.push(context);
        const verdict = review.verdict?.(context) ?? 'pass';
        const named: ReplyRule[] = verdict === 'pass' ? [] : [rules?.includes('defers_work') ? 'defers_work' : rules?.[0] ?? 'defers_work'];
        // As live: a violation names its rule AND quotes the claim it objects to (the review question requires
        // it, and the claim-scoped floor reads that quote). The first sentence is what the live reviewer quoted.
        const claim = (replySegments(text)[0]?.text ?? text).replace(/^PREVIEW — /u, '');
        return { verdict, ruleIds: named, confidence: null, latencyMs: 0,
          findings: named.map(rule => ({ rule, verdict: 'violation' as const,
            reason: `The reply states "${claim}" and declaredObligations records no ${rule === 'defers_work' ? 'loop' : 'blocker'} for it.` })) };
      }, ...(review.revise ? { revise: review.revise } : {}) } } : {}),
    model: async input => {
      if (input.id.startsWith('obligation:')) {
        work.push(input.id); workQuestions.push(input.question);
        const answer = await options.work?.(JSON.parse(input.context) as Record<string, unknown>) ?? { outcome: 'continue', note: 'Still working.' };
        return typeof answer === 'string' ? answer : JSON.stringify(answer);
      }
      if (input.id.startsWith('summary:')) {
        const packet = JSON.parse(input.context) as { history: { user: string }[] };
        const commitments = packet.history.filter(turn => /remember/iu.test(turn.user))
          .map(turn => ({ in: 'message', quote: turn.user, ...(options.waitsOn === false ? {} : { waitsOn: 'nothing' }) }));
        return JSON.stringify({ summary: 'Earlier turns covered a locker code and plans.', people: [], commitments, closed: [] });
      }
      // A turn whose own tool call the effect doorway refused, as the live tool turn records it (Part Twelve §3).
      if (input.question.startsWith(DOORWAY)) {
        const verdict = admitEffect({ effect: 'tool:unsandboxed' }, DEFAULT_EFFECT_POLICY, SINGLE_MACHINE_PROFILE.operations);
        journal.append({ kind: 'tool-turn', phase: 'reserved', id: input.id, attempt: 0, calls: 1, at: clock.now });
        journal.append({ kind: 'tool-turn', phase: 'trace', id: input.id, attempt: 0, consistent: true, workspaceBytes: 0, at: clock.now,
          calls: [{ n: 1, tool: 'Bash', input: '{"dangerouslyDisableSandbox":true}', decision: 'deny', reason: verdict.reason, kind: 'unsandboxed',
            doorway: { effect: verdict.effect, tests: verdict.tests, disposition: verdict.disposition, admits: verdict.admits }, result: null }] });
      }
      contexts.set(input.question, input.context);
      const answer = options.answer?.(input.question, input.context) ?? 'Noted.';
      return typeof answer === 'string' ? answer : JSON.stringify({ memory: [], ...answer });
    },
    send: async input => { if (options.receipt && !options.receipt(input.text)) return null; sent.push(input.text); return sent.length; },
    checkOutbound: () => {} });
  let next = options.nextUpdate ?? 1;
  /** One operator message dated at the current clock, answered and summarized. `queued` runs between intake and drain. */
  const say = async (text: string, queued?: () => void) => {
    const id = next++;
    worker.intake([{ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    queued?.();
    await worker.drain(); await worker.summarizeIfNeeded();
  };
  return { journal, worker, clock, say, contexts, path, reviews, work, sent, workQuestions };
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
    // w3-floorduty: at this limit the obligation guide is under pressure, and it now yields to its floor form rather
    // than vanishing; the limit carries those bytes so the loop item keeps the room it had (Rules 3, 8, 93).
    const w = world(root, { maxBytes: 8000 + OBLIGATION_FLOOR_PACKET_BYTES });
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
  // Plan #111: the settled records count, and the verdict word carries the conclusion. Live L9 (update 969389755) the
  // reviewer wrote "unrecorded_blocker: VIOLATION | none — declaredObligations.blocker matches this exact claim".
  expect(REPLY_RULES.unrecorded_blocker).toContain('packet.declaredObligations.settled');
  // w3-selfdesc (plan #370) shortened both clauses to the wording its recorded real reviews ran on; the meaning holds.
  expect(DECLARED_OBLIGATIONS_GUIDE).toMatch(/restating a settled limit, or [^.;]+, needs no new record/u);
  expect(DECLARED_OBLIGATIONS_GUIDE).toContain('VIOLATION only when one such final claim is not recorded this way, with a reason quoting that claim');
  for (const rules of [[], ['unrecorded_blocker'], ['credential']] as ReplyRule[][])
    expect(replyReviewQuestion(rules)).toContain('A reason that finds no breach belongs on a PASS line.');
});


const LATER = 'I’ll look into the invoice question later today.';
const INVOICE = 'Can you check the invoice question?';
const DOORWAY = 'Run echo outside-sandbox without the sandbox.';
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
        // Plan #215: the whole answer WAS the named deferral, so nothing survived the claim-scoped removal and the
        // notice stands in for no surviving content — recorded, so this case is countable rather than silent.
        expect(turn.heldReview, label).toEqual({ objections: ['defers_work'],
          dispositions: correction ? correction.dispositions : [{ objection: 'defers_work', decision: 'no-decision' }],
          withheld: { rules: ['defers_work'], removed: [LATER], unlocated: [] } });
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

// Plan #104 (live, twice): "Can you pay my water bill on the website?" drew a plain, true can't-do answer that declared
// no investigation record, and the reply check held it behind the holding notice. The held correction now lets the
// agent keep the limit and declare its record; the runner admits it by the answer's own checks, the corrected
// candidate is re-reviewed with it, and the sent reply records the blocker. A record the runner refuses stays held.
it('sends a true can\'t-do answer once its correction declares the investigation, and records the blocker (plan #104; Rules 20, 21, 23, 86)', async () => {
  const reviewer = { verdict: (context: Record<string, unknown>) =>
    ((context.declaredObligations as { blocker: unknown }).blocker ? 'pass' : 'violation') as 'pass' | 'violation',
  jev: (text: string) => (text.includes('can’t book') ? { unrecorded_blocker: 0.92 } : {}) };
  const accept = [{ objection: 'unrecorded_blocker', decision: 'accept' as const, reason: 'The limit is real; I recorded why.' }];
  for (const [label, declared, sends] of [
    ['admitted investigation', blocker(), true],
    ['ungoverned boundary', blocker({ constraint: 'my-own-rule' }), false],
    ['claim not in the reply', blocker({ claim: 'I cannot do anything at all here.' }), false],
    ['no record declared', undefined, false],
  ] as const) {
    const root = origin();
    try {
      const revisions: { objections?: string[] }[] = [];
      const w = world(root, { maxBytes: 8400, answer: () => ({ reply: CLAIM }), review: { ...reviewer,
        revise: async input => { revisions.push(input);
          return { state: 'complete' as const, text: CLAIM, dispositions: accept, ...(declared ? { blocker: declared } : {}) }; } } });
      await w.say('Can you book the dentist appointment on the website for me?');
      const turn = w.journal.view.order[0]!;
      expect(revisions, label).toHaveLength(1);
      expect(revisions[0]!.objections, label).toEqual(['unrecorded_blocker']);
      expect(w.sent, label).toHaveLength(1);
      if (sends) {
        expect(w.sent[0], label).toBe(`PREVIEW — ${CLAIM}`);
        // The same words with a newly declared record are a new candidate: judged once more, with that record.
        expect(w.reviews, label).toHaveLength(2);
        expect((w.reviews[1]!.declaredObligations as { blocker: { claim: string } }).blocker.claim, label).toBe(CLAIM);
        expect(openBlockers(w.journal.view), label).toMatchObject([{ note: { claim: CLAIM, constraint: 'no-tools' } }]);
        expect(turn.release, label).toMatchObject({ review: 'violation', objections: ['unrecorded_blocker'], revised: true, dispositions: accept });
        expect(turn.heldReview, label).toBeUndefined();
      } else {
        expect(w.sent[0], label).toContain(HOLDING_REPLY.replace(/^PREVIEW — /u, ''));
        expect(turn.revision?.blocker, label).toBeUndefined();
        expect(openBlockers(w.journal.view), label).toEqual([]);
        // Plan #215: the claim was the whole answer, so the notice stands in for nothing surviving.
        expect(turn.heldReview, label).toEqual({ objections: ['unrecorded_blocker'], dispositions: accept,
          withheld: { rules: ['unrecorded_blocker'], removed: [CLAIM], unlocated: [] } });
      }
      w.journal.close();
      // Replay: the admitted record survives a reopen exactly as it was sent.
      const again = openPreviewJournal(w.path, key);
      expect(openBlockers(again.view).length, label).toBe(sends ? 1 : 0);
      again.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

// Plan #111 (live, L6 00:05 and L7 02:07, updates 969389707 and 969389730): a repeated "Can you <task> on the website
// for me?" drew the real model's true can't-do answer restating a limit it had already settled (open blocker 4, then 8),
// declaring no new record because the answer packet says never to renew one. The reviewer was shown only this reply's
// own record, judged the restatement unrecorded, and the reply was held behind the notice. The settled record is now
// part of what the reviewer judges against; a limit no open, current record covers is still held.
const DMV_ASK = 'Can you renew my car registration on the website for me?';
const DMV_CLAIM = 'I have no tools in this preview, so I can\'t browse or fill out forms on the DMV or state website.';
const DMV_FIRST = `I can't do that. ${DMV_CLAIM} You'd need to renew your car registration yourself on the relevant government website, by phone, or in person.`;
const DMV_AGAIN = 'No, I still can\'t — I have no tools in this preview, so I can\'t browse or fill out forms on the DMV or state website. You\'d need to renew your car registration yourself on the relevant government website, by phone, or in person.';
const LIBRARY_CLAIM = 'I have no tools in this preview, so I can\'t browse or fill out forms on the library website.';
it('judges a restated can\'t-do answer against the limit it already settled, and still holds one no current record covers (plan #111; Rules 20-23, 97, 99)', async () => {
  // Stands in for the reviewer reading the guide: a final claim is recorded when this reply's blocker, or one settled
  // entry, records the same limit (here: the same no-tools matter).
  const matter = (text: string) => ['DMV', 'library'].find(word => text.includes(word));
  const reviewer = { jev: (text: string) => (text.includes('can\'t browse') ? { unrecorded_blocker: 0.98 } : {}),
    verdict: (context: Record<string, unknown>) => {
      const declared = context.declaredObligations as { blocker: { claim: string; constraint: string } | null;
        settled?: { claim: string; constraint: string }[] };
      const records = [declared.blocker, ...(declared.settled ?? [])];
      return (records.some(record => record?.constraint === 'no-tools' && matter(record.claim) === matter(String(context.candidateReply)))
        ? 'pass' : 'violation') as 'pass' | 'violation';
    } };
  for (const [label, first, between, sends] of [
    ['restated settled limit', { reply: DMV_FIRST, claim: DMV_CLAIM }, 'none', true],
    ['settled limit on another matter', { reply: LIBRARY_CLAIM, claim: LIBRARY_CLAIM }, 'none', false],
    ['settled limit since cleared', { reply: DMV_FIRST, claim: DMV_CLAIM }, 'cleared', false],
    ['settled limit due for recheck', { reply: DMV_FIRST, claim: DMV_CLAIM }, 'due', false],
    // Rule 99: queued a minute before the recheck date; reviewed a minute before it (fresh) or a minute after (due).
    ['queued and reviewed before recheck', { reply: DMV_FIRST, claim: DMV_CLAIM }, 'queued-fresh', true],
    ['queued before recheck, reviewed after it', { reply: DMV_FIRST, claim: DMV_CLAIM }, 'queued-due', false],
  ] as const) {
    const root = origin();
    try {
      const w = world(root, { maxBytes: 16000, review: reviewer, answer: question => question === 'First'
        ? { reply: first.reply, blocker: blocker({ claim: first.claim, avenues: [{ avenue: 'browse the website', disposition: 'outside-standing',
          evidence: 'externalTools' }], outsideAction: 'Do it yourself on the website.' }) }
        : question === 'Bookings reopened, try again.' ? { reply: 'It is now possible.', blockerRechecks: [{ id: 0, outcome: 'cleared' }] }
          // The real model's second answer: the settled limit restated, no new record declared.
          : question === DMV_ASK ? DMV_AGAIN : 'Noted.' });
      await w.say('First');
      expect(openBlockers(w.journal.view), label).toHaveLength(1);
      if (between === 'cleared') await w.say('Bookings reopened, try again.');
      if (between === 'due') w.clock.now += 31 * DAY;
      const due = w.journal.view.blockers[0]!.recheckAt;
      if (between === 'queued-fresh' || between === 'queued-due') w.clock.now = due - 60_000;
      const before = w.reviews.length;
      await w.say(DMV_ASK, () => { if (between === 'queued-due') w.clock.now = due + 60_000; });
      const turn = w.journal.view.order.find(item => item.text === DMV_ASK)!;
      expect(w.reviews.length, label).toBe(before + 1);
      expect(turn.answerBlocker, label).toBeUndefined();
      // Live 969389730: the writer relied on a settled record of a different action (looking up a bill, not paying it).
      if (between === 'none' || between === 'queued-fresh') expect(w.contexts.get(DMV_ASK), label).toContain('A settled blocker covers only its own claim');
      if (between.startsWith('queued')) expect(turn.at, label).toBeLessThan(due);
      if (sends) {
        expect(w.sent.at(-1), label).toBe(`PREVIEW — ${DMV_AGAIN}`);
        expect(turn.heldReview, label).toBeUndefined();
      } else {
        // Plan #215: an unevidenced restatement no longer silences the whole answer. The sentence carrying the
        // claim the review named is removed and the rest — what the operator can actually do — is sent.
        expect(w.sent.at(-1), label).not.toContain(HOLDING_REPLY.replace(/^PREVIEW — /u, ''));
        expect(w.sent.at(-1), label).not.toContain('I still can\'t');
        expect(w.sent.at(-1), label).toContain('You\'d need to renew your car registration yourself');
        expect(turn.heldReview, label).toBeUndefined();
        expect(turn.release?.objections, label).toEqual(['unrecorded_blocker']);
        expect(turn.release?.withheld?.rules, label).toEqual(['unrecorded_blocker']);
        expect(turn.release?.withheld?.removed, label).toEqual([DMV_AGAIN.split('. ')[0] + '.']);
        expect(turn.release?.withheld?.unlocated, label).toEqual([]);
      }
      const settled = (w.reviews.at(-1)!.declaredObligations as { settled: { claim: string }[] }).settled;
      expect(settled.map(item => item.claim), label).toEqual(between === 'none' || between === 'queued-fresh' ? [first.claim] : []);
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

it('tells scheduled work and the reply review what the call actually had: no tools on the text-only route, the recorded tool calls on the tool route (Part Thirteen §9; review round 1, finding 5)', async () => {
  for (const tools of [false, true]) {
    const root = origin();
    try {
      const contexts: Record<string, unknown>[] = [];
      const w = world(root, { toolRoute: id => tools && id.startsWith('obligation:'),
        answer: question => question === INVOICE ? { reply: LATER, openLoops: [{ kind: 'deferral', quote: LATER, waitsOn: 'nothing' }] } : 'Fine.',
        work: context => { contexts.push(context); return { outcome: 'report', report: 'The invoice is for 120 dollars.' }; } });
      await w.say(INVOICE);
      w.clock.now += LOOP_REVISIT_MS + 60_000;
      expect(await w.worker.workObligations()).toBe(true);
      expect(w.workQuestions).toEqual([tools ? OBLIGATION_WORK_QUESTION_TOOLS : OBLIGATION_WORK_QUESTION]);
      expect(contexts[0]!.capabilities).toEqual(previewCapabilities(tools));
      expect((contexts[0]!.governingConstraints as Record<string, string>)['no-tools'])
        .toBe(tools ? 'only listed tools; no accounts' : 'no external tools or accounts');
      if (tools) {
        expect(w.workQuestions[0]).not.toContain('you have no external tools');
        expect(w.workQuestions[0]).not.toContain('You have attempted nothing outside this step');
      } else expect(w.workQuestions[0]).toContain('you have no external tools');
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  // The review of a reply whose answer ran on the tool route: the REAL calls of the live task turn (Write, Read, Bash wc -c,
  // fixtures/tool-turn/live-2026-10-03/task.json, recorded under the pinned harness) are journaled as that turn's trace,
  // and the review context carries them beside the tool capability read. The neighbour turn answered text-only (no trace,
  // or a tool turn refused to the text-only route) keeps the no-tools read and carries no attempts.
  const root = origin();
  try {
    const w = world(root);
    await w.say('Make a note and count its bytes.'); await w.say('And the tomatoes?'); await w.say('One more.');
    const [toolTurn, plainTurn, refusedTurn] = w.journal.view.order.map(turn => turn.id);
    const recorded = JSON.parse(readFileSync(join(__dirname, 'fixtures/tool-turn/live-2026-10-03/task.json'), 'utf8')) as { admission: string; answer: string };
    const trace = toolTrace(recorded.admission.trim().split('\n'));
    expect(trace).toMatchObject({ consistent: true, admitted: 3 });
    w.journal.append({ kind: 'tool-turn', phase: 'reserved', id: toolTurn!, attempt: 0, calls: 7, at: w.clock.now });
    w.journal.append({ kind: 'tool-turn', phase: 'trace', id: toolTurn!, attempt: 0, consistent: true, workspaceBytes: 11, at: w.clock.now,
      calls: trace.calls });
    w.journal.append({ kind: 'tool-turn', phase: 'refused', id: refusedTurn!, reason: 'call cap', at: w.clock.now });
    const declared = declaredObligations(w.journal.view, toolTurn!, w.clock.now);
    expect(declared.capabilities).toEqual(previewCapabilities(true));
    const attempts = declared.toolAttempts!;
    expect(attempts.meaning).toBe(TOOL_ATTEMPTS_MEANING);
    expect(attempts.calls.map(call => [call.n, call.tool, call.decision])).toEqual([[1, 'Write', 'allow'], [2, 'Read', 'allow'], [3, 'Bash', 'allow']]);
    // The recorded wc -c result (11 bytes) is what the reviewer can check the reply's "11" against.
    expect(attempts.calls[2]!.result).toMatch(/\b11\b/u);
    for (const id of [plainTurn!, refusedTurn!]) {
      const none = declaredObligations(w.journal.view, id, w.clock.now);
      expect(none.capabilities).toEqual(previewCapabilities(false));
      expect(none.toolAttempts).toBeUndefined();
    }
    // Through the real review-context builder: the attempts arrive redacted and intact.
    const envelope = JSON.stringify({ messages: [{ role: 'user', content: 'Make a note and count its bytes.' },
      { role: 'context', content: JSON.stringify({ packet: { audience: 'operator', history: [] } }) }] });
    const context = JSON.parse(replyReviewContext(envelope, recorded.answer, [], declared)) as
      { declaredObligations: { capabilities: { externalTools: string }; toolAttempts: { calls: { result: string | null }[] } } };
    expect(context.declaredObligations.capabilities.externalTools).toBe('as listed');
    expect(context.declaredObligations.toolAttempts.calls[2]!.result).toMatch(/\b11\b/u);
    // Replay keeps the same read.
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    expect(declaredObligations(reopened.view, toolTurn!, w.clock.now).toolAttempts?.calls).toHaveLength(3);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('names tools in the packet exactly when its dispatch, after the base call is reserved, runs them: answers and scheduled work at seven and eight remaining calls (review round 2, finding 1)', async () => {
  const extra = SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1;
  type Seen = { packet: string; dispatch: boolean };
  const tools = (context: string | Record<string, unknown>) =>
    ((typeof context === 'string' ? JSON.parse(context) : context) as { capabilities: { externalTools: string } }).capabilities.externalTools;
  // Answers: the packet is prepared before `reserve`, the tool turn's own check runs after it.
  for (const remaining of [extra, extra + 1]) {
    const root = origin();
    try {
      const seen: Seen[] = [];
      const holder: { view?: Parameters<typeof toolTurnFits>[0] } = {};
      const w = world(root, { maxCalls: remaining, toolRoute: () => toolPacketFits(holder.view),
        answer: (_question, context) => { seen.push({ packet: tools(context), dispatch: toolTurnFits(holder.view) }); return 'Fine.'; } });
      holder.view = w.journal.view;
      expect(w.journal.view.calls).toBe(0);
      await w.say(INVOICE);
      const expected = remaining > extra;
      expect(seen).toEqual([{ packet: expected ? 'as listed' : 'none', dispatch: expected }]);
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  // Scheduled work: the packet is prepared before `obligation-start` counts its call. The calls an earlier answer used
  // are measured first, so the cap leaves exactly seven or eight at the moment the work's packet is prepared.
  const probe = origin();
  let used: number;
  try {
    const w = world(probe, { answer: question => question === INVOICE ? { reply: LATER, openLoops: [{ kind: 'deferral', quote: LATER, waitsOn: 'nothing' }] } : 'Fine.' });
    await w.say(INVOICE); used = w.journal.view.calls; w.journal.close();
  } finally { rmSync(probe, { recursive: true, force: true }); }
  for (const remaining of [extra, extra + 1]) {
    const root = origin();
    try {
      const seen: Seen[] = [];
      const holder: { view?: Parameters<typeof toolTurnFits>[0] } = {};
      const w = world(root, { maxCalls: used + remaining, toolRoute: id => id.startsWith('obligation:') && toolPacketFits(holder.view),
        answer: question => question === INVOICE ? { reply: LATER, openLoops: [{ kind: 'deferral', quote: LATER, waitsOn: 'nothing' }] } : 'Fine.',
        work: context => { seen.push({ packet: tools(context), dispatch: toolTurnFits(holder.view) }); return { outcome: 'continue', note: 'Still working.' }; } });
      holder.view = w.journal.view;
      await w.say(INVOICE);
      expect(w.journal.view.calls).toBe(used);
      w.clock.now += LOOP_REVISIT_MS + 60_000;
      expect(await w.worker.workObligations()).toBe(true);
      const expected = remaining > extra;
      expect(seen).toEqual([{ packet: expected ? 'as listed' : 'none', dispatch: expected }]);
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('re-reads the tool route for a format re-ask or timeout replacement after a tool turn, so its packet, the review and the revision read the route its call actually took (review rounds 3, 4)', async () => {
  // Through the real worker, the shipped envelope, the real tool turn and the contextual reviewer's input: the first call
  // runs with tools and returns a malformed Decision (or times out); the second call has room for tools at the larger
  // cap and not at the smaller, where it answers text-only. The packet the review and revision read is that second one.
  const timedOut = (JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/lostanswer-live-2026-10-02.json'), 'utf8')) as
    { lostFirstCall: { callOutcomes: Record<string, unknown>[] } }).lostFirstCall.callOutcomes[0]!;
  for (const mode of ['format-retry', 'answer-replace'] as const) for (const cap of [12, 18]) {
    const root = mkdtempSync(join(tmpdir(), 'selfdesc-retry-'));
    const now = 1790000000000;
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(23), {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
      configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: cap,
      maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
    const seen: { packet: string; actual: string }[] = [];
    const reviews: Record<string, any>[] = [];
    type Packet = { capabilities: object; governingConstraints: object; obligationDecision: string };
    const packetOf = (prompt: string) => (JSON.parse(JSON.parse(prompt).messages
      .find((m: { role: string }) => m.role === 'context').content) as { packet: Packet }).packet;
    try {
      const worker = createJournalWorker(journal, {
        now: () => now, stopped: () => false, timeZone: 'UTC',
        prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now, 32768),
        replyCheck: { elapsedMs: () => 0, jev: async () => { throw Error('offline: exercise the contextual review'); },
          escalate: async (text, id, originalPrompt, rules) => {
            reviews.push(JSON.parse(replyReviewContext(originalPrompt!, text, rules, declaredObligations(journal.view, id, now))));
            return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 };
          } },
        toolRoute: () => toolPacketFits(journal.view),
        model: async input => {
          let actual = '';
          const first = seen.length === 0;
          const result = await runToolTurn({ journal, root, id: input.id, prepared: input.prepared,
            promptLimit: 32768, deniedRoots: [root], operations: [], now: () => now, redactText: (s: string) => s,
            scratch: (turn: string) => { const vol = join(turn, 'vol'); mkdirSync(vol); return vol; }, detach: () => true,
            fallback: async () => { actual = 'none'; return { result: 'A short answer.' }; },
            invoke: async () => { actual = 'as listed'; return first && mode === 'format-retry' ? { state: 'complete', failureClass: 'malformed' } : 'A short answer.'; } });
          seen.push({ packet: (JSON.parse(input.context) as Packet & { capabilities: { externalTools: string } }).capabilities.externalTools, actual });
          if (first && mode === 'answer-replace') {
            const { id: _id, role, at: _at, ...outcome } = timedOut;
            journal.append({ kind: 'call-outcome', id: input.id, role, outcome, at: now } as never);
            return { state: 'uncertain' };
          }
          return result.result;
        }, send: async () => 1, checkOutbound: () => {} });
      worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
        date: Math.floor(now / 1000), text: 'What tools can you use now?' } }]);
      await worker.drain();
      const tools = cap === 18, final = tools ? 'as listed' : 'none';
      expect(seen).toEqual([{ packet: 'as listed', actual: 'as listed' }, { packet: final, actual: final }]);
      const id = journal.view.order[0]!.id;
      expect(declaredObligations(journal.view, id, now).capabilities.externalTools).toBe(final);
      // The contextual review reads the final attempt's packet: capabilities, constraints and instructions agree with
      // the declaration on both routes; no earlier-route entry survives beside it.
      expect(reviews).toHaveLength(1);
      expect(reviews[0]!.capabilities).toEqual(previewCapabilities(tools));
      expect(reviews[0]!.governingConstraints).toEqual(governingConstraints(tools));
      expect(reviews[0]!.obligationDecision).toBe(tools ? OBLIGATION_DECISION_TOOLS : OBLIGATION_DECISION);
      expect(reviews[0]!.declaredObligations.capabilities.externalTools).toBe(final);
      // Revision and inspect read the turn's prompt: the final attempt's packet, also after the journal reopens.
      expect(packetOf(journal.view.turns.get(id)!.prompt!).capabilities).toEqual(previewCapabilities(tools));
      journal.close();
      const reopened = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(23));
      expect(declaredObligations(reopened.view, id, now).capabilities.externalTools).toBe(final);
      expect(packetOf(reopened.view.turns.get(id)!.prompt!).capabilities).toEqual(previewCapabilities(tools));
      reopened.close();
    } finally { try { journal.close(); } catch { /* closed */ } rmSync(root, { recursive: true, force: true }); }
  }
});

it('keeps an earlier tool attempt\'s calls when a later attempt traces, so the review never reads a retry as the whole turn (cint-L39 review, must-fix 1)', async () => {
  // [first attempt calls, second attempt calls] -> shown, omitted. The reviewer's shape: three admitted calls, then a
  // format re-ask on tools that made none. Its neighbour overflows the bound across the two attempts.
  for (const [first, second] of [[3, 0], [6, 6]] as const) {
    const root = origin();
    try {
      const w = world(root);
      await w.say('Run the check and tell me what you tried.');
      const id = w.journal.view.order[0]!.id;
      const calls = (attempt: number, count: number) => Array.from({ length: count }, (_, i) => ({ n: i + 1, tool: 'Bash',
        input: `echo ${attempt}-${i + 1}`, decision: 'allow', reason: 'sandboxed', result: `R${attempt}-${i + 1}` }));
      for (const [attempt, count] of [[0, first], [1, second]] as const) {
        w.journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt, calls: 1, at: w.clock.now });
        w.journal.append({ kind: 'tool-turn', phase: 'trace', id, attempt, consistent: true, workspaceBytes: 0, at: w.clock.now, calls: calls(attempt, count) });
      }
      const check = (view: typeof w.journal.view) => {
        const attempts = declaredObligations(view, id, w.clock.now).toolAttempts as { meaning: string; calls: { result: string | null }[]; omitted?: number };
        const total = first + second, shown = Math.min(total, TOOL_ATTEMPTS_REVIEWED);
        expect(attempts.calls.map(call => call.result)).toEqual([...calls(0, first), ...calls(1, second)].slice(0, shown).map(call => call.result));
        if (total <= TOOL_ATTEMPTS_REVIEWED) {
          expect(attempts).toMatchObject({ meaning: TOOL_ATTEMPTS_MEANING });
          expect(attempts.omitted).toBeUndefined();
        } else {
          expect(attempts).toMatchObject({ meaning: TOOL_ATTEMPTS_PARTIAL_MEANING, omitted: total - shown });
        }
      };
      check(w.journal.view);
      w.journal.close();
      const reopened = openPreviewJournal(w.path, key);
      check(reopened.view);
      reopened.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('tells the reply review when its tool-call excerpt is incomplete, so a result from an omitted call is not read as unsupported (review round 2, finding 2)', async () => {
  for (const count of [TOOL_ATTEMPTS_REVIEWED, TOOL_ATTEMPTS_REVIEWED + 1]) {
    const root = origin();
    try {
      const w = world(root);
      await w.say('Run the steps and report the last result.');
      const id = w.journal.view.order[0]!.id;
      const calls = Array.from({ length: count }, (_, i) => ({ n: i + 1, tool: 'Bash', input: `echo ${i + 1}`, decision: 'allow',
        reason: 'sandboxed', result: i === count - 1 ? 'FINAL_RESULT' : String(i + 1) }));
      w.journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt: 0, calls: SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1, at: w.clock.now });
      w.journal.append({ kind: 'tool-turn', phase: 'trace', id, attempt: 0, consistent: true, workspaceBytes: 0, at: w.clock.now, calls });
      const read = (view: typeof w.journal.view) => declaredObligations(view, id, w.clock.now).toolAttempts as
        { meaning: string; calls: { result: string | null }[]; omitted?: number };
      const check = (attempts: ReturnType<typeof read>) => {
        expect(attempts.calls).toHaveLength(TOOL_ATTEMPTS_REVIEWED);
        if (count === TOOL_ATTEMPTS_REVIEWED) {
          // Complete: the exhaustive reading holds, and the reported result is in it.
          expect(attempts).toMatchObject({ meaning: TOOL_ATTEMPTS_MEANING });
          expect(attempts.omitted).toBeUndefined();
          expect(JSON.stringify(attempts.calls)).toContain('FINAL_RESULT');
        } else {
          // Incomplete: the review is told how many calls it cannot see and that absence proves nothing.
          expect(attempts).toMatchObject({ meaning: TOOL_ATTEMPTS_PARTIAL_MEANING, omitted: 1 });
          expect(JSON.stringify(attempts.calls)).not.toContain('FINAL_RESULT');
          expect(attempts.meaning).not.toContain('The only tool calls');
        }
      };
      check(read(w.journal.view));
      w.journal.close();
      const reopened = openPreviewJournal(w.path, key);
      check(read(reopened.view));
      reopened.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('a long answer keeps its own effect refusal; a follow-up report that no longer fits stays pending and rides a later answer (Rules 8, 42; Part Twelve §3)', async () => {
  const root = origin();
  const REPORT = `The invoice is ready. ${'r'.repeat(430)}`;
  try {
    const w = world(root, { maxBytes: 16000, answer: question => question === INVOICE
      ? { reply: LATER, openLoops: [{ kind: 'deferral', quote: LATER, waitsOn: 'nothing' }] }
      : question === DOORWAY ? { reply: `Here is the answer. ${'x'.repeat(2780)}` } : 'The tomatoes look fine.',
    work: () => ({ outcome: 'report', report: REPORT }) });
    await w.say(INVOICE);
    w.clock.now += LOOP_REVISIT_MS + 60_000;
    expect(await w.worker.workObligations()).toBe(true);
    expect(w.journal.view.obligationWork['commitment:0']?.report?.text).toBe(REPORT);
    // The report alone would fit; with the refusal reserved it does not, so the answer carries the refusal whole and no report.
    await w.say(DOORWAY);
    expect(w.sent).toHaveLength(2);
    expect(w.sent[1]).toMatch(/Here is the answer\. x+\n\nEffect doorway: a tool:unsandboxed step was refused/u);
    expect(w.sent[1]).not.toContain('The invoice is ready');
    expect(Buffer.byteLength(w.sent[1]!)).toBeLessThanOrEqual(3600);
    expect(w.journal.view.obligationWork['commitment:0']!.report!.boundTo).toBeUndefined();
    // The report is still owned and is delivered whole with the next answer.
    await w.say('How are the tomatoes?');
    expect(w.sent).toHaveLength(3);
    expect(w.sent[2]).toContain(REPORT);
    expect(w.sent[2]).not.toContain('Effect doorway');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('reserving room for an effect refusal shortens only the model body, never a runner refusal after it (Rule 42; Part Twelve §3)', async () => {
  // Astra cint-L42 MUST-FIX 1: a rejected standing instruction's correction must survive beside the effect refusal.
  for (const effect of [false, true]) {
    const root = origin();
    try {
      const w = world(root, { answer: () => ({ reply: `I saved your standing instruction. ${'x'.repeat(3200)}`,
        directives: [{ quote: 'Always call me Alexander.' }] }) });
      await w.say(effect ? `${DOORWAY} Always call me Alex.` : 'Always call me Alex.');
      expect(openDirectives(w.journal.view)).toHaveLength(0);
      expect(w.sent).toHaveLength(1);
      expect(w.sent[0]).toContain('I could not record that standing instruction exactly, so I have not saved it.');
      expect(Buffer.byteLength(w.sent[0]!)).toBeLessThanOrEqual(3600);
      if (effect) {
        expect(w.sent[0]).toMatch(/x…  ?I could not record that standing instruction exactly/u);
        expect(w.sent[0]).toMatch(/Please restate it\.\n\nEffect doorway: a tool:unsandboxed step was refused/u);
      } else expect(w.sent[0]).not.toContain('Effect doorway');
      w.journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});
