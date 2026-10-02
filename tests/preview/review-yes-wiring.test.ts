import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { readFileSync } from 'node:fs';
import { conclusionText, parseModelJson } from './model-json.js';
import { decisionWithinFloor } from './model-call-boundary.js';
import { createJournalWorker, openPreviewJournal, operatorRequestsReport, previewTestContext, projectionDigest } from './journal-test-worker.js';
import { approvalDisclosureText, replyReviewReserveFor } from './journal.js';
import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { APPROVAL_REPORT, JEV_MODEL, jevQuestions } from './reply-check.js';
import { operatorActionSurface, operatorResultText, operatorYesAuthority, explicitYesStatus } from './operator-yes.js';
import { createReviewYesSource, type GitHubReview, type GitHubReviewClient } from './review-yes-source.js';
import { createGitHubReviewClient } from './github-review-client.js';
import { parseExplicitYesInstallation } from './explicit-yes-installation.js';
import { produceExplicitYes, SHARED_ACCESS_NOTE } from '../../src/operator/explicit-yes.js';
import type { ExplicitYesInstallation, ExplicitYesRequest, OperatorAcceptance } from '../../src/operator/explicit-yes.js';
import { consumeResult } from '../../src/index.js';
import type { Clock, Hash, Scope, VerifiedPrincipal } from '../../src/index.js';

// Plan rows #297, #307; Purpose "the agent never administers its own safeguards, except for approval-account access
// expressly accepted by the operator" (PR #144). Where the agent can speak as the operator in chat (P-05), the operator's
// yes is an APPROVED review of the request's pull request by the pinned GitHub account. That account may be one the agent
// can also use only under the operator's current recorded acceptance; every approval consumed under it carries the
// shared-access disclosure, a withdrawal stops consumption from the next poll, and the agent's client cannot approve.
const key = new Uint8Array(32).fill(41);
const OPERATOR = 7654321, REPO = 'JKHeadley/instar-2', HEAD = 'a'.repeat(40), TRIAL = 'grant:preview';
const acceptance = (over: Partial<OperatorAcceptance> = {}): OperatorAcceptance => ({ account: 'JKHeadley', installation: TRIAL,
  operatorMessages: ['telegram:chat:7812716706:message:121804'], acceptedAt: 500, withdrawn: null, ...over });
type GitHubFacts = NonNullable<ExplicitYesInstallation['github']>;
const installation = (github: Partial<GitHubFacts> = {}, over: Partial<ExplicitYesInstallation> = {}): ExplicitYesInstallation => ({
  adapter: 'github-api', machine: 'laptop', installation: TRIAL, agentSpeaksAsOperatorInChat: true,
  chat: { method: 'telegram-sender', boundChatId: String(OPERATOR), operatorAccountId: String(OPERATOR), agentHoldsNoAccess: false },
  github: { method: 'github-review', repository: REPO, operatorLogin: 'JKHeadley', agentHoldsNoAccess: false, acceptance: acceptance(), ...github },
  ...over });
const noAccess = () => installation({ agentHoldsNoAccess: true, acceptance: null });
const clock = (at: number) => ({ type: 'Measurement', schemaVersion: 1, subject: { kind: 'clock', instance: 't' }, value: at, unit: 'unix-ms',
  at, by: 't' }) as unknown as Clock;

// --- 1. The admission (Part One's single route), both sides of every acceptance condition. ---
const yesRequest: ExplicitYesRequest = { requestId: '0123456789abcdef', requestDigest: `sha256:${'d'.repeat(64)}` as Hash,
  authorizationId: 'authorization:0123456789abcdef', approver: { kind: 'person', id: String(OPERATOR) } as unknown as VerifiedPrincipal,
  requestedBy: { kind: 'system', id: 'preview-runner' } as unknown as VerifiedPrincipal, under: TRIAL, action: 'raise-caps',
  scope: { type: 'Scope', schemaVersion: 1, kind: 'conversation', members: [String(OPERATOR)] } as unknown as Scope,
  artifact: `sha256:${'d'.repeat(64)}` as Hash, base: 'b'.repeat(16), kind: { kind: 'approval' } as ExplicitYesRequest['kind'],
  chatMessageId: null, head: HEAD, issuedAt: 1000, expiresAt: 100_000 };
const reviewObservation = (over: object = {}) => ({ kind: 'github-review' as const, repository: REPO, pullRequest: 7,
  pullRequestBody: 'Approval request 0123456789abcdef', reviewId: '901', commitId: HEAD, state: 'APPROVED', reviewerLogin: 'JKHeadley',
  at: clock(2000), ...over });
type Verdict = { kind: 'approved'; record: import('../../src/operator/explicit-yes.js').ExplicitYesRecord } | { kind: 'refused'; detail: string };
const admit = (install: ExplicitYesInstallation, over: object = {}, consumed: readonly string[] = []) =>
  consumeResult<import('../../src/operator/explicit-yes.js').ExplicitYesRecord, Verdict>(produceExplicitYes(yesRequest, install, reviewObservation(over), consumed, previewTestContext),
    { Success: record => ({ kind: 'approved', record }), Refused: refused => ({ kind: 'refused', detail: refused.detail }) });

