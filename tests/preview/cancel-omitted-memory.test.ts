import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, MEMORY_UNDECIDED_REPLY, openPreviewJournal, openRequests } from './journal-test-worker.js';

/** Why this file exists. Plan row #351. Live 2026-10-02 22:18-22:22 PDT, proof room two on build cint-L33
 * 08220af9, proof check RA3, group A on a fresh root. The same check passed on the same build at 19:15 PDT.
 *
 * "Remind me today at 10:34 pm to refill the bird feeder" and "Also remind me today at 10:34 pm to call the
 * plumber" were both recorded open. "Actually, cancel the bird feeder one." was answered by the model with
 * exactly the right decision -- the bird-feeder id and the quote "cancel the bird feeder one", copied from the
 * message -- but nothing was cancelled, both reminders fired at 10:34, and the operator was told "Please send
 * it again."
 *
 * What differed from the passing run was upstream: both rolling-summary attempts at that span came back
 * without the memory decision they were required to carry, so the turn settled memory-undecided. The answer
 * decision, read on such a turn, carried no `memory` field (the model wrote that the message creates no memory
 * change and returned only reply and cancelReminders). On an undecided, cued turn an absent memory field was
 * counted as an invalid memory decision, and an invalid memory decision wipes the whole decision -- including a
 * withdrawal that had already passed its exact quote check. With no reminder verdict recorded, the fixed
 * memory-undecided notice replaced the reply; the pre-send reviewer objected to that notice, its revision timed
 * out, and the claim-scoped withhold cut its first sentence, leaving "Please send it again."
 *
 * Every model output below is the recorded one, byte for byte, read from a copy of the failing root's journal;
 * only the reminder id is mapped onto the id this test's journal offers for the same request. */
type Withdrawal = { id: string; quote: string };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/cancel2-live-2026-10-02.json', import.meta.url), 'utf8')) as {
  turns: { label: string; update: number; message: string; reply: string }[];
  passRunRa3: { message: string; reply: string };
  summaryOutputsAtRa3: Record<string, unknown>[];
  answerOutputAtRa3: { value: { reply: string; cancelReminders: Withdrawal[]; memory?: unknown }; reason: string };
  answerRowAtRa3: { text: string; datedPending: boolean; memoryPending: boolean };
  memoryUndecidedAtRa3: { reason: string };
  reviewCandidateAtRa3: string; intentAtRa3: string;
  statusAfterRa3: { lastSummaryFailure: { through: number; reason: string }; modelFailureClasses: Record<string, number> };
  requestedActionsAfterRa4: { requested: number; cancelled: number } };
const recorded = (label: string) => fixture.turns.find(item => item.label === label)!;
const FEEDER = recorded('ra1').message, PLUMBER = recorded('ra2').message, CANCEL = recorded('ra3').message;
const LIVE_ID = 'reminder-c55ad3832d';
const ANSWER = fixture.answerOutputAtRa3.value;

it('records the live decision that was right, and the reply and reminders that were not', () => {
  // The answer read the withdrawal correctly and quoted the operator's own words for it.
  expect(ANSWER.cancelReminders).toEqual([{ id: LIVE_ID, quote: 'cancel the bird feeder one' }]);
  expect(CANCEL).toContain(ANSWER.cancelReminders[0]!.quote);
  // It returned no memory field at all -- the condition that sank it.
  expect('memory' in ANSWER).toBe(false);
  expect(fixture.answerOutputAtRa3.reason).toContain('No new memory');
  // The turn's memory question had been given up on: two malformed summaries, then memory-undecided.
  expect(fixture.statusAfterRa3.lastSummaryFailure).toEqual({ through: recorded('ra3').update, reason: 'malformed' });
  expect(fixture.statusAfterRa3.modelFailureClasses.malformed).toBe(2);
  expect(fixture.memoryUndecidedAtRa3.reason).toBe('summary-failed');
  for (const output of fixture.summaryOutputsAtRa3) expect('memory' in output).toBe(false);
  // The answer row kept the reply text but no reminder verdict, and was marked memory-pending.
  expect(fixture.answerRowAtRa3.text).toBe(ANSWER.reply);
  expect(fixture.answerRowAtRa3.memoryPending).toBe(true);
  // The fixed notice was put up for review, and what survived the review's withhold reached the operator.
  expect(fixture.reviewCandidateAtRa3.startsWith(MEMORY_UNDECIDED_REPLY)).toBe(true);
  expect(recorded('ra3').reply.startsWith('PREVIEW — Please send it again.')).toBe(true);
  expect(fixture.intentAtRa3).toBe(recorded('ra3').reply);
  // Nothing was cancelled; both requests fired at 10:34.
  expect(fixture.requestedActionsAfterRa4).toMatchObject({ requested: 2, cancelled: 0 });
  // The passing run on the same build cancelled it and said so.
  expect(fixture.passRunRa3.message).toBe(CANCEL);
  expect(fixture.passRunRa3.reply).toContain('Cancelled request:');
});

