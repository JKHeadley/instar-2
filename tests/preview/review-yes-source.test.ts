import { expect, it } from 'vitest';
import { previewTestContext } from './journal-test-worker.js';
import { proposeOperatorRequest, operatorRequestText, type OperatorRequest, type ProposalState } from './operator-yes.js';
import { createReviewYesSource, reviewLink, reviewRequestContent, type GitHubReview, type GitHubReviewClient } from './review-yes-source.js';
import type { ExplicitYesInstallation } from '../../src/operator/explicit-yes.js';
import type { VerifiedPrincipal } from '../../src/index.js';

// Plan #91 (2), Rules 28, 55, 82, 98: where the agent can speak through the operator's chat account (P-05), the yes is
// the operator's GitHub account APPROVING a review of the exact head of a pull request naming the request. Only that
// completes it, once; every other review state, account, head, lifetime, request or reuse refuses.
const REPO = 'JKHeadley/instar-requests', HEAD = 'a'.repeat(40), OTHER_HEAD = 'b'.repeat(40);
const installation = (over: Partial<NonNullable<ExplicitYesInstallation['github']>> | null = {}): ExplicitYesInstallation => ({
  adapter: 'github-api', machine: 'laptop',
  chat: { method: 'telegram-sender', boundChatId: '7654321', operatorAccountId: '7654321', agentHoldsNoAccess: true },
  github: over === null ? null : { method: 'github-review', repository: REPO, operatorLogin: 'JKHeadley', agentHoldsNoAccess: true, ...over },
  // This deployment: the agent can speak as the operator in chat, so only the review path can carry a yes.
  agentSpeaksAsOperatorInChat: true });
const approver = { kind: 'person', id: '7654321' } as unknown as VerifiedPrincipal;
const requestedBy = { kind: 'system', id: 'preview-runner:12345678' } as unknown as VerifiedPrincipal;
const state: ProposalState = { limits: { maxCalls: 40, maxReplies: 40, maxTurns: 40 }, used: { maxCalls: 39, maxReplies: 1, maxTurns: 2 },
  step: { maxCalls: 40, maxReplies: 40, maxTurns: 40 }, expires: 9_000_000_000_000, governedExpiry: 9_100_000_000_000,
  renewalActivation: `sha256:${'c'.repeat(64)}`, unknownCalls: 0, stopped: false, grant: 'grant:preview', base: '0123456789abcdef' };
const ISSUED_AT = 1_790_000_000_000;
const make = (action: 'raise-caps' | 'renew-expiry' = 'raise-caps', carrier = 'turn-1'): OperatorRequest => {
  const made = proposeOperatorRequest(state, { action }, carrier, ISSUED_AT);
  if (made.kind !== 'request') throw Error(made.reason);
  return made.request;
};
const iso = (at: number) => new Date(at).toISOString();

function fakeClient() {
  const opened: { repository: string; branch: string; body: string; path: string }[] = [];
  const reviews: GitHubReview[] = [];
  const pull = { body: '', head: HEAD };
  let failing = 0, polls = 0;
  const client: GitHubReviewClient = {
    async openRequest(input) { opened.push(input); pull.body = input.body; return { number: 17, head: HEAD }; },
    async pullRequest() { polls++; if (failing) { failing--; throw Error('network'); } return { ...pull }; },
    async reviews() { return [...reviews]; }, async closeRequest() { /* not exercised here */ } };
  return { client, opened, reviews, pull, fail: (n: number) => { failing = n; }, polls: () => polls };
}
async function setup(options: { install?: ExplicitYesInstallation; repository?: string; request?: OperatorRequest } = {}) {
  let now = ISSUED_AT + 1000;
  const fake = fakeClient();
  const source = createReviewYesSource({ client: fake.client, installation: options.install ?? installation(), repository: options.repository ?? REPO,
    context: previewTestContext, now: () => now, brakes: { initialMs: 1000, maxMs: 8000, breakerAfter: 3 } });
  const request = options.request ?? make();
  const issued = await source.issue(request, operatorRequestText(request, { limits: state.limits, expires: state.expires }));
  return { fake, source, request, issued, tick: (ms: number) => { now += ms; } };
}
const review = (over: Partial<GitHubReview> = {}): GitHubReview => ({ id: 901, state: 'APPROVED', commitId: HEAD, login: 'JKHeadley',
  submittedAt: iso(ISSUED_AT + 60_000), ...over });

it('issues one pull request naming the request and links straight to its files', async () => {
  const { fake, issued, request } = await setup();
  expect(issued).toEqual({ kind: 'issued', issued: { requestId: request.id, repository: REPO, pullRequest: 17, head: HEAD,
    link: `https://github.com/${REPO}/pull/17/files` } });
  expect(fake.opened).toHaveLength(1);
  expect(fake.opened[0]!.body).toContain(`Approval request ${request.id}`);
  expect(fake.opened[0]!.path).toBe(`requests/${request.id}.md`);
  expect(reviewLink(REPO, 17)).toBe(`https://github.com/${REPO}/pull/17/files`);
  expect(reviewRequestContent(request, 'x').content).toContain(request.digest);
});

