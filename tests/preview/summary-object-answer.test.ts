import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OBJECT_AS_TEXT_DEFECT, readAnswer } from './answer-reading.js';
import { interpretSummaryReview } from './summary-check.js';
import { createJournalWorker, MEMORY_UNDECIDED_REPLY, openPreviewJournal, openRequests, SUMMARY_FORMAT } from './journal-test-worker.js';

/** Why this file exists. Plan row #507. Live cint-L49 ddfc8f67, proof room 1 RA3
 * (A-proofroom-20261004-105619): "Actually, cancel the bird feeder one." was answered with the fixed notice
 * "I couldn't record that memory change. Please send it again.", nothing was cancelled, and the reminder fired
 * at RA4. The same check had been fixed twice before (w3-cancel2 on 2026-10-02, w3-cancelpath before it).
 *
 * The records say where it broke. Both `summary:715673799` attempts ended normally inside the output cap
 * (1791 and 985 of 2048 output tokens, exitCode 0, subtype success), so nothing was truncated. The only
 * envelope-level read failure recorded in the whole root during the turn was
 * `summary-review/verdict/malformed/not-json`, 10 ms after `summary:715673799:review` returned; there is no
 * `summary/...` entry at all, so the summary writer's own envelope was read both times. And the span's last
 * `summary-failed` row carried NO `reason` (status shows `reason: "malformed"`, which is the `?? failureClass`
 * fallback), which names the summary's post-parse field gate -- the one that reads `memory` and
 * `cancelReminders` out of a JSON object the MODEL hand-writes -- and rules out the faithfulness, over-bound
 * and over-cap gates, each of which sets `reason`.
 *
 * Two causes, both of them a shape the model writes and the runner then cannot read.
 *
 * One: the answer object written as JSON TEXT. Plan #491 took the Decision envelope out of the model's hands
 * for ANSWERS; the summary side still asked for its object as answer text ("Make your answer text one JSON
 * object", "Return only JSON {verdict, reason}"), so every brace and every escape of the real decision stayed
 * the model's. Under cint-L50's own final flat prompt the real model still writes that shape for the review:
 * the recorded `summary:715673532:review` came back as
 * {"reasoning":...,"answer":"{\"verdict\":\"pass\",\"reason\":...}"}.
 *
 * Two: one field, two shapes. `cancelReminders` on the ANSWER side is [{id, quote}]; the summary side asked
 * for [ids]. The same model writes the answer's shape in the summary, so the withdrawal read as nothing and
 * the summary was then refused for want of the field. Recorded live on 2026-10-02, and in all three real-model
 * runs of 2026-10-04 that volunteered the field.
 *
 * Rule 2 (nothing that mattered is silently lost), Rule 10 (the model reads meaning; code keeps only exact
 * quotes and ids this packet offered), Rules 57 and 93 (the operator's own words are the evidence, never the
 * agent's reply), Rule 116 (the simplest route: the runner serializes what the consumer parses). */

type Call = { label: string; id: string; recorded?: true; output?: string; ok: boolean;
  envelope?: 'flat' | 'decision'; objectAsText?: boolean; topLevelFields: string[] | null;
  consumer?: { kind: string; verdict?: string; parsed?: boolean; memory?: boolean | null;
    cancelReminders?: { id: string; quote: string }[] | null } };
const live = JSON.parse(readFileSync(new URL('./fixtures/summary-object-flat-live-2026-10-04.json', import.meta.url), 'utf8')) as {
  source: string; model: string; calls: Call[];
  passes: { pass: string; summaryThrough: number | null; lastSummaryFailure: { through: number; reason: string } | null;
    memoryUndecided: boolean; reminderCancels: number; sent: string | null }[] };
/** cint-L50's own real-model replay of the flat answer protocol (plan #491): the recorded shapes it produced. */
const flat = JSON.parse(readFileSync(new URL('./fixtures/answer-flat-live-2026-10-04.json', import.meta.url), 'utf8')) as {
  tasks: { label: string; call: string; output: string }[] };
