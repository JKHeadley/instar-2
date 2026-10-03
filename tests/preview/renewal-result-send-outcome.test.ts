import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, operatorRequestsReport, previewTestContext, projectionDigest, sendOutcomeCounts } from './journal-test-worker.js';
import { SUBSCRIPTION_PREVIEW_EXPIRY } from '../../src/assembly/production-provider.js';
import { createReviewYesSource, type GitHubReview, type GitHubReviewClient } from './review-yes-source.js';
import type { ExplicitYesInstallation } from '../../src/operator/explicit-yes.js';
import type { SendOutcome } from './outbound-provenance.js';

// cint-L34 (plan rows #335, #336): w3-renewal1012's renewal completes on the operator's GitHub Approve and sends the fixed
// completion line; w3-sendunknown makes the one outbound funnel dispatch a send the transport proves never reached the
// network once more. The completion line is pushed through that same funnel, so it gets the same second attempt, and a
// second proof is recorded refused; an outcome that may have delivered is never repeated. The rows reopen from a snapshot.
// Status shows the completion line's state on its operator request (resultNotice) and its reason as the newest
// refusal or unknown row; the per-reply counts (accepted/refused/unknown, unknownReasons) cover answers, not this line.
const key = new Uint8Array(32).fill(53);
const OPERATOR = 7654321, REPO = 'JKHeadley/instar-2', HEAD = 'b'.repeat(40), TRIAL = 'grant:preview';
const ACTIVATION = `sha256:${'c'.repeat(64)}`;
const install: ExplicitYesInstallation = {
  adapter: 'github-api', machine: 'laptop', installation: TRIAL, agentSpeaksAsOperatorInChat: true,
  chat: { method: 'telegram-sender', boundChatId: String(OPERATOR), operatorAccountId: String(OPERATOR), agentHoldsNoAccess: false },
  github: { method: 'github-review', repository: REPO, operatorLogin: 'JKHeadley', agentHoldsNoAccess: false,
    acceptance: { account: 'JKHeadley', installation: TRIAL, operatorMessages: ['telegram:chat:7812716706:message:121804'],
      acceptedAt: 500, withdrawn: null } } };
const START = SUBSCRIPTION_PREVIEW_EXPIRY - 30 * 86_400_000, END = SUBSCRIPTION_PREVIEW_EXPIRY - 86_400_000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: String(OPERATOR), operator: String(OPERATOR), grant: TRIAL,
  configurationDigest: 'sha256:offline', expires: END, maxCalls: 6, maxReplies: 8, maxTurns: 8, maxBytes: 32768, cursor: 0 };
const message = (update: number, messageId: number, text: string) => ({ update_id: update,
  message: { message_id: messageId, chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR }, text } });
/** The transport's own proof that nothing reached the network (scripts/production-boot-io.mjs, exit 125 before exec). */
const NOT_SENT: SendOutcome = { kind: 'not-sent', reason: 'not sent: transport transport at launch-refused' };
/** The live ambiguous shape: the child may have reached Telegram. */
const AMBIGUOUS: SendOutcome = { kind: 'unknown', reason: 'transport transport at fetch-failure' };

