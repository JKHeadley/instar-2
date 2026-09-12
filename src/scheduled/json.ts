import { ensure } from './boundary.js';

function scanJson(source: string, rejectRepeatedMembers: boolean,
  onTopLevelMember?: (member: string, value: unknown) => void): void {
  ensure(typeof source === 'string', 'JSON resource must be text');
  let cursor = 0;
  const whitespace = () => { while (/\s/u.test(source[cursor] ?? '')) cursor++; };
  const string = (): string => {
    const start = cursor; ensure(source[cursor++] === '"', 'invalid JSON string');
    while (cursor < source.length) {
      const character = source[cursor++]!;
      if (character === '"') {
        try { return JSON.parse(source.slice(start, cursor)) as string; }
        catch { throw new Error('invalid JSON string'); }
      }
      if (character === '\\') {
        ensure(cursor < source.length, 'invalid JSON escape');
        const escaped = source[cursor++]!;
        if (escaped === 'u') {
          ensure(/^[0-9a-fA-F]{4}$/.test(source.slice(cursor, cursor + 4)), 'invalid JSON unicode escape');
          cursor += 4;
        } else ensure('"\\/bfnrt'.includes(escaped), 'invalid JSON escape');
      } else ensure(character >= ' ' && character !== '\n' && character !== '\r', 'invalid JSON string character');
    }
    throw new Error('unterminated JSON string');
  };
  const value = (depth: number): unknown => {
    whitespace(); const character = source[cursor];
    if (character === '{') {
      cursor++; whitespace(); const members = new Set<string>();
      if (source[cursor] === '}') { cursor++; return undefined; }
      for (;;) {
        whitespace(); ensure(source[cursor] === '"', 'JSON object member must be a string');
        const member = string();
        ensure(!rejectRepeatedMembers || !members.has(member), `ambiguous JSON repeats member ${member}`); members.add(member);
        whitespace(); ensure(source[cursor++] === ':', 'JSON object member is missing colon');
        const memberValue = value(depth + 1); if (depth === 0) onTopLevelMember?.(member, memberValue); whitespace();
        if (source[cursor] === '}') { cursor++; return undefined; }
        ensure(source[cursor++] === ',', 'JSON object members must be comma-separated');
      }
    }
    if (character === '[') {
      cursor++; whitespace(); if (source[cursor] === ']') { cursor++; return undefined; }
      for (;;) {
        value(depth + 1); whitespace(); if (source[cursor] === ']') { cursor++; return undefined; }
        ensure(source[cursor++] === ',', 'JSON array members must be comma-separated');
      }
    }
    if (character === '"') return string();
    const remaining = source.slice(cursor);
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(remaining)?.[0];
    ensure(token, 'invalid JSON value'); cursor += token.length; return JSON.parse(token) as unknown;
  };
  value(0); whitespace(); ensure(cursor === source.length, 'unexpected data after JSON value');
}

/** Parse JSON while refusing repeated object members before JSON.parse can erase them. */
export function parseUnambiguousJson(source: string): unknown {
  scanJson(source, true);
  try { return JSON.parse(source) as unknown; }
  catch { throw new Error('manifest resource is not JSON'); }
}

/** Decode every top-level string value for one member without erasing repeats. */
export function topLevelJsonStringMemberValues(source: string, expectedMember: string): readonly string[] {
  const inspected = inspectTopLevelJsonStringMemberValues(source, expectedMember);
  if (inspected.error) throw inspected.error;
  return inspected.values;
}

/** Retain already-decoded top-level string members when later JSON bytes are malformed. */
export function inspectTopLevelJsonStringMemberValues(source: string, expectedMember: string): Readonly<{
  values: readonly string[]; error?: Error;
}> {
  const values: string[] = [];
  try {
    scanJson(source, false, (member, value) => {
      if (member === expectedMember && typeof value === 'string') values.push(value);
    });
    return Object.freeze({ values: Object.freeze(values) });
  } catch (error) {
    return Object.freeze({ values: Object.freeze(values),
      error: error instanceof Error ? error : new Error(String(error)) });
  }
}
