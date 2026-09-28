// Rules 94 and 98: the activation's `operatorAssertion` and `waiver` fields are references,
// never approvals by themselves. Each must resolve to a record signed by an operator-held key,
// naming the operator, bound to the exact activated act (bytes, scope and reviewed base) and
// made strictly before the act. Silence or an unresolvable reference is refusal.
import { verify } from 'node:crypto';
import { canonical } from '../../src/index.js';

/** Operator-held verification keys, pinned in source. The operator holds each private key; the
 * agent has no path to it. Adding a key is an operator-reviewed source change. Empty until the
 * operator supplies one, so an activation that needs a resolved approval refuses. */
export const OPERATOR_APPROVAL_KEYS: Readonly<Record<string, string>> = Object.freeze({});

/** The activation already in force when this rule reached the live path carries only reference
 * strings; its successor (any later expiry) must resolve both references. */
export const ASSERTION_ONLY_ACTIVATION_EXPIRY = 1791232800000;

export interface ActivationFacts { trial: string; reviewedHead: string; profileDigest: string; invocationPolicyDigest: string;
  model: string; expiresAt: number; executable: string; artifact: string; version: string; expectedAccount: string;
  observedAt: number; operatorAssertion: string; waiver: string }
export interface ActivationApproval { type: 'ActivationApproval'; schemaVersion: 1; kind: 'explicit-yes' | 'waiver';
  reference: string; rule?: string; approver: string; act: string; scope: string; base: string; approvedAt: number;
  keyId: string; signature: string }
export type ApprovalResolution = { kind: 'resolved'; explicitYes: string; waiver: string; rule: string } | { kind: 'refused'; reason: string };

const hashOf = (value: unknown) => { const result = canonical(value);
  if (result.kind !== 'Success') throw Error('activation approval: uncanonical value'); return result.value; };
/** The exact act an approval binds: what runs, as whom, under which reviewed code, until when. */
export function activationAct(activation: ActivationFacts): string {
  const { trial, reviewedHead, profileDigest, invocationPolicyDigest, model, expiresAt, executable, artifact, version, expectedAccount } = activation;
  return hashOf({ type: 'SubscriptionActivationAct', trial, reviewedHead, profileDigest, invocationPolicyDigest, model, expiresAt,
    executable, artifact, version, expectedAccount }).hash;
}
export const approvalSigningBytes = (approval: Omit<ActivationApproval, 'signature'>) => {
  const { signature: _signature, ...unsigned } = approval as ActivationApproval; return hashOf(unsigned).bytes;
};
export const activationNeedsResolvedApproval = (activation: { expiresAt: number }) => activation.expiresAt > ASSERTION_ONLY_ACTIVATION_EXPIRY;

export function resolveActivationApprovals(activation: ActivationFacts, approvals: readonly unknown[], operator: string,
  keys: Readonly<Record<string, string>> = OPERATOR_APPROVAL_KEYS): ApprovalResolution {
  const act = activationAct(activation);
  const valid = (kind: 'explicit-yes' | 'waiver', reference: string) => approvals.map(item => item as ActivationApproval).find(item =>
    item?.type === 'ActivationApproval' && item.schemaVersion === 1 && item.kind === kind && item.reference === reference
    && item.approver === operator && item.act === act && item.scope === activation.trial && item.base === activation.reviewedHead
    && Number.isSafeInteger(item.approvedAt) && item.approvedAt < activation.observedAt
    && (kind === 'explicit-yes' || typeof item.rule === 'string' && /^rule:[0-9]+$/u.test(item.rule))
    && typeof item.signature === 'string' && /^[a-f0-9]{128}$/u.test(item.signature) && Object.hasOwn(keys, item.keyId)
    && verify(null, Buffer.from(approvalSigningBytes(item), 'utf8'), keys[item.keyId]!, Buffer.from(item.signature, 'hex')));
  const yes = valid('explicit-yes', activation.operatorAssertion);
  if (!yes) return { kind: 'refused', reason: 'operatorAssertion does not resolve to a prior operator-signed explicit yes for this exact act' };
  const waiver = valid('waiver', activation.waiver);
  if (!waiver) return { kind: 'refused', reason: 'waiver does not resolve to a prior operator-signed waiver for this exact act' };
  return { kind: 'resolved', explicitYes: yes.reference, waiver: waiver.reference, rule: waiver.rule! };
}
