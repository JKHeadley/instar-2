/**
 * Unit — correction instance-fix correspondence gate (carryover row 32; the gate section of 1.x
 * tests/unit/correction-class-review.test.ts at 4f88880a, with the class-review engine itself mapped onto the
 * retrospective review's feedback duty).
 *
 * Pins, as in 1.x: the gate is not fooled by a decoy review of another correction; enforce refuses absent and
 * pending reviews and admits a filled one; a dark review admits with that explicit reason; a fix that is not
 * correction-derived is not the gate's to refuse. Where 1.x pinned dry-run allowance and dead-letter fail-open,
 * 2.0 pins the consumer: a verified-improvement claim in a retrospective answer is admitted through this gate, a
 * refused claim is recorded with its reason on the pass, and a correction the review could not disposition stays
 * owed rather than dead-lettered (retrospective.test.ts keeps that contract).
 */
import { describe, it, expect } from 'vitest';
import { correctionCases, evaluateCorrectionInstanceFix } from './correction-fix-gate.js';
import { correctionWorld, T, type CorrectionWorld } from './correction-fixture.js';
import { feedbackDispositions, openFindings, rowRefusedReason, validateRetrospective, GRAVITY_WELLS, RETROSPECTIVE_DUTIES, retrospectivePopulation, owedCases, type RetroCase } from './retrospective.js';

const judgment = (caseId: string) => ({ case: caseId,
  standardReview: { verdict: 'covered' as const, standardRef: 'Rule 85', isPolicyRelaxation: false },
  processReview: { verdict: 'process-gap' as const, proposedDelta: 'Check carried preference in the delivered reply.' },
  rationale: 'The standing rule exists but the output check missed it.', confidence: 'high' as const });

/** A complete pass whose feedback duty opened an owned improvement item for the correction case. */
function dispositioned(w: CorrectionWorld, caseId: string, at: number) {
  const pass = w.view.retroPasses.length;
  const finding = `retro:${String(pass)}:feedback:0`;
  w.pass(at, { cases: [caseId], result: { inspected: [caseId],
    classReviews: [judgment(caseId)],
    feedback: [{ case: caseId, classification: 'behavior preference', disposition: 'improvement-owned', owner: 'agent', next: 'carry it on every packet', finding }],
    findings: [{ id: finding, duty: 'feedback', refs: [caseId], feedback: caseId, summary: 'behavior preference (operator feedback, improvement-owned)',
      disposition: { owner: 'agent', next: 'carry it on every packet' } }] } });
  return finding;
}

