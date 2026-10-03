/** Memory failures and the learning loop (Part 21 §16, docs/21-the-recall-doorway/16-memory-failures-and-the-learning-loop.md).
 *
 * A memory failure is a turn where the agent did not remember something it should have. Two signals reach it, both
 * already judged by the model on the answer path, never by a word list (Rule 10):
 *  - `operator-correction`: the operator corrected a fact the agent had stated. The existing correction path records
 *    it as a `correct` memory change whose `replies` (or `in: 'reply'`) name the agent's reply that restated the old
 *    fact. An operator correcting their own earlier statement, which the agent never repeated, is a fact correction
 *    and not a memory failure.
 *  - `operator-reminded`: after any answer to the operator (from full history, a summary, a set-aside floor, or a
 *    memory lookup), the operator's next message showed the agent should already have known something. The answer
 *    model reports it as `memoryFailure` on that turn's answer row. A plain "I don't know" carries no wrong value to
 *    correct, so the correction signal cannot cover it, even with the whole conversation in front of the agent.
 *
 * Everything here is a projection over durable journal rows (Rules 2, 39, 116): the failure record (what was asked,
 * what the memory path returned, the truth, and the likely cause) is recomputed on every read from the answer rows,
 * the memory changes and the failed turn's recorded packet grounding, all of which replay unchanged after a restart.
 * The cause is decided from that recorded evidence, not from the model's say-so (Rule 26).
 *
 * The learning loop changes behaviour structurally, inside the existing recall owner (no new engine):
 *  - a retrieval hint adds the words of the question that missed to the meaning cues of the message that held the
 *    answer, so the next question asked the same way reaches it (Rule 11's meaning index, extended by lessons);
 *  - a fact that keeps being forgotten (two or more failures on the same source) is pinned: recall carries that source
 *    on every turn where verbatim history no longer shows it, under the existing packet drop order.
 * A forgotten or corrected source teaches nothing: what the operator withdrew is never carried forward (Rule 7). */
import { redact } from '../../src/recall/redact.js';
import { terms } from '../../src/recall/lexical.js';
import type { JournalView, MemoryChange, ReplyGrounding, Turn } from './journal.js';

export type MemoryFailureSignal = 'operator-correction' | 'operator-reminded';
/** The likely cause, from the failed turn's recorded evidence:
 *  - `source-unresolved`: the earlier message that held the truth could not be resolved (the report named none and no
 *    earlier operator message states the reported words exactly). A wording miss is not evidence of absence (Rule 11),
 *    so whether the fact was ever stored stays unknown rather than asserted;
 *  - `wrongly-stored`: the original was right but a summary expressed the old, wrong value;
 *  - `summarized-away`: the original lay behind the summary, which kept neither the fact nor meaning cues for it;
 *  - `not-retrieved`: memory held the original (verbatim-reachable, or indexed by the summary) but recall missed it;
 *  - `shown-not-used`: the original was in the answer's packet and the answer still missed it. */
export type MemoryFailureCause = 'source-unresolved' | 'wrongly-stored' | 'summarized-away' | 'not-retrieved' | 'shown-not-used';
/** The answer model's report, as the answer row stores it. `quote` is the clause of the operator's message that states
 * the fact; `source` is the earlier message where the operator had said it, when the model could name one. */
export interface MemoryFailureProposal { quote: string; source?: string }
export interface MemoryFailure {
  signal: MemoryFailureSignal;
  /** The operator turn that corrected or reminded. */
  trigger: string; triggerUpdate: number;
  /** The turn whose answer failed, and what the operator asked there. */
  asked: { turn: string; update: number; question: string };
  /** What the memory path returned: the reply the operator saw, how many summarized turns recall offered, and the
   * one lookup's searched words and hits when it ran. */
  returned: { reply: string; recalled: number; lookup?: { words: string[]; found: number } };
  /** The truth: the operator's own words for it, and the earlier message that held it when one did. */
  truth: { quote: string; source?: string };
  cause: MemoryFailureCause;
  /** The recorded evidence the cause was read from. */
  basis: string;
}

