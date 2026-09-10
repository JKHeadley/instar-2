import type { BoundaryContext, Clock, DecodeContext, FactEnvelopeReference, Hash, Outcome, OwnedReference, RegisterGenerationReference, Result, RunReference, Scope, VerifiedPrincipal } from '../index.js';
import type { AppendReceipt, FactContext, FactEnvelope, FactStorePort } from '../facts/index.js';
import type { ConstitutionalReference } from '../rungraph/index.js';

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
export interface StubLoopPolicy extends Owned {
  readonly type: 'LoopPolicy'; readonly schemaVersion: 1; readonly id: string;
  readonly maxAttempts: number; readonly minDelay: number; readonly maxDuration: number;
  readonly timeout: number; readonly concurrency: 1; readonly failDirection: 'closed';
  readonly breaker: 'stub-closed';
}
export interface SharedBreakerLoopPolicy extends Owned {
  readonly type: 'LoopPolicy'; readonly schemaVersion: 1; readonly id: string;
  readonly maxAttempts: number; readonly minDelay: number; readonly maxDuration: number;
  readonly timeout: number; readonly concurrency: number; readonly failDirection: 'closed';
  readonly breaker: 'shared-circuit-v1';
  readonly initialDelay: number; readonly maxDelay: number; readonly backoffMultiplier: number;
  /** Integer permille bounds. Zero and 1000 mean 0x and 1x respectively. */
  readonly jitterMinPermille: number; readonly jitterMaxPermille: number;
  readonly failureThreshold: number; readonly countedFailureClasses: readonly string[];
  /** Rolling breaker-outcome window in the shared clock's unit. */
  readonly acceptedOutcomeWindow: number;
  readonly breakerCooldown: number; readonly maxOpenDuration: number;
  readonly halfOpenTrials: number; readonly halfOpenConcurrency: number;
  readonly closeEvidence: 'part-nine-restoration'; readonly reopenEvidence: 'counted-failure';
  readonly parentDuty: RunReference; readonly budgetWindow: number;
  readonly parentAttemptBudget: number; readonly parentResourceBudget: number;
}
export type LoopPolicy = StubLoopPolicy | SharedBreakerLoopPolicy;
export interface LegacyLoopRecord extends Row, Owned {
  readonly type: 'LoopRecord'; readonly run: string; readonly episode: string;
  readonly policy: StubLoopPolicy; readonly attempts: number; readonly started: number;
  readonly nextWake: number; readonly state: 'scheduled' | 'running' | 'restoring' | 'waiting' | 'stopped';
  readonly pending: string;
}
export type LoopSourceVector = readonly Readonly<{ machine: string; epoch: number; position: number }>[];
export type LoopPressureScope = Readonly<{ target: string; conversation: string; machine: string; pool: string }>;
export type LoopAttempt = Readonly<{
  id: string; holderFamily: string; worker: string; machine: string; episode: string;
  admittedAt: Clock; resource: number; mode: 'closed' | 'half-open'; sourceVector: LoopSourceVector;
}>;
export type LoopOutcome = Readonly<{
  attempt: string; kind: 'accepted' | 'failed'; failureClass: string; observedAt: Clock;
  completion: ConstitutionalReference<'Outcome'>;
  jitterPermille: number; restoration: readonly OwnedReference<'part-nine', 'VerificationAssessment'>[];
  sourceVector: LoopSourceVector;
}>;
export interface SharedLoopRecord extends Row, Owned {
  readonly type: 'LoopRecord'; readonly run: string; readonly episode: string;
  readonly policy: SharedBreakerLoopPolicy; readonly attempts: number; readonly started: number;
  readonly nextWake: number;
  readonly state: 'scheduled' | 'running' | 'restoring' | 'waiting' | 'open-breaker' | 'half-open' | 'stopped' | 'closed';
  readonly pending: string;
  readonly parentDuty: RunReference; readonly currentOwnerRun: RunReference;
  readonly policyGeneration: RegisterGenerationReference;
  readonly pressureBinding: FactEnvelopeReference;
  readonly operationFamily: string; readonly pressureScope: LoopPressureScope; readonly pressureKey: string;
  readonly episodeKey: string; readonly transition: 'scheduled' | 'attempt-admitted' | 'outcome-recorded' | 'opened' | 'half-opened' | 'reopened' | 'closed' | 'stopped';
  readonly transitionAt: Clock; readonly nextEligible: Clock; readonly clockBasis: string;
  readonly sourceVector: LoopSourceVector;
  readonly episodeAttempts: number; readonly totalFailures: number; readonly failureCount: number;
  readonly rollingAttempts: number; readonly rollingResource: number;
  readonly breakerHasOpened: 0 | 1; readonly breakerOpenCount: number; readonly breakerFirstOpened: Clock;
  readonly halfOpenAdmitted: number; readonly halfOpenSucceeded: number;
  readonly pendingAttempts: readonly string[]; readonly attemptLog: readonly LoopAttempt[];
  readonly outcomeLog: readonly LoopOutcome[];
  readonly outcomeWindowDigest: Hash;
  readonly closureEvidence: readonly OwnedReference<'part-nine', 'VerificationAssessment'>[];
}
export type LoopRecord = LegacyLoopRecord | SharedLoopRecord;
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
export type TransportRecord = Lease | AdmissionReservation | LoopRecord | RecoveryRecord | ScanCursor | SettlementApplication;
export type TransportRowRecord = TransportRecord;
export interface TransportFact { readonly fact: FactEnvelope; readonly record: TransportRecord }

