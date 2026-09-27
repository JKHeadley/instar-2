/** The preview's own state, derived at each turn from durable records only: the
 * journal projection and the root's append-only run log (`runs.jsonl`). Nothing
 * here is hand-edited; the desk's report is only about other work. */
import { closeSync, constants, existsSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';
import { redact } from '../../src/recall/redact.js';
import { unknownCallCounts, type JournalView, type Turn } from './journal.js';

/** One line per launch, one per recorded end of that launch (paired by `launch`). */
export type RunRecord = { v: 1; launch: number; pid: number } | { v: 1; launch: number; exit: number; reason: string };
export interface RunLog { launches: { at: number; exit?: number; reason?: string }[]; unreadable: number }

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
/** A missing log is an empty history; a torn or malformed line is counted, never guessed at. */
export function readRuns(path: string): RunLog {
  const log: RunLog = { launches: [], unreadable: 0 };
  let text = '';
  try { text = readFileSync(path, 'utf8'); } catch { return log; }
  const byLaunch = new Map<number, RunLog['launches'][number]>();
  for (const line of text.split('\n')) {
    if (!line) continue;
    let row: Partial<RunRecord & { exit: number; reason: string; pid: number }>;
    try { row = JSON.parse(line) as typeof row; } catch { log.unreadable++; continue; }
    if (row === null || typeof row !== 'object' || Array.isArray(row)
      || row.v !== 1 || !Number.isSafeInteger(row.launch)) { log.unreadable++; continue; }
    if (row.exit === undefined) {
      if (byLaunch.has(row.launch!)) { log.unreadable++; continue; }
      const entry = { at: row.launch! }; byLaunch.set(row.launch!, entry); log.launches.push(entry);
    } else {
      const entry = byLaunch.get(row.launch!);
      if (!entry || entry.exit !== undefined || !Number.isSafeInteger(row.exit) || typeof row.reason !== 'string') { log.unreadable++; continue; }
      entry.exit = row.exit; entry.reason = row.reason;
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
  const unknownSends = view.order.reduce((count, turn) => count + Number(turn.intent !== undefined && turn.sent === undefined)
    + Number(turn.heldNoticeIntent !== undefined && turn.heldNoticeSent === undefined), 0);
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

/** Plain facts about this preview, computed from the journal and run log at `now`.
 * `current` is the launch this process recorded; absent for a read-only status view. */
export function selfState(view: JournalView, runs: RunLog, now: number, timeZone: string, current?: number) {
  const format = zoneFormatter(timeZone), today = parts(format, now).day;
  // Only a time within the last 26 hours can fall on today's local date; older ones are never formatted.
  const isToday = (ms: number | null | undefined) => ms !== null && ms !== undefined && ms > 0
    && now - ms < 26 * 3_600_000 && ms <= now + 60_000 && parts(format, ms).day === today;
  const accepted = view.order.filter(turn => turn.accepted);
  const count = (turns: readonly Turn[], when: (turn: Turn) => number | null | undefined) =>
    ({ total: turns.length, today: turns.filter(turn => isToday(when(turn))).length });
  const incoming = count(accepted, messageTime);
  const delivered = count(accepted.filter(turn => turn.sent !== undefined), turn => turn.sentAt);
  const holds = new Map<string, number>();
  for (const turn of view.order) if (turn.held) holds.set(turn.held, (holds.get(turn.held) ?? 0) + 1);
  const unknownCalls = view.order.filter(turn => turn.reserved && (turn.modelState === 'uncertain' || turn.answer === undefined)).length;
  const summaryPending = view.summaryReservations.size;
  const heldNotices = view.order.filter(turn => turn.heldNoticeIntent !== undefined).length;
  const unknownSends = view.order.reduce((count, turn) => count + Number(turn.intent !== undefined && turn.sent === undefined)
    + Number(turn.heldNoticeIntent !== undefined && turn.heldNoticeSent === undefined), 0);

  const refused = view.order.length - accepted.length;
  const when = (ms: number) => parts(format, ms).text;
  const left = (limit: number, used: number) => `${String(used)} of ${String(limit)} used, ${String(Math.max(0, limit - used))} left`;
  const lines = [
    `As of ${when(now)} (time zone ${timeZone}; "today" means ${today} there).`,
    `Operator messages received: ${String(incoming.today)} today, ${String(incoming.total)} in this trial (including the one being answered now).`,
    `My replies Telegram accepted: ${String(delivered.today)} today, ${String(delivered.total)} in this trial (the reply to the current message is not sent yet).`,
    `Messages exchanged today: ${String(incoming.today + delivered.today)} (received plus replies accepted).`,
    `My memory: ${String(incoming.total)} accepted operator turns, ${String(view.summaries.length)} summaries and ${String(view.memory.length)} validated memory changes in this trial's encrypted local journal. It survives runner restarts and spans this trial's topics; I can recall it while the trial is active. The verified operator can ask me to correct or forget a recorded fact. Later reply packets withhold the old claim, but the original audit record remains in the journal. This is not production or other-agent memory.`,
    `Model attempts: ${left(view.limits.maxCalls, view.calls)} (answers, summaries and reply reviews share them). Replies: ${left(view.limits.maxReplies, view.replies)}. Admitted updates: ${left(view.limits.maxTurns, view.order.length)}.`,
    view.capAuthority === null ? 'Caps have not been raised since the trial began.'
      : `Caps last raised ${view.capRaisedAt ? when(view.capRaisedAt) : 'at an unrecorded time'} on the authority "${redact(view.capAuthority).text}".`,
    memoryHealthLine(view),
    `Definite model/summary failures: ${JSON.stringify(Object.fromEntries(view.failureClasses))}. Provider result states: ${JSON.stringify(Object.fromEntries(view.providerStates))}.`,
    holds.size ? `Held messages: ${[...holds].map(([reason, n]) => `${String(n)} (${reason})`).join(', ')}.` : 'Held messages: none.',
    `Held-answer notices attempted: ${String(heldNotices)} (one per held turn; Telegram acceptance is not human receipt).`,
    refused ? `Updates refused (not from the operator's private chat): ${String(refused)}.` : '',
    `Summaries: ${String(view.summaries.length)}${summaryPending ? ` (${String(summaryPending)} summary call(s) in flight or unknown)` : ''}. Trial ends ${when(view.genesis.expires)}.`,
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
  const unknownSends = view.order.filter(turn => turn.accepted && turn.intent !== undefined && turn.sent === undefined);
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
