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
 * In 2.0 each recorded correction is its durable review obligation. The bounded retrospective
 * independently judges standards and development process, saving both in classReviews. Feedback
 * dispositions never fill this review. The existing improvement-owned work-item admission checks
 * a previously saved matching review; investigation and ordinary conversation remain reachable.
 * Failed/missing reviews stay owed through the retrospective cadence; no second store or worker.
 * Rules 4/9/26/85/95: exact correspondence, honest pending state, fail closed for linked repair work.
 */
import type { JournalView } from './journal.js';

/** Retained 1.x CorrectionClassReview judgment, carried by the existing retrospective journal. */
export interface CorrectionClassReview {
  case: string;
  standardReview: { verdict: 'covered' | 'needs-upgrade' | 'new-standard-needed' | 'not-applicable';
    standardRef?: string; proposedDelta?: string; isPolicyRelaxation: boolean };
  processReview: { verdict: 'covered' | 'process-gap' | 'not-applicable'; proposedDelta?: string };
  rationale: string; confidence: 'low' | 'medium' | 'high';
}

export function completedCorrectionReviews(view: JournalView): CorrectionClassReview[] {
  return view.retroPasses.filter(pass => pass.state === 'complete').flatMap(pass => pass.result?.classReviews ?? []);
}

export interface CorrectionInstanceFixAdmission {
  allow: boolean;
  classReviewRef?: string;
  reason: 'not-correction-derived' | 'feature-dark' | 'correction-not-found' | 'correspondence-mismatch'
    | 'review-absent' | 'review-pending' | 'review-filled';
}

/** The correction cases the journal records: an operator message that stated a preference, corrected a fact or
 * asked to forget one (the retrospective population's own definition of known feedback). */
export function correctionCases(view: JournalView): Set<string> {
  return new Set([...view.memory.filter(change => change.in !== 'reply' && change.mode !== 'remember')
    .map(change => `turn:${change.trigger}`), ...view.order.filter(turn => turn.memoryFailure !== undefined).map(turn => `turn:${turn.id}`)]);
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
  if (completedCorrectionReviews(view).some(row => row.case === correction))
    return { allow: true, classReviewRef: correction, reason: 'review-filled' };
  if (view.retroPasses.some(pass => pass.state === undefined && pass.cases.includes(correction)))
    return { allow: false, reason: 'review-pending', classReviewRef: correction };
  return { allow: false, reason: 'review-absent', classReviewRef: correction };
}
