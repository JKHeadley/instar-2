// Rules 28, 82, 89, 98; Part Eleven §2; plan #91. The smallest production explicit-yes source.
// Two paths, both the approval-gesture amendment's `account-assented` yes (P-02), admitted only
// under the one declaration `accountAuthenticatedAssent` (src/decode/explicit-yes.ts):
//   1. default: the operator account replies `yes` to the request's own message in the bound chat;
//   2. where a recorded P-05 grant lets the agent speak through that chat account: the operator's
//      GitHub account APPROVES a review of the request's exact head, on a pull request whose body
//      names the request, reached by a direct link.
// Each yes needs the P-02 record that the agent holds no session, credential, delegated sender or
// recovery path to the account; is recorded with its platform id (message id / review id); is used
// once; and must fall inside the request's lifetime. This module only shapes the record; Part
// One's decoder is still the authority that turns it into an `Authorization`.
import { canonical } from '../index.js';
import type { Authorization, BoundaryContext, Clock, Hash, Json, ProvenanceInput, Result, Scope, VerifiedPrincipal } from '../index.js';
import { operatorBoundary, requireOperator, take } from './boundary.js';

/** The durable authorization request the yes must name (the Part Four request the surface renders). */
export interface ExplicitYesRequest {
  readonly requestId: string; readonly requestDigest: Hash; readonly authorizationId: string;
  readonly approver: VerifiedPrincipal; readonly requestedBy: VerifiedPrincipal; readonly under: string;
  readonly action: string; readonly scope: Scope; readonly artifact: Hash; readonly base: string;
  readonly kind: Authorization['kind'];
  /** The request's own message in the bound chat, which a chat yes must reply to. */
  readonly chatMessageId: string | null;
  /** The exact head commit a review yes must cover. */
  readonly head: string | null;
  /** Unix-ms lifetime of the request; a yes outside it is refused. */
  readonly issuedAt: number; readonly expiresAt: number;
}
/** Installed, pinned facts about where a yes may come from. */
export interface ExplicitYesInstallation {
  readonly adapter: string; readonly machine: string;
  /** `agentHoldsNoAccess` is the current P-02 record for that account (no session, credential, delegated sender or recovery path). */
  readonly chat: Readonly<{ method: string; boundChatId: string; operatorAccountId: string; agentHoldsNoAccess: boolean }>;
  readonly github: Readonly<{ method: string; repository: string; operatorLogin: string; agentHoldsNoAccess: boolean }> | null;
  /** True when a recorded P-05 grant lets the agent speak through the operator's chat account. */
  readonly agentSpeaksAsOperatorInChat: boolean;
}
export type ExplicitYesObservation =
  | Readonly<{ kind: 'chat-reply'; chatId: string; messageId: string; replyToMessageId: string | null;
    senderAccountId: string; text: string; at: Clock }>
  | Readonly<{ kind: 'github-review'; repository: string; pullRequest: number; pullRequestBody: string;
    reviewId: string; commitId: string; state: string; reviewerLogin: string; at: Clock }>;
export interface ExplicitYesRecord {
  /** Custody reference naming the platform id the yes was recorded with. */
  readonly reference: string; readonly bytes: string; readonly hash: Hash;
  readonly provenance: ProvenanceInput;
  /** The `Authorization` input, less `explicitYes` (the decoded provenance supplies it). */
  readonly authorization: Readonly<Record<string, Json>>;
}

export const chatYesReference = (chatId: string, messageId: string) => `telegram:chat:${chatId}:message:${messageId}`;
export const reviewYesReference = (repository: string, reviewId: string) => `github:${repository}:review:${reviewId}`;

