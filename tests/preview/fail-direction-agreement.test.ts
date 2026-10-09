/** Rule 95 (fail direction is declared per consumer): the operator-reply pipeline's DECLARED direction must agree
 * with what the pre-send reply review actually does. It did not. On the deployed build (cint-L13 72fb5a82) the live
 * proof room's group-O run `O-proofroom-20260930-220749` read `reviewUnavailableReleases.total = 5` — five replies
 * sent without a review pass — while `stepCoverage.operator-reply.failureDirection` served 'closed' (check O95d,
 * FAIL). Three other declarations already said open: the live gate table, the reply-review judgment, and the release
 * tests' own stated basis. Behaviour and the majority of declarations are right, and Rule 95 decides it: reachability
 * to the operator fails open (Rules 77, 86 — a low-context filter only signals, and a block needs an exact match).
 *
 * This file is the check that holds the agreement, from both ends: the static declarations now come from one place,
 * and the behaviour is replayed through the real worker so a future flip back to 'closed' fails here rather than in
 * a proof room. It also pins the closed floors, so declaring 'open' can never be read as weakening the credential
 * wall. */
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type PreviewPorts } from './journal-test-worker.js';
import { PREVIEW_LIVE_GATES, reviewUnavailableReleases } from './journal.js';
import type { JournalView } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { JEV_MODEL, jevQuestions, type JevRule, type ReplyCheckPorts } from './reply-check.js';
import { LIVE_JUDGMENTS } from './model-call-boundary.js';
import { CRITICAL_PIPELINES, stepCoverage } from './proofs.js';

const REPLY_REVIEW_GATE = 'pre-send reply review (Jev and full-context)';
const supervisors = { replyReview: true, summaryReview: true, stepCheck: false };
/** Check O95d, exactly as the live proof room evaluates it: UNTESTED (null) when nothing was released. */
const o95d = (releases: number, declared: Readonly<Record<string, { failureDirection: 'open' | 'closed' }>>) =>
  releases === 0 ? null : declared['operator-reply']?.failureDirection === 'open';

// The real recorded live shapes replayed below.
// 1. A real Jev score vector from the live preview: `lastReplyCheck.scores` of the subscription-reviewed reply in
//    `results/A-proofroom-20260930-184054/status-a3.json` (the same vector group O feeds its own Jev cases through
//    `O_JEV_SCORES`). Its own verdict was a pass, so one rule is raised past its line to reach the flagged class —
//    a derived input, named as such, exactly as O.sh's inputs note records.
const LIVE_PASS_SCORES: Record<JevRule, number> = { raw_path: 0.02, cli_command: 0.02, config_key: 0.03,
  credential: 0.03, api_endpoint: 0.06, quits_on_self: 0.16, claims_blocked: 0.18, parks_on_user: 0.42,
  defers_work: 0.13, unrecorded_blocker: 0.38 };
// 2. The complete recorded Jev answer of Justin's preview turn 969389800 ("What's my current gym locker code?",
//    2026-09-30 18:20 PDT): credential 0.51, inside Jev's unsure band (its confident line is 0.70).
const JEV_TURN_969389800 = '{"model":"jev-1.13.0","answers":{"raw_path":{"type":"noul","noul":0.01},"cli_command":{"type":"noul","noul":0.03},"config_key":{"type":"noul","noul":0.02},"credential":{"type":"noul","noul":0.51},"api_endpoint":{"type":"noul","noul":0.03},"quits_on_self":{"type":"noul","noul":0.05},"claims_blocked":{"type":"noul","noul":0.03},"parks_on_user":{"type":"noul","noul":0.17},"defers_work":{"type":"noul","noul":0.05},"unrecorded_blocker":{"type":"noul","noul":0.05}},"usage":{"input_tokens":721,"output_tokens":184}}';
// 3. What the launcher's escalate port throws when the full-context review returns state 'uncertain' (journal-agent.mjs),
//    and what the live run actually counted.
const REVIEW_UNKNOWN = 'preview: reply review unavailable';
const RECORDED_LIVE = Object.freeze({ run: 'O-proofroom-20260930-220749', build: '72fb5a824ce8c0535c223f146fba8eb9c3cf78fa',
  reviewUnavailableReleases: { total: 5, byRule: { claims_blocked: 1, unrecorded_blocker: 1, defers_work: 1, parks_on_user: 3 } },
  servedFailureDirection: 'closed' as const });

