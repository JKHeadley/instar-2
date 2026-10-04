// Plan #485. Live 2026-10-04, proof room one (A-proofroom-20261004-033626, root
// proofroom1-q-20261004-033411, runner commit c0b57925): both answer attempts of update 715673529
// ("…which wins, and is there anything code decides without you?") and of update 715673530 ("What
// commitments do I have?") were counted answer/decision/malformed/truncated, and the operator read
// "I couldn't produce an answer to that. Please rephrase or ask again." Those four calls all ended
// `complete` at 1262, 1171, 1108 and 1157 output tokens against the conversation policy's 2048 bound,
// in 17-26 s against its 120 s timeout, and the 1231-token answer of update 715673533 in the same room
// parsed and sent — so no cap and no timeout cut them off. What `truncated` actually reports is the
// brace scan ending with a brace still open, which a COMPLETE response does whenever the text around
// its object leaves one unclosed. Those four responses' own bytes are in that root's encrypted journal,
// which this machine cannot read; the replays below use recorded real bytes carrying each shape.
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import { ANSWER_FORMAT_REMINDER, answerFormatReminder } from './journal.js';
import { decisionWithinFloor } from './model-call-boundary.js';
import { failureShapeOf, parseModelJson, type ModelJsonSole } from './model-json.js';

/** The launcher's own identity test (journal-agent.mjs previewAnswerDecision), kept in step here. */
const sole: ModelJsonSole = value => value.type === 'Decision'
  && (value.conclusion as { subject?: unknown } | undefined)?.subject === 'preview-stage2-answer';
const answer = (raw: string) => parseModelJson(raw, { wrapped: 'accept', sole });
const gate = (raw: string) => parseModelJson(raw);
/** What the launcher does with an accepted object: the same two field checks, then the floor (Rule 57). */
const accepted = (raw: string) => {
  const read = answer(raw);
  if (!read.ok || !sole(read.value) || !decisionWithinFloor(read.value as never)) return null;
  return (read.value.conclusion as { value?: unknown }).value;
};

const file = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as Record<string, unknown>;
/** Two real claude-sonnet-5 answers of 2026-10-03 (room two, RA3): each reasons in prose that itself writes
 * `cancelReminders:[]`, so the residual bracket test refused the Decision they did write. The class w4-answerfail
 * recorded as not fixed there, now ruled on. */
const PROSE = (file('cancel3-live-2026-10-03.json').answerOutputsAtRa3 as string[]);
/** The live invocation policy's own system prompt, as recorded on 2026-10-03 for builds cint-L42/L43/L44. Its last
 * sentence quotes the fragment `{"type":"Decision"` with no closing brace: real shipped bytes whose brace scan ends
 * open, and the exact sentence a model echoing its instructions writes beside its answer. */
const PROMPT_TAIL = (() => {
  const args = ((file('tools-policies-L42-L44-2026-10-03.json').builds as { policy: { args: string[] } }[])[0]!).policy.args[6]!;
  return args.slice(args.lastIndexOf('Your response starts with'));
})();
/** One real, whole, accepted answer Decision of 2026-09-28, through this same route. */
const WHOLE = ((file('live-declarations-2026-09-28.json').fixed as { answers: string[] }).answers[1]!);

it('A real answer whose prose carries a bracket is read, and the gate side still refuses it', () => {
  expect(PROSE).toHaveLength(2);
  for (const raw of PROSE) {
    expect(gate(raw)).toMatchObject({ ok: false });                       // a verdict keeps the narrow reading
    expect(parseModelJson(raw, { wrapped: 'accept' })).toEqual({ ok: false, shape: 'prose-wrapped' }); // before
    expect(answer(raw)).toMatchObject({ ok: true, shape: 'sole-object' });
    expect(accepted(raw)).toMatchObject({ reply: expect.stringContaining('bird-feeder'), cancelReminders: [] });
  }
});

