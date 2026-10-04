/** Fixed operator pull reply, projected only from the preview's durable journal. */
import { redact } from '../../src/recall/redact.js';
import { dueState, localParts } from './dated-memory.js';
import { messageTime } from './self-state.js';
import type { JournalView } from './journal.js';
import { loopStatusLines } from './obligations.js';

/** Content-free count of replies Telegram accepted after the operator-echo path released them. */
export const operatorEchoSent = (view: JournalView) => view.order.filter(turn => turn.sent !== undefined
  && turn.replyChecks?.some(check => check.path === 'operator-echo')).length;

export const isStatusCommand = (text: string): boolean => /^(?:status|how are you doing)\s*[?.!]?$/iu.test(text.trim());
/** The operator's emergency stop from the phone: an exact command (Rule 4), confirmed by button. */
export const isStopCommand = (text: string): boolean => /^\/stop$/iu.test(text.trim());
export const STOP_CONFIRM_TEXT = 'Stop this preview permanently? Approving halts every model call and message from me until a new trial is set up. Your saved messages stay saved. Tap Approve or Decline below.';

/** Accepted turns whose message is dated today in `zone` (the status reply's and the dashboard's one count). */
export function turnsToday(view: JournalView, now: number, zone: string): number {
  const local = localParts(now, zone);
  return view.order.reduce((count, turn) => {
    const time = turn.accepted ? messageTime(turn) : null;
    if (time === null) return count;
    const sent = localParts(time, zone);
    return count + Number(sent.year === local.year && sent.month === local.month && sent.day === local.day);
  }, 0);
}
/** Held replies by their recorded reason (the status reply's and the dashboard's one count). */
export function heldReplies(view: JournalView): Map<string, number> {
  const held = new Map<string, number>();
  for (const turn of view.order) if (turn.accepted && turn.held && !turn.intent)
    held.set(turn.held, (held.get(turn.held) ?? 0) + 1);
  return held;
}

export function statusReply(view: JournalView, now: number, zone: string, extra: readonly string[] = []): string {
  const local = localParts(now, zone);
  const today = `${String(local.year).padStart(4, '0')}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
  const turns = turnsToday(view, now, zone);
  const held = heldReplies(view);
  const pending = view.order.filter(turn => turn.accepted && (
    (turn.datedPending && !view.memory.some(change => change.mode !== 'prefer' && change.source === turn.id))
    || (!turn.memoryUndecided && (turn.memoryPending || turn.held === 'memory correction pending')
      && !view.summaries.some(summary => summary.memoryFor?.includes(turn.id)))));
  const dated = view.dated.filter(item => item.day && !item.ambiguity && dueState(item, now) !== 'overdue'
    && !view.memory.some(change => change.mode !== 'prefer' && change.source === item.source
      && (item.quote.includes(change.quote) || change.quote.includes(item.quote))))
    .sort((a, b) => `${a.day} ${a.time ?? '00:00'}`.localeCompare(`${b.day} ${b.time ?? '00:00'}`));
  const next = dated[0];
  const nextText = next ? `${next.day}${next.time ? ` ${next.time}` : ''} (${next.zone}): ${redact(next.quote).text.slice(0, 300)}` : 'none confirmed';
  return [
    `Status (${today}, ${zone})`,
    `Turns today: ${turns}.`,
    `Held replies: ${held.size ? [...held].map(([reason, count]) => `${count} ${reason}`).join('; ') : 'none'}.`,
    `Pending memory decisions: ${pending.length}${pending.length ? ` (updates ${pending.map(turn => turn.update).join(', ')})` : ''}.`,
    `Next dated item: ${nextText}.`,
    ...loopStatusLines(view, now),
    ...extra,
    `Spend allowance: ${view.calls}/${view.limits.maxCalls} subscription attempts; ${view.jevChecks}/${view.limits.maxReplies} Jev checks. Dollar spend/cap: not recorded in this journal. Replies: ${view.replies}/${view.limits.maxReplies} used.`,
    `Replies sent as your own words repeated back, without the second check: ${operatorEchoSent(view)}.`,
  ].join('\n');
}
/** The whole chat "status" answer: the fixed reply, then the host's pull lines. The chat reply and the operator dashboard
 * both read it from here, so the two can never say different things. */
export const statusAnswer = (view: JournalView, now: number, zone: string, extra: readonly string[] = [], lines: readonly string[] = []): string =>
  [statusReply(view, now, zone, extra), ...lines].join('\n');
