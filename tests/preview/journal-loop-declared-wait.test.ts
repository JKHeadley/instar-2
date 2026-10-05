// Plan row #547 (diagnosis unit w4-d1b). Live build cint-L50 57e12273 gave opposite results for the same group D
// short run on the same build. The passing run (room two, 21:45-23:11) answered its deferral with a loop that
// waits on `nothing`, so the step was scheduled and ran in the quiet window. The failing run (room two, 23:33-00:40)
// answered the retry wording with BOTH a promise and a loop declaring `waitsOn: "operator"` (recorded verbatim
// below from inspect-d1hi.json: `{ id: 1, loop: "promise", owner: "agent", waitsOn: "operator" }`), and
// `obligationSchedule` computed a first slot only for `nothing` and a dated promise. So that commitment had no
// schedule entry at all: `dueWork` 0, `scheduledWork` 1 (the D4 blocker's 2026-12-15 recheck) and `ownedWork` 1,
// while `revisitDue` 1 reported the loop as due to resurface. Nothing ran, nothing was reported, and the reply to
// "hi" carried no follow-up (D1b, D2, D1c FAIL).
//
// The poll pressure in that window was not the cause and these tests pin that too: the runner's run log recorded 16
// `poll: "failed"` rows and 13 `poll: "restored"` rows, at most 4 failures in a row, so the breaker
// (`exhaustedPollReason`, 20 failures or 5 conflicts) never opened; and `journal-agent.mjs` runs `workObligations()`
// in the pre-poll ordinary job of every cycle, independent of poll health and of any inbound.
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, dueObligationWork, obligationSchedule, openPreviewJournal } from './journal-test-worker.js';
import { loopHealth } from './obligations.js';
// @ts-expect-error The poll-pressure breaker is a JS host module.
import { exhaustedPollReason } from './poll-failure-reason.mjs';

const key = new Uint8Array(32).fill(97);
const T0 = 1791184000000, MINUTE = 60_000, REVISIT = 15 * MINUTE;
/** The live D1 retry message (update 6232350's successor, msg-d1r.txt), verbatim. */
const D1R = 'One more open item, and again no answer now please: work out a better name for my garden blog and tell me in a later message. Just confirm it is on your list.';
/** The live reply (reply-d1r.json), minus the preview marker the worker adds. */
const REPLY = 'Got it — added to the list. I\'ll work out a better name for your garden blog and give you that in a later message, not this one.';
const SENTENCE = 'I\'ll work out a better name for your garden blog and give you that in a later message, not this one.';
/** The live answer shape: the same sentence declared as a promise AND as a loop waiting on the operator. */
const OPERATOR_WAIT = JSON.stringify({ reply: REPLY, memory: [], promises: [{ quote: SENTENCE }],
  openLoops: [{ kind: 'promise', quote: SENTENCE, waitsOn: 'operator' }] });
const RESULT = 'A better name for the garden blog: "Row and Dawn" — it carries the rows you log and the watering hour.';
const NEED = 'the blog\'s current name and who the audience is, which only you can tell me.';
/** The live run log's poll pressure inside the quiet window (runs.jsonl of proofroom2-dshort15-20261004-233148). */
const POLL_PRESSURE: ('failed' | 'restored')[] = ['failed', 'restored', 'failed', 'failed', 'failed', 'failed',
  'restored', 'failed', 'restored'];

