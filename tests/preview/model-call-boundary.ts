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
 * becomes. The model never supplies or widens either. `authority` says what the judgment can do on
 * its own (Rules 86, 95): `signal` informs and never holds; `mandatory` names the recorded-state
 * floors its consumer still enforces whatever the model answers. Each `invalid` states what the
 * consumer actually does, per consumer (Rule 95). */
export const LIVE_JUDGMENTS = Object.freeze({
  answer: { route: 'preview-subscription', actions: ['work'], default: 'work', authority: 'signal', invalid: 'fixed failure reply (MODEL_FAILURE_REPLY); memory, reminders and grants still pass their source/grant checks' },
  'reply-review': { route: 'preview-subscription', actions: ['object', 'clear'], default: 'clear', authority: 'signal',
    mandatory: 'an objection naming credential, defers_work or unrecorded_blocker, a Jev credential flag, or a runner-refused obligation declaration keeps the candidate held until one bounded correction clears it',
    invalid: 'review unavailable after its one format re-ask: an advisory-only candidate is released once with the unavailable status recorded (reachability fails open); a candidate under a mandatory floor stays held with its input preserved' },
  'reply-revision': { route: 'preview-subscription', actions: ['revise', 'keep'], default: 'keep', authority: 'signal',
    invalid: 'no usable response: every objection is recorded as no decision and the original candidate is kept; a held candidate stays held' },
  summary: { route: 'preview-subscription', actions: ['record-summary', 'discard'], default: 'discard', authority: 'signal', invalid: 'summary-failed: no summary, memory or people are recorded' },
  'summary-review': { route: 'preview-subscription', actions: ['accept', 'reject'], default: 'reject', authority: 'mandatory',
    invalid: 'violation or unavailable: the candidate summary is not recorded; as the faithfulness escalation, only its pass accepts (covering integrity too), and an unanswered call keeps its reserved charge UNKNOWN' },
  'jev-reply-check': { route: 'typesafe-jev', actions: ['clear', 'escalate'], default: 'escalate', authority: 'signal',
    invalid: 'Jev unavailable: every rule escalates to the contextual reply review; Jev alone never releases a flagged rule and holds nothing except its completed credential flag when that review gives no verdict' },
  'jev-summary-integrity': { route: 'typesafe-jev', actions: ['accept', 'escalate', 'reject'], default: 'reject', authority: 'mandatory', invalid: 'unavailable: summary-failed is recorded and the summary is not committed; there is no escalation' },
  'jev-summary-faithfulness': { route: 'typesafe-jev', actions: ['accept', 'escalate', 'reject'], default: 'reject', authority: 'mandatory',
    invalid: 'undecided (unsure band, unavailable, or evidence past its bound): escalates once to summary-review, whose pass alone accepts; when that review cannot be admitted (no route, stopped, call cap) or does not pass, the summary is not recorded; an unanswered Jev call keeps its reserved charge UNKNOWN' },
  retrospective: { route: 'preview-subscription', actions: ['record-review', 'discard'], default: 'discard', authority: 'signal', invalid: 'pass failed: no grade, finding or candidate is recorded and every case stays owed' },
  'jev-step-check': { route: 'typesafe-jev', actions: ['record-verdict'], default: 'record-verdict', authority: 'signal', invalid: 'unavailable verdict recorded; observation only, no effect' },
} as const);
export type LiveJudgment = keyof typeof LIVE_JUDGMENTS;

/** The local floor every subscription envelope carries (journal-envelope.ts). A returned
 * Decision may echo it; it may never define, widen or choose outside it. Each judgment's own
 * semantic action space above is enforced by its consumer's parser. */
export const ENVELOPE_FLOOR = Object.freeze({ type: 'ActionFloor', schemaVersion: 1, actions: Object.freeze(['work']), default: 'work' });

/** True when a returned Decision's floor, if any, is exactly the local one and its choice lies inside it.
 * The live model sometimes echoes only the floor's action list (`allowed: ["work"]`, copied from
 * bindings.floor.actions); that exact list is still the local floor and widens nothing, so it is read
 * the same. Any other list, type, version or default stays malformed. */
export function decisionWithinFloor(decision: { floor?: unknown }): boolean {
  if (decision.floor === undefined) return true;
  const floor = decision.floor as { allowed?: { type?: unknown; schemaVersion?: unknown; actions?: unknown; default?: unknown } | unknown[]; chosen?: unknown } | null;
  const allowed = floor?.allowed;
  const exact = (actions: unknown) => Array.isArray(actions) && JSON.stringify(actions) === JSON.stringify(ENVELOPE_FLOOR.actions);
  return !!allowed && (Array.isArray(allowed) ? exact(allowed)
    : allowed.type === ENVELOPE_FLOOR.type && allowed.schemaVersion === ENVELOPE_FLOOR.schemaVersion
      && exact(allowed.actions) && allowed.default === ENVELOPE_FLOOR.default)
    && typeof floor?.chosen === 'string' && ENVELOPE_FLOOR.actions.includes(floor.chosen);
}

