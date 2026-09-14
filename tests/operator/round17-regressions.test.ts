import { expect, it } from 'vitest';
import { hashBytes } from '../../src/facts/index.js';
import { resolveFailureTrace } from '../../src/operator/index.js';
import { round17ProtectionFixture } from './round17-protection-fixture.js';

it('V95 P11-NF-10/11/13 keeps the complete mutually consistent receipt protected', () => {
  const x = round17ProtectionFixture();
  expect(x.protection()).toMatchObject({ posture: 'protected', brokerReceipt: 'broker-receipt',
    effectiveBase: 'base:1', uncertainty: [] });
});

it.each([
  ['V96', { attestation: '' }],
  ['V97', { attestation: null }],
  ['V98', { base: '' }],
  ['V99', { requestDigest: 'not-a-digest' }],
  ['V100', { authorization: '' }],
  ['V101', { proposedHash: hashBytes('different proposed bytes') }],
] as const)('%s P11-NF-10/11/13 refuses a protected label for an incomplete or contradictory broker receipt',
  (_case, patch) => {
    const x = round17ProtectionFixture(patch);
    expect(x.protection()).toMatchObject({ posture: 'unprotected', brokerReceipt: null,
      uncertainty: expect.arrayContaining(['broker-receipt-incomplete-or-inconsistent']) });
    expect(x.operator.detail(x.surface.stopChallenge({ operator: x.operator.f.alice.id, scope: x.operator.f.scope }))).toBe('');
    expect(x.operator.detail(x.surface.render(x.operator.request.id))).toBe('');
  });

it.each([
  ['V102', { effectiveHash: hashBytes('different loaded bytes') }, false],
  ['V103', { operation: 'other:operation' }, false],
  ['V104', { disposition: 'refused' }, false],
] as const)('%s retains the earlier negative protection control', (_case, patch, expected) => {
  expect(round17ProtectionFixture(patch).protection().posture === 'protected').toBe(expected);
});

it('V105 retains a read-only unprotected view during broker outage', () => {
  const view = round17ProtectionFixture({}, true).protection();
  expect(view.posture).toBe('unprotected');
  expect(view.uncertainty).toEqual(expect.arrayContaining([
    expect.stringContaining('broker-evidence-unavailable:'), 'broker-receipt-missing',
  ]));
});

it.each(['false', 'true', 0, 1, null, undefined])(
  'R17 boolean audit refuses non-boolean shared-trace observations %j', value => {
    const x = round17ProtectionFixture();
    const trace = { trace: 'cancellation-race' as const, semanticIdentity: 'message:1',
      digests: [hashBytes('payload')], applications: 0, stopCausallyPrior: false,
      owner: 'repair:1', outcome: 'did-not-happen' as const, authorityCurrent: true };
    expect(x.operator.detail(resolveFailureTrace({ ...trace, stopCausallyPrior: value } as never, x.operator.f.c))).not.toBe('');
    expect(x.operator.detail(resolveFailureTrace({ ...trace, authorityCurrent: value } as never, x.operator.f.c))).not.toBe('');
  });
