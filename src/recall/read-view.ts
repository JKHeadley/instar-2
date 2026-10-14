// Indexes are local evidence caches. Signed facts remain the sole history.
import type { BoundaryContext, Result } from '../index.js';
import { rebuildFactReadView } from '../facts/read-view.js';
import type { FactReadView } from '../facts/read-view.js';
import type { FactEnvelope, FactStorePort } from '../facts/index.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { readExchange } from './exchange.js';
import { recallExchangeKind } from './contracts.js';
import type { RecallQuery, RecalledExchange } from './contracts.js';

export interface ExchangeSlice {
  readonly stored: number; readonly unreadable: number;
  readonly scanned: readonly RecalledExchange[];
}
export interface RecallReadView {
  readonly store: FactStorePort;
  readonly source: FactReadView<unknown>['source'];
  latest(conversation: string, limit: number): Result<readonly RecalledExchange[]>;
  select(limit: number, exclude: NonNullable<RecallQuery['exclude']>): Result<ExchangeSlice>;
}
export interface ConversationReadView<T> extends RecallReadView {
  /** Owner-folded work, indexed once per refresh; null is never confused with no work. */
  work(conversation: string): readonly T[];
}
export interface WorkReadProjection<T> {
  /** Must fold the supplied source only. No fresh independent read during publication. */
  fold(facts: readonly FactEnvelope[]): Result<readonly T[]>;
  conversation(work: T): string;
}
/** A single atomic rebuild publishes message and owner-folded work indexes from the same
 * verified source. Supply the existing work owner's fold; this module does not decide
 * what is open, completed, cancelled or uncertain. Cold rebuild is O(history); hot
 * reads visit only the requested output / maxScan window plus excluded identities.
 * Existing readers retain their explicit old source across refresh, never half a view. */
export function rebuildConversationReadView<T>(store: FactStorePort, context: BoundaryContext,
  work: WorkReadProjection<T>): Result<ConversationReadView<T>> {
  return boundary('ConversationReadView', null, context, () => {
    const built = take(rebuildFactReadView(store, context, facts => boundary('ConversationReadProjection', null, context, () => {
      const ordered: { exchange: RecalledExchange; order: number }[] = [];
      let stored = 0, unreadable = 0;
      facts.forEach((fact, order) => {
        if (fact.kind !== recallExchangeKind) return;
        stored++;
        const exchange = readExchange(fact);
        if (exchange) ordered.push({ exchange, order }); else unreadable++;
      });
      ordered.sort((a, b) => b.exchange.at - a.exchange.at || b.order - a.order);
      return { stored, unreadable, ordered: ordered.map(row => row.exchange), work: take(work.fold(facts)) };
    })));
    const p = built.projection;
    const conversations = new Map<string, RecalledExchange[]>(), works = new Map<string, T[]>();
    for (const row of p.ordered) {
      const rows = conversations.get(row.conversation) ?? [];
      if (!conversations.has(row.conversation)) conversations.set(row.conversation, rows);
      rows.push(row);
    }
    for (const row of p.work) {
      const key = work.conversation(row), rows = works.get(key) ?? [];
      if (!works.has(key)) works.set(key, rows);
      rows.push(row);
    }
    for (const rows of conversations.values()) freeze(rows);
    for (const rows of works.values()) freeze(rows);
    const empty: readonly T[] = Object.freeze([]);
    const validLimit = (limit: number) => ensure(Number.isSafeInteger(limit) && limit >= 0 && limit <= 50_000,
      'read limit: integer within 0..50000 required', 'policy');
    return Object.freeze({ store, source: built.source,
      work: (conversation: string) => works.get(conversation) ?? empty,
      latest: (conversation: string, limit: number) => boundary('ConversationLatest', null, context, () => {
        validLimit(limit); return (conversations.get(conversation) ?? []).slice(0, limit);
      }),
      select: (limit: number, exclude: NonNullable<RecallQuery['exclude']>) => boundary('ConversationSelect', null, context, () => {
        validLimit(limit);
        ensure(Array.isArray(exclude) && exclude.length <= 64 && exclude.every(x => x !== null && typeof x === 'object'
          && typeof x.conversation === 'string' && typeof x.messageId === 'string'), 'invalid exchange exclusions', 'policy');
        const excluded = new Set(exclude.map(x => `${x.conversation}\n${x.messageId}`));
        const scanned: RecalledExchange[] = [];
        for (const row of p.ordered) {
          if (scanned.length === limit) break;
          if (!excluded.has(`${row.conversation}\n${row.messageId}`)) scanned.push(row);
        }
        return { stored: p.stored, unreadable: p.unreadable, scanned };
      }) });
  });
}
