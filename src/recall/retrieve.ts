// Recall: find the relevant earlier exchanges. Scoring, results, rerank candidates and text are
// bounded; reading is not: each query reads and decodes the whole store and sorts every eligible
// exchange (O(R log R), memory grows with history). An enforced storage envelope or a bounded
// part-two read path is an activation dependency. Offline lexical first stage, optional
// spend-gated semantic rerank. Recall never decides reveal.
import type { BoundaryContext, Result } from '../index.js';
import { consumeResult } from '../index.js';
import { boundary, ensure, take } from './boundary.js';
import { readExchange } from './exchange.js';
import { bm25, terms } from './lexical.js';
import { redact } from './redact.js';
import { defaultRecallBounds, recallExchangeKind } from './contracts.js';
import type { RecallBounds, RecallHit, RecallManifest, RecallQuery, RecallReader, RecallRerankPort, RecallResult, RecallSpendPort, RecalledExchange } from './contracts.js';

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
/**
 * Rerank candidates: at most half are first-stage lexical matches; then candidates the derived
 * index matched (`derived`, best first); the rest are other candidates spread evenly across the
 * whole range, so a semantic reranker can reach older evidence that shares no words with the
 * query even when matches fill the budget. Unused room goes back to lexical matches.
 */
export function rerankPool(lexical: readonly number[], total: number, max: number, derived: readonly number[] = []): number[] {
  const lexicalSlots = Math.min(lexical.length, Math.ceil(max / 2));
  const candidates = lexical.slice(0, lexicalSlots);
  for (const i of derived) if (candidates.length < max && !candidates.includes(i)) candidates.push(i);
  const taken = new Set([...lexical, ...candidates]);
  const others = Array.from({ length: total }, (_, i) => i).filter(i => !taken.has(i));
  const room = max - candidates.length;
  if (others.length <= room) candidates.push(...others);
  else for (let k = 0; k < room; k++) candidates.push(others[Math.floor(k * others.length / room)]!);
  for (const i of lexical.slice(lexicalSlots)) if (candidates.length < max) candidates.push(i);
  return candidates;
}

const snippet = (e: RecalledExchange, max: number) => {
  const text = redact(e.text).text;
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
};

