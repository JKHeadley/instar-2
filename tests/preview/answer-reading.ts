import { decisionWithinFloor, ENVELOPE_FLOOR } from './model-call-boundary.js';
import { conclusionText, escapeRawControls, failureShapeOf, parseModelJson, topLevelObjects,
  type ModelJsonFailureShape, type ModelJsonResult, type ModelJsonShape, type ModelJsonWrapped } from './model-json.js';

/** The flat answer protocol (plan #491). The model no longer hand-writes the nested Decision envelope. In two days it
 * misplaced one brace or quote in that envelope four ways: a floor echo without `type`, a premature `}` (w4-answerfail),
 * a `conclusion` never closed so the floor echo landed inside it, and `"schemaVersion:1,` (cint-L47, a1/a3 and
 * updates 715673556/715673558, both attempts each). The fifth way failed silently: `promises` written beside
 * `conclusion.value` (a5, 715673531), so a promise the reply made was never recorded. None of those fields carried
 * anything the model decides; the runner already holds each one.
 *
 * So the model returns ONE flat object: `reasoning` first, then either `answer` (text, or the line a runner task asks
 * for) or the answer object's own fields directly beside it (`reply`, `promises`, `directives`, `calls`, `verdict`, ...).
 * The field is `reasoning`, not `reason`, because a task's own answer object may carry a `reason` (the summary review's
 * {verdict, reason}).
 * The runner builds the Decision from its own values: the answer subject and predicate, the turn's evidence, and the
 * local floor with its default. It then applies the one acceptance check every Decision already passes. A floor the
 * model still writes must equal the local one; it never defines or widens it (Rule 57). A legacy full Decision
 * (recorded replays, offline fakes) is read through the same check.
 *
 * `object: true` is the same move one layer deeper, for a runner task whose answer IS a JSON object (plan #507): the
 * rolling summary, its review, and the meaning index. Those three answers are parsed as JSON by their consumers, so
 * an answer written as JSON TEXT inside `answer` puts every brace and every escape of the real decision back in the
 * model's hands -- the exact slip plan #491 took out of the Decision envelope. It cost the live cancel of
 * 2026-10-04 (proof room 1 RA3, cint-L49 ddfc8f67): `summary:715673799`'s first attempt was spent because its review
 * verdict could not be read (`summary-review/verdict/malformed/not-json`), its second was refused by the summary's
 * own field gate, the turn settled memory-undecided, and "Actually, cancel the bird feeder one." was answered "I
 * couldn't record that memory change. Please send it again." while the reminder stayed open and fired. Under the
 * final flat prompt the real model still writes that shape: the recorded `summary:715673532:review` came back as
 * {"reasoning":...,"answer":"{\"verdict\":\"pass\",\"reason\":...}"}.
 * So where the answer is an object, a string that opens with `{` is read as the object it was meant to be: the runner
 * re-serializes it, so what reaches the consumer is the runner's JSON either way, and a string that is not one
 * complete object is a named format defect instead of text swallowed by a consumer's empty catch (Rule 2). A string
 * that does not open with `{` is left exactly as it was: a plain-prose summary is a tolerated answer, not a defect. */
export const ANSWER_SUBJECT = 'preview-stage2-answer';
/** Envelope metadata the runner supplies; a flat object that repeats one is read without it. */
const RUNNER_SUPPLIED = new Set(['reasoning', 'floor', 'schemaVersion', 'id', 'at', 'by', 'evidence']);

