import { consumeOutcome } from '../index.js';
import type { AppendReceipt, FactEnvelope } from '../facts/index.js';
import type { AdmissionReservation, SettlementAccountingInput, SettlementApplication, TransportFact, TransportHost } from './contracts.js';
import { encoded, ensure, take } from './boundary.js';
import type { FactContext } from '../facts/index.js';
import { providerSettlementWire } from './provider-settlement.js';

// A raw P2 caller cannot manufacture a conditional accounting row. Its admission
// ticket exists only inside a live six settlement attempt whose preparation view
// came from the registered eight consumer; replay never mints it. Qualification
// below is a SEPARATE requirement and only the final guarded callback grants it.
const consumers = new WeakMap<TransportHost, unknown>();
// Durable application bytes are conditional preparation, not a reconstructed live
// authorization. Only eight's final no-wait consequential callback qualifies a row
// for credit release. A fresh process must reconsume current eight authority for
// the same once-only application before that row can fund new admission.
const qualified = new WeakMap<TransportHost, Map<string, string>>();
const attempts = new WeakSet<TransportHost>();
const revisions = new WeakMap<TransportHost, number>();
export function accountingRevision(host: TransportHost): number { return revisions.get(host) ?? 0; }
export function noteAccountingCandidate(host: TransportHost): void {
  const next = accountingRevision(host) + 1;
  ensure(Number.isSafeInteger(next), 'accounting revision exhausted'); revisions.set(host, next);
}
export function invalidateAccounting(host: TransportHost, operation: string): void { qualified.get(host)?.delete(operation); }
export function qualifyAccounting(host: TransportHost, row: TransportFact): void {
  ensure(row.record.type === 'SettlementApplication', 'accounting qualification requires an application');
  const map = qualified.get(host) ?? new Map<string, string>(); qualified.set(host, map);
  map.set(row.record.operation, encoded(row.fact).bytes);
}
function accountingQualified(host: TransportHost, row: TransportFact): boolean {
  return row.record.type === 'SettlementApplication' && qualified.get(host)?.get(row.record.operation) === encoded(row.fact).bytes;
}
// One settlement attempt at a time per host; preparation cannot nest or interleave.
export function withSettlementAttempt<T>(host: TransportHost, run: () => T): T {
  ensure(!attempts.has(host), 'settlement preparation already active');
  attempts.add(host); try { return run(); } finally { attempts.delete(host); }
}
export function bindSettlementConsumer(host: TransportHost, consumer: unknown): void {
  if (consumer === undefined) return;
  ensure(!consumers.has(host) || consumers.get(host) === consumer, 'registered settlement consumer cannot be replaced');
  consumers.set(host, consumer);
}
export function requireSettlementConsumer(host: TransportHost, consumer: unknown): void {
  ensure(consumer !== undefined && consumers.get(host) === consumer, 'consumer differs from fact-boundary registration');
}
const tickets = new WeakMap<TransportHost, Map<string, unknown>>();
export function withApplication<T>(host: TransportHost, r: SettlementApplication, consumer: unknown, run: () => T): T {
  requireSettlementConsumer(host, consumer);
  ensure(attempts.has(host), 'application requires a live six settlement attempt');
  const set = tickets.get(host) ?? new Map<string, unknown>(); tickets.set(host, set);
  const key = encoded(r).hash; ensure(!set.has(key), 'settlement application already active');
  set.set(key, consumer); try { return run(); } finally { set.delete(key); }
}
export function requireApplication(host: TransportHost, r: SettlementApplication, registeredConsumer: unknown): void {
  ensure(registeredConsumer !== undefined && tickets.get(host)?.get(encoded(r).hash) === registeredConsumer,
    'application requires live eight settlement consumption');
}
export function latestApplication(all: readonly TransportFact[], operation: string): SettlementApplication | undefined {
  const r = all.filter(v => v.record.type === 'SettlementApplication' && v.record.operation === operation).at(-1)?.record;
  return r?.type === 'SettlementApplication' ? r : undefined;
}
export function checkAccountingReceipt(fact: FactEnvelope, receipt: AppendReceipt, reservation: AdmissionReservation): void {
  ensure(!receipt.taint.length && encoded(receipt.fact).bytes === encoded(fact).bytes, 'accounting receipt is tainted or for different facts');
  const d = receipt.durability;
  ensure(d.kind === 'local-durable' || d.kind === 'replicated', 'accounting lacks durable receipt');
  if (reservation.durability === 'replicated') ensure(d.kind === 'replicated' && d.n >= reservation.replicas
    && new Set(d.peers).size >= reservation.replicas && !d.peers.includes(fact.machine), 'original accounting durability demand unmet');
}
export function requireAccountingDurability(row: TransportFact, reservation: AdmissionReservation, host: TransportHost): void {
  // P2's status-bearing local prefix already establishes local-durable custody.
  if (reservation.durability === 'local-durable') return;
  ensure(host.accountingDurability?.owner === 'part-ten', 'original accounting durability demand unmet: no configured custody reader');
  const receipts = take(host.accountingDurability.ensure([row.fact]));
  ensure(receipts.length === 1, 'accounting receipt must cover exact application');
  checkAccountingReceipt(row.fact, receipts[0]!, reservation);
}
export function admissionAccounting(all: readonly TransportFact[], reservation: AdmissionReservation, host: TransportHost) {
  const applications = all.filter(v => v.record.type === 'SettlementApplication' && v.record.operation === reservation.operation);
  const latest = applications.at(-1);
  // A local record may increase exposure/inhibit immediately. Reduction requires
  // current proof of THIS accounting fact at the ORIGINAL operation's demand.
  const held = { exposure: Math.max(reservation.charge, ...applications.map(v => (v.record as SettlementApplication).exposure)), unresolved: 1 };
  // Durable bytes alone are never spendable: this exact row must ALSO carry live
  // qualification from eight's final guarded callback in this process.
  if (!latest || !accountingQualified(host, latest)) return held;
  try {
    requireAccountingDurability(latest, reservation, host);
    ensure(accountingQualified(host, latest), 'accounting qualification changed during custody wait');
  }
  catch { return held; }
  return latest.record as SettlementApplication;
}
export function accounting(s: SettlementAccountingInput, reservation: AdmissionReservation) {
  ensure(s.retryEligible === false && typeof s.delayedExecutionExcluded === 'boolean', 'unsupported retry or quiescence contract');
  ensure(s.finalCharge === null || Number.isSafeInteger(s.finalCharge) && s.finalCharge >= 0, 'invalid final charge');
  ensure(Number.isSafeInteger(s.retainedExposure) && s.retainedExposure >= 0, 'invalid retained exposure');
  const uncertain = consumeOutcome(s.outcome, { happened: () => false, 'did-not-happen': () => false, uncertain: () => true });
  const unresolved = uncertain || s.finalCharge === null || !s.delayedExecutionExcluded;
  const exposure = unresolved ? Math.max(reservation.charge, s.finalCharge ?? 0, s.retainedExposure) : s.finalCharge!;
  // Release is cumulative for this operation, not a delta to sum on replay.
  return { actualCharge: s.finalCharge ?? -1, exposure, released: Math.max(0, reservation.charge - exposure),
    unresolved: unresolved ? 1 : 0, capViolation: exposure > reservation.charge ? 1 : 0, retryEligible: 0 as const };
}
// Eight's admitted wire uses a decimal text charge / 'unknown'. This is exact
// reference matching, not an eight constructor or live historical-consumption API.
export function settlementMatches(s: SettlementAccountingInput, fact: FactEnvelope, context?: FactContext): boolean {
  if (fact.kind === 'effect-provider-ProviderEffectSettlement') {
    // Delegate to Eight's owner decoder (which now also refuses a charge the referenced
    // Nine assessment does not support): a rejected settlement THROWS through this
    // matcher exactly as a structurally malformed one does, never silently matching.
    return encoded(providerSettlementWire(fact, context)).bytes
      === encoded({ ...s, type: 'ProviderEffectSettlement', finalCharge: s.finalCharge === null ? 'unknown' : String(s.finalCharge) }).bytes;
  }
  return fact.kind === 'effect-EffectSettlement' && encoded((fact.body as { record: unknown }).record).bytes
    === encoded({ ...s, finalCharge: s.finalCharge === null ? 'unknown' : String(s.finalCharge) }).bytes;
}
export function checkApplicationEvidence(r: SettlementApplication, past: readonly FactEnvelope[], all: readonly TransportFact[], context?: FactContext): void {
  const fact = past.find(f => f.id === r.settlementFact);
  ensure(fact?.kind === 'effect-EffectSettlement' || fact?.kind === 'effect-provider-ProviderEffectSettlement', 'eight settlement fact absent from causal closure');
  const wire = fact.kind === 'effect-provider-ProviderEffectSettlement' ? providerSettlementWire(fact, context)
    : (fact.body as unknown as { record: Omit<SettlementAccountingInput, 'finalCharge'> & { finalCharge: string } }).record;
  ensure(wire.finalCharge === 'unknown' || /^(0|[1-9][0-9]*)$/.test(wire.finalCharge), 'invalid referenced charge encoding');
  const s = { ...wire, finalCharge: wire.finalCharge === 'unknown' ? null : Number(wire.finalCharge) };
  ensure(fact.contentHash === r.settlementHash && s.id === r.settlement && s.operation === r.operation
    && s.request === r.request && s.reservation === r.reservation && s.claim === r.claim && s.digest === r.digest, 'settlement identity or bytes changed');
  const op = all.filter(v => v.record.type === 'AdmissionReservation' && v.record.operation === r.operation).at(-1);
  ensure(op?.record.type === 'AdmissionReservation' && (op.record.state === 'dispatch-claimed' || op.record.state === 'consumed') && op.fact.id === r.reservation
    && op.record.request === r.request && op.record.digest === r.digest, 'settlement reservation mismatch');
  const claim = all.find(v => v.fact.id === r.claim)?.record;
  ensure(claim?.type === 'AdmissionReservation' && claim.state === 'dispatch-claimed'
    && claim.operation === r.operation && claim.digest === r.digest, 'settlement claim mismatch');
  const expected = accounting(s, op.record);
  ensure(Object.entries(expected).every(([key, value]) => r[key as keyof SettlementApplication] === value), 'accounting differs from eight evidence');
}