function prepare(query: RecallQuery, reader: RecallReader): Result<Prepared> {
  return boundary('RecallPrepare', query, reader.context, () => {
    ensure(typeof query.text === 'string' && query.text.length <= 4000, 'query: text of at most 4000 characters required', 'policy');
    const bounds = resolveBounds(query.bounds);
    // Exclusions carry the same identity as capture: (conversation, messageId). Provider ids
    // repeat across conversations, so a bare message id would silently hide unrelated memory.
    const excluded = query.exclude ?? [];
    ensure(Array.isArray(excluded) && excluded.length <= 64 && excluded.every(x => x !== null && typeof x === 'object'
      && typeof x.conversation === 'string' && typeof x.messageId === 'string'), 'exclude: bounded list of {conversation, messageId} required', 'policy');
    const exclude = new Set(excluded.map(x => `${x.conversation}\n${x.messageId}`));
    const facts = take(reader.store.read());
    let stored = 0, unreadable = 0;
    const all: { e: RecalledExchange; order: number }[] = [];
    facts.forEach((fact, order) => {
      if (fact.kind !== recallExchangeKind) return;
      stored++;
      const e = readExchange(fact);
      if (!e) { unreadable++; return; }
      if (!exclude.has(`${e.conversation}\n${e.messageId}`)) all.push({ e, order });
    });
    // Newest first; `maxScan` bounds how many of the most recent exchanges are scored, not read.
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
    const candidates = rerankPool(lexical.map(s => s.index), scanned.length, bounds.maxRerankCandidates);
    // Everything handed to a model is redacted: the query and every candidate field.
    return { scanned, lexical, candidates, bounds, queryText: redact(query.text).text,
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
          const e = p.scanned[i]!; return `${redact(e.speakerName).text} (${e.speakerRole}): ${snippet(e, p.bounds.maxCharsPerExchange)}`;
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

/** One candidate an in-memory driver hands the owner. `cues` are write-side derived index terms
 * (Part 21 §6: generated search keys for an original); they only rank, and are never evidence.
 * `indexable` marks a candidate the derived index is meant to cover. */
export interface ComposeCandidate { readonly text: string; readonly cues?: readonly string[]; readonly indexable?: boolean }
export interface ComposeInput {
  readonly query: string;
  /** The driver's first-stage lexical order over `candidates` (indexes, best first). */
  readonly lexical: readonly number[];
  readonly candidates: readonly ComposeCandidate[];
  readonly maxResults: number;
  readonly maxRerankCandidates?: number;
  /** Optional semantic stage. Only a synchronous answer is used here; a pending one counts as failed. */
  readonly reranker?: RecallRerankPort;
  readonly spend?: RecallSpendPort;
  readonly stopped: () => boolean;
}
export interface ComposedRecall {
  /** Candidate indexes, best first, at most `maxResults`. */
  readonly order: readonly number[];
  readonly rerank: RecallManifest['rerank']; readonly charge: number;
  /** Indexable candidates, how many carry derived cues, and whether meaning coverage is complete. */
  readonly coverage: { readonly indexable: number; readonly indexed: number };
  readonly disposition: 'complete' | 'degraded';
}

/**
 * The recall owner's composition for a driver that already holds a bounded candidate set in
 * memory (the preview journal's projection). Three stages, fused by declared rank interleaving
 * because scores from unlike engines are not comparable (Part 21 §4), in this order: an optional
 * spend-gated semantic rerank of a `rerankPool`, the driver's lexical order, and the derived-index
 * order (query terms against each candidate's generated cues). A reranker with a charge is never called while
 * stopped or without a reserved charge; a zero-charge port is pure local computation. Coverage is
 * reported, and a candidate the index was meant to cover but does not is a degraded disposition:
 * a miss over it is a word-match miss, never evidence of absence.
 */
export function composeRecall(input: ComposeInput): ComposedRecall {
  const total = input.candidates.length;
  const max = Math.min(input.maxRerankCandidates ?? defaultRecallBounds.maxRerankCandidates, ceilings.maxRerankCandidates);
  const lexical = input.lexical.filter((i, k, all) => Number.isSafeInteger(i) && i >= 0 && i < total && all.indexOf(i) === k);
  const q = terms(input.query, 32);
  const derived = bm25(q, input.candidates.map(c => c.cues?.length ? terms(c.cues.join(' ')) : []))
    .sort((a, b) => b.matched - a.matched || b.score - a.score || b.index - a.index).map(s => s.index);
  let rerank: RecallManifest['rerank'] = 'not-configured', charge = 0, semantic: readonly number[] = [];
  const reranker = input.reranker;
  if (reranker) {
    const pool = rerankPool(lexical, total, max, derived);
    if (!pool.length) rerank = 'not-needed';
    else if (!(reranker.chargePerCall >= 0)) rerank = 'over-budget';
    else if (reranker.chargePerCall > 0 && input.stopped()) rerank = 'stopped';
    // Spend floor: no spend port means no authority to spend; fail closed on spend, open on recall.
    else if (reranker.chargePerCall > 0 && (!input.spend || !input.spend.reserve(reranker.chargePerCall))) rerank = 'over-budget';
    else {
      charge = reranker.chargePerCall;
      let order: readonly number[] | undefined;
      try {
        const answer = reranker.rerank(redact(input.query).text, pool.map(i => redact(input.candidates[i]!.text).text));
        if (answer instanceof Promise) answer.catch(() => undefined);
        else order = consumeResult<readonly number[], readonly number[] | undefined>(answer, { Success: v => v, Refused: () => undefined });
      } catch { order = undefined; }
      const valid = Array.isArray(order) && order.every(i => Number.isSafeInteger(i) && i >= 0 && i < pool.length)
        && new Set(order).size === order.length;
      rerank = valid ? 'used' : 'failed';
      if (valid) semantic = order!.map(i => pool[i]!);
    }
  }
  const lists = [semantic, lexical, derived].filter(list => list.length);
  const order: number[] = [];
  for (let k = 0; order.length < input.maxResults && lists.some(list => k < list.length); k++)
    for (const list of lists) {
      const i = list[k];
      if (i !== undefined && !order.includes(i) && order.length < input.maxResults) order.push(i);
    }
  const indexable = input.candidates.filter(c => c.indexable).length;
  const indexed = input.candidates.filter(c => c.indexable && c.cues?.length).length;
  return { order, rerank, charge, coverage: { indexable, indexed },
    disposition: indexed === indexable && rerank !== 'failed' ? 'complete' : 'degraded' };
}
