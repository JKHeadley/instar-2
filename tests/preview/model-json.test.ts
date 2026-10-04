import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conclusionText, failureShapeOf, parseModelJson } from './model-json.js';

const decision = { type: 'Decision', conclusion: { subject: 'preview-stage2-answer', value: 'Noted {not json} "quoted".' } };
const text = JSON.stringify(decision);

it('PREVIEW-MODEL-JSON-ON-CAPTURE parses the genuine redacted provider result capture as one bare object', () => {
  const captured = readFileSync(join(process.cwd(), 'tests/fixtures/provider-failure/claude-limit-result.json'), 'utf8');
  expect(parseModelJson(captured)).toMatchObject({ ok: true, shape: 'bare', value: { type: 'result' } });
});

it.each([
  ['the whole text', `  ${text}\n`, 'bare'],
  ['a ```json fence', `\`\`\`json\n${text}\n\`\`\``, 'fenced'],
  ['a bare ``` fence', `\`\`\`\n${text}\n\`\`\``, 'fenced'],
  ['a whole-response fence with spaces outside', `  \`\`\`json\n${text}\n\`\`\`  `, 'fenced'],
  ['a ```json fence with CRLF', `\`\`\`json\r\n${text}\r\n\`\`\``, 'fenced'],
  ['a bare ``` fence with CRLF', `\`\`\`\r\n${text}\r\n\`\`\``, 'fenced'],
  ['a fence with CRLF then LF', `\`\`\`json\r\n${text}\n\`\`\``, 'fenced'],
  ['a fence with LF then CRLF', `\`\`\`json\n${text}\r\n\`\`\``, 'fenced'],
])('accepts exactly one object as %s', (_name, input, shape) => {
  expect(parseModelJson(input)).toEqual({ ok: true, value: decision, shape });
});

it.each([
  ['a fence with a sentence around it', `Here is my decision:\n\`\`\`json\n${text}\n\`\`\`\nThanks.`, 'fenced'],
  ['one balanced object inside prose', `Sure — here's the JSON: ${text} Let me know if it's wrong.`, 'prose-wrapped'],
  ['a pass object after a written rejection', `VIOLATION: the proposed reply exposes a credential. Do not send it. {"verdict":"pass","ruleIds":[],"reason":"No rule was broken."}`, 'prose-wrapped'],
  ['a pass object inside an array wrapper', `Review: [{"verdict":"pass","ruleIds":[],"reason":"ok"}]`, 'prose-wrapped'],
  ['a pass object inside an unterminated array', `[{"verdict":"pass","ruleIds":[],"reason":"ok"}`, 'prose-wrapped'],
  ['a rejection fence followed by a JSON fence', `\`\`\`\nVIOLATION: do not send\n\`\`\`\n\`\`\`json\n{"verdict":"pass","ruleIds":[],"reason":"ok"}\n\`\`\``, 'fenced'],
  ['a JSON fence followed by a rejection', `\`\`\`json\n${text}\n\`\`\`\nVIOLATION: do not send this.`, 'fenced'],
  ['a CRLF JSON fence followed by a rejection', `\`\`\`json\r\n${text}\r\n\`\`\`\r\nVIOLATION: do not send this.`, 'fenced'],
  ['two objects in prose', `First ${text} and second ${text}`, 'multiple-objects'],
  ['a trailing second object', `${text} {"type":"Decision"}`, 'multiple-objects'],
  ['two fences', `\`\`\`json\n${text}\n\`\`\`\n\`\`\`json\n${text}\n\`\`\``, 'multiple-objects'],
  ['a fence plus an object outside it', `${text}\n\`\`\`json\n${text}\n\`\`\``, 'multiple-objects'],
  ['two objects inside one fence', `\`\`\`json\n${text}\n${text}\n\`\`\``, 'multiple-objects'],
  ['a truncated object', text.slice(0, -5), 'truncated'],
  ['a truncated object in prose', `Here: ${text.slice(0, -1)}`, 'truncated'],
  ['an unterminated fence cut inside its object', `\`\`\`json\n${text.slice(0, -3)}`, 'truncated'],
  ['a truncated object inside a fence', `\`\`\`json\n${text.slice(0, -2)}\n\`\`\``, 'truncated'],
  ['a fence holding no JSON', '```\nnot json at all\n```', 'fenced'],
  ['plain prose', 'I could not decide.', 'not-json'],
  ['empty text', '', 'not-json'],
  ['a bare array', `[${text}]`, 'not-json'],
  ['a JSON string', '"just a string"', 'not-json'],
  ['a balanced but invalid object', 'Answer: {not: valid}', 'prose-wrapped'],
])('still rejects %s', (_name, input, shape) => {
  expect(parseModelJson(input)).toEqual({ ok: false, shape });
});

it('treats a fence inside a JSON string as data, whether the object is bare or fenced, and never accepts it from prose', () => {
  const quoting = { ...decision, conclusion: { ...decision.conclusion, value: 'Use this:\n```js\nrun()\n```' } };
  const body = JSON.stringify(quoting);
  expect(parseModelJson(body)).toEqual({ ok: true, value: quoting, shape: 'bare' });
  expect(parseModelJson(`\`\`\`json\n${body}\n\`\`\``)).toEqual({ ok: true, value: quoting, shape: 'fenced' });
  expect(parseModelJson(`My decision: ${body}`)).toEqual({ ok: false, shape: 'prose-wrapped' });
});

