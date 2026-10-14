// A disposable, pinned read view. It never replaces admission or an authority projection.
import type { BoundaryContext, Result } from '../index.js';
import type { FactEnvelope } from './contracts.js';
import type { FactStorePort } from './store.js';
import { boundary, frozen, take } from './boundary.js';

export interface FactReadView<T> {
  readonly source: Readonly<{ count: number; tail: string | null }>;
  readonly projection: T;
  byKind(kind: string): readonly FactEnvelope[];
  byId(id: string): FactEnvelope | undefined;
}
/** Rebuild from the verified source, then publish one complete view. An interrupted or
 * refused rebuild cannot publish a partial index. No index file needs crash recovery:
 * after process loss, call again against the recovered fact store. `project` belongs to
 * the semantic owner (for example its open-work fold), not a new interpretation in P2.
 * Queries are explicitly as-of `source`; refresh at the consumer's read boundary.
 * Live authorization must continue through readForProjection(), not this evidence view. */
export function rebuildFactReadView<T>(store: Pick<FactStorePort, 'read'>, context: BoundaryContext,
  project: (facts: readonly FactEnvelope[]) => Result<T>): Result<FactReadView<T>> {
  return boundary('FactReadView', null, context, () => {
    const facts = [...take(store.read())];
    const kinds = new Map<string, FactEnvelope[]>(), ids = new Map<string, FactEnvelope>();
    for (const fact of facts) {
      const rows = kinds.get(fact.kind) ?? [];
      if (!kinds.has(fact.kind)) kinds.set(fact.kind, rows);
      rows.push(fact); ids.set(fact.id, fact);
    }
    const projection = take(project(frozen(facts)));
    for (const rows of kinds.values()) frozen(rows);
    const empty: readonly FactEnvelope[] = Object.freeze([]);
    return Object.freeze({ source: Object.freeze({ count: facts.length, tail: facts.at(-1)?.contentHash ?? null }),
      projection, byKind: (kind: string) => kinds.get(kind) ?? empty, byId: (id: string) => ids.get(id) });
  });
}