it('admits a genuine approval under a current acceptance, and carries the disclosure in the recorded bytes', () => {
  const accepted = admit(installation());
  expect(accepted.kind).toBe('approved');
  const record = accepted.kind === 'approved' ? accepted.record : null;
  expect(record?.sharedAccess).toEqual({ account: 'JKHeadley', installation: TRIAL, acceptedAt: 500, note: SHARED_ACCESS_NOTE });
  expect(record?.bytes).toContain(SHARED_ACCESS_NOTE);
  // The no-access route: admitted, and no disclosure anywhere in what it records.
  const plain = admit(noAccess());
  expect(plain.kind === 'approved' && plain.record.sharedAccess).toBeNull();
  expect(plain.kind === 'approved' && plain.record.bytes).not.toContain(SHARED_ACCESS_NOTE);
});

it('refuses when the acceptance is withdrawn, names another account or installation, is absent, contradicted or predates', () => {
  const refused = (install: ExplicitYesInstallation, detail: string, over: object = {}) =>
    expect(admit(install, over), detail).toEqual({ kind: 'refused', detail: expect.stringContaining(detail) });
  refused(installation({ acceptance: acceptance({ withdrawn: 1500 }) }), 'withdrew');
  refused(installation({ acceptance: acceptance({ account: 'SomeoneElse' }) }), 'another account');
  refused(installation({ acceptance: acceptance({ installation: 'grant:other' }) }), 'another installation');
  const { installation: _unnamed, ...unnamed } = installation();
  refused(unnamed, 'another installation');
  refused(installation({ acceptance: null }), 'no P-02 record');
  refused(installation({ agentHoldsNoAccess: true }), 'both says the agent holds no access and records an acceptance');
  refused(installation({ acceptance: acceptance({ operatorMessages: [] }) }), 'cites no recorded operator words');
  refused(installation({ acceptance: acceptance({ acceptedAt: 3000 }) }), 'predates the operator acceptance');
  // Everything else in the admission is unchanged under an acceptance: the pinned login, the exact head, one use.
  refused(installation(), 'not by the pinned operator GitHub account', { reviewerLogin: 'EchoOfDawn' });
  refused(installation(), 'exact head', { commitId: 'b'.repeat(40) });
  expect(admit(installation(), {}, [`github:${REPO}:review:901`])).toEqual({ kind: 'refused', detail: expect.stringContaining('already used') });
});

// --- 2. The installation record: exactly as the desk writes it, never defaulted. ---
const deskRecord = (github: Record<string, unknown> = {}) => JSON.stringify({ type: 'ExplicitYesInstallation', schemaVersion: 1,
  installation: TRIAL, adapter: 'github-api', machine: 'Mac Studio', agentSpeaksAsOperatorInChat: true,
  chat: { method: 'telegram-sender', boundChatId: '7812716706', operatorAccountId: '7812716706', agentHoldsNoAccess: false },
  github: { method: 'github-review', repository: REPO, operatorLogin: 'JKHeadley', agentHoldsNoAccess: false,
    acceptance: { account: 'JKHeadley', installation: TRIAL, operatorMessages: ['telegram:topic:102965:message:121802',
      'telegram:topic:102965:message:121804', 'telegram:topic:102965:message:121824'], acceptedAt: '2026-10-02T20:01:17Z', withdrawn: null }, ...github } });

it('reads the record exactly, and refuses one that defaults, contradicts or adds a fact', () => {
  const parsed = parseExplicitYesInstallation(deskRecord());
  expect(parsed.github?.acceptance).toEqual({ account: 'JKHeadley', installation: TRIAL, operatorMessages: expect.any(Array),
    acceptedAt: Date.parse('2026-10-02T20:01:17Z'), withdrawn: null });
  expect(parseExplicitYesInstallation(deskRecord({ acceptance: null, agentHoldsNoAccess: true })).github?.acceptance).toBeNull();
  const withdrawn = parseExplicitYesInstallation(deskRecord({ acceptance: { ...JSON.parse(deskRecord()).github.acceptance, withdrawn: '2026-10-03T08:00:00Z' } }));
  expect(withdrawn.github?.acceptance?.withdrawn).toBe(Date.parse('2026-10-03T08:00:00Z'));
  const bad = (github: Record<string, unknown>, detail: string) => expect(() => parseExplicitYesInstallation(deskRecord(github)), detail).toThrow(detail);
  bad({ agentHoldsNoAccess: undefined }, 'must be stated');
  bad({ acceptance: undefined }, 'acceptance must be stated');
  bad({ agentHoldsNoAccess: true }, 'both');
  bad({ extra: 1 }, 'unknown github field');
  bad({ acceptance: { ...JSON.parse(deskRecord()).github.acceptance, withdrawn: undefined } }, 'withdrawn');
  bad({ acceptance: { ...JSON.parse(deskRecord()).github.acceptance, operatorMessages: [] } }, 'recorded messages');
  expect(() => parseExplicitYesInstallation('{')).toThrow('not JSON');
});