const key = new Uint8Array(32).fill(67);
// 2026-10-02 22:18 America/Los_Angeles, the live clock of the recorded turns; the requests fall due at 22:34.
const START = Date.UTC(2026, 9, 3, 5, 18);
const DUE = Date.UTC(2026, 9, 3, 5, 34);
const genesis = { kind: 'genesis' as const, bot: '8989505249', chat: '7812716706', operator: '7812716706',
  grant: 'grant:cancel-omitted-memory', configurationDigest: 'sha256:cancel-omitted-memory', expires: Date.UTC(2026, 9, 10),
  maxCalls: 200, maxReplies: 100, maxTurns: 60, maxBytes: 40000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text,
    date: Math.floor(START / 1000) + id * 60 } });
type Input = { id: string; question: string; context: string };
const offered = (input: Input) => (JSON.parse(input.context) as { reminders?: { id: string; quote: string }[] }).reminders ?? [];
const memoryRequest = (input: Input) =>
  (JSON.parse(input.context) as { memoryRequest?: { message: string } }).memoryRequest?.message;
/** The recorded id names the bird-feeder request; this journal offers the same request under its own id. */
const mapped = (value: unknown, input: Input): unknown => {
  const feeder = offered(input).find(item => item.quote === FEEDER)?.id ?? LIVE_ID;
  return JSON.parse(JSON.stringify(value).replaceAll(LIVE_ID, feeder));
};

/** One world. Summary calls on the withdrawal's span replay the two recorded summary outputs in order; the
 * withdrawal's answer is `answer` (the recorded output, or a variant of it). */
