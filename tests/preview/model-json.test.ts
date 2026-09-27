import { expect, it } from 'vitest';
import { failureShapeOf, parseModelJson } from './model-json.js';

const decision = { type: 'Decision', conclusion: { subject: 'preview-stage2-answer', value: 'Noted {not json} "quoted".' } };
const text = JSON.stringify(decision);

it.each([
  ['the whole text', `  ${text}\n`, 'bare'],
  ['a ```json fence', `\`\`\`json\n${text}\n\`\`\``, 'fenced'],
  ['a bare ``` fence', `\`\`\`\n${text}\n\`\`\``, 'fenced'],
  ['a fence with a sentence around it', `Here is my decision:\n\`\`\`json\n${text}\n\`\`\`\nThanks.`, 'fenced'],
  ['one balanced object inside prose', `Sure — here's the JSON: ${text} Let me know if it's wrong.`, 'prose-wrapped'],
])('accepts exactly one object as %s', (_name, input, shape) => {
  expect(parseModelJson(input)).toEqual({ ok: true, value: decision, shape });
});

it.each([
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
  ['a balanced but invalid object', 'Answer: {not: valid}', 'not-json'],
])('still rejects %s', (_name, input, shape) => {
  expect(parseModelJson(input)).toEqual({ ok: false, shape });
});

it('treats a fence inside a JSON string as data, whether the object is bare, fenced or in prose', () => {
  const quoting = { ...decision, conclusion: { ...decision.conclusion, value: 'Use this:\n```js\nrun()\n```' } };
  const body = JSON.stringify(quoting);
  expect(parseModelJson(body)).toEqual({ ok: true, value: quoting, shape: 'bare' });
  expect(parseModelJson(`\`\`\`json\n${body}\n\`\`\``)).toEqual({ ok: true, value: quoting, shape: 'fenced' });
  expect(parseModelJson(`My decision: ${body}`)).toEqual({ ok: true, value: quoting, shape: 'prose-wrapped' });
});

it('classifies a parsed object that fails the caller checks by its wrapper, content-free', () => {
  expect(failureShapeOf(parseModelJson('```json\n{"type":"Other"}\n```'))).toBe('fenced-wrong-fields');
  expect(failureShapeOf(parseModelJson('{"type":"Other"}'))).toBe('bare-wrong-fields');
  expect(failureShapeOf(parseModelJson('ok {"type":"Other"} ok'))).toBe('prose-wrapped-wrong-fields');
  expect(failureShapeOf(parseModelJson('{"a":1}{"b":2}'))).toBe('multiple-objects');
});