/** The exact reply grammar: `yes` or `approve`, optionally followed by this request's id; nothing else. */
function chatSaysYes(text: string, requestId: string): boolean {
  const tokens = text.trim().split(/\s+/);
  return (tokens.length === 1 || tokens.length === 2 && tokens[1] === requestId) && ['yes', 'approve'].includes(tokens[0]!.toLowerCase());
}
function namesRequest(body: string, requestId: string): boolean {
  return body.split(/[\s`*_()[\],;:]+/).includes(requestId);
}

export function produceExplicitYes(request: ExplicitYesRequest, installation: ExplicitYesInstallation,
  observation: ExplicitYesObservation, consumed: readonly string[], context: BoundaryContext): Result<ExplicitYesRecord> {
  return operatorBoundary('ExplicitYesRecord', context, () => {
    requireOperator(request.approver.kind === 'person', 'explicit yes: the approver must be a person', 'standing');
    requireOperator(request.approver.id !== request.requestedBy.id, 'explicit yes: the requester cannot approve its own request', 'standing');
    let reference: string, method: string, recordType: string, evidence: ProvenanceInput['evidence'];
    if (observation.kind === 'chat-reply') {
      requireOperator(!installation.agentSpeaksAsOperatorInChat,
        'explicit yes: a P-05 grant lets the agent speak as the operator in chat, so a chat reply is not the operator\'s yes; use the review path', 'standing');
      requireOperator(observation.chatId === installation.chat.boundChatId, 'explicit yes: reply is not in the bound chat', 'standing');
      requireOperator(installation.chat.agentHoldsNoAccess, 'explicit yes: no P-02 record that the agent holds no access to the operator chat account', 'standing');
      requireOperator(observation.senderAccountId === installation.chat.operatorAccountId, 'explicit yes: reply is not from the verified operator account', 'standing');
      requireOperator(request.chatMessageId !== null && observation.replyToMessageId === request.chatMessageId,
        'explicit yes: reply does not answer this request\'s own message', 'standing');
      requireOperator(chatSaysYes(observation.text, request.requestId), 'explicit yes: reply is not exactly "yes" (optionally with this request id)', 'standing');
      reference = chatYesReference(observation.chatId, observation.messageId);
      method = installation.chat.method; recordType = 'operator-chat-yes'; evidence = { kind: 'channel', authenticated: true };
    } else {
      const github = installation.github;
      requireOperator(github, 'explicit yes: no pinned operator GitHub account is installed', 'standing');
      requireOperator(github.agentHoldsNoAccess, 'explicit yes: no P-02 record that the agent holds no access to the operator GitHub account', 'standing');
      requireOperator(observation.repository === github.repository, 'explicit yes: review is not on the pinned repository', 'standing');
      requireOperator(request.head !== null && observation.commitId === request.head, 'explicit yes: review does not cover the request\'s exact head', 'standing');
      requireOperator(observation.state === 'APPROVED', 'explicit yes: review is not an approval', 'standing');
      requireOperator(observation.reviewerLogin.toLowerCase() === github.operatorLogin.toLowerCase(),
        'explicit yes: review is not by the pinned operator GitHub account', 'standing');
      requireOperator(namesRequest(observation.pullRequestBody, request.requestId), 'explicit yes: pull request body does not name this request', 'standing');
      reference = reviewYesReference(observation.repository, observation.reviewId);
      method = github.method; recordType = 'operator-review-approval'; evidence = { kind: 'fetched-record', authenticated: true };
    }
    const at = observation.at.value;
    requireOperator(at >= request.issuedAt && at <= request.expiresAt, 'explicit yes: outside the request lifetime (expired or predates it)', 'standing');
    requireOperator(!consumed.includes(reference), `explicit yes: ${reference} was already used`, 'standing');
    const authorization = {
      id: request.authorizationId, at: observation.at, approver: request.approver, under: request.under,
      action: { kind: request.action, scope: request.scope }, artifact: request.artifact, base: request.base,
      kind: request.kind, requestedBy: request.requestedBy, requestDigest: request.requestDigest,
    } as unknown as Record<string, Json>;
    const encoded = take(canonical({ principal: { id: request.approver.id, kind: request.approver.kind }, recordType, payload: authorization }));
    const provenance: ProvenanceInput = { type: 'Provenance', schemaVersion: 1, adapter: installation.adapter, method,
      record: { reference, hash: encoded.hash }, verifiedAt: observation.at, machine: installation.machine, evidence };
    return { reference, bytes: encoded.bytes, hash: encoded.hash, provenance, authorization };
  });
}
