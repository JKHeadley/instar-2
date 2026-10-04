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
 * (recorded replays, offline fakes) is read through the same check. */
export const ANSWER_SUBJECT = 'preview-stage2-answer';
/** Envelope metadata the runner supplies; a flat object that repeats one is read without it. */
const RUNNER_SUPPLIED = new Set(['reasoning', 'floor', 'schemaVersion', 'id', 'at', 'by', 'evidence']);

export type AnswerReading =
  | { ok: true; value: string; reason: string; shape: ModelJsonShape; envelope: 'flat' | 'decision' }
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

/** How many `{` are still open at the end of the text, counted outside JSON strings from the first `{`. */
const openBraces = (text: string): number => {
  let depth = 0, inString = false, escaped = false;
  for (const char of text.slice(Math.max(0, text.indexOf('{')))) {
    if (inString) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') inString = false; continue; }
    if (char === '"') inString = true; else if (char === '{') depth++; else if (char === '}' && depth > 0) depth--;
  }
  return depth;
};

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

/** The one reading of a subscription answer-side or task result (journal-agent invokeSubscription): parse, build the
 * Decision, check it. `wrapped: 'accept'` (the answer side, Rule 95) may also discard prose around the object; there,
 * prose that itself carries brackets or a brace pair (`dated:[]`, `[withheld]`, `{reply, dated:[...]}`) is discarded only
 * when exactly one top-level span parses as an object at all and that object is the protocol's answer (one with `answer` or `reply`, or a legacy Decision with the
 * answer subject). A gate keeps the narrow reading, so a written rejection beside its verdict is never dropped. */
export function readAnswer(text: string, options: { wrapped?: ModelJsonWrapped; evidence?: readonly string[] } = {}): AnswerReading {
  let extracted = parseModelJson(text, { wrapped: options.wrapped ?? 'refuse' });
  if (!extracted.ok && (extracted.shape === 'prose-wrapped' || extracted.shape === 'multiple-objects') && options.wrapped === 'accept') {
    const parsed = topLevelObjects(escapeRawControls(text.trim())).spans.map(span => { try { const value: unknown = JSON.parse(span); return isObject(value) ? value : null; } catch { return null; } })
      .filter((value): value is Record<string, unknown> => value !== null);
    const sole = parsed.length === 1 ? parsed[0]! : null;
    if (sole && (sole.type === 'Decision' ? isObject(sole.conclusion) && sole.conclusion.subject === ANSWER_SUBJECT
      : 'answer' in sole || 'reply' in sole)) extracted = { ok: true, value: sole, shape: 'prose-wrapped' };
  }
  if (!extracted.ok) return { ok: false, shape: extracted.shape, defect: parseDefect(text, extracted) };
  const built = answerDecision(extracted.value, options.evidence ?? []);
  const wrong = (defect: string): AnswerReading => ({ ok: false, shape: failureShapeOf(extracted), defect });
  if ('defect' in built) return wrong(built.defect);
  const { decision } = built;
  if (decision.conclusion.subject !== ANSWER_SUBJECT) return wrong(`conclusion.subject is not "${ANSWER_SUBJECT}"`);
  if (!decisionWithinFloor(decision)) return wrong('"floor" differs from the local floor; leave it out, the runner supplies it');
  const value = conclusionText(decision.conclusion.value);
  if (value === null) return wrong('the answer is neither text nor a JSON object');
  return { ok: true, value, reason: reasonText(decision.reason?.value), shape: extracted.shape,
    envelope: extracted.value.type === 'Decision' ? 'decision' : 'flat' };
}