// --- 3. The agent's duty: its client cannot approve, and it authenticates as the agent. ---
it('gives the real GitHub client no way to submit a review, and uses the token it is handed', async () => {
  const calls: { url: string; method: string; auth: string; body?: string }[] = [];
  const http = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    calls.push({ url, method: init.method, auth: init.headers.Authorization!, ...(init.body ? { body: init.body } : {}) });
    const path = url.replace('https://api.github.com', '');
    const json = path === `/repos/${REPO}` ? { default_branch: 'main' } : path.includes('/git/ref/heads/') ? { object: { sha: 'f'.repeat(40) } }
      : path === `/repos/${REPO}/pulls` ? { number: 12, head: { sha: HEAD } } : path.endsWith('/reviews?per_page=100')
        ? [{ id: 5, state: 'APPROVED', commit_id: HEAD, user: { login: 'JKHeadley' }, submitted_at: '2026-10-02T21:00:00Z' }] : {};
    return { ok: true, status: 200, json: async () => json };
  };
  const client = createGitHubReviewClient({ token: 'agent-token', http });
  expect(Object.keys(client).sort()).toEqual(['closeRequest', 'openRequest', 'pullRequest', 'reviews']);
  expect(await client.openRequest({ repository: REPO, branch: 'instar-request-x', title: 't', body: 'b', path: 'requests/x.md', content: 'c' }))
    .toEqual({ number: 12, head: HEAD });
  expect(await client.reviews(REPO, 12)).toEqual([{ id: '5', state: 'APPROVED', commitId: HEAD, login: 'JKHeadley', submittedAt: '2026-10-02T21:00:00Z' }]);
  await client.closeRequest(REPO, 12);
  expect(calls.every(call => call.auth === 'Bearer agent-token')).toBe(true);
  // No call ever reaches a review-submitting endpoint (POST .../reviews or PUT .../events).
  expect(calls.filter(call => /\/reviews/u.test(call.url) && call.method !== 'GET')).toEqual([]);
  expect(calls.map(call => `${call.method} ${call.url.replace('https://api.github.com', '')}`)).toEqual([`GET /repos/${REPO}`,
    `GET /repos/${REPO}/git/ref/heads/main`, `POST /repos/${REPO}/git/refs`, `PUT /repos/${REPO}/contents/requests/x.md`, `POST /repos/${REPO}/pulls`,
    `GET /repos/${REPO}/pulls/12/reviews?per_page=100`, `PATCH /repos/${REPO}/pulls/12`]);
  expect(() => createGitHubReviewClient({ token: '', http })).toThrow('GitHub token unavailable');
});

// --- 4. The wired worker: issue, poll, admit, apply, disclose, withdraw, close. ---
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: String(OPERATOR), operator: String(OPERATOR), grant: TRIAL,
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 6, maxReplies: 8, maxTurns: 8, maxBytes: 32768, cursor: 0 };
const message = (update: number, messageId: number, text: string) => ({ update_id: update,
  message: { message_id: messageId, chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR }, text } });
const raise = { reply: 'I can ask for that.', operatorAction: { action: 'raise-caps', limits: { maxCalls: 10 } } };
function fakeGitHub() {
  const opened: { body: string }[] = [], closed: number[] = [], reviews: GitHubReview[] = [];
  let pulls = 0;
  const client: GitHubReviewClient = {
    async openRequest(input) { pulls++; opened.push({ body: input.body }); return { number: 40 + pulls, head: HEAD }; },
    async pullRequest() { return { body: opened.at(-1)?.body ?? '', head: HEAD }; },
    async reviews() { return [...reviews]; },
    async closeRequest(_repository, number) { closed.push(number); } };
  return { client, opened, closed, reviews };
}
type Usage = { inputTokens: null; outputTokens: null; charge: null };
type ModelAnswer = string | { state: 'complete'; text: string; usage: Usage } | { state: 'complete'; failureClass: 'malformed'; usage: Usage };
/** The reply reviewer (Jev) as the worker calls it: every reply rule clears, and the approval-report question, when it
 * is asked at all, is answered by `report` (a probability, `undefined` for an answer without it, or a thrown error). */
type JevQuestions = Record<string, { type: string; instructions: string }> | undefined;
type Reviewer = { asked: JevQuestions[]; report: (text: string) => number | undefined; late?: number };
const harness = (path: string, install: { current: ExplicitYesInstallation }, model?: (question: string) => ModelAnswer, start = 1000,
  g: typeof genesis = genesis, reviewer?: Reviewer, prepared?: { bytes?: number }) => {
  const sent: { text: string; id: number }[] = [];
  let now = start, next = 100, calls = 0;
  const github = fakeGitHub();
  const review = createReviewYesSource({ client: github.client, installation: () => install.current, repository: REPO,
    context: previewTestContext, now: () => now, brakes: { initialMs: 1, maxMs: 4, breakerAfter: 3 } });
  const journal = openPreviewJournal(path, key, g);
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {},
    // An answer's prepared prompt of a set size (the parts no floor rung can shed); summaries and other passes unchanged.
    ...(prepared ? { prepareModel: (input: { id: string; question: string; context: string }) => prepared.bytes !== undefined
      && input.id.startsWith('telegram:') ? `${input.id}:${'x'.repeat(prepared.bytes - input.id.length - 1)}`
      : `${input.question}\n${input.context}` } : {}),
    model: async (input: { question: string }) => { calls++; return model ? model(input.question)
      : JSON.stringify({ memory: [], ...(input.question.includes('more calls') ? raise : { reply: 'ok' }) }); },
    explicitYes: { context: previewTestContext, installation: () => install.current, review },
    send: async (input: { expectedText: string }) => { next += 1; sent.push({ text: input.expectedText, id: next }); return next; },
    ...(reviewer ? { replyCheck: { elapsedMs: () => now,
      escalate: async () => { throw Error('no contextual review in this harness'); },
      jev: async (text: string, questions?: JevQuestions) => {
        reviewer.asked.push(questions);
        // A late answer: the shared reply-check deadline passes before it arrives.
        if (reviewer.late !== undefined) now += reviewer.late;
        const noul = questions && APPROVAL_REPORT in questions ? reviewer.report(text) : undefined;
        return { latencyMs: 5, value: { model: JEV_MODEL, answers: { ...Object.fromEntries(Object.keys(jevQuestions).map(id => [id, { type: 'noul', noul: 0.01 }])),
          ...(noul === undefined ? {} : { [APPROVAL_REPORT]: { type: 'noul', noul } }) } } }; } } } : {}) });
  return { journal, worker, sent, github, tick: (ms: number) => { now += ms; }, calls: () => calls };
};
const withRoot = async (run: (path: string) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-review-yes-')));
  try { await run(join(root, 'journal.encrypted')); } finally { rmSync(root, { recursive: true, force: true }); }
};
const approve = (h: ReturnType<typeof harness>, id = 901, login = 'JKHeadley') =>
  h.github.reviews.push({ id, state: 'APPROVED', commitId: HEAD, login, submittedAt: new Date(1500).toISOString() });
