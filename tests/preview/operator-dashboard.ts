/** The operator dashboard's data (Rules 79, 81, 87; tests/preview/README.md "The operator dashboard"). The runner projects
 * it from the durable journal with the same functions the chat "status" reply and the status command use, and publishes
 * it into its own approval outbox. The operator's own approval page renders it behind the operator's passkey. It is a
 * disposable projection, never authority: it confers nothing, and the page shows its age so a stale copy is never read as
 * current (purpose Rule 2: the loss detector for this state is that age, on every view). */
import { redact } from '../../src/recall/redact.js';
import { localParts } from './dated-memory.js';
import { operatorRequestsReport, replyOutcomeOf, retractedTurn, sendOutcomeOf, type JournalView, type Turn } from './journal.js';
import { messageTime } from './self-state.js';
import { heldReplies, turnsToday } from './status-command.js';

export const DASHBOARD_SNAPSHOT = 'PreviewOperatorDashboard';
/** Finite bounds (Rule 60). The operator page refuses a snapshot past its own bounds (scripts/operator-dashboard.mjs). */
export const DASHBOARD_LIMITS = Object.freeze({ statusLines: 40, lineChars: 4000, turns: 10, textChars: 500, requests: 10, stateChars: 200,
  // Row 89 (1.x mobile dashboard carryover): work in progress and process health. The label and activity bounds are the 1.x
  // ones (the session row's name and its working-activity line); the summary cap is the 1.x Process Health tab's (CAPS.summary).
  sessions: 16, labelChars: 120, activityChars: 280, noticed: 10, patterns: 10, summaryChars: 240 });

/** A session on the phone page (1.x `GET /sessions`, routes.ts 10875-10927 at f3f94826a): only work that is starting or
 * running is listed (the CMT-1936 hygiene: finished runs never read as running sessions), and every row names the machine
 * it runs on. `update` opens the message the work answers; delegated work (an open session-work edge) has none. */
export interface DashboardSession { id: string; kind: 'conversation' | 'delegated'; label: string; state: 'starting' | 'running';
  since: string; machine: string | null; activity: string | null; update: number | null }
/** Process health (the 1.x Process Health tab, dashboard/process-health.js at f3f94826a, re-fed from the journal): what the
 * agent noticed going wrong in its own work, the kinds that keep coming up, what is watched, and the counts. Awareness only:
 * nothing here carries action authority (tab spec §4.2b). */
export type HealthStatus = 'open' | 'attributed' | 'resolved';
export interface DashboardHealth {
  noticed: { category: string; summary: string; status: HealthStatus; when: string; count: number }[];
  patterns: { summary: string; timesSeen: number; status: HealthStatus }[];
  watch: { recording: boolean; checking: boolean; reviewing: boolean };
  totals: { noticed: number; known: number };
}
export interface DashboardTurn { update: number; time: string; from: 'you' | 'scheduled'; message: string; reply: string | null; state: string }

export interface DashboardSnapshot {
  type: typeof DASHBOARD_SNAPSHOT; schemaVersion: 1; asOf: number; zone: string;
  state: 'running' | 'stopped' | 'ended'; until: string;
  /** The chat "status" answer, line by line. */
  status: string[];
  counts: { turnsToday: number; held: number; waiting: number };
  allowance: { label: string; used: number; max: number }[];
  tokens: { input: number; output: number; unknownCalls: number };
  /** `sharedAccess`: the approval was admitted under the operator's acceptance of shared account access, and its disclosure
   * (Purpose, the approval-account exception) is carried wherever the approval is displayed. */
  requests: { title: string; state: string; open: boolean; route: 'chat' | 'github-review'; link: string | null;
    sharedAccess: { account: string; disclosure: string } | null }[];
  /** `update` is the journal's update domain (`isJournalUpdate`): a scheduled turn's synthetic update is fractional. */
  turns: DashboardTurn[];
  /** Details for every selected active conversation, independently of the recent-ten window (Rules 81, 106). */
  sessionTurns: DashboardTurn[];
  /** The bot's username, for a direct link into the operator's chat; null when the runner was not told it. */
  chat: string | null;
  /** Row 89: work in progress right now, newest first (starting or running only), and this runner's process health. */
  sessions: DashboardSession[];
  health: DashboardHealth;
}

const clip = (text: string, limit: number) => { const plain = redact(text).text; return plain.length > limit ? `${plain.slice(0, limit - 1)}…` : plain; };
const stamp = (at: number, zone: string) => {
  const p = localParts(at, zone), pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
};
const REQUEST_TITLES: Record<string, string> = { 'raise-caps': "Let me continue past this installation's allowance",
  'renew-expiry': 'Update the activation approval record', 'retract-turns': 'Remove test messages from my record' };