export const MEMORY_FAILURE_TEXT_CHARS = 300;
/** How many learned cue words one lesson adds to a message's meaning cues. */
export const LEARNED_CUES_LIMIT = 12;
/** How many failures on one source make it a pinned fact. */
export const PIN_AFTER_FAILURES = 2;
/** Most pinned facts recall carries at once; the most recently failed win. */
export const PINNED_FACTS_LIMIT = 4;
/** Runner guidance offered by structure, never by the operator's words (Rule 10): on a verified operator turn whose
 * previous answered turn here was the operator's. It is the packet's lowest-priority guidance and yields first. */
export const MEMORY_FAILURE_DECISION = 'searchedTurn names your previous answer here. '
  + 'If this message shows you should already have known something the operator had told you, also return '
  + 'memoryFailure:{quote:<the clause of this message stating that fact, word for word>,source:<id of the earlier message that said it, '
  + 'from history or recalled, else null>}. Otherwise omit memoryFailure.';

const bounded = (value: string) => {
  const text = redact(value).text.replace(/\s+/gu, ' ').trim();
  return text.length > MEMORY_FAILURE_TEXT_CHARS ? `${text.slice(0, MEMORY_FAILURE_TEXT_CHARS - 1)}…` : text;
};
const normalized = (value: string) => value.toLowerCase().replace(/\s+/gu, ' ').trim().replace(/[.!?]+$/u, '');

/** The turn a reminder can be about: the latest earlier answered turn in the same conversation from the operator. A
 * complete-history answer is eligible too: an "I don't know" there states no wrong value a correction could replace,
 * and its grounding then classifies the miss as shown, not used. */
export function memoryFailureOffer(view: JournalView, turn: Turn, operator: (item: Turn) => boolean): Turn | undefined {
  let prior: Turn | undefined;
  for (const item of view.order) {
    if (item.update >= turn.update) break;
    if (item.accepted && item.thread === turn.thread && item.answer !== undefined && item.requestedAction === undefined
      && !item.editOf && operator(item)) prior = item;
  }
  return prior;
}

/** A report the answer row may store: the quote is a clause of the operator's own message (the whole message, bounded,
 * when the model's quote is not one); a source must be an earlier operator message the failed turn could have used. */
export function acceptedMemoryFailure(view: JournalView, turn: Turn, failed: Turn, value: unknown,
  operator: (item: Turn) => boolean): MemoryFailureProposal | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const { quote, source } = value as { quote?: unknown; source?: unknown };
  const clause = typeof quote === 'string' ? quote.trim() : '';
  const kept = clause.length >= 3 && clause.length <= MEMORY_FAILURE_TEXT_CHARS && turn.text.includes(clause)
    ? clause : turn.text.trim().slice(0, MEMORY_FAILURE_TEXT_CHARS);
  if (!kept) return undefined;
  const held = typeof source === 'string' ? view.turns.get(source) : undefined;
  return { quote: kept, ...(held && validSource(held, failed, operator) ? { source: held.id } : {}) };
}
const validSource = (held: Turn, failed: Turn, operator: (item: Turn) => boolean) =>
  held.accepted && held.update < failed.update && operator(held);

/** Replay's check of a stored report: the same rule the writer applied, so a row that could not have been written fails. */
export function validStoredMemoryFailure(view: JournalView, turn: Turn, failed: Turn | undefined, value: MemoryFailureProposal,
  operator: (item: Turn) => boolean): boolean {
  if (!failed || typeof value !== 'object' || value === null || typeof value.quote !== 'string' || !value.quote.trim()
    || value.quote.length > MEMORY_FAILURE_TEXT_CHARS || !turn.text.includes(value.quote)) return false;
  if (Object.keys(value).some(key => key !== 'quote' && key !== 'source')) return false;
  if (value.source === undefined) return true;
  const held = typeof value.source === 'string' ? view.turns.get(value.source) : undefined;
  return !!held && validSource(held, failed, operator);
}

