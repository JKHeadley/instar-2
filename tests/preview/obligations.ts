/** The agent's one population of open obligations, projected from the durable journal
 * (Rules 8, 46, 64, 83, 92, 93, 99). Nothing here is stored beside the journal: replay
 * rebuilds it exactly, and every item stays open until a recorded cause closes it. */
import { dueState } from './dated-memory.js';
import { LOOP_REVISIT_MS, loopRevisits, openBlockers, openDirectives, openQuestionCandidates, pendingRequestedReminders,
  probeTurn, wallEpoch, type JournalView, type Turn } from './journal.js';

/** Measured engineering defaults (Rule 46/64): accepted work older than this, or no forward
 * progress for this long while work waits, is reported as overdue on the pull surface. */
export const BACKLOG_AGE_LIMIT_MS = 30 * 60_000;
export const PROGRESS_STALL_MS = 30 * 60_000;

export type LoopKind = 'commitment' | 'directive' | 'blocker' | 'question' | 'reminder';
export type LoopDefect = 'overdue-check-in' | 'overdue-recheck' | 'overdue-reminder' | 'undeclared-dependency';
export interface OpenLoop { kind: LoopKind; id: string; source: string; owner: 'agent' | 'operator'; waitsOn: string;
  openedAt: number; /** Next resurfacing or due time; null when every packet carries it. */ nextAt: number | null;
  revisitDue: boolean; defect?: LoopDefect }

const settled = (view: JournalView, turn: Turn) => turn.intent !== undefined || turn.sent !== undefined
  || turn.editOf !== undefined || turn.held === 'superseded by edit' || turn.groupedInto !== undefined;

/** Every open obligation, oldest first. A closure, completion, supersession or clearing recheck is the only exit. */
export function openLoops(view: JournalView, now: number): OpenLoop[] {
  const loops: OpenLoop[] = [], revisits = loopRevisits(view);
  view.commitments.forEach((note, id) => {
    const source = view.turns.get(note.source);
    if (view.closed.has(id) || !source || probeTurn(view, source) || view.memory.some(change => change.mode === 'forget'
      && change.source === note.source && note.quote.includes(change.quote))) return;
    const waitsOn = note.waitsOn ?? note.agentPromise?.waitsOn;
    const nextAt = (revisits.get(id) ?? source.at) + LOOP_REVISIT_MS;
    const defect: LoopDefect | undefined = note.agentPromise?.due && dueState(note.agentPromise.due, now) === 'overdue'
      ? 'overdue-check-in' : waitsOn === undefined ? 'undeclared-dependency' : undefined;
    loops.push({ kind: 'commitment', id: `commitment:${id}`, source: note.source, owner: note.owner ?? note.agentPromise?.owner ?? 'agent',
      waitsOn: waitsOn ?? 'undeclared', openedAt: source.at, nextAt, revisitDue: now >= nextAt, ...(defect ? { defect } : {}) });
  });
  for (const { id, note } of openDirectives(view)) loops.push({ kind: 'directive', id: `directive:${id}`, source: note.source,
    owner: 'agent', waitsOn: 'completion or supersession', openedAt: note.at, nextAt: null, revisitDue: false });
  for (const { id, note } of openBlockers(view)) loops.push({ kind: 'blocker', id: `blocker:${id}`, source: note.source,
    owner: 'agent', waitsOn: 'recheck', openedAt: note.at, nextAt: note.recheckAt, revisitDue: now >= note.recheckAt,
    ...(now >= note.recheckAt ? { defect: 'overdue-recheck' as const } : {}) });
  for (const question of openQuestionCandidates(view)) {
    const source = view.turns.get(question.source);
    if (source) loops.push({ kind: 'question', id: `question:${question.source}`, source: question.source, owner: 'agent',
      waitsOn: 'nothing', openedAt: source.at, nextAt: null, revisitDue: false });
  }
  for (const item of pendingRequestedReminders(view)) {
    const dueAt = wallEpoch(item.day!, item.time ?? '09:00', item.zone);
    loops.push({ kind: 'reminder', id: `reminder:${item.source}:${item.quote}`, source: item.source, owner: 'agent', waitsOn: 'date',
      openedAt: view.turns.get(item.source)?.at ?? dueAt, nextAt: dueAt, revisitDue: now >= dueAt,
      ...(now >= dueAt + BACKLOG_AGE_LIMIT_MS ? { defect: 'overdue-reminder' as const } : {}) });
  }
  return loops.sort((a, b) => a.openedAt - b.openedAt || a.id.localeCompare(b.id));
}

