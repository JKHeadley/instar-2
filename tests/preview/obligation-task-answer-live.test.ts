// Plan row #477 (cint-L47 live D run 2026-10-04 02:25, room two, 15-minute root proofroom2-dshort15-20261004-022507):
// the d1 deferral's step DID run on its revisit (02:43:47, slot = source + 15 min) and the model answered, but it wrote
// the step question's own JSON ({"outcome":"continue",...}) after a line of prose instead of inside the Decision
// envelope, so the launcher refused it as malformed and the step settled `failed`. A sweep of every preview root found
// the same for 14 of the 26 recorded obligation steps (cint-L45/46's deferral twice, each time a finished `report`).
// Every output below is replayed verbatim from those journals (decoded read-only from copies).
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, obligationDecision, obligationSchedule, openPreviewJournal } from './journal-test-worker.js';
import { loopHealth } from './obligations.js';
import { decisionWithinFloor, obligationTaskAnswer } from './model-call-boundary.js';
import { conclusionText, parseModelJson } from './model-json.js';

type Call = { root: string; call: string; recordedOutcome: string; output: string };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/obligation-step-outputs-live-2026-10-04.json', import.meta.url), 'utf8')) as { calls: Call[] };
type Decision = { type?: unknown; floor?: unknown; conclusion?: { subject?: unknown; value?: unknown } };

/** Exactly the launcher's acceptance of a result for an `answer`-role id (journal-agent invokeSubscription). `task`
 * false is the reading before this change. */
function launched(raw: string, id: string, task = true): string | null {
  const extracted = parseModelJson(raw, { wrapped: 'accept' }), decision = extracted.ok ? extracted.value as Decision : null;
  const enveloped = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
  return enveloped ?? (task && decision ? obligationTaskAnswer(id, decision as Record<string, unknown>) : null);
}
const outcomeOf = (call: Call, task = true) => {
  const text = launched(call.output, call.call, task);
  return text === null ? 'failed' : obligationDecision(text, call.call.startsWith('obligation:blocker') ? 'blocker' : 'commitment',
    1791107040442, 'America/Los_Angeles').outcome;
};
const L47_FIRST = fixture.calls.find(call => call.call === 'obligation:commitment:3:1791107022571')!;
const L47_SECOND = fixture.calls.find(call => call.call === 'obligation:commitment:3:1791107941154')!;
const L46_FIRST = fixture.calls.find(call => call.root === 'proofroom2-dshort15-20261004-001216'
  && call.call.startsWith('obligation:commitment:3:'))!;

it('replays every recorded obligation step: the unenveloped task answers are now read, nothing else changes', () => {
  expect(fixture.calls).toHaveLength(20);
  const before = fixture.calls.map(call => outcomeOf(call, false)), after = fixture.calls.map(call => outcomeOf(call));
  // Before: exactly what the journals recorded.
  expect(before).toEqual(fixture.calls.map(call => call.recordedOutcome));
  // After: every step that was read before reads the same; the ten unenveloped ones now carry the model's outcome.
  const changed = fixture.calls.filter((_, index) => before[index] !== after[index]);
  expect(changed).toHaveLength(10);
  for (const call of changed) expect(parseModelJson(call.output, { wrapped: 'accept' })).toMatchObject({ ok: true });
  expect(changed.map(call => outcomeOf(call)).sort()).toEqual([...Array(9).fill('report'), 'continue'].sort());
  // A Decision whose conclusion is not the task's shape (the "— K" step's {reply, fulfilled}) still fails.
  expect(fixture.calls.filter(call => call.output.startsWith('{"type":"Decision"') && call.recordedOutcome === 'failed')
    .every(call => outcomeOf(call) === 'failed')).toBe(true);
});

it('reads the live d1 deferral steps as the model wrote them', () => {
  expect(L47_FIRST.recordedOutcome).toBe('failed');
  expect(obligationDecision(launched(L47_FIRST.output, L47_FIRST.call)!, 'commitment', 0, 'America/Los_Angeles'))
    .toMatchObject({ outcome: 'continue', note: expect.stringMatching(/^Operator explicitly asked not to answer now/u) });
  expect(L46_FIRST.recordedOutcome).toBe('failed');
  expect(obligationDecision(launched(L46_FIRST.output, L46_FIRST.call)!, 'commitment', 0, 'America/Los_Angeles'))
    .toMatchObject({ outcome: 'report' });
});

it.each([
  ['a reply-answer id', 'telegram:8989505249:update:6232091', { outcome: 'report', report: 'r' }],
  ['a summary id', 'summary:6232091', { outcome: 'report', report: 'r' }],
  ['a non-canonical obligation id', 'obligation:commitment:3', { outcome: 'report', report: 'r' }],
  ['a Decision attempt', 'obligation:commitment:3:1', { type: 'Decision', outcome: 'report', report: 'r' }],
  ['a broken envelope carrying a floor', 'obligation:commitment:3:1', { outcome: 'report', report: 'r', floor: { allowed: ['work', 'send'], chosen: 'send' } }],
  ['a broken envelope carrying a conclusion', 'obligation:commitment:3:1', { outcome: 'report', conclusion: { value: 'x' } }],
  ['an object naming no outcome', 'obligation:commitment:3:1', { reply: 'Confirmed.', fulfilled: [] }],
])('refuses %s', (_, id, value) => {
  expect(obligationTaskAnswer(id, value as Record<string, unknown>)).toBeNull();
});

