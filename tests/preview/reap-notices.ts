import type { SessionWorkEdge, SessionWorkEdgeClose } from '../../src/assembly/production-session-work.js';
import { openReplyNotices, type NoticeTurn, type ReplyNotice } from './credential-reminders.js';

/** Port of 1.x ReapLog/ReapNotifier's occurrence/outcome split and bounded aggregate.
 * The encrypted journal retains every occurrence; this small per-topic projection
 * avoids rereading the entire log on every answer (the 1.x 142MB reap-log failure).
 * Snapshots carry it with the existing projection. Unknown legacy topics stay private. */
export type ReapHistory = Readonly<Record<string, Readonly<{ total: number; last: string }>>>;
export function recordIdleReap(history: ReapHistory | undefined, edge: SessionWorkEdge | undefined,
  close: SessionWorkEdgeClose): ReapHistory | undefined {
  if (!edge?.topic || !/^(?:main|[1-9][0-9]{0,15})$/u.test(edge.topic)
    || close.edge !== edge.id || !edge.id.endsWith(':process') || close.id !== `${edge.id.slice(0, -8)}:idle-close`
    || close.state !== 'complete' || !close.child || !close.evidence.trim()) return history;
  return { ...history, [edge.topic]: { total: (history?.[edge.topic]?.total ?? 0) + 1, last: close.id } };
}

/** Rules 52/63/87/89: one infrastructure line in this conversation's next answer;
 * no standalone send, other-topic disclosure, transcript text or process details.
 * A consumed cumulative occurrence key covers the preceding batch. The existing
 * send funnel reserves keys for held answers and unknown receipts, even on restart. */
export function reapNotices(history: ReapHistory | undefined, turns: readonly NoticeTurn[], current: string, topic: string): ReplyNotice[] {
  const total = history?.[topic]?.total ?? 0;
  if (!total) return [];
  const prefix = `reap:${topic}:`;
  const prior = turns.flatMap(turn => turn.answerNotices ?? []).filter(notice => notice.key.startsWith(prefix));
  const open = new Set(openReplyNotices(turns, prior, current).map(notice => notice.key));
  let covered = 0;
  for (const notice of prior) {
    const count = Number(notice.key.slice(prefix.length));
    if (!open.has(notice.key) && Number.isSafeInteger(count) && count > covered && count <= total) covered = count;
  }
  const count = total - covered;
  if (!count) return [];
  return [{ key: `${prefix}${total}`,
    line: `System note: idle cleanup closed ${count} worker${count === 1 ? '' : 's'} in this conversation to free capacity. `
      + 'The next message after cleanup needs a worker start. Your conversation history and accepted messages were kept.' }];
}