const ask = async (h: ReturnType<typeof harness>) => {
  h.worker.intake([message(1, 50, 'can I have more calls please')]); await h.worker.drain();
  return h.journal.view.operatorRequests.at(-1)!;
};

it('issues the pull request with the link on the reply, and completes a review approval with the disclosure everywhere it shows', () => withRoot(async path => {
  const install = { current: installation() }, h = harness(path, install);
  const request = await ask(h);
  expect(request.review).toEqual({ repository: REPO, pullRequest: 41, head: HEAD });
  expect(h.sent.at(-1)!.text).toContain(`open https://github.com/${REPO}/pull/41/files and approve the pull request`);
  expect(h.github.opened[0]!.body).toContain(`Approval request ${request.request.id}`);
  // A chat "yes" is not the operator's yes here (P-05): nothing changes.
  h.worker.intake([message(2, h.sent.at(-1)!.id + 1, 'yes')]);
  expect(h.journal.view.limits.maxCalls).toBe(6);
  // A COMMENTED review is judged once and changes nothing; the approval then completes it once.
  h.github.reviews.push({ id: 900, state: 'COMMENTED', commitId: HEAD, login: 'JKHeadley', submittedAt: new Date(1400).toISOString() });
  h.tick(10); await h.worker.minimal();
  expect(h.journal.view.operatorRequests.at(-1)!.reviewsSeen).toEqual(['900']);
  h.tick(10); await h.worker.minimal();
  // Two refusals: the chat "yes" (P-05) and the COMMENTED review, the latter recorded once however often it is polled.
  expect(h.journal.view.operatorRequests.at(-1)!.refusals.map(item => item.turn.startsWith('review:'))).toEqual([false, true]);
  approve(h); h.tick(10); await h.worker.minimal();
  const done = h.journal.view.operatorRequests.at(-1)!;
  expect(h.journal.view.limits.maxCalls).toBe(10);
  expect(done.approved?.sharedAccess?.note).toBe(SHARED_ACCESS_NOTE);
  // The applied frame's authority string, the operator's completion line, status and inspect all carry it.
  expect(h.journal.view.capAuthority).toBe(operatorYesAuthority(request.request.id, `github:${REPO}:review:901`, true));
  expect(h.journal.view.capAuthority).toContain(SHARED_ACCESS_NOTE);
  const line = h.sent.at(-1)!.text;
  expect(line).toBe(operatorResultText(done.request, { limits: { maxCalls: 6, maxReplies: 8, maxTurns: 8 }, expires: genesis.expires }, true));
  expect(line).toContain(`approved through your GitHub account; note: ${SHARED_ACCESS_NOTE}`);
  expect(done.resultNotice?.sent).toBe(h.sent.at(-1)!.id);
  expect(operatorRequestsReport(h.journal.view, 2000).at(-1)).toMatchObject({ route: 'github-review', state: 'applied',
    sharedAccess: { account: 'JKHeadley', disclosure: SHARED_ACCESS_NOTE }, resultNotice: 'api-accepted' });
  const status = explicitYesStatus(install.current, { chat: genesis.chat, operator: genesis.operator, trial: TRIAL }, { connected: true });
  expect(status.review).toEqual({ admissible: true, acceptance: { account: 'JKHeadley', current: true, disclosure: SHARED_ACCESS_NOTE } });
  expect(operatorActionSurface(status).raiseCaps).toContain(SHARED_ACCESS_NOTE);
  // A later poll never consumes the approval again, and sends no second line.
  const count = h.sent.length; h.tick(10); await h.worker.minimal();
  expect(h.sent).toHaveLength(count);
  // Each new row kind is kept by a compaction snapshot and read back from it; the spent review stays spent.
  const before = projectionDigest(h.journal.view), requests = JSON.stringify(h.journal.view.operatorRequests);
  h.journal.compact(); h.journal.close();
  const reopened = openPreviewJournal(path, key);
  expect(projectionDigest(reopened.view)).toBe(before);
  expect(JSON.stringify(reopened.view.operatorRequests)).toBe(requests);
  expect(() => reopened.append({ kind: 'operator-review', request: request.request.id, review: '901', outcome: 'approved',
    reference: `github:${REPO}:review:901`, hash: `sha256:${'0'.repeat(64)}`, at: 3000 })).toThrow('operator review order');
  reopened.close();
}));

