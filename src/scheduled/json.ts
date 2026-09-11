import { ensure } from './boundary.js';

/** Parse JSON while refusing repeated object members before JSON.parse can erase them. */
export function parseUnambiguousJson(source: string): unknown {
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
  const value = (): void => {
    whitespace(); const character = source[cursor];
    if (character === '{') {
      cursor++; whitespace(); const members = new Set<string>();
      if (source[cursor] === '}') { cursor++; return; }
      for (;;) {
        whitespace(); ensure(source[cursor] === '"', 'JSON object member must be a string');
        const member = string(); ensure(!members.has(member), `ambiguous JSON repeats member ${member}`); members.add(member);
        whitespace(); ensure(source[cursor++] === ':', 'JSON object member is missing colon'); value(); whitespace();
        if (source[cursor] === '}') { cursor++; return; }
        ensure(source[cursor++] === ',', 'JSON object members must be comma-separated');
      }
    }
    if (character === '[') {
      cursor++; whitespace(); if (source[cursor] === ']') { cursor++; return; }
      for (;;) {
        value(); whitespace(); if (source[cursor] === ']') { cursor++; return; }
        ensure(source[cursor++] === ',', 'JSON array members must be comma-separated');
      }
    }
    if (character === '"') { string(); return; }
    const remaining = source.slice(cursor);
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(remaining)?.[0];
    ensure(token, 'invalid JSON value'); cursor += token.length;
  };
  value(); whitespace(); ensure(cursor === source.length, 'unexpected data after JSON value');
  try { return JSON.parse(source) as unknown; }
  catch { throw new Error('manifest resource is not JSON'); }
}
