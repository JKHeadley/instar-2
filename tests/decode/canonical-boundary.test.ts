import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { value } from '../fixtures.js';

it('canonical bytes retain key order, aliases, array order, negative zero and mutable changes', () => {
  const child = { z: -0, a: '😀' }, input = { '2': child, '10': child, array: [child, 2] };
  expect(value(canonical(input)).bytes).toBe('{"10":{"a":"😀","z":0},"2":{"a":"😀","z":0},"array":[{"a":"😀","z":0},2]}');
  Object.freeze(input); child.z = 3;
  expect(value(canonical(input)).bytes).toContain('"z":3');
});

it('canonical entry still refuses non-data fields and depth overflow without invoking getters', () => {
  let calls = 0;
  const getter = Object.freeze(Object.defineProperty({}, 'x', { enumerable: true, get: () => { calls++; return 1; } }));
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  const extended = Object.assign([1], { extra: 2 });
  for (const bad of [getter, cyclic, Object.freeze({ [Symbol('x')]: 1 }), Object.create({ x: 1 }),
    Object.defineProperty({}, 'x', { value: 1 }), [1, , 3], extended, NaN, undefined]) {
    expect(canonical(bad).kind).toBe('Refused');
  }
  expect(calls).toBe(0);
  const deep = (n: number) => { let v: unknown = 1; for (let i = 0; i < n; i++) v = Object.freeze({ v }); return v; };
  expect(canonical(deep(64)).kind).toBe('Success');
  expect(canonical(deep(65)).kind).toBe('Refused');
});