describe('correction instance-fix correspondence gate', () => {
  it('is not fooled by a decoy review and refuses with the mismatch', () => {
    const w = correctionWorld();
    try {
      const real = `turn:${w.preference('real motivating correction', T('2026-05-01T10:00:00Z'))}`;
      const decoy = `turn:${w.preference('unrelated decoy correction', T('2026-05-01T11:00:00Z'))}`;
      dispositioned(w, decoy, T('2026-05-02T00:00:00Z'));
      const verdict = evaluateCorrectionInstanceFix(w.view, { originCorrection: true, correctionCase: real, claimedClassReviewRef: decoy, reviewEnabled: true });
      expect(verdict).toEqual({ allow: false, reason: 'correspondence-mismatch', classReviewRef: real });
      // The same claim against the correction's own review corresponds; what it then needs is the review itself.
      expect(evaluateCorrectionInstanceFix(w.view, { originCorrection: true, correctionCase: real, claimedClassReviewRef: real, reviewEnabled: true }))
        .toEqual({ allow: false, reason: 'review-absent', classReviewRef: real });
    } finally { w.close(); }
  });

  it('enforce blocks absent/pending, allows filled; a dark review and a fix not correction-derived allow with their reasons', () => {
    const w = correctionWorld();
    try {
      const rec = `turn:${w.preference('lead with the one action', T('2026-05-01T10:00:00Z'))}`;
      const input = { originCorrection: true, correctionCase: rec, reviewEnabled: true };
      expect(evaluateCorrectionInstanceFix(w.view, input)).toMatchObject({ allow: false, reason: 'review-absent' });
      expect(evaluateCorrectionInstanceFix(w.view, { ...input, reviewEnabled: false })).toEqual({ allow: true, classReviewRef: rec, reason: 'feature-dark' });
      expect(evaluateCorrectionInstanceFix(w.view, { originCorrection: false, reviewEnabled: true })).toEqual({ allow: true, reason: 'not-correction-derived' });
      expect(evaluateCorrectionInstanceFix(w.view, { originCorrection: true, correctionCase: 'turn:telegram:12345678:update:99', reviewEnabled: true }))
        .toEqual({ allow: false, reason: 'correction-not-found' });
      // A reserved pass reviewing the case right now: pending.
      w.pass(T('2026-05-02T00:00:00Z'), { cases: [rec], result: null });
      expect(evaluateCorrectionInstanceFix(w.view, input)).toMatchObject({ allow: false, reason: 'review-pending' });
      w.journal.append({ kind: 'retro', pass: 0, state: 'failed', reason: 'offline failure', at: T('2026-05-02T00:00:01Z') });
      // A failed pass left the obligation owed, never dead-lettered: still absent, still refused.
      expect(evaluateCorrectionInstanceFix(w.view, input)).toMatchObject({ allow: false, reason: 'review-absent' });
      dispositioned(w, rec, T('2026-05-03T00:00:00Z'));
      expect(evaluateCorrectionInstanceFix(w.view, input)).toEqual({ allow: true, classReviewRef: rec, reason: 'review-filled' });
      w.reopen();
      expect(evaluateCorrectionInstanceFix(w.view, input)).toEqual({ allow: true, classReviewRef: rec, reason: 'review-filled' });
      expect(correctionCases(w.view)).toEqual(new Set([rec]));
    } finally { w.close(); }
  });

  it('the consumer: a verified-improvement claim for a correction is admitted through the gate, a decoy item is refused on the pass', () => {
    const w = correctionWorld();
    try {
      const real = `turn:${w.preference('real motivating correction', T('2026-05-01T10:00:00Z'))}`;
      const decoy = `turn:${w.preference('unrelated decoy correction', T('2026-05-01T11:00:00Z'))}`;
      const realItem = dispositioned(w, real, T('2026-05-02T00:00:00Z'));
      const decoyItem = dispositioned(w, decoy, T('2026-05-02T01:00:00Z'));
      const evidence = `turn:${w.reply('that is better now', T('2026-05-03T00:00:00Z'))}`;
      const seq = w.view.order.length + 5;
      const cases: RetroCase[] = [
        { id: real, category: 'message', at: T('2026-05-01T10:00:00Z'), seq: seq - 3, text: 'real motivating correction', meta: { correction: 'prefer' } },
        { id: `open:${realItem}`, category: 'open', at: T('2026-05-02T00:00:00Z'), seq: seq - 2, text: 'owned item' },
        { id: `open:${decoyItem}`, category: 'open', at: T('2026-05-02T01:00:00Z'), seq: seq - 1, text: 'owned decoy item' },
        { id: evidence, category: 'message', at: T('2026-05-03T00:00:00Z'), seq, text: 'that is better now' },
      ];
      const answer = (improvementOf: string) => ({ inspected: cases.map(item => item.id), omitted: [], duties: 'n'.repeat(RETROSPECTIVE_DUTIES.length),
        wells: GRAVITY_WELLS.map(() => 0), eff: 'No wasted attempts found in this window.', findings: [], grades: [], authorizations: [], comparisons: [], closures: [],
        feedback: [{ case: real, classification: 'behavior preference', disposition: 'verified-improvement', improvementOf, evidence: [evidence] }] });
      const pass = w.view.retroPasses.length;
      const refused = validateRetrospective(answer(`open:${decoyItem}`), { cases }, w.view, pass);
      expect(refused.feedback).toEqual([]);
      expect(refused.omitted).toEqual([{ case: real, reason: rowRefusedReason('feedback', 'a verified improvement proves the improvement item opened for that feedback') }]);
      const admitted = validateRetrospective(answer(`open:${realItem}`), { cases }, w.view, pass);
      expect(admitted.feedback).toMatchObject([{ case: real, disposition: 'verified-improvement', finding: realItem, evidence: [evidence] }]);
      expect(admitted.closures).toEqual([{ finding: realItem, outcome: 'improved', evidence: [evidence] }]);
      // Recorded, the closure settles the item and the correction reads as verified; the decoy's stays open.
      w.pass(T('2026-05-04T00:00:00Z'), { cases: cases.map(item => item.id), result: admitted });
      expect(openFindings(w.view).map(item => item.id)).toEqual([decoyItem]);
      expect(feedbackDispositions(w.view).find(item => item.case === real)).toMatchObject({ disposition: 'verified-improvement' });
    } finally { w.close(); }
  });
});

