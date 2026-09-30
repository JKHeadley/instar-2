import type { BoundaryContext, Clock, DecodeContext, Outcome, OwnedReference, RegisterGenerationReference, Result, RunReference, Scope, VerifiedPrincipal } from '../index.js';
import type { AppendReceipt, FactContext, FactEnvelope, FactStorePort } from '../facts/index.js';

// These brands are not constructors. Only the registered decoder/authority issues values.
declare const owned: unique symbol;
interface Owned { readonly [owned]: 'part-six' }
export interface FenceToken extends Owned {
  readonly type: 'FenceToken'; readonly schemaVersion: 1; readonly domain: string;
  readonly epoch: number; readonly assignment: string; readonly holder: string;
  readonly machine: string; readonly incarnation: string; readonly authority: string;
  readonly generation: string;
}
interface Row {
  readonly schemaVersion: 1; readonly domain: string; readonly command: string;
  readonly predecessor: string; readonly authority: string; readonly tick: number;
}
export interface Lease extends Row, Owned {
  readonly type: 'Lease'; readonly epoch: number; readonly holder: string;
  readonly machine: string; readonly incarnation: string; readonly generation: string;
  readonly expires: number; readonly state: 'held' | 'released';
  readonly operation: 'acquire' | 'renew' | 'release' | 'write'; readonly term: number;
}
export interface AdmissionReservation extends Row, Owned {
  readonly type: 'AdmissionReservation'; readonly operation: string;
  readonly request: string; readonly attempt: string; readonly digest: string;
  readonly run: string; readonly semanticMessage: string; readonly deliveryAttempt: string;
  readonly fence: FenceToken; readonly charge: number;
  // 'closed' is six's conditional close of a NEVER-dispatched prepared operation.
  // It is terminal, carries no executor, and is not an effect outcome.
  readonly state: 'prepared' | 'dispatch-claimed' | 'consumed' | 'closed';
  readonly executor: string; readonly durability: 'local-durable' | 'replicated';
  readonly replicas: number;
}
export interface LoopPolicy extends Owned {
  readonly type: 'LoopPolicy'; readonly schemaVersion: 1; readonly id: string;
  readonly maxAttempts: number; readonly minDelay: number; readonly maxDuration: number;
  readonly timeout: number; readonly concurrency: 1; readonly failDirection: 'closed';
  readonly breaker: 'stub-closed';
}
export interface LoopRecord extends Row, Owned {
  readonly type: 'LoopRecord'; readonly run: string; readonly episode: string;
  readonly policy: LoopPolicy; readonly attempts: number; readonly started: number;
  readonly nextWake: number; readonly state: 'scheduled' | 'running' | 'restoring' | 'waiting' | 'stopped';
  readonly pending: string;
}
/** Additive v1 fixed profile; historical singleton records keep their meaning. */
export interface RunPairAdmission extends Row, Owned {
  readonly type: 'RunPairAdmission'; readonly profile: 'provider-reply-v1';
  readonly provider: string; readonly reply: string; readonly opening: string;
  readonly acceptance: string; readonly originalPredecessor: string; readonly obligation: string;
  readonly operation: string; readonly answerDigest: string; readonly conversation: string;
  readonly budget: number; readonly replyPolicy: LoopPolicy;
}
/** One finite serving profile in the existing Six domain and accounting chain. */
export interface ServingRecord extends Row, Owned {
  readonly type: 'ServingRecord'; readonly profile: 'successive-turns-v1';
  readonly action: 'bind' | 'admit' | 'retire' | 'start' | 'result';
  readonly installation: string; readonly conversation: string; readonly generation: string;
  readonly ceiling: number; readonly maxTurns: number; readonly maxReplies: number;
  readonly expires: number; readonly providerMax: number; readonly replyMax: number;
  readonly errorLimit: number; readonly totalErrorLimit: number;
  readonly input: string; readonly opening: string; readonly provider: string;
  readonly reply: string; readonly operation: string; readonly attempt: string;
  readonly operations: readonly string[];
  readonly outcome: 'none' | 'success' | 'error';
}
export interface RecoveryRecord extends Row, Owned {
  readonly type: 'RecoveryRecord'; readonly operation: string; readonly episode: string;
  readonly observation: string; readonly disposition: 'waiting' | 'stopped-at-bound';
}
export interface ScanCursor extends Row, Owned {
  readonly type: 'ScanCursor'; readonly scan: string; readonly generation: string;
  readonly orderedKeysDigest: string; readonly keyCount: number;
  readonly previous: string; readonly selectedFrom: number; readonly selectedCount: number;
  readonly nextIndex: number; readonly maxItems: number; readonly maxDuration: number;
  readonly elapsed: number; readonly wrapped: 0 | 1;
}
// Six's accounting receipt, NOT an effect verdict or an eight-owned settlement.
export interface SettlementApplication extends Row, Owned {
  readonly type: 'SettlementApplication'; readonly operation: string; readonly request: string;
  readonly reservation: string; readonly claim: string; readonly digest: string;
  readonly settlement: string; readonly settlementFact: string; readonly settlementHash: string;
  readonly actualCharge: number; // -1 means unknown, never zero.
  readonly exposure: number; readonly released: number;
  readonly unresolved: number; readonly capViolation: number; readonly retryEligible: 0;
}
// Structural consumption requirements only. S remains the producer's own branded
// type; callers bind eight's consumeEffectSettlement at trusted assembly, not per
// request. This base need not duplicate or import an unmerged sibling package.
// Six consumes this seam TWICE per settlement: an authenticated preparation view
// whose callback is a pure in-memory copy, and the later consequential decision.
export interface SettlementAccountingInput {
  readonly id: string; readonly operation: string; readonly request: string;
  readonly reservation: string; readonly claim: string; readonly digest: string;
  readonly outcome: Outcome; readonly finalCharge: number | null;
  readonly delayedExecutionExcluded: boolean; readonly retainedExposure: number;
  readonly retryEligible: false;
}
export type SettlementConsumer<S> = <T>(value: S, boundary: BoundaryContext,
  consumer: (value: SettlementAccountingInput) => T) => Result<T>;
