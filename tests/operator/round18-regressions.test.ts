import { expect, it } from 'vitest';
import { hashBytes } from '../../src/facts/index.js';
import { round17ProtectionFixture } from './round17-protection-fixture.js';

it.each([
  ['V34', { requestDigest: hashBytes('unrelated protected request') }],
  ['V35', { authorization: 'authorization:other' }],
  ['V36', { base: 'base:other' }],
] as const)('%s P11-NF-08/10/11/13 refuses a syntactically valid but internally inconsistent broker receipt',
  (_case, patch) => {
    const fixture = round17ProtectionFixture(patch);
    expect(fixture.protection()).toMatchObject({ posture: 'unprotected', brokerReceipt: null,
      uncertainty: expect.arrayContaining(['broker-receipt-incomplete-or-inconsistent']) });
  });

it('V30 P11-NF-10 preserves the complete mutually consistent protected receipt neighbor', () => {
  expect(round17ProtectionFixture().protection()).toMatchObject({
    posture: 'protected', brokerReceipt: 'broker-receipt', uncertainty: [],
  });
});
