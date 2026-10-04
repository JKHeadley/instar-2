// Plan #510 (cint-L50 repair 2): every runner task that asks the model for a structured result names its object and
// the model writes that object's fields beside `reasoning`; the runner assembles them (answer-reading.ts) and keeps
// every check of its own. Read against the REAL recorded shapes of the pre-switch run that failed (I1b, D1b) and
// against real replays of the recorded inputs on this tree's wording (fixture `runner-task-protocol-live-2026-10-04`).
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readAnswer, taskFields } from './answer-reading.js';
import { obligationDecision, OBLIGATION_WORK_QUESTION, OBLIGATION_WORK_QUESTION_TOOLS } from './journal.js';
import { RETRO_DUTY_FOLLOWUP_QUESTION, RETRO_REASONING_CHARS, RETROSPECTIVE_QUESTION } from './retrospective.js';
import { parseReplyReviewVerdict, replyReviewQuestion, replyRevisionQuestion, type ReplyRule } from './reply-check.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';

type Shape = { output: string };
const fixture = JSON.parse(readFileSync(resolve('tests/preview/fixtures/runner-task-protocol-live-2026-10-04.json'), 'utf8')) as {
  live: Record<'obligationFenced' | 'obligationProse' | 'summaryAsReply' | 'summaryAnswerBeside' | 'replyReviewFieldsBroken', Shape>;
  replayed: Record<'obligationDeferral' | 'obligationDirective' | 'summary' | 'summaryReview' | 'retrospective', Shape & { outputTokens: number }>
    & { replyReview: Shape & { outputTokens: number; rules: ReplyRule[] } } };
// The protocol's own opening sentence, taken from the one instruction function rather than restated here.
const MARK = taskFields('{}').split(' Return ')[0]!;
const read = (text: string, wrapped: 'accept' | 'refuse') => readAnswer(text, { wrapped, evidence: ['test'] });

it('reads the live obligation step that prose and a fence wrapped, which failed the deferral work (D1b), and only on the answer side', () => {
  const { output } = fixture.live.obligationFenced;
  // The recorded shape: prose quoting `"tools":[]`, then a ```json fence around the flat object.
  expect(output).toContain('`"tools":[]`');
  expect(output).toContain('```json');
  const accepted = read(output, 'accept');
  expect(accepted).toMatchObject({ ok: true, shape: 'fenced', envelope: 'flat' });
  if (!accepted.ok) throw Error('unreachable');
  expect(obligationDecision(accepted.value, 'commitment', 0, 'UTC')).toMatchObject({ outcome: 'continue' });
  // A gate keeps the narrow reading: the same text is refused there.
  expect(read(output, 'refuse').ok).toBe(false);
  // The prose-wrapped shape that already read keeps reading.
  const prose = read(fixture.live.obligationProse.output, 'accept');
  expect(prose).toMatchObject({ ok: true, shape: 'prose-wrapped' });
});

it('still refuses a wrapped object that is not the protocol\'s, one written as a list element, and two objects', () => {
  // No `reasoning`, `answer` or `reply`: some other object quoted in prose is never taken for the answer.
  expect(read('I considered `"x":[]` and wrote {"outcome":"report","report":"Done."}', 'accept').ok).toBe(false);
  // k6's list rule: an object written as a list element may be one of many.
  expect(read('Here: [{"reasoning":"r","answer":"a"}]', 'accept').ok).toBe(false);
  // Two complete objects inside bracketed prose: neither alone is what the model decided.
  expect(read('First `[]` {"reasoning":"a","answer":"x"} then {"reasoning":"b","answer":"y"}', 'accept').ok).toBe(false);
  // The same flat object with `reasoning`, fenced inside bracketed prose, reads.
  expect(read('Checked `[]`.\n```json\n{"reasoning":"r","outcome":"report","report":"Done."}\n```', 'accept')).toMatchObject({ ok: true, shape: 'fenced' });
});

it('keeps refusing the live summary attempts that mixed the conversation protocol into a runner task', () => {
  // Attempt 2 wrote the summary as JSON text inside "answer", beside "reply" and "openLoops": refused, defect named.
  const beside = read(fixture.live.summaryAnswerBeside.output, 'accept');
  expect(beside).toMatchObject({ ok: false });
  if (beside.ok) throw Error('unreachable');
  expect(beside.defect).toContain('"answer" was written beside other fields');
  // Attempt 1 answered the task as a reply: it reads as an object, and the summary's own check refuses it (no summary).
  const asReply = read(fixture.live.summaryAsReply.output, 'accept');
  if (!asReply.ok) throw Error('expected an object');
  expect(Object.keys(JSON.parse(asReply.value) as object)).not.toContain('summary');
});

