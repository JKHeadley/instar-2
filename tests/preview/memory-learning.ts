/** Memory-failure recording and the structural repair it drives (plan row #404; the operator's
 * 2026-09-13 direction: record what memory got wrong, then change behaviour because of it).
 *
 * Nothing here is stored beside the journal. Every value below is derived from the durable rows
 * replay already rebuilds -- the operator's correction, and the recorded grounding of the answer
 * it corrected -- so a failure survives restart because its evidence does, and no second store can
 * drift from the first (Rules 2, 7, 26, 116).
 *
 * Part 21 section 9 governs the honesty of the reading: a user saying "I already told you" is an
 * intake observation and a candidate case, never automatic proof of a retrieval defect, and a stage
 * may be named only where its evidence supports it. So a correction whose answer's own grounding
 * shows no memory gap is recorded with cause `undetermined` rather than blamed on memory, and the
 * same section's three distinct records are kept distinct here: the original exchange (the journal
 * rows, never rewritten), the proposed explanation (`cause`, inferred), and the procedural repair
 * (the cues and the standing notes below).
 */
import { redact } from '../../src/recall/redact.js';
import { terms } from '../../src/recall/lexical.js';
import { CONCEPT_TERMS_LIMIT, continuityFrontier, operatorWriter, probeTurn, proposedConceptTerms,
  type JournalView, type MemoryChange, type ReplyGrounding, type Turn } from './journal.js';

/** The stage the evidence points at, in the brief's words; `stage` maps each to Part 21 section 9's
 * vocabulary so a reading can be compared with that design's measurement. `undetermined` is the
 * honest fourth answer: a correction happened and the answer's grounding shows no memory gap. */
export type MemoryFailureCause = 'not-retrieved' | 'summarized-away' | 'never-stored' | 'wrongly-stored' | 'undetermined';
const STAGE: Readonly<Record<MemoryFailureCause, string>> = Object.freeze({
  'not-retrieved': 'selection', 'summarized-away': 'index', 'never-stored': 'capture',
  'wrongly-stored': 'reader-use', undetermined: 'unassessable' });

/** What memory handed the failing answer, counted from that answer's own recorded grounding. */
export interface MemoryReturned {
  readonly history: number; readonly recalled: number; readonly candidates: number;
  readonly channelItems: number; readonly corrections: number;
  /** The frontier below which this answer had no verbatim history, with how it was lost. */
  readonly frontier?: { readonly through: number; readonly basis: string };
  /** The answer model's own search, when it ran one: the words it searched and how many it found. */
  readonly lookupWords?: readonly string[]; readonly lookupFound?: number;
}
export interface MemoryFailure {
  /** The turn whose reply memory got wrong. */
  readonly answer: string;
  /** The operator message that corrected it. */
  readonly trigger: string;
  readonly at: number;
  /** What that answer was asked (redacted, bounded). */
  readonly asked: string;
  readonly returned: MemoryReturned;
  /** The record the evidence names as missed or wrongly held; absent when none resolves. */
  readonly missed?: string;
  /** What the operator said was true (redacted, bounded). */
  readonly truth: string;
  /** Inferred, never asserted: see the file note and Part 21 section 9. */
  readonly cause: MemoryFailureCause;
  readonly stage: string;
  /** Whether a retrieval hint may be derived from this failure: false where the named record is the
   * superseded one, which must never be promoted in the ranking. */
  readonly hintable: boolean;
}

/** Bounds (Rules 55, 60). Cue sources are capped so a long conversation cannot grow the derived
 * index without end; the newest failures keep their hints, because they are the live ones. The
 * read bound is newest-first for the same reason, and what it leaves out is said rather than
 * dropped quietly (Rule 2): a conversation past the bound must not silently stop learning. */
export const MEMORY_FAILURE_LIMIT = 200;
export const MEMORY_FAILURE_CUE_SOURCES = 32;
/** A cause is only worth a standing note once it has happened more than once: a single miss is an
 * incident, a repeat is the defect (Rule 24). */