export interface SharedLoopClockPort {
  readonly owner: 'part-ten';
  now(): Clock;
}
export interface RestorationEvidencePort {
  readonly owner: 'part-nine';
  verify(input: Readonly<{ reference: OwnedReference<'part-nine', 'VerificationAssessment'>; pressureKey: string;
    operationFamily: string }>): Result<Readonly<{
      reference: OwnedReference<'part-nine', 'VerificationAssessment'>;
      operation: string; operationDigest: string; missingEvidence: readonly string[];
      captureStatuses: readonly Readonly<{ reference: string; status: string }>[]; taints: readonly string[];
      predicates: readonly Readonly<{ predicate: string; verdict: string }>[];
      validFrom: number; validUntil: number;
    }>>;
}
export interface GovernedLoopScopePort {
  readonly owner: 'part-three';
  resolve(input: Readonly<{ parentDuty: RunReference; operationFamily: string;
    pressureScope: LoopPressureScope }>): Result<Readonly<{
      operationFamily: string; pressureScope: LoopPressureScope; witness: FactEnvelopeReference;
    }>>;
}
// Trusted host seams. P10 supplies the monotonic clock and fresh process identity.
// P3/current authority supplies a live context, not a candidate-supplied generation.
export interface TransportHost {
  readonly domain: string; readonly machine: string; readonly incarnation: string;
  readonly authorityIncarnation: string; readonly principal: VerifiedPrincipal;
  readonly scope: Scope; readonly maxLeaseTerm: number; readonly budget: number;
  // P10 checks exact P2 facts/receipts, including after restart. Absence never
  // makes replicated accounting spendable; it does not block observation.
  readonly accountingDurability?: {
    readonly owner: 'part-ten';
    ensure(facts: readonly FactEnvelope[]): Result<readonly AppendReceipt[]>;
  };
  /** Shared comparable time is mandatory for the real breaker path. */
  readonly loopClock?: SharedLoopClockPort;
  readonly restorationEvidence?: RestorationEvidencePort;
  readonly loopScopeBinding?: GovernedLoopScopePort;
  // Non-waiting local accessors, also used inside eight's final no-wait guard.
  // They must not perform storage/provider refresh or reentrant mutations.
  monotonic(): number;
  current(): { readonly decode: DecodeContext; readonly clock: Clock;
    readonly generation: RegisterGenerationReference; readonly stopped: boolean };
}
export interface TransportSpine {
  readonly store: FactStorePort;
  /** Pinned installation history used to re-resolve owner evidence on every path. */
  readonly context?: FactContext;
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
export interface LoopEpisodeInput {
  readonly command: string; readonly fence: FenceToken; readonly currentOwnerRun: RunReference;
  readonly policy: SharedBreakerLoopPolicy; readonly episodeKey: string; readonly operationFamily: string;
  readonly pressureScope: LoopPressureScope; readonly sourceVector: LoopSourceVector;
}
export interface LoopAttemptInput {
  readonly command: string; readonly fence: FenceToken; readonly episode: OwnedReference<'part-six', 'LoopRecord'>;
  readonly attempt: string; readonly holderFamily: string; readonly worker: string; readonly machine: string;
  readonly resource: number; readonly sourceVector: LoopSourceVector;
}
export interface LoopOutcomeInput {
  readonly command: string; readonly fence: FenceToken; readonly episode: OwnedReference<'part-six', 'LoopRecord'>;
  readonly attempt: string; readonly kind: 'accepted' | 'failed'; readonly failureClass: string;
  readonly completion: ConstitutionalReference<'Outcome'>;
  readonly jitterPermille: number;
  readonly restoration: readonly OwnedReference<'part-nine', 'VerificationAssessment'>[];
  readonly sourceVector: LoopSourceVector;
}
export interface TransportAuthority<S = never> {
  inspect(): Result<readonly TransportFact[]>;
  acquire(command: string, expected: string, term: number): Result<FenceToken>;
  renew(command: string, fence: FenceToken, term: number): Result<FenceToken>;
  release(command: string, fence: FenceToken): Result<Lease>;
  admitWrite(command: string, fence: FenceToken): Result<Lease>;
  schedule(command: string, fence: FenceToken, run: RunReference, policy: LoopPolicy): Result<LoopRecord>;
  scheduleEpisode(input: LoopEpisodeInput): Result<SharedLoopRecord>;
  admitLoopAttempt(input: LoopAttemptInput): Result<SharedLoopRecord>;
  recordLoopOutcome(input: LoopOutcomeInput): Result<SharedLoopRecord>;
  reserve(input: ReserveInput): Result<AdmissionReservation>;
  claim(command: string, fence: FenceToken, operation: string): Result<DispatchClaim>;
  consume(claim: DispatchClaim, fence: FenceToken): Result<AdmissionReservation>;
  recover(command: string, fence: FenceToken, operation: string, observer: ObservationPort): Result<RecoveryRecord>;
  // Conditional close of a prepared operation proven never dispatch-claimed.
  // It releases that operation's reserved credit; it never settles an effect.
  close(command: string, fence: FenceToken, operation: string): Result<AdmissionReservation>;
  settle(fence: FenceToken, settlement: S): Result<SettlementApplication>;
}