it('shows no disclosure on the no-access route', () => withRoot(async path => {
  const h = harness(path, { current: noAccess() });
  const request = await ask(h);
  approve(h); h.tick(10); await h.worker.minimal();
  expect(h.journal.view.limits.maxCalls).toBe(10);
  expect(h.journal.view.capAuthority).toBe(operatorYesAuthority(request.request.id, `github:${REPO}:review:901`));
  expect(h.journal.view.capAuthority).not.toContain('shared-access');
  expect(h.sent.at(-1)!.text).toMatch(/approved through your GitHub account\.$/u);
  expect(h.sent.at(-1)!.text).not.toContain(SHARED_ACCESS_NOTE);
  expect(operatorRequestsReport(h.journal.view, 2000).at(-1)).not.toHaveProperty('sharedAccess');
  expect(explicitYesStatus(noAccess(), { chat: genesis.chat, operator: genesis.operator, trial: TRIAL }, { connected: true }).review)
    .toEqual({ admissible: true });
  h.journal.close();
}));

it('asks the reply reviewer whether an answer reports a shared-access approval, and omits the note only on its readable no', () => withRoot(async path => {
  // Purpose (the approval-account exception): whether an answer reports the approval is a judgment of meaning, made by the
  // reviewer that already checks every model-written reply, in the same call; it fails toward disclosure.
  const PARAPHRASE = 'Yes — you gave the go-ahead on GitHub, and your model-call limit is now 80 (up from 40).';
  const reported = (question: string) => JSON.stringify({ memory: [], ...(question.includes('more calls') ? raise
    : { reply: question.includes('approved') ? 'Yes, that was approved and your limit is raised.'
      : question.includes('go-ahead') ? PARAPHRASE : 'Grey skies often mean rain, so an umbrella is a sensible thing to pack.' }) });
  // The stub reviewer's own meaning test: the umbrella answer reports nothing; anything else here reports the approval.
  const reviewer: Reviewer = { asked: [], report: text => text.includes('umbrella') ? 0.02 : 0.93 };
  const h = harness(path, { current: installation() }, reported, 1000, genesis, reviewer);
  await ask(h);
  // Before any approval the reviewer is asked exactly the standing questions: the request bytes are unchanged.
  expect(reviewer.asked.every(questions => questions === undefined)).toBe(true);
  approve(h); h.tick(10); await h.worker.minimal();
  const done = h.journal.view.operatorRequests.at(-1)!;
  expect(done.applied).toBe(true);
  const facts = () => reviewer.asked.at(-1)?.[APPROVAL_REPORT]?.instructions ?? '';
  const recorded = () => h.journal.view.order.at(-1)!.replyChecks?.find(check => check.path === 'jev')?.approvalReport;
  // The status answer reporting the approval: the reviewer says yes, with the facts it needs, and the note rides once.
  h.worker.intake([message(3, h.sent.at(-1)!.id + 1, 'was my raise approved?')]); await h.worker.drain();
  expect(facts()).toContain(done.request.id);
  expect(facts()).toContain('model-call allowance to 10');
  expect(facts()).toContain('an account the writer can also use');
  expect(recorded()).toEqual({ request: done.request.id, answer: 'yes', noul: 0.93 });
  expect(h.sent.at(-1)!.text).toContain('approved and your limit is raised');
  expect(h.sent.at(-1)!.text.split(SHARED_ACCESS_NOTE)).toHaveLength(2);
  expect(h.sent.at(-1)!.text).toContain(approvalDisclosureText(done));
  // Past the request's hour, the paraphrase naming neither the request nor an approval: decided by the reviewer's yes.
  h.tick(3_600_001);
  h.worker.intake([message(4, h.sent.at(-1)!.id + 1, 'did I give the go-ahead?')]); await h.worker.drain();
  expect(recorded()).toMatchObject({ answer: 'yes' });
  expect(h.sent.at(-1)!.text).toContain(PARAPHRASE);
  expect(h.sent.at(-1)!.text).toContain(approvalDisclosureText(done));
  // An unrelated answer after the approval: the reviewer's readable no, recorded with the reply, and no note.
  h.worker.intake([message(5, h.sent.at(-1)!.id + 1, 'should I bring an umbrella?')]); await h.worker.drain();
  expect(recorded()).toEqual({ request: done.request.id, answer: 'no', noul: 0.02 });
  expect(h.sent.at(-1)!.text).toContain('umbrella');
  expect(h.sent.at(-1)!.text).not.toContain(SHARED_ACCESS_NOTE);
  // The same unrelated answer when the reviewer cannot tell (between its confident lines): the note rides.
  reviewer.report = () => 0.3;
  h.worker.intake([message(6, h.sent.at(-1)!.id + 1, 'is an umbrella overkill?')]); await h.worker.drain();
  expect(recorded()).toEqual({ request: done.request.id, answer: 'undecided', noul: 0.3 });
  expect(h.sent.at(-1)!.text).toContain(approvalDisclosureText(done));
  // The same unrelated answer when the reviewer's answer cannot be read: the note rides.
  reviewer.report = () => undefined;
  h.worker.intake([message(7, h.sent.at(-1)!.id + 1, 'and tomorrow, an umbrella?')]); await h.worker.drain();
  expect(recorded()).toEqual({ request: done.request.id, answer: 'unreadable' });
  expect(h.sent.at(-1)!.text).toContain(approvalDisclosureText(done));
  // A review timeout: its "no" arrives after the shared deadline, so nothing readable decided this text, and the note rides.
  reviewer.report = () => 0.02; reviewer.late = 30_001;
  h.worker.intake([message(8, h.sent.at(-1)!.id + 1, 'umbrella for the weekend?')]); await h.worker.drain();
  expect(recorded()).toEqual({ request: done.request.id, answer: 'unreadable' });
  expect(h.sent.at(-1)!.text).toContain('umbrella');
  expect(h.sent.at(-1)!.text).toContain(approvalDisclosureText(done));
  h.journal.close();
  // The no-access neighbor: the same answers, within and past the hour, never carry the note, and the reviewer is never
  // asked the extra question (no extra bytes, no extra cost).
  const plainReviewer: Reviewer = { asked: [], report: () => 0.93 };
  const plain = harness(path.replace('journal.encrypted', 'plain.encrypted'), { current: noAccess() }, reported, 1000, genesis, plainReviewer);
  await ask(plain);
  approve(plain); plain.tick(10); await plain.worker.minimal();
  expect(plain.journal.view.operatorRequests.at(-1)!.applied).toBe(true);
  plain.worker.intake([message(3, plain.sent.at(-1)!.id + 1, 'was my raise approved?')]); await plain.worker.drain();
  expect(plain.sent.at(-1)!.text).toContain('approved and your limit is raised');
  expect(plain.sent.at(-1)!.text).not.toContain(SHARED_ACCESS_NOTE);
  plain.tick(3_600_001);
  plain.worker.intake([message(4, plain.sent.at(-1)!.id + 1, 'did I give the go-ahead?')]); await plain.worker.drain();
  expect(plain.sent.at(-1)!.text).toContain(PARAPHRASE);
  expect(plain.sent.at(-1)!.text).not.toContain(SHARED_ACCESS_NOTE);
  expect(plainReviewer.asked.length).toBeGreaterThanOrEqual(3);
  expect(plainReviewer.asked.every(questions => questions === undefined)).toBe(true);
  expect(plain.journal.view.order.flatMap(turn => turn.replyChecks ?? []).some(check => check.approvalReport)).toBe(false);
  plain.journal.close();
}));