export const MEMORY_LEARNING_THRESHOLD = 2;
export const MEMORY_LEARNING_LIMIT = 2;
const ASKED_MAX = 300, TRUTH_MAX = 300;

const remembered = (view: JournalView, turn: Turn) => turn.accepted && !probeTurn(view, turn);
const operatorStated = (view: JournalView, turn: Turn) => remembered(view, turn) && operatorWriter(view, turn, true);
const bounded = (value: string, max: number) => {
  const text = redact(value).text.replace(/\s+/gu, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
};
/** Every id the packet carried as evidence. Ids, never indexes: an undo can renumber `view.memory`,
 * so a position recorded in an older grounding is not a durable claim about what was shown. */
const carriedIds = (grounding: ReplyGrounding) => new Set<string>([...grounding.history, ...grounding.recalled,
  ...grounding.people, ...grounding.channelItems, ...grounding.corrections, ...grounding.memoryCandidates]);

/** The content words of a question, as a writer's proposed index terms would carry them: each word
 * the lexical stage keeps, in order, deduplicated and bounded by the same validator the write-side
 * index uses. Stemming happens at ranking time, so the raw word is what is stored. */
export function questionCueTerms(asked: string): string[] | undefined {
  const found: string[] = [];
  for (const word of redact(asked).text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []) {
    if (found.length >= CONCEPT_TERMS_LIMIT) break;
    if (terms(word).length !== 1 || found.includes(word)) continue;
    found.push(word);
  }
  return proposedConceptTerms(found);
}

/** The answer a correction is about, and the record its evidence names.
 *  - A **reply correction** (`in: 'reply'`) is the one shape that says plainly the agent got it
 *    wrong: the operator is correcting what the agent itself said. It names the failing turn
 *    outright, and the record it missed is the earliest operator message that already said what the
 *    operator has now had to restate.
 *  - A **record correction** names a record memory held. That alone is not a memory failure: an
 *    operator restating a fact is usually changing it, and Part 21 section 9 is explicit that an
 *    "I already told you" is a candidate case, not proof of a retrieval defect. It is read as one
 *    only on the evidence that the preceding answer actually carried that record and was corrected
 *    anyway, and it never earns a retrieval hint: the record it names is the superseded one, and
 *    promoting that in the ranking would make memory worse, not better.
 *  - A **contradiction between memory and the journal** is not read here. The journal already
 *    detects it, puts the question to the operator and records the winner (`view.conflicts`), so it
 *    is surfaced and settled rather than lost; duplicating it here would count one event twice. */
function subjectOf(view: JournalView, change: MemoryChange, order: readonly Turn[]):
{ answer: Turn; missed?: string; hintable: boolean } | undefined {
  const trigger = view.turns.get(change.trigger);
  if (!trigger) return undefined;
  if (change.in === 'reply') {
    const answer = view.turns.get(change.source);
    if (!answer) return undefined;
    const truth = redact(change.replacement ?? '').text.trim();
    const missed = truth.length >= 8
      ? order.find(turn => turn.update < answer.update && operatorStated(view, turn)
        && redact(turn.text).text.includes(truth))
      : undefined;
    return { answer, ...(missed ? { missed: missed.id } : {}), hintable: true };
  }
  const answer = [...order].reverse().find(turn => turn.update < trigger.update && remembered(view, turn)
    && turn.grounding !== undefined && turn.intent !== undefined);
  if (!answer?.grounding || !carriedIds(answer.grounding).has(change.source)) return undefined;
  return { answer, missed: change.source, hintable: false };
}

/** The stage is read off the answer's own grounding, strongest evidence first, and never claimed past
 * what that evidence shows (Part 21 §9). A search that ran outranks a frontier that merely existed:
 * once the hidden history was searched and the record still did not come back, the loss is the
 * search's, not the summary's. */
function causeOf(view: JournalView, change: MemoryChange, answer: Turn, missed: string | undefined,
  earlier: readonly MemoryChange[]): MemoryFailureCause {
  const grounding = answer.grounding!;
  const frontier = continuityFrontier(grounding);
  const lookupEmpty = answer.lookup !== undefined && answer.lookup.found.length === 0;
  // Memory already held a version of this record and it was still wrong: no retrieval change repairs that.
  if (earlier.some(prior => prior.source === change.source)) return 'wrongly-stored';
  if (missed !== undefined) {
    if (carriedIds(grounding).has(missed)) return 'wrongly-stored';
    if (lookupEmpty) return 'not-retrieved';
    const turn = view.turns.get(missed);
    if (frontier !== undefined && (turn === undefined || turn.update <= frontier.through)) return 'summarized-away';
    return 'not-retrieved';
  }
  // No record holds what the operator has just said. A search that covered the hidden history and
  // came back with nothing is the only evidence this journal can offer that it was never kept.
  if (lookupEmpty) return 'never-stored';
  return frontier === undefined ? 'undetermined' : 'summarized-away';
}

/** Every memory-failure observation this journal supports, oldest first. A correction whose answer
 * recorded no grounding is not read at all: without the stage evidence there is nothing to diagnose
 * (Rule 26), and the correction itself stays durable where it already is. */
const replyCorrections = (view: JournalView) => {
  const all = view.memory.filter(change => change.mode === 'correct' && !change.historical);
  const considered = all.slice(-MEMORY_FAILURE_LIMIT);
  return { all, considered, olderNotRead: all.length - considered.length };
};
/** How many corrections lie behind the read bound. Zero on any conversation under the bound; above
 * it, the status surface says the number rather than letting the reading look complete. */
export const memoryFailureOlderNotRead = (view: JournalView): number => replyCorrections(view).olderNotRead;

export function memoryFailures(view: JournalView): readonly MemoryFailure[] {
  const found: MemoryFailure[] = [];
  const { all, considered, olderNotRead } = replyCorrections(view);
  for (const [index, change] of considered.entries()) {
    const subject = subjectOf(view, change, view.order);
    if (!subject?.answer.grounding) continue;
    const { answer, missed, hintable } = subject;
    const trigger = view.turns.get(change.trigger)!;
    // The wrongly-stored test needs every earlier correction, including ones behind the read bound.
    const cause = causeOf(view, change, answer, missed, all.slice(0, olderNotRead + index));
    const grounding = subject.answer.grounding;
    const frontier = continuityFrontier(grounding);
    found.push({ answer: answer.id, trigger: change.trigger, at: trigger.at,
      asked: bounded(answer.text, ASKED_MAX),
      returned: { history: grounding.history.length, recalled: grounding.recalled.length,
        candidates: grounding.memoryCandidates.length, channelItems: grounding.channelItems.length,
        corrections: grounding.corrections.length,
        ...(frontier ? { frontier: { through: frontier.through, basis: frontier.basis } } : {}),
        ...(answer.lookup ? { lookupWords: [...answer.lookup.words], lookupFound: answer.lookup.found.length } : {}) },
      ...(missed === undefined ? {} : { missed }),
      truth: bounded(change.replacement ?? change.quote, TRUTH_MAX), cause, stage: STAGE[cause], hintable });
  }
  return found;
}

/** How much of a hint a query must share before the hint applies: half its words, and never fewer
 * than two. A repair is for the question that failed, not for any question that happens to share one
 * word with it -- an always-on hint displaces a correctly recalled record elsewhere, because the
 * owner's result set is fixed in size (the crowd-out the recall README names). */
export const MEMORY_CUE_MATCH_FLOOR = 2;
export const applicableCues = (learned: readonly string[], query: string): string[] => {
  const asked = new Set(terms(query, 64));
  const shared = learned.filter(term => { const stems = terms(term); return stems.length > 0 && stems.every(stem => asked.has(stem)); });
  return shared.length >= Math.max(MEMORY_CUE_MATCH_FLOOR, Math.ceil(learned.length / 2)) ? [...learned] : [];
};

/** The procedural repair, arm one: the words that failed to reach a record become that record's own
 * index terms, so the next question phrased the same way ranks it. Only the two causes a retrieval
 * change can repair earn one -- a record that was carried and still wrong is not found by searching
 * harder, and a record that was never stored cannot be found at all. */
export function memoryFailureCues(view: JournalView): Map<string, string[]> {
  const cues = new Map<string, string[]>();
  const eligible = memoryFailures(view).filter(failure => failure.hintable
    && (failure.cause === 'not-retrieved' || failure.cause === 'summarized-away'));
  for (const failure of eligible.slice(-MEMORY_FAILURE_CUE_SOURCES)) {
    const source = failure.missed ?? failure.trigger;
    const added = questionCueTerms(failure.asked);
    if (!added) continue;
    const held = cues.get(source) ?? [];
    cues.set(source, [...held, ...added.filter(term => !held.includes(term))].slice(0, CONCEPT_TERMS_LIMIT));
  }
  return cues;
}

export interface MemoryLearning { readonly cause: MemoryFailureCause; readonly occurrences: number; readonly guidance: string }
/** Fixed text, not model-authored: a standing note costs nothing to produce and says the same thing
 * every time, so what the agent carries cannot drift from what was measured. */
const GUIDANCE: Readonly<Record<MemoryFailureCause, string>> = Object.freeze({
  'not-retrieved': 'Answers have missed facts that were on record and reachable. Before answering from memory alone, take the memory lookup when this packet offers one, and say plainly when you are not certain.',
  'summarized-away': 'Answers have missed facts only the rolling summary still covered. When the question is about something older than this packet’s verbatim history, take the memory lookup rather than answering from the summary alone.',
  'never-stored': 'The complete record was searched and the fact was not there. Say you have no record of it rather than inferring one.',
  'wrongly-stored': 'Facts memory held have turned out to be wrong. Prefer the operator’s most recent statement, and say which record you are using.',
  undetermined: '' });

/** The procedural repair, arm two: a cause that has happened more than once becomes a standing note
 * the answer packet carries, so the next answer is shaped by what the last ones got wrong. */
export function memoryLearnings(view: JournalView): readonly MemoryLearning[] {
  const counts = new Map<MemoryFailureCause, number>();
  for (const failure of memoryFailures(view)) {
    if (failure.cause === 'undetermined') continue;
    counts.set(failure.cause, (counts.get(failure.cause) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count >= MEMORY_LEARNING_THRESHOLD)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, MEMORY_LEARNING_LIMIT)
    .map(([cause, occurrences]) => ({ cause, occurrences, guidance: GUIDANCE[cause] }));
}

/** The pull surface (Rule 87): memory health is read, never pushed. The first line is unconditional,
 * so "none" is itself a reading and an empty record is not indistinguishable from an absent one. */
export function memoryFailureStatusLines(view: JournalView): string[] {
  const failures = memoryFailures(view);
  const counts = new Map<MemoryFailureCause, number>();
  for (const failure of failures) counts.set(failure.cause, (counts.get(failure.cause) ?? 0) + 1);
  const detail = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([cause, count]) => `${count} ${cause.replace(/-/gu, ' ')}`);
  const cues = memoryFailureCues(view);
  const learnings = memoryLearnings(view);
  const older = memoryFailureOlderNotRead(view);
  return [
    `Memory failures recorded: ${failures.length}${detail.length ? ` (${detail.join(', ')})` : ''}`
      + `${older ? `; ${older} older correction${older === 1 ? '' : 's'} not read` : ''}.`,
    ...(cues.size ? [`Retrieval hints in force: ${cues.size} record${cues.size === 1 ? '' : 's'}.`] : []),
    ...(learnings.length ? [`Standing memory notes: ${learnings.map(item => `${item.cause.replace(/-/gu, ' ')} (${item.occurrences})`).join(', ')}.`] : []),
  ];
}

/** The hints that apply to one query: the recall owner's view of arm one. A record whose hint the
 * query does not substantially share contributes nothing, so an unrelated question ranks exactly as
 * it did before any failure was recorded. */
export function memoryFailureCuesFor(view: JournalView, query: string): Map<string, string[]> {
  const applied = new Map<string, string[]>();
  for (const [source, learned] of memoryFailureCues(view)) {
    const shared = applicableCues(learned, query);
    if (shared.length) applied.set(source, shared);
  }
  return applied;
}
