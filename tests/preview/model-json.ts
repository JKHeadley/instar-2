/** Tolerant extraction of exactly one JSON object from model text. With thinking
 * off the model sometimes wraps its JSON in a code fence or a sentence; this
 * accepts exactly one object when it is the whole text, the sole content of a
 * single ```json or ``` fence, or the sole balanced top-level object inside
 * prose. Anything else stays malformed. The returned shape is content-free, so
 * it may be counted in status without storing model text. Callers keep every
 * shape check they already apply after parsing. */
export type ModelJsonShape = 'bare' | 'fenced' | 'prose-wrapped';
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
const topLevelObjects = (text: string): { spans: string[]; open: boolean } => {
  const spans: string[] = [];
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
    else if (char === '}' && depth > 0) { depth--; if (depth === 0) spans.push(text.slice(start, index + 1)); }
  }
  return { spans, open: depth > 0 };
};

/** Content-free class for a parse that failed, or parsed but failed the caller's field checks. */
export type ModelJsonFailureShape = ModelJsonMalformedShape | `${ModelJsonShape}-wrong-fields`;
export const failureShapeOf = (result: ModelJsonResult): ModelJsonFailureShape =>
  result.ok ? `${result.shape}-wrong-fields` : result.shape;

export function parseModelJson(text: string): ModelJsonResult {
  const trimmed = text.trim();
  let whole: unknown;
  try { whole = JSON.parse(trimmed); } catch { whole = undefined; }
  if (isObject(whole)) return { ok: true, value: whole, shape: 'bare' };
  if (whole !== undefined) return { ok: false, shape: 'not-json' };
  // One string-aware scan covers both wrappers, so a fence inside a JSON string
  // (an answer quoting code) is data, never a wrapper boundary.
  const { spans, open } = topLevelObjects(trimmed);
  if (open) return { ok: false, shape: 'truncated' };
  if (spans.length > 1) return { ok: false, shape: 'multiple-objects' };
  const span = spans[0];
  const at = span === undefined ? -1 : trimmed.indexOf(span);
  const fenced = span === undefined ? trimmed.includes('```')
    : /```(?:json)?[ \t]*$/iu.test(trimmed.slice(0, at).trimEnd()) && trimmed.slice(at + span.length).trimStart().startsWith('```');
  const value = span === undefined ? null : parseObject(span);
  if (value) return { ok: true, value, shape: fenced ? 'fenced' : 'prose-wrapped' };
  return { ok: false, shape: fenced ? 'fenced' : 'not-json' };
}
