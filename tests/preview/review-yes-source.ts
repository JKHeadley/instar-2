// Rules 28, 55, 79, 82, 98; Purpose "the agent never administers its own safeguards"; plan #91 (2).
// The second explicit-yes source, for an installation where a recorded P-05 grant lets the agent speak through the
// operator's chat account, so a chat reply cannot be the operator's yes: the operator's GitHub account APPROVES a
// review of a pull request that names the exact request, reached by a direct link sent each time. No setup, no
// passkey, no signing key. The network lives in the injected client; this module is pure apart from the client and
// the clock it is handed. It decides nothing itself: every yes goes through the single admission
// (`produceExplicitYes`), which needs the installed P-02 fact that the agent holds no session, credential or recovery
// path on the approving account, and refuses without it. The consumed-reference ledger is the caller's durable store
// (the encrypted journal in the root), passed in as `consumed`, so a review is used once.
import { produceExplicitYes, reviewYesReference } from '../../src/operator/explicit-yes.js';
import type { ExplicitYesInstallation, ExplicitYesObservation, ExplicitYesRecord, ExplicitYesRequest } from '../../src/operator/explicit-yes.js';
import { consumeResult } from '../../src/index.js';
import type { BoundaryContext, Clock, Scope, VerifiedPrincipal } from '../../src/index.js';
import type { OperatorRequest } from './operator-yes.js';

/** The GitHub operations the source needs, injected (the launcher supplies a real one; tests a fake). */
export interface GitHubReviewClient {
  /** Opens a pull request on `repository` from a new branch adding one request file; its number and head commit. */
  openRequest(input: { repository: string; branch: string; title: string; body: string; path: string; content: string }):
    Promise<{ number: number; head: string }>;
  /** The pull request's current body and head commit. */
  pullRequest(repository: string, number: number): Promise<{ body: string; head: string }>;
  /** Every review submitted on it, in GitHub's order. */
  reviews(repository: string, number: number): Promise<readonly GitHubReview[]>;
}
export interface GitHubReview { id: string | number; state: string; commitId: string; login: string; submittedAt: string }
/** A request issued as a pull request: what a review must cover and where the operator approves it. */
export interface IssuedReviewRequest { requestId: string; repository: string; pullRequest: number; head: string; link: string }
/** Rule 55: every poll carries its own brakes -- a widening wait, a ceiling, and a breaker after sustained failure. */
export interface ReviewPollBrakes { initialMs: number; maxMs: number; breakerAfter: number }
export const REVIEW_POLL_BRAKES: ReviewPollBrakes = Object.freeze({ initialMs: 30_000, maxMs: 15 * 60_000, breakerAfter: 8 });

/** Why the review source cannot carry a yes on this installation, or null when it can (Rule 3: no false claim). */
export function reviewSourceRefusal(installation: ExplicitYesInstallation | undefined, repository: string | undefined): string | null {
  const github = installation?.github;
  if (!installation) return 'no explicit-yes installation record is configured';
  if (!github) return 'no pinned operator GitHub account is installed';
  if (!github.agentHoldsNoAccess) return 'no P-02 record that the agent holds no access to the operator GitHub account';
  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) return 'no request repository is configured';
  if (repository.toLowerCase() !== github.repository.toLowerCase()) return 'the request repository is not the pinned repository';
  return null;
}
/** The fixed request file and pull request text; the body names the request id, as the admission requires. */
export function reviewRequestContent(request: OperatorRequest, text: string) {
  const branch = `instar-request-${request.id}`, path = `requests/${request.id}.md`;
  const body = `Approval request ${request.id}\n\n${text}\n\nApprove this pull request's review to approve the request. `
    + 'Anything else changes nothing. Merging is not needed.';
  const content = `# Request ${request.id}\n\n${text}\n\nRequest digest: ${request.digest}\n`;
  return { branch, path, title: `Approve request ${request.id}`, body, content };
}
export const reviewLink = (repository: string, pullRequest: number) => `https://github.com/${repository}/pull/${pullRequest}/files`;

const clock = (at: number) => ({ type: 'Measurement', schemaVersion: 1, subject: { kind: 'clock', instance: 'preview-review-clock' },
  value: at, unit: 'unix-ms', at, by: 'preview-review' }) as unknown as Clock;
const parsedAt = (value: string) => { const at = Date.parse(value); return Number.isSafeInteger(at) && at > 0 ? at : null; };

