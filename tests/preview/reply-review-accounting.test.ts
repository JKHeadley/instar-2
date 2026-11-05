import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sha256 } from './model-call-boundary.js';
import { CREDENTIAL_SHAPE_NOTICE } from './journal.js';
import type { Turn, JournalView } from './journal.js';
import { HOLDING_REPLY } from './reply-check.js';
import { PREVIEW_PROOF_PLANS, executeProof, replyReviewOutcome, sentAnswers, sentReview, sentReviewEvidence } from './proofs.js';
import type { ProofPorts, SentReviewEvidence } from './proofs.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/reply-review-accounting-2026-11-05.json', import.meta.url), 'utf8')) as {
  rows: { update: number; classification: string; coherenceRules: number[]; evidence: SentReviewEvidence }[];
};
const caseOf = (update: number) => structuredClone(fixture.rows.find(row => row.update === update)!.evidence);
const latest = Math.max(...fixture.rows.map(row => row.evidence.checkDoneAt!));
const HOUR = 3_600_000;
const plan = PREVIEW_PROOF_PLANS.find(plan => plan.id === 'reply-review-reached')!;
const pass = (): SentReviewEvidence => ({ intentDigest: sha256('answer'), answerDigest: sha256('answer'),
  intentAt: latest - 20, sentAt: latest, checkDoneAt: latest - 30, jevReserved: true, jevReservedAt: latest - 40,
  checks: [{ path: 'jev', verdict: 'pass', candidateDigest: sha256('answer') }] });