it('carries the disclosure on a later answer when no reviewer runs at all (fail toward disclosure)', () => withRoot(async path => {
  const h = harness(path, { current: installation() });
  await ask(h);
  approve(h); h.tick(10); await h.worker.minimal();
  const done = h.journal.view.operatorRequests.at(-1)!;
  h.tick(3_600_001);
  h.worker.intake([message(3, h.sent.at(-1)!.id + 1, 'and the weather?')]); await h.worker.drain();
  expect(h.sent.at(-1)!.text).toContain('ok');
  expect(h.sent.at(-1)!.text).toContain(approvalDisclosureText(done));
  h.journal.close();
}));

it('carries the disclosure on the floor\'s last rung when the reply review cannot run, and still honours a readable no there', () => withRoot(async path => {
  // w3-defaultroot meets the approval-account exception: at the default 32768 bytes an answer whose prepared prompt fits
  // the limit but not the reply-review reserve is answered on the last rung with the reserve waived. The disclosure
  // decision is unchanged there: only the reviewer's readable "no" on the exact text omits the note, so a review that
  // cannot run (Jev and the contextual review both unavailable) carries it.
  const system = Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
  const pastReserve = genesis.maxBytes - system - replyReviewReserveFor(genesis.maxBytes) + 737;
  expect(pastReserve + system).toBeLessThanOrEqual(genesis.maxBytes);
  expect(pastReserve + system + replyReviewReserveFor(genesis.maxBytes)).toBeGreaterThan(genesis.maxBytes);
  const reviewer: Reviewer = { asked: [], report: () => 0.02 };
  const prepared: { bytes?: number } = {};
  const h = harness(path, { current: installation() }, undefined, 1000, genesis, reviewer, prepared);
  await ask(h);
  approve(h); h.tick(10); await h.worker.minimal();
  const done = h.journal.view.operatorRequests.at(-1)!;
  expect(done.applied).toBe(true);
  prepared.bytes = pastReserve;
  // The review cannot run: Jev throws and the contextual review (this harness's escalate) throws.
  reviewer.report = () => { throw Error('reviewer unavailable'); };
  h.worker.intake([message(3, h.sent.at(-1)!.id + 1, 'and the weather?')]); await h.worker.drain();
  const unavailable = h.journal.view.order.at(-1)!;
  expect(unavailable.held).toBeUndefined();
  expect(unavailable.noticeClass).toBeUndefined();
  expect(unavailable.replyChecks?.find(check => check.path === 'jev')).toMatchObject({ verdict: 'unavailable',
    approvalReport: { request: done.request.id, answer: 'unreadable' } });
  expect(h.sent.at(-1)!.text).toContain('ok');
  expect(h.sent.at(-1)!.text).toContain(approvalDisclosureText(done));
  // The neighbor on the same rung: the reviewer runs and reads "no" on this exact text, so the note is omitted.
  reviewer.report = () => 0.02;
  h.worker.intake([message(4, h.sent.at(-1)!.id + 1, 'and tomorrow?')]); await h.worker.drain();
  const judged = h.journal.view.order.at(-1)!;
  expect(judged.held).toBeUndefined();
  expect(judged.replyChecks?.find(check => check.path === 'jev')?.approvalReport).toEqual({ request: done.request.id, answer: 'no', noul: 0.02 });
  expect(h.sent.at(-1)!.text).toContain('ok');
  expect(h.sent.at(-1)!.text).not.toContain(SHARED_ACCESS_NOTE);
  h.journal.close();
}));