const key = new Uint8Array(32).fill(95);
const now = 1790000000000;
const ANSWER = 'I set your reminder for Friday at 9.';
const CANDIDATE = ANSWER;
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' as const }, from: { id: 7654321 }, text } });
const genesis = () => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 120, maxReplies: 80, maxTurns: 80, maxBytes: 32768, cursor: 0 });
const jevBody = (scores: Record<JevRule, number>) => JSON.stringify({ model: JEV_MODEL,
  answers: Object.fromEntries(Object.keys(jevQuestions).map(id => [id, { type: 'noul', noul: scores[id as JevRule] }])) });
const jevFrom = (body: string): ReplyCheckPorts['jev'] => async () => ({ value: JSON.parse(body) as unknown, latencyMs: 191 });
const ports = (sent: string[], jev: ReplyCheckPorts['jev'], escalate: ReplyCheckPorts['escalate']): PreviewPorts => ({
  now: () => now, stopped: () => false, model: async () => JSON.stringify({ reply: ANSWER, memory: [] }),
  prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', now),
  send: async input => { sent.push(input.expectedText); return sent.length; }, checkOutbound: () => {},
  replyCheck: { jev, escalate, elapsedMs: () => 0 } });
const reviewUnknown: ReplyCheckPorts['escalate'] = async () => { throw Error(REVIEW_UNKNOWN); };
const reviewPasses: ReplyCheckPorts['escalate'] = async () => ({ verdict: 'pass', ruleIds: [], confidence: null,
  latencyMs: 1200, reason: 'parks_on_user: PASS | the reply does the work itself',
  findings: [{ rule: 'parks_on_user', verdict: 'pass', reason: 'The reply acts; nothing is handed back.' }] });