// The live 2026-10-01 k6 turn ("what is my padlock code now?"): the answer model wrote its reasoning before
// the Decision on both attempts, so the operator was told "I couldn't produce an answer" although an answer
// existed. A consumer whose own output is reviewed again downstream may discard that wrapper (Rules 15, 77,
// 95); a gate's own verdict may not, because the wrapper could hold a written rejection. Both sides below.
const WRAP = { wrapped: 'accept' } as const;

it.each([
  ['one object after prose', `Looking at the history: ${text}`],
  ['one object before prose', `${text}\nTell me if that is wrong.`],
  ['one whole fence inside prose', `Here is my decision:\n\`\`\`json\n${text}\n\`\`\`\nThanks.`],
  ['one object inside two fences of prose', `\`\`\`\nreasoning\n\`\`\`\n${text}`],
])('a tolerant consumer accepts %s', (_name, input) => {
  expect(parseModelJson(input, WRAP)).toEqual({ ok: true, value: decision, shape: 'prose-wrapped' });
  expect(parseModelJson(input)).toMatchObject({ ok: false });   // every other consumer is unchanged
});

it.each([
  ['two objects', `First ${text} and second ${text}`, 'multiple-objects'],
  ['a truncated object after prose', `Here: ${text.slice(0, -1)}`, 'truncated'],
  ['a truncated object alone', text.slice(0, -5), 'truncated'],
  ['one object inside a list', `Review: [${text}]`, 'prose-wrapped'],
  ['one object inside an unterminated list', `Review: [${text}`, 'prose-wrapped'],
  ['a stray closing brace beside the object', `} ${text}`, 'prose-wrapped'],
  ['a balanced but invalid object', 'Answer: {not: valid}', 'prose-wrapped'],
  ['plain prose', 'I could not decide.', 'not-json'],
  ['a bare array', `[${text}]`, 'not-json'],
  ['a fence holding no JSON', '```\nnot json at all\n```', 'fenced'],
])('a tolerant consumer still rejects %s', (_name, input, shape) => {
  expect(parseModelJson(input, WRAP)).toEqual({ ok: false, shape });
});

it('discards the wrapper, so nothing beside the object can reach the answer', () => {
  const secret = 'sk-live-0000000000000000';
  const wrapped = parseModelJson(`My reasoning quotes ${secret} and then decides.\n${text}`, WRAP);
  expect(wrapped).toEqual({ ok: true, value: decision, shape: 'prose-wrapped' });
  expect(JSON.stringify(wrapped)).not.toContain(secret);
  if (!wrapped.ok) throw new Error('the wrapped object was refused');
  expect(conclusionText((wrapped.value as typeof decision).conclusion.value)).toBe(decision.conclusion.value);
});

// The shipped launcher's one parse site chooses the policy per consumer. The live role mapping itself is
// proven end-to-end by the launcher cases in journal-agent.test.ts (they spawn `/bin/sh`, so they run only
// where it is bash); this check holds the wiring those cases exercise.
it('the shipped launcher parses with a per-consumer policy, and only the answer side may discard a wrapper', () => {
  const launcher = readFileSync(join(process.cwd(), 'tests/preview/journal-agent.mjs'), 'utf8');
  expect(launcher).toContain("const wrappedPolicyOf = role => role === 'answer' ? 'accept' : 'refuse';");
  const sites = launcher.match(/parseModelJson\([^;]*?\),/gu) ?? [];
  expect(sites).toEqual(['parseModelJson(result.bytes, readOptionsOf(role)),']);
  expect(launcher).toContain('const role = roleOf(id);');
  // Plan #485: the same one site also carries the answer side's own identity test, and a gate never gets it.
  expect(launcher).toContain("const readOptionsOf = role => ({ wrapped: wrappedPolicyOf(role),"
    + " ...(role === 'answer' ? { sole: previewAnswerDecision } : {}) });");
});

it('names a wrapped object that fails the caller checks by its wrapper, content-free', () => {
  expect(failureShapeOf(parseModelJson('ok {"type":"Other"} ok', WRAP))).toBe('prose-wrapped-wrong-fields');
  expect(failureShapeOf(parseModelJson('ok {"type":"Other"} ok'))).toBe('prose-wrapped');
});

it('classifies a parsed object that fails the caller checks by its wrapper, content-free', () => {
  expect(failureShapeOf(parseModelJson('```json\n{"type":"Other"}\n```'))).toBe('fenced-wrong-fields');
  expect(failureShapeOf(parseModelJson('{"type":"Other"}'))).toBe('bare-wrong-fields');
  expect(failureShapeOf(parseModelJson('ok {"type":"Other"} ok'))).toBe('prose-wrapped');
  expect(failureShapeOf(parseModelJson('{"a":1}{"b":2}'))).toBe('multiple-objects');
});
