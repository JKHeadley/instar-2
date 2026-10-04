/** The operator dashboard's data (Rules 79, 81, 87; tests/preview/README.md "The operator dashboard"). The runner projects
 * it from the durable journal with the same functions the chat "status" reply and the status command use, and publishes
 * it into its own approval outbox. The operator's own approval page renders it behind the operator's passkey. It is a
 * disposable projection, never authority: it confers nothing, and the page shows its age so a stale copy is never read as
 * current (purpose Rule 2: the loss detector for this state is that age, on every view). */
import { redact } from '../../src/recall/redact.js';
import { localParts } from './dated-memory.js';
import { operatorRequestsReport, replyTarget, retractedTurn, sendOutcomeOf, type JournalView, type Turn } from './journal.js';
import { messageTime } from './self-state.js';
import { heldReplies, turnsToday } from './status-command.js';

export const DASHBOARD_SNAPSHOT = 'PreviewOperatorDashboard';
/** Finite bounds (Rule 60). The operator page refuses a snapshot past its own bounds (scripts/operator-dashboard.mjs). */
export const DASHBOARD_LIMITS = Object.freeze({ statusLines: 40, lineChars: 4000, turns: 10, textChars: 500, requests: 10, stateChars: 200 });

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
  turns: { update: number; time: string; from: 'you' | 'scheduled'; message: string; reply: string | null; state: string }[];
  /** The bot's username, for a direct link into the operator's chat; null when the runner was not told it. */
  chat: string | null;
}

const clip = (text: string, limit: number) => { const plain = redact(text).text; return plain.length > limit ? `${plain.slice(0, limit - 1)}…` : plain; };
const stamp = (at: number, zone: string) => {
  const p = localParts(at, zone), pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
};
const REQUEST_TITLES: Record<string, string> = { 'raise-caps': "Let me continue past this trial's allowance",
  'renew-expiry': 'Extend this trial', 'retract-turns': 'Remove test messages from my record' };
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
  if (turn.intent !== undefined) return { reply: turn.intent, state: delivery(view, replyTarget(turn), turn.sent, 'Answered', 'My reply') };
  if (turn.limited !== undefined) {
    const lead = view.turns.get(turn.limited.lead);
    return { reply: turn.limited.text, state: delivery(view, `limited:${turn.limited.lead}`, lead?.limitedSent,
      'Answered briefly: the allowance was reached', 'My brief answer (the allowance was reached)') };
  }
  if (turn.held) return { reply: null, state: `Held: ${turn.held}` };
  return { reply: null, state: 'Waiting for my answer' };
}

/** The snapshot for one moment. `statusText` is `statusAnswer(...)`, the exact chat status answer the runner would send now. */
export function dashboardSnapshot(view: JournalView, input: { now: number; zone: string; statusText: string; bot: string | null; stopped: boolean }): DashboardSnapshot {
  const { now, zone } = input, L = DASHBOARD_LIMITS;
  const requests = operatorRequestsReport(view, now).slice(-L.requests).reverse().map(item => ({
    title: REQUEST_TITLES[item.action] ?? 'A request from your agent', state: REQUEST_STATES[item.state] ?? item.state,
    open: item.state === 'open', route: item.route, link: item.route === 'github-review' ? item.link ?? null : null,
    sharedAccess: item.sharedAccess ? { account: item.sharedAccess.account, disclosure: item.sharedAccess.disclosure } : null }));
  const turns = view.order.filter(turn => turn.accepted && !retractedTurn(view, turn.id)).slice(-L.turns).reverse().map(turn => {
    const outcome = turnOutcome(view, turn);
    return { update: turn.update, time: stamp(messageTime(turn) ?? turn.at, zone), from: turn.writer?.kind === 'system' ? 'scheduled' as const : 'you' as const,
      message: clip(turn.text, L.textChars), reply: outcome.reply === null ? null : clip(outcome.reply, L.textChars), state: outcome.state };
  });
  const bot = input.bot?.replace(/^@/u, '') ?? null;
  return { type: DASHBOARD_SNAPSHOT, schemaVersion: 1, asOf: now, zone,
    state: input.stopped || view.stop !== null ? 'stopped' : now >= view.expires ? 'ended' : 'running', until: stamp(view.expires, zone),
    status: input.statusText.split('\n').slice(0, L.statusLines).map(line => clip(line, L.lineChars)),
    counts: { turnsToday: turnsToday(view, now, zone), held: [...heldReplies(view).values()].reduce((a, b) => a + b, 0),
      waiting: requests.filter(item => item.open).length },
    allowance: [{ label: 'Model calls', used: view.calls, max: view.limits.maxCalls },
      { label: 'Replies', used: view.replies, max: view.limits.maxReplies },
      { label: 'Messages taken', used: view.order.length, max: view.limits.maxTurns },
      { label: 'Reply checks', used: view.jevChecks, max: view.limits.maxReplies }],
    tokens: Object.values(view.tokenTotals).reduce((total, kind) => ({ input: total.input + kind.inputTokens,
      output: total.output + kind.outputTokens, unknownCalls: total.unknownCalls + kind.unknownCalls }), { input: 0, output: 0, unknownCalls: 0 }),
    requests, turns, chat: bot !== null && /^[A-Za-z0-9_]{5,32}$/u.test(bot) ? bot : null };
}
