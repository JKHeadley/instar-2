import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { value } from '../facts/fixtures.js';
import { round17ProtectionFixture } from './round17-protection-fixture.js';

function differentBaseReceipt() {
  const original = round17ProtectionFixture().receipt;
  const base = 'base:different';
  const requestDigest = value(canonical({ operation: original.operation, path: original.path, base,
    proposedHash: original.proposedHash, authorization: original.authorization }));
  return round17ProtectionFixture({ base, requestDigest: requestDigest.hash });
}

it('V77 P11-NF-08/10/11/13 keeps a receipt for the current owner base protected', () => {
  expect(round17ProtectionFixture().protection()).toMatchObject({
    posture: 'protected', effectiveBase: 'base:1', uncertainty: [],
  });
});

it('V78 P11-NF-08/10/11/13 exposes a consistent receipt for another base as unprotected uncertainty', () => {
  expect(differentBaseReceipt().protection()).toMatchObject({
    posture: 'unprotected', brokerReceipt: 'broker-receipt', effectiveBase: 'base:different',
    witnessFresh: true, isolationLive: true,
    uncertainty: expect.arrayContaining(['broker-receipt-current-base-mismatch']),
  });
});