/** Where the failed turn's recorded packet stood relative to the true source. */
function classify(view: JournalView, failed: Turn, source: Turn | undefined, summaryWrong: boolean):
  { cause: MemoryFailureCause; basis: string } {
  if (!source) return { cause: 'source-unresolved',
    basis: 'the original message was not named and no earlier operator message states the reported words exactly; whether it was stored is unknown' };
  if (summaryWrong) return { cause: 'wrongly-stored', basis: 'a summary passage expressed the old value' };
  const grounding: ReplyGrounding | undefined = failed.grounding;
  if (!grounding) return { cause: 'not-retrieved', basis: 'the failed turn recorded no packet grounding' };
  const shown = new Set([...grounding.history, ...grounding.recalled, ...grounding.memoryCandidates]);
  if (shown.has(source.id)) return { cause: 'shown-not-used', basis: 'the source was in the answer packet' };
  const frontier = Math.max(grounding.compactedThrough ?? -Infinity, grounding.setAsideThrough ?? -Infinity);
  if (source.update > frontier) return { cause: 'not-retrieved', basis: 'the source was verbatim-reachable but not in the packet' };
  // What memory held for the source when the answer was built: the summaries up to the one in force then.
  const through = grounding.summaryThrough ?? -Infinity;
  const kept = view.summaries.some(summary => summary.through <= through
    && (summary.memoryItems?.some(item => item.source === source.id) || summary.concepts?.some(item => item.source === source.id)));
  return kept ? { cause: 'not-retrieved', basis: 'the summary kept the source or meaning cues for it; recall did not select it' }
    : { cause: 'summarized-away', basis: 'the source lay behind the summary, which kept neither the fact nor cues for it' };
}

/** The latest operator message before `before` that states the clause exactly (case and spacing aside). A miss here
 * only means the source is unresolved: the operator may have said it in other words. */
function statedBefore(view: JournalView, clause: string, before: number, operator: (item: Turn) => boolean) {
  const wanted = normalized(clause);
  if (wanted.length < 3) return undefined;
  return view.order.filter(item => item.accepted && item.update < before && operator(item)
    && normalized(item.text).includes(wanted)).at(-1);
}

const returnedBy = (failed: Turn) => ({ reply: bounded((failed.intent ?? failed.answer ?? '').replace(/^PREVIEW — /u, '')),
  recalled: failed.grounding?.recalled.length ?? 0,
  ...(failed.lookup ? { lookup: { words: failed.lookup.words, found: failed.lookup.found.length } } : {}) });

/** Every memory failure the journal records, oldest first. */
export function memoryFailures(view: JournalView, operator: (item: Turn) => boolean): MemoryFailure[] {
  const failures: { at: number; failure: MemoryFailure }[] = [];
  for (const change of view.memory) {
    if (change.mode !== 'correct' || change.historical || change.replacement === undefined) continue;
    const failedId = change.in === 'reply' ? change.source : change.replies?.[0];
    const failed = failedId === undefined ? undefined : view.turns.get(failedId);
    const trigger = view.turns.get(change.trigger);
    if (!failed || !trigger || failed.update >= trigger.update) continue;
    const source = statedBefore(view, change.replacement, failed.update, operator);
    const { cause, basis } = classify(view, failed, source, !!change.summaryPassages?.length);
    failures.push({ at: trigger.update, failure: { signal: 'operator-correction', trigger: trigger.id, triggerUpdate: trigger.update,
      asked: { turn: failed.id, update: failed.update, question: bounded(failed.text) }, returned: returnedBy(failed),
      truth: { quote: bounded(change.replacement), ...(source ? { source: source.id } : {}) }, cause, basis } });
  }
  for (const trigger of view.order) {
    const proposal = trigger.memoryFailure;
    if (!proposal) continue;
    const failed = memoryFailureOffer(view, trigger, operator);
    if (!failed) continue;
    const named = proposal.source === undefined ? undefined : view.turns.get(proposal.source);
    const source = named ?? statedBefore(view, proposal.quote, failed.update, operator);
    const { cause, basis } = classify(view, failed, source, false);
    failures.push({ at: trigger.update, failure: { signal: 'operator-reminded', trigger: trigger.id, triggerUpdate: trigger.update,
      asked: { turn: failed.id, update: failed.update, question: bounded(failed.text) }, returned: returnedBy(failed),
      truth: { quote: bounded(proposal.quote), ...(source ? { source: source.id } : {}) }, cause,
      basis: named ? `${basis}; source named by the answer` : basis } });
  }
  return failures.sort((a, b) => a.at - b.at).map(item => item.failure);
}

/** A source the operator later withdrew or replaced teaches nothing (Rule 7: what was withdrawn is not carried). */
const withdrawn = (memory: readonly MemoryChange[], source: string) => memory.some(change =>
  change.mode !== 'prefer' && change.source === source && (change.mode === 'forget' || !change.historical));

