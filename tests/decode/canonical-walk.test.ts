import { expect, it } from 'vitest';
import { canonicalText, snapshot } from '../../src/decode/canonical.js';
import type { Json } from '../../src/index.js';

// Independent pre-change oracle: validate/copy first, then encode the safe JSON.
const encode = (v: Json): string => v === null || typeof v !== 'object' ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(encode).join(',')}]`
  : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${encode((v as Record<string, Json>)[k]!)}`).join(',')}}`;
const result = (fn: () => unknown) => { try { return { value: fn() }; } catch (e) { return { error: (e as Error).message }; } };
it('one-pass canonical bytes equal the snapshot oracle for nested and shared JSON', () => {
  const values: unknown[] = [null, -0, 1e30, 'é😀\ud800', true, [], {}, Object.create(null)];
  for (let i = 0; i < 100; i++) {
    const shared = { text: `case-${i}`, numbers: [-i, i / 3, 1e-8] };
    values.push({ z: [shared, shared], '2': i, '10': -i, ['__proto__']: { a: null }, nested: { constructor: i } });
  }
  for (const v of values) expect(canonicalText(v)).toBe(encode(snapshot(v)));
});
it('keeps all structural refusals without invoking getters', () => {
  let reads = 0;
  const getter = Object.defineProperty({}, 'x', { enumerable: true, get() { reads++; return 1; } });
  const cycle: unknown[] = []; cycle.push(cycle);
  const extra = [1]; Object.defineProperty(extra, 'x', { value: 2, enumerable: true });
  let depth64: unknown = null; for (let i = 0; i < 64; i++) depth64 = { x: depth64 };
  const samples = [getter, Object.freeze(getter), cycle, extra, [1, , 2], Object.defineProperty({}, 'x', { value: 1 }),
    { [Symbol('x')]: 1 }, new Map(), Infinity, NaN, undefined, () => 1, 1n, depth64, { x: depth64 }];
  for (const sample of samples) expect(result(() => canonicalText(sample))).toEqual(result(() => encode(snapshot(sample))));
  expect(reads).toBe(0);
});