it('reads a reply review\'s verdicts written as one field per rule, and refuses a dropped, added or malformed rule', () => {
  const { output, rules } = fixture.replayed.replyReview;
  const reading = read(output, 'refuse');
  if (!reading.ok) throw Error(reading.defect);
  const verdict = parseReplyReviewVerdict(reading.value, rules);
  expect(verdict.verdict).toBe('violation');
  expect(verdict.findings?.map(finding => finding.rule).sort()).toEqual([...rules].sort());
  const fields = JSON.parse(reading.value) as Record<string, string>;
  // The other side: a missing selected rule, a key that is no rule, and a value without its verdict are format misses.
  const { quits_on_self: _dropped, ...missing } = fields;
  expect(() => parseReplyReviewVerdict(JSON.stringify(missing), rules)).toThrow('malformed');
  expect(() => parseReplyReviewVerdict(JSON.stringify({ ...fields, verdict: 'PASS | fine' }), rules)).toThrow('malformed');
  expect(() => parseReplyReviewVerdict(JSON.stringify({ ...fields, quits_on_self: 'looks fine' }), rules)).toThrow('malformed');
  // The legacy lines in "answer" are still read.
  expect(parseReplyReviewVerdict('raw_path: PASS | no path', ['raw_path'])).toMatchObject({ verdict: 'pass' });
  // The live review of the d1 reply wrote the same fields with an unescaped quote: refused, as before.
  expect(read(fixture.live.replyReviewFieldsBroken.output, 'refuse').ok).toBe(false);
});

it('reads every replayed runner task on this tree\'s wording, inside the output cap (Rule 106)', () => {
  const { obligationDeferral, obligationDirective, summary, summaryReview, retrospective } = fixture.replayed;
  for (const [name, shape, wrapped] of [['obligationDeferral', obligationDeferral, 'accept'], ['obligationDirective', obligationDirective, 'accept'],
    ['summary', summary, 'accept'], ['summaryReview', summaryReview, 'refuse'], ['retrospective', retrospective, 'refuse']] as const) {
    const reading = read(shape.output, wrapped);
    expect(reading, name).toMatchObject({ ok: true, shape: 'bare', envelope: 'flat' });
    expect(shape.outputTokens, name).toBeLessThanOrEqual(2048);
  }
  const deferral = read(obligationDeferral.output, 'accept');
  if (!deferral.ok) throw Error('unreachable');
  // With packet.memory the deferred judgment is done, not "continue: the context lacks the history".
  expect(obligationDecision(deferral.value, 'commitment', 0, 'UTC')).toMatchObject({ outcome: 'report' });
  const retro = read(retrospective.output, 'refuse');
  if (!retro.ok) throw Error('unreachable');
  // The live pass spent 2964 characters on reasoning and ran over the cap; the bounded one fits.
  expect(Array.from(retro.reason).length).toBeLessThanOrEqual(RETRO_REASONING_CHARS + 40);
  expect(Object.keys(JSON.parse(retro.value) as object)).toEqual(expect.arrayContaining(['inspected', 'omitted', 'uninspected', 'wells', 'eff']));
  const verdict = read(summaryReview.output, 'refuse');
  if (!verdict.ok) throw Error('unreachable');
  expect(JSON.parse(verdict.value)).toMatchObject({ verdict: 'pass' });
});

it('asks every runner task for its object through the one field protocol, never for JSON text', () => {
  const rules: ReplyRule[] = ['raw_path', 'unrecorded_blocker'];
  for (const question of [OBLIGATION_WORK_QUESTION, OBLIGATION_WORK_QUESTION_TOOLS, RETROSPECTIVE_QUESTION, RETRO_DUTY_FOLLOWUP_QUESTION,
    replyReviewQuestion(rules), replyRevisionQuestion(rules)]) {
    expect(question).toContain(MARK);
    expect(question).not.toMatch(/Return only JSON|Return one JSON object|answer text one JSON object|Return as "answer"/u);
  }
  expect(RETROSPECTIVE_QUESTION).toContain(`at most ${String(RETRO_REASONING_CHARS)} characters`);
  // The summary writer, its index ask and the summary review are built inside the worker and the launcher: their
  // sources carry the same call and no hand-written JSON ask (a ratchet over the whole runner side).
  const sources = ['tests/preview/journal.ts', 'tests/preview/journal-agent.mjs', 'tests/preview/retrospective.ts', 'tests/preview/reply-check.ts']
    .map(path => readFileSync(resolve(path), 'utf8'));
  for (const source of sources) expect(source).not.toMatch(/'Return only JSON|Return one JSON object|Make your answer text one JSON object/u);
  expect(sources[0]!.match(/taskFields\(/gu)?.length).toBeGreaterThanOrEqual(3);
  expect(sources[1]).toContain("taskFields('{\"verdict\":\"pass\"|\"violation\",\"reason\":string}'");
  expect(taskFields('{"a":1}', 10)).toContain('at most 10 characters');
});

it('tells the tool route, which carries the harness\'s own account email, that the login is never the operator', () => {
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain('is the subscription login running you, never the operator');
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain('packet.audience.operatorName');
  // The text-only route runs with --safe-mode and carries no such block, so its prompt is unchanged.
  expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).not.toContain('subscription login');
});
