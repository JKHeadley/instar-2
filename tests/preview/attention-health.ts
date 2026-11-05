/** Row 88: adapt 1.x's condition episodes and entity-stable Agent Health lane
 * to the installed obligation producer. R4/26: these are exact journal facts,
 * not an intent classifier. R52/53/87: one pull item per condition, no sends.
 * R63: the Attention surface supplies the current-owner append boundary.
 */
import { createHash } from 'node:crypto';
import type { JournalView } from './journal.js';
import { loopHealth } from './obligations.js';
import type { AttentionQueue } from './attention-queue.js';

export function produceAttentionHealth(view: JournalView, queue: AttentionQueue, now: number): void {
  const health = loopHealth(view, now);
  const observations = [
    { conditionType: 'backlog-overdue', active: health.backlogOverdue, title: 'Accepted work is overdue',
      summary: `${health.unfinished} accepted work item(s) remain unfinished. This observation does not retry or close them.` },
    { conditionType: 'stalled-work', active: health.stalledWork.length > 0, title: 'Work has not returned a result',
      summary: `${health.stalledWork.length} work step(s) are past their progress bound. Their original starts remain recorded.` },
    { conditionType: 'delivery-unknown', active: health.deliveryUnknown > 0, title: 'A delivery is unconfirmed',
      summary: `${health.deliveryUnknown} result delivery outcome(s) are unknown. No automatic resend is authorized.` },
    { conditionType: 'recovery-unknown', active: health.recoveryUnknown > 0, title: 'Earlier work needs reconciliation',
      summary: `${health.recoveryUnknown} interrupted work step(s) may already have acted. They remain held without replay.` },
  ];
  // Journal grant identifiers have no short-text bound. Hash the complete binding
  // so valid long/unicode identifiers cannot overflow the Attention item bound.
  const subject = createHash('sha256').update(JSON.stringify([view.genesis.bot, view.genesis.chat, view.genesis.grant])).digest('hex');
  for (const observation of observations) queue.observeHealth({ producer: 'obligation-health',
    conditionType: observation.conditionType, subject, scope: 'installation' }, observation.active,
  { title: observation.title, summary: observation.summary, category: 'agent-health', priority: 'NORMAL' });
}