type WorkAnswer = Record<string, unknown>;
function world(root: string, answer: string, work: WorkAnswer[] = [{ outcome: 'report', report: RESULT }]) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '8989505249', chat: '7812716706',
    operator: '7812716706', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 1000, maxReplies: 1000, maxTurns: 1000, maxBytes: 409600, cursor: 0, loopRevisitMs: REVISIT });
  const clock = { now: T0 }, sent: string[] = [], workQuestions: string[] = [];
  let answers = 0, steps = 0;
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    prepareModel: input => input.context,
    model: async input => {
      if (input.id.startsWith('obligation:')) { workQuestions.push(input.id);
        return JSON.stringify(work[Math.min(steps++, work.length - 1)]); }
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Earlier turns.', people: [], commitments: [],
        closed: [], memory: [] });
      return answers++ === 0 ? answer : JSON.stringify({ reply: 'Hey Justin — I\'m here.', memory: [] });
    },
    send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
  let update = 6232351;
  const say = async (text: string) => {
    worker.intake([{ update_id: update++, message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain();
  };
  return { journal, worker, clock, say, sent, workQuestions };
}

const noteId = (journal: { view: { commitments: { quote: string }[] } }) =>
  journal.view.commitments.findIndex(note => note.quote === SENTENCE);

it('works a loop whose reply declared it waiting on the operator, on the revisit with no inbound', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-declared-wait-')));
  try {
    const w = world(root, OPERATOR_WAIT);
    await w.say(D1R);
    // The live recorded shape: one commitment for the sentence, agent-owned, declaring the operator as its wait.
    const id = noteId(w.journal);
    expect(w.journal.view.commitments[id]).toMatchObject({ in: 'reply', owner: 'agent', waitsOn: 'operator',
      loop: 'promise', agentPromise: { owner: 'agent', waitsOn: 'next-relevant-reply' } });
    const key2 = `commitment:${String(id)}`;
    const source = w.journal.view.turns.get(w.journal.view.commitments[id]!.source)!;
    // Rule 8: the declared wait carries the revisit cadence, so the loop has a schedule entry at all.
    expect(obligationSchedule(w.journal.view).find(item => item.key === key2)?.slot).toBe(source.at + REVISIT);
    const sends = w.sent.length;
    // The live quiet window: the revisit plus ten minutes, no inbound, and the run log's poll failures and restores
    // in between. The breaker never opens, and the step is due regardless of poll health.
    let failed = 0, conflicted = 0;
    for (const row of POLL_PRESSURE) {
      if (row === 'failed') failed++; else failed = 0;
      expect(exhaustedPollReason(failed, conflicted)).toBe(null);
    }
    expect(failed).toBe(0);
    expect(conflicted).toBe(0);
    w.clock.now = source.at + REVISIT + 10 * MINUTE;
    expect(dueObligationWork(w.journal.view, w.clock.now).map(item => item.key)).toContain(key2);
    for (let i = 0; i < 4 && await w.worker.workObligations(); i++) { /* one bounded step per tick */ }
    // D1b: the step ran and reported; D2: the result waits for the next message and status says so.
    expect(w.journal.view.obligationWork[key2]!.outcome).toBe('report');
    expect(w.workQuestions.some(question => question.startsWith(`obligation:${key2}:`))).toBe(true);
    const health = loopHealth(w.journal.view, w.clock.now);
    expect(health.awaitingDelivery).toBeGreaterThanOrEqual(1);
    expect(health.ownedWork).toBeGreaterThanOrEqual(1);
    expect(w.sent.length).toBe(sends);
    expect(health.deliveryInhibition)
      .toMatch(/^no grant for unsolicited sends; \d+ finished results? waits? for your next message$/u);
    // D1c: the operator's next message carries the result, and nothing waits after its receipt.
    w.clock.now += MINUTE;
    await w.say('hi');
    expect(w.sent.at(-1)).toContain('Follow-up on "');
    expect(w.sent.at(-1)).toContain(RESULT);
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(0);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

it('leaves a dependency a step actually recorded on the operator\'s next message, never the cadence', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-declared-wait-waiting-')));
  try {
    // The same declared wait, but the step concludes it genuinely needs the operator, with what it needs.
    const w = world(root, OPERATOR_WAIT, [{ outcome: 'waiting', waitsOn: 'operator', note: NEED }]);
    await w.say(D1R);
    const id = noteId(w.journal), key2 = `commitment:${String(id)}`;
    const source = w.journal.view.turns.get(w.journal.view.commitments[id]!.source)!;
    w.clock.now = source.at + REVISIT + 10 * MINUTE;
    for (let i = 0; i < 4 && await w.worker.workObligations(); i++) { /* one bounded step per tick */ }
    expect(w.journal.view.obligationWork[key2]).toMatchObject({ outcome: 'waiting', waitsOn: 'operator', note: NEED });
    const asked = w.workQuestions.length;
    // Past another whole revisit with no inbound: the recorded dependency holds the next step, so the cadence does
    // not spend a second call. It is visible as waiting work the runner still owns (Rules 46, 68).
    w.clock.now += 2 * REVISIT;
    expect(dueObligationWork(w.journal.view, w.clock.now).map(item => item.key)).not.toContain(key2);
    expect(await w.worker.workObligations()).toBe(false);
    expect(w.workQuestions.length).toBe(asked);
    const health = loopHealth(w.journal.view, w.clock.now);
    expect(health.waitingWork).toMatchObject([{ key: key2, waitsOn: 'operator', need: NEED }]);
    expect(health.ownedWork).toBeGreaterThanOrEqual(1);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

it('still schedules nothing for a promise the reply declared with no loop at all', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-declared-wait-promise-')));
  try {
    const w = world(root, JSON.stringify({ reply: REPLY, memory: [], promises: [{ quote: SENTENCE }] }));
    await w.say(D1R);
    const id = noteId(w.journal);
    expect(w.journal.view.commitments[id]!.waitsOn).toBeUndefined();
    expect(obligationSchedule(w.journal.view).some(item => item.key === `commitment:${String(id)}`)).toBe(false);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);