it('carries the review request on a capped limited answer, and applies the approval once with no model call (Rules 15, 79, 82)', () => withRoot(async path => {
  const h = harness(path, { current: installation() }, undefined, 1000, { ...genesis, maxTurns: 1 });
  h.worker.intake([message(1, 50, 'Hello')]); await h.worker.drain(); await h.worker.minimal();
  const calls = h.calls();
  h.worker.intake([message(2, h.sent.at(-1)!.id + 1, 'can I have more calls please')]); await h.worker.drain(); await h.worker.minimal();
  expect(h.calls()).toBe(calls);
  const request = h.journal.view.operatorRequests.at(-1)!;
  expect(request).toMatchObject({ via: 'limited', review: { repository: REPO, pullRequest: 41, head: HEAD } });
  expect(request.message).toBe(h.sent.at(-1)!.id);
  expect(h.github.opened).toHaveLength(1);
  expect(h.sent.at(-1)!.text).toContain('allowance');
  expect(h.sent.at(-1)!.text).toContain(`open https://github.com/${REPO}/pull/41/files and approve the pull request`);
  // The row with its review reference survives a compaction snapshot.
  const requests = JSON.stringify(h.journal.view.operatorRequests);
  h.journal.compact();
  expect(JSON.stringify(h.journal.view.operatorRequests)).toBe(requests);
  approve(h); h.tick(10); await h.worker.minimal();
  expect(h.journal.view.limits.maxTurns).toBe(request.request.limits!.maxTurns);
  expect(h.journal.view.limits.maxTurns).toBeGreaterThan(1);
  expect(h.journal.view.operatorRequests.at(-1)!.applied).toBe(true);
  expect(h.sent.some(item => item.text.includes(`Request ${request.request.id} is done`) && item.text.includes(SHARED_ACCESS_NOTE))).toBe(true);
  // A later poll applies nothing again.
  const count = h.sent.length, limits = JSON.stringify(h.journal.view.limits);
  h.tick(10); await h.worker.minimal();
  expect(JSON.stringify(h.journal.view.limits)).toBe(limits);
  expect(h.sent.filter(item => item.text.includes(`Request ${request.request.id} is done`))).toHaveLength(1);
  expect(h.sent.length).toBe(count);
  h.journal.close();
}));

it('stops consuming at the next poll once the acceptance is withdrawn, and never undoes a completed effect', () => withRoot(async path => {
  // Approve, withdraw before consumption: nothing applied, nothing consumed, the status says the acceptance is not current.
  const install = { current: installation() }, h = harness(path, install);
  await ask(h);
  approve(h);
  install.current = installation({ acceptance: acceptance({ withdrawn: 1200 }) });
  h.tick(10); await h.worker.minimal();
  expect(h.journal.view.limits.maxCalls).toBe(6);
  expect(h.journal.view.operatorRequests.at(-1)!.approved).toBeUndefined();
  expect(h.journal.view.operatorRequests.at(-1)!.reviewsSeen).toEqual([]);
  expect(explicitYesStatus(install.current, { chat: genesis.chat, operator: genesis.operator, trial: TRIAL }, { connected: true }).review)
    .toEqual({ admissible: false, reason: expect.stringContaining('withdrew'), acceptance: { account: 'JKHeadley', current: false } });
  h.journal.close();
  // Approve, consume, withdraw: the raise stands.
  const later = { current: installation() }, g = harness(path.replace('journal.encrypted', 'second.encrypted'), later);
  await ask(g);
  approve(g); g.tick(10); await g.worker.minimal();
  expect(g.journal.view.limits.maxCalls).toBe(10);
  later.current = installation({ acceptance: acceptance({ withdrawn: 5000 }) });
  g.tick(10); await g.worker.minimal();
  expect(g.journal.view.limits.maxCalls).toBe(10);
  expect(g.journal.view.operatorRequests.at(-1)!.applied).toBe(true);
  g.journal.close();
}));

it('closes a lapsed request\'s pull request once, and keeps that through a snapshot', () => withRoot(async path => {
  const h = harness(path, { current: installation() });
  const request = await ask(h);
  h.tick(request.request.expiresAt - 1000 + 1); await h.worker.minimal();
  expect(h.github.closed).toEqual([41]);
  expect(h.journal.view.operatorRequests.at(-1)!.reviewClosed).toBe(true);
  approve(h); h.tick(10); await h.worker.minimal();
  expect(h.github.closed).toEqual([41]);
  expect(h.journal.view.limits.maxCalls).toBe(6);
  const requests = JSON.stringify(h.journal.view.operatorRequests);
  h.journal.compact(); h.journal.close();
  const reopened = openPreviewJournal(path, key);
  expect(JSON.stringify(reopened.view.operatorRequests)).toBe(requests);
  // An open request's pull request cannot be recorded closed.
  reopened.close();
}));

it('refuses review rows its own projection would refuse, before they reach the file', () => withRoot(async path => {
  const h = harness(path, { current: installation() });
  const request = await ask(h);
  const id = request.request.id;
  expect(() => h.journal.append({ kind: 'operator-review', request: id, review: '901', outcome: 'approved', reference: `github:${REPO}:review:902`,
    hash: `sha256:${'0'.repeat(64)}`, at: 1500 })).toThrow('operator review refused');
  expect(() => h.journal.append({ kind: 'operator-review', request: id, review: '901', outcome: 'approved', reference: `github:${REPO}:review:901`,
    hash: `sha256:${'0'.repeat(64)}`, sharedAccess: { account: 'JKHeadley', installation: TRIAL, acceptedAt: 500, note: 'forged' }, at: 1500 }))
    .toThrow('operator review refused');
  expect(() => h.journal.append({ kind: 'operator-review-closed', request: id, at: 1500 })).toThrow('operator review close order');
  expect(() => h.journal.append({ kind: 'operator-result-intent', request: id, text: 'x', chat: genesis.chat, at: 1500 })).toThrow('operator result order');
  h.journal.close();
  const reopened = openPreviewJournal(path, key);
  expect(reopened.view.operatorRequests.at(-1)!.reviewsSeen).toEqual([]);
  reopened.close();
}));


