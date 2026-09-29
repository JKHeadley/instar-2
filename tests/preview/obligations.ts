/** The agent's one population of open obligations, projected from the durable journal
 * (Rules 8, 46, 64, 68, 83, 92, 93, 99). Nothing here is stored beside the journal: replay
 * rebuilds it exactly, and every item stays open until a recorded cause closes it. */
import { dueState } from './dated-memory.js';
import { LOOP_REVISIT_MS, commitmentOpen, commitmentWaitsOn, loopRevisits, obligationCapacity, obligationSchedule, openBlockers,
  openDirectives, openQuestionCandidates, openRequests, probeTurn, wallEpoch, type JournalView, type Turn } from './journal.js';

/** Measured engineering defaults (Rule 46/64): accepted work older than this, or no forward
 * progress for this long while work waits, is reported as overdue on the pull surface. */
export const BACKLOG_AGE_LIMIT_MS = 30 * 60_000;
export const PROGRESS_STALL_MS = 30 * 60_000;

export type LoopKind = 'commitment' | 'directive' | 'blocker' | 'question' | 'request';
export type LoopDefect = 'overdue-check-in' | 'overdue-recheck' | 'overdue-request' | 'undeclared-dependency';
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
    if (!source || !commitmentOpen(view, id)) return;
    const waitsOn = commitmentWaitsOn(view, id);
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
  // A request the operator asked to have done at a later time stays open until its answer is dispatched.
  for (const item of openRequests(view)) {
    const dueAt = wallEpoch(item.day!, item.time ?? '09:00', item.zone);
    loops.push({ kind: 'request', id: `request:${item.source}:${item.quote}`, source: item.source, owner: 'agent', waitsOn: 'date',
      openedAt: view.turns.get(item.source)?.at ?? dueAt, nextAt: dueAt, revisitDue: now >= dueAt,
      ...(now >= dueAt + BACKLOG_AGE_LIMIT_MS ? { defect: 'overdue-request' as const } : {}) });
  }
  return loops.sort((a, b) => a.openedAt - b.openedAt || a.id.localeCompare(b.id));
}

export interface LoopHealth { open: number; byKind: Record<LoopKind, number>; revisitDue: number;
  overdueCheckIns: number; overdueRechecks: number; overdueRequests: number; undeclared: number; refusedCommitments: number;
  /** Accepted work not yet done: unanswered operator turns plus obligation work steps due now. */
  unfinished: number; unansweredTurns: number; dueWork: number;
  /** Work steps whose start has no result yet, results waiting for a reply to carry them, and scheduled future steps. */
  workInFlight: number; awaitingDelivery: number; scheduledWork: number; nextWorkAt: number | null;
  /** Results bound to a reply whose send has no receipt: UNKNOWN, visible, never resent or counted as delivered. */
  deliveryUnknown: number;
  /** Work steps whose latest result waits on the operator or an outside party, with what each needs. */
  waitingWork: { key: string; waitsOn: string; need: string }[];
  /** Everything the runner still owns and can act on: unfinished, scheduled, in-flight, undelivered and waiting work.
   * A runner exit revives while this is positive, unless an inhibition holds it (Rule 68). */
  ownedWork: number;
  rejectedDeclarations: number;
  oldestUnfinishedAt: number | null; oldestUnfinishedAgeMs: number | null; backlogOverdue: boolean;
  lastProgressAt: number | null; progressAgeMs: number | null; state: 'idle' | 'progressing' | 'stalled';
  inhibition: string | null; deliveryInhibition: string | null; correctionsWaiting: number }

/** Forward progress, backlog age and overdue obligations for the existing pull surface (Rules 46, 64, 68, 92, 99).
 * Progress is measured per waiting item: an unrelated reply or a summary never makes a stalled obligation look
 * progressing. An inhibition (stop, expiry, allowance, capacity, hold, missing grant) is shown beside the
 * backlog; it never counts as completion. */