export interface ModelUsageRecord { inputTokens: number | null; outputTokens: number | null; charge: null }
/** One durable model-call record: exactly what was asked, what came back, by which route, how
 * it ended, how long it took and what it used (or the written exception naming why not). */
export interface ModelCallRecord { kind: 'model-call'; id: string; judgment: LiveJudgment; route: LiveModelRoute; model: string;
  inputSha256: string; input?: string; inputRef?: string; output: string | null; outcome: 'complete' | 'rejected' | 'uncertain' | 'failed';
  latencyMs: number; usage: ModelUsageRecord | null; usageException?: string;
  /** The journal occurrence this call served (turn, operation or summary id). A content-derived `id` repeats for
   * identical requests; the occurrence plus the record's journal position joins each call to its decision. */
  occurrence?: string;
  /** What was done to the recorded bytes before they were written (Rule 58, least revelation). */
  inputTransformations?: ReplayTransformation[]; outputTransformations?: ReplayTransformation[];
  /** `faithful` only when the admitted input is held exactly (inline or by durable reference); a redacted or
   * truncated input can be read and graded, never presented as a faithful replay of what the model saw. */
  replay?: 'faithful' | 'not-faithful'; at: number }
export type ReplayTransformation = 'credential-redacted' | 'truncated';

const MAX_RECORDED_BYTES = 256 * 1024;
const bounded = (text: string): { text: string; transformations: ReplayTransformation[] } => {
  const scrubbed = redact(text);
  const fits = Buffer.byteLength(scrubbed.text) <= MAX_RECORDED_BYTES;
  return { text: fits ? scrubbed.text : `${Buffer.from(scrubbed.text).subarray(0, MAX_RECORDED_BYTES).toString('utf8')}…[truncated]`,
    transformations: [...(scrubbed.count > 0 ? ['credential-redacted' as const] : []), ...(fits ? [] : ['truncated' as const])] };
};
/** Whether a recorded call can be replayed as the model saw it. A record written before the transformation
 * fields existed is honestly not faithful: its truncation and redaction were never recorded. */
export function replayEligibility(record: ModelCallRecord): { faithful: boolean; reason: string } {
  if (record.replay === undefined) return { faithful: false, reason: 'legacy record: transformations not recorded' };
  if (record.replay === 'faithful') return { faithful: true, reason: record.inputRef === undefined ? 'exact inline input' : `exact input by reference ${record.inputRef}` };
  return { faithful: false, reason: `input ${(record.inputTransformations ?? []).join(' and ')}` };
}
export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/** Refuses an unregistered judgment, or one on another route, before any call is made. */
export function assertLiveJudgment(judgment: string, route: string): void {
  if (!Object.hasOwn(LIVE_JUDGMENTS, judgment) || LIVE_JUDGMENTS[judgment as LiveJudgment].route !== route)
    throw Error(`model-call boundary: unregistered judgment ${judgment} on ${route}`);
}

/** Builds the record the boundary appends before its caller may read the result. Secrets are
 * scrubbed; an input already durable elsewhere in the journal is referenced by digest. */
export function modelCallRecord(input: { id: string; judgment: string; route: string; model: string; input: string;
  inputRef?: string; occurrence?: string; output: string | null; outcome: ModelCallRecord['outcome']; latencyMs: number;
  usage: ModelUsageRecord | null; at: number }): ModelCallRecord {
  assertLiveJudgment(input.judgment, input.route);
  const judgment = input.judgment as LiveJudgment;
  const route = input.route as LiveModelRoute;
  const usable = input.usage && (input.usage.inputTokens !== null || input.usage.outputTokens !== null) ? input.usage : null;
  const exception = usable ? undefined : USAGE_EXCEPTIONS[route];
  if (!usable && input.outcome === 'complete' && exception === undefined) throw Error('model-call boundary: usage absent without a written exception');
  const recordedInput = input.inputRef === undefined ? bounded(input.input) : undefined;
  const recordedOutput = input.output === null ? null : bounded(input.output);
  return { kind: 'model-call', id: input.id, judgment, route, model: input.model, inputSha256: sha256(input.input),
    ...(recordedInput === undefined ? { inputRef: input.inputRef! } : { input: recordedInput.text }),
    output: recordedOutput === null ? null : recordedOutput.text, outcome: input.outcome,
    latencyMs: Math.max(0, Math.round(input.latencyMs)), usage: usable,
    ...(exception === undefined ? {} : { usageException: exception }),
    ...(input.occurrence === undefined ? {} : { occurrence: input.occurrence }),
    inputTransformations: recordedInput?.transformations ?? [], outputTransformations: recordedOutput?.transformations ?? [],
    replay: recordedInput?.transformations.length ? 'not-faithful' : 'faithful', at: input.at };
}
