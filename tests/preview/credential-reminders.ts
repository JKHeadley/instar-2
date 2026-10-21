// Rules 8, 100 on the reply path. A due credential reminder (the escalating schedule
// secret-custody keeps for a known fixed expiry) is an open loop the operator must hear about.
// A failing doorway-map check is not: it is the agent's own maintenance (Rules 56, 87, 88) and
// stays on the status pull surface. Recorded answers that carried one still validate (doorway: keys).
// The reply-only grant allows no unsolicited send, so each rides the next operator answer as ONE fixed line, the way finished
// obligation work does. Each line carries a stable key; the journal records the keys an
// answer carried, so delivery is derived from durable sent replies, never from memory.
// A line is offered once: a later reminder stage or a renewed credential lifetime is a new key.
import type { DueReminder } from './secret-custody.js';
import { wholeReplySent, wholeReplySentAt } from './reply-parts.js';

export interface ReplyNotice { readonly key: string; readonly line: string }
export interface SessionLoginObservation {
  readonly key: string; readonly slot: number; readonly state: 'present' | 'missing' | 'unknown'; readonly at: number;
}
/** A sample is advisory and expires; an old live worker is not proof of a current one. */
export const SESSION_LOGIN_FRESH_MS = 30_000;
export function sessionLoginNotices(observations: readonly SessionLoginObservation[], now: number): ReplyNotice[] {
  return observations.filter(item => item.state === 'missing' && now >= item.at && now - item.at <= SESSION_LOGIN_FRESH_MS)
    .map(item => ({ key: item.key, line: `Reminder: a running session’s approved model sign-in ${item.slot} is missing from this machine. `
      + 'Sign the approved model account back in here before that session needs to restart.' }));
}
export function sessionLoginStatus(observations: readonly SessionLoginObservation[], now: number): string {
  const fresh = observations.filter(item => now >= item.at && now - item.at <= SESSION_LOGIN_FRESH_MS);
  return `Session sign-ins: ${fresh.filter(item => item.state === 'missing').length} missing; `
    + `${fresh.filter(item => item.state === 'present').length} present at the last live-session check; `
    + `${observations.length - fresh.filter(item => item.state !== 'unknown').length} unknown or stale.`
    + (fresh.some(item => item.state === 'missing') ? ` Missing approved login slots: ${fresh.filter(item => item.state === 'missing').map(item => item.slot).join(', ')}.` : '');
}
/** The turn fields this module reads; structurally the journal's own Turn. */
export interface NoticeTurn { readonly id: string; readonly intent?: string; readonly sent?: number; readonly sentAt?: number;
  readonly replyParts?: readonly { sent?: number; sentAt?: number }[]; readonly answerNotices?: readonly ReplyNotice[] }

const MINUTE = 60_000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
/** Rule 13: the number is bound to what it measures in the same sentence ("expires in 6 days 23 h"). */
export function remainingText(ms: number): string {
  if (ms <= 0) return 'has expired';
  const days = Math.floor(ms / DAY), hours = Math.floor(ms % DAY / HOUR), minutes = Math.floor(ms % HOUR / MINUTE);
  const parts = days ? [`${days} day${days === 1 ? '' : 's'}`, ...(hours ? [`${hours} h`] : [])]
    : hours ? [`${hours} h`, ...(minutes ? [`${minutes} min`] : [])] : [`${Math.max(1, minutes)} min`];
  return `expires in ${parts.join(' ')}`;
}

/** Scoped to one credential lifetime (its expiry): a renewal under the same name starts undelivered. */
export const credentialKey = (due: Pick<DueReminder, 'name' | 'expiresAt' | 'stage'>) =>
  `credential:${due.name}:${due.expiresAt}:${due.stage}`;

/** One line per due reminder stage, most urgent (earliest expiry) first. */
export function credentialNotices(due: readonly DueReminder[], now: number): ReplyNotice[] {
  return [...due].sort((a, b) => a.expiresAt - b.expiresAt || a.name.localeCompare(b.name)).map(item => ({
    key: credentialKey(item),
    line: `Reminder: ${item.displayLabel ?? 'your stored credential'} ${remainingText(item.expiresAt - now)}. `
      + `Smallest step for you: ${item.smallestHumanAction}.` }));
}

/** Candidates a new answer may carry, credentials first. A key is spent when a reply that says its line
 * has a send intent (sent, or its receipt unknown: never repeated), or when another unsent answer holds it. */
export function openReplyNotices(turns: readonly NoticeTurn[], candidates: readonly ReplyNotice[], current: string): ReplyNotice[] {
  const spent = new Set(turns.filter(turn => turn.id !== current).flatMap(turn => (turn.answerNotices ?? [])
    .filter(notice => turn.intent === undefined || turn.intent.includes(notice.line)).map(notice => notice.key)));
  return candidates.filter(notice => !spent.has(notice.key));
}

/** Keys a sent reply actually delivered (every message of it accepted, Rule 42), with the last message's send time. */
export function deliveredNotices(turns: readonly NoticeTurn[]): Map<string, number> {
  const delivered = new Map<string, number>();
  for (const turn of turns) for (const notice of turn.answerNotices ?? [])
    if (wholeReplySent(turn) && turn.intent?.includes(notice.line)) delivered.set(notice.key, wholeReplySentAt(turn) ?? 0);
  return delivered;
}

/** `status.credentials.due` with delivery: the latest stage a sent reply carried, and when. */
export function dueWithDelivery(due: readonly DueReminder[], turns: readonly NoticeTurn[]) {
  const delivered = deliveredNotices(turns);
  return due.map(item => {
    const stages = Array.from({ length: item.stage + 1 }, (_, stage) => stage)
      .filter(stage => delivered.has(credentialKey({ ...item, stage })));
    const last = stages.at(-1);
    return { ...item, delivered: last === undefined ? null
      : { stage: last, at: delivered.get(credentialKey({ ...item, stage: last }))!, current: last === item.stage } };
  });
}

/** A recorded answer's notices: at most one, each line said verbatim in the answer text. */
export function validAnswerNotices(value: unknown, text: string): value is ReplyNotice[] {
  return Array.isArray(value) && value.length === 1 && value.every(item => item && typeof item === 'object'
    && Object.keys(item).length === 2 && typeof item.key === 'string' && /^(credential|doorway|effect):[^\s]{1,200}$/u.test(item.key)
    && typeof item.line === 'string' && item.line.length > 0 && item.line.length <= 600 && text.includes(item.line));
}
