// Rules 28, 82, 98; Purpose "the agent never administers its own safeguards"; Part Eleven §2.
// What counts as an explicit yes, decided in one place. Every reader of an `Authorization`'s
// explicit yes (the Part One decoder, the Part Two version chain and register spine) asks here.
import type { Authorization, Clock, Hash, Json, Provenance, Scope, VerifiedPrincipal } from '../types/values.js';
import type { AccountAssentAdmission, ProvenanceInput } from '../types/ports.js';
import { consumeResult, seal, trusted } from '../types/internal.js';
import { canonical } from './canonical.js';

/** The yes a signature or independently administered verifier proves. */
export const verifiedYesRecordTypes: readonly string[] = Object.freeze(['approval', 'review-approval', 'signed-yes', 'dashboard-yes']);
/**
 * Account-assented yes (the approval-gesture amendment's `account-assented` class): the operator
 * account replying in its bound chat, or the operator account approving a host review. The named
 * service authenticates the account; the package cannot re-check it, so it is never `verified`.
 */
export const accountAssentRecordTypes: readonly string[] = Object.freeze(['operator-chat-yes', 'operator-review-approval']);

/**
 * THE declaration the approval-gesture amendment (PR #139) enabled. Purpose ("or Instar may accept
 * a recorded, one-use approval of an exact, unexpired request from an operator account") and Part
 * One's `account-assented` class make an account-authenticated yes constitutional. Turning it off
 * again is this one edit, nowhere else: an account-assent record then decodes as plain
 * `channel-attested` and completes nothing.
 */
export const accountAuthenticatedAssent: Readonly<{ name: string; enabled: boolean; amendment: string }> =
  Object.freeze({ name: 'account-authenticated-assent', enabled: true, amendment: 'amend-approval-gesture' });

type Declaration = Readonly<{ enabled: boolean }>;
/** The class of an authenticated-channel record: `account-assented` only for a declared account yes. */
export function attestedClass(recordType: string, declaration: Declaration = accountAuthenticatedAssent): Provenance['class'] {
  return declaration.enabled && accountAssentRecordTypes.includes(recordType) ? 'account-assented' : 'channel-attested';
}
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
/**
 * The operator's recorded acceptance (Purpose, the approval-account exception) that approvals from one account count
 * as the operator's yes on one installation although the agent can also use that account. `operatorMessages` are the
 * references of the operator's own recorded words; `withdrawn` is when a recorded withdrawal took effect, or null.
 */
export interface OperatorAcceptance {
  readonly account: string; readonly installation: string; readonly operatorMessages: readonly string[];
  /** Unix ms. */
  readonly acceptedAt: number; readonly withdrawn: number | null;
}
/** The shared-access disclosure, written once: carried wherever an approval admitted under an acceptance is recorded,
 * displayed or exported. */
export const SHARED_ACCESS_NOTE = 'I can also use that account, so the account alone does not show who approved';
/** What an approval admitted under an acceptance records about it (absent on the no-access route). */
export interface SharedAccessDisclosure {
  readonly account: string; readonly installation: string; readonly acceptedAt: number; readonly note: string;
}
/** Installed, pinned facts about where a yes may come from. */
export interface ExplicitYesInstallation {
  readonly adapter: string; readonly machine: string;
  /** This installation's identity, which an operator acceptance must name. */
  readonly installation?: string;
  /** `agentHoldsNoAccess` is the current P-02 record for that account (no session, credential, delegated sender or recovery path). */
  readonly chat: Readonly<{ method: string; boundChatId: string; operatorAccountId: string; agentHoldsNoAccess: boolean }>;
  /** `acceptance`: the operator's recorded acceptance of the agent's access to this account, the alternative to the
   * no-access fact. Exactly one of the two may hold; neither is ever defaulted. */
  readonly github: Readonly<{ method: string; repository: string; operatorLogin: string; agentHoldsNoAccess: boolean;
    acceptance?: OperatorAcceptance | null }> | null;
  /** True when a recorded P-05 grant lets the agent speak through the operator's chat account. */
  readonly agentSpeaksAsOperatorInChat: boolean;
}
/** How the agent's relation to the GitHub approving account is established right now, or why it is not: the P-02
 * no-access fact, or a current (unwithdrawn) acceptance naming this account and installation. `at`, when given, is the
 * approval's time, which must not predate the acceptance. */