const task = (call: string) => flat.tasks.find(item => item.call === call)!;

const REVIEW_ID = 'summary:715673532:review';
const WRITER_ID = 'summary:715673532';

/** The recorded shape itself, byte for byte: the real model wrote the review's object as escaped JSON text. */
it('reads the recorded real-model review verdict that was written as JSON text inside "answer"', () => {
  const recorded = task(REVIEW_ID).output;
  // What the model wrote: `answer` holding a JSON string, not the verdict's own fields.
  const top = JSON.parse(recorded) as { reasoning?: unknown; answer?: unknown };
  expect(Object.keys(top)).toEqual(['reasoning', 'answer']);
  expect(typeof top.answer).toBe('string');
  expect(String(top.answer).trim().startsWith('{')).toBe(true);

  const reading = readAnswer(recorded, { wrapped: 'refuse', evidence: [REVIEW_ID], object: true });
  if (!reading.ok) throw Error(reading.defect);
  // The runner serialized it: what the consumer parses is the runner's JSON, not the model's bytes.
  expect(reading.objectAsText).toBe(true);
  expect(reading.value).toBe(JSON.stringify(JSON.parse(String(top.answer))));
  expect(interpretSummaryReview({ state: 'complete', value: reading.value }, 1))
    .toMatchObject({ verdict: 'pass', path: 'subscription' });
});

/** The same recorded shape with one brace misplaced -- the live `not-json` verdict -- is a NAMED defect now,
 * not text handed on to be swallowed by a consumer's empty catch. */
it('names the defect when the answer object written as text is not one complete object', () => {
  const recorded = JSON.parse(task(REVIEW_ID).output) as { reasoning: string; answer: string };
  const slipped = JSON.stringify({ reasoning: recorded.reasoning, answer: recorded.answer.slice(0, recorded.answer.lastIndexOf('}')) });
  const reading = readAnswer(slipped, { wrapped: 'refuse', evidence: [REVIEW_ID], object: true });
  expect(reading.ok).toBe(false);
  if (reading.ok) throw Error('expected a defect');
  expect(reading.defect).toContain(OBJECT_AS_TEXT_DEFECT);
  // The inner text's own defect is named too, so one re-ask can correct exactly that.
  expect(reading.defect).toContain('"{" ');
  expect(reading.shape).toBe('truncated');
  // The consumer still refuses, retryably, exactly as it did live.
  expect(interpretSummaryReview({ state: 'complete', failureClass: 'malformed' }, 1))
    .toMatchObject({ verdict: 'unavailable', retryable: true });
});

/** The flat form is untouched: the recorded real-model summary writer, and this branch's own live runs. */
it('leaves a flat object answer exactly as it was', () => {
  for (const [id, output] of [[WRITER_ID, task(WRITER_ID).output] as const,
    ...live.calls.filter(call => !call.recorded && call.output !== undefined).map(call => [call.id, call.output!] as const)]) {
    const wrapped = id.endsWith(':review') ? 'refuse' as const : 'accept' as const;
    const plain = readAnswer(output, { wrapped, evidence: [id] });
    const asObject = readAnswer(output, { wrapped, evidence: [id], object: true });
    if (!plain.ok || !asObject.ok) throw Error(`${id}: ${plain.ok ? '' : plain.defect}${asObject.ok ? '' : asObject.defect}`);
    expect(asObject.value).toBe(plain.value);
    expect(asObject.objectAsText).toBeUndefined();
    expect(asObject.envelope).toBe('flat');
  }
});

/** A plain-prose summary is a tolerated answer, not a defect: `object` only reads a string that opens with `{`. */
it('leaves a prose answer alone', () => {
  const prose = JSON.stringify({ reasoning: 'one sentence', answer: 'The operator asked for two reminders.' });
  const reading = readAnswer(prose, { wrapped: 'accept', evidence: [WRITER_ID], object: true });
  if (!reading.ok) throw Error(reading.defect);
  expect(reading.value).toBe('The operator asked for two reminders.');
  expect(reading.objectAsText).toBeUndefined();
});