export type TransportRecord = Lease | AdmissionReservation | LoopRecord | RecoveryRecord | ScanCursor | SettlementApplication | RunPairAdmission | ServingRecord;
export interface TransportFact { readonly fact: FactEnvelope; readonly record: TransportRecord }

// Trusted host seams. P10 supplies the monotonic clock and fresh process identity.
// P3/current authority supplies a live context, not a candidate-supplied generation.
export interface TransportHost {
  readonly domain: string; readonly machine: string; readonly incarnation: string;
  readonly authorityIncarnation: string; readonly principal: VerifiedPrincipal;
  readonly scope: Scope; readonly maxLeaseTerm: number; readonly budget: number;
  /** Ten's local executor/worker supervisor. Lease expiry alone never proves return. */
  readonly executionQuiescent?: (run: string) => boolean;
  // P10 checks exact P2 facts/receipts, including after restart. Absence never
  // makes replicated accounting spendable; it does not block observation.
  readonly accountingDurability?: {
    readonly owner: 'part-ten';
    ensure(facts: readonly FactEnvelope[]): Result<readonly AppendReceipt[]>;
  };
  // Non-waiting local accessors, also used inside eight's final no-wait guard.
  // They must not perform storage/provider refresh or reentrant mutations.
  monotonic(): number;
  current(): { readonly decode: DecodeContext; readonly clock: Clock;
    readonly generation: RegisterGenerationReference; readonly stopped: boolean };
}
export interface TransportSpine {
  readonly store: FactStorePort;
  append(record: TransportRecord, required: readonly string[]): Result<AppendReceipt>;
}
export interface FactAuthor {
  readonly context: FactContext; readonly privateKey: string;
}
export interface ReserveInput {
  readonly command: string; readonly fence: FenceToken;
  readonly request: OwnedReference<'part-eight', 'EffectRequest'>;
  readonly attempt: string; readonly payloadDigest: string; readonly charge: number;
  readonly run: RunReference;
  // Five supplies this identity; six never derives/replaces it from transport attempts.
  readonly semanticMessage: string;
  readonly durability: 'local-durable' | 'replicated'; readonly replicas: number;
}
export interface DispatchClaim extends Owned { readonly operation: string; readonly attempt: string; readonly digest: string; readonly executor: string }
export interface ObservationPort {
  readonly owner: 'part-eight';
  // No invoke, settle, resend, or create-if-missing capability in the recovery port.
  observe(operation: string): Result<OwnedReference<'part-eight', 'OperationObservation'>>;
}
export interface BoundedDueScanPort {
  readonly owner: 'part-six';
  page(input: Readonly<{
    scan: string;
    generation: string;
    orderedKeys: readonly string[];
    cursor: OwnedReference<'part-six', 'ScanCursor'> | null;
    maxItems: number;
    maxDuration: number;
  }>): Result<Readonly<{
    selected: readonly string[];
    cursor: OwnedReference<'part-six', 'ScanCursor'>;
    wrapped: boolean;
  }>>;
}
export interface TransportAuthority<S = never> {
  inspect(): Result<readonly TransportFact[]>;
  acquire(command: string, expected: string, term: number): Result<FenceToken>;
  renew(command: string, fence: FenceToken, term: number): Result<FenceToken>;
  release(command: string, fence: FenceToken): Result<Lease>;
  admitWrite(command: string, fence: FenceToken): Result<Lease>;
  schedule(command: string, fence: FenceToken, run: RunReference, policy: LoopPolicy): Result<LoopRecord>;
  reserve(input: ReserveInput): Result<AdmissionReservation>;
  claim(command: string, fence: FenceToken, operation: string): Result<DispatchClaim>;
  consume(claim: DispatchClaim, fence: FenceToken): Result<AdmissionReservation>;
  recover(command: string, fence: FenceToken, operation: string, observer: ObservationPort): Result<RecoveryRecord>;
  // Conditional close of a prepared operation proven never dispatch-claimed.
  // It releases that operation's reserved credit; it never settles an effect.
  close(command: string, fence: FenceToken, operation: string): Result<AdmissionReservation>;
  settle(fence: FenceToken, settlement: S): Result<SettlementApplication>;
}

