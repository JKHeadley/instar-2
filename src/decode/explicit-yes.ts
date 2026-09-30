// Rules 28, 82, 98; Purpose "the agent never administers its own safeguards"; Part Eleven §2.
// What counts as an explicit yes, decided in one place. Every reader of an `Authorization`'s
// explicit yes (the Part One decoder, the Part Two version chain and register spine) asks here.
import type { Provenance } from '../types/values.js';

/** The yes a signature or independently administered verifier proves. */
export const verifiedYesRecordTypes: readonly string[] = Object.freeze(['approval', 'review-approval', 'signed-yes', 'dashboard-yes']);
/**
 * Account-authenticated assent: the verified operator account replying in the bound chat, or the
 * pinned operator GitHub account approving a review. The platform authenticates the account;
 * no key the operator alone holds signs it, so the record is channel-attested.
 */
export const accountAssentRecordTypes: readonly string[] = Object.freeze(['operator-chat-yes', 'operator-review-approval']);

/**
 * THE declaration the pending approval-gesture amendment enables. The constitution as written
 * (Purpose "an approval is signed by something the operator holds"; Part Eleven §2 "a successful
 * chat reply [is] never yes") does not accept account-authenticated assent, so it stays off until
 * that amendment is approved. Enabling it is this one edit, nowhere else.
 */
export const accountAuthenticatedAssent: Readonly<{ name: string; enabled: boolean; amendment: string }> =
  Object.freeze({ name: 'account-authenticated-assent', enabled: false, amendment: 'amend-approval-gesture' });

type Declaration = Readonly<{ enabled: boolean }>;
/** An explicit yes: a verified approval record, or declared account-authenticated assent. */
export function isExplicitYes(p: Provenance, declaration: Declaration = accountAuthenticatedAssent): boolean {
  const recordType = p.authenticated.recordType;
  if (p.class === 'verified') return verifiedYesRecordTypes.includes(recordType);
  return declaration.enabled && p.class === 'channel-attested' && accountAssentRecordTypes.includes(recordType);
}
/** A repository action (a landing) needs an approval or review record, never a bare signed yes. */
export function isRepositoryYes(p: Provenance, declaration: Declaration = accountAuthenticatedAssent): boolean {
  if (!isExplicitYes(p, declaration)) return false;
  return ['approval', 'review-approval', ...accountAssentRecordTypes].includes(p.authenticated.recordType);
}
