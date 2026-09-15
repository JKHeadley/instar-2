import { expect, it } from 'vitest';
import { hashBytes } from '../../src/facts/index.js';
import { round17ProtectionFixture } from '../operator/round17-protection-fixture.js';

it.each([
  ['V96', { attestation: '' }],
  ['V97', { attestation: null }],
  ['V98', { base: '' }],
  ['V99', { requestDigest: 'not-a-digest' }],
  ['V100', { authorization: '' }],
  ['V101', { proposedHash: hashBytes('different proposed bytes') }],
] as const)('%s P11-NF-10/11/13 integration: the real Part Nine broker query cannot green an invalid receipt',
  (_case, patch) => {
    const x = round17ProtectionFixture(patch);
    expect(x.protection()).toMatchObject({ posture: 'unprotected', brokerReceipt: null,
      uncertainty: expect.arrayContaining(['broker-receipt-incomplete-or-inconsistent']) });
  });

it('V95 integration: the real Part Nine broker and verification runtime retain the complete positive neighbor', () => {
  expect(round17ProtectionFixture().protection()).toMatchObject({ posture: 'protected', brokerReceipt: 'broker-receipt' });
});
