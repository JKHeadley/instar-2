// Rules 8, 56, 100 on the reply path. A due credential reminder (the escalating schedule
// secret-custody keeps for a known fixed expiry) and a failing doorway-map check are
// open loops the operator must hear about. The reply-only grant allows no unsolicited
// send, so each rides the next operator answer as ONE fixed line, the way finished
// obligation work does. Each line carries a stable key; the journal records the keys an
// answer carried, so delivery is derived from durable sent replies, never from memory.
// A line is offered once: a later reminder stage, a renewed credential lifetime or a new failing
// verdict is a new key.
import type { DueReminder } from './secret-custody.js';
import { doorwayFreshness, type DoorwayMap } from './doorway-map.js';

export interface ReplyNotice { readonly key: string; readonly line: string }
/** The turn fields this module reads; structurally the journal's own Turn. */
export interface NoticeTurn { readonly id: string; readonly intent?: string; readonly sent?: number; readonly sentAt?: number;
  readonly answerNotices?: readonly ReplyNotice[] }

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
    line: `Reminder: the credential "${item.name}" (${item.identity}) ${remainingText(item.expiresAt - now)}. `
      + `Smallest step for you: ${item.smallestHumanAction}.` }));
}

/** A failing standing check (Rule 56) is one notice per verdict episode, keyed by when the verdict
 * began. It is offered only while the live verdict still fails, so a route this very answer just
 * re-verified is never reported stale. */
export function doorwayNotices(map: DoorwayMap | null, now: number): ReplyNotice[] {
  if (!map?.check || map.check.fresh) return [];
  const failing = doorwayFreshness(map, now).models.filter(model => !model.fresh);
  if (!failing.length) return [];
  return [{ key: `doorway:${map.check.since}`,
    line: `Model route check: ${failing.slice(0, 3).map(model => `${model.doorway}/${model.model} is ${model.state}`).join('; ')}`
      + `${failing.length > 3 ? ` (+${failing.length - 3} more)` : ''}; send "status" for detail.` }];
}

/** Candidates a new answer may carry, credentials first. A key is spent when a reply that says its line
 * has a send intent (sent, or its receipt unknown: never repeated), or when another unsent answer holds it. */
export function openReplyNotices(turns: readonly NoticeTurn[], candidates: readonly ReplyNotice[], current: string): ReplyNotice[] {
  const spent = new Set(turns.filter(turn => turn.id !== current).flatMap(turn => (turn.answerNotices ?? [])
    .filter(notice => turn.intent === undefined || turn.intent.includes(notice.line)).map(notice => notice.key)));
  return candidates.filter(notice => !spent.has(notice.key));
}

/** Keys a sent reply actually delivered (its receipt recorded), with the send time. */
export function deliveredNotices(turns: readonly NoticeTurn[]): Map<string, number> {
  const delivered = new Map<string, number>();
  for (const turn of turns) for (const notice of turn.answerNotices ?? [])
    if (turn.sent !== undefined && turn.intent?.includes(notice.line)) delivered.set(notice.key, turn.sentAt ?? 0);
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
