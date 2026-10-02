import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, MEMORY_UNDECIDED_REPLY, openPreviewJournal, openRequests, projectionDigest } from './journal-test-worker.js';

/** Why this file exists. Plan row #284. Live 2026-10-02 06:31-06:55 PDT, proof room two on build cint-L27
 * d12bbf55, proof check RA3: the operator still could not cancel a reminder, and after trying, his other
 * reminders stopped firing.
 *
 * "Remind me today at 6:50 am to refill the bird feeder" and "Also remind me today at 6:50 am to call the
 * plumber" were both recorded open (w3-reminderwords works live). "Actually, cancel the bird feeder one."
 * was answered "I couldn't record that memory change. Please send it again." -- the fixed memory-undecided
 * notice -- and requestedActions.cancelled did not move. At 6:50 nothing fired: all three open requests,
 * including a 4:38 bird-feeder one from earlier, stayed open and unfired, because an undecided correction
 * held every request made before it and only a summary could ever clear that.
 *
 * Three faults, one turn (Rules 2, 10, 15, 57, 93, 95; the purpose's "nothing that mattered is silently
 * lost"). First: the withdrawal is routed to the rolling summary's memory-fact decision because the message
 * opens "Actually", and that decision has no honest answer for a withdrawal -- so it failed malformed twice
 * and the turn settled undecided. Second: the answer turn, which IS offered the open requests and the
 * quoted cancelReminders contract, then ran -- and its reply was replaced by the fixed notice, so whatever
 * it decided reached nobody, and the resend it asked for could not help. Third: the undecided turn held
 * every earlier request with no end, so one unrecordable cancel killed three reminders for the day. */
const fixture = JSON.parse(readFileSync(new URL('./fixtures/cancelpath-live-2026-10-02.json', import.meta.url), 'utf8')) as {
  source: string;
  turns: { label: string; update: number; message: string; reply: string; seconds: number }[];
  datedAtRa3: { quote: string; state: string; time: string; remind?: boolean }[];
  summaryAtRa3: { summaryThrough: number; lastSummaryFailure: { through: number; reason: string };
    modelFailureClasses: Record<string, number> };
  requestedActionsAfterRa4: { requested: number; cancelled: number; open: { quote: string; due: string }[] } };
const recorded = (label: string) => fixture.turns.find(item => item.label === label)!;

const FEEDER = recorded('ra1').message, PLUMBER = recorded('ra2').message, CANCEL = recorded('ra3').message;
/** The earlier, still-open bird-feeder request the live room also held: "the bird feeder one" named two. */
const EARLIER = 'Remind me today at 6:45 am to refill the bird feeder';
const SISTER = 'Actually, my sister\'s name is Ana, not Anna';

/** The recorded fault itself, read off the delivered bytes. */
it('records what the live build answered the operator, and what it left unfired', () => {
  // The withdrawal was answered with the fixed memory-undecided notice, asking for a resend.
  expect(recorded('ra3').reply).toContain(MEMORY_UNDECIDED_REPLY);
  // The summary frontier stopped one update short of the withdrawal, whose span failed malformed.
  expect(fixture.summaryAtRa3.summaryThrough).toBe(recorded('ra2').update);
  expect(fixture.summaryAtRa3.lastSummaryFailure).toEqual({ through: recorded('ra3').update, reason: 'malformed' });
  expect(fixture.summaryAtRa3.modelFailureClasses.malformed).toBe(2);
  // Nothing was cancelled, and all three requests -- the 6:50 pair and the 4:38 one -- stayed open.
  expect(fixture.requestedActionsAfterRa4.cancelled).toBe(1); // unchanged from before the withdrawal
  expect(fixture.requestedActionsAfterRa4.open.map(item => item.quote))
    .toEqual(['Remind me today at 4:38 am to refill the bird feeder', FEEDER, PLUMBER]);
  // "the bird feeder one" was genuinely ambiguous: two open bird-feeder requests were in that packet.
  expect(fixture.datedAtRa3.filter(item => item.remind === true && item.quote.includes('bird feeder')).length)
    .toBeGreaterThan(1);
});

