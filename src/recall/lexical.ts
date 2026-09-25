// Offline, deterministic, zero-spend retrieval. Ports 1.x SemanticMemory's proven shape:
// porter-style stemming + BM25 ranking, strict (all terms) first and a loose (any term)
// widening only when strict finds nothing — with the strategy recorded, never silent.

const stopwords = new Set(('a about above after again all am an and any are as at be been before being below between both but by '
  + 'can could did do does doing down during each few for from further had has have having he her here hers him his how i if in '
  + 'into is it its itself just me more most my no nor not now of off on once only or other our ours out over own same she should '
  + 'so some such than that the their theirs them then there these they this those through to too under until up very was we '
  + 'were what when where which while who whom why will with would you your yours yourself remember recall said say says tell told '
  + 'earlier previously ago mention mentioned talk talked discuss discussed').split(' '));

const vowel = /[aeiouy]/;
/** Light suffix stemmer. Linguistic precision matters less than applying the same function
 * to the query and the stored text. */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 3) return w;
  if (w.endsWith("'s")) w = w.slice(0, -2);
  const rules: readonly [string, string][] = [['ational', 'ate'], ['ization', 'ize'], ['fulness', 'ful'], ['ousness', 'ous'],
    ['iveness', 'ive'], ['sses', 'ss'], ['ies', 'y'], ['ments', ''], ['ment', ''], ['ness', ''], ['ingly', ''], ['edly', ''],
    ['ing', ''], ['ed', ''], ['ly', '']];
  for (const [suffix, replacement] of rules) {
    if (!w.endsWith(suffix)) continue;
    const base = w.slice(0, -suffix.length) + replacement;
    if (base.length < 3 || !vowel.test(base)) continue;
    w = base;
    // running -> run, stopped -> stop
    if ((suffix === 'ing' || suffix === 'ed') && /([^aeiouslz])\1$/.test(w)) w = w.slice(0, -1);
    break;
  }
  if (/(?:x|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith('s') && !/(?:ss|us|is)$/.test(w) && w.length > 3) w = w.slice(0, -1);
  if (w.endsWith('e') && w.length > 4) w = w.slice(0, -1);
  return w;
}
export function terms(text: string, max = Number.MAX_SAFE_INTEGER): string[] {
  const out: string[] = [];
  for (const m of text.toLowerCase().matchAll(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu)) {
    const token = m[0]!;
    if (token.length < 2 || stopwords.has(token)) continue;
    out.push(stem(token));
    if (out.length >= max) break;
  }
  return out;
}

export interface Scored { readonly index: number; readonly score: number; readonly matched: number }
/** BM25 (k1 = 1.2, b = 0.75) over `documents`, the bounded scanned set; `matched` counts
 * distinct query terms present (coordinate match), used to rank coverage before weight. */
export function bm25(queryTerms: readonly string[], documents: readonly (readonly string[])[]): Scored[] {
  const unique = [...new Set(queryTerms)];
  if (!unique.length || !documents.length) return [];
  const n = documents.length;
  const avg = documents.reduce((s, d) => s + d.length, 0) / n || 1;
  const counts = documents.map(d => { const m = new Map<string, number>(); for (const t of d) m.set(t, (m.get(t) ?? 0) + 1); return m; });
  const df = new Map(unique.map(t => [t, counts.filter(c => c.has(t)).length]));
  const scored: Scored[] = [];
  counts.forEach((c, index) => {
    const present = unique.filter(t => c.has(t));
    if (!present.length) return;
    let score = 0;
    for (const t of present) {
      const f = c.get(t)!, idf = Math.log(1 + (n - df.get(t)! + 0.5) / (df.get(t)! + 0.5));
      score += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * documents[index]!.length / avg));
    }
    scored.push({ index, score, matched: present.length });
  });
  return scored;
}
