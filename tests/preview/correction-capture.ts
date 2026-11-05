/**
 * Correction capture: how an operator correction or preference becomes a durable record (carryover row 32; 1.x
 * `src/monitoring/CorrectionCaptureLoop.ts` at 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9, spec §3.1/§3.3).
 *
 * 1.x captured on the hot delivery path: a keyword classifier flagged a user message, a per-topic in-memory ring
 * (bounded per topic, LRU/TTL-evicted) supplied the look-back window, every turn was secret-scrubbed BEFORE it
 * entered a separate distill prompt (delimited as untrusted data, each turn marked fromUser, the model told to
 * learn from a USER turn only), the model's envelope was enum-validated and scrubbed AGAIN, and a capacity throw
 * from that extra model call persisted the scrubbed window to a durable backlog for a bounded retry; a
 * non-capacity fault, a load-shed without backlog, a per-topic rate ceiling or a malformed envelope dropped the
 * capture with an audit line.
 *
 * In 2.0 the capture is the journal itself, and the distillation is the answer path's own judgment:
 *  - The operator's message is durable intake before anything reads it (Rule 2, "durable intake" floor), from the
 *    verified principal only (Rules 28/29). No capture is optional, no window is held in memory, no topic is
 *    evicted: `captureWindow` is a bounded READ of the same thread's recorded turns, ending at the trigger.
 *  - The lesson is the memory change the answer model proposed on the answer path and the journal validated on
 *    write and again on replay (`prefer` with the operator's exact clause; `correct` naming the agent's reply; a
 *    `memoryFailure` report), never a second model call with a word-list trigger (Rules 10, 116). The model
 *    cannot widen the recorded kind: the mode enum and clause checks are the journal's, and a proposal that
 *    fails them leaves the turn `undecided`, with the operator told so, rather than silently dropped.
 *  - Scrubbing is the one redaction owner: the packet the model reads and every projection this module serves
 *    pass through `redact` (the same both-sided guarantee as 1.x's pre- and post-scrub, with one owner).
 *  - There is no backlog, retry loop, rate ceiling or load-shed of its own. When the answer model is
 *    unavailable the turn stays recorded and unanswered, and the existing recovery answers it later under the
 *    existing call caps; the lesson appears when the answer does. `captureDecision` makes each outcome
 *    independently observable (Rule 39): recorded, noise, undecided, unanswered.
 */
import { redact } from '../../src/recall/redact.js';
import type { JournalView, Turn } from './journal.js';
import { correctionOccurrences } from './correction-ledger.js';

/** Default look-back depth (the 1.x `captureContextTurns` the unit tests used). */
export const DEFAULT_CAPTURE_CONTEXT_TURNS = 6;
/** Per-turn text bound inside a window (1.x `scrubSecrets(t.text).slice(0, 1000)`). */
export const CAPTURE_TURN_CHARS = 1000;

export interface CaptureTurn {
  /** The journal turn the text comes from (an operator message, or the agent's sent reply to one). */
  id: string;
  text: string;
  fromUser: boolean;
  /** epoch ms — for ordering. */
  at: number;
}

/**
 * The window as it stood when the trigger was captured: the same conversation's recorded turns up to and
 * including the trigger, oldest first, at most `contextTurns` entries. Operator messages are marked fromUser;
 * the agent's own sent replies (its concessions and apologies) are marked fromUser=false so a reader derives a
 * lesson from a user turn only. Every text is credential-redacted and bounded. Turns that arrived after the
 * trigger are never included (1.x `windowEndingAt`). An unknown trigger yields an empty window.
 */
export function captureWindow(view: JournalView, operator: (item: Turn) => boolean, triggerId: string,
  contextTurns = DEFAULT_CAPTURE_CONTEXT_TURNS): CaptureTurn[] {
  const trigger = view.turns.get(triggerId);
  if (!trigger) return [];
  const bounded = (text: string) => redact(text).text.slice(0, CAPTURE_TURN_CHARS);
  const turns: CaptureTurn[] = [];
  for (const item of view.order) {
    if (item.update > trigger.update) break;
    if (!item.accepted || item.thread !== trigger.thread || !operator(item)) continue;
    turns.push({ id: item.id, text: bounded(item.text), fromUser: true, at: item.at });
    // The agent's turn is what it sent (the intent), else the answer it recorded; a notice is not its turn.
    const reply = item.id === trigger.id ? undefined : (item.intent ?? item.answer)?.replace(/^PREVIEW — /u, '');
    if (reply !== undefined && item.noticeClass === undefined) turns.push({ id: item.id, text: bounded(reply), fromUser: false, at: item.intentAt ?? item.answerAt ?? item.at });
  }
  return turns.slice(-Math.max(1, contextTurns));
}

/** What became of one operator message as correction evidence, each outcome observable on its own (Rule 39). */
export type CaptureDecision =
  | 'recorded'    // a validated preference or a recorded memory failure names this message as its trigger
  | 'noise'       // answered; the answer path proposed no lesson from it (the retrospective still inspects it)
  | 'undecided'   // the proposal was refused, held or unresolved; the operator was told and the message is kept
  | 'unanswered'  // no complete answer yet: the message is durable and still owed, never dropped
  | 'no-signal';  // not an accepted message from the verified operator

export function captureDecision(view: JournalView, operator: (item: Turn) => boolean, turn: Turn,
  occurrences = correctionOccurrences(view, operator)): CaptureDecision {
  if (!turn.accepted || !operator(turn)) return 'no-signal';
  if (occurrences.some(row => row.trigger === turn.id)) return 'recorded';
  if (turn.memoryUndecided || turn.memoryPending || turn.memoryUnresolved) return 'undecided';
  if (turn.modelState !== 'complete' || turn.answer === undefined) return 'unanswered';
  return 'noise';
}

/** Counts by decision over every accepted turn (the runner's read-only status block). */
export function captureReport(view: JournalView, operator: (item: Turn) => boolean): Record<CaptureDecision, number> {
  const report: Record<CaptureDecision, number> = { recorded: 0, noise: 0, undecided: 0, unanswered: 0, 'no-signal': 0 };
  const occurrences = correctionOccurrences(view, operator);
  for (const turn of view.order) if (turn.accepted) report[captureDecision(view, operator, turn, occurrences)]++;
  return report;
}