// --- 5. The launcher: status reads the record afresh, and the live surface changes only when a source is admissible. ---
it('reports explicitYes and the live operator-action surface in status, and follows a recorded withdrawal', () => withRoot(async path => {
  const root = dirname(path);
  openPreviewJournal(path, OFFLINE_STORAGE_KEY, genesis).close();
  const record = join(root, 'explicit-yes-installation.json');
  writeFileSync(record, deskRecord());
  const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
    INSTAR_SECRET_PREVIEW_GITHUB_TOKEN: 'agent-token', INSTAR_CONVERSATION_OWNERS: join(root, 'owners') };
  const status = (...extra: string[]) => {
    const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs',
      'status', '--root', root, ...extra], { cwd: process.cwd(), env, encoding: 'utf8', timeout: 20000 });
    expect(run.status, run.stderr).toBe(0);
    return JSON.parse(run.stdout) as { explicitYes: { connected: boolean; review: Record<string, unknown> };
      operatorActionSurface: { raiseCaps: string; renewExpiry: string }; operatorRequests: unknown[] };
  };
  const none = status();
  expect(none.explicitYes.connected).toBe(false);
  expect(none.operatorActionSurface.raiseCaps).toContain('host command line');
  const live = status('--explicit-yes-installation', record, '--review-repository', REPO);
  expect(live.explicitYes.review).toEqual({ admissible: true, acceptance: { account: 'JKHeadley', current: true, disclosure: SHARED_ACCESS_NOTE } });
  expect(live.operatorActionSurface.raiseCaps).toContain('GitHub pull request');
  expect(live.operatorActionSurface.raiseCaps).toContain(SHARED_ACCESS_NOTE);
  expect(live.operatorRequests).toEqual([]);
  // Without the request repository the review source is not connected: the host command line stands.
  expect(status('--explicit-yes-installation', record).operatorActionSurface.raiseCaps).toContain('host command line');
  const accepted = JSON.parse(deskRecord()).github.acceptance;
  writeFileSync(record, deskRecord({ acceptance: { ...accepted, withdrawn: '2026-10-03T08:00:00Z' } }));
  const withdrawn = status('--explicit-yes-installation', record, '--review-repository', REPO);
  expect(withdrawn.explicitYes.review).toMatchObject({ admissible: false, acceptance: { account: 'JKHeadley', current: false } });
  expect(withdrawn.operatorActionSurface.raiseCaps).toContain('host command line');
}), 60000);

// --- 6. Observer #106: the REAL recorded answer outputs (claude-sonnet-5, production framing, w3-yesactions capture of
// 2026-10-02) replayed through the live port's own extraction into the wired P-05 review route. ---
it('replays the recorded real raise-ask and unrelated outputs: the review route fires on one and not the other', () => withRoot(async path => {
  const fixture = JSON.parse(readFileSync('tests/preview/fixtures/operator-yes-live-2026-10-02.json', 'utf8')) as {
    outputs: { scenario: string; run: number; now: number; message: string; raw: string }[] };
  const livePort = (raw: string): ModelAnswer => {
    const extracted = parseModelJson(raw, { wrapped: 'accept' });
    const decision = extracted.ok ? extracted.value as { type?: unknown; conclusion?: { subject?: unknown; value?: unknown } } : null;
    const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
      && decisionWithinFloor(decision as Parameters<typeof decisionWithinFloor>[0]) ? conclusionText(decision.conclusion.value) : null;
    const usage = { inputTokens: null, outputTokens: null, charge: null } as const;
    return value === null ? { state: 'complete', failureClass: 'malformed', usage } : { state: 'complete', text: value, usage };
  };
  const replayed: string[] = [];
  for (const item of fixture.outputs.filter(output => output.scenario === 'raise-ask' || output.scenario === 'unrelated')) {
    const file = path.replace('journal.encrypted', `${item.scenario}-${String(item.run)}.encrypted`);
    const h = harness(file, { current: installation({ acceptance: acceptance({ acceptedAt: item.now - 60_000 }) }) }, () => livePort(item.raw), item.now);
    h.worker.intake([message(1, 50, item.message)]); await h.worker.drain();
    const label = `${item.scenario} run ${String(item.run)}`;
    expect(h.sent.length, label).toBe(1);
    if (item.scenario === 'raise-ask') {
      expect(h.github.opened, label).toHaveLength(1);
      expect(h.journal.view.operatorRequests.at(-1)!.review, label).toEqual({ repository: REPO, pullRequest: 41, head: HEAD });
      expect(h.sent[0]!.text, label).toContain(`https://github.com/${REPO}/pull/41/files`);
      approve(h); h.github.reviews[0]!.submittedAt = new Date(item.now + 60_000).toISOString();
      h.tick(120_000); await h.worker.minimal();
      expect(h.journal.view.operatorRequests.at(-1)!.applied, label).toBe(true);
      expect(h.sent.at(-1)!.text, label).toContain(SHARED_ACCESS_NOTE);
    } else {
      expect(h.github.opened, label).toEqual([]);
      expect(h.journal.view.operatorRequests, label).toEqual([]);
    }
    replayed.push(label);
    h.journal.close();
  }
  expect(replayed.some(label => label.startsWith('raise-ask')) && replayed.some(label => label.startsWith('unrelated'))).toBe(true);
}));