export function loopHealth(view: JournalView, now: number): LoopHealth {
  const loops = openLoops(view, now);
  const byKind = { commitment: 0, directive: 0, blocker: 0, question: 0, request: 0 } as Record<LoopKind, number>;
  for (const loop of loops) byKind[loop.kind]++;
  const turns = view.order.filter(turn => turn.accepted && !probeTurn(view, turn) && !settled(view, turn));
  const schedule = obligationSchedule(view);
  const idle = schedule.filter(item => !item.inFlight && !item.awaitingDelivery && !item.deliveryUnknown);
  const due = idle.filter(item => item.slot <= now);
  const future = idle.filter(item => item.slot > now && Number.isFinite(item.slot));
  const awaitingDelivery = schedule.filter(item => item.awaitingDelivery).length;
  const waitingWork = idle.flatMap(item => { const work = view.obligationWork[item.key];
    return work?.waitsOn !== undefined && item.slot > now ? [{ key: item.key, waitsOn: work.waitsOn, need: work.note ?? '' }] : []; });
  const workInFlight = schedule.filter(item => item.inFlight).length;
  // A started step is unfinished until its result lands: an interrupted one stays visible to health and the exit.
  const waiting = [...turns.map(turn => turn.at), ...due.map(item => item.slot),
    ...schedule.filter(item => item.inFlight).map(item => item.slot)].sort((a, b) => a - b);
  const oldestAt = waiting[0];
  const worked = Object.values(view.obligationWork).filter(work => work.inFlight === undefined && work.outcome !== undefined
    && work.outcome !== 'uncertain' && work.outcome !== 'failed').map(work => work.last);
  const lastProgressAt = Math.max(0, ...view.order.map(turn => turn.sentAt ?? 0), ...worked) || null;
  const oldestTurn = turns[0];
  const inhibition = view.stop ?? (now >= view.expires ? 'trial expired'
    : view.calls >= view.limits.maxCalls ? 'model-call allowance used'
      : turns.length && view.replies >= view.limits.maxReplies ? 'reply allowance used'
        : oldestTurn?.held !== undefined ? `held: ${oldestTurn.held}`
          : due.length && !obligationCapacity(view) ? 'model-call capacity reserved for replies' : null);
  return { open: loops.length, byKind, revisitDue: loops.filter(loop => loop.revisitDue && loop.kind === 'commitment').length,
    overdueCheckIns: loops.filter(loop => loop.defect === 'overdue-check-in').length,
    overdueRechecks: loops.filter(loop => loop.defect === 'overdue-recheck').length,
    overdueRequests: loops.filter(loop => loop.defect === 'overdue-request').length,
    undeclared: loops.filter(loop => loop.defect === 'undeclared-dependency').length, refusedCommitments: view.commitmentRefusals,
    unfinished: waiting.length, unansweredTurns: turns.length, dueWork: due.length,
    workInFlight, awaitingDelivery, scheduledWork: future.length,
    deliveryUnknown: schedule.filter(item => item.deliveryUnknown).length, waitingWork,
    ownedWork: waiting.length + future.length + awaitingDelivery
      + waitingWork.filter(item => !Number.isFinite(schedule.find(entry => entry.key === item.key)!.slot)).length,
    nextWorkAt: future.length ? Math.min(...future.map(item => item.slot)) : null, rejectedDeclarations: view.rejectedObligations,
    oldestUnfinishedAt: oldestAt ?? null, oldestUnfinishedAgeMs: oldestAt === undefined ? null : Math.max(0, now - oldestAt),
    backlogOverdue: oldestAt !== undefined && now - oldestAt > BACKLOG_AGE_LIMIT_MS,
    lastProgressAt, progressAgeMs: lastProgressAt === null ? null : Math.max(0, now - lastProgressAt),
    state: oldestAt === undefined ? 'idle' : now - oldestAt > PROGRESS_STALL_MS ? 'stalled' : 'progressing',
    inhibition: oldestAt !== undefined || view.stop ? inhibition : null,
    deliveryInhibition: awaitingDelivery ? `no grant for unsolicited sends; ${awaitingDelivery} finished ${awaitingDelivery === 1 ? 'result waits' : 'results wait'} for your next message` : null,
    correctionsWaiting: view.corrections.length };
}

const age = (ms: number) => ms < 3_600_000 ? `${Math.floor(ms / 60_000)} min` : `${Math.floor(ms / 3_600_000)} h ${Math.floor(ms % 3_600_000 / 60_000)} min`;

/** Plain status lines for the operator's pull surface; each names what is open, overdue or inhibited. */
export function loopStatusLines(view: JournalView, now: number): string[] {
  const health = loopHealth(view, now), kinds = Object.entries(health.byKind).filter(([, count]) => count > 0)
    .map(([kind, count]) => `${count} ${kind}${count === 1 ? '' : 's'}`);
  return [
    `Open loops: ${health.open}${kinds.length ? ` (${kinds.join(', ')})` : ''}; ${health.revisitDue} due to resurface with your next message.`,
    health.unfinished
      ? `Backlog: ${health.unfinished} unfinished (${health.unansweredTurns} message${health.unansweredTurns === 1 ? '' : 's'}, ${health.dueWork} due work step${health.dueWork === 1 ? '' : 's'}); oldest ${age(health.oldestUnfinishedAgeMs!)}${health.backlogOverdue ? `, over the ${age(BACKLOG_AGE_LIMIT_MS)} limit` : ''}${health.inhibition ? `; waiting on ${health.inhibition}` : ''}.`
      : `Backlog: none${health.inhibition ? `; ${health.inhibition}` : ''}.`,
    `Progress: ${health.state}; last ${health.progressAgeMs === null ? 'none yet' : `${age(health.progressAgeMs)} ago`}.`,
    `Scheduled work: ${health.scheduledWork} waiting for their time${health.workInFlight ? `, ${health.workInFlight} in progress` : ''}${health.deliveryInhibition ? `; ${health.deliveryInhibition}` : ''}.`,
    ...health.waitingWork.slice(0, 3).map(item => `Waiting on ${item.waitsOn === 'operator' ? 'you' : 'an outside party'}: ${item.need}`),
    ...(health.deliveryUnknown ? [`Delivery unknown: ${health.deliveryUnknown} finished ${health.deliveryUnknown === 1 ? 'result was' : 'results were'} sent without a confirmed receipt; not resent and not counted as delivered.`] : []),
    `Overdue: ${health.overdueCheckIns} check-ins, ${health.overdueRechecks} blocker rechecks, ${health.overdueRequests} requested actions; corrections awaiting your next message: ${health.correctionsWaiting}.`,
    ...(health.undeclared || health.refusedCommitments
      ? [`Commitments without a declared dependency: ${health.undeclared} open (older records), ${health.refusedCommitments} refused at creation.`] : []),
    ...(health.rejectedDeclarations ? [`Declared obligations I could not record: ${health.rejectedDeclarations} (each sent only after a full review).`] : []),
  ];
}
