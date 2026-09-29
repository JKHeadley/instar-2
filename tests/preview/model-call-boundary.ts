// Rules 41, 57 and 75: the one written register of the preview's live model routes, their
// usage exceptions and every live judgment point with its local safe action space and
// conservative default. The launcher's single recording boundary refuses anything unlisted.
import { createHash } from 'node:crypto';
import { redact } from '../../src/recall/redact.js';

/** The actual live routes. Usage is reported by the provider; an absence is UNKNOWN, never invented. */
export const LIVE_MODEL_ROUTES = Object.freeze({
  'preview-subscription': { provider: 'anthropic', model: 'activation-bound exact model' },
  'typesafe-jev': { provider: 'typesafe', model: 'jev (JEV_MODEL)' },
} as const);
export type LiveModelRoute = keyof typeof LIVE_MODEL_ROUTES;

/** Rule 75's written exception list: a route whose provider may omit token usage. The call is
 * still recorded and counted; its usage and cost stay UNKNOWN rather than estimated. */
export const USAGE_EXCEPTIONS: Readonly<Partial<Record<LiveModelRoute, string>>> = Object.freeze({
  'typesafe-jev': 'TypeSafe System One returns usage only when the response carries it; absent usage is recorded UNKNOWN with no cost inferred.',
  'preview-subscription': 'The Claude Code subscription CLI can end without a usage block (timeout, kill, malformed terminal record); that call is UNKNOWN usage and subscription charge is never a bill.',
});

/** Rule 57: every live judgment the preview asks a model for. `actions` is the complete local
 * safe space its consumer may take; `default` is what an invalid, absent or out-of-floor answer
 * becomes. The model never supplies or widens either. */
export const LIVE_JUDGMENTS = Object.freeze({
  answer: { route: 'preview-subscription', actions: ['work'], default: 'work', invalid: 'fixed failure reply (MODEL_FAILURE_REPLY); memory, reminders and grants still pass their source/grant checks' },
  'reply-review': { route: 'preview-subscription', actions: ['release', 'hold'], default: 'hold', invalid: 'review unavailable: the candidate is held, never sent unchecked' },
  summary: { route: 'preview-subscription', actions: ['record-summary', 'discard'], default: 'discard', invalid: 'summary-failed: no summary, memory or people are recorded' },
  'summary-review': { route: 'preview-subscription', actions: ['accept', 'reject'], default: 'reject', invalid: 'violation or unavailable: the candidate summary is not recorded' },
  'jev-reply-check': { route: 'typesafe-jev', actions: ['release', 'escalate', 'hold'], default: 'escalate', invalid: 'Jev unavailable: escalates to the reply review, never releases' },
  'jev-summary-integrity': { route: 'typesafe-jev', actions: ['accept', 'escalate', 'reject'], default: 'escalate', invalid: 'unavailable: escalates to the summary review' },
  'jev-summary-faithfulness': { route: 'typesafe-jev', actions: ['accept', 'reject'], default: 'reject', invalid: 'undecided: the summary is not recorded' },
  retrospective: { route: 'preview-subscription', actions: ['record-review', 'discard'], default: 'discard', invalid: 'pass failed: no grade, finding or candidate is recorded and every case stays owed' },
  'jev-step-check': { route: 'typesafe-jev', actions: ['record-verdict'], default: 'record-verdict', invalid: 'unavailable verdict recorded; observation only, no effect' },
} as const);
export type LiveJudgment = keyof typeof LIVE_JUDGMENTS;

/** The local floor every subscription envelope carries (journal-envelope.ts). A returned
 * Decision may echo it; it may never define, widen or choose outside it. Each judgment's own
 * semantic action space above is enforced by its consumer's parser. */
export const ENVELOPE_FLOOR = Object.freeze({ type: 'ActionFloor', schemaVersion: 1, actions: Object.freeze(['work']), default: 'work' });

/** True when a returned Decision's floor, if any, is exactly the local one and its choice lies inside it. */
export function decisionWithinFloor(decision: { floor?: unknown }): boolean {
  if (decision.floor === undefined) return true;
  const floor = decision.floor as { allowed?: { type?: unknown; schemaVersion?: unknown; actions?: unknown; default?: unknown }; chosen?: unknown } | null;
  const allowed = floor?.allowed;
  return !!allowed && allowed.type === ENVELOPE_FLOOR.type && allowed.schemaVersion === ENVELOPE_FLOOR.schemaVersion
    && Array.isArray(allowed.actions) && JSON.stringify(allowed.actions) === JSON.stringify(ENVELOPE_FLOOR.actions)
    && allowed.default === ENVELOPE_FLOOR.default
    && typeof floor?.chosen === 'string' && ENVELOPE_FLOOR.actions.includes(floor.chosen);
}

export interface ModelUsageRecord { inputTokens: number | null; outputTokens: number | null; charge: null }
/** One durable model-call record: exactly what was asked, what came back, by which route, how
 * it ended, how long it took and what it used (or the written exception naming why not). */
export interface ModelCallRecord { kind: 'model-call'; id: string; judgment: LiveJudgment; route: LiveModelRoute; model: string;
  inputSha256: string; input?: string; inputRef?: string; output: string | null; outcome: 'complete' | 'rejected' | 'uncertain' | 'failed';
  latencyMs: number; usage: ModelUsageRecord | null; usageException?: string; at: number }

const MAX_RECORDED_BYTES = 256 * 1024;
const bounded = (text: string) => {
  const scrubbed = redact(text).text;
  return Buffer.byteLength(scrubbed) <= MAX_RECORDED_BYTES ? scrubbed : `${Buffer.from(scrubbed).subarray(0, MAX_RECORDED_BYTES).toString('utf8')}…[truncated]`;
};
export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/** Refuses an unregistered judgment, or one on another route, before any call is made. */
export function assertLiveJudgment(judgment: string, route: string): void {
  if (!Object.hasOwn(LIVE_JUDGMENTS, judgment) || LIVE_JUDGMENTS[judgment as LiveJudgment].route !== route)
    throw Error(`model-call boundary: unregistered judgment ${judgment} on ${route}`);
}

/** Builds the record the boundary appends before its caller may read the result. Secrets are
 * scrubbed; an input already durable elsewhere in the journal is referenced by digest. */
export function modelCallRecord(input: { id: string; judgment: string; route: string; model: string; input: string;
  inputRef?: string; output: string | null; outcome: ModelCallRecord['outcome']; latencyMs: number;
  usage: ModelUsageRecord | null; at: number }): ModelCallRecord {
  assertLiveJudgment(input.judgment, input.route);
  const judgment = input.judgment as LiveJudgment;
  const route = input.route as LiveModelRoute;
  const usable = input.usage && (input.usage.inputTokens !== null || input.usage.outputTokens !== null) ? input.usage : null;
  const exception = usable ? undefined : USAGE_EXCEPTIONS[route];
  if (!usable && input.outcome === 'complete' && exception === undefined) throw Error('model-call boundary: usage absent without a written exception');
  return { kind: 'model-call', id: input.id, judgment, route, model: input.model, inputSha256: sha256(input.input),
    ...(input.inputRef === undefined ? { input: bounded(input.input) } : { inputRef: input.inputRef }),
    output: input.output === null ? null : bounded(input.output), outcome: input.outcome,
    latencyMs: Math.max(0, Math.round(input.latencyMs)), usage: usable,
    ...(exception === undefined ? {} : { usageException: exception }), at: input.at };
}