const REQUEST_STATES: Record<string, string> = { open: 'Waiting for your answer', applied: 'Approved and done',
  'approved, not applied': 'Approved, being applied', superseded: 'Replaced by a newer request', lapsed: 'Expired unanswered',
  'not sent': 'Being prepared' };
/** One send's settled outcome in plain words (Rules 26, 42), read through the journal's own `sendOutcomeOf`: a receipt is
 * delivery; a recorded refusal or UNKNOWN is settled and never sent again; with no outcome recorded yet it is unconfirmed. */
function delivery(view: JournalView, target: string, sent: number | undefined, done: string, what: string): string {
  const outcome = sendOutcomeOf(view, target, sent);
  // The reason is clipped to the room the page's state field leaves, so a long provider reason never voids the snapshot;
  // the outcome and "not sent again" always survive, and the journal keeps the full reason.
  const settled = (head: string, reason: string | null | undefined, tail: string) => {
    if (!reason) return `${head}${tail}`;
    return `${head} (${clip(reason, Math.max(1, DASHBOARD_LIMITS.stateChars - head.length - tail.length - 3))})${tail}`;
  };
  if (outcome.kind === 'accepted') return done;
  if (outcome.kind === 'refused') return settled(`${what} was refused and not delivered`, outcome.reason, '; it is not sent again');
  return view.sendOutcomes.some(item => item.target === target)
    ? settled(`${what} may or may not have arrived: delivery is UNKNOWN`, outcome.reason, '; it is not sent again')
    : `Sending ${what.toLowerCase()}: not confirmed delivered yet`;
}
/** What happened to one message, and the reply it got, read from the turn's own durable record. A message covered by a
 * limited answer shows that answer and its lead's send outcome, whichever covered turn it is. */
export function turnOutcome(view: JournalView, turn: Turn): { state: string; reply: string | null } {
  // Rule 42: a split reply is answered only when every message carrying it was accepted; otherwise the state is the
  // first message without a receipt, named by its place.
  if (turn.intent !== undefined) {
    const whole = replyOutcomeOf(view, turn);
    const done = turn.heldReview ? 'Reply held for review; holding notice delivered' : 'Answered';
    if (whole.outcome.kind === 'accepted') return { reply: turn.intent, state: done };
    return { reply: turn.intent, state: delivery(view, whole.target, undefined, done,
      whole.part === 1 ? turn.heldReview ? 'My holding notice' : 'My reply' : `Part ${String(whole.part)} of ${String(whole.of)} of my reply`) };
  }
  if (turn.limited !== undefined) {
    const lead = view.turns.get(turn.limited.lead);
    return { reply: turn.limited.text, state: delivery(view, `limited:${turn.limited.lead}`, lead?.limitedSent,
      'Answered briefly: the allowance was reached', 'My brief answer (the allowance was reached)') };
  }
  if (turn.held) return { reply: null, state: `Held: ${turn.held}` };
  return { reply: null, state: 'Waiting for my answer' };
}

