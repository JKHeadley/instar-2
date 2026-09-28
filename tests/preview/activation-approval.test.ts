// Rules 94 and 98: reference strings never authorize; only prior operator-signed records bound
// to the exact act resolve an activation's explicit yes and waiver.
import { expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { activationAct, activationNeedsResolvedApproval, approvalSigningBytes, ASSERTION_ONLY_ACTIVATION_EXPIRY,
  OPERATOR_APPROVAL_KEYS, resolveActivationApprovals, type ActivationApproval, type ActivationFacts } from './activation-approval.js';

const operatorKey = generateKeyPairSync('ed25519'), agentKey = generateKeyPairSync('ed25519');
const keys = { 'operator:justin': operatorKey.publicKey.export({ format: 'pem', type: 'spki' }).toString() };
const activation: ActivationFacts = { trial: 'trial:1', reviewedHead: 'a6f026e5', profileDigest: 'sha256:p', invocationPolicyDigest: 'sha256:efe6',
  model: 'claude-test-1', expiresAt: ASSERTION_ONLY_ACTIVATION_EXPIRY + 604_800_000, executable: '/bin/claude', artifact: 'sha256:a',
  version: '2.1.280', expectedAccount: 'echo@example.test', observedAt: 5000, operatorAssertion: 'yes:1', waiver: 'waiver:1' };
const approval = (kind: 'explicit-yes' | 'waiver', overrides: Partial<ActivationApproval> = {}, key = operatorKey.privateKey): ActivationApproval => {
  const unsigned = { type: 'ActivationApproval' as const, schemaVersion: 1 as const, kind, reference: kind === 'waiver' ? 'waiver:1' : 'yes:1',
    ...(kind === 'waiver' ? { rule: 'rule:116' } : {}), approver: '7654321', act: activationAct(activation), scope: 'trial:1',
    base: 'a6f026e5', approvedAt: 4000, keyId: 'operator:justin', ...overrides };
  return { ...unsigned, signature: sign(null, Buffer.from(approvalSigningBytes(unsigned), 'utf8'), key).toString('hex') };
};
const resolve = (approvals: unknown[], facts = activation) => resolveActivationApprovals(facts, approvals, '7654321', keys);

it('resolves a prior operator-signed explicit yes and waiver bound to the exact act', () => {
  expect(resolve([approval('explicit-yes'), approval('waiver')])).toEqual({ kind: 'resolved', explicitYes: 'yes:1', waiver: 'waiver:1', rule: 'rule:116' });
});

it('refuses reference strings alone, silence, and every approval that does not bind this act before it', () => {
  expect(resolve([])).toMatchObject({ kind: 'refused', reason: expect.stringContaining('operatorAssertion') });
  expect(resolve([approval('explicit-yes')])).toMatchObject({ kind: 'refused', reason: expect.stringContaining('waiver') });
  const refused = (yes: ActivationApproval) => expect(resolve([yes, approval('waiver')]).kind).toBe('refused');
  refused(approval('explicit-yes', { approvedAt: 5000 }));                       // not strictly before the act
  refused(approval('explicit-yes', { base: 'other-head' }));                     // a different reviewed base
  refused(approval('explicit-yes', { scope: 'trial:2' }));                       // a different scope
  refused(approval('explicit-yes', { act: activationAct({ ...activation, model: 'claude-other-1' }) })); // other bytes
  refused(approval('explicit-yes', { approver: '99' }));                         // not the operator
  refused(approval('explicit-yes', { reference: 'yes:other' }));                 // does not resolve the reference
  refused(approval('explicit-yes', {}, agentKey.privateKey));                    // signed by a key the operator does not hold
  refused({ ...approval('explicit-yes'), approvedAt: 3000 });                    // altered after signing
  // A changed activation invalidates every earlier approval.
  expect(resolve([approval('explicit-yes'), approval('waiver')], { ...activation, invocationPolicyDigest: 'sha256:other' }).kind).toBe('refused');
  expect(resolve([approval('explicit-yes'), approval('waiver', { rule: 'no rule' })]).kind).toBe('refused');
});

it('only a successor activation needs resolved approval, and no operator key is pinned yet, so it refuses', () => {
  expect(activationNeedsResolvedApproval({ expiresAt: ASSERTION_ONLY_ACTIVATION_EXPIRY })).toBe(false);
  expect(activationNeedsResolvedApproval(activation)).toBe(true);
  expect(Object.keys(OPERATOR_APPROVAL_KEYS)).toEqual([]);
  expect(resolveActivationApprovals(activation, [approval('explicit-yes'), approval('waiver')], '7654321').kind).toBe('refused');
});