it('admits the task object for a canonical commitment or blocker step, unchanged', () => {
  const value = { outcome: 'still-blocked', recheck: '2026-10-20', reason: 'r' };
  expect(obligationTaskAnswer('obligation:blocker:0:1791107022571', value)).toBe(JSON.stringify(value));
  expect(obligationTaskAnswer('obligation:commitment:3:1791107022571', { outcome: 'x' })).toBe('{"outcome":"x"}');
});

// The live journal path, at the journal worker, with the launcher's reading of each recorded output.
const key = new Uint8Array(32).fill(73);
const T0 = 1791106122000, MINUTE = 60_000, REVISIT = 15 * MINUTE;
/** Live update 6232091 and the deferral reply the answer gave (journal rows 62 and 93), verbatim. */
const D1 = 'Please do not answer this one now. Keep it as an open item: think over which three of the things I have told you matter most for planning my week, and give me that answer in a later message, not in this reply. For now just confirm you have it as an open item.';
const HOLD = 'I\'ll review what you\'ve told me, pick the three things that matter most for planning your week, and bring that back to you in a later message.';
const REPLY = `Got it — holding this as an open item, not answering yet. ${HOLD}`;

function world(root: string, steps: Call[], task = true) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '8989505249', chat: '7812716706',
    operator: '7812716706', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 1000, maxReplies: 1000, maxTurns: 1000, maxBytes: 409600, cursor: 0, loopRevisitMs: REVISIT });
  const clock = { now: T0 }, sent: string[] = [], queue = [...steps];
  let answers = 0;
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    prepareModel: input => input.context,
    model: async input => {
      if (input.id.startsWith('obligation:')) {
        // The launcher's model port: a refused output is a completed call with no answer, exactly as invokeSubscription returns it.
        const text = launched(queue.shift()!.output, input.id, task);
        return text === null ? { state: 'complete' as const, failureClass: 'malformed' as const } : text;
      }
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Earlier turns.', people: [], commitments: [], closed: [], memory: [] });
      return answers++ === 0 ? JSON.stringify({ reply: REPLY, memory: [], openLoops: [{ kind: 'deferral', quote: HOLD, waitsOn: 'nothing' }] })
        : JSON.stringify({ reply: 'Hi! What can I help you with?', memory: [] });
    },
    send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
  let update = 6232091;
  const say = async (text: string) => {
    worker.intake([{ update_id: update++, message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain();
  };
  return { journal, worker, clock, say, sent };
}
const deferral = async (w: ReturnType<typeof world>) => {
  await w.say(D1);
  const id = w.journal.view.commitments.findIndex(note => note.quote === HOLD);
  expect(w.journal.view.commitments[id]).toMatchObject({ owner: 'agent', waitsOn: 'nothing' });
  return `commitment:${String(id)}`;
};

it('works the cint-L46 deferral on its first revisit: the unenveloped report waits for the next message', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-task-answer-')));
  try {
    const w = world(root, [L46_FIRST]), key = await deferral(w), sends = w.sent.length;
    const source = w.journal.view.turns.get(w.journal.view.order.at(-1)!.id)!;
    w.clock.now = source.at + REVISIT + 10 * MINUTE;
    for (let i = 0; i < 4 && await w.worker.workObligations(); i++) { /* one bounded step per tick */ }
    expect(w.journal.view.obligationWork[key]!.outcome).toBe('report');
    const health = loopHealth(w.journal.view, w.clock.now);
    expect(health.awaitingDelivery).toBe(1);
    expect(health.deliveryInhibition).toBe('no grant for unsolicited sends; 1 finished result waits for your next message');
    expect(w.sent.length).toBe(sends);
    w.clock.now += MINUTE;
    await w.say('hi');
    expect(w.sent.at(-1)).toContain('Follow-up on "');
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(0);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

it('before the change the same recorded step settles failed and nothing waits (the live symptom)', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-task-answer-old-')));
  try {
    const w = world(root, [L46_FIRST], false), key = await deferral(w);
    w.clock.now += REVISIT + 10 * MINUTE;
    await w.worker.workObligations();
    expect(w.journal.view.obligationWork[key]!.outcome).toBe('failed');
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(0);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

it('replays the cint-L47 pair: continue is kept with its note, and the next revisit\'s report waits', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-task-answer-l47-')));
  try {
    const w = world(root, [L47_FIRST, L47_SECOND]), key = await deferral(w);
    w.clock.now += REVISIT + MINUTE;
    expect(await w.worker.workObligations()).toBe(true);
    const work = w.journal.view.obligationWork[key]!;
    expect(work).toMatchObject({ outcome: 'continue', note: expect.stringMatching(/^Operator explicitly asked not to answer now/u) });
    // A continue is progress, not a failure: the next step is one revisit after it, with the note as lastProgress.
    const slot = obligationSchedule(w.journal.view).find(item => item.key === key)!.slot;
    expect(slot).toBe(work.last + REVISIT);
    w.clock.now = slot + MINUTE;
    expect(await w.worker.workObligations()).toBe(true);
    expect(w.journal.view.obligationWork[key]!.outcome).toBe('report');
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(1);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);