it('investigating is not a class review; independent judgments persist before matching linked repair admission', () => {
  const w = correctionWorld();
  try {
    const at = T('2026-05-01T10:00:00Z');
    const rec = `turn:${w.preference('lead with the action', at)}`;
    const decoy = `turn:${w.preference('keep the examples short', at + 1000)}`;
    const cases = retrospectivePopulation(w.view, w.operator).filter(item => item.id === rec);
    const response = (disposition: string, classReviews?: unknown[], classReviewRef = rec) => ({
      inspected: [rec], omitted: [], duties: 'n'.repeat(RETROSPECTIVE_DUTIES.length), wells: GRAVITY_WELLS.map(() => 0),
      eff: 'No waste found.', findings: [], grades: [], authorizations: [], comparisons: [], closures: [], classReviews,
      feedback: [{ case: rec, classification: 'preference', disposition, owner: 'agent', next: 'check the reply', classReviewRef }] });
    const input = { originCorrection: true, correctionCase: rec, reviewEnabled: true };
    const investigate = validateRetrospective(response('investigating'), { cases }, w.view, 0, at + 2000);
    expect(investigate.feedback).toHaveLength(1);
    expect(investigate.inspected).toEqual([]);
    w.pass(at + 2000, { cases: [rec], result: investigate });
    expect(evaluateCorrectionInstanceFix(w.view, input).allow).toBe(false);
    expect(owedCases(w.view, cases, at + 86400_000).map(row => row.item.id)).toContain(rec);
    // A partial review cannot fill the obligation or open repair work.
    const partial = validateRetrospective(response('improvement-owned', [{ case: rec, standardReview: judgment(rec).standardReview }]), { cases }, w.view, 1);
    expect(partial.classReviews).toBeUndefined(); expect(partial.feedback).toEqual([]);
    // The review is saved independently, below the recurrence gate, with both judgments.
    const reviewed = validateRetrospective(response('investigating', [judgment(rec)]), { cases }, w.view, 1, at + 3000);
    expect(reviewed.classReviews).toEqual([judgment(rec)]);
    w.pass(at + 3000, { cases: [rec], result: reviewed }); w.reopen();
    expect(evaluateCorrectionInstanceFix(w.view, input).reason).toBe('review-filled');
    const refused = validateRetrospective(response('improvement-owned', [], decoy), { cases }, w.view, 2);
    expect(refused.feedback).toEqual([]);
    expect(refused.omitted[0]!.reason).toContain('correspondence-mismatch');
    const admitted = validateRetrospective(response('improvement-owned'), { cases }, w.view, 2);
    expect(admitted.feedback[0]).toMatchObject({ disposition: 'improvement-owned', classReviewRef: rec });
    expect(admitted.findings).toHaveLength(1);
    expect(admitted.closures).toEqual([]); // Filled review is not completed repair.
  } finally { w.close(); }
});

it('a recorded memory failure owes its independent review without waiting for recurrence', () => {
  const w = correctionWorld();
  try {
    const { reminder } = w.forgotten('my locker is 4521', 'What is my locker?', T('2026-05-01T10:00:00Z'));
    const caseId = `turn:${reminder}`;
    expect(correctionCases(w.view).has(caseId)).toBe(true);
    const population = retrospectivePopulation(w.view, w.operator);
    expect(population.find(item => item.id === caseId)?.meta?.correction).toBe('memory-failure');
    expect(owedCases(w.view, population).map(row => row.item.id)).toContain(caseId);
    expect(evaluateCorrectionInstanceFix(w.view, { originCorrection: true, correctionCase: caseId, reviewEnabled: true }).allow).toBe(false);
  } finally { w.close(); }
});