/** The snapshot for one moment. `statusText` is `statusAnswer(...)`, the exact chat status answer the runner would send now. */
export function dashboardSnapshot(view: JournalView, input: { now: number; zone: string; statusText: string; bot: string | null; stopped: boolean;
  /** The runner's live working-activity line for one turn (working-activity.mjs `current`), and the machine serving this conversation. */
  activity?: (id: string) => { text: string; running: boolean } | null; machine?: string | null }): DashboardSnapshot {
  const { now, zone } = input, L = DASHBOARD_LIMITS;
  const requests = operatorRequestsReport(view, now).slice(-L.requests).reverse().map(item => ({
    title: REQUEST_TITLES[item.action] ?? 'A request from your agent', state: REQUEST_STATES[item.state] ?? item.state,
    open: item.state === 'open', route: item.route, link: item.route === 'github-review' ? item.link ?? null : null,
    sharedAccess: item.sharedAccess ? { account: item.sharedAccess.account, disclosure: item.sharedAccess.disclosure } : null }));
  const detail = (turn: Turn): DashboardTurn => {
    const outcome = turnOutcome(view, turn);
    return { update: turn.update, time: stamp(messageTime(turn) ?? turn.at, zone), from: turn.writer?.kind === 'system' ? 'scheduled' as const : 'you' as const,
      message: clip(turn.text, L.textChars), reply: outcome.reply === null ? null : clip(outcome.reply, L.textChars), state: outcome.state };
  };
  const turns = view.order.filter(turn => turn.accepted && !retractedTurn(view, turn.id)).slice(-L.turns).reverse().map(detail);
  const sessions = sessionsNow(view, input);
  const conversationIds = new Set(sessions.filter(item => item.kind === 'conversation').map(item => item.id));
  const sessionTurns = view.order.filter(turn => conversationIds.has(turn.id)).map(detail);
  const bot = input.bot?.replace(/^@/u, '') ?? null;
  return { type: DASHBOARD_SNAPSHOT, schemaVersion: 1, asOf: now, zone,
    state: input.stopped || view.stop !== null ? 'stopped' : 'running', until: stamp(view.expires, zone),
    status: input.statusText.split('\n').slice(0, L.statusLines).map(line => clip(line, L.lineChars)),
    counts: { turnsToday: turnsToday(view, now, zone), held: [...heldReplies(view).values()].reduce((a, b) => a + b, 0),
      waiting: requests.filter(item => item.open).length },
    allowance: [{ label: 'Model calls', used: view.calls, max: view.limits.maxCalls },
      { label: 'Replies', used: view.replies, max: view.limits.maxReplies },
      { label: 'Messages taken', used: view.order.length, max: view.limits.maxTurns },
      { label: 'Reply checks', used: view.jevChecks, max: view.limits.maxReplies }],
    tokens: Object.values(view.tokenTotals).reduce((total, kind) => ({ input: total.input + kind.inputTokens,
      output: total.output + kind.outputTokens, unknownCalls: total.unknownCalls + kind.unknownCalls }), { input: 0, output: 0, unknownCalls: 0 }),
    requests, turns, chat: bot !== null && /^[A-Za-z0-9_]{5,32}$/u.test(bot) ? bot : null,
    sessions, sessionTurns, health: healthNow(view, zone) };
}

/** Work in progress (1.x `GET /sessions` default view: active only). A conversation session is an accepted message whose
 * answer is neither sent, held nor limited yet: running once its model call is reserved or its live activity says so,
 * starting before that. A delegated session is an open session-work edge (a child the runner registered and has not
 * closed). Answered, held and closed work leaves the list, so finished work never reads as running (CMT-1936). */
export function sessionsNow(view: JournalView, input: { now: number; zone: string; activity?: (id: string) => { text: string; running: boolean } | null;
  machine?: string | null }): DashboardSession[] {
  const L = DASHBOARD_LIMITS, { zone } = input, machine = input.machine ?? null;
  const rows: (DashboardSession & { at: number })[] = [];
  for (const turn of view.order) {
    if (!turn.accepted || retractedTurn(view, turn.id) || turn.intent !== undefined || turn.limited !== undefined || turn.held) continue;
    const activity = input.activity?.(turn.id) ?? null, at = messageTime(turn) ?? turn.at;
    rows.push({ id: turn.id, kind: 'conversation', label: clip(turn.text, L.labelChars) || '(no text)',
      state: turn.reserved || activity?.running === true ? 'running' : 'starting', since: stamp(at, zone), machine,
      activity: activity ? clip(activity.text, L.activityChars) : null, update: turn.update, at });
  }
  for (const edge of Object.values(view.activeSessionWork ?? {}))
    rows.push({ id: edge.id, kind: 'delegated', label: clip(edge.scope, L.labelChars), state: 'running', since: stamp(edge.openedAt, zone),
      machine: clip(edge.placement, 64), activity: null, update: null, at: edge.openedAt });
  return rows.sort((a, b) => b.at - a.at).slice(0, L.sessions).map(({ at: _at, ...row }) => row);
}

/** The 1.x Process Health tab's plain-English kinds (dashboard/process-health.js CATEGORY_WORDS), re-keyed to what this
 * journal records about its own work. Each kind names its status the 1.x way: open (still looking into it), attributed
 * (the cause is known) or resolved (worked out). */
const MODEL_FAILURE_WORDS: Record<string, string> = { rejected: 'A model answer that was turned away', malformed: 'A model answer in the wrong shape',
  empty: 'A model answer that came back empty', capacity: 'The model was over capacity' };
/** Process health from the journal's own records: one item per kind noticed, newest first, bounded; the kinds seen more
 * than once are the patterns (1.x insights); the watch rows say which of the three self-checks have run; the totals are
 * the 1.x detail drawer's. Nothing here is a verdict or an action (tab spec §4.2a/b). */
