/** Narrow extraction of exactly one JSON object from model text. With thinking
 * off the model sometimes wraps its JSON in a code fence, or writes its reasoning
 * before the object; this accepts one object when it is the whole text or the sole
 * content of one ```json or ``` fence that is itself the whole response (whitespace
 * outside), and — only for a caller that passes `wrapped: 'accept'` — when it is the
 * one complete object inside surrounding text.
 *
 * Discarding a wrapper is a per-consumer decision, never a global one (Rule 95: a gate
 * declares which way it fails). A gate's own verdict keeps the narrow reading, because
 * prose beside it may state a judgment that contradicts the object — a written rejection
 * around a pass object must never be dropped. A consumer whose output is itself reviewed
 * downstream before it can reach a person fails the other way: refusing a wrapped answer
 * the model did produce costs the operator their answer (Rules 15 and 77), so it accepts
 * the one object and never reads the wrapper. The default is `refuse`.
 *
 * The returned shape is content-free, so it may be counted in status without storing
 * model text. Callers keep every shape check they already apply after parsing. */
export type ModelJsonShape = 'bare' | 'fenced' | 'prose-wrapped' | 'early-close';
/** Whether this consumer may discard text around one complete object (see above). */
export type ModelJsonWrapped = 'accept' | 'refuse';
export type ModelJsonMalformedShape = 'fenced' | 'prose-wrapped' | 'multiple-objects' | 'truncated' | 'not-json';
export type ModelJsonResult =
  | { ok: true; value: Record<string, unknown>; shape: ModelJsonShape }
  | { ok: false; shape: ModelJsonMalformedShape };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseObject = (text: string): Record<string, unknown> | null => {
  try { const value: unknown = JSON.parse(text); return isObject(value) ? value : null; } catch { return null; }
};

/** Top-level balanced `{...}` spans. Strings are tracked only inside an object,
 * so apostrophes and quotes in surrounding prose never confuse the scan. */
const topLevelObjects = (text: string): { spans: string[]; starts: number[]; open: boolean } => {
  const spans: string[] = [], starts: number[] = [];
  let depth = 0, start = -1, inString = false, escaped = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (depth > 0 && inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (depth > 0 && char === '"') { inString = true; continue; }
    if (char === '{') { if (depth === 0) start = index; depth++; }
    else if (char === '}' && depth > 0) { depth--; if (depth === 0) { spans.push(text.slice(start, index + 1)); starts.push(start); } }
  }
  return { spans, starts, open: depth > 0 };
};

/** The live answer slip of 2026-10-03 (cint-L44, plan #455; 8 of the 17 distinct failing answers in every preview
 * journal): one stray `}` after an object-valued field closes the whole object early, and the fields the model wrote
 * next follow it as `,"floor":{...}}`. Read as written, that is two objects, and a correct answer became the
 * failure reply. The one reading is to drop the premature close: the first object's own fields stay exactly as
 * written (none may be replaced, so a repeated key refuses), and the continuation may only add fields after them.
 * Anything else, including a continuation that does not parse, stays malformed. */
const earlyClose = (text: string, spans: string[], starts: number[]): { value: Record<string, unknown>; outside: string } | null => {
  const [first, start] = [spans[0], starts[0]];
  if (spans.length < 2 || first === undefined || start === undefined) return null;
  const end = start + first.length, last = text.lastIndexOf('}');
  if (!/^\s*,/u.test(text.slice(end)) || last < end) return null;
  const head = parseObject(first), value = parseObject(text.slice(start, end - 1) + text.slice(end, last + 1));
  if (!head || !value || Object.keys(head).some(field => JSON.stringify(head[field]) !== JSON.stringify(value[field]))) return null;
  return { value, outside: text.slice(0, start) + text.slice(last + 1) };
};

/** Content-free class for a parse that failed, or parsed but failed the caller's field checks. */
export type ModelJsonFailureShape = ModelJsonMalformedShape | `${ModelJsonShape}-wrong-fields`;
export const failureShapeOf = (result: ModelJsonResult): ModelJsonFailureShape =>
  result.ok ? `${result.shape}-wrong-fields` : result.shape;

export function parseModelJson(text: string, options: { wrapped?: ModelJsonWrapped } = {}): ModelJsonResult {
  const trimmed = text.trim();
  let whole: unknown;
  try { whole = JSON.parse(trimmed); } catch { whole = undefined; }
  if (isObject(whole)) return { ok: true, value: whole, shape: 'bare' };
  if (whole !== undefined) return { ok: false, shape: 'not-json' };
  // A complete whole-response fence: its body must parse as one object on its own,
  // so a fence inside a JSON string (an answer quoting code) stays data.
  const fence = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)(?:\r?\n)?[ \t]*```$/iu.exec(trimmed);
  if (fence) {
    let inner: unknown;
    try { inner = JSON.parse((fence[1] ?? '').trim()); } catch { inner = undefined; }
    if (isObject(inner)) return { ok: true, value: inner, shape: 'fenced' };
  }
  const { spans, starts, open } = topLevelObjects(trimmed);
  if (open) return { ok: false, shape: 'truncated' };
  if (spans.length > 1) {
    // A tolerant consumer only, on the same terms as a wrapper: anything around the repaired object is prose.
    const repaired = options.wrapped === 'accept' ? earlyClose(trimmed, spans, starts) : null;
    if (repaired && !/[[\]{}]/u.test(repaired.outside)) return { ok: true, value: repaired.value, shape: 'early-close' };
    return { ok: false, shape: 'multiple-objects' };
  }
  const span = spans[0];
  const outside = spans.reduce((rest, part) => rest.replace(part, ''), trimmed);
  // One complete object inside text a tolerant consumer may discard. The residual must carry no
  // JSON structure at all: a `[` or `]` around it means the model wrote a list, so this object is
  // one element of an unknown number (`[{a}]`), or the response was cut inside that list (`[{a}`),
  // and a stray `{` or `}` means a second object began. Either way what the model decided is not
  // this object alone, and the simpler "one balanced object anywhere" rule cannot tell them apart.
  if (options.wrapped === 'accept' && span !== undefined && !/[[\]{}]/u.test(outside)) {
    const value = parseObject(span);
    if (value) return { ok: true, value, shape: 'prose-wrapped' };
  }
  // Refused: classify content-free for diagnostics only; nothing here is accepted.
  if (fence || outside.includes('```')) return { ok: false, shape: 'fenced' };
  return { ok: false, shape: span === undefined ? 'not-json' : 'prose-wrapped' };
}

/** The text the runner hands the journal worker for a Decision's conclusion.value: the string itself, or a plain
 * object (the conversation protocol's {reply, ...decision fields}, or a runner task's JSON answer) re-serialized as
 * JSON text for the worker's existing validators. Any other value (null, array, number) is refused as null. The
 * response already yielded exactly one Decision object (parseModelJson), and only that object's own fields are read:
 * any text the response wrapped it in was discarded there and never reaches this value. */
export function conclusionText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  return isObject(value) ? JSON.stringify(value) : null;
}
