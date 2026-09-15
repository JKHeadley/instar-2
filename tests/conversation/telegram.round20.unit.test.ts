import { expect, it } from 'vitest';
import { round20TwoHandleClaim } from './round20-fixture.js';

it('P12-NF-28 round20 admission identity shares consume-once state across equivalent handles', () => {
  const result = round20TwoHandleClaim(true, false);
  expect(result.distinctHandles).toBe(true);
  expect(result.sameConformance).toBe(true);
  expect(result.first.kind).toBe('Success');
  expect(result.second).toEqual({
    kind: 'Refused',
    detail: 'Telegram reply claim handoff was already used',
  });
  expect(result.providerCalls).toBe(1);
});