/** Both questions now ask for the enforced form, and the real model answered it on every live call. */
it('asks for the object\'s own fields, and the real model wrote them that way', () => {
  expect(live.calls.filter(call => !call.recorded).length).toBeGreaterThan(5);
  for (const call of live.calls) {
    expect(call.ok).toBe(true);
    expect(call.envelope).toBe('flat');
    expect(call.objectAsText).toBe(false);
    expect(call.topLevelFields).not.toBeNull();
    // No call wrote the old envelope's fields, and none wrote its answer object as text.
    expect(call.topLevelFields!.includes('type')).toBe(false);
    expect(call.topLevelFields!.includes('answer')).toBe(false);
  }
  for (const call of live.calls.filter(item => item.id.endsWith(':review')))
    expect(call.topLevelFields).toEqual(['reasoning', 'verdict', 'reason']);
});

/** The withdrawal the recorded shape carried is read now, and it is the shape the real model writes. */
it('reads the withdrawal the real model wrote in the summary, and the live runs recorded it', () => {
  // The recorded 2026-10-02 live output, and every real-model run that volunteered the field, wrote {id, quote}.
  const quoted = live.calls.filter(call => Array.isArray(call.consumer?.cancelReminders));
  expect(quoted.length).toBeGreaterThan(2);
  for (const call of quoted)
    for (const item of call.consumer!.cancelReminders!) {
      expect(typeof item.id).toBe('string');
      expect('Actually, cancel the bird feeder one.').toContain(item.quote);
    }
  // On the live retry shape -- the recorded failing output first, then a real second attempt -- the cancel landed.
  const retries = live.passes.filter(pass => pass.pass.endsWith('-retry'));
  expect(retries.length).toBeGreaterThan(1);
  expect(retries.some(pass => pass.reminderCancels === 1 && !pass.memoryUndecided)).toBe(true);
  // And no pass ended with the fixed notice the live build sent.
  for (const pass of live.passes.filter(item => item.reminderCancels === 1))
    expect(pass.sent).not.toContain(MEMORY_UNDECIDED_REPLY);
});

/** What the summary is asked, and how its answer is read, both changed: a span an older format exhausted
 * may be tried again, so the live root stuck at 2026-10-04 is not braked by its own failures. */
it('counts as a changed summary format', () => {
  expect(SUMMARY_FORMAT).toBe(4);
});

// ---- The offline end-to-end shape: the withdrawal lands from the summary side, in this branch's own worker. ----
const key = new Uint8Array(32).fill(79);
const START = Date.UTC(2026, 9, 4, 18, 0);
const DUE = Date.UTC(2026, 9, 4, 18, 16);
const FEEDER = 'Remind me today at 11:16 am to refill the bird feeder';
const PLUMBER = 'Also remind me today at 11:16 am to call the plumber';
const CANCEL = 'Actually, cancel the bird feeder one.';
const genesis = { kind: 'genesis' as const, bot: '8994258214', chat: '7812716706', operator: '7812716706',
  grant: 'grant:summary-object', configurationDigest: 'sha256:summary-object', expires: Date.UTC(2026, 9, 11),
  maxCalls: 200, maxReplies: 100, maxTurns: 60, maxBytes: 40000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text,
    date: Math.floor(START / 1000) + id * 60 } });
type Input = { id: string; question: string; context: string };
type Reminder = { id: string; quote: string; due: string };
const reminders = (input: Input) => (JSON.parse(input.context) as { reminders?: Reminder[] }).reminders ?? [];
const memoryRequest = (input: Input) =>
  (JSON.parse(input.context) as { memoryRequest?: { message: string } }).memoryRequest?.message;

