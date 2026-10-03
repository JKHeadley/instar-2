/** Rule 56: the reviewed activation window every subscription doorway's activation record is held
 * to. It lives in its own module so each harness adapter can read it without importing the adapter
 * that happens to hold the doorway registry — the import cycle that made order load-bearing. */

// Fixed reviewed expiry: 2026-10-12T20:40:00Z (13:40 PDT), a one-week status-quo renewal of
// 2026-10-05T20:40:00Z (itself a renewal of 2026-09-28T20:40:00Z). No ambient clock access.
export const SUBSCRIPTION_PREVIEW_EXPIRY = 1791837600000;
/** The predecessor build's reviewed end (2026-10-05T20:40:00Z). A record ending here is accepted only while the
 * journal's current end is still this end, so a runner on that record can propose and complete the renewal to
 * SUBSCRIPTION_PREVIEW_EXPIRY; once the renewal frame lands it is refused. The record never supplies an end. */
export const SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY = 1791232800000;
/** The ends this build accepts for an activation record, given the journal's current end (absent: governed end only). */
export function subscriptionActivationEndAllowed(recordEnd: number, journalEnd?: number): boolean {
  return recordEnd === SUBSCRIPTION_PREVIEW_EXPIRY
    || (recordEnd === SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY && journalEnd === SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY);
}
