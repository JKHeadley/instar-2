/** The operator dashboard's data (Rules 79, 81, 87; tests/preview/README.md "The operator dashboard"). The runner projects
 * it from the durable journal with the same functions the chat "status" reply and the status command use, and publishes
 * it into its own approval outbox. The operator's own approval page renders it behind the operator's passkey. It is a
 * disposable projection, never authority: it confers nothing, and the page shows its age so a stale copy is never read as
 * current (purpose Rule 2: the loss detector for this state is that age, on every view). */
import { redact } from '../../src/recall/redact.js';
import { localParts } from './dated-memory.js';
import { operatorRequestsReport, retractedTurn, type JournalView, type Turn } from './journal.js';
import { messageTime } from './self-state.js';
import { heldReplies, turnsToday } from './status-command.js';

export const DASHBOARD_SNAPSHOT = 'PreviewOperatorDashboard';
/** Finite bounds (Rule 60). The operator page refuses a snapshot past its own bounds (scripts/operator-dashboard.mjs). */
export const DASHBOARD_LIMITS = Object.freeze({ statusLines: 40, lineChars: 4000, turns: 10, textChars: 500, requests: 10 });

export interface DashboardSnapshot {
  type: typeof DASHBOARD_SNAPSHOT; schemaVersion: 1; asOf: number; zone: string;
  state: 'running' | 'stopped' | 'ended'; until: string;
  /** The chat "status" answer, line by line. */
  status: string[];
  counts: { turnsToday: number; held: number; waiting: number };
  allowance: { label: string; used: number; max: number }[];
  tokens: { input: number; output: number; unknownCalls: number };
  requests: { title: string; state: string; open: boolean; route: 'chat' | 'github-review'; link: string | null }[];
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
/** What happened to one message, in plain words, read from the turn's own durable record. */
export function turnState(turn: Turn): string {
  if (turn.sent !== undefined) return 'Answered';
  if (turn.limitedSent !== undefined) return 'Answered briefly: the allowance was reached';
  if (turn.held) return `Held: ${turn.held}`;
  if (turn.intent !== undefined) return 'Sending';
  return 'Waiting for my answer';
}

/** The snapshot for one moment. `statusText` is `statusAnswer(...)`, the exact chat status answer the runner would send now. */
export function dashboardSnapshot(view: JournalView, input: { now: number; zone: string; statusText: string; bot: string | null; stopped: boolean }): DashboardSnapshot {
  const { now, zone } = input, L = DASHBOARD_LIMITS;
  const requests = operatorRequestsReport(view, now).slice(-L.requests).reverse().map(item => ({
    title: REQUEST_TITLES[item.action] ?? 'A request from your agent', state: REQUEST_STATES[item.state] ?? item.state,
    open: item.state === 'open', route: item.route, link: item.route === 'github-review' ? item.link ?? null : null }));
  const turns = view.order.filter(turn => turn.accepted && !retractedTurn(view, turn.id)).slice(-L.turns).reverse().map(turn => ({
    update: turn.update, time: stamp(messageTime(turn) ?? turn.at, zone), from: turn.writer?.kind === 'system' ? 'scheduled' as const : 'you' as const,
    message: clip(turn.text, L.textChars), reply: turn.intent === undefined ? null : clip(turn.intent, L.textChars), state: turnState(turn) }));
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
