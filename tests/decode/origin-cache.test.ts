import { expect, it } from 'vitest';
import { createOriginCache } from '../../src/decode/origin-cache.js';

it('matches both immutable inputs and evicts on the exact encoded-byte boundary', () => {
  const cache = createOriginCache<number>(6, 10);
  cache.remember('é', 'a', 1); cache.remember('four', 'a', 2);
  expect(cache.get('é', 'a')).toBe(1); // two UTF-8 bytes, six held exactly
  expect(cache.get('é', 'b')).toBeUndefined(); expect(cache.get('e', 'a')).toBeUndefined();
  cache.remember('four', 'b', 3); // replacement does not spend the byte budget twice
  expect(cache.get('é', 'a')).toBe(1); expect(cache.get('four', 'a')).toBeUndefined();
  cache.remember('x', 'a', 4);
  expect(cache.get('é', 'a')).toBeUndefined(); expect(cache.get('four', 'b')).toBeUndefined();
  expect(cache.get('x', 'a')).toBe(4);
  cache.remember('oversize', 'a', 5);
  expect(cache.get('oversize', 'a')).toBeUndefined(); expect(cache.get('x', 'a')).toBe(4);
});

it('bounds entry count independently and a fresh cache has no retained proof', () => {
  const cache = createOriginCache<number>(100, 2);
  cache.remember('a', 'key', 1); cache.remember('b', 'key', 2);
  expect(cache.get('a', 'key')).toBe(1);
  cache.remember('c', 'key', 3);
  expect(cache.get('a', 'key')).toBeUndefined(); expect(cache.get('b', 'key')).toBeUndefined();
  expect(cache.get('c', 'key')).toBe(3);
  expect(createOriginCache<number>(100, 2).get('c', 'key')).toBeUndefined();
  for (const [bytes, entries] of [[0, 1], [1, 0], [NaN, 1], [1, Infinity], [1.5, 1]])
    expect(() => createOriginCache(bytes!, entries!)).toThrow('bounds');
});
