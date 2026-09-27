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
 * The query here is therefore the new message, plus at half weight the turn it
 * continues and the summary sentences it touches, plus any day it names. */
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

/** Calendar days for a question about what the operator said. The runner's
 * configured zone gives relative words and journal send times the same clock. */
export function saidDateRange(message: string, now: number, timeZone = 'UTC'): { from: string; to: string } | null {
  if (!/\b(?:what|which|anything|remember|recall)\b[\s\S]*\b(?:i|we)\b[\s\S]*\b(?:said|say|told|tell|asked|ask|wrote|sent|send|mentioned|mention)\b/iu.test(message)) return null;
  const dayOf = (at: number) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
    const part = (type: string) => parts.find(item => item.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
  const shifted = (day: string, count: number) => new Date(Date.parse(`${day}T00:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10);
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const explicit = [...message.matchAll(/\b\d{4}-\d{2}-\d{2}\b/gu)].map(match => match[0]!);
  const lower = message.toLowerCase();
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const today = dayOf(now);
  const namedDates = [...lower.matchAll(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gu)]
    .map(match => `${match[3] ?? today.slice(0, 4)}-${String(months.indexOf(match[1]!.slice(0, 3)) + 1).padStart(2, '0')}-${match[2]!.padStart(2, '0')}`);
  const numericDates = [...lower.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/gu)]
    .map(match => `${match[3]}-${match[1]!.padStart(2, '0')}-${match[2]!.padStart(2, '0')}`);
  const ago = /\b(\d{1,2}|one|two|three|four|five|six|seven) days? ago\b/u.exec(lower);
  const yesterday = /\b(yesterday|last night)\b/u.test(lower);
  const todayWord = /\b(today|tonight|this morning|this afternoon|this evening)\b/u.test(lower);
  const lastWeek = /\blast week\b/u.test(lower);
  const namedWeekdays = weekdays.filter(name => new RegExp(`\\b(?:on |last )?${name}\\b`, 'u').test(lower));
  // A date in the subject can compete with the date of speech. Never turn a
  // mixed or partially parsed question into a restrictive evidence filter.
  if ([explicit.length > 0, namedDates.length > 0, numericDates.length > 0, !!ago,
    yesterday, todayWord, lastWeek, namedWeekdays.length > 0].filter(Boolean).length > 1
    || namedWeekdays.length > 1) return null;
  if (/\b(?:between|from)\b/iu.test(message)
    && explicit.length + namedDates.length + numericDates.length + namedWeekdays.length < 2) return null;
  if (explicit.length) {
    if (explicit.length > 2 || explicit.some(day => !valid(day))) return null;
    const [from, to = from] = explicit;
    return from! <= to! ? { from: from!, to: to! } : null;
  }
  if (namedDates.length) {
    if (namedDates.length > 2 || namedDates.some(day => !valid(day))) return null;
    const [from, to = from] = namedDates;
    return from! <= to! ? { from: from!, to: to! } : null;
  }
  if (numericDates.length) {
    if (numericDates.length > 2 || numericDates.some(day => !valid(day))) return null;
    const [from, to = from] = numericDates;
    return from! <= to! ? { from: from!, to: to! } : null;
  }
  if (ago) { const n = counts[ago[1]!] ?? Number(ago[1]); const day = shifted(today, -n); return { from: day, to: day }; }
  if (yesterday) { const day = shifted(today, -1); return { from: day, to: day }; }
  if (todayWord) return { from: today, to: today };
  if (lastWeek) {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const from = shifted(today, -(weekday === 0 ? 6 : weekday - 1) - 7);
    return { from, to: shifted(from, 6) };
  }
  const named = weekdays.indexOf(namedWeekdays[0] ?? '');
  if (named < 0) return null;
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const back = (weekday - named + 7) % 7 || 7, day = shifted(today, -back);
  return { from: day, to: day };
}

/** In-range original turns, relevant text first and then most recent. A miss
 * stays a bounded search result, never a claim that nothing was said. */
export function selectSaidTurns(message: string, candidates: readonly SentinelTurn[], now: number, timeZone: string, limit: number) {
  const range = saidDateRange(message, now, timeZone);
  if (!range) return null;
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dated = candidates.flatMap((turn, index) => {
    if (!Number.isFinite(turn.at) || turn.at <= 0) return [];
    const parts = formatter.formatToParts(turn.at), part = (type: string) => parts.find(item => item.type === type)!.value;
    const day = `${part('year')}-${part('month')}-${part('day')}`;
    return day >= range.from && day <= range.to ? [{ index, at: turn.at }] : [];
  });
  const scores = bm25(terms(message), dated.map(item => terms(candidates[item.index]!.text)));
  const byIndex = new Map(scores.map(item => [dated[item.index]!.index, item.score]));
  dated.sort((a, b) => (byIndex.get(b.index) ?? 0) - (byIndex.get(a.index) ?? 0) || b.at - a.at);
  return { ...range, matched: dated.length, indices: dated.slice(0, limit).map(item => item.index) };
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
  add(message, 1);
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
  for (const match of direct.matchAll(/(?:^|[.!?]\s+|\n)\s*((?:my|the)\s+[\p{L}\p{N}'-]+(?:\s+[\p{L}\p{N}'-]+){0,5}\s+moved\s+from\s+[^.!?\n]{1,50}\s+to\s+[^.!?\n]{1,50})/giu)) {
    const quote = match[1]!.trim();
    if (!text.includes(quote) || /[“"”]/u.test(quote)) continue;
    const parts = /^((?:my|the)\s+.+?)\s+moved\s+from\s+.+?\s+to\s+(.+)$/iu.exec(quote);
    if (parts) facts.push({ subject: parts[1]!.toLowerCase().replace(/\s+/gu, ' '),
      value: `in ${parts[2]!.toLowerCase().trim()}`, quote });
  }
  return facts.slice(0, 3);
}
