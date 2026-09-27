/** Match an exact quoted clause without treating a numbered value as its prefix. */
export function claimSpans(text, quote) {
  const starts = [];
  if (!quote) return starts;
  const word = /[\p{L}\p{N}_]/u;
  for (let at = text.indexOf(quote); at >= 0; at = text.indexOf(quote, at + 1)) {
    if (at > 0 && word.test(quote[0]) && word.test(text[at - 1])) continue;
    const end = at + quote.length;
    if (end < text.length && word.test(quote.at(-1)) && word.test(text[end])) continue;
    starts.push(at);
  }
  return starts;
}

export const hasClaim = (text, quote) => claimSpans(text, quote).length > 0;
export const replaceClaim = (text, quote, replacement) => claimSpans(text, quote)
  .reduceRight((result, at) => result.slice(0, at) + replacement + result.slice(at + quote.length), text);

/** A later change must cite the prior trigger and contain its replacement, or quote a clause inside it. */
export const supersedesCorrection = (change, next) => change.mode === 'correct' && next.source === change.trigger
  && (hasClaim(change.replacement, next.quote) || hasClaim(next.quote, change.replacement));