/** `result` answers each send of the completion line in turn; every other send is accepted. */
function harness(path: string, result: SendOutcome[]) {
  let now = START, next = 100;
  const sends: { target: string; text: string }[] = [], reviews: GitHubReview[] = [];
  let opened = '';
  const client: GitHubReviewClient = {
    async openRequest(input) { opened = input.body; return { number: 41, head: HEAD }; },
    async pullRequest() { return { body: opened, head: HEAD }; },
    async reviews() { return [...reviews]; },
    async closeRequest() { /* no lapsed request here */ } };
  const review = createReviewYesSource({ client, installation: () => install, repository: REPO, context: previewTestContext,
    now: () => now, brakes: { initialMs: 1, maxMs: 4, breakerAfter: 3 } });
  const journal = openPreviewJournal(path, key, genesis);
  const ports = { now: () => now, stopped: () => false, checkOutbound: () => {},
    model: async () => JSON.stringify({ memory: [], reply: 'I can ask.', operatorAction: { action: 'renew-expiry' } }),
    explicitYes: { context: previewTestContext, installation: () => install, review, renewalActivation: () => ACTIVATION },
    send: async (input: { target: string; expectedText: string }) => {
      sends.push({ target: input.target, text: input.expectedText });
      if (input.target.startsWith('operator-result:') && result.length) return result.shift()!;
      next += 1; return next; } };
  const worker = createJournalWorker(journal, ports);
  const approve = async () => {
    worker.intake([message(1, 50, 'please extend the trial')]); await worker.drain();
    const request = journal.view.operatorRequests.at(-1)!;
    expect(request.request.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
    expect(request.review).toEqual({ repository: REPO, pullRequest: 41, head: HEAD });
    reviews.push({ id: 901, state: 'APPROVED', commitId: HEAD, login: 'JKHeadley', submittedAt: new Date(START + 500).toISOString() });
    now += 10; await worker.minimal();
    return request.request.id;
  };
  const resultSends = () => sends.filter(item => item.target.startsWith('operator-result:'));
  return { journal, worker, ports, approve, resultSends, tick: () => { now += 10; } };
}
const withRoot = async (run: (path: string) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-renewal-result-')));
  try { await run(join(root, 'journal.encrypted')); } finally { rmSync(root, { recursive: true, force: true }); }
};

it('sends the renewal\'s completion line again when the transport proves the first attempt never left the machine', () => withRoot(async path => {
  const h = harness(path, [NOT_SENT]);
  const id = await h.approve();
  expect(h.journal.view.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
  // Two dispatches of the one signed intent, the same bytes, and it is delivered: no send-outcome row, nothing unknown.
  expect(h.resultSends()).toHaveLength(2);
  expect(h.resultSends()[1]!.text).toBe(h.resultSends()[0]!.text);
  expect(h.resultSends()[0]!.text).toContain('approved through your GitHub account');
  expect(h.journal.view.operatorRequests.at(-1)!.resultNotice?.sent).toBeGreaterThan(100);
  expect(h.journal.view.sendOutcomes.filter(row => row.target === `operator-result:${id}`)).toEqual([]);
  expect(operatorRequestsReport(h.journal.view, START + 100).at(-1)).toMatchObject({ state: 'applied', resultNotice: 'api-accepted' });
  expect(sendOutcomeCounts(h.journal.view)).toMatchObject({ refused: 0, unknown: 0, lastRefusal: null, lastUnknown: null });
  // A later poll sends nothing more.
  h.tick(); await h.worker.minimal();
  expect(h.resultSends()).toHaveLength(2);
  h.journal.close();
}));

it('records a second proof as refused, keeps it through a compaction snapshot, and never dispatches it again', () => withRoot(async path => {
  const h = harness(path, [NOT_SENT, NOT_SENT]);
  const id = await h.approve();
  expect(h.resultSends()).toHaveLength(2);
  const rows = h.journal.view.sendOutcomes.filter(row => row.target === `operator-result:${id}`);
  expect(rows).toMatchObject([{ outcome: 'refused', reason: 'not sent: transport transport at launch-refused' }]);
  expect(operatorRequestsReport(h.journal.view, START + 100).at(-1)).toMatchObject({ state: 'applied', resultNotice: 'refused' });
  const counts = sendOutcomeCounts(h.journal.view);
  expect(counts).toMatchObject({ unknown: 0, lastUnknown: null,
    lastRefusal: { target: `operator-result:${id}`, reason: 'not sent: transport transport at launch-refused' } });
  const report = JSON.stringify(operatorRequestsReport(h.journal.view, START + 100));
  // The validate-before-write path refuses a second outcome for the settled target.
  expect(() => h.journal.append({ kind: 'send-outcome', target: `operator-result:${id}`, outcome: 'unknown', reason: 'x', at: START + 100 }))
    .toThrow();
  const before = projectionDigest(h.journal.view);
  h.journal.compact(); h.journal.close();
  const reopened = openPreviewJournal(path, key);
  expect(projectionDigest(reopened.view)).toBe(before);
  expect(reopened.view.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
  expect(sendOutcomeCounts(reopened.view)).toEqual(counts);
  expect(JSON.stringify(operatorRequestsReport(reopened.view, START + 100))).toBe(report);
  // A worker on the reopened journal never sends the settled line again.
  const sends: string[] = [];
  const worker = createJournalWorker(reopened, { ...h.ports, send: async (input: { target: string }) => { sends.push(input.target); return 999; } });
  await worker.minimal(); await worker.drain();
  expect(sends.filter(target => target.startsWith('operator-result:'))).toEqual([]);
  reopened.close();
}));

it('dispatches the completion line exactly once when its outcome may have delivered, and status shows why it is unknown', () => withRoot(async path => {
  const h = harness(path, [AMBIGUOUS]);
  await h.approve();
  expect(h.resultSends()).toHaveLength(1);
  expect(operatorRequestsReport(h.journal.view, START + 100).at(-1)).toMatchObject({ state: 'applied', resultNotice: 'unknown' });
  expect(sendOutcomeCounts(h.journal.view)).toMatchObject({ lastRefusal: null,
    lastUnknown: { target: expect.stringMatching(/^operator-result:/u), reason: 'transport transport at fetch-failure' } });
  h.tick(); await h.worker.minimal();
  expect(h.resultSends()).toHaveLength(1);
  h.journal.close();
}));
