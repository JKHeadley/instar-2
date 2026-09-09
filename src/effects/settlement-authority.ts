import type { EffectHost, EffectSettlement, OrderedEffectAggregate } from './contracts.js';
import type { BoundaryContext, Result } from '../index.js';
import { boundary, encoded, ensure, take } from './boundary.js';

// Private owner admission. Raw P2 authoring is not a settlement constructor.
// A ticket exists only on the stack after independent acceptance and durability
// checks. Historical replay checks signed data, never recreates this live ticket.
const tickets = new WeakMap<EffectHost, Set<string>>();
const aggregateTickets = new WeakMap<EffectHost, Set<string>>();
type SettlementRecheck = <T>(consumer: (value: EffectSettlement) => T) => Result<T>;
const issued = new WeakMap<object, SettlementRecheck>();
export function issuedSettlement(value: EffectSettlement, recheck: SettlementRecheck): EffectSettlement {
  issued.set(value, recheck); return value;
}
// Consumer six must use this current, owner-produced view rather than trusting
// copied JSON or the informational historical index. This does not edit credits.
export function consumeEffectSettlement<T>(value: EffectSettlement, c: BoundaryContext, consumer: (value: EffectSettlement) => T): Result<T> {
  return boundary('EffectSettlementConsume', { id: value?.id }, c, () => {
    const recheck = issued.get(value); ensure(recheck, 'settlement is not a live eight-owned issuance');
    // Consequential use stays INSIDE the owner's synchronous assessment guard.
    return take(recheck(current => {
      ensure(encoded(current).bytes === encoded(value).bytes, 'settlement changed or evidence was withdrawn');
      return consumer(current);
    }));
  });
}
export function withSettlement<T>(host: EffectHost, value: EffectSettlement, run: () => T): T {
  const set = tickets.get(host) ?? new Set<string>(); tickets.set(host, set);
  const digest = encoded(value).hash; ensure(!set.has(digest), 'settlement admission already active');
  set.add(digest); try { return run(); } finally { set.delete(digest); }
}
export function requireSettlement(host: EffectHost, value: EffectSettlement): void {
  ensure(tickets.get(host)?.has(encoded(value).hash), 'settlement requires eight-owned evidence admission');
}

// Aggregate conclusions are owner decisions too. A valid signature authenticates
// bytes; it does not prove that those bytes were derived through the doorway's
// current settlement/refusal checks. Replay validates the signed dependencies,
// while live appends additionally require this unforgeable in-process ticket.
export function withAggregate<T>(host: EffectHost, value: OrderedEffectAggregate, run: () => T): T {
  const set = aggregateTickets.get(host) ?? new Set<string>(); aggregateTickets.set(host, set);
  const digest = encoded(value).hash; ensure(!set.has(digest), 'aggregate admission already active');
  set.add(digest); try { return run(); } finally { set.delete(digest); }
}
export function requireAggregate(host: EffectHost, value: OrderedEffectAggregate): void {
  ensure(aggregateTickets.get(host)?.has(encoded(value).hash), 'aggregate requires eight-owned derivation');
}
