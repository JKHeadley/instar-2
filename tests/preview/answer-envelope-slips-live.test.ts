import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decisionWithinFloor, ENVELOPE_FLOOR } from './model-call-boundary.js';
import { conclusionText, failureShapeOf, parseModelJson } from './model-json.js';

// Live cint-L44 (9ee1c2bd), 2026-10-03 21:47-21:58 PDT, plan #455: three trivial messages got "I couldn't produce an
// answer to that" within ten minutes. Every answer call had completed with the right answer; the launcher refused the
// envelope around it. Two slips, both replayed verbatim below from the two incident journals:
//   - p1 "are you there?" (update 715673368), both attempts: the floor echo dropped `type` (bare-wrong-fields).
//   - d5 (6232026), dfill-1 (6232027), both attempts, and 6232028's first: one stray `}` after the object-valued
//     conclusion.value closed the Decision early, so `,"floor":{...}}` followed it (multiple-objects).
type Call = { root: string; call: string; recordedShape: string; output: string };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/answer-envelope-slips-live-2026-10-03.json', import.meta.url), 'utf8')) as { calls: Call[] };
type Decision = { type?: unknown; floor?: unknown; conclusion?: { subject?: unknown; value?: unknown } };

/** Exactly the launcher's acceptance of an answer result (journal-agent invokeSubscription, role 'answer'). */
function answerOf(raw: string): string | null {
  const extracted = parseModelJson(raw, { wrapped: 'accept' }), decision = extracted.ok ? extracted.value as Decision : null;
  return decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
}

it('replays all seven recorded refusals, and each now yields the answer the model wrote', () => {
  expect(fixture.calls).toHaveLength(7);
  expect(fixture.calls.map(call => call.recordedShape)).toEqual(['bare-wrong-fields', 'bare-wrong-fields',
    'multiple-objects', 'multiple-objects', 'multiple-objects', 'multiple-objects', 'multiple-objects']);
  const answers = fixture.calls.map(call => answerOf(call.output));
  expect(answers.slice(0, 2)).toEqual(["Yes, I'm here.", "Yes, I'm here."]);
  const replies = answers.slice(2).map(text => (JSON.parse(text!) as { reply: string; directives?: unknown[] }));
  expect(replies[0]!.reply).toMatch(/^Got it — from now on I'll end every shopping list I write for you with "— K"\./u);
  expect(replies[0]!.directives).toEqual([{ quote: 'From now on, end every shopping list you write for me with "— K".' }]);
  expect(replies[2]!.reply).toMatch(/^Noted, thanks — garden log received/u);
  expect(replies[4]!.reply).toMatch(/^Noted — garden log 2 received/u);
});

it('the early close is read on the answer side only; a gate still sees two objects', () => {
  for (const call of fixture.calls.filter(item => item.recordedShape === 'multiple-objects')) {
    expect(parseModelJson(call.output, { wrapped: 'accept' })).toMatchObject({ ok: true, shape: 'early-close' });
    expect(parseModelJson(call.output)).toEqual({ ok: false, shape: 'multiple-objects' });
    // The repair only drops the premature close: the reason and conclusion are the model's own, field for field.
    const repaired = parseModelJson(call.output, { wrapped: 'accept' });
    if (!repaired.ok) throw Error('refused');
    expect(repaired.value.floor).toEqual({ allowed: ['work'], chosen: 'work' });
  }
});

it('the bare-wrong-fields answers parse as before; only the floor echo changed its reading', () => {
  for (const call of fixture.calls.filter(item => item.recordedShape === 'bare-wrong-fields')) {
    const parsed = parseModelJson(call.output, { wrapped: 'accept' });
    expect(parsed).toMatchObject({ ok: true, shape: 'bare' });
    if (!parsed.ok) throw Error('refused');
    expect(parsed.value.floor).toEqual({ allowed: { actions: ['work'], default: 'work', schemaVersion: 1 }, chosen: 'work' });
  }
});

const early = fixture.calls.find(item => item.recordedShape === 'multiple-objects')!.output;
it.each([
  ['a continuation that replaces a field of the first object', early.replace(/\}\s*$/u, ',"conclusion":{"subject":"preview-stage2-answer","value":"other"}}')],
  ['a continuation that is not JSON', early.replace(/,"floor":/u, ',floor:')],
  ['a second object with no comma', early.replace(/\},"floor":/u, '} {"floor":')],
  ['a list marker in the text around it', `Review: [${early}`],
])('an early close still refuses %s', (_name, raw) => {
  expect(answerOf(raw)).toBeNull();
  expect(failureShapeOf(parseModelJson(raw, { wrapped: 'accept' }))).not.toBe('early-close-wrong-fields');
});

it('a floor echo may omit descriptive fields, never contradict or widen one', () => {
  const allowed = (value: unknown) => decisionWithinFloor({ floor: { allowed: value, chosen: 'work' } });
  expect(allowed({ actions: ['work'], default: 'work', schemaVersion: 1 })).toBe(true);
  expect(allowed({ actions: ['work'] })).toBe(true);
  expect(allowed({ ...ENVELOPE_FLOOR, actions: ['work'] })).toBe(true);
  expect(allowed({ actions: ['work'], default: 'work', schemaVersion: 1, type: 'Other' })).toBe(false);
  expect(allowed({ actions: ['work'], schemaVersion: 2 })).toBe(false);
  expect(allowed({ actions: ['work'], default: 'send-anything' })).toBe(false);
  expect(allowed({ actions: ['work', 'send-anything'], default: 'work', schemaVersion: 1 })).toBe(false);
  expect(allowed({ default: 'work', schemaVersion: 1, type: 'ActionFloor' })).toBe(false);
  expect(allowed({})).toBe(false);
  expect(decisionWithinFloor({ floor: { allowed: { actions: ['work'] }, chosen: 'send-anything' } })).toBe(false);
});