it('A complete answer followed by the prompt\'s own unclosed fragment is read, not called truncated', () => {
  expect(PROMPT_TAIL).toContain('{"type":"Decision"');
  expect(PROMPT_TAIL).not.toContain('}');
  const raw = `${WHOLE}\n\n(${PROMPT_TAIL})`;
  expect(parseModelJson(raw, { wrapped: 'accept' })).toEqual({ ok: false, shape: 'truncated' });  // before
  expect(answer(raw)).toMatchObject({ ok: true, shape: 'sole-object' });
  expect(accepted(raw)).toStrictEqual((JSON.parse(WHOLE) as { conclusion: { value: unknown } }).conclusion.value);
  expect(gate(raw)).toEqual({ ok: false, shape: 'truncated' });
});

it('A genuinely cut answer, two answers, and a wrong object are all still refused', () => {
  const whole = JSON.parse(WHOLE) as Record<string, unknown>;
  for (const [raw, shape] of [
    [WHOLE.slice(0, -1), 'truncated'],                                     // cut inside the only object
    [`${PROMPT_TAIL} ${WHOLE.slice(0, -1)}`, 'truncated'],                 // cut, with an open brace before it
    [`${WHOLE}\n${WHOLE}`, 'multiple-objects'],                            // two answers never collapse into one
    [`${WHOLE}\n${WHOLE}\n(${PROMPT_TAIL})`, 'truncated'],                 // two answers, scan left open
  ] as const) expect(answer(raw), shape).toEqual({ ok: false, shape });
  // One object that is not this answer: refused by the same identity test, and classed for diagnostics.
  const other = JSON.stringify({ ...whole, conclusion: { ...(whole.conclusion as object), subject: 'preview-stage2-summary' } });
  expect(answer(`Here it is: ${other} [see above]`)).toEqual({ ok: false, shape: 'prose-wrapped' });
  // A sole-object read still faces every field check: a widened floor is refused exactly as before (Rule 57).
  const widened = JSON.stringify({ ...whole, floor: { allowed: { actions: ['work', 'send'], default: 'work', schemaVersion: 1, type: 'ActionFloor' }, chosen: 'send' } });
  expect(answer(`[note] ${widened}`)).toMatchObject({ ok: true, shape: 'sole-object' });
  expect(accepted(`[note] ${widened}`)).toBeNull();
  expect(failureShapeOf(answer(`[note] ${widened}`))).toBe('sole-object-wrong-fields');
});

it('No cap or timeout explains the live refusals, and the re-ask now names the defect it saw', () => {
  const policy = subscriptionConversationPolicy('claude-sonnet-5');
  for (const outputTokens of [1262, 1171, 1108, 1157, 1231]) expect(outputTokens).toBeLessThan(policy.maxTokens);
  for (const latencyMs of [21995, 19205, 20234, 21118]) expect(latencyMs).toBeLessThan(policy.timeout);
  expect(answerFormatReminder()).toBe(ANSWER_FORMAT_REMINDER);
  expect(answerFormatReminder('unlisted-class')).toBe(ANSWER_FORMAT_REMINDER);
  const named = answerFormatReminder('truncated');
  expect(named.startsWith(ANSWER_FORMAT_REMINDER)).toBe(true);
  expect(named).toContain('a "{" that is never closed');
  expect(answerFormatReminder('multiple-objects')).toContain('more than one top-level JSON object');
  expect(answerFormatReminder('prose-wrapped')).toContain('text outside the object');
  expect(answerFormatReminder('fenced')).toContain('Markdown fence');
  expect(answerFormatReminder('not-json')).toContain('no JSON object at all');
  expect(answerFormatReminder('sole-object-wrong-fields')).toContain('conclusion.subject');
  expect(answerFormatReminder('bare-wrong-fields')).toContain('floor.allowed');
  // Content-free: a reminder repeats a class name the runner chose, never anything the model wrote.
  for (const shape of ['truncated', 'multiple-objects', 'prose-wrapped', 'fenced', 'not-json', 'bare-wrong-fields'])
    for (const raw of [...PROSE, WHOLE]) expect(answerFormatReminder(shape).includes(raw.slice(40, 80))).toBe(false);
});

