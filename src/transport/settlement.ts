import { consumeOutcome } from '../index.js';
import type { AppendReceipt, FactEnvelope } from '../facts/index.js';
import type { AdmissionReservation, SettlementAccountingInput, SettlementApplication, TransportFact, TransportHost } from './contracts.js';
import { encoded, ensure, take } from './boundary.js';

// A raw P2 caller cannot manufacture a credit receipt. This ticket exists only
// while the trusted assembly's eight consumer is on-stack; replay never mints it.
const consumers = new WeakMap<TransportHost, unknown>();
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
  if (!latest) return held;
  try { requireAccountingDurability(latest, reservation, host); }
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
export function settlementMatches(s: SettlementAccountingInput, fact: FactEnvelope): boolean {
  return fact.kind === 'effect-EffectSettlement' && encoded((fact.body as { record: unknown }).record).bytes
    === encoded({ ...s, finalCharge: s.finalCharge === null ? 'unknown' : String(s.finalCharge) }).bytes;
}
export function checkApplicationEvidence(r: SettlementApplication, past: readonly FactEnvelope[], all: readonly TransportFact[]): void {
  const fact = past.find(f => f.id === r.settlementFact);
  ensure(fact?.kind === 'effect-EffectSettlement', 'eight settlement fact absent from causal closure');
  const wire = (fact.body as unknown as { record: Omit<SettlementAccountingInput, 'finalCharge'> & { finalCharge: string } }).record;
  ensure(wire.finalCharge === 'unknown' || /^(0|[1-9][0-9]*)$/.test(wire.finalCharge), 'invalid referenced charge encoding');
  const s = { ...wire, finalCharge: wire.finalCharge === 'unknown' ? null : Number(wire.finalCharge) };
  ensure(fact.contentHash === r.settlementHash && s.id === r.settlement && s.operation === r.operation
    && s.request === r.request && s.reservation === r.reservation && s.claim === r.claim && s.digest === r.digest, 'settlement identity or bytes changed');
  const op = all.filter(v => v.record.type === 'AdmissionReservation' && v.record.operation === r.operation).at(-1);
  ensure(op?.record.type === 'AdmissionReservation' && op.record.state !== 'prepared' && op.fact.id === r.reservation
    && op.record.request === r.request && op.record.digest === r.digest, 'settlement reservation mismatch');
  const claim = all.find(v => v.fact.id === r.claim)?.record;
  ensure(claim?.type === 'AdmissionReservation' && claim.state === 'dispatch-claimed'
    && claim.operation === r.operation && claim.digest === r.digest, 'settlement claim mismatch');
  const expected = accounting(s, op.record);
  ensure(Object.entries(expected).every(([key, value]) => r[key as keyof SettlementApplication] === value), 'accounting differs from eight evidence');
}