export function createReviewYesSource(options: { client: GitHubReviewClient; installation: ExplicitYesInstallation | undefined;
  repository: string | undefined; context: BoundaryContext; now(): number; brakes?: ReviewPollBrakes }) {
  const brakes = options.brakes ?? REVIEW_POLL_BRAKES;
  const polls = new Map<string, { due: number; wait: number; failures: number; open: boolean }>();
  const refusal = () => reviewSourceRefusal(options.installation, options.repository);
  return Object.freeze({
    /** Where this source stands: admissible, or the exact missing fact; and any open breaker. */
    status() {
      const reason = refusal(), open = [...polls.entries()].filter(([, poll]) => poll.open).map(([id]) => id);
      return { admissible: reason === null, ...(reason === null ? {} : { reason }), ...(open.length ? { breakerOpen: open } : {}) };
    },
    /** Opens the request's pull request. Refuses without the installed facts; nothing is opened then. */
    async issue(request: OperatorRequest, text: string): Promise<{ kind: 'issued'; issued: IssuedReviewRequest } | { kind: 'refused'; reason: string }> {
      const reason = refusal();
      if (reason !== null) return { kind: 'refused', reason };
      if (options.now() > request.expiresAt) return { kind: 'refused', reason: 'the request has lapsed' };
      const repository = options.repository!, content = reviewRequestContent(request, text);
      let opened: { number: number; head: string };
      try { opened = await options.client.openRequest({ repository, ...content }); }
      catch { return { kind: 'refused', reason: 'the pull request could not be opened' }; }
      if (!Number.isSafeInteger(opened?.number) || opened.number <= 0 || typeof opened.head !== 'string' || !/^[0-9a-f]{40}$/u.test(opened.head))
        return { kind: 'refused', reason: 'the pull request was opened without a usable number or head' };
      polls.set(request.id, { due: options.now(), wait: brakes.initialMs, failures: 0, open: false });
      return { kind: 'issued', issued: { requestId: request.id, repository, pullRequest: opened.number, head: opened.head,
        link: reviewLink(repository, opened.number) } };
    },
    link: (issued: IssuedReviewRequest) => reviewLink(issued.repository, issued.pullRequest),
    /** Polls the reviews when due (Rule 55). Returns every submitted review as an observation, or null when not due,
     * failed, or braked. A failure widens the wait to the ceiling; sustained failure opens the breaker. */
    async acts(issued: IssuedReviewRequest): Promise<ExplicitYesObservation[] | null> {
      const now = options.now(), poll = polls.get(issued.requestId) ?? { due: now, wait: brakes.initialMs, failures: 0, open: false };
      polls.set(issued.requestId, poll);
      if (poll.open || now < poll.due) return null;
      try {
        const [pull, reviews] = await Promise.all([options.client.pullRequest(issued.repository, issued.pullRequest),
          options.client.reviews(issued.repository, issued.pullRequest)]);
        poll.failures = 0; poll.wait = brakes.initialMs; poll.due = now + brakes.initialMs;
        return reviews.flatMap(review => {
          const at = parsedAt(review.submittedAt);
          return at === null ? [] : [{ kind: 'github-review' as const, repository: issued.repository, pullRequest: issued.pullRequest,
            pullRequestBody: String(pull.body ?? ''), reviewId: String(review.id), commitId: String(review.commitId), state: String(review.state),
            reviewerLogin: String(review.login), at: clock(at) }];
        });
      } catch {
        poll.failures++; poll.due = now + poll.wait; poll.wait = Math.min(brakes.maxMs, poll.wait * 2);
        if (poll.failures >= brakes.breakerAfter) poll.open = true;
        return null;
      }
    },
    /** Re-arms a braked poll (an operator or desk act, never automatic). */
    reset(requestId: string) { polls.delete(requestId); },
    /** The single admission for one observed review of this exact request. The action is the request's own, so a
     * review cannot approve a different action; a reused review is refused by `consumed`. */
    verify(input: { request: OperatorRequest; issued: IssuedReviewRequest; observation: ExplicitYesObservation; grant: string; chat: string;
      approver: VerifiedPrincipal; requestedBy: VerifiedPrincipal; consumed: readonly string[] }):
      { kind: 'approved'; record: ExplicitYesRecord } | { kind: 'refused'; detail: string } {
      const { request, issued } = input;
      if (issued.requestId !== request.id) return { kind: 'refused', detail: 'the pull request belongs to a different request' };
      if (!options.installation) return { kind: 'refused', detail: 'no explicit-yes installation record is configured' };
      const yes: ExplicitYesRequest = { requestId: request.id, requestDigest: request.digest, authorizationId: `authorization:${request.id}`,
        approver: input.approver, requestedBy: input.requestedBy, under: input.grant, action: request.action,
        scope: { type: 'Scope', schemaVersion: 1, kind: 'conversation', members: [input.chat] } as unknown as Scope,
        artifact: request.digest, base: request.base, kind: { kind: 'approval' }, chatMessageId: null, head: issued.head,
        issuedAt: request.issuedAt, expiresAt: request.expiresAt };
      type Verdict = { kind: 'approved'; record: ExplicitYesRecord } | { kind: 'refused'; detail: string };
      return consumeResult<ExplicitYesRecord, Verdict>(produceExplicitYes(yes, options.installation, input.observation, input.consumed, options.context), {
        Success: record => ({ kind: 'approved', record }), Refused: refused => ({ kind: 'refused', detail: refused.detail }) });
    },
  });
}
export { reviewYesReference };