/** One turn through the real worker, then its durable replay, as the live runner drives it. */
async function turn(options: { jev: string; escalate: ReplyCheckPorts['escalate'] }) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-fail-direction-')));
  try {
    const path = join(root, 'journal.encrypted'), sent: string[] = [];
    const journal = openPreviewJournal(path, key, genesis());
    const worker = createJournalWorker(journal, ports(sent, jevFrom(options.jev), options.escalate));
    worker.intake([update(1, 'Remind me on Friday at 9')]);
    await worker.drain(); await worker.drain();
    const view: JournalView = journal.view;
    const result = { sent, held: view.order[0]?.held, releases: reviewUnavailableReleases(view),
      coverage: stepCoverage(view, supervisors) };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('the declared direction of every reply-review-gated pipeline comes from the one live gate table', () => {
  const gate = PREVIEW_LIVE_GATES.find(entry => entry.gate === REPLY_REVIEW_GATE);
  // A renamed gate must fail here, not fall back to a stale literal (the lookup itself throws at import).
  expect(gate, `no live gate named ${REPLY_REVIEW_GATE}`).toBeDefined();
  expect(gate?.fails).toBe('open');
  expect(gate?.basis).toContain('95');
  const gated = Object.entries(CRITICAL_PIPELINES).filter(([, pipeline]) =>
    pipeline.steps.some(step => step.supervisors.includes('reply-review')));
  expect(gated.map(([name]) => name)).toEqual(['operator-reply', 'requested-action']);
  for (const [name, pipeline] of gated) expect(pipeline.failureDirection, name).toBe(gate?.fails);
  // The owner sentence must not re-assert the hold the behaviour does not do, and must name the floors that do hold.
  for (const [name, pipeline] of gated) {
    expect(pipeline.owner, name).not.toContain('holds the send without a pass');
    expect(pipeline.owner, name).toContain('mandatory floors');
  }
  // The third declaration of the same gate: the reply review is a signal whose unavailable case fails open.
  expect(LIVE_JUDGMENTS['reply-review'].authority).toBe('signal');
  expect(LIVE_JUDGMENTS['reply-review'].invalid).toContain('reachability fails open');
});

it('a release while the review is unavailable: the reply is sent and the declared direction agrees (O95d)', async () => {
  const flagged = await turn({ jev: jevBody({ ...LIVE_PASS_SCORES, parks_on_user: 0.91 }), escalate: reviewUnknown });
  expect(flagged.sent).toEqual([CANDIDATE]);
  expect(flagged.held).toBeUndefined();
  expect(flagged.releases).toEqual({ total: 1, byRule: { parks_on_user: 1 } });
  expect(flagged.coverage['operator-reply']?.failureDirection).toBe('open');
  expect(o95d(flagged.releases.total, flagged.coverage)).toBe(true);
  // The same gate, the same direction, for the other pipeline it supervises.
  expect(flagged.coverage['requested-action']?.failureDirection).toBe('open');
});

it('the recorded live shape of turn 969389800 is also a release: Jev\'s unsure credential band is not a secret finding', async () => {
  const unsure = await turn({ jev: JEV_TURN_969389800, escalate: reviewUnknown });
  expect(unsure.sent).toEqual([CANDIDATE]);
  expect(unsure.held).toBeUndefined();
  // Counted under the rule Jev named. Its unsure band escalated and the escalation gave no verdict, so no confident
  // secret finding exists (plan #144); the confident-credential case below is the one that holds.
  expect(unsure.releases).toEqual({ total: 1, byRule: { credential: 1 } });
  expect(o95d(unsure.releases.total, unsure.coverage)).toBe(true);
});

it('the other side: a review that answers releases nothing, so O95d is UNTESTED rather than passing by accident', async () => {
  const passed = await turn({ jev: jevBody({ ...LIVE_PASS_SCORES, parks_on_user: 0.91 }), escalate: reviewPasses });
  expect(passed.sent).toEqual([CANDIDATE]);
  expect(passed.releases).toEqual({ total: 0, byRule: {} });
  expect(o95d(passed.releases.total, passed.coverage)).toBeNull();
});

it('open is declared for the advisory class only: a confident Jev credential flag with no review verdict still holds', async () => {
  const secret = await turn({ jev: jevBody({ ...LIVE_PASS_SCORES, credential: 0.93 }), escalate: reviewUnknown });
  expect(secret.sent).toEqual([]);
  expect(secret.held).toBe('reply check unavailable');
  expect(secret.releases).toEqual({ total: 0, byRule: {} });
  // The floors are declared closed in the same gate table the direction above comes from.
  const closed = PREVIEW_LIVE_GATES.filter(entry => entry.gate.startsWith('credential'));
  expect(closed.map(entry => entry.fails)).toEqual(['closed', 'closed']);
});

it('the check is not vacuous: the recorded live run\'s own numbers read FAIL against the declaration it served', () => {
  // Group O's observation, replayed: five releases against a served 'closed' direction is the disagreement.
  expect(o95d(RECORDED_LIVE.reviewUnavailableReleases.total,
    { 'operator-reply': { failureDirection: RECORDED_LIVE.servedFailureDirection } })).toBe(false);
  // The same numbers against today's tree read PASS.
  expect(o95d(RECORDED_LIVE.reviewUnavailableReleases.total, CRITICAL_PIPELINES)).toBe(true);
  expect(Object.keys(RECORDED_LIVE.reviewUnavailableReleases.byRule)).not.toContain('credential');
});
