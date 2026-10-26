import { expect, it } from 'vitest';
import { constants } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { JOURNAL_JSON_CHUNK_BYTES, JOURNAL_JSON_STRING_BYTES, journalJsonChunks, parseJournalJson } from './journal-json.js';

it('keeps legacy JSON bytes, including escapes, omitted fields, sparse arrays and split Unicode', () => {
  const value = { a: undefined, b: [undefined, null, false, 1e30, -0],
    text: 'x'.repeat(16_383) + '😀\\\n\t\u0000\ud800',
    long: 'a'.repeat(JOURNAL_JSON_CHUNK_BYTES) + '🌱', nested: { quote: '"' },
    ...JSON.parse('{"__proto__":{"safe":true}}') };
  const expected = JSON.stringify(value), chunks = [...journalJsonChunks(value)];
  expect(Buffer.concat(chunks).toString()).toBe(expected);
  expect(chunks.every(chunk => chunk.length <= JOURNAL_JSON_CHUNK_BYTES)).toBe(true);
  expect(parseJournalJson(chunks)).toEqual(JSON.parse(expected));
  // Every possible token boundary, including UTF-8, escaped quotes and surrogate escapes.
  const small = Buffer.from('{"a":["🌱\\\"x\\u1234",-1.2e+4,true,false,null],"__proto__":1}');
  for (let i = 1; i < small.length; i++) expect(parseJournalJson([small.subarray(0, i), small.subarray(i)])).toEqual(JSON.parse(small.toString()));
  expect(Object.getPrototypeOf(parseJournalJson([small]))).toBe(Object.prototype);
});

it.each(['', '{', '[1,]', '{"a":1,}', '{"a" 1}', '{a:1}', '[1 2]', '{}{}', '"unterminated', 'true false', '01', '[true,false', '"bad\nstring"'])(
  'refuses malformed snapshot JSON %j', text => expect(() => parseJournalJson([Buffer.from(text)])).toThrow());

it('refuses an oversized scalar but permits a container larger than the scalar ceiling', () => {
  expect(() => parseJournalJson(journalJsonChunks('x'.repeat(JOURNAL_JSON_STRING_BYTES)))).toThrow('scalar exceeds');
  const row = 'x'.repeat(32_768), rows = Array(70).fill(row);
  expect(parseJournalJson(journalJsonChunks(rows))).toEqual(rows);
});

it('serializes synthetic retained history past the old V8 aggregate-string limit in bounded chunks', () => {
  // Shared immutable payload: exercise >512 MiB of logical snapshot bytes without a giant
  // allocation, disk burner or competing worker. The journal integration test injects the ceiling.
  const row = { kind: 'model-call', input: 'x'.repeat(256 * 1024), output: 'y'.repeat(256 * 1024) };
  const retained = Array(Math.ceil(constants.MAX_STRING_LENGTH / (512 * 1024)) + 2).fill(row);
  let bytes = 0, largest = 0;
  const digest = createHash('sha256');
  for (const chunk of journalJsonChunks({ retained })) {
    bytes += chunk.length; largest = Math.max(largest, chunk.length); digest.update(chunk);
  }
  expect(bytes).toBeGreaterThan(constants.MAX_STRING_LENGTH);
  expect(largest).toBe(JOURNAL_JSON_CHUNK_BYTES);
  expect(digest.digest('hex')).toHaveLength(64);
}, 30000);

it('round-trips recorded summary/Jev/review outputs, unknown delivery and the recorded empty reply field', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/work-recovery-2026-10-15.json', import.meta.url), 'utf8')) as {
    negativeOutputs: { id: string; shape: string; output: string }[];
  };
  expect(fixture.negativeOutputs).toHaveLength(8);
  expect(fixture.negativeOutputs.some(row => row.output === '')).toBe(true);
  for (const row of fixture.negativeOutputs) expect(parseJournalJson(journalJsonChunks(row)), row.id).toEqual(row);
});