/** `summaryCancel` writes the summary's withdrawal in the shape the real model writes it. */
function world(root: string, summaryCancel: (input: Input) => unknown, clock = { now: START }) {
  const sent: string[] = [];
  let attempts = 0;
  const ports = { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => {
      if (input.id.startsWith('summary:')) {
        attempts++;
        const base = { summary: 'The operator asked for two reminders and then withdrew one.', people: [],
          personAttributes: [], commitments: [], closed: [], questions: [], memory: [] };
        // The first attempt is the recorded live shape: no `memory` at all, so the trigger becomes
        // memory-pending and the second attempt is the one asked for `cancelReminders` (the live retry).
        if (memoryRequest(input) === CANCEL && attempts === 1)
          return JSON.stringify({ reply: base.summary, people: [], commitments: [] });
        return JSON.stringify(memoryRequest(input) === CANCEL
          ? { ...base, cancelReminders: summaryCancel(input) } : base);
      }
      const text = input.question;
      return text.startsWith('Remind me') || text.startsWith('Also remind me')
        ? JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: text, when: 'today at 11:16 am', remind: true }] })
        // The answer side decides nothing here, so only the summary's reading can land the withdrawal.
        : JSON.stringify({ reply: 'Noted.', memory: [], dated: [], cancelReminders: [] });
    },
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  return { journal, worker: createJournalWorker(journal, ports), sent };
}
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-summaryobject-${name}-`)));
const pushes = (sent: string[]) => sent.filter(text => text.startsWith('You asked on'));

const drive = async (w: ReturnType<typeof world>) => {
  let id = 1;
  for (const text of [FEEDER, PLUMBER]) { w.worker.intake([update(id++, text)]); await w.worker.drain(); }
  expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([FEEDER, PLUMBER]);
  w.worker.intake([update(id, CANCEL)]);
  await w.worker.drain(); await w.worker.drain();
};

it('records the withdrawal the summary wrote as {id, quote}, and the request it did not name still fires', async () => {
  const root = tmp('quoted');
  try {
    const clock = { now: START };
    const w = world(root, input => reminders(input).filter(item => item.quote.includes('bird feeder'))
      .map(item => ({ id: item.id, quote: 'cancel the bird feeder one' })), clock);
    await drive(w);
    expect(w.journal.view.reminderCancels).toHaveLength(1);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([PLUMBER]);
    expect(w.sent.at(-1)!).not.toContain(MEMORY_UNDECIDED_REPLY);
    clock.now = DUE;
    await w.worker.drain(); await w.worker.sendRequested(); await w.worker.sendRequested();
    expect(pushes(w.sent)).toHaveLength(1);
    expect(pushes(w.sent)[0]).toContain('call the plumber');
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

it('still reads a bare offered id, the form an older build asked for', async () => {
  const root = tmp('bare');
  try {
    const w = world(root, input => reminders(input).filter(item => item.quote.includes('bird feeder')).map(item => item.id));
    await drive(w);
    expect(w.journal.view.reminderCancels).toHaveLength(1);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([PLUMBER]);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

/** The other side of the decision boundary: a withdrawal whose quote is not the operator's own words is
 * refused, and nothing is cancelled. The agent's own sentence can never be the evidence (Rules 57, 93). */
it('refuses a withdrawal whose quote is not copied from the operator\'s message', async () => {
  const root = tmp('unquoted');
  try {
    const w = world(root, input => reminders(input).filter(item => item.quote.includes('bird feeder'))
      .map(item => ({ id: item.id, quote: 'I have cancelled that for you' })));
    await drive(w);
    expect(w.journal.view.reminderCancels).toHaveLength(0);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([FEEDER, PLUMBER]);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

/** And an id this packet never offered is refused the same way. */
it('refuses a withdrawal naming an id the packet did not offer', async () => {
  const root = tmp('unlisted');
  try {
    const w = world(root, () => [{ id: 'reminder-0000000000', quote: 'cancel the bird feeder one' }]);
    await drive(w);
    expect(w.journal.view.reminderCancels).toHaveLength(0);
    expect(openRequests(w.journal.view).map(item => item.quote)).toEqual([FEEDER, PLUMBER]);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);
