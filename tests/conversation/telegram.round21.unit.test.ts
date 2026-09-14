import { expect, it } from 'vitest';
import { round21IndependentStoreClaims } from './round20-fixture.js';

it('P12-NF-28 round21 keeps equal operation identities independent across separate durable histories', () => {
  const result = round21IndependentStoreClaims();
  expect(result.results.map(row => row.kind)).toEqual(['Success', 'Success']);
  expect(result.results.map(row => row.stage)).toEqual(['response', 'response']);
  expect(result.providerCalls).toEqual([1, 1]);
});
