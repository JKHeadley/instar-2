/** The preview's own state, derived at each turn from durable records only: the
 * journal projection and the root's append-only run log (`runs.jsonl`). Nothing
 * here is hand-edited; the desk's report is only about other work. */
import { closeSync, constants, existsSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';
import { redact } from '../../src/recall/redact.js';
import { openRequests, replyTarget, sendOutcomeCounts, sendOutcomeOf, unknownCallCounts, type JournalView, type Turn } from './journal.js';

/** One line per launch, one per recorded end of that launch (paired by `launch`), and one per poll attempt that
 * changes the failure episode (Rule 55): each failure is durable when it happens, and a successful poll after
 * failures records the restoration that closes the episode. */
export type RunRecord = { v: 1; launch: number; pid: number } | { v: 1; launch: number; exit: number; reason: string } & RunEnd
  | { v: 1; launch: number; poll: PollEvent; at: number };
export type PollEvent = 'failed' | 'conflicted' | 'restored';
/** What an exit leaves for the next launch (Rule 68): whether eligible accepted work remains queued for revival or is
 * inhibited by a stop, expiry or allowance, and when the next scheduled work step falls due. */
export interface RunEnd { unfinished?: number;
  revival?: 'queued' | 'inhibited' | 'none'; nextWorkAt?: number;
  /** Rule 63: this launch found another runner holding the conversation and retired without polling or sending. */
  nonowner?: { machine: string | null; since: number | null };
  /** This launch neither polled nor sent because its ownership authority or declared topology could not serve. */
  inhibited?: string;
  /** An existing worker that lost the conversation fence and retired. */
  retired?: string;
  /** Rule 33: the journal projection digest at this exit, so the exit claim is comparable only at that frontier. */
  frontier?: string }
export interface RunLog { launches: ({ at: number; pid?: number; exit?: number; reason?: string } & RunEnd)[]; unreadable: number;
  /** The current poll-failure episode, folded in order over every launch; a crash cannot erase an attempt. */
  pollPressure?: { failed: number; conflicted: number };
  /** The log exists but could not be read: its history, poll pressure included, is unknown, never an empty episode. */
  readFailed?: true }

/** Appends one line and fsyncs it before returning; the first write also fsyncs the directory. */
export function appendRun(path: string, record: RunRecord): void {
  const fresh = !existsSync(path);
  const fd = openSync(path, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try {
    const line = Buffer.from(`\n${JSON.stringify(record)}\n`);
    let written = 0; while (written < line.length) written += writeSync(fd, line, written);
    fsyncSync(fd);
  } finally { closeSync(fd); }
  if (fresh) { const dir = openSync(dirname(path), 'r'); try { fsyncSync(dir); } finally { closeSync(dir); } }
}
/** A missing log is an empty history; a log that exists but cannot be read is `readFailed` (never a clean history);
 * a torn or malformed line is counted, never guessed at. */
export function readRuns(path: string): RunLog {
  const log: RunLog = { launches: [], unreadable: 0, pollPressure: { failed: 0, conflicted: 0 } };
  let text = '';
  try { text = readFileSync(path, 'utf8'); }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ENOENT' ? log : { ...log, readFailed: true }; }
  const byLaunch = new Map<number, RunLog['launches'][number]>();
  for (const line of text.split('\n')) {
    if (!line) continue;
    let row: Partial<RunRecord & { exit: number; reason: string; pid: number; poll: PollEvent; at: number } & RunEnd>;
    try { row = JSON.parse(line) as typeof row; } catch { log.unreadable++; continue; }
    if (row === null || typeof row !== 'object' || Array.isArray(row)
      || row.v !== 1 || !Number.isSafeInteger(row.launch)) { log.unreadable++; continue; }
    if (row.poll !== undefined) {
      if (!byLaunch.has(row.launch!) || !Number.isSafeInteger(row.at)
        || row.poll !== 'failed' && row.poll !== 'conflicted' && row.poll !== 'restored') { log.unreadable++; continue; }
      const pressure = log.pollPressure!;
      log.pollPressure = row.poll === 'restored' ? { failed: 0, conflicted: 0 }
        : { failed: pressure.failed + 1, conflicted: row.poll === 'conflicted' ? pressure.conflicted + 1 : 0 };
      continue;
    }
    if (row.exit === undefined) {
      if (byLaunch.has(row.launch!)) { log.unreadable++; continue; }
      const entry: RunLog['launches'][number] = { at: row.launch! };
      if (Number.isSafeInteger(row.pid) && row.pid! > 0) entry.pid = row.pid!;
      byLaunch.set(row.launch!, entry); log.launches.push(entry);
    } else {
      const entry = byLaunch.get(row.launch!);
      if (!entry || entry.exit !== undefined || !Number.isSafeInteger(row.exit) || typeof row.reason !== 'string') { log.unreadable++; continue; }
      entry.exit = row.exit; entry.reason = row.reason;
      if (Number.isSafeInteger(row.unfinished) && row.unfinished! >= 0) entry.unfinished = row.unfinished!;
      if (row.revival === 'queued' || row.revival === 'inhibited' || row.revival === 'none') entry.revival = row.revival;
      if (Number.isSafeInteger(row.nextWorkAt)) entry.nextWorkAt = row.nextWorkAt!;
      const extra = row as { inhibited?: unknown; retired?: unknown; frontier?: unknown };
      if (typeof extra.inhibited === 'string') entry.inhibited = extra.inhibited;
      if (typeof extra.retired === 'string') entry.retired = extra.retired;
      if (typeof extra.frontier === 'string' && /^[a-f0-9]{64}$/.test(extra.frontier)) entry.frontier = extra.frontier;
      const nonowner = (row as { nonowner?: { machine?: unknown; since?: unknown } }).nonowner;
      if (nonowner && typeof nonowner === 'object') entry.nonowner = { machine: typeof nonowner.machine === 'string' ? nonowner.machine : null,
        since: Number.isSafeInteger(nonowner.since) ? nonowner.since as number : null };
    }
  }
  return log;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
/** Throws RangeError for an unknown IANA zone, so the launcher refuses it at start. */
export function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' });
    formatters.set(timeZone, format);
  }
  return format;
}
const parts = (format: Intl.DateTimeFormat, ms: number) => {
  const p = Object.fromEntries(format.formatToParts(ms).map(part => [part.type, part.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, text: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} ${p.timeZoneName}` };
};
const span = (ms: number) => {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(minutes / 1440), h = Math.floor(minutes % 1440 / 60), m = minutes % 60;
  return `${d ? `${d}d ` : ''}${d || h ? `${h}h ` : ''}${m}m`;
};
/** Telegram's own send time; the local intake time as fallback; null when neither is known (imported turns). */
export const messageTime = (turn: Turn): number | null => {
  try { const sent = (JSON.parse(turn.raw) as { message?: { date?: unknown } }).message?.date;
    if (typeof sent === 'number' && Number.isSafeInteger(sent) && sent > 0) return sent * 1000; } catch { /* raw kept verbatim */ }
  return turn.at > 0 ? turn.at : null;
};

/** Plain operator wording for a journal hold; internal causes remain in the journal. */
export function holdNotice(reason: string, stopped = false): string {
  if (stopped) return 'This reply is held because the trial is stopped; resending will not help.';
  if (reason === 'outbound secret refused') return 'This reply is held because it may contain a secret; this held reply will not be sent.';
  if (reason === 'call cap' || reason === 'reply cap')
    return 'This reply is held because the spend limit was reached; resending will not help while the limit remains in place.';
  if (reason === 'reply check unavailable')
    return 'This reply is held because a safety check is unavailable; trying again after it recovers may help.';
  if (reason === 'reply size' || reason === 'encoded reply size')
    return 'This reply is held because it is too long to send; asking again for a shorter answer may help.';
  if (reason === 'prompt overflow' || reason === 'context overflow' || reason.startsWith('summary unavailable:'))
    return 'This reply is held because the conversation is too large to process right now; a summary may let it resume.';
  if (reason === 'memory correction pending') return 'This reply is held while a memory correction is unresolved.';
  if (reason === 'summary oversized turn') return 'This reply is held because its conversation summary is too large to prepare.';
  if (reason === 'summary preflight unavailable') return 'This reply is held because its conversation summary could not be prepared.';
  return 'This reply is held because it could not be completed.';
}
export function heldNotices(view: JournalView, stopped = false) {
  return view.order.filter(turn => turn.accepted && !turn.intent && (turn.held || stopped))
    .map(turn => ({ update: turn.update, notice: holdNotice(turn.held ?? '', stopped) }));
}

/** One bounded, content-free line. Every count comes from the journal projection;
 * absent legacy prompts are named as unmeasured, never silently counted as misses. */
export function memoryHealthLine(view: JournalView): string {
  const latest = view.summaries.at(-1);
  const covered = latest === undefined ? 0 : view.order.filter(turn => turn.accepted && turn.update <= latest.through).length;
  const measured = view.order.filter(turn => turn.reserved && turn.recallHits !== undefined);
  const unmeasured = view.order.filter(turn => turn.reserved && turn.recallHits === undefined).length;
  const resolved = new Set(view.summaries.flatMap(summary => summary.memoryFor ?? []));
  const unresolved = view.order.filter(turn => turn.memoryPending
    && !resolved.has(turn.id)).length;
  const unknownCalls = view.order.filter(turn => turn.reserved && (turn.modelState === 'uncertain' || turn.answer === undefined)).length;
  const heldNotices = view.order.filter(turn => turn.heldNoticeIntent !== undefined).length;
  // Rule 42: a definite refusal is counted as a refusal, never as UNKNOWN.
  const unknownSends = sendOutcomeCounts(view).unknown;
  const sum = (field: 'recallHits' | 'channelRecallHits') => measured.reduce((total, turn) => total + (turn[field] ?? 0), 0);
  return `Memory health: ${String(view.order.filter(turn => turn.held).length)} journal turns currently held; `
    + `${String(view.summaries.length)} summaries, ${String(covered)} accepted operator turns covered by latest summary`
    + ` (through Telegram update ${latest === undefined ? 'none' : String(latest.through)}); `
    + `${String(sum('recallHits'))} original-turn recall-sentinel hits and ${String(sum('channelRecallHits'))} channel-item recall-sentinel hits`
    + ` in ${String(measured.length)} recorded model prompts (${String(unmeasured)} unmeasured legacy prompts); `
    + `${String(view.memory.filter(change => change.mode !== 'prefer').length)} old-claim items withheld; ${String(unresolved)} unresolved operator memory corrections; `
    + `${String(view.channelSources.size)} channel-import cursors recorded (${String(view.channelItems.size)} imported channel items); `
    + `${String(unknownCalls)} turn-model calls and ${String(view.summaryReservations.size)} summary-model calls without a durable result (in flight or UNKNOWN); `
    + `${String(unknownSends)} send(s) without a durable result (in flight or UNKNOWN).`;
}

const summaryHold = (reason: string) => reason === 'summary oversized turn' || reason === 'summary preflight unavailable';

/** Distinct replies with a durable hold recorded on the operator's local day.
 * A later release does not erase the fact that the reply was held today. */
export function heldRepliesToday(view: JournalView, now: number, timeZone: string) {
  const format = zoneFormatter(timeZone), today = parts(format, now).day;
  const replies = new Map<string, { update: number; reasons: string[]; stillHeld: boolean }>();
  for (const event of view.awayEvents) {
    if (event.kind !== 'hold' || !event.id || !event.reason || summaryHold(event.reason) || !Number.isFinite(event.at) || event.at <= 0
      || now - event.at >= 26 * 3_600_000 || event.at > now + 60_000
      || parts(format, event.at).day !== today) continue;
    const turn = view.turns.get(event.id);
    if (!turn?.accepted) continue;
    let reply = replies.get(event.id);
    if (!reply) {
      reply = { update: turn.update, reasons: [], stillHeld: turn.held !== undefined && !summaryHold(turn.held) };
      replies.set(event.id, reply);
    }
    const reason = redact(event.reason).text;
    if (!reply.reasons.includes(reason)) reply.reasons.push(reason);
  }
  return { count: replies.size, replies: [...replies.values()] };
}

/** Keep historical diagnostics from consuming the mandatory reply packet. Full reasons stay in status. */
function heldReplyBrief(held: ReturnType<typeof heldRepliesToday>): string {
  if (!held.count) return 'Replies held today: 0.';
  const groups = new Map<string, number>();
  for (const reply of held.replies) for (const reason of reply.reasons)
    groups.set(reason, (groups.get(reason) ?? 0) + 1);
  const label = (reason: string) => reason.length > 80 ? `${reason.slice(0, 80)}…` : reason;
  const aggregates = [...groups].slice(0, 8).map(([reason, count]) => `${String(count)} (${label(reason)})`).join(', ');
  const details = held.replies.slice(0, 5).map(reply => {
    const reasons = reply.reasons.slice(0, 3).map(label).join('; ');
    return `Update ${String(reply.update)}: ${reasons}${reply.reasons.length > 3 ? '; more reasons' : ''} `
      + `(${reply.stillHeld ? 'still held' : 'released'})`;
  }).join('. ');
  return `Replies held today: ${String(held.count)}. Reasons: ${aggregates}`
    + `${groups.size > 8 ? ', more reason types' : ''}. ${details}.`
    + (held.count > 5 ? ` ${String(held.count - 5)} more reply details omitted; full reasons are in read-only status.` : '');
}

/** Plain facts about this preview, computed from the journal and run log at `now`.
 * `current` is the launch this process recorded; absent for a read-only status view. */
export function selfState(view: JournalView, runs: RunLog, now: number, timeZone: string, current?: number, stopped = false) {
  const format = zoneFormatter(timeZone), today = parts(format, now).day;
  // Only a time within the last 26 hours can fall on today's local date; older ones are never formatted.
  const isToday = (ms: number | null | undefined) => ms !== null && ms !== undefined && ms > 0
    && now - ms < 26 * 3_600_000 && ms <= now + 60_000 && parts(format, ms).day === today;
  // A requested action's due turn is runner-authored, not an operator message.
  const accepted = view.order.filter(turn => turn.accepted && !turn.editOf && !turn.requestedAction);
  const edits = view.order.filter(turn => turn.accepted && turn.editOf).length;
  const count = (turns: readonly Turn[], when: (turn: Turn) => number | null | undefined) =>
    ({ total: turns.length, today: turns.filter(turn => isToday(when(turn))).length });
  const incoming = count(accepted, messageTime);
  const delivered = count(accepted.filter(turn => turn.sent !== undefined), turn => turn.sentAt);
  // Requested actions sent, including an older journal's fixed-text reminder batches.
  const requestSends = [...view.order.filter(turn => turn.requestedAction && !turn.requestedAction.legacy && turn.sent !== undefined).map(turn => turn.sentAt),
    ...[...view.reminders.values()].filter(item => item.requested && item.sent !== undefined).map(item => item.sentAt)];
  const requestsToday = requestSends.filter(isToday).length;
  const holds = new Map<string, number>();
  for (const { notice } of heldNotices(view, stopped || view.stop !== null || now >= view.expires))
    holds.set(notice, (holds.get(notice) ?? 0) + 1);
  const heldToday = heldRepliesToday(view, now, timeZone);
  const unknownCalls = view.order.filter(turn => turn.reserved && (turn.modelState === 'uncertain' || turn.answer === undefined)).length;
  const summaryPending = view.summaryReservations.size;
  const heldNoticeCount = view.order.filter(turn => turn.heldNoticeIntent !== undefined).length;
  // Rule 42: a definite refusal is counted as a refusal, never as UNKNOWN.
  const unknownSends = sendOutcomeCounts(view).unknown;


  const refused = view.order.filter(turn => !turn.accepted).length;
  const when = (ms: number) => parts(format, ms).text;
  const left = (limit: number, used: number) => `${String(used)} of ${String(limit)} used, ${String(Math.max(0, limit - used))} left`;
  const lines = [
    `As of ${when(now)} (time zone ${timeZone}; "today" means ${today} there).`,
    `Operator messages received: ${String(incoming.today)} today, ${String(incoming.total)} in this trial (including the one being answered now).`,
    edits ? `Telegram edits recorded: ${String(edits)}; each revises an earlier message and opens no reply.` : '',
    `My replies Telegram accepted: ${String(delivered.today)} today, ${String(delivered.total)} in this trial (the reply to the current message is not sent yet).`,
    `Requested actions Telegram accepted: ${String(requestsToday)} today, ${String(requestSends.length)} in this trial; ${String(openRequests(view).length)} requested and not yet sent.`,
    `Messages exchanged today: ${String(incoming.today + delivered.today)} (received plus replies accepted).`,
    `My memory: ${String(incoming.total)} accepted operator turns, ${String(view.summaries.length)} summaries and ${String(view.memory.length)} validated memory changes in this trial's encrypted local journal. It survives runner restarts and spans this trial's topics; I can recall it while the trial is active. The verified operator can ask me to correct or forget a recorded fact. Later reply packets withhold the old claim, but the original audit record remains in the journal. This is not production or other-agent memory.`,
    `Model attempts: ${left(view.limits.maxCalls, view.calls)} (answers, summaries and reply reviews share them). Replies: ${left(view.limits.maxReplies, view.replies)}. Admitted updates: ${left(view.limits.maxTurns, view.order.length)}.`,
    `Model tokens by call kind (input/output; missing usage counts at its reservation): ${Object.entries(view.tokenTotals)
      .map(([kind, total]) => `${kind} ${String(total.inputTokens)}/${String(total.outputTokens)} (${String(total.calls)} calls, ${String(total.unknownCalls)} unmeasured)`)
      .join('; ')}.`,


    view.capAuthority === null ? 'Caps have not been raised since the trial began.'
      : `Caps last raised ${view.capRaisedAt ? when(view.capRaisedAt) : 'at an unrecorded time'} on the authority "${redact(view.capAuthority).text}".`,
    memoryHealthLine(view),
    `Definite model/summary failures: ${JSON.stringify(Object.fromEntries(view.failureClasses))}. Provider result states: ${JSON.stringify(Object.fromEntries(view.providerStates))}.`,
    holds.size ? `Held messages: ${[...holds].map(([notice, n]) => `${String(n)} — ${notice}`).join(' ')}` : 'Held messages: none.',
    heldReplyBrief(heldToday),
    `Held-answer notices attempted: ${String(heldNoticeCount)} (one per held turn; Telegram acceptance is not human receipt).`,
    refused ? `Updates refused (not from the operator's private chat): ${String(refused)}.` : '',
    `Summaries: ${String(view.summaries.length)}${summaryPending ? ` (${String(summaryPending)} summary call(s) in flight or unknown)` : ''}. Trial ends ${when(view.expires)}.`,
    view.stop ? `Permanent stop latched: ${view.stop}.` : '',
    view.genesis.importSource !== undefined ? 'This journal was imported from an earlier preview root; imported turns keep their original content, and their times may be unknown.' : '',
  ];
  const launches = runs.launches, mine = current === undefined ? undefined : launches.find(run => run.at === current);
  const latest = mine ?? launches.at(-1);
  if (!latest) lines.push('Run history: no launch has been recorded, so uptime and restarts are unknown.');
  else {
    const earlier = launches.slice(0, launches.indexOf(latest));
    const previous = earlier.at(-1);
    lines.push(mine ? `This run started ${when(mine.at)}; uptime ${span(now - mine.at)}.`
      : latest.exit === undefined ? `Latest launch ${when(latest.at)} has no recorded end: it is running, or ended without recording why.`
        : `Latest launch ${when(latest.at)} ended ${when(latest.exit)}: ${latest.reason!}.`);
    lines.push(previous === undefined
      ? `That is the first recorded launch (records begin ${when(launches[0]!.at)}; earlier launches, if any, were not recorded).`
      : `${runs.unreadable ? 'Last recorded restart' : 'Last restart'}: ${when(latest.at)}. `
        + `${runs.unreadable ? 'The previous recorded run' : 'The run before it'} started ${when(previous.at)} and `
        + (previous.exit === undefined ? 'ended without recording why (crash, kill or power loss).'
          : `ended ${when(previous.exit)}: ${previous.reason!}.`)
        + (runs.unreadable ? ' The run history is incomplete; intervening launches may be missing.' : ''));
    lines.push(`Launches recorded: ${String(launches.length)} (${String(launches.filter(run => isToday(run.at)).length)} today).`);
  }
  if (runs.unreadable) lines.push(`Run log lines unreadable: ${String(runs.unreadable)}.`);
  return lines.filter(Boolean).join('\n');
}

/** The packet source: labelled as the runner's own verified record, not a claim anyone typed. */
export function selfStateSource(text: string) {
  return { id: 'self-state', title: 'This preview\'s own state (computed by the runner from its journal and run log at this turn)',
    text: 'This is your own verified state, derived only from durable records at this turn. It is accurate; '
      + `state it as fact when asked, and say plainly which parts it marks unknown.\n${text}`,
    provenance: { path: 'journal.encrypted + runs.jsonl', derived: 'tests/preview/self-state.ts#selfState' } };
}

/** A launch-time snapshot for the first reply after a recorded restart. It reports
 * only journal metadata: categories may overlap, and no message body is copied. */
export function restartHandoff(view: JournalView, runs: RunLog, launch: number) {
  const index = runs.launches.findIndex(run => run.at === launch);
  if (index < 1) return null;
  const previous = runs.launches[index - 1]!;
  const pending = view.order.filter(turn => turn.accepted && turn.sent === undefined && turn.intent === undefined);
  const held = pending.filter(turn => turn.held !== undefined);
  const unknownCalls = view.order.filter(turn => turn.accepted && turn.reserved
    && (turn.modelState === 'uncertain' || turn.answer === undefined));
  const heldNotices = view.order.filter(turn => turn.heldNoticeIntent !== undefined).length;
  const unknownSends = view.order.filter(turn => turn.accepted && turn.intent !== undefined
    && sendOutcomeOf(view, replyTarget(turn), turn.sent).kind === 'unknown');
  const noticesDue = pending.filter(turn => turn.modelState === 'uncertain' && turn.noticeDueAt !== undefined
    && turn.noticeDueAt <= launch);
  const ids = (turns: readonly Turn[]) => `${String(turns.length)}${turns.length
    ? ` (updates ${turns.slice(0, 3).map(turn => String(turn.update)).join(', ')}${turns.length > 3 ? ', …' : ''})` : ''}`;
  const safeReason = redact(previous.reason ?? 'reason unknown').text;
  const reason = safeReason.length > 80 ? `${safeReason.slice(0, 80)}…` : safeReason;
  const text = `At restart, the durable journal showed pending turns ${ids(pending)}; held items ${ids(held)}; `
    + `UNKNOWN model outcomes ${ids(unknownCalls)}; UNKNOWN sends ${ids(unknownSends)}; `
    + `lost-answer notices due ${ids(noticesDue)}. Categories may overlap. `
    + `The prior run ${previous.exit === undefined ? 'has no recorded end' : `ended: ${reason}`}. `
    + 'This describes the launch snapshot; later processing may have changed these states. Acknowledge a gap only if relevant to this reply.';
  return { id: 'restart-handoff', title: 'Work found at the last runner restart', text,
    provenance: { path: 'journal.encrypted + runs.jsonl', derived: 'tests/preview/self-state.ts#restartHandoff' } };
}
