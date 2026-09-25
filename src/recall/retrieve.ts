// Recall: find the relevant earlier exchanges. Bounded (scan/k/candidate caps), offline
// lexical first stage, optional spend-gated semantic rerank. Recall never decides reveal.
import type { BoundaryContext, Result } from '../index.js';
import { consumeResult } from '../index.js';
import { boundary, ensure, take } from './boundary.js';
import { readExchange } from './exchange.js';
import { bm25, terms } from './lexical.js';
import { redact } from './redact.js';
import { defaultRecallBounds, recallExchangeKind } from './contracts.js';
import type { RecallBounds, RecallHit, RecallManifest, RecallQuery, RecallReader, RecallResult, RecalledExchange } from './contracts.js';

const ceilings: RecallBounds = { maxScan: 50_000, maxResults: 50, maxRerankCandidates: 50, maxChars: 20_000, maxCharsPerExchange: 4000 };
export function resolveBounds(partial: Partial<RecallBounds> = {}): RecallBounds {
  const out = { ...defaultRecallBounds, ...partial };
  for (const k of Object.keys(ceilings) as (keyof RecallBounds)[])
    ensure(Number.isSafeInteger(out[k]) && out[k] >= 0 && out[k] <= ceilings[k], `${k}: integer within 0..${ceilings[k]} required`, 'policy');
  return out;
}

interface Prepared {
  readonly scanned: readonly RecalledExchange[]; readonly lexical: readonly { index: number; score: number; matched: number }[];
  readonly candidates: readonly number[]; readonly bounds: RecallBounds; readonly queryText: string;
  readonly manifest: Omit<RecallManifest, 'rerank' | 'charge'>;
}
const snippet = (e: RecalledExchange, max: number) => {
  const text = redact(e.text).text;
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
};

function prepare(query: RecallQuery, reader: RecallReader): Result<Prepared> {
  return boundary('RecallPrepare', query, reader.context, () => {
    ensure(typeof query.text === 'string' && query.text.length <= 4000, 'query: text of at most 4000 characters required', 'policy');
    const bounds = resolveBounds(query.bounds);
    const exclude = new Set(query.excludeMessageIds ?? []);
    const facts = take(reader.store.read());
    let stored = 0, unreadable = 0;
    const all: { e: RecalledExchange; order: number }[] = [];
    facts.forEach((fact, order) => {
      if (fact.kind !== recallExchangeKind) return;
      stored++;
      const e = readExchange(fact);
      if (!e) { unreadable++; return; }
      if (!exclude.has(e.messageId)) all.push({ e, order });
    });
    // Newest first; the bounded scan keeps the most recent `maxScan` exchanges.
    all.sort((a, b) => b.e.at - a.e.at || b.order - a.order);
    const scanned = all.slice(0, bounds.maxScan).map(x => x.e);
    const q = terms(query.text, 32);
    const docs = scanned.map(e => terms(`${e.speakerName} ${e.text}`));
    // Coverage first, then weight, then recency (scanned is newest-first). When some exchange
    // matches every query term (strict), partial matches must cover at least half the terms;
    // otherwise any-term matches are admitted and the widening is recorded, never silent.
    const unique = new Set(q).size;
    const matches = bm25(q, docs);
    const strict = matches.some(s => s.matched === unique);
    const floor = strict ? Math.ceil(unique / 2) : 1;
    const lexical = matches.filter(s => s.matched >= floor)
      .sort((a, b) => b.matched - a.matched || b.score - a.score || a.index - b.index);
    const strategy: RecallManifest['strategy'] = !lexical.length ? 'none' : strict ? 'lexical-strict' : 'lexical-loose';
    // Rerank candidates: lexical matches, padded with the most recent exchanges so a
    // semantic reranker can find a relevant exchange that shares no words with the query.
    const candidates = lexical.slice(0, bounds.maxRerankCandidates).map(s => s.index);
    for (let i = 0; i < scanned.length && candidates.length < bounds.maxRerankCandidates; i++)
      if (!candidates.includes(i)) candidates.push(i);
    return { scanned, lexical, candidates, bounds, queryText: query.text,
      manifest: { strategy, stored, scanned: scanned.length, unreadable, matched: lexical.length } };
  });
}

/**
 * Recall exchanges relevant to `query`. Without a reranker (or when stopped, over budget,
 * or on reranker failure) the lexical ranking stands and the manifest says so.
 */
export async function recall(query: RecallQuery, reader: RecallReader): Promise<Result<RecallResult>> {
  const prepared = prepare(query, reader);
  const p = consumeResult(prepared, { Success: v => v, Refused: () => undefined });
  if (!p) return prepared as unknown as Result<RecallResult>;
  let rerank: RecallManifest['rerank'] = 'not-configured', charge = 0;
  let order: readonly number[] | undefined;
  const reranker = reader.reranker;
  if (reranker) {
    if (reader.stopped()) rerank = 'stopped';
    else if (!p.candidates.length || !p.manifest.scanned) rerank = 'not-needed';
    // Spend floor: no spend port means no authority to spend; fail closed on spend, open on recall.
    else if (!reader.spend || !(reranker.chargePerCall >= 0) || !reader.spend.reserve(reranker.chargePerCall)) rerank = 'over-budget';
    else {
      charge = reranker.chargePerCall;
      try {
        const answer = await reranker.rerank(p.queryText, p.candidates.map(i => {
          const e = p.scanned[i]!; return `${e.speakerName} (${e.speakerRole}): ${snippet(e, p.bounds.maxCharsPerExchange)}`;
        }));
        order = consumeResult(answer, { Success: v => v, Refused: () => undefined });
      } catch { order = undefined; }
      const valid = Array.isArray(order) && order.every(i => Number.isSafeInteger(i) && i >= 0 && i < p.candidates.length)
        && new Set(order).size === order.length;
      rerank = valid ? 'used' : 'failed';
      if (!valid) order = undefined;
    }
  }
  const c: BoundaryContext = reader.context;
  return boundary('RecallResult', null, c, () => {
    const lexicalScore = new Map(p.lexical.map(s => [s.index, s.score]));
    const ranked: number[] = [];
    if (order) for (const i of order) ranked.push(p.candidates[i]!);
    for (const s of p.lexical) if (!ranked.includes(s.index)) ranked.push(s.index);
    const hits: RecallHit[] = ranked.slice(0, p.bounds.maxResults)
      .map(index => ({ exchange: p.scanned[index]!, score: lexicalScore.get(index) ?? 0 }));
    return { hits, manifest: { ...p.manifest, rerank, charge } };
  });
}