const key = new Uint8Array(32).fill(61);
// 2026-10-02 06:31 America/Los_Angeles, the live clock of the recorded turns.
const START = Date.UTC(2026, 9, 2, 13, 31);
const DUE_650 = Date.UTC(2026, 9, 2, 13, 50);
const genesis = { kind: 'genesis' as const, bot: '8989505249', chat: '7812716706', operator: '7812716706',
  grant: 'grant:cancel-path', configurationDigest: 'sha256:cancel-path', expires: Date.UTC(2026, 9, 10),
  maxCalls: 200, maxReplies: 100, maxTurns: 60, maxBytes: 40000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text,
    date: Math.floor(START / 1000) + id * 60 } });
type Input = { id: string; question: string; context: string };
type Reminder = { id: string; quote: string; due: string };
const offered = (input: Input) => (JSON.parse(input.context) as { reminders?: Reminder[] }).reminders ?? [];
const memoryRequest = (input: Input) =>
  (JSON.parse(input.context) as { memoryRequest?: { message: string } }).memoryRequest?.message;

/** The dated request shape the live run really recorded for each reminder message. */
const request = (text: string, when: string) => ({ quote: text, when, remind: true });
const when = (text: string) => text.includes('6:45') ? 'today at 6:45 am' : 'today at 6:50 am';

/** One world per test. `answer` returns the decision shape being replayed for the withdrawing message;
 * `summaryResolves` is whether the rolling summary can decide that message's memory question -- live it
 * could not, because a withdrawal is not a memory-fact change. */