export interface LoopHealth { open: number; byKind: Record<LoopKind, number>; revisitDue: number;
  overdueCheckIns: number; overdueRechecks: number; overdueReminders: number; undeclared: number; refusedCommitments: number;
  unfinished: number; oldestUnfinishedAt: number | null; oldestUnfinishedAgeMs: number | null; backlogOverdue: boolean;
  lastProgressAt: number | null; progressAgeMs: number | null; state: 'idle' | 'progressing' | 'stalled';
  inhibition: string | null; correctionsWaiting: number }

/** Forward progress, backlog age and overdue obligations for the existing pull surface (Rules 46, 64, 92, 99).
 * An inhibition (stop, expiry, allowance, hold) is shown beside the backlog; it never counts as completion. */
export function loopHealth(view: JournalView, now: number): LoopHealth {
  const loops = openLoops(view, now);
  const byKind = { commitment: 0, directive: 0, blocker: 0, question: 0, reminder: 0 } as Record<LoopKind, number>;
  for (const loop of loops) byKind[loop.kind]++;
  const unfinished = view.order.filter(turn => turn.accepted && !probeTurn(view, turn) && !settled(view, turn));
  const oldest = unfinished[0];
  const lastProgressAt = Math.max(0, ...view.order.map(turn => turn.sentAt ?? 0), ...view.summaries.map(summary => summary.at)) || null;
  const waitingSince = oldest ? Math.max(oldest.at, lastProgressAt ?? 0) : null;
  const inhibition = view.stop ?? (now >= view.expires ? 'trial expired'
    : view.calls >= view.limits.maxCalls ? 'model-call allowance used'
      : view.replies >= view.limits.maxReplies ? 'reply allowance used'
        : oldest?.held !== undefined ? `held: ${oldest.held}` : null);
  return { open: loops.length, byKind, revisitDue: loops.filter(loop => loop.revisitDue && loop.kind === 'commitment').length,
    overdueCheckIns: loops.filter(loop => loop.defect === 'overdue-check-in').length,
    overdueRechecks: loops.filter(loop => loop.defect === 'overdue-recheck').length,
    overdueReminders: loops.filter(loop => loop.defect === 'overdue-reminder').length,
    undeclared: loops.filter(loop => loop.defect === 'undeclared-dependency').length, refusedCommitments: view.commitmentRefusals,
    unfinished: unfinished.length, oldestUnfinishedAt: oldest?.at ?? null, oldestUnfinishedAgeMs: oldest ? Math.max(0, now - oldest.at) : null,
    backlogOverdue: oldest !== undefined && now - oldest.at > BACKLOG_AGE_LIMIT_MS,
    lastProgressAt, progressAgeMs: lastProgressAt === null ? null : Math.max(0, now - lastProgressAt),
    state: !oldest ? 'idle' : now - waitingSince! > PROGRESS_STALL_MS ? 'stalled' : 'progressing',
    inhibition: oldest || view.stop ? inhibition : null, correctionsWaiting: view.corrections.length };
}

const age = (ms: number) => ms < 3_600_000 ? `${Math.floor(ms / 60_000)} min` : `${Math.floor(ms / 3_600_000)} h ${Math.floor(ms % 3_600_000 / 60_000)} min`;

/** Plain status lines for the operator's pull surface; each names what is open, overdue or inhibited. */
export function loopStatusLines(view: JournalView, now: number): string[] {
  const health = loopHealth(view, now), kinds = Object.entries(health.byKind).filter(([, count]) => count > 0)
    .map(([kind, count]) => `${count} ${kind}${count === 1 ? '' : 's'}`);
  return [
    `Open loops: ${health.open}${kinds.length ? ` (${kinds.join(', ')})` : ''}; ${health.revisitDue} due to resurface with your next message.`,
    health.unfinished
      ? `Backlog: ${health.unfinished} unfinished; oldest ${age(health.oldestUnfinishedAgeMs!)}${health.backlogOverdue ? `, over the ${age(BACKLOG_AGE_LIMIT_MS)} limit` : ''}${health.inhibition ? `; waiting on ${health.inhibition}` : ''}.`
      : `Backlog: none${health.inhibition ? `; ${health.inhibition}` : ''}.`,
    `Progress: ${health.state}; last ${health.progressAgeMs === null ? 'none yet' : `${age(health.progressAgeMs)} ago`}.`,
    `Overdue: ${health.overdueCheckIns} check-ins, ${health.overdueRechecks} blocker rechecks, ${health.overdueReminders} reminders; corrections awaiting your next message: ${health.correctionsWaiting}.`,
    ...(health.undeclared || health.refusedCommitments
      ? [`Commitments without a declared dependency: ${health.undeclared} open (older records), ${health.refusedCommitments} refused at creation.`] : []),
  ];
}
