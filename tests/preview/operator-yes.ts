// Rules 10, 28, 29, 79, 82, 98; Purpose "the agent never administers its own safeguards"; plan #91.
// The phone path for the trial's declared operator actions, raise-caps and renew-expiry, and the desk's retract-turns
// (plan #389, Rule 35: the exact turns the desk sent through the operator's account, proposed only by the host, never the model):
//   1. the agent proposes ONE exact request (which limits to which values, or which new expiry), bounded by the
//      governed limits, with its own id, digest and lifetime; the operator never authors it (Rule 82);
//   2. the operator's explicit yes completes it once. The default source is the verified operator's reply in the
//      bound chat; the single admission (`produceExplicitYes`, src/operator/explicit-yes.ts) decides it, and it
//      refuses a chat yes wherever a recorded P-05 grant lets the agent speak as the operator in that chat.
// Pure: no clock, no I/O. The journal supplies the state and records every request and decision.
import { createHash } from 'node:crypto';
import { githubAccountAccess, produceExplicitYes, SHARED_ACCESS_NOTE } from '../../src/operator/explicit-yes.js';
import type { ExplicitYesInstallation, ExplicitYesRecord, ExplicitYesRequest } from '../../src/operator/explicit-yes.js';
import { consumeResult } from '../../src/index.js';
import type { BoundaryContext, Clock, Hash, Scope, VerifiedPrincipal } from '../../src/index.js';

export type OperatorAction = 'raise-caps' | 'renew-expiry' | 'retract-turns';
export type CapLimits = { maxCalls: number; maxReplies: number; maxTurns: number };
/** What the model may propose: the action, and for a raise each allowance to raise, as the number the operator named
 * or "step" (the usual governed increase). An omitted `limits` raises the allowance nearest its limit. The runner,
 * never the model, writes the request. */
export type LimitAsk = number | 'step';
export type OperatorActionProposal =
  | { action: 'raise-caps'; limits?: Partial<Record<keyof CapLimits, LimitAsk>> }
  | { action: 'renew-expiry'; expiresAt?: number };
/** The exact request the operator approves. `base` binds the journal state it was issued against. */
export interface OperatorRequest { id: string; action: OperatorAction; base: string; digest: Hash;
  limits?: CapLimits; expires?: number;
  /** retract-turns only: the exact Telegram update ids, ascending, and the desk's stated reason. */
  updates?: number[]; reason?: string; issuedAt: number; expiresAt: number }
/** The journal facts a proposal is bounded by. `step` is, per limit, the larger of the trial's own original allowance
 * and its current allowance: one raise may add at most that much, so it at most doubles a limit (at the original
 * allowance, the same step the cap-reached raise uses). Live 2026-10-03 (plan #362): on a root host-raised to 2,500 the
 * original 16 made an explicit "raise my limit" propose 16 more calls. */
export interface ProposalState { limits: CapLimits; used: CapLimits; step: CapLimits; expires: number;
  /** The reviewed build's governed trial end (SUBSCRIPTION_PREVIEW_EXPIRY); the only expiry a renewal may name. */
  governedExpiry: number;
  /** The reviewed activation record's digest for `governedExpiry`, when the host has one installed. */
  renewalActivation: string | null;
  unknownCalls: number; stopped: boolean; grant: string; base: string }

/** How long a request may be answered by default (plan #373): long enough for a phone tap the next morning. Live
 * 2026-10-03: two requests issued with the old one-hour window lapsed unseen overnight. A request never outlives the
 * governing deadline, the trial's current end (the end a renewal extends, the end a raise lives within). */
export const OPERATOR_REQUEST_MS = 18 * 3_600_000;
/** The longest window a root may configure, and the longest lifetime a recorded request may carry on replay. */
export const OPERATOR_REQUEST_MAX_MS = 48 * 3_600_000;
const LIMIT_NAMES: Record<keyof CapLimits, [string, string]> = {
  maxCalls: ['model-call', 'model calls'], maxReplies: ['reply', 'replies'], maxTurns: ['message', 'messages'] };
const KEYS = ['maxCalls', 'maxReplies', 'maxTurns'] as const;