export function healthNow(view: JournalView, zone: string): DashboardHealth {
  const L = DASHBOARD_LIMITS;
  const items: { category: string; summary: string; status: HealthStatus; at: number | null; count: number }[] = [];
  const add = (category: string, count: number, summary: string, status: HealthStatus, at: number | null) => {
    if (count > 0) items.push({ category, summary: clip(summary, L.summaryChars), status, at, count }); };
  const times = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;
  const refused = view.sendOutcomes.filter(item => item.outcome === 'refused'), unknown = view.sendOutcomes.filter(item => item.outcome === 'unknown');
  add('A message that could not be delivered', refused.length, `${times(refused.length, 'message was', 'messages were')} refused by the chat service; none is sent again, and each is marked in Recent messages.`,
    'attributed', refused.at(-1)?.at ?? null);
  add('A message whose delivery is unknown', unknown.length, `${times(unknown.length, 'message', 'messages')} may or may not have arrived; none is sent again, so nothing is doubled.`,
    'open', unknown.at(-1)?.at ?? null);
  for (const [failure, count] of view.failureClasses)
    add(MODEL_FAILURE_WORDS[failure] ?? 'A model answer that could not be used', count, `${times(count, 'answer', 'answers')} from the model could not be used as it came; the message was answered another way or held.`,
      'attributed', null);
  const summaryFailures = [...view.summaryFailures.values()].reduce((a, b) => a + b, 0);
  add('A memory summary that did not pass', summaryFailures, `${times(summaryFailures, 'attempt', 'attempts')} to summarise earlier messages did not pass the faithfulness check; the earlier messages stay as they are.`,
    'attributed', view.lastSummaryFailure?.at ?? null);
  // Check events can include advisory objections and outages followed by delivery; they prove no hold or resolution.
  add('A reply check that found a problem', view.replyCheckCounts.violation, `${times(view.replyCheckCounts.violation, 'reply check', 'reply checks')} reported a problem. Each message records what happened to its reply.`,
    'open', null);
  add('A reply check that could not run', view.replyCheckCounts.unavailable, `${times(view.replyCheckCounts.unavailable, 'reply check', 'reply checks')} could not run. Each message records what happened to its reply.`,
    'open', null);
  const heldDrafts = view.order.filter(turn => turn.heldReview !== undefined);
  add('A draft held by its reply check', heldDrafts.length, `${times(heldDrafts.length, 'draft was', 'drafts were')} withheld after review. Each message records what happened to its holding notice.`,
    'open', heldDrafts.at(-1)?.intentAt ?? null);
  const incoherent = view.order.filter(turn => (turn.checked?.length ?? 0) > 0);
  add('A reply that disagreed with earlier messages', incoherent.length, `${times(incoherent.length, 'reply', 'replies')} disagreed with what was said earlier; ${view.corrections.length ? `${String(view.corrections.length)} still to correct in a later reply` : 'each was corrected in a later reply'}.`,
    view.corrections.length ? 'open' : 'resolved', incoherent.at(-1)?.intentAt ?? incoherent.at(-1)?.at ?? null);
  for (const [reason, count] of heldReplies(view))
    add('A reply held for review', count, `${times(count, 'reply is', 'replies are')} held: ${reason}.`, 'open', null);
  for (const [channel, error] of view.channelSourceErrors)
    add('A chat connection problem', 1, `Reading ${channel} messages hit a problem: ${error}.`, 'open', null);
  add('A promise that could not be recorded', view.commitmentRefusals + view.rejectedObligations, `${times(view.commitmentRefusals + view.rejectedObligations, 'proposed promise was', 'proposed promises were')} refused for naming no owner or dependency; nothing was promised silently.`,
    'attributed', null);
  const noticed = items.sort((a, b) => (b.at ?? -1) - (a.at ?? -1)).slice(0, L.noticed)
    .map(({ at, ...item }) => ({ ...item, when: at === null ? '' : stamp(at, zone) }));
  const patterns = items.filter(item => item.count >= 2).slice(0, L.patterns)
    .map(item => ({ summary: clip(`${item.category} keeps coming up: the same kind of problem ${String(item.count)} times.`, L.summaryChars), timesSeen: item.count, status: item.status }));
  const replyChecks = Object.values(view.replyCheckCounts).reduce((a, b) => a + b, 0);
  return { noticed, patterns,
    watch: { recording: true, checking: replyChecks > 0 || view.order.some(turn => turn.checked !== undefined), reviewing: view.retroPasses.length > 0 },
    totals: { noticed: items.reduce((a, item) => a + item.count, 0), known: items.filter(item => item.status !== 'open').reduce((a, item) => a + item.count, 0) } };
}
