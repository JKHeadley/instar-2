import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { value } from '../facts/fixtures.js';
import { round17ProtectionFixture } from '../operator/round17-protection-fixture.js';

it('V77/V78 integration: real Part Nine evidence protects only the current Part Two owner base', () => {
  const current = round17ProtectionFixture();
  expect(current.protection()).toMatchObject({ posture: 'protected', effectiveBase: 'base:1', uncertainty: [] });

  const base = 'base:different', original = current.receipt;
  const requestDigest = value(canonical({ operation: original.operation, path: original.path, base,
    proposedHash: original.proposedHash, authorization: original.authorization }));
  expect(round17ProtectionFixture({ base, requestDigest: requestDigest.hash }).protection()).toMatchObject({
    posture: 'unprotected', effectiveBase: base, witnessFresh: true, isolationLive: true,
    uncertainty: expect.arrayContaining(['broker-receipt-current-base-mismatch']),
  });
});