it('The launcher is the consumer that supplies the test, and only on the answer side', () => {
  const launcher = readFileSync(new URL('./journal-agent.mjs', import.meta.url), 'utf8');
  // The predicate the launcher supplies, read from its own source so this replay cannot drift from it.
  expect(launcher).toContain("const previewAnswerDecision = value => value.type === 'Decision'\n"
    + "  && value.conclusion?.subject === 'preview-stage2-answer';");
  expect(launcher).toContain("const readOptionsOf = role => ({ wrapped: wrappedPolicyOf(role),"
    + " ...(role === 'answer' ? { sole: previewAnswerDecision } : {}) });");
  expect(launcher).toContain('parseModelJson(result.bytes, readOptionsOf(role))');
  expect(launcher).toContain("const wrappedPolicyOf = role => role === 'answer' ? 'accept' : 'refuse';");
  // And the refusal class it records is the one it hands the re-ask.
  expect(launcher).toContain('const failureShape = failureShapeOf(extracted);');
  expect(launcher).toContain("return { state: 'complete', failureClass: 'malformed', failureShape, usage: result.usage };");
});

// The launcher cases in journal-agent.test.ts spawn the real launcher and cannot run on this machine (they fail
// on untouched origin/cint-L48 here too). These assertions are the same bytes those cases build, through the same
// acceptance, so the expectations written there are checked rather than assumed.
it('matches the launcher cases this machine cannot spawn, byte for byte', () => {
  const binding = { at: 1759000000000, by: 'preview', evidence: ['telegram:12345678:update:1'],
    floor: { actions: ['work'], default: 'work', schemaVersion: 1, type: 'ActionFloor' } };
  const decision = JSON.stringify({ type: 'Decision', schemaVersion: 1, id: 'shape-answer', at: binding.at, by: binding.by,
    conclusion: { subject: 'preview-stage2-answer', predicate: 'answer-text', value: 'Noted.', evidence: binding.evidence },
    reason: { subject: 'question', predicate: 'answered', value: true, evidence: binding.evidence },
    floor: { allowed: binding.floor, chosen: binding.floor.default } });
  const prose = 'Looking at the history, there is one thing to check first. ';
  for (const [mode, raw, outcome] of [
    ['answer-prose-wrapped', `${prose}${decision}`, 'prose-wrapped'],
    ['answer-list-wrapped', `${prose}[${decision}]`, 'sole-object'],
    ['answer-open-brace', `${decision} (your response starts with {"type":"Decision" and ends with the closing brace)`, 'sole-object'],
    ['answer-cut', decision.slice(0, -1), 'REFUSED:truncated'],
    ['answer-two-objects', `${decision}\n${decision}`, 'REFUSED:multiple-objects'],
    ['answer-prose-wrong-fields', `${prose}${JSON.stringify({ type: 'Other', conclusion: { subject: 'preview-stage2-answer', value: 'Noted.' } })}`,
      'prose-wrapped'],
  ] as const) {
    const read = answer(raw);
    expect(read.ok ? read.shape : `REFUSED:${read.shape}`, mode).toBe(outcome);
    expect(accepted(raw) === 'Noted.', mode).toBe(mode === 'answer-prose-wrapped' || mode === 'answer-list-wrapped'
      || mode === 'answer-open-brace');
  }
  // The wrong-fields case is accepted as an object and then refused by the same field checks, as before.
  expect(failureShapeOf(answer(`${prose}${JSON.stringify({ type: 'Other', conclusion: { subject: 'preview-stage2-answer', value: 'Noted.' } })}`)))
    .toBe('prose-wrapped-wrong-fields');
});