function world(root: string, opts: { answer: (input: Input) => string; summaryResolves?: boolean; withdrawal?: string },
  clock = { now: START }, first = true) {
  const withdrawing = opts.withdrawal ?? CANCEL;
  const sent: string[] = [], offers: string[][] = [];
  const ports = { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => {
      if (input.id.startsWith('summary:')) {
        const base = { summary: 'The operator asked for reminders and then withdrew one.', people: [],
          commitments: [], questions: [], cancelReminders: [] };
        // The recorded live shape: the strict memory decision this span is required to carry is the
        // withdrawing message, and the summary model reports it cannot resolve a memory change from it.
        // That is counted malformed, and two such attempts settle the turn undecided.
        return memoryRequest(input) === withdrawing && opts.summaryResolves !== true
          ? JSON.stringify({ ...base, memoryDisposition: 'unresolved' })
          : JSON.stringify({ ...base, memory: [] });
      }
      if (input.question === withdrawing || input.question === SISTER) {
        offers.push(offered(input).map(item => item.quote));
        return opts.answer(input);
      }
      const text = input.question;
      return text.startsWith('Remind me') || text.startsWith('Also remind me')
        ? JSON.stringify({ reply: 'Okay.', memory: [], dated: [request(text, when(text))] })
        : JSON.stringify({ reply: `Noted: ${text.slice(0, 40)}`, memory: [], dated: [] });
    },
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  const journal = first ? openPreviewJournal(join(root, 'journal.encrypted'), key, genesis)
    : openPreviewJournal(join(root, 'journal.encrypted'), key);
  return { journal, worker: createJournalWorker(journal, ports), sent, offers };
}
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-cancelpath-${name}-`)));
const pushes = (sent: string[]) => sent.filter(text => text.startsWith('PREVIEW — You asked on'));
const turnOf = (w: ReturnType<typeof world>, text: string) => w.journal.view.order.find(turn => turn.text === text)!;

/** The live sequence up to the withdrawal: the two 6:50 requests, each recorded open. */
const liveShape = async (w: ReturnType<typeof world>, extra: string[] = []) => {
  let id = 1;
  for (const text of [...extra, FEEDER, PLUMBER]) { w.worker.intake([update(id++, text)]); await w.worker.drain(); }
  expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([...extra, FEEDER, PLUMBER]);
  return id;
};
/** The withdrawal, drained until its summary span has used both attempts -- the live shape, where the
 * reply arrived 400 seconds after the message. */
const withdraw = async (w: ReturnType<typeof world>, id: number, text = CANCEL) => {
  w.worker.intake([update(id, text)]);
  await w.worker.drain(); await w.worker.drain();
};

/** Case one: a withdrawal naming one open request. It is cancelled against the operator's own words, the
 * reply says which, and the request it did not name fires once at its time. */
it('cancels the one request the withdrawal names, and the other still fires at its time', async () => {
  const root = tmp('one');
  try {
    const clock = { now: START };
    const w = world(root, { answer: input => JSON.stringify({ reply: 'Done.', memory: [], dated: [],
      cancelReminders: offered(input).filter(item => item.quote.includes('bird feeder'))
        .map(item => ({ id: item.id, quote: 'cancel the bird feeder one' })) }) }, clock);
    const id = await liveShape(w);
    await withdraw(w, id);
    const cancel = turnOf(w, CANCEL);
    // The live collapse still happens upstream: the summary could not decide the memory question.
    expect(cancel.memoryUndecided).toBe(true);
    expect(cancel.memoryPending).toBe(true);
    // What is different: the answer's own decision was recorded and its reply was sent.
    expect(cancel.reminderDecided).toBe(true);
    expect(w.offers).toEqual([[FEEDER, PLUMBER]]);
    expect(w.journal.view.reminderCancels).toHaveLength(1);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([PLUMBER]);
    expect(w.sent.at(-1)!).toContain(`Cancelled request: "${FEEDER}".`);
    // The fixed notice the live build sent instead is gone.
    expect(w.sent.at(-1)!).not.toContain(MEMORY_UNDECIDED_REPLY);
    expect(recorded('ra3').reply).toContain(MEMORY_UNDECIDED_REPLY);
    // At 6:50 the plumber request fires once; the cancelled one never does.
    clock.now = DUE_650;
    await w.worker.drain(); await w.worker.sendRequested(); await w.worker.sendRequested();
    expect(pushes(w.sent)).toHaveLength(1);
    expect(pushes(w.sent)[0]).toContain('call the plumber');
    expect(pushes(w.sent)[0]).not.toContain('bird feeder');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

/** Case two: "the bird feeder one" named two open requests -- the live room's actual state. The answer may
 * ask which, and then nothing is cancelled, every request still stands and still falls due. */
it('asks which when the withdrawal matches two open requests, and holds none of them silently', async () => {
  const root = tmp('two-ask');
  try {
    const clock = { now: START };
    const w = world(root, { answer: input => JSON.stringify({
      reply: `Two of your open requests match "the bird feeder one": ${offered(input)
        .filter(item => item.quote.includes('bird feeder')).map(item => `"${item.quote}"`).join(' and ')}. Which should I cancel?`,
      memory: [], dated: [], cancelReminders: [] }) }, clock);
    const id = await liveShape(w, [EARLIER]);
    await withdraw(w, id);
    const cancel = turnOf(w, CANCEL);
    expect(cancel.memoryUndecided).toBe(true);
    // "withdraws none" is a decision, recorded as the empty set.
    expect(cancel.reminderDecided).toBe(true);
    expect(w.journal.view.reminderCancels).toHaveLength(0);
    // The reply names both matching requests and asks -- it never says "send it again".
    expect(w.sent.at(-1)!).toContain(EARLIER);
    expect(w.sent.at(-1)!).toContain(FEEDER);
    expect(w.sent.at(-1)!).toContain('Which should I cancel?');
    expect(w.sent.at(-1)!).not.toContain(MEMORY_UNDECIDED_REPLY);
    // And it says plainly that nothing was cancelled, naming what still stands.
    expect(w.sent.at(-1)!).toContain('Your open requests still stand and will be sent at their time:');
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([EARLIER, FEEDER, PLUMBER]);
    // The verdict is a durable journal row, not a memory flag: it is still there after a restart, with
    // every request still open (Rule 2; the durable-intake floor).
    w.journal.close();
    const after = world(root, { answer: () => { throw Error('no answer call expected after restart'); } }, clock, false);
    expect(turnOf(after, CANCEL).reminderDecided).toBe(true);
    expect(after.journal.view.reminderCancels).toHaveLength(0);
    expect(openRequests(after.journal.view).map(item => item.quote)).toEqual([EARLIER, FEEDER, PLUMBER]);
    // The live failure: none of these ever fired. All three do now, on the restarted root.
    clock.now = DUE_650;
    for (let pass = 0; pass < 4; pass++) { await after.worker.drain(); await after.worker.sendRequested(); }
    expect(pushes(after.sent).join('\n')).toContain(EARLIER);
    expect(pushes(after.sent).join('\n')).toContain(FEEDER);
    expect(pushes(after.sent).join('\n')).toContain('call the plumber');
    after.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

/** cint-L30 (cint-L26's validate-before-write path, cint-L29's snapshot handling): the recorded empty verdict is
 * written through the same append path, kept by a compaction snapshot, and read back from it on reopen. */
it('keeps the recorded empty withdrawal verdict through a compaction snapshot and a reopen', async () => {
  const root = tmp('two-compact');
  try {
    const clock = { now: START };
    const w = world(root, { answer: () => JSON.stringify({ reply: 'Which bird feeder request should I cancel?',
      memory: [], dated: [], cancelReminders: [] }) }, clock);
    const id = await liveShape(w, [EARLIER]);
    await withdraw(w, id);
    expect(turnOf(w, CANCEL).reminderDecided).toBe(true);
    const before = projectionDigest(w.journal.view);
    w.journal.compact(); w.journal.close();
    const after = world(root, { answer: () => { throw Error('no answer call expected after reopen'); } }, clock, false);
    // The reopened projection is the compacted one, field for field, and carries the verdict.
    expect(projectionDigest(after.journal.view)).toBe(before);
    expect(turnOf(after, CANCEL).reminderDecided).toBe(true);
    expect(after.journal.view.reminderCancels).toHaveLength(0);
    expect(openRequests(after.journal.view).map(item => item.quote)).toEqual([EARLIER, FEEDER, PLUMBER]);
    // The verdict still releases every request: all three fire at their time, with no model call.
    clock.now = DUE_650;
    for (let pass = 0; pass < 4; pass++) { await after.worker.drain(); await after.worker.sendRequested(); }
    expect(pushes(after.sent).join('\n')).toContain(EARLIER);
    expect(pushes(after.sent).join('\n')).toContain('call the plumber');
    after.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

/** Case two, the other half: when the operator's words withdraw every match, all of them are cancelled. */
it('cancels every matching request when the operator\'s own words withdraw them all', async () => {
  const root = tmp('two-all');
  try {
    const both = 'Actually, cancel both bird feeder ones.';
    const clock = { now: START };
    const w = world(root, { withdrawal: both,
      answer: input => JSON.stringify({ reply: 'Both cancelled.', memory: [], dated: [],
        cancelReminders: offered(input).filter(item => item.quote.includes('bird feeder'))
          .map(item => ({ id: item.id, quote: 'cancel both bird feeder ones' })) }) }, clock);
    const id = await liveShape(w, [EARLIER]);
    w.worker.intake([update(id, both)]); await w.worker.drain(); await w.worker.drain();
    expect(w.journal.view.reminderCancels).toHaveLength(2);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([PLUMBER]);
    expect(w.sent.at(-1)!).toContain(EARLIER);
    expect(w.sent.at(-1)!).toContain(FEEDER);
    clock.now = DUE_650;
    await w.worker.drain(); await w.worker.sendRequested(); await w.worker.sendRequested();
    expect(pushes(w.sent)).toHaveLength(1);
    expect(pushes(w.sent)[0]).toContain('call the plumber');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

/** Case three: a decision the quote check refuses. Nothing is cancelled, the requests stay open, and the
 * reply carries w3-reminderwords' own sentence plus what still stands. */
it('refuses an unquoted cancellation, says so, names what still stands, and still fires them', async () => {
  const root = tmp('malformed');
  try {
    const clock = { now: START };
    const w = world(root, { answer: input => JSON.stringify({ reply: 'Done.', memory: [], dated: [],
      // Words from the agent's own reply, not the operator's message: the one evidence that never cancels.
      cancelReminders: offered(input).filter(item => item.quote.includes('bird feeder'))
        .map(item => ({ id: item.id, quote: 'This replaces the bird feeder reminder' })) }) }, clock);
    const id = await liveShape(w);
    await withdraw(w, id);
    const cancel = turnOf(w, CANCEL);
    expect(w.journal.view.reminderCancels).toHaveLength(0);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([FEEDER, PLUMBER]);
    expect(cancel.reminderDecided).toBe(true);
    expect(w.sent.at(-1)!).toContain('I couldn\'t verify that cancellation, so no request was cancelled; your open requests still stand.');
    expect(w.sent.at(-1)!).toContain('Your open requests still stand and will be sent at their time:');
    expect(w.sent.at(-1)!).toContain(FEEDER);
    expect(w.sent.at(-1)!).not.toContain(MEMORY_UNDECIDED_REPLY);
    clock.now = DUE_650;
    for (let pass = 0; pass < 3; pass++) { await w.worker.drain(); await w.worker.sendRequested(); }
    expect(pushes(w.sent).join('\n')).toContain(FEEDER);
    expect(pushes(w.sent).join('\n')).toContain('call the plumber');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

/** The notice still belongs to the case it was written for: an answer that records no reminder decision at
 * all leaves the memory question genuinely unrecorded, so the fixed notice is still sent -- and the
 * requests it may have withdrawn are released once that reply goes out, never held for the day. */
it('still sends the fixed notice when the answer records no decision, and releases the requests anyway', async () => {
  const root = tmp('notice');
  try {
    const clock = { now: START };
    const w = world(root, { answer: () => JSON.stringify({ reply: 'Okay.', dated: [] }) }, clock);
    const id = await liveShape(w);
    await withdraw(w, id);
    const cancel = turnOf(w, CANCEL);
    expect(cancel.memoryUndecided).toBe(true);
    expect(cancel.memoryPending).toBe(true);
    expect(cancel.reminderDecided).toBeUndefined();
    expect(w.sent.at(-1)!).toContain(MEMORY_UNDECIDED_REPLY);
    expect(openRequests(w.journal.view)).toHaveLength(2);
    // Live, these two never fired. The hold ends when the withdrawal's own reply goes out.
    clock.now = DUE_650;
    for (let pass = 0; pass < 3; pass++) { await w.worker.drain(); await w.worker.sendRequested(); }
    expect(pushes(w.sent).join('\n')).toContain(FEEDER);
    expect(pushes(w.sent).join('\n')).toContain('call the plumber');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

/** The neighbour that must not change: a real memory correction still takes the memory path. Its own
 * summary decides it, nothing is cancelled, and the open requests are untouched and still fire. */
it('leaves a real memory correction on the memory path, cancelling nothing', async () => {
  const root = tmp('memory');
  try {
    const clock = { now: START };
    const w = world(root, { summaryResolves: true,
      answer: () => JSON.stringify({ reply: 'Noted, Ana.', memory: [], dated: [], cancelReminders: [] }) }, clock);
    const id = await liveShape(w);
    w.worker.intake([update(id, SISTER)]); await w.worker.drain(); await w.worker.drain();
    const correction = turnOf(w, SISTER);
    // The summary decided this turn's memory question, exactly as before.
    expect(w.journal.view.summaries.some(summary => summary.memoryFor?.includes(correction.id))).toBe(true);
    expect(correction.memoryUndecided).toBeUndefined();
    expect(w.journal.view.reminderCancels).toHaveLength(0);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([FEEDER, PLUMBER]);
    expect(w.sent.at(-1)!).not.toContain(MEMORY_UNDECIDED_REPLY);
    // No unasked-for request line rides an ordinary correction.
    expect(w.sent.at(-1)!).not.toContain('Nothing was cancelled');
    clock.now = DUE_650;
    await w.worker.drain(); await w.worker.sendRequested(); await w.worker.sendRequested();
    expect(pushes(w.sent).join('\n')).toContain(FEEDER);
    expect(pushes(w.sent).join('\n')).toContain('call the plumber');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);