export type ApprovalAccountAccess = { kind: 'no-access' } | { kind: 'accepted'; acceptance: OperatorAcceptance } | { kind: 'refused'; detail: string };
export function githubAccountAccess(installation: ExplicitYesInstallation, at?: number): ApprovalAccountAccess {
  const github = installation.github;
  if (!github) return { kind: 'refused', detail: 'no pinned operator GitHub account is installed' };
  const acceptance = github.acceptance ?? null;
  if (acceptance === null)
    return github.agentHoldsNoAccess ? { kind: 'no-access' }
      : { kind: 'refused', detail: 'no P-02 record that the agent holds no access to the operator GitHub account' };
  if (acceptance.withdrawn !== null) return { kind: 'refused', detail: 'the operator withdrew the acceptance of the agent\'s access to the approving account' };
  if (github.agentHoldsNoAccess) return { kind: 'refused', detail: 'the installation record both says the agent holds no access and records an acceptance of that access' };
  if (acceptance.account.toLowerCase() !== github.operatorLogin.toLowerCase()) return { kind: 'refused', detail: 'the operator acceptance names another account' };
  if (!installation.installation || acceptance.installation !== installation.installation)
    return { kind: 'refused', detail: 'the operator acceptance names another installation' };
  if (!acceptance.operatorMessages.length) return { kind: 'refused', detail: 'the operator acceptance cites no recorded operator words' };
  if (at !== undefined && at < acceptance.acceptedAt) return { kind: 'refused', detail: 'the approval predates the operator acceptance' };
  return { kind: 'accepted', acceptance };
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
  /** The one-use admission the decoder requires (`DecodeContext.accountAssent`) before it grants account assent. */
  readonly admission: AccountAssentAdmission;
  /** Present exactly when the yes was admitted under an operator acceptance of shared account access. */
  readonly sharedAccess: SharedAccessDisclosure | null;
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
function admit(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(`explicit yes: ${detail}`);
}

/**
 * THE single route that admits an account-assented yes (plan #91; Part Eleven §2): the operator
 * account's reply in the bound chat to the request's own message, or, where a P-05 grant lets the
 * agent speak through that chat account, the pinned operator GitHub account APPROVING a review of
 * the request's exact head on a pull request naming the request. Each needs the P-02 record (for the GitHub account,
 * alternatively the operator's current recorded acceptance of the agent's access, which then rides the record as
 * `sharedAccess` with the fixed disclosure: Purpose, the approval-account exception), falls
 * inside the request's lifetime and is used once. Only after every check does it seal the one-use
 * `AccountAssentAdmission` the decoder requires; the raw admission constructor is not exported, so
 * no caller can issue account assent without these checks. Throws the refusal detail.
 */
export function admitExplicitYes(request: ExplicitYesRequest, installation: ExplicitYesInstallation,
  observation: ExplicitYesObservation, consumed: readonly string[]): ExplicitYesRecord {
  admit(request.approver.kind === 'person', 'the approver must be a person');
  admit(request.approver.id !== request.requestedBy.id, 'the requester cannot approve its own request');
  let reference: string, method: string, recordType: string, evidence: ProvenanceInput['evidence'];
  let sharedAccess: SharedAccessDisclosure | null = null;
  if (observation.kind === 'chat-reply') {
    admit(!installation.agentSpeaksAsOperatorInChat,
      'a P-05 grant lets the agent speak as the operator in chat, so a chat reply is not the operator\'s yes; use the review path');
    admit(observation.chatId === installation.chat.boundChatId, 'reply is not in the bound chat');
    admit(installation.chat.agentHoldsNoAccess, 'no P-02 record that the agent holds no access to the operator chat account');
    admit(observation.senderAccountId === installation.chat.operatorAccountId, 'reply is not from the verified operator account');
    admit(request.chatMessageId !== null && observation.replyToMessageId === request.chatMessageId, 'reply does not answer this request\'s own message');
    admit(chatSaysYes(observation.text, request.requestId), 'reply is not exactly "yes" (optionally with this request id)');
    reference = chatYesReference(observation.chatId, observation.messageId);
    method = installation.chat.method; recordType = 'operator-chat-yes'; evidence = { kind: 'channel', authenticated: true };
  } else {
    const github = installation.github;
    admit(github, 'no pinned operator GitHub account is installed');
    const access = githubAccountAccess(installation, observation.at.value);
    admit(access.kind !== 'refused', access.kind === 'refused' ? access.detail : '');
    if (access.kind === 'accepted') sharedAccess = { account: access.acceptance.account, installation: access.acceptance.installation,
      acceptedAt: access.acceptance.acceptedAt, note: SHARED_ACCESS_NOTE };
    admit(observation.repository === github.repository, 'review is not on the pinned repository');
    admit(request.head !== null && observation.commitId === request.head, 'review does not cover the request\'s exact head');
    admit(observation.state === 'APPROVED', 'review is not an approval');
    admit(observation.reviewerLogin.toLowerCase() === github.operatorLogin.toLowerCase(), 'review is not by the pinned operator GitHub account');
    admit(namesRequest(observation.pullRequestBody, request.requestId), 'pull request body does not name this request');
    reference = reviewYesReference(observation.repository, observation.reviewId);
    method = github.method; recordType = 'operator-review-approval'; evidence = { kind: 'fetched-record', authenticated: true };
  }
  const at = observation.at.value;
  admit(at >= request.issuedAt && at <= request.expiresAt, 'outside the request lifetime (expired or predates it)');
  admit(!consumed.includes(reference), `${reference} was already used`);
  const authorization = {
    id: request.authorizationId, at: observation.at, approver: request.approver, under: request.under,
    action: { kind: request.action, scope: request.scope }, artifact: request.artifact, base: request.base,
    kind: request.kind, requestedBy: request.requestedBy, requestDigest: request.requestDigest,
  } as unknown as Record<string, Json>;
  const encoded = consumeResult(canonical({ principal: { id: request.approver.id, kind: request.approver.kind }, recordType, payload: authorization,
    ...(sharedAccess === null ? {} : { sharedAccess: sharedAccess as unknown as Json }) }),
    { Success: value => value, Refused: refused => { throw new Error(`explicit yes: ${refused.detail}`); } });
  const provenance: ProvenanceInput = { type: 'Provenance', schemaVersion: 1, adapter: installation.adapter, method,
    record: { reference, hash: encoded.hash }, verifiedAt: observation.at, machine: installation.machine, evidence };
  const admission: AccountAssentAdmission = seal({ type: 'AccountAssentAdmission', reference, recordHash: encoded.hash,
    requestId: request.requestId, requestDigest: request.requestDigest, authorizationId: request.authorizationId });
  return { reference, bytes: encoded.bytes, hash: encoded.hash, provenance, authorization, admission, sharedAccess };
}
/** The issued admission for this exact record (reference and hash), or undefined. */
export function admittedAccountAssent(admissions: readonly AccountAssentAdmission[] | undefined, reference: string, recordHash: Hash): AccountAssentAdmission | undefined {
  return admissions?.find(a => trusted(a, 'AccountAssentAdmission') && a.reference === reference && a.recordHash === recordHash);
}
/** An explicit yes: a verified approval record, or a declared account-assented yes. */
export function isExplicitYes(p: Provenance, declaration: Declaration = accountAuthenticatedAssent): boolean {
  const recordType = p.authenticated.recordType;
  if (p.class === 'verified') return verifiedYesRecordTypes.includes(recordType);
  return declaration.enabled && p.class === 'account-assented' && accountAssentRecordTypes.includes(recordType);
}
/** A repository action (a landing) needs an approval or review record, never a bare signed yes. */
export function isRepositoryYes(p: Provenance, declaration: Declaration = accountAuthenticatedAssent): boolean {
  if (!isExplicitYes(p, declaration)) return false;
  return ['approval', 'review-approval', ...accountAssentRecordTypes].includes(p.authenticated.recordType);
}
