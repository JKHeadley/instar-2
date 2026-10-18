/** cint-L32 (plan rows #306, #307): w3-lostanswer and w3-yeswire meet on one answer path. A turn whose first answer call
 * the local timeout ended is replaced once (w3-lostanswer); the replacement's operatorAction still becomes the one exact
 * request on the P-05 review route with the operator's recorded acceptance (w3-yeswire), and the minimal path that polls
 * the review stays free of model calls. The timed-out call stays UNKNOWN, so a raise-caps proposal on that turn gets the
 * carried spend-floor refusal (w3-yesactions: no raise while a call's outcome is unknown), exactly as any turn after an
 * unsettled call does; renew-expiry is not gated on UNKNOWN calls and is issued. The timed-out outcome is the recorded
 * physical outcome of live update 6230665 (fixtures/lostanswer-live-2026-10-02.json); GitHub is a fake client. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, pendingUnknownCalls, previewTestContext, type CallOutcome } from './journal-test-worker.js';
import { createReviewYesSource, type GitHubReview, type GitHubReviewClient } from './review-yes-source.js';
import { SHARED_ACCESS_NOTE } from '../../src/operator/explicit-yes.js';
import type { ExplicitYesInstallation } from '../../src/operator/explicit-yes.js';
import { SUBSCRIPTION_PREVIEW_EXPIRY } from '../../src/assembly/production-provider.js';

const key = new Uint8Array(32).fill(43);
const OPERATOR = 7654321, REPO = 'JKHeadley/instar-2', HEAD = 'c'.repeat(40), TRIAL = 'grant:preview';
const installation: ExplicitYesInstallation = { adapter: 'github-api', machine: 'studio', installation: TRIAL, agentSpeaksAsOperatorInChat: true,
  chat: { method: 'telegram-sender', boundChatId: String(OPERATOR), operatorAccountId: String(OPERATOR), agentHoldsNoAccess: false },
  github: { method: 'github-review', repository: REPO, operatorLogin: 'JKHeadley', agentHoldsNoAccess: false,
    acceptance: { account: 'JKHeadley', installation: TRIAL, operatorMessages: ['telegram:chat:7812716706:message:121804'], acceptedAt: 500, withdrawn: null } } };
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: String(OPERATOR), operator: String(OPERATOR), grant: TRIAL,
  configurationDigest: 'sha256:offline', expires: SUBSCRIPTION_PREVIEW_EXPIRY - 86_400_000, maxCalls: 6, maxReplies: 8, maxTurns: 8, maxBytes: 32768, cursor: 0 };
const recorded = (JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/lostanswer-live-2026-10-02.json'), 'utf8')) as
  { lostFirstCall: { callOutcomes: Record<string, unknown>[] } }).lostFirstCall.callOutcomes[0]!;
const { id: _id, role: _role, at: _at, ...timedOut } = recorded;
const raise = JSON.stringify({ reply: 'I can ask for that.', memory: [], operatorAction: { action: 'raise-caps', limits: { maxCalls: 10 } } });
const renew = JSON.stringify({ reply: 'I can ask for that.', memory: [], operatorAction: { action: 'renew-expiry' } });

function fakeGitHub() {
  const opened: string[] = [], reviews: GitHubReview[] = [];
  const client: GitHubReviewClient = {
    async openRequest(input) { opened.push(input.body); return { number: 40 + opened.length, head: HEAD }; },
    async pullRequest() { return { body: opened.at(-1) ?? '', head: HEAD }; },
    async reviews() { return [...reviews]; },
    async closeRequest() { /* nothing lapses here */ } };
  return { client, opened, reviews };
}

async function run(answers: ('timeout' | string)[]) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-replaced-request-')));
  const sent: string[] = [], github = fakeGitHub();
  let now = 1000, calls = 0, next = 100;
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const review = createReviewYesSource({ client: github.client, installation: () => installation, repository: REPO,
    context: previewTestContext, now: () => now, brakes: { initialMs: 1, maxMs: 4, breakerAfter: 3 } });
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {},
    explicitYes: { context: previewTestContext, installation: () => installation, review, renewalActivation: () => `sha256:${'a'.repeat(64)}` },
    model: async input => {
      const step = answers[calls++];
      if (step === undefined) throw Error('model called beyond the test script');
      if (step !== 'timeout') return step;
      journal.append({ kind: 'call-outcome', id: input.id, role: 'model', outcome: timedOut as unknown as CallOutcome, at: now });
      return { state: 'uncertain' as const };
    },
    send: async input => { next += 1; sent.push(input.expectedText); return next; } });
  worker.intake([{ update_id: 1, message: { message_id: 50, chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR },
    text: 'can I have more calls please' } }]);
  await worker.drain();
  return { journal, worker, sent, github, calls: () => calls, tick: (ms: number) => { now += ms; },
    close: () => { try { journal.close(); } catch { /* closed */ } rmSync(root, { recursive: true, force: true }); } };
}

const approve = (r: Awaited<ReturnType<typeof run>>) =>
  r.github.reviews.push({ id: 901, state: 'APPROVED', commitId: HEAD, login: 'JKHeadley', submittedAt: new Date(1500).toISOString() });

it('a turn replaced after a timeout still carries the exact request, and its review approval completes it', async () => {
  const r = await run(['timeout', renew]);
  try {
    const turn = r.journal.view.order.at(-1)!;
    expect(r.calls()).toBe(2);
    expect(turn.answerReplaced).toBe(true);
    expect(pendingUnknownCalls(r.journal.view)).toEqual([`answer-replaced:${turn.id}`]);
    const request = r.journal.view.operatorRequests.at(-1)!;
    expect(request.request.action).toBe('renew-expiry');
    expect(request.review).toEqual({ repository: REPO, pullRequest: 41, head: HEAD });
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]).toContain(`https://github.com/${REPO}/pull/41/files`);
    // The minimal path polls and applies the approval, and never calls the model.
    approve(r); r.tick(10); await r.worker.minimal();
    expect(r.calls()).toBe(2);
    expect(r.journal.view.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
    expect(r.journal.view.operatorRequests.at(-1)!.approved?.sharedAccess?.note).toBe(SHARED_ACCESS_NOTE);
    expect(r.sent.at(-1)).toContain(SHARED_ACCESS_NOTE);
  } finally { r.close(); }
});

it('a raise on a replaced turn gets the carried spend-floor refusal, as on any turn after an unsettled call', async () => {
  const r = await run(['timeout', raise]);
  try {
    expect(r.journal.view.order.at(-1)!.answerReplaced).toBe(true);
    expect(r.journal.view.operatorRequests).toEqual([]);
    expect(r.github.opened).toEqual([]);
    expect(r.sent).toEqual([expect.stringContaining('a model call\'s outcome is still unknown')]);
    expect(r.journal.view.limits.maxCalls).toBe(6);
  } finally { r.close(); }
  // Without the timeout the same answer is issued on the review route.
  const plain = await run([raise]);
  try {
    expect(plain.journal.view.operatorRequests.at(-1)!.request.action).toBe('raise-caps');
    expect(plain.github.opened).toHaveLength(1);
  } finally { plain.close(); }
});

it('the other side: a replacement that times out too proposes nothing and opens no pull request', async () => {
  const r = await run(['timeout', 'timeout']);
  try {
    expect(r.calls()).toBe(2);
    expect(r.journal.view.operatorRequests).toEqual([]);
    expect(r.github.opened).toEqual([]);
    r.tick(10); await r.worker.minimal();
    expect(r.calls()).toBe(2);
  } finally { r.close(); }
});