describe('recorded reply review accounting (content-free live replay)', () => {
  it.each(fixture.rows)('replays update $update: $classification', ({ update, evidence, coherenceRules }) => {
    const result = sentReview(evidence);
    if (update === 969390379) {
      expect(result.kind).toBe('fixed-notice');
      expect(replyReviewOutcome([evidence], latest)).toMatchObject({ disposition: 'unknown', observed: {
        sentAnswers: 0, fixedNotices: 1, historicalViolationChecks: 2, historicalUnavailableChecks: 1 } });
    } else if (update === 969390429) {
      expect(result).toMatchObject({ kind: 'revision', reached: true, passed: true, phase: 'before-send' });
      expect(replyReviewOutcome([evidence], evidence.checkDoneAt! + 1000)).toMatchObject({ disposition: 'passed', observed: {
        reviewed: 1, revisions: 1, historicalViolationChecks: 2 } });
    } else {
      expect(coherenceRules).toContain(58);
      expect(result).toMatchObject({ kind: 'raw-answer', attempted: true, reached: true, passed: false, phase: 'after-send' });
      expect(replyReviewOutcome([evidence], latest).disposition).toBe(result.verdict === 'violation' ? 'failed' : 'unknown');
    }
  });
  it('keeps all fourteen histories, seven unavailable and five adverse final judgments, with their real latency and observation time', () => {
    const result = replyReviewOutcome(fixture.rows.map(row => row.evidence), latest + 48 * HOUR);
    expect(result).toMatchObject({ disposition: 'failed', observedAt: latest, observed: {
      sentAnswers: 13, fixedNotices: 1, rawAnswers: 12, revisions: 1, attempted: 13, reached: 13, unreviewed: 0,
      reviewed: 1, judged: 6, beforeSend: 1, afterSend: 12, unavailable: 7, violations: 5,
      historicalViolationChecks: 13, historicalUnavailableChecks: 14, recentObservations: 0, latestObservationAt: latest,
      maxAfterSendLatencyMs: 624437 } });
  });
  it('recognizes only the exact fixed notice digest, never arbitrary text ending in that notice', () => {
    for (const notice of [HOLDING_REPLY, CREDENTIAL_SHAPE_NOTICE]) {
      const e = { ...caseOf(969390379), intentDigest: sha256(notice) };
      expect(sentReview(e).kind).toBe('fixed-notice');
      e.intentDigest = sha256(`unreviewed model text\n${notice}`);
      expect(sentReview(e).kind).not.toBe('fixed-notice');
      expect(replyReviewOutcome([e], latest).disposition).toBe('failed');
    }
  });
  it('a passing revision cannot cover the wrong sent digest or a late revision', () => {
    const e = caseOf(969390429);
    e.intentDigest = e.answerDigest;
    expect(replyReviewOutcome([e], latest).disposition).toBe('failed');
    expect(sentReview(e).passed).toBe(false);
    const late = caseOf(969390429);
    late.checkDoneAt = late.sentAt! + 1;
    expect(replyReviewOutcome([late], late.checkDoneAt)).toMatchObject({ disposition: 'failed', observed: { wrongPhase: 1 } });
  });
  it('after-send pass is reached after send, never evidence of before-send review', () => {
    // Positive neighbor of the recorded adverse result; the captured verdict above stays adverse.
    const e = caseOf(969390675);
    e.checks[e.checks.length - 1]!.verdict = 'pass';
    expect(replyReviewOutcome([e], latest)).toMatchObject({ disposition: 'passed', observedAt: latest,
      observed: { reviewed: 1, afterSend: 1, beforeSend: 0, historicalViolationChecks: 1 } });
    delete e.afterSendReview;
    expect(replyReviewOutcome([e], latest)).toMatchObject({ disposition: 'failed', observed: { wrongPhase: 1, beforeSend: 0 } });
  });
  it('a before-send gap fails, even with a later pass or a passing sibling', () => {
    const missing = { ...pass(), checks: [], jevReserved: false, jevReservedAt: undefined, checkDoneAt: undefined };
    expect(replyReviewOutcome([pass(), missing], latest)).toMatchObject({ disposition: 'failed', observed: { noAttempt: 1, unreviewed: 1 } });
    const late = { ...pass(), checkDoneAt: latest + 1 };
    expect(replyReviewOutcome([late], latest + 1)).toMatchObject({ disposition: 'failed', observed: { wrongPhase: 1 } });
  });
  it.each(['intentDigest', 'intentAt', 'sentAt', 'checkDoneAt', 'jevReservedAt', 'jevReserved'] as const)('missing %s remains unknown', key => {
    const e = pass(); delete e[key];
    expect(replyReviewOutcome([e], latest).disposition).toBe('unknown');
  });
  it('unresolved paid reservations and missing candidate evidence never count as successful judgment', () => {
    const pending = { ...pass(), checks: [], checkDoneAt: undefined };
    expect(replyReviewOutcome([pending], latest)).toMatchObject({ disposition: 'unknown', observed: { attempted: 1, reached: 0, judged: 0 } });
    const noDigest = pass(); delete noDigest.checks[0]!.candidateDigest;
    expect(replyReviewOutcome([noDigest], latest).disposition).toBe('unknown');
    const wrong = pass(); wrong.checks[0]!.candidateDigest = sha256('neighbor');
    expect(replyReviewOutcome([wrong], latest)).toMatchObject({ disposition: 'failed', observed: { wrongCandidate: 1 } });
  });
  it('later unavailable or undecided judgment cannot borrow an earlier pass', () => {
    for (const verdict of ['unavailable', 'unsure'] as const) {
      const e = pass(); e.checks.push({ ...e.checks[0]!, verdict });
      expect(replyReviewOutcome([e], latest)).toMatchObject({ disposition: 'unknown', observed: { reached: 1, reviewed: 0, judged: 0 } });
    }
  });
  it('a pending contextual or revision review cannot borrow an earlier Jev pass', () => {
    for (const pending of [{ reviewReserved: true }, { revisionReviewReserved: true as const }]) {
      const e = { ...pass(), ...pending };
      expect(replyReviewOutcome([e], latest)).toMatchObject({ disposition: 'unknown', observed: { pending: 1, reviewed: 0, judged: 0 } });
    }
  });
  it('an interrupted retrospective result stays unavailable history with incomplete evidence', () => {
    const e = caseOf(969390668);
    e.checks.push({ path: 'holding', verdict: 'unavailable' });
    expect(replyReviewOutcome([e], latest)).toMatchObject({ disposition: 'unknown', observed: {
      attempted: 1, reached: 0, historicalUnavailableChecks: 3, reviewed: 0 } });
  });
  it('a retrospective label cannot move a pre-send reservation to after delivery', () => {
    const e = caseOf(969390675);
    e.reviewReservedAt = e.intentAt! - 1;
    expect(replyReviewOutcome([e], latest)).toMatchObject({ disposition: 'failed', observed: { wrongPhase: 1 } });
  });
  it('old evidence does not become fresh on reread, and future evidence cannot pass', () => {
    expect(replyReviewOutcome([pass()], latest)).toMatchObject({ disposition: 'passed', observedAt: latest - 30 });
    expect(replyReviewOutcome([pass()], latest + 6 * HOUR)).toMatchObject({ disposition: 'unknown', observedAt: latest - 30,
      observed: { recentObservations: 0 } });
    expect(replyReviewOutcome([pass()], latest - HOUR).disposition).toBe('unknown');
  });
  it('extracts exact hashes from actual intent, including empty bubbles and changed final text', () => {
    const turn: Turn = { id: 'safe-test', update: 1, accepted: true, text: 'question', raw: '', at: latest, reserved: true,
      answer: 'answer', intent: 'answer', sent: 1, intentAt: latest - 20, sentAt: latest, checkDoneAt: latest - 30,
      jevReserved: true, jevReservedAt: latest - 40,
      replyChecks: pass().checks.map(check => ({ ...check, ruleIds: [], confidence: null, latencyMs: 1 })) };
    const view = { order: [turn] } as JournalView;
    expect(sentAnswers(view).reviewed).toEqual([turn]);
    const ports = { now: () => latest, liveView: () => view } as ProofPorts;
    expect(plan.probe(ports).disposition).toBe('passed');
    turn.intent = '';
    expect(plan.probe(ports)).toMatchObject({ disposition: 'failed', observed: { wrongCandidate: 1 } });
    expect(sentReviewEvidence(turn).intentDigest).toBe(sha256(''));
    turn.intent = HOLDING_REPLY;
    expect(sentAnswers(view).answers).toEqual([]);
    turn.intent = 'answer'; turn.revisionReviewReserved = true;
    turn.revisionReview = { verdict: 'pass', ruleIds: [] }; turn.correctionCandidate = 'answer';
    expect(sentReview(sentReviewEvidence(turn))).toMatchObject({ kind: 'revision', passed: true });
  });
  it('an unavailable observation relabelled passed cannot bind a witness', () => {
    const result = replyReviewOutcome([caseOf(969390668)], latest);
    expect(executeProof({ ...plan, probe: () => ({ ...result, disposition: 'passed' }) },
      { now: () => latest } as ProofPorts, 'test-generation', () => 0).disposition).toBe('unknown');
  });
});
