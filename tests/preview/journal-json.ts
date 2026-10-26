/** Snapshot JSON keeps the version-1 wire format, but never materializes aggregate text.
 * Rules 7/26/60: preserve every value, bound temporary strings, and hash the same bytes.
 * Journal frames already bound individual scalars to 2 MiB; only containers may grow beyond it. */
export const JOURNAL_JSON_STRING_BYTES = 2 * 1024 * 1024;
export const JOURNAL_JSON_CHUNK_BYTES = 256 * 1024;

function* fragments(value: unknown): Generator<string> {
  if (typeof value === 'string') {
    yield '"';
    for (let at = 0; at < value.length;) {
      let end = Math.min(at + 16_384, value.length);
      // JSON.stringify must see surrogate pairs together to preserve the original JSON bytes.
      if (end < value.length && value.charCodeAt(end - 1) >= 0xd800 && value.charCodeAt(end - 1) <= 0xdbff) end--;
      yield JSON.stringify(value.slice(at, end)).slice(1, -1); at = end;
    }
    yield '"';
  } else if (Array.isArray(value)) {
    yield '[';
    for (let i = 0; i < value.length; i++) { if (i) yield ','; yield* fragments(value[i]); }
    yield ']';
  } else if (value !== null && typeof value === 'object') {
    yield '{'; let first = true;
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      if (!first) yield ','; first = false;
      yield* fragments(key); yield ':'; yield* fragments(item);
    }
    yield '}';
  } else yield JSON.stringify(value) ?? 'null';
}

/** Fixed-size buffers, suitable for two passes (header digest, then encrypted frames). */
export function* journalJsonChunks(value: unknown): Generator<Buffer> {
  let chunk = Buffer.allocUnsafe(JOURNAL_JSON_CHUNK_BYTES), used = 0;
  for (const fragment of fragments(value)) {
    const bytes = Buffer.from(fragment);
    for (let at = 0; at < bytes.length;) {
      const count = Math.min(bytes.length - at, chunk.length - used);
      bytes.copy(chunk, used, at, at + count); used += count; at += count;
      if (used === chunk.length) { yield chunk; chunk = Buffer.allocUnsafe(JOURNAL_JSON_CHUNK_BYTES); used = 0; }
    }
  }
  if (used) yield chunk.subarray(0, used);
}

type Token = { mark: string } | { value: unknown };
const punctuation = (b: number) => b === 123 || b === 125 || b === 91 || b === 93 || b === 58 || b === 44;
const whitespace = (b: number) => b === 32 || b === 10 || b === 13 || b === 9;
function* tokens(chunks: Iterable<Buffer>): Generator<Token> {
  let parts: Buffer[] = [], length = 0, active = false, quoted = false, escaped = false;
  const add = (part: Buffer) => {
    length += part.length;
    if (length > JOURNAL_JSON_STRING_BYTES) throw Error('preview journal: snapshot scalar exceeds frame ceiling');
    parts.push(part);
  };
  const finish = (): Token => {
    const value: unknown = JSON.parse(Buffer.concat(parts, length).toString('utf8'));
    parts = []; length = 0; active = false;
    return { value };
  };
  for (const chunk of chunks) {
    let start = active ? 0 : -1;
    for (let i = 0; i < chunk.length; i++) {
      const byte = chunk[i]!;
      if (!active) {
        if (whitespace(byte)) continue;
        if (punctuation(byte)) { yield { mark: String.fromCharCode(byte) }; continue; }
        active = true; quoted = byte === 34; escaped = false; start = i;
        if (quoted) continue;
      } else if (quoted) {
        if (escaped) escaped = false;
        else if (byte === 92) escaped = true;
        else if (byte === 34) { add(chunk.subarray(start, i + 1)); yield finish(); start = -1; }
        continue;
      }
      if (!quoted && (punctuation(byte) || whitespace(byte))) {
        add(chunk.subarray(start, i)); yield finish(); start = -1;
        if (punctuation(byte)) yield { mark: String.fromCharCode(byte) };
      }
    }
    if (active) add(chunk.subarray(start));
  }
  if (active) yield finish();
}

/** Parse scalars with the native JSON parser and assemble containers without joining their text.
 * Also reads legacy snapshot chunks, including UTF-8 and escape sequences split across frames. */
export function parseJournalJson(chunks: Iterable<Buffer>): unknown {
  const input = tokens(chunks);
  let current = input.next();
  const advance = () => { current = input.next(); };
  const mark = (text: string) => !current.done && 'mark' in current.value && current.value.mark === text;
  const bad = (): never => { throw Error('preview journal: invalid snapshot JSON'); };
  const parse = (): unknown => {
    if (current.done) return bad();
    if ('value' in current.value) { const value = current.value.value; advance(); return value; }
    if (mark('[')) {
      const value: unknown[] = []; advance();
      if (!mark(']')) for (;;) {
        value.push(parse());
        if (!mark(',')) break;
        advance();
      }
      if (!mark(']')) return bad();
      advance(); return value;
    }
    if (mark('{')) {
      const value: Record<string, unknown> = {}; advance();
      if (!mark('}')) for (;;) {
        if (current.done || !('value' in current.value) || typeof current.value.value !== 'string') return bad();
        const key = current.value.value; advance();
        if (!mark(':')) return bad();
        advance();
        Object.defineProperty(value, key, { value: parse(), enumerable: true, writable: true, configurable: true });
        if (!mark(',')) break;
        advance();
      }
      if (!mark('}')) return bad();
      advance(); return value;
    }
    return bad();
  };
  const value = parse();
  if (!current.done) return bad();
  return value;
}
