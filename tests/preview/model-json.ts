/** Narrow extraction of exactly one JSON object from model text. With thinking
 * off the model sometimes wraps its JSON in a code fence; this accepts one object
 * only when it is the whole text or the sole content of one ```json or ``` fence
 * that is itself the whole response (whitespace outside). Surrounding prose is
 * never discarded: it may state a judgment that contradicts the object, so any
 * other wrapper stays malformed and keeps its held outcome. The returned shape is
 * content-free, so it may be counted in status without storing model text.
 * Callers keep every shape check they already apply after parsing. */
export type ModelJsonShape = 'bare' | 'fenced';
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
  // A complete whole-response fence: its body must parse as one object on its own,
  // so a fence inside a JSON string (an answer quoting code) stays data.
  const fence = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\n?[ \t]*```$/iu.exec(trimmed);
  if (fence) {
    let inner: unknown;
    try { inner = JSON.parse((fence[1] ?? '').trim()); } catch { inner = undefined; }
    if (isObject(inner)) return { ok: true, value: inner, shape: 'fenced' };
  }
  // Refused: classify content-free for diagnostics only; nothing here is accepted.
  const { spans, open } = topLevelObjects(trimmed);
  if (open) return { ok: false, shape: 'truncated' };
  if (spans.length > 1) return { ok: false, shape: 'multiple-objects' };
  const outside = spans.reduce((rest, span) => rest.replace(span, ''), trimmed);
  if (fence || outside.includes('```')) return { ok: false, shape: 'fenced' };
  return { ok: false, shape: spans.length === 1 ? 'prose-wrapped' : 'not-json' };
}