function world(root: string, answer: (input: Input) => unknown, clock: { now: number }) {
  const sent: string[] = [];
  let summaryAttempt = 0;
  const ports = { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => {
      if (input.id.startsWith('summary:')) {
        if (memoryRequest(input) === CANCEL && summaryAttempt < fixture.summaryOutputsAtRa3.length)
          return JSON.stringify(mapped(fixture.summaryOutputsAtRa3[summaryAttempt++], input));
        return JSON.stringify({ summary: 'The operator asked for two reminders.', people: [], commitments: [],
          questions: [], memory: [], cancelReminders: [] });
      }
      if (input.question === CANCEL) return JSON.stringify(answer(input));
      return JSON.stringify({ reply: 'Got it.', memory: [],
        dated: [{ quote: input.question, when: 'today at 10:34 pm', remind: true }] });
    },
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  return { journal, worker: createJournalWorker(journal, ports), sent };
}
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-cancel2-${name}-`)));
const pushes = (sent: string[]) => sent.filter(text => text.startsWith('PREVIEW — You asked on'));

/** The live sequence: the two 10:34 requests, then the withdrawal drained until its summary span is spent. */
async function replay(answer: (input: Input) => unknown, name: string,
  check: (w: ReturnType<typeof world>, clock: { now: number }) => Promise<void>) {
  const root = tmp(name);
  try {
    const clock = { now: START };
    const w = world(root, answer, clock);
    let id = 1;
    for (const text of [FEEDER, PLUMBER]) { w.worker.intake([update(id++, text)]); await w.worker.drain(); }
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([FEEDER, PLUMBER]);
    w.worker.intake([update(id, CANCEL)]);
    await w.worker.drain(); await w.worker.drain();
    const turn = w.journal.view.order.find(item => item.text === CANCEL)!;
    // The live collapse upstream reproduces: the recorded summaries leave the memory question undecided.
    expect(turn.memoryUndecided).toBe(true);
    await check(w, clock);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}
const fireDue = async (w: ReturnType<typeof world>, clock: { now: number }) => {
  clock.now = DUE;
  for (let pass = 0; pass < 3; pass++) { await w.worker.drain(); await w.worker.sendRequested(); }
};

it('applies the recorded withdrawal that quoted the operator, though the answer omitted memory', async () => {
  await replay(input => mapped(ANSWER, input), 'applied', async (w, clock) => {
    const turn = w.journal.view.order.find(item => item.text === CANCEL)!;
    expect(turn.reminderDecided).toBe(true);
    expect(w.journal.view.reminderCancels).toHaveLength(1);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([PLUMBER]);
    // The agent's own reply goes out, with the runner's record of what was cancelled.
    const reply = w.sent.at(-1)!;
    expect(reply).toContain(ANSWER.reply);
    expect(reply).toContain(`Cancelled request: "${FEEDER}".`);
    expect(reply).not.toContain('Please send it again');
    // At 10:34 the plumber request fires once; the cancelled one never does.
    await fireDue(w, clock);
    expect(pushes(w.sent)).toHaveLength(1);
    expect(pushes(w.sent)[0]).toContain('call the plumber');
    expect(pushes(w.sent)[0]).not.toContain('bird feeder');
  });
}, 60000);

it('refuses the same decision when its quote is not the operator\'s words, says so, and keeps both', async () => {
  // The recorded shape with the agent's own reply as the "evidence": never the operator's words.
  const ownWords = { ...ANSWER, cancelReminders: [{ id: LIVE_ID, quote: 'cancelled the reminder to refill the bird feeder' }] };
  await replay(input => mapped(ownWords, input), 'refused', async (w, clock) => {
    expect(w.journal.view.reminderCancels).toHaveLength(0);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([FEEDER, PLUMBER]);
    const reply = w.sent.at(-1)!;
    // The honest refusal names what it could not verify and what still stands -- not "send it again".
    expect(reply).toContain('I couldn\'t verify that cancellation, so no request was cancelled; your open requests still stand.');
    expect(reply).toContain('Your open requests still stand and will be sent at their time:');
    expect(reply).not.toContain('Please send it again');
    expect(reply).not.toContain('Cancelled request:');
    await fireDue(w, clock);
    expect(pushes(w.sent).join('\n')).toContain('bird feeder');
    expect(pushes(w.sent).join('\n')).toContain('call the plumber');
  });
}, 60000);

it('still sends the fixed notice when the answer reads no withdrawal and records no memory decision', async () => {
  // Neither memory nor cancelReminders: nothing about this message was decided, so the notice stands.
  await replay(() => ({ reply: ANSWER.reply }), 'none', async w => {
    expect(w.journal.view.reminderCancels).toHaveLength(0);
    expect(w.sent.at(-1)!.startsWith(MEMORY_UNDECIDED_REPLY)).toBe(true);
  });
}, 60000);

it('still refuses a withdrawal the answer pairs with an unresolved memory decision', async () => {
  // The model said it could not tell what memory change the message makes: the decision stays refused whole.
  await replay(input => mapped({ ...ANSWER, memoryDisposition: 'unresolved' }, input), 'unresolved', async w => {
    expect(w.journal.view.reminderCancels).toHaveLength(0);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([FEEDER, PLUMBER]);
    expect(w.sent.at(-1)!.startsWith(MEMORY_UNDECIDED_REPLY)).toBe(true);
  });
}, 60000);