/** The words of a question, as meaning cues: the same bounded, normalized shape the write-side index stores. */
export function learnedCues(question: string): string[] {
  const found: string[] = [];
  for (const match of question.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    const word = match[0];
    if (word.length < 3 || word.length > 40 || !terms(word).length || found.includes(word)) continue;
    found.push(word);
    if (found.length >= LEARNED_CUES_LIMIT) break;
  }
  return found;
}

export interface MemoryLessons {
  /** Source id to the cue words learned from the questions that missed it. */
  hints: Map<string, string[]>;
  /** Sources recall carries on every turn whose verbatim history no longer shows them, most recently failed first. */
  pinned: string[];
}
/** The learning loop's current lessons, derived from the failures. A hint is learned from one failure whose source
 * memory held but recall did not reach (or from the reminder itself, which holds the fact, when the original could
 * not be resolved); a pin needs the same source to fail repeatedly. */
export function memoryLessons(view: JournalView, failures: readonly MemoryFailure[]): MemoryLessons {
  const hints = new Map<string, string[]>(), counts = new Map<string, { count: number; last: number }>();
  for (const failure of failures) {
    const target = failure.truth.source
      ?? (failure.signal === 'operator-reminded' && failure.cause === 'source-unresolved' ? failure.trigger : undefined);
    if (target === undefined || withdrawn(view.memory, target)) continue;
    if (failure.cause === 'not-retrieved' || failure.cause === 'summarized-away' || failure.cause === 'source-unresolved') {
      const cues = hints.get(target) ?? [];
      for (const cue of learnedCues(failure.asked.question)) if (!cues.includes(cue) && cues.length < LEARNED_CUES_LIMIT) cues.push(cue);
      if (cues.length) hints.set(target, cues);
    }
    const seen = counts.get(target);
    counts.set(target, { count: (seen?.count ?? 0) + 1, last: failure.triggerUpdate });
  }
  const pinned = [...counts].filter(([, seen]) => seen.count >= PIN_AFTER_FAILURES)
    .sort((a, b) => b[1].last - a[1].last).slice(0, PINNED_FACTS_LIMIT).map(([source]) => source);
  return { hints, pinned };
}

/** The meaning index the recall owner ranks by, with each learned hint's cues added to its source's own terms. */
export function withLearnedCues(index: ReadonlyMap<string, string[]>, lessons: MemoryLessons): Map<string, string[]> {
  const merged = new Map(index);
  for (const [source, cues] of lessons.hints) merged.set(source, [...new Set([...merged.get(source) ?? [], ...cues])]);
  return merged;
}

/** The runner's read-only status block: counts by signal and cause, the lessons in force, and the latest failures (by
 * update and cause; the quoted texts stay in the journal, which the inspection surface reads). */
export function memoryLearningReport(view: JournalView, operator: (item: Turn) => boolean) {
  const failures = memoryFailures(view, operator), lessons = memoryLessons(view, failures);
  const count = <K extends string>(key: (failure: MemoryFailure) => K) => failures.reduce((total, failure) =>
    ({ ...total, [key(failure)]: (total[key(failure)] ?? 0) + 1 }), {} as Partial<Record<K, number>>);
  return { failures: failures.length, bySignal: count(failure => failure.signal), byCause: count(failure => failure.cause),
    retrievalHints: lessons.hints.size, pinnedFacts: lessons.pinned.length,
    latest: failures.slice(-5).map(failure => ({ trigger: failure.triggerUpdate, asked: failure.asked.update, signal: failure.signal,
      cause: failure.cause })) };
}

/** One plain status line for the operator's pull "status" reply. */
export function memoryLearningLine(view: JournalView, operator: (item: Turn) => boolean): string {
  const report = memoryLearningReport(view, operator);
  if (!report.failures) return 'Memory failures: none recorded.';
  const causes = Object.entries(report.byCause).map(([cause, n]) => `${String(n)} ${cause.replaceAll('-', ' ')}`).join(', ');
  return `Memory failures: ${String(report.failures)} recorded (${causes}); learned: ${String(report.retrievalHints)} retrieval `
    + `hint${report.retrievalHints === 1 ? '' : 's'}, ${String(report.pinnedFacts)} pinned fact${report.pinnedFacts === 1 ? '' : 's'}.`;
}
