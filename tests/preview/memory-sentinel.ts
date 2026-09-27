/** The memory sentinel: one bounded, deterministic step before the model call
 * that picks which original journal turns (already covered by the rolling
 * summary) are quoted verbatim beside it. It reads only the in-memory journal
 * projection, so it adds no store and survives restarts with the journal.
 *
 * Plain word match on the new message alone misses the two commonest ways a
 * person refers back: a pronoun or ellipsis whose antecedent is in the turn
 * just before ("what would she want?"), and a paraphrase of something the
 * summary still names but no longer quotes ("the code for my gym cabinet" for a
 * "locker combination"). It also cannot answer "what did I tell you yesterday?".
 * The score strengthens distinctive question matches while the turn it
 * continues, touching summary sentences, and a named day can surface a source. */
import { bm25, terms } from '../../src/recall/lexical.js';

export interface SentinelTurn { readonly text: string; readonly at: number }
export interface SentinelInput {
  readonly message: string;
  /** The accepted turn immediately before the new one (user text and answer). */
  readonly previous?: string;
  /** The rolling summary covering the candidates; its sentences bridge paraphrase. */
  readonly summary?: string;
  readonly candidates: readonly SentinelTurn[];
  readonly now: number;
  readonly limit: number;
}

const hour = 3_600_000, day = 24 * hour;
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const counts: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

/** A window of send times named by the message. The operator's time zone is not
 * known, so every window is widened by at least half a day either side. */
export function namedWindow(message: string, now: number): { from: number; to: number } | null {
  const text = message.toLowerCase();
  const ago = /\b(\d{1,2}|one|two|three|four|five|six|seven) days? ago\b/u.exec(text);
  if (ago) { const n = counts[ago[1]!] ?? Number(ago[1]); return { from: now - (n + 1) * day, to: now - (n - 1) * day }; }
  if (/\b(yesterday|last night)\b/u.test(text)) return { from: now - 48 * hour, to: now - 12 * hour };
  if (/\b(today|tonight|this morning|this afternoon|this evening)\b/u.test(text)) return { from: now - 24 * hour, to: now };
  if (/\blast week\b/u.test(text)) return { from: now - 14 * day, to: now - 3 * day };
  const named = weekdays.findIndex(name => new RegExp(`\\b(on |last )?${name}\\b`, 'u').test(text));
  if (named >= 0) {
    const today = Math.floor(now / day), weekday = (today + 4) % 7; // 1970-01-01 was a Thursday
    const back = (weekday - named + 7) % 7 || 7, start = (today - back) * day;
    return { from: start - 12 * hour, to: start + day + 12 * hour };
  }
  return null;
}

/** Summary sentences sharing a content term with the message; at most three, most overlap first. */
function bridge(summary: string | undefined, query: ReadonlySet<string>): string[] {
  if (!summary || !query.size) return [];
  return summary.split(/(?<=[.!?])\s+|\n+/u).map(sentence => {
    const words = terms(sentence);
    return { words, overlap: new Set(words.filter(word => query.has(word))).size };
  }).filter(item => item.overlap > 0).sort((a, b) => b.overlap - a.overlap).slice(0, 3).flatMap(item => item.words);
}

/** Indices into `candidates`, best first, at most `limit`; empty when nothing relates. */
export function selectRecall(input: SentinelInput): number[] {
  if (!input.candidates.length || input.limit <= 0) return [];
  // Every message term is kept: a word that names a time may also be content
  // ("Night" the book, "Thursday" the band), so a named day only adds a boost.
  const message = terms(input.message);
  const window = namedWindow(input.message, input.now);
  const documents = input.candidates.map(turn => terms(turn.text));
  const score = new Array<number>(documents.length).fill(0);
  const add = (query: readonly string[], weight: number) => {
    for (const hit of bm25(query, documents)) score[hit.index]! += weight * hit.score;
  };
  // Boost a direct hit only when its question-term coverage is distinctive.
  // Shared words alone leave room for the preceding turn and summary to compete.
  const direct = bm25(message, documents);
  const mostMatched = direct.reduce((max, hit) => Math.max(max, hit.matched), 0);
  const leaders = direct.filter(hit => hit.matched === mostMatched).length;
  for (const hit of direct) score[hit.index]! += (leaders === 1 && hit.matched === mostMatched ? 4 : 1) * hit.score;
  add(input.previous ? terms(input.previous) : [], 0.5);
  add(bridge(input.summary, new Set(message)), 0.5);
  // A named day counts like one strong matching term, so it ranks alongside content.
  if (window) input.candidates.forEach((turn, index) => {
    if (turn.at >= window.from && turn.at <= window.to) score[index]! += 2;
  });
  return score.map((value, index) => ({ value, index })).filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value || b.index - a.index).slice(0, input.limit).map(item => item.index);
}

/** An exact subject/value overlap is only a packet signal. The model decides
 * whether the statements really conflict; neither this match nor its absence
 * changes memory. Clauses are deliberately narrow to avoid invented facts. */
export function statedFacts(text: string): { subject: string; value: string; quote: string }[] {
  const facts: { subject: string; value: string; quote: string }[] = [];
  const direct = text.replace(/```[\s\S]*?```/gu, '').replace(/^\s*>.*$/gmu, '');
  for (const match of direct.matchAll(/(?:^|[.!?]\s+|\n)\s*((?:my|the)\s+[\p{L}\p{N}'-]+(?:\s+[\p{L}\p{N}'-]+){0,5}\s+is\s+[^.!?\n]{1,100})/giu)) {
    const quote = match[1]!.trim().replace(/,\s+not\s+[^,]+$/iu, '').trim();
    // Removing a fenced example can join unrelated spans into a false quote.
    if (!text.includes(quote)) continue;
    const parts = /^(my|the)\s+(.+?)\s+is\s+(.+)$/iu.exec(quote);
    if (!parts) continue;
    const subject = `${parts[1]!.toLowerCase()} ${parts[2]!.toLowerCase().replace(/\s+/gu, ' ')}`;
    const value = parts[3]!.toLowerCase().replace(/\s+/gu, ' ').trim();
    if (value && !/[“"”]/u.test(quote)) facts.push({ subject, value, quote });
  }
  return facts.slice(0, 3);
}
