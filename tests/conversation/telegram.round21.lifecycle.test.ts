import { expect, it } from 'vitest';
import { round21TwoStoreClaim } from './round20-fixture.js';

it('P12-NF-28 P12-NF-36 P12-NF-38 round21 refuses a second-store lost-response repeat before provider invocation', () => {
  const result = round21TwoStoreClaim(true, true);
  expect(result.distinctHandles).toBe(true);
  expect(result.distinctStoreHandles).toBe(true);
  expect(result.equalHistory).toBe(true);
  expect(result.first.detail).toBe('response lost after provider application');
  expect(result.second).toEqual({
    kind: 'Refused',
    detail: 'Telegram reply claim handoff was already used',
  });
  expect(result.dispatch.stage).toBe('unknown');
  expect(result.providerCalls).toBe(1);
});
