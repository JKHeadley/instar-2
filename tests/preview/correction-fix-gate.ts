/**
 * Correction instance-fix gate (carryover row 32; 1.x `src/monitoring/CorrectionInstanceFixGate.ts` at
 * 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9; Part 21 §11 "a recorded correction also owns a standards/process
 * review").
 *
 * 1.x admitted an action that claimed to fix a recorded correction only when the correction existed, the claimed
 * class-review reference corresponded to that correction's own identity (a decoy review of another correction
 * never admits), and the review store held a filled review: absent or pending refused in enforce mode, a dark
 * store or a dead-lettered review failed toward allow with that explicit reason, and dry-run allowed every
 * branch while returning the refusal it would have made.
 *
 * In 2.0 the class review of a correction is the retrospective review's feedback duty: every operator message the
 * journal recorded as a correction or preference MUST receive a disposition (Rule 85), the disposition is saved
 * on the pass that made it, and an owned disposition opens the improvement item a later fix claims to close. So:
 *  - the correction's identity is its case id (`turn:<id>`), and the review it owns is keyed by that same id, as
 *    1.x keyed the review by the correction's dedupe key;
 *  - `review-absent` is a correction no completed pass has dispositioned yet, `review-pending` one a reserved
 *    pass is reviewing right now, `review-filled` one with a saved disposition;
 *  - there is no dead letter: a case the review could not disposition stays owed to a later pass (Part 21 §11
 *    "retained overdue obligations"), so the 1.x fail-open branch has no state to fail open from;
 *  - there is no dry run: the consumer records every refusal with its reason on the pass itself, so what a
 *    refusal would have been is observable without a mode that lets it through.
 * Rules 4 and 42: this is an exact test of recorded governed state that refuses an unverifiable claim and
 * preserves the input, and a refusal is its own typed result. Rule 95: the gate fails closed for change
 * integrity, except that a dark review (no retrospective capability) admits with that explicit reason.
 */
import type { JournalView } from './journal.js';

export interface CorrectionInstanceFixAdmission {
  allow: boolean;
  classReviewRef?: string;
  reason: 'not-correction-derived' | 'feature-dark' | 'correction-not-found' | 'correspondence-mismatch'
    | 'review-absent' | 'review-pending' | 'review-filled';
}

/** The correction cases the journal records: an operator message that stated a preference, corrected a fact or
 * asked to forget one (the retrospective population's own definition of known feedback). */
export function correctionCases(view: JournalView): Set<string> {
  return new Set(view.memory.filter(change => change.in !== 'reply' && change.mode !== 'remember')
    .map(change => `turn:${change.trigger}`));
}

/** Correspondence-bound admission over the journal. */
export function evaluateCorrectionInstanceFix(view: JournalView, input: {
  originCorrection: boolean;
  correctionCase?: string;
  claimedClassReviewRef?: string;
  /** Whether the retrospective review runs at all on this installation. */
  reviewEnabled: boolean;
}): CorrectionInstanceFixAdmission {
  if (!input.originCorrection) return { allow: true, reason: 'not-correction-derived' };
  const correction = input.correctionCase !== undefined && correctionCases(view).has(input.correctionCase) ? input.correctionCase : null;
  if (!correction) return { allow: false, reason: 'correction-not-found' };
  if (input.claimedClassReviewRef !== undefined && input.claimedClassReviewRef !== correction)
    return { allow: false, reason: 'correspondence-mismatch', classReviewRef: correction };
  if (!input.reviewEnabled) return { allow: true, classReviewRef: correction, reason: 'feature-dark' };
  const complete = view.retroPasses.filter(pass => pass.state === 'complete' && pass.result);
  if (complete.some(pass => pass.result!.feedback.some(row => row.case === correction)))
    return { allow: true, classReviewRef: correction, reason: 'review-filled' };
  if (view.retroPasses.some(pass => pass.state === undefined && pass.cases.includes(correction)))
    return { allow: false, reason: 'review-pending', classReviewRef: correction };
  return { allow: false, reason: 'review-absent', classReviewRef: correction };
}
