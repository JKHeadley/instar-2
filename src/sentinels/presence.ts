/**
 * Presence sentinel — the 2.0 port of 1.x PresenceProxy, reduced to one pure decision over observations.
 *
 * It watches the answer obligation of each admitted operator message and never speaks from a timer alone
 * (Part 18 §6): a message unanswered past `thresholdMs` first gets one bounded self-heal request (the owner
 * re-runs its ordinary pass). Only when the message is still unanswered `healWindowMs` later, and its cause is
 * one a holding note can describe truthfully, does the sentinel mark a holding note due. The note itself is the
 * owner's existing infrastructure answer (fixed text, signed as infrastructure, budgeted and sent once); this
 * module only decides that it is due.
 *
 * Fails toward silence: a cause it cannot describe truthfully (an operator-owned wait, a message that already has
 * its own notice, a call still running, anything unknown) is recorded as a signal and never gets a note. `stopped`
 * suppresses every action.
 */

/** Why an admitted message is still unanswered, as the owner observed it. */
export type PresenceCause =
  /** held because a pre-send check could not decide; the message is kept and answered when the check returns */
  | 'held-check'
  /** nothing holds it and no call is running for it: the ordinary pass has not picked it up */
  | 'unpicked'
  /** a model call for it is running now (the owner's own busy-worker answer covers this case) */
  | 'in-flight'
  /** it waits on the operator (for example a pending memory decision): a note would misstate whose move it is */
  | 'waiting-operator'
  /** it already has its own notice or limited answer */
  | 'own-notice'
  | 'unknown';
export interface PresenceTurn { readonly id: string; readonly receivedAt: number; readonly answered: boolean; readonly cause: PresenceCause }
export interface PresenceEntry {
  readonly firstSeenAt: number;
  readonly cause: PresenceCause;
  readonly healAt: number | null;
  readonly noteDueAt: number | null;
  readonly closedAt: number | null;
}
export type PresenceState = Readonly<Record<string, PresenceEntry>>;
export type PresenceEvent = 'unanswered-observed' | 'self-heal-requested' | 'holding-note-due' | 'answered-after-heal' | 'answered-after-note';
export type PresenceAction =
  | Readonly<{ kind: 'self-heal'; turn: string }>
  | Readonly<{ kind: 'note-due'; turn: string; cause: PresenceCause }>
  | Readonly<{ kind: 'signal'; turn: string; event: PresenceEvent; detail: string }>;
export interface PresenceConfig {
  readonly thresholdMs: number;
  readonly healWindowMs: number;
  /** Closed entries kept for status; older closed ones are dropped so the state stays bounded. */
  readonly keepClosed: number;
}
export const defaultPresenceConfig: PresenceConfig = Object.freeze({ thresholdMs: 300_000, healWindowMs: 120_000, keepClosed: 16 });

const describable = (cause: PresenceCause) => cause === 'held-check' || cause === 'unpicked';

export function decidePresence(input: Readonly<{ now: number; stopped: boolean; turns: readonly PresenceTurn[];
  state: PresenceState; config?: Partial<PresenceConfig> }>): Readonly<{ state: PresenceState; actions: readonly PresenceAction[] }> {
  const config = { ...defaultPresenceConfig, ...input.config };
  if (input.stopped) return Object.freeze({ state: input.state, actions: [] });
  const next: Record<string, PresenceEntry> = { ...input.state };
  const actions: PresenceAction[] = [];
  const seen = new Set<string>();
  for (const turn of input.turns) {
    seen.add(turn.id);
    const entry = next[turn.id];
    if (turn.answered) {
      if (entry && entry.closedAt === null && entry.healAt !== null) {
        next[turn.id] = { ...entry, closedAt: input.now };
        actions.push({ kind: 'signal', turn: turn.id, event: entry.noteDueAt === null ? 'answered-after-heal' : 'answered-after-note',
          detail: entry.noteDueAt === null ? 'answered after the self-heal request' : 'answered after the holding note was due' });
      } else if (entry && entry.closedAt === null) next[turn.id] = { ...entry, closedAt: input.now };
      continue;
    }
    if (!Number.isSafeInteger(turn.receivedAt) || input.now - turn.receivedAt < config.thresholdMs) continue;
    if (entry?.closedAt != null) continue;
    if (!describable(turn.cause)) {
      if (!entry || entry.cause !== turn.cause) {
        next[turn.id] = { firstSeenAt: entry?.firstSeenAt ?? input.now, cause: turn.cause, healAt: entry?.healAt ?? null,
          noteDueAt: entry?.noteDueAt ?? null, closedAt: null };
        actions.push({ kind: 'signal', turn: turn.id, event: 'unanswered-observed', detail: `${turn.cause}: signal only, no note` });
      }
      continue;
    }
    if (!entry || entry.healAt === null) {
      next[turn.id] = { firstSeenAt: entry?.firstSeenAt ?? input.now, cause: turn.cause, healAt: input.now, noteDueAt: null, closedAt: null };
      actions.push({ kind: 'self-heal', turn: turn.id },
        { kind: 'signal', turn: turn.id, event: 'self-heal-requested', detail: `${turn.cause}: unanswered past the threshold` });
    } else if (entry.noteDueAt === null && input.now - entry.healAt >= config.healWindowMs) {
      next[turn.id] = { ...entry, cause: turn.cause, noteDueAt: input.now };
      actions.push({ kind: 'note-due', turn: turn.id, cause: turn.cause },
        { kind: 'signal', turn: turn.id, event: 'holding-note-due', detail: `${turn.cause}: still unanswered after the self-heal request` });
    }
  }
  // An entry whose message left the observation (settled elsewhere, retracted) is closed, not forgotten.
  for (const [id, entry] of Object.entries(next)) if (!seen.has(id) && entry.closedAt === null) next[id] = { ...entry, closedAt: input.now };
  const closed = Object.entries(next).filter(([, entry]) => entry.closedAt !== null)
    .sort(([, a], [, b]) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  for (const [id] of closed.slice(config.keepClosed)) delete next[id];
  return Object.freeze({ state: Object.freeze(next), actions });
}