it('completes once on an APPROVED review by the pinned login on the exact head; refuses every other review', async () => {
  const { fake, source, request, issued } = await setup();
  if (issued.kind !== 'issued') throw Error('not issued');
  // A missing review: nothing to verify.
  expect(await source.acts(issued.issued)).toEqual([]);
  const verify = async (over: Partial<GitHubReview>, consumed: readonly string[] = []) => {
    fake.reviews.splice(0, fake.reviews.length, review(over));
    (source as unknown as { reset(id: string): void }).reset(request.id);
    const [observation] = (await source.acts(issued.issued))!;
    return source.verify({ request, issued: issued.issued, observation: observation!, grant: 'grant:preview', chat: '7654321',
      approver, requestedBy, consumed });
  };
  const approved = await verify({});
  expect(approved.kind).toBe('approved');
  const reference = approved.kind === 'approved' ? approved.record.reference : '';
  expect(reference).toBe(`github:${REPO}:review:901`);
  expect(approved.kind === 'approved' && approved.record.provenance.evidence).toEqual({ kind: 'fetched-record', authenticated: true });
  // The pinned login matches case-insensitively, as GitHub logins do.
  expect((await verify({ login: 'jkheadley', id: 902 })).kind).toBe('approved');
  const refusedBy = async (over: Partial<GitHubReview>, detail: string, consumed: readonly string[] = []) => {
    const verdict = await verify(over, consumed);
    expect(verdict, detail).toEqual({ kind: 'refused', detail: expect.stringContaining(detail) });
  };
  await refusedBy({ state: 'COMMENTED' }, 'not an approval');
  await refusedBy({ state: 'CHANGES_REQUESTED' }, 'not an approval');
  await refusedBy({ login: 'EchoOfDawn' }, 'not by the pinned operator GitHub account');
  await refusedBy({ commitId: OTHER_HEAD }, 'exact head');
  await refusedBy({ submittedAt: iso(request.expiresAt + 1) }, 'outside the request lifetime');
  await refusedBy({}, 'already used', [reference]);
  // A pull request whose body does not name this request.
  fake.pull.body = 'Approval request 0000000000000000';
  await refusedBy({ id: 903 }, 'does not name this request');
});

it('refuses a review offered for a different request or action', async () => {
  const { fake, source, issued } = await setup();
  if (issued.kind !== 'issued') throw Error('not issued');
  fake.reviews.push(review());
  const [observation] = (await source.acts(issued.issued))!;
  // A renewal request cannot be completed by the review of the raise's pull request.
  const renewal = make('renew-expiry', 'turn-2');
  expect(source.verify({ request: renewal, issued: issued.issued, observation: observation!, grant: 'grant:preview', chat: '7654321',
    approver, requestedBy, consumed: [] })).toEqual({ kind: 'refused', detail: 'the pull request belongs to a different request' });
  // Nor by naming it: the head the review covers is the raise's, and its body names the raise.
  expect(source.verify({ request: renewal, issued: { ...issued.issued, requestId: renewal.id }, observation: observation!, grant: 'grant:preview',
    chat: '7654321', approver, requestedBy, consumed: [] }).kind).toBe('refused');
});

it('refuses to issue without the installed facts, and says which fact is missing', async () => {
  for (const [install, repository, reason] of [
    [installation(null), REPO, 'no pinned operator GitHub account is installed'],
    [installation({ agentHoldsNoAccess: false }), REPO, 'no P-02 record that the agent holds no access to the operator GitHub account'],
    [installation(), '', 'no request repository is configured'],
    [installation(), 'JKHeadley/other', 'the request repository is not the pinned repository']] as const) {
    const { fake, source, issued } = await setup({ install, repository });
    expect(issued).toEqual({ kind: 'refused', reason });
    expect(source.status()).toEqual({ admissible: false, reason });
    expect(fake.opened).toEqual([]);
  }
  const { source } = await setup();
  expect(source.status()).toEqual({ admissible: true });
  // And the admission itself refuses when the P-02 fact is absent, even for a genuine approval.
  const absent = await setup();
  if (absent.issued.kind !== 'issued') throw Error('not issued');
  absent.fake.reviews.push(review());
  const [observation] = (await absent.source.acts(absent.issued.issued))!;
  const strict = createReviewYesSource({ client: absent.fake.client, installation: installation({ agentHoldsNoAccess: false }), repository: REPO,
    context: previewTestContext, now: () => ISSUED_AT + 2000 });
  expect(strict.verify({ request: absent.request, issued: absent.issued.issued, observation: observation!, grant: 'grant:preview', chat: '7654321',
    approver, requestedBy, consumed: [] })).toEqual({ kind: 'refused', detail: expect.stringContaining('P-02') });
});

it('polls with a widening wait and opens its breaker after sustained failure (Rule 55)', async () => {
  const { fake, source, issued, tick, request } = await setup();
  if (issued.kind !== 'issued') throw Error('not issued');
  expect(await source.acts(issued.issued)).toEqual([]);
  // Not due again for the initial wait.
  expect(await source.acts(issued.issued)).toBeNull();
  tick(1000);
  fake.fail(10);
  expect(await source.acts(issued.issued)).toBeNull();
  const before = fake.polls();
  tick(999); expect(await source.acts(issued.issued)).toBeNull(); expect(fake.polls()).toBe(before);
  tick(1); expect(await source.acts(issued.issued)).toBeNull();
  tick(1999); expect(await source.acts(issued.issued)).toBeNull(); expect(fake.polls()).toBe(before + 1);
  tick(1); expect(await source.acts(issued.issued)).toBeNull();
  expect(source.status()).toEqual({ admissible: true, breakerOpen: [request.id] });
  // Braked: no more calls however long it waits, until re-armed.
  tick(10 * 60_000); await source.acts(issued.issued);
  expect(fake.polls()).toBe(before + 2);
  source.reset(request.id); fake.fail(0);
  expect(await source.acts(issued.issued)).toEqual([]);
});
