/** The flat answer protocol (plan #491, w4-answertrunc2): the model stops hand-writing the nested Decision envelope.
 *
 * Live cint-L47, group A in room one (A-proofroom-20261004-033626, root proofroom1-q-20261004-033411): a1 and a3 got
 * the fixed failure reply on both attempts, and a5's promise was never recorded. Every one completed normally (about
 * 55% of the 2048-token cap); none was cut off. Each time the model misplaced one brace or quote in the envelope:
 * `conclusion` never closed, so the floor echo landed inside it (a1, a3); `"schemaVersion:1,` (715673556, 715673558);
 * and `promises` written beside `conclusion.value`, where nothing reads it (a5). w4-answerfail had fixed two other
 * slips of the same envelope a day earlier. None of those fields carried anything the model decides.
 *
 * Every case below replays recorded bytes (Rule 106): the refused live outputs verbatim, the REAL model's outputs on
 * the same recorded stdin envelopes under this branch's system prompt (scripts/answer-flat-live-model-run.mjs), and
 * the older prose-with-brackets answers w4-answerfail left refused. Both sides of each new reading are proved. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAnswer } from './answer-reading.js';
import { escapeRawControls, parseModelJson } from './model-json.js';
import { answerFormatReminder, ANSWER_FORMAT_REMINDER, createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { parseReplyReviewVerdict, type ReplyRule } from './reply-check.js';
import { promiseProposals } from './agent-commitment.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_NATIVE_SYSTEM_PROMPT, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { CODEX_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-codex-provider.js';

type Recorded = { label: string; update: number; attempt: string; recordedShape: string; outputTokens: number | null; output: string };
type Replayed = { label: string; id: string; attempt: string; outputTokens: number | null; output: string };
type Task = { label: string; call: string; outputTokens: number | null; output: string };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/answer-flat-live-2026-10-04.json', import.meta.url), 'utf8')) as {
  recorded: Recorded[]; replayed: Replayed[]; tasks: Task[]; rawControl: Replayed[]; older: { id: string; recordedShape: string; output: string }[] };
const recorded = (label: string) => fixture.recorded.find(item => item.label === label)!;
const replayed = (label: string) => fixture.replayed.find(item => item.label === label)!;
const answer = (raw: string, id = 'telegram:8994258214:update:1') => readAnswer(raw, { wrapped: 'accept', evidence: [id] });

it('the four a1/a3 failures were complete, uncut outputs well inside the cap, refused for a misplaced brace', () => {
  for (const label of ['a1-1', 'a1-2', 'a3-1', 'a3-2']) {
    const item = recorded(label);
    expect(item.outputTokens).toBeGreaterThan(1000);
    expect(item.outputTokens).toBeLessThan(2048 * 0.65);
    // The full reply and the floor echo are both there; the text simply ends one "}" short.
    expect(item.output).toMatch(/"\},"floor":\{"allowed":\["work"\],"chosen":"work"\}\}$/u);
    const reading = answer(item.output);
    expect(reading).toMatchObject({ ok: false, shape: 'truncated' });
    if (reading.ok) throw Error('accepted');
    // The format re-ask now names that exact defect instead of only "format".
    expect(reading.defect).toBe('the JSON object never closes: at the end 1 "{" is still open, so a "}" is missing or a quote is misplaced');
    expect(answerFormatReminder(reading.defect)).toBe(`${ANSWER_FORMAT_REMINDER} The defect: ${reading.defect}.`);
  }
  expect(answer(recorded('g556-1').output)).toMatchObject({ ok: false, shape: 'truncated' });
  expect(answer(recorded('g558-1').output)).toMatchObject({ ok: false, shape: 'prose-wrapped',
    defect: 'the JSON object is not valid JSON inside: an unescaped " inside a string, or a missing comma or colon' });
  expect(answerFormatReminder()).toBe(ANSWER_FORMAT_REMINDER);
});

it('the real model, given the recorded a1/a3 envelopes (both attempts) under the flat protocol, answers in a readable object', () => {
  const a1 = ['a1-1', 'a1-2'].map(label => answer(replayed(label).output));
  const a3 = ['a3-1', 'a3-2'].map(label => answer(replayed(label).output));
  for (const reading of [...a1, ...a3]) expect(reading).toMatchObject({ ok: true, envelope: 'flat' });
  for (const reading of a1) if (reading.ok) expect(reading.value).toMatch(/judgment/iu);
  for (const reading of a3) if (reading.ok) expect(reading.value).toMatch(/commitment/iu);
  // The model reasons in `reasoning`, which the runner keeps beside the conclusion (Rule 108).
  for (const reading of [...a1, ...a3]) if (reading.ok) expect(reading.reason.length).toBeGreaterThan(40);
});

it('every replayed real-model output reads, including the w4-answerfail incident inputs', () => {
  expect(fixture.replayed).toHaveLength(14);
  const readings = fixture.replayed.map(item => [item.label, answer(item.output, item.id)] as const);
  for (const [, reading] of readings) expect(reading).toMatchObject({ ok: true, shape: 'bare', envelope: 'flat' });
  const value = (label: string) => { const found = readings.find(([name]) => name === label)![1]; return found.ok ? found.value : ''; };
  expect(value('p1-1')).toMatch(/^Yes, I'm here/u);
  expect(value('p1-2')).toMatch(/^Yes, I'm here/u);
  for (const label of ['d6232026-1', 'd6232026-2']) {
    // The standing instruction is declared either as a directive or as a preference memory; both quote the operator.
    const parsed = JSON.parse(value(label)) as { reply: string; directives?: { quote: string }[]; memory?: { quote: string }[] };
    expect(parsed.reply).toMatch(/— K/u);
    expect([...parsed.directives ?? [], ...parsed.memory ?? []][0]!.quote).toMatch(/end every shopping list you write for me with "— K"/u);
  }
  // A plain reply stays plain text (no decision recorded); a reply with fields stays the {reply, ...} object.
  expect(value('g558-1')).toBe('Logged — garden log 21 noted, peppers all steady. Nothing needed from me.');
  expect(JSON.parse(value('g556-1'))).toEqual({ reply: 'Logged — garden log 19 noted, squash all steady. Nothing needed from me.' });
});

it('a raw line break inside a JSON string (2 of 14 first-pass real outputs) is read as its escape; nothing else changes', () => {
  for (const item of fixture.rawControl) {
    const raw = item.output;
    expect(() => JSON.parse(raw)).toThrow();
    expect(raw).toMatch(/[^\\]\n/u);
    const reading = answer(raw);
    expect(reading).toMatchObject({ ok: true, shape: 'raw-control' });
    // A gate reads it too: writing the escape discards nothing, so no fail direction is involved.
    expect(readAnswer(raw)).toMatchObject({ ok: true, shape: 'raw-control' });
    if (reading.ok) expect(reading.value).toContain('\n');
  }
  // Only characters inside a string inside an object change; prose and structure stay byte for byte.
  expect(escapeRawControls('note\n{"a":"x\ty",\n"b":1}\nend')).toBe('note\n{"a":"x\\ty",\n"b":1}\nend');
  expect(escapeRawControls('{"a":"\u0001"}')).toBe('{"a":"\\u0001"}');
  expect(parseModelJson('{"a":"one\ntwo"}')).toEqual({ ok: true, value: { a: 'one\ntwo' }, shape: 'raw-control' });
  // A string that is already escaped is left alone.
  expect(parseModelJson('{"a":"one\\ntwo"}')).toEqual({ ok: true, value: { a: 'one\ntwo' }, shape: 'bare' });
});

const key = new Uint8Array(32).fill(41);
const now = 1791110489569;
const genesis = { kind: 'genesis' as const, bot: '8994258214', chat: '7812716706', operator: '7812716706',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 409600, cursor: 0 };
const A5 = 'Please promise that in your next reply you will give me three tips for watering my tomato plants. Do not give the tips now; just say you will.';
/** a5 through the real worker, answered with what the launcher's reader makes of one recorded output. */
async function promiseOf(raw: string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-flat-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, prepareModel: input => input.context,
      model: async () => { const reading = answer(raw); if (!reading.ok) throw Error('refused'); return reading.value; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([{ update_id: 715673531, message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text: A5,
      date: Math.floor(now / 1000) } }]);
    await worker.drain();
    const promises = journal.view.commitments.filter(note => note.agentPromise !== undefined).map(note => note.agentPromise!.quote);
    const intent = journal.view.order.at(-1)?.intent;
    journal.close();
    return { promises, intent };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('a5: the recorded answer put promises beside conclusion.value and none was recorded; the flat answer records it', async () => {
  const before = await promiseOf(recorded('a5-1').output);
  expect(before.intent).toMatch(/^PREVIEW — Deal — I promise that in my next reply I will give you three tips/u);
  expect(before.promises).toEqual([]); // check A5a FAILED live for exactly this
  expect((JSON.parse(recorded('a5-1').output) as { conclusion: { promises?: unknown } }).conclusion.promises).toBeDefined();
  const after = await promiseOf(replayed('a5-1').output);
  expect(after.intent).toMatch(/^PREVIEW — Got it — in my next reply, I'll give you three tips for watering your tomato plants\./u);
  expect(after.promises).toEqual(["Got it — in my next reply, I'll give you three tips for watering your tomato plants."]);
});

it('a promise whose optional when is null is read without a date; any other non-text when still refuses the list', () => {
  const reply = "Got it — in my next reply, I'll give you three tips.";
  expect(promiseProposals([{ quote: reply, when: null }], reply)).toEqual([{ quote: reply }]);
  for (const when of [5, '', 'Friday', { day: 'x' }]) expect(promiseProposals([{ quote: reply, when }], reply), String(when)).toBeUndefined();
});

it('the runner tasks answer in the flat object too, and each consumer reads it (real reviews, revision, summary, summary review)', () => {
  expect(fixture.tasks).toHaveLength(7);
  for (const task of fixture.tasks) {
    const gate = task.call.endsWith('review');
    const reading = readAnswer(task.output, { wrapped: gate ? 'refuse' : 'accept', evidence: [task.call] });
    expect(reading, task.label).toMatchObject({ ok: true, shape: 'bare', envelope: 'flat' });
    if (!reading.ok) continue;
    if (task.call.endsWith(':reply-review')) {
      const rules: ReplyRule[] = task.call.includes('715673531') ? ['parks_on_user', 'defers_work', 'unrecorded_blocker', 'self_state_claim', 'breaks_preference']
        : ['credential', 'self_state_claim', 'breaks_preference'];
      const verdict = parseReplyReviewVerdict(reading.value, rules);
      // The same verdicts the recorded reviews reached: the open promise is an unrecorded deferral; the code echo passes.
      expect(verdict.ruleIds, task.label).toEqual(task.call.includes('715673531') ? ['defers_work'] : []);
    } else if (task.call.endsWith(':reply-revision')) expect(Object.keys(JSON.parse(reading.value))).toEqual(expect.arrayContaining(['reply', 'dispositions']));
    else if (task.call.endsWith(':review')) expect(JSON.parse(reading.value)).toMatchObject({ verdict: expect.stringMatching(/^(pass|violation)$/u), reason: expect.any(String) });
    else expect(JSON.parse(reading.value)).toHaveProperty('summary');
  }
});

it('the runner builds the Decision: the floor is its own, a floor the model still writes may only echo it', () => {
  const flat = (extra: Record<string, unknown>) => JSON.stringify({ reasoning: 'r', answer: 'Hello.', ...extra });
  expect(answer(flat({}))).toMatchObject({ ok: true, value: 'Hello.', reason: 'r', envelope: 'flat' });
  expect(answer(flat({ floor: { allowed: ['work'], chosen: 'work' } }))).toMatchObject({ ok: true, value: 'Hello.' });
  for (const floor of [{ allowed: ['work', 'send'], chosen: 'send' }, { allowed: ['work'], chosen: 'send' }, {}])
    expect(answer(flat({ floor }))).toMatchObject({ ok: false, defect: '"floor" differs from the local floor; leave it out, the runner supplies it' });
  // Fields the runner supplies are dropped, never passed on as answer fields.
  expect(answer(JSON.stringify({ reasoning: 'r', id: 'x', at: 1, evidence: ['e'], reply: 'Hi.', memory: [] })))
    .toMatchObject({ ok: true, value: '{"reply":"Hi.","memory":[]}' });
  // A task's own `reason` field is an answer field (the summary review's {verdict, reason}).
  expect(readAnswer(JSON.stringify({ reasoning: 'r', verdict: 'pass', reason: 'faithful' })))
    .toMatchObject({ ok: true, value: '{"verdict":"pass","reason":"faithful"}' });
  expect(answer(JSON.stringify({ reasoning: 'r' }))).toMatchObject({ ok: false, shape: 'bare-wrong-fields' });
  expect(answer(JSON.stringify({ reasoning: 'r', answer: 'x', memory: [] }))).toMatchObject({ ok: false });
  expect(answer(JSON.stringify({ reasoning: 'r', answer: [1] }))).toMatchObject({ ok: false, defect: 'the answer is neither text nor a JSON object' });
  expect(answer(JSON.stringify({ reasoning: 'r', conclusion: { value: 'x' } }))).toMatchObject({ ok: false });
  // A legacy Decision is read through the same check: the subject and floor still decide.
  const legacy = { type: 'Decision', conclusion: { subject: 'preview-stage2-answer', value: 'Old.' }, floor: { allowed: ['work'], chosen: 'work' } };
  expect(answer(JSON.stringify(legacy))).toMatchObject({ ok: true, value: 'Old.', envelope: 'decision' });
  expect(answer(JSON.stringify({ ...legacy, conclusion: { subject: 'other', value: 'Old.' } }))).toMatchObject({ ok: false });
  expect(answer(JSON.stringify({ ...legacy, floor: { allowed: ['work', 'x'], chosen: 'x' } }))).toMatchObject({ ok: false });
});

it('answer side: prose that carries brackets is discarded only around exactly one parseable answer object; gates keep refusing', () => {
  const readings = fixture.older.map(item => [item, answer(item.output, item.id), readAnswer(item.output)] as const);
  expect(readings.filter(([, reading]) => reading.ok)).toHaveLength(9);
  for (const [, , gate] of readings) expect(gate.ok).toBe(false);
  // The one still refused is the old envelope written invalid inside, not prose.
  const refused = readings.filter(([, reading]) => !reading.ok).map(([item]) => item.id);
  expect(refused).toEqual(['telegram:8989505249:update:6230999']);
  const draft = '{"reply":"draft"}';
  expect(answer(`I considered ${draft} and dated:[] then: {"reasoning":"r","reply":"Final."}`)).toMatchObject({ ok: false });
  expect(answer('Looking at [withheld] {reply, dated:[]} so: {"reasoning":"r","answer":"Final."}')).toMatchObject({ ok: true, value: 'Final.' });
  expect(answer('A list [{"verdict":"pass"}]')).toMatchObject({ ok: false });
  // k6's list rule stands: an answer object written as a list element may be one of many, so it is refused.
  expect(answer('Looking at dated:[] first. [{"reasoning":"r","answer":"Final."}]')).toMatchObject({ ok: false });
  expect(answer('Looking at dated:[] first. [ {"reasoning":"r","answer":"Final."}')).toMatchObject({ ok: false });
});

it('every conversation prompt carries the flat protocol and none still asks the model for the envelope', () => {
  for (const prompt of [SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT, SUBSCRIPTION_NATIVE_SYSTEM_PROMPT, CODEX_CONVERSATION_SYSTEM_PROMPT]) {
    expect(prompt).toContain('Respond with one flat JSON object');
    expect(prompt).toContain('never write type, conclusion, evidence or floor');
    expect(prompt).not.toMatch(/reason\.value|conclusion\.value|<answer>|\{\\?"type\\?":\\?"Decision/u);
  }
});
