// Rules 28, 82, 98; Purpose "the agent never administers its own safeguards"; Part Eleven §2.
// What counts as an explicit yes, decided in one place. Every reader of an `Authorization`'s
// explicit yes (the Part One decoder, the Part Two version chain and register spine) asks here.
import type { Hash, Provenance } from '../types/values.js';
import type { AccountAssentAdmission } from '../types/ports.js';
import { seal, trusted } from '../types/internal.js';

/** The yes a signature or independently administered verifier proves. */
export const verifiedYesRecordTypes: readonly string[] = Object.freeze(['approval', 'review-approval', 'signed-yes', 'dashboard-yes']);
/**
 * Account-assented yes (the approval-gesture amendment's `account-assented` class): the operator
 * account replying in its bound chat, or the operator account approving a host review. The named
 * service authenticates the account; the package cannot re-check it, so it is never `verified`.
 */
export const accountAssentRecordTypes: readonly string[] = Object.freeze(['operator-chat-yes', 'operator-review-approval']);

/**
 * THE declaration the approval-gesture amendment (PR #139) enabled. Purpose ("or Instar may accept
 * a recorded, one-use approval of an exact, unexpired request from an operator account") and Part
 * One's `account-assented` class make an account-authenticated yes constitutional. Turning it off
 * again is this one edit, nowhere else: an account-assent record then decodes as plain
 * `channel-attested` and completes nothing.
 */
export const accountAuthenticatedAssent: Readonly<{ name: string; enabled: boolean; amendment: string }> =
  Object.freeze({ name: 'account-authenticated-assent', enabled: true, amendment: 'amend-approval-gesture' });

type Declaration = Readonly<{ enabled: boolean }>;
/** The class of an authenticated-channel record: `account-assented` only for a declared account yes. */
export function attestedClass(recordType: string, declaration: Declaration = accountAuthenticatedAssent): Provenance['class'] {
  return declaration.enabled && accountAssentRecordTypes.includes(recordType) ? 'account-assented' : 'channel-attested';
}
/**
 * Issue the admission for one account-assented yes. Not exported by the package: the explicit-yes
 * producer (src/operator/explicit-yes.ts) is the single route, and calls it only after admitting
 * the exact recorded request and consuming the platform id once.
 */
export function admitAccountAssent(fields: Omit<AccountAssentAdmission, 'type'>): AccountAssentAdmission {
  return seal({ type: 'AccountAssentAdmission', reference: fields.reference, recordHash: fields.recordHash,
    requestId: fields.requestId, requestDigest: fields.requestDigest, authorizationId: fields.authorizationId });
}
/** The issued admission for this exact record (reference and hash), or undefined. */
export function admittedAccountAssent(admissions: readonly AccountAssentAdmission[] | undefined, reference: string, recordHash: Hash): AccountAssentAdmission | undefined {
  return admissions?.find(a => trusted(a, 'AccountAssentAdmission') && a.reference === reference && a.recordHash === recordHash);
}
/** An explicit yes: a verified approval record, or a declared account-assented yes. */
export function isExplicitYes(p: Provenance, declaration: Declaration = accountAuthenticatedAssent): boolean {
  const recordType = p.authenticated.recordType;
  if (p.class === 'verified') return verifiedYesRecordTypes.includes(recordType);
  return declaration.enabled && p.class === 'account-assented' && accountAssentRecordTypes.includes(recordType);
}
/** A repository action (a landing) needs an approval or review record, never a bare signed yes. */
export function isRepositoryYes(p: Provenance, declaration: Declaration = accountAuthenticatedAssent): boolean {
  if (!isExplicitYes(p, declaration)) return false;
  return ['approval', 'review-approval', ...accountAssentRecordTypes].includes(p.authenticated.recordType);
}
