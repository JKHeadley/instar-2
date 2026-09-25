import type { ScheduledPriority } from './contracts.js';

export type ScheduledUsageLevel = 'normal' | 'elevated' | 'critical' | 'shutdown' | 'unknown';

/** Pure 1.x priority brake. Unknown usage preserves room for urgent work only. */
export function shouldRunScheduledPriority(priority: ScheduledPriority, usage: ScheduledUsageLevel): boolean {
  if (usage === 'shutdown') return false;
  if (usage === 'critical') return priority === 'critical';
  if (usage === 'elevated' || usage === 'unknown') return priority === 'high' || priority === 'critical';
  return priority === 'medium' || priority === 'high' || priority === 'critical';
}
