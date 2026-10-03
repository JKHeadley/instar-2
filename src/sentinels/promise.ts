/**
 * Promise sentinel — the 2.0 port of 1.x PromiseBeacon's follow-through arm, reduced to one pure decision.
 *
 * It consumes the owner's durable population of open promises that carry an absolute due instant (Part 18 §6:
 * this part creates no competing commitment schema). When an agent-owned promise reaches its instant without a
 * definite work result at or after it, the sentinel asks the owner once to act (the owner's own bounded
 * obligation step). If the promise is still unacted `reportAfterMs` later, it is reported: a pull-visible finding,
 * never a push, because a due date alone neither proves the work happened nor makes a message eligible.
 * A promise that waits on the operator or an outside party is reported as waiting, never narrated as agent progress.
 *
 * `stopped` suppresses every action. Every uncertain case (no due instant, an unparseable time) is left alone.
 */

export interface PromiseObservation {
  readonly id: string;
  readonly owner: 'agent' | 'operator';
  readonly dueAt: number;
  /** When a definite (not failed, not uncertain) work result was last recorded; null when none. */
  readonly actedAt: number | null;
  /** Who or what the promise waits on, as the owner recorded it. */
  readonly waitsOn: string;
}
export interface PromiseEntry {
  readonly dueSeenAt: number;
  readonly workRequestedAt: number | null;
  readonly reportedAt: number | null;
  readonly closedAt: number | null;
  readonly outcome: 'open' | 'acted' | 'reported' | 'waiting' | 'closed';
}
export type PromiseState = Readonly<Record<string, PromiseEntry>>;
export type PromiseEvent = 'work-requested' | 'acted' | 'overdue-reported' | 'waiting-reported' | 'closed';
export type PromiseAction =
  | Readonly<{ kind: 'work'; id: string }>
  | Readonly<{ kind: 'report'; id: string; detail: string }>
  | Readonly<{ kind: 'signal'; id: string; event: PromiseEvent; detail: string }>;
export interface PromiseConfig { readonly reportAfterMs: number; readonly keepClosed: number }
export const defaultPromiseConfig: PromiseConfig = Object.freeze({ reportAfterMs: 600_000, keepClosed: 16 });

const waitsOnOthers = (waitsOn: string) => waitsOn === 'operator' || waitsOn === 'external' || waitsOn === 'user-input'
  || waitsOn === 'user-authorization';

export function decidePromises(input: Readonly<{ now: number; stopped: boolean; promises: readonly PromiseObservation[];
  state: PromiseState; config?: Partial<PromiseConfig> }>): Readonly<{ state: PromiseState; actions: readonly PromiseAction[] }> {
  const config = { ...defaultPromiseConfig, ...input.config };
  if (input.stopped) return Object.freeze({ state: input.state, actions: [] });
  const next: Record<string, PromiseEntry> = { ...input.state };
  const actions: PromiseAction[] = [];
  const open = new Set<string>();
  for (const item of input.promises) {
    if (!Number.isSafeInteger(item.dueAt) || item.dueAt > input.now) continue;
    open.add(item.id);
    const entry = next[item.id];
    if (entry?.closedAt != null) continue;
    const base: PromiseEntry = entry ?? { dueSeenAt: input.now, workRequestedAt: null, reportedAt: null, closedAt: null, outcome: 'open' };
    if (item.actedAt !== null && item.actedAt >= item.dueAt) {
      if (base.outcome !== 'acted') {
        next[item.id] = { ...base, outcome: 'acted' };
        actions.push({ kind: 'signal', id: item.id, event: 'acted', detail: 'a definite work result exists at or after the due instant' });
      }
      continue;
    }
    if (item.owner === 'operator' || waitsOnOthers(item.waitsOn)) {
      if (base.reportedAt === null) {
        const detail = `due and waiting on ${item.owner === 'operator' ? 'the operator' : item.waitsOn}`;
        next[item.id] = { ...base, reportedAt: input.now, outcome: 'waiting' };
        actions.push({ kind: 'report', id: item.id, detail }, { kind: 'signal', id: item.id, event: 'waiting-reported', detail });
      }
      continue;
    }
    if (base.workRequestedAt === null) {
      next[item.id] = { ...base, workRequestedAt: input.now };
      actions.push({ kind: 'work', id: item.id },
        { kind: 'signal', id: item.id, event: 'work-requested', detail: 'due with no definite work result' });
    } else if (base.reportedAt === null && input.now - base.workRequestedAt >= config.reportAfterMs) {
      const detail = 'overdue: still no definite work result after the work request';
      next[item.id] = { ...base, reportedAt: input.now, outcome: 'reported' };
      actions.push({ kind: 'report', id: item.id, detail }, { kind: 'signal', id: item.id, event: 'overdue-reported', detail });
    }
  }
  for (const [id, entry] of Object.entries(next)) if (!open.has(id) && entry.closedAt === null) {
    next[id] = { ...entry, closedAt: input.now, outcome: entry.outcome === 'open' || entry.outcome === 'reported' ? 'closed' : entry.outcome };
    actions.push({ kind: 'signal', id, event: 'closed', detail: 'no longer open' });
  }
  const closed = Object.entries(next).filter(([, entry]) => entry.closedAt !== null)
    .sort(([, a], [, b]) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  for (const [id] of closed.slice(config.keepClosed)) delete next[id];
  return Object.freeze({ state: Object.freeze(next), actions });
}