/** Reads the model's `operatorAction` field. Anything not exactly this shape is refused, never repaired. */
export function parseOperatorAction(raw: unknown): OperatorActionProposal | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const { action, limits, expiresAt, ...rest } = raw as Record<string, unknown>;
  if (Object.keys(rest).length) return undefined;
  if (action === 'raise-caps' && expiresAt === undefined) {
    if (limits === undefined) return { action };
    if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return undefined;
    const entries = Object.entries(limits as Record<string, unknown>);
    if (!entries.length || entries.some(([key, value]) => !(KEYS as readonly string[]).includes(key)
      || value !== 'step' && (!Number.isSafeInteger(value) || (value as number) <= 0))) return undefined;
    return { action, limits: Object.fromEntries(entries) as Partial<Record<keyof CapLimits, LimitAsk>> };
  }
  if (action === 'renew-expiry' && limits === undefined) {
    if (expiresAt === undefined) return { action };
    return Number.isSafeInteger(expiresAt) && (expiresAt as number) > 0 ? { action, expiresAt: expiresAt as number } : undefined;
  }
  return undefined;
}

const sha = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}` as Hash;
export const operatorRequestId = (carrier: string, action: OperatorAction, base: string) =>
  createHash('sha256').update(JSON.stringify(['operator-request', carrier, action, base])).digest('hex').slice(0, 16);
/** The digest an approval binds: the action, its exact values, the base and the trial. Recomputed on replay. A
 * retraction also binds its exact update list and reason; the two older actions keep their digests unchanged. */
export const operatorRequestDigest = (request: Pick<OperatorRequest, 'id' | 'action' | 'base' | 'limits' | 'expires' | 'updates' | 'reason'>, grant: string) =>
  sha(JSON.stringify([request.id, request.action, request.base, request.limits ?? null, request.expires ?? null, grant,
    ...(request.action === 'retract-turns' ? [request.updates ?? null, request.reason ?? null] : [])]));
/** Rule 35, plan #389: at most this many turns in one retraction, and the reason's bounds. */
export const RETRACT_UPDATES_LIMIT = 1000;
const validReason = (reason: unknown): reason is string => typeof reason === 'string' && reason.trim() === reason
  && reason.length >= 8 && Buffer.byteLength(reason) <= 300 && !/[\r\n]/u.test(reason);
/** An exact retraction list: positive finite update ids, strictly ascending (so one list has one digest). */
export const validRetractUpdates = (updates: unknown): updates is number[] => Array.isArray(updates) && updates.length >= 1
  && updates.length <= RETRACT_UPDATES_LIMIT && updates.every((value, index) => typeof value === 'number' && Number.isFinite(value)
    && value > 0 && (index === 0 || value > (updates[index - 1] as number)));
/** The one exact retraction request for a desk proposal (plan #389). The journal checks the turns themselves; this
 * bounds the shape, the lifetime and the trial state, exactly as a raise is bounded. */
export function proposeRetractRequest(state: Pick<ProposalState, 'expires' | 'stopped' | 'grant' | 'base'>, updates: readonly number[],
  reason: string, carrier: string, now: number): { kind: 'request'; request: OperatorRequest } | { kind: 'refused'; reason: string } {
  if (state.stopped) return { kind: 'refused', reason: 'this installation is stopped' };
  if (now >= state.expires) return { kind: 'refused', reason: 'this installation has ended' };
  if (!validRetractUpdates(updates)) return { kind: 'refused', reason: `the list must hold 1 to ${RETRACT_UPDATES_LIMIT} distinct update ids in ascending order` };
  if (!validReason(reason)) return { kind: 'refused', reason: 'the reason must be one line of 8 to 300 bytes' };
  const id = operatorRequestId(carrier, 'retract-turns', state.base);
  const request = { id, action: 'retract-turns' as const, base: state.base, updates: [...updates], reason,
    issuedAt: now, expiresAt: Math.min(state.expires, now + OPERATOR_REQUEST_MS) };
  return { kind: 'request', request: { ...request, digest: operatorRequestDigest(request, state.grant) } };
}

/** The allowance nearest its limit: what a raise proposed without values grows. */
const nearest = (state: ProposalState): keyof CapLimits => KEYS.reduce((best, key) =>
  state.used[key] / state.limits[key] > state.used[best] / state.limits[best] ? key : best, 'maxCalls' as keyof CapLimits);

/** The one exact request for a proposal, or the plain reason it cannot be proposed. */
export function proposeOperatorRequest(state: ProposalState, proposal: OperatorActionProposal, carrier: string, now: number,
  windowMs = OPERATOR_REQUEST_MS):
  { kind: 'request'; request: OperatorRequest } | { kind: 'refused'; reason: string } {
  const refused = (reason: string) => ({ kind: 'refused' as const, reason });
  if (state.stopped) return refused('this installation is stopped');
  if (now >= state.expires) return refused('this installation has ended');
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0 || windowMs > OPERATOR_REQUEST_MAX_MS) throw Error('preview: operator request window out of bounds');
  const lifetime = { issuedAt: now, expiresAt: Math.min(state.expires, now + windowMs) };
  if (proposal.action === 'raise-caps') {
    if (state.unknownCalls > 0) return refused('a model call\'s outcome is still unknown, so no raise can be recorded until it is settled');
    const asked = proposal.limits ?? { [nearest(state)]: 'step' as const };
    const limits: CapLimits = { ...state.limits };
    for (const key of KEYS) { const ask = asked[key]; if (ask !== undefined) limits[key] = ask === 'step' ? state.limits[key] + state.step[key] : ask; }
    for (const key of KEYS) {
      const [what] = LIMIT_NAMES[key];
      if (limits[key] < state.limits[key]) return refused(`the ${what} allowance cannot be lowered here (it is ${state.limits[key]})`);
      if (limits[key] > state.limits[key] + state.step[key])
        return refused(`one raise may add at most ${state.step[key]} to the ${what} allowance, so ${limits[key]} is out of bounds (the most is ${state.limits[key] + state.step[key]})`);
    }
    if (KEYS.every(key => limits[key] === state.limits[key])) return refused('those are the current limits, so nothing would change');
    const id = operatorRequestId(carrier, 'raise-caps', state.base);
    const request = { id, action: 'raise-caps' as const, base: state.base, limits, ...lifetime };
    return { kind: 'request', request: { ...request, digest: operatorRequestDigest(request, state.grant) } };
  }
  if (!(state.governedExpiry > state.expires)) return refused('no later trial end has been reviewed, so there is nothing to renew to yet');
  if (proposal.expiresAt !== undefined && proposal.expiresAt !== state.governedExpiry)
    return refused(`the only renewal available is to ${new Date(state.governedExpiry).toISOString().slice(0, 16)} UTC, the reviewed trial end`);
  if (state.renewalActivation === null) return refused('the reviewed activation for the new trial end is not installed on this machine yet');
  const id = operatorRequestId(carrier, 'renew-expiry', state.base);
  const request = { id, action: 'renew-expiry' as const, base: state.base, expires: state.governedExpiry, ...lifetime };
  return { kind: 'request', request: { ...request, digest: operatorRequestDigest(request, state.grant) } };
}

/** True only for a request whose shape, id and digest are exactly what this module issues. */
export function wellFormedRequest(request: unknown, carrier: string, grant: string): request is OperatorRequest {
  const r = request as OperatorRequest;
  if (!r || typeof r !== 'object' || (r.action !== 'raise-caps' && r.action !== 'renew-expiry' && r.action !== 'retract-turns') || typeof r.base !== 'string'
    || r.id !== operatorRequestId(carrier, r.action, r.base) || !Number.isSafeInteger(r.issuedAt) || !Number.isSafeInteger(r.expiresAt)
    || r.expiresAt <= r.issuedAt || r.expiresAt - r.issuedAt > OPERATOR_REQUEST_MAX_MS) return false;
  if (r.action === 'retract-turns') { if (r.limits !== undefined || r.expires !== undefined || !validRetractUpdates(r.updates) || !validReason(r.reason)) return false; }
  else if (r.updates !== undefined || r.reason !== undefined) return false;
  else if (r.action === 'raise-caps' ? r.expires !== undefined || !r.limits || KEYS.some(key => !Number.isSafeInteger(r.limits![key]) || r.limits![key] <= 0)
    || Object.keys(r.limits).length !== KEYS.length : r.limits !== undefined || !Number.isSafeInteger(r.expires)) return false;
  return r.digest === operatorRequestDigest(r, grant);
}

const minute = (at: number) => `${new Date(at).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
/** What follows the UTC lapse sentence (plan #373): the same instant in the operator's own time zone where the root
 * knows it, and, where the trial's end cut the window short, that it is that end. Never part of the replayed request
 * text, which stays the UTC sentence alone, so earlier recorded requests replay unchanged. */
export function operatorLapseDetail(request: OperatorRequest, current: { expires: number }, zone?: string): string {
  const parts: string[] = [];
  if (zone !== undefined && zone !== 'UTC') parts.push(`${new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).format(request.expiresAt)} your time (${zone})`);
  if (request.expiresAt === current.expires) parts.push('the trial\'s current end, which a request cannot outlast');
  return parts.length ? ` That is ${parts.join(', and ')}.` : '';
}
const requestChange = (request: OperatorRequest, current: { limits: CapLimits; expires: number }) => request.action === 'raise-caps'
  ? KEYS.filter(key => request.limits![key] !== current.limits[key]).map(key =>
    `the ${LIMIT_NAMES[key][0]} allowance from ${current.limits[key]} to ${request.limits![key]} (${request.limits![key] - current.limits[key]} more ${LIMIT_NAMES[key][1]})`).join(' and ')
  : `this installation's end from ${minute(current.expires)} to ${minute(request.expires!)}`;
/** What the operator reads of a retraction besides its count (plan #389): the first and last listed turn, each
 * already redacted and clipped by the journal, which computes this from its own turns on issue and on replay. */
export interface RetractRendering { first: { update: number; text: string }; last: { update: number; text: string } }
/** Telegram sends this text as HTML: a quoted message is escaped so it reads as written. */
const html = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const messages = (count: number) => `${count} message${count === 1 ? '' : 's'}`;
const retractHead = (request: OperatorRequest, rendering: RetractRendering) => {
  const count = request.updates!.length, quote = (item: RetractRendering['first']) => `update ${item.update}: "${html(item.text)}"`;
  return `Request ${request.id}: treat ${messages(count)} sent through your account as test traffic, never as yours `
    + `(Rule 35: test identity never enters production state). ${count === 1 ? `It is ${quote(rendering.first)}. `
      : `The first is ${quote(rendering.first)}; the last is ${quote(rendering.last)}. `}Reason given: ${html(request.reason!)}. `
    + 'Once applied, no memory, standing instruction, commitment, blocker, open question or summary treats them as yours; '
    + 'the messages themselves stay in the journal. ';
};
const requestHead = (request: OperatorRequest, current: { limits: CapLimits; expires: number }, rendering?: RetractRendering) =>
  request.action === 'retract-turns' ? retractHead(request, rendering!)
    : `Request ${request.id}: ${request.action === 'raise-caps' ? 'raise' : 'extend'} ${requestChange(request, current)}. `;
/** The fixed, plain request the operator reads (Rule 82): the exact change, how to approve, and when it lapses. */
export function operatorRequestText(request: OperatorRequest, current: { limits: CapLimits; expires: number }, zone?: string | null,
  rendering?: RetractRendering): string {
  return `${requestHead(request, current, rendering)}To approve, reply "yes" as your next message here; anything else changes nothing. `
    + `This request lapses at ${minute(request.expiresAt)}.${zone === null ? '' : operatorLapseDetail(request, current, zone)}`;
}
/** The same request where the yes is the operator's GitHub review (P-05): the direct link to approve it (Rule 106). */
export function operatorReviewRequestText(request: OperatorRequest, current: { limits: CapLimits; expires: number }, link: string, zone?: string | null,
  rendering?: RetractRendering): string {
  return `${requestHead(request, current, rendering)}To approve, open ${link} and approve the pull request (Review changes, then Approve); `
    + `anything else changes nothing. This request lapses at ${minute(request.expiresAt)}.${zone === null ? '' : operatorLapseDetail(request, current, zone)}`;
}
/** The text of the request's own pull request and request file (P-05 route; plan #371). It names only the route that
 * approves it, the pull request's review: on this route a chat yes is not admissible, so it never mentions one. A
 * retraction's page also lists every update id it names, so the operator can check the exact list it binds. */
export function operatorReviewBodyText(request: OperatorRequest, current: { limits: CapLimits; expires: number }, zone?: string,
  rendering?: RetractRendering): string {
  return `${requestHead(request, current, rendering)}To approve, approve this pull request (Review changes, then Approve); anything else `
    + `changes nothing. This request lapses at ${minute(request.expiresAt)}.${operatorLapseDetail(request, current, zone)}`
    + (request.action === 'retract-turns' ? `\n\nThe exact update ids (${request.updates!.length}): ${request.updates!.join(', ')}` : '');
}
/** What an applied request set, from the request alone: the facts the approval-report question names. */
export const operatorRequestTarget = (request: OperatorRequest): string => request.action === 'raise-caps'
  ? `set the ${KEYS.map(key => `${LIMIT_NAMES[key][0]} allowance to ${request.limits![key]}`).join(', the ')}`
  : request.action === 'retract-turns' ? `stopped treating ${messages(request.updates!.length)} sent through your account as yours`
    : `extended this installation's end to ${minute(request.expires!)}`;
/** The fixed line the operator receives when a review-approved request completes. Under an operator acceptance of
 * shared account access it carries the disclosure (Purpose, the approval-account exception), written once. */
export function operatorResultText(request: OperatorRequest, before: { limits: CapLimits; expires: number }, shared: boolean): string {
  const done = request.action === 'retract-turns' ? `${messages(request.updates!.length)} sent through your account are no longer treated as yours`
    : `${request.action === 'raise-caps' ? 'raised' : 'extended'} ${requestChange(request, before)}`;
  return `Request ${request.id} is done: ${done}, approved through your GitHub account${shared ? `; note: ${SHARED_ACCESS_NOTE}` : ''}.`;
}
/** The fixed line when a proposal is out of bounds or not proposable: what was asked and why not. */
export const operatorRefusalText = (action: OperatorAction, reason: string) =>
  `I can't propose that ${action === 'raise-caps' ? 'limit raise' : 'renewal'}: ${reason}. Nothing changed.`;

/** Where an explicit yes can come from on this root, and why not when it cannot (Rule 3: no false claim). `acceptance`
 * names the account an operator acceptance covers and whether it is current (absent on the no-access route). */
export interface ExplicitYesStatus { connected: boolean; chat: { admissible: boolean; reason?: string };
  review: { admissible: boolean; reason?: string; breakerOpen?: boolean; acceptance?: { account: string; current: boolean; disclosure?: string } } }
export function explicitYesStatus(installation: ExplicitYesInstallation | undefined, bound: { chat: string; operator: string; trial?: string },
  review: { connected: boolean; breakerOpen?: boolean } = { connected: false }): ExplicitYesStatus {
  if (!installation) return { connected: false, chat: { admissible: false, reason: 'no explicit-yes installation record is configured' },
    review: { admissible: false, reason: 'no explicit-yes installation record is configured' } };
  const chat = installation.agentSpeaksAsOperatorInChat
    ? 'the installation record says the agent can speak as the operator in this chat (P-05), so a chat reply is not the operator\'s yes'
    : !installation.chat.agentHoldsNoAccess ? 'no P-02 record that the agent holds no access to the operator chat account'
      : installation.chat.boundChatId !== bound.chat || installation.chat.operatorAccountId !== bound.operator
        ? 'the installation record names a different chat or operator account than this installation' : undefined;
  const access = githubAccountAccess(installation), acceptance = installation.github?.acceptance ?? null;
  const reviewReason = access.kind === 'refused' ? access.detail
    : bound.trial !== undefined && installation.installation !== undefined && installation.installation !== bound.trial
      ? 'the installation record names a different trial than this one'
      : !review.connected ? 'the GitHub review source is not connected on this root' : undefined;
  const accepted = acceptance === null ? {} : { acceptance: { account: acceptance.account, current: access.kind === 'accepted',
    ...(access.kind === 'accepted' ? { disclosure: SHARED_ACCESS_NOTE } : {}) } };
  return { connected: true, chat: chat === undefined ? { admissible: true } : { admissible: false, reason: chat },
    review: { admissible: reviewReason === undefined, ...(reviewReason === undefined ? {} : { reason: reviewReason }),
      ...(review.breakerOpen ? { breakerOpen: true } : {}), ...accepted } };
}

/** One operator message as the binding reads it: its Telegram ids, edit state and text. */
export interface ChatCandidate { chatId: string; messageId: number; replyTo: number | null; senderId: string; thread: number | null;
  edited: boolean; text: string; at: number }
/** How a message answers a request: a Telegram reply to the request's own message, or the operator's NEXT message
 * in that conversation after it (Telegram ids in a private chat increase across both sides). Anything else is not
 * an answer to it, so a later unrelated message can never approve. An edit is never a fresh yes. */
export function chatBinding(request: { message: number; thread: number | null }, candidate: ChatCandidate,
  otherOperatorMessages: readonly { messageId: number; thread: number | null }[]): 'reply' | 'next' | null {
  if (candidate.edited || candidate.thread !== request.thread) return null;
  if (candidate.replyTo === request.message) return 'reply';
  if (candidate.replyTo !== null || candidate.messageId <= request.message) return null;
  return otherOperatorMessages.some(item => item.thread === request.thread && item.messageId > request.message
    && item.messageId < candidate.messageId) ? null : 'next';
}

const clock = (at: number) => ({ type: 'Measurement', schemaVersion: 1, subject: { kind: 'clock', instance: 'preview-intake-clock' },
  value: at, unit: 'unix-ms', at, by: 'preview-intake' }) as unknown as Clock;
/** The single admission of a chat yes for one request: Part One's `admitExplicitYes` through Part Eleven's boundary.
 * `approver` is the principal minted from this exact update at intake; `requestedBy` the runner's own system writer. */
export function admitChatYes(input: { request: OperatorRequest; message: number; grant: string; chat: string;
  installation: ExplicitYesInstallation; approver: VerifiedPrincipal; requestedBy: VerifiedPrincipal; candidate: ChatCandidate;
  consumed: readonly string[]; context: BoundaryContext }): { kind: 'approved'; record: ExplicitYesRecord } | { kind: 'refused'; detail: string } {
  const { request } = input;
  const yes: ExplicitYesRequest = { requestId: request.id, requestDigest: request.digest, authorizationId: `authorization:${request.id}`,
    approver: input.approver, requestedBy: input.requestedBy, under: input.grant, action: request.action,
    scope: { type: 'Scope', schemaVersion: 1, kind: 'conversation', members: [input.chat] } as unknown as Scope,
    artifact: request.digest, base: request.base, kind: { kind: 'approval' }, chatMessageId: String(input.message), head: null,
    issuedAt: request.issuedAt, expiresAt: request.expiresAt };
  // The binding (reply, or next message) was decided before this call; the observation names the request message it answers.
  const observation = { kind: 'chat-reply' as const, chatId: input.candidate.chatId, messageId: String(input.candidate.messageId),
    replyToMessageId: String(input.message), senderAccountId: input.candidate.senderId, text: input.candidate.text, at: clock(input.candidate.at) };
  type Verdict = { kind: 'approved'; record: ExplicitYesRecord } | { kind: 'refused'; detail: string };
  return consumeResult<ExplicitYesRecord, Verdict>(produceExplicitYes(yes, input.installation, observation, input.consumed, input.context), {
    Success: record => ({ kind: 'approved', record }), Refused: refusal => ({ kind: 'refused', detail: refusal.detail }) });
}
/** The authority a completed request writes on its caps or expiry row; the reference is the consumed yes. A yes admitted
 * under an operator acceptance of shared account access carries the disclosure into that history (Rule 90). */
export const operatorYesAuthority = (requestId: string, reference: string, shared = false) =>
  `operator-yes:${requestId}:${reference}${shared ? ` [shared-access: ${SHARED_ACCESS_NOTE}]` : ''}`;
export const OPERATOR_YES_AUTHORITY = /^operator-yes:([0-9a-f]{16}):(\S+)(?: \[shared-access: [^\]]+\])?$/u;
/** The live surface of the two declared operator actions on this root (Rules 3, 79): the phone route an explicit yes can
 * really come from now, or the declarations' host command line where none is admissible. Never claimed ahead of the facts.
 * `renewalInstalled` is true only when the reviewed activation for a later trial end (--renewal-activation) validated now,
 * exactly as the runner validates it before proposing a renewal; only then is renewal a phone action with no host fallback. */
export function operatorActionSurface(status: Partial<ExplicitYesStatus> | undefined, renewalInstalled = false): { raiseCaps: string; renewExpiry: string } {
  const host = 'host command line on the trial machine (journal-agent.mjs)';
  const route = status?.chat?.admissible ? 'phone: the operator replies "yes" to the exact request in the bound chat'
    : status?.review?.admissible ? `phone: the operator approves the exact request's GitHub pull request at the link sent in chat${
      status.review.acceptance?.current ? ` (note: ${SHARED_ACCESS_NOTE})` : ''}` : null;
  return { raiseCaps: route ?? host,
    renewExpiry: route === null ? host : renewalInstalled ? route
      : `${route}, once the reviewed activation for the new trial end is installed (--renewal-activation); until then ${host}` };
}