export type AnswerReading =
  | { ok: true; value: string; reason: string; shape: ModelJsonShape; envelope: 'flat' | 'decision';
    /** The answer was an object written as JSON text inside `answer`, and the runner re-serialized it (`object`
     * tasks only). Recorded as a tolerated shape, so the deviation is visible rather than silent (Rule 2). */
    objectAsText?: true }
  | { ok: false; shape: ModelJsonFailureShape; defect: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const reasonText = (value: unknown): string => typeof value === 'string' ? value
  : value === undefined || value === null ? '' : JSON.stringify(value);

/** The runner-built Decision for one parsed object, or the exact defect that keeps it from being one. */
export function answerDecision(object: Record<string, unknown>, evidence: readonly string[]):
  { decision: { type: 'Decision'; conclusion: { subject: unknown; value: unknown }; floor?: unknown; reason?: { value?: unknown } } }
  | { defect: string } {
  if (object.type === 'Decision') {
    const conclusion = isObject(object.conclusion) ? object.conclusion : {};
    const reason = isObject(object.reason) ? object.reason : {};
    return { decision: { type: 'Decision', conclusion: { subject: conclusion.subject, value: conclusion.value },
      ...(object.floor === undefined ? {} : { floor: object.floor }), reason: { value: reason.value } } };
  }
  if ('type' in object || 'conclusion' in object)
    return { defect: 'it mixes the old Decision envelope ("type" or "conclusion") into the flat object; write only "reasoning" and "answer", or "reasoning" and the answer\'s own fields' };
  const rest = Object.fromEntries(Object.entries(object).filter(([field]) => !RUNNER_SUPPLIED.has(field)));
  const fields = Object.keys(rest);
  if (fields.length === 0) return { defect: 'it has no answer: write "answer" (text) or the answer\'s own fields beside "reasoning"' };
  if ('answer' in rest && fields.length > 1)
    return { defect: `"answer" was written beside other fields (${fields.filter(field => field !== 'answer').slice(0, 3).join(', ')}); write either "answer" alone beside "reasoning", or the answer's own fields without "answer"` };
  const value = 'answer' in rest ? rest.answer : rest;
  return { decision: { type: 'Decision', conclusion: { subject: ANSWER_SUBJECT, value, evidence: [...evidence] } as { subject: unknown; value: unknown },
    floor: object.floor === undefined ? { allowed: ENVELOPE_FLOOR, chosen: ENVELOPE_FLOOR.default } : object.floor,
    reason: { value: object.reasoning } } };
}

/** The one output instruction every runner task that asks for a structured result ends with (plan #510). Live cint-L50
 * (proofroom2-dshort15-20261004-120144): the questions still said "Return only JSON {...}" or "Make your answer text one
 * JSON object", which the flat system prompt lets the model answer as JSON text inside "answer", so it hand-wrote the
 * nested object again (summary 6232267 attempt 2, beside "reply" and "openLoops"), answered a summary task as a reply to
 * the operator (attempt 1), wrote a reply review's verdicts as fields the reader did not read, and spent 2964 characters
 * of a budgeted retrospective's 2048-token cap on reasoning ("review output over the cap"). Every such task now names its
 * object, the model writes that object's fields beside `reasoning`, and the runner assembles them (answerDecision) and
 * applies the task's own checks. `reasoningChars` bounds the reasoning of a task whose output has a budget. */
export function taskFields(shape: string, reasoningChars?: number): string {
  return `This is a runner task, not a message from the operator. Return ${shape} as one flat object: `
    + `"reasoning" first${reasoningChars === undefined ? '' : ` (at most ${String(reasoningChars)} characters; it counts toward the output limit)`}, `
    + 'then each field of that object directly beside it at the top level. Never put the object inside "answer" or write it as JSON text '
    + 'inside a string, and write no field it does not name (no "answer", "reply" or "openLoops" unless named).';
}

/** How many `{` are still open at the end of the text, counted outside JSON strings from the first `{`. */
const openBraces = (text: string): number => {
  let depth = 0, inString = false, escaped = false;
  for (const char of text.slice(Math.max(0, text.indexOf('{')))) {
    if (inString) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') inString = false; continue; }
    if (char === '"') inString = true; else if (char === '{') depth++; else if (char === '}' && depth > 0) depth--;
  }
  return depth;
};

/** Named when an `object` task's answer was written as JSON text inside `answer` and that text is not one complete
 * JSON object. Content-free protocol text, like every other defect here. */
export const OBJECT_AS_TEXT_DEFECT = 'the answer object was written as JSON text inside "answer" and that text is not one complete JSON object; write the object\'s own fields directly beside "reasoning" instead, and the application will serialize them';

/** The defect a refused parse names in the one format re-ask, so the model can correct exactly that. */
export function parseDefect(text: string, extracted: ModelJsonResult): string {
  if (extracted.ok) return 'it is not an answer object';
  switch (extracted.shape) {
    case 'truncated': {
      const open = openBraces(text.trim());
      return `the JSON object never closes: at the end ${String(open)} "{" ${open === 1 ? 'is' : 'are'} still open, so a "}" is missing or a quote is misplaced`;
    }
    case 'multiple-objects': return 'it holds more than one top-level JSON object: a "}" closes the object before its last fields, or a second object follows';
    case 'fenced': return 'the object is wrapped in a Markdown fence';
    case 'prose-wrapped': {
      const trimmed = escapeRawControls(text.trim());
      const outside = topLevelObjects(trimmed).spans.reduce((rest, span) => rest.replace(span, ''), trimmed);
      return outside.trim() ? 'text was written outside the JSON object'
        : 'the JSON object is not valid JSON inside: an unescaped " inside a string, or a missing comma or colon';
    }
    case 'not-json': return 'it is not a JSON object';
  }
}

/** The live hand-over of 2026-10-06 (proof room 2, rc-2 7d2ba68b, update 6232582): both reply reviews judged every rule
 * PASS, but each quoted the reply's own `Follow-up on "..."` text inside `reasoning` without escaping the quotes, so both
 * whole objects were refused (`reply-review/decision/malformed/prose-wrapped`, the format re-ask included), the verdict
 * became `unavailable`, and the reply left with no completed review. In a response that is one whole object (nothing
 * outside it) and opens with `reasoning`, that string ends at the first `", "<field>":` after it opens. Read there, an
 * unescaped `"` inside it has exactly one meaning, its escape; every later field is parsed exactly as written and may
 * not repeat `reasoning`. If the text after that first boundary is not valid as written, nothing is read: a later
 * boundary is never tried, because that would fold a field the model wrote into `reasoning`. Nothing is discarded,
 * so a gate keeps its narrow reading (Rule 95). */
export function quotedReasoning(text: string): Record<string, unknown> | null {
  const trimmed = escapeRawControls(text.trim());
  const head = /^\{\s*"reasoning"\s*:\s*"/u.exec(trimmed);
  if (!head || !trimmed.endsWith('}')) return null;
  const end = /"\s*,\s*"[A-Za-z_][A-Za-z0-9_]*"\s*:/gu;
  end.lastIndex = head[0].length;
  const boundary = end.exec(trimmed);
  if (!boundary) return null;
  const written = trimmed.slice(head[0].length, boundary.index);
  try {
    const reasoning: unknown = JSON.parse(`"${written.replace(/\\([\s\S])|"/gu, (whole, escaped?: string) => escaped === undefined ? '\\"' : whole)}"`);
    const rest: unknown = JSON.parse(`{${trimmed.slice(boundary.index + 1).replace(/^\s*,/u, '')}`);
    return typeof reasoning === 'string' && isObject(rest) && !Object.hasOwn(rest, 'reasoning') ? { reasoning, ...rest } : null;
  } catch { return null; }
}

/** The one reading of a subscription answer-side or task result (journal-agent invokeSubscription): parse, build the
 * Decision, check it. `wrapped: 'accept'` (the answer side, Rule 95) may also discard prose around the object; there,
 * prose that itself carries brackets or a brace pair (`dated:[]`, `[withheld]`, `{reply, dated:[...]}`) is discarded only
 * when exactly one top-level span parses as an object at all, it is not written as a list element, and it is the protocol's answer (one with `answer`, `reply` or `reasoning`, or a legacy Decision with
 * the answer subject). A gate keeps the narrow reading, so a written rejection beside its verdict is never dropped.
 * `object: true` names a task whose answer is itself a JSON object (see the header): nothing branches on what the
 * text means, only on which consumer asked, exactly as `wrapped` already does. */
export function readAnswer(text: string, options: { wrapped?: ModelJsonWrapped; evidence?: readonly string[];
  object?: true } = {}): AnswerReading {
  let extracted = parseModelJson(text, { wrapped: options.wrapped ?? 'refuse' });
  // A whole-response fence is read above; a fence inside prose (live cint-L50 obligation:commitment:0:1791141513158:
  // prose quoting `"tools":[]`, then a ```json fence holding the flat object) is the same wrapper, on the same terms.
  if (!extracted.ok && (extracted.shape === 'prose-wrapped' || extracted.shape === 'multiple-objects' || extracted.shape === 'fenced')
    && options.wrapped === 'accept') {
    const trimmed = escapeRawControls(text.trim()), { spans, starts } = topLevelObjects(trimmed);
    const parsed = spans.flatMap((span, index) => { try { const value: unknown = JSON.parse(span); return isObject(value) ? [{ value, start: starts[index]! }] : []; } catch { return []; } });
    // k6 stands for a list: an object written as a list element (`[{...}]`) may be one of any number, so it stays refused.
    const listed = parsed.length === 1 && /\[\s*$/u.test(trimmed.slice(0, parsed[0]!.start));
    const sole = parsed.length === 1 && !listed ? parsed[0]!.value : null;
    // The protocol's answer: `answer` or `reply`, or `reasoning`, which leads every flat object, so a runner task's own
    // fields (an obligation step's `outcome` and `note`) are recognised as well as a reply.
    if (sole && (sole.type === 'Decision' ? isObject(sole.conclusion) && sole.conclusion.subject === ANSWER_SUBJECT
      : 'answer' in sole || 'reply' in sole || 'reasoning' in sole)) extracted = { ok: true, value: sole, shape: extracted.shape === 'fenced' ? 'fenced' : 'prose-wrapped' };
  }
  if (!extracted.ok) {
    const repaired = quotedReasoning(text);
    if (repaired) extracted = { ok: true, value: repaired, shape: 'reasoning-quotes' };
  }
  if (!extracted.ok) return { ok: false, shape: extracted.shape, defect: parseDefect(text, extracted) };
  const built = answerDecision(extracted.value, options.evidence ?? []);
  const wrong = (defect: string): AnswerReading => ({ ok: false, shape: failureShapeOf(extracted), defect });
  if ('defect' in built) return wrong(built.defect);
  const { decision } = built;
  if (decision.conclusion.subject !== ANSWER_SUBJECT) return wrong(`conclusion.subject is not "${ANSWER_SUBJECT}"`);
  if (!decisionWithinFloor(decision)) return wrong('"floor" differs from the local floor; leave it out, the runner supplies it');
  let answer = decision.conclusion.value, objectAsText = false;
  // An object task's answer written as JSON text: read it as the object it was meant to be, so the runner — never the
  // model — serializes what the consumer parses. Only a string that opens with `{` was an attempt at the object;
  // anything else is left as written (a plain-prose summary stays a tolerated answer).
  if (options.object === true && typeof answer === 'string' && answer.trim().startsWith('{')) {
    const inner = parseModelJson(answer);
    if (!inner.ok) return { ok: false, shape: inner.shape, defect: `${OBJECT_AS_TEXT_DEFECT}. The text's own defect: ${parseDefect(answer, inner)}` };
    answer = inner.value; objectAsText = true;
  }
  const value = conclusionText(answer);
  if (value === null) return wrong('the answer is neither text nor a JSON object');
  return { ok: true, value, reason: reasonText(decision.reason?.value), shape: extracted.shape,
    envelope: extracted.value.type === 'Decision' ? 'decision' : 'flat', ...(objectAsText ? { objectAsText: true as const } : {}) };
}
