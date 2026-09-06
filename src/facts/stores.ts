// Bounded local maintenance state, rules 4/46/60. Fact bytes live only in the append port.
import type { Json, RefusalReason, Result } from '../index.js';
import { boundary, encoding, requireFact } from './boundary.js';
import type { FactBoundary } from './boundary.js';
import type { ConflictClass } from './contracts.js';

export interface RefusalMetadata {
  readonly hash: string; readonly reason: RefusalReason; readonly source: string; readonly byteLength: number;
  readonly firstSeen: number; readonly lastSeen: number; readonly count: number;
}
export class RefusalStore {
  readonly #rows = new Map<string, RefusalMetadata>();
  readonly #aggregate = new Map<string, { count: number; firstSeen: number; lastSeen: number; reasons: Partial<Record<RefusalReason, number>> }>();
  constructor(readonly bound: number, readonly retention: number, readonly sourceBound: number) {
    requireFact(Number.isSafeInteger(bound) && bound > 0 && retention > 0 && sourceBound > 0, 'refusal store requires positive registered bounds');
  }
  record(input: { hash: string; reason: RefusalReason; source: string; byteLength: number }, now: number): void {
    // Copy an allowlist, never spread input: even a caller passing body bytes cannot retain them.
    const { hash, reason, source, byteLength } = input;
    const sourceKey = this.#aggregate.has(source) || this.#aggregate.size < this.sourceBound ? source : 'other-sources';
    const total = this.#aggregate.get(sourceKey) ?? { count: 0, firstSeen: now, lastSeen: now, reasons: {} };
    total.count++; total.lastSeen = now; total.reasons[reason] = (total.reasons[reason] ?? 0) + 1; this.#aggregate.set(sourceKey, total);
    for (const [k, v] of this.#rows) if (now - v.lastSeen > this.retention) this.#rows.delete(k);
    const key = `${hash}\u0000${reason}`, existing = this.#rows.get(key);
    if (!existing && this.#rows.size >= this.bound) this.#rows.delete(this.#rows.keys().next().value!);
    this.#rows.set(key, { hash, reason, source, byteLength, firstSeen: existing?.firstSeen ?? now, lastSeen: now, count: (existing?.count ?? 0) + 1 });
  }
  snapshot() { return { rows: [...this.#rows.values()].map(v => ({ ...v })), aggregates: [...this.#aggregate].map(([source, value]) => ({ source, ...value, reasons: { ...value.reasons } })) }; }
}
interface Pending { readonly key: string; readonly peer: string; readonly input: Json; readonly dependency: string; readonly since: number; readonly escalated: boolean }
export class PendingSet {
  readonly #items = new Map<string, Pending>();
  constructor(readonly bound: number, readonly peerBound: number, readonly ttl: number) {
    requireFact(Number.isSafeInteger(bound) && bound > 0 && peerBound > 0 && peerBound <= bound && ttl > 0, 'pending set requires registered positive bounds');
  }
  hold(input: Json, peer: string, dependency: string, now: number, context: FactBoundary): Result<'held' | 'duplicate'> {
    return boundary('PendingHold', input, context, safe => {
      const key = encoding(safe).hash; if (this.#items.has(key)) return 'duplicate';
      requireFact(this.#items.size < this.bound && [...this.#items.values()].filter(v => v.peer === peer).length < this.peerBound, 'pending capacity: return to replication for redelivery', 'budget-exhausted');
      this.#items.set(key, { key, peer, input: safe, dependency, since: now, escalated: false }); return 'held';
    });
  }
  ready(dependency: string): readonly Pending[] { return [...this.#items.values()].filter(p => p.dependency === dependency); }
  // Caller removes only after the actual admission acknowledgement, not on attempted retry.
  acknowledge(key: string, admittedHash: string): void { requireFact(key === admittedHash, 'pending acknowledgement hash mismatch'); this.#items.delete(key); }
  expire(now: number): readonly ConflictClass[] {
    const result: ConflictClass[] = [];
    for (const [key, p] of this.#items) if (!p.escalated && now - p.since >= this.ttl) {
      result.push({ key: `pending:${key}`, kind: 'pending-expired', facts: [], detail: `dependency ${p.dependency} from ${p.peer} exceeded hold TTL` });
      this.#items.set(key, { ...p, escalated: true });
    }
    return result;
  }
  get depth(): number { return this.#items.size; }
}