// ---- Composed multidomain resource admission (SEAM-LEDGER row 36, additive) ----
// A domain's capacity is the operator's finite deployment policy, supplied by the
// trusted host; the manifest names policies and never balances. Zero admits nothing.
export type ResourceDimension = 'global' | 'installation' | 'framework' | 'account' | 'job-family' | 'job' | 'ancestor';
export interface ResourceDemand {
  readonly dimension: ResourceDimension; readonly domain: string; readonly resource: string;
  readonly amount: number; readonly policy: string; readonly expectedPredecessor: string;
}
export interface ResourceAllocationSet extends Owned {
  /** P1 owned-body framing, as on every Six record; the remaining fields are the grant's exact list. */
  readonly type: 'ResourceAllocationSet'; readonly schemaVersion: 1;
  readonly owner: 'part-six'; readonly id: string; readonly operation: string;
  readonly request: string; readonly run: string; readonly fence: FenceToken;
  readonly parentAllocation: string; readonly demands: readonly ResourceDemand[];
  readonly prepared: readonly string[]; readonly committed: readonly string[];
  readonly released: readonly string[];
  readonly state: 'preparing' | 'committed' | 'closing' | 'closed';
  readonly predecessor: string; readonly sourceVector: string;
}
/** One registered finite resource domain of the operator's deployment policy. */
export interface ResourceDomainPolicy {
  readonly domain: string; readonly dimension: Exclude<ResourceDimension, 'ancestor'>;
  readonly resource: string; readonly capacity: number; readonly policy: string;
}
export interface ResourceSetHost extends TransportHost {
  resourceDomains(): readonly ResourceDomainPolicy[];
  /** Trusted resolver of an ordinary AdmissionReservation kept in its own single-run Six
   * domain (docs/10: no cross-domain transaction is assumed atomic; each state is durable).
   * Absent: the reservation must be in this authority's own domain. */
  resolveReservation?(reference: OwnedReference<'part-six', 'AdmissionReservation'>):
    Readonly<{ reservation: AdmissionReservation; fact: string; settlementUnresolved: boolean }> | undefined;
}
export interface ResourceSetAuthority {
  reserveResourceSet(input: Readonly<{
    command: string; fence: FenceToken;
    request: OwnedReference<'part-eight', 'EffectRequest'>; run: RunReference;
    parentAllocation: string; demands: readonly ResourceDemand[];
  }>): Result<ResourceAllocationSet>;
  attachResourceSet(reservation: OwnedReference<'part-six', 'AdmissionReservation'>,
    allocationSet: OwnedReference<'part-six', 'ResourceAllocationSet'>): Result<AdmissionReservation>;
  closeResourceSet(input: Readonly<{ command: string;
    allocationSet: OwnedReference<'part-six', 'ResourceAllocationSet'>; settlement: string }>): Result<ResourceAllocationSet>;
}
