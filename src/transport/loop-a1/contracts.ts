import type {
  BoundaryContext,
  Clock,
  FactEnvelopeReference,
  Hash,
  OwnedReference,
  RegisterGenerationReference,
  Result,
  RunReference,
} from '../../index.js';
import type { AppendReceipt, FactContext, FactEnvelope, FactStorePort } from '../../facts/index.js';
import type { ConstitutionalReference } from '../../rungraph/index.js';
import type {
  AdmissionReservation,
  DispatchClaim,
  FenceToken,
  Lease,
  ObservationPort,
  RecoveryRecord,
  ReserveInput,
  SettlementApplication,
  TransportAuthority,
  TransportFact,
  TransportHost,
} from '../contracts.js';

declare const owned: unique symbol;
interface Owned { readonly [owned]: 'part-six' }

export interface SharedBreakerLoopPolicy extends Owned {
  readonly type: 'LoopPolicy';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly maxAttempts: number;
  readonly minDelay: number;
  readonly maxDuration: number;
  readonly timeout: number;
  /** A1 preserves the landed general-work cap; only half-open controls are new. */
  readonly concurrency: 1;
  readonly failDirection: 'closed';
  readonly breaker: 'shared-circuit-v1';
  readonly initialDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
  readonly jitterMinPermille: number;
  readonly jitterMaxPermille: number;
  readonly failureThreshold: number;
  readonly countedFailureClasses: readonly string[];
  readonly acceptedOutcomeWindow: number;
  readonly breakerCooldown: number;
  readonly maxOpenDuration: number;
  readonly halfOpenTrials: number;
  readonly halfOpenConcurrency: number;
  readonly closeEvidence: 'part-nine-restoration';
  readonly reopenEvidence: 'counted-failure';
}

export type LoopSourceVectorReference = FactEnvelopeReference;
export type LoopPressureScope = Readonly<{
  target: string;
  conversation: string;
  machine: string;
  pool: string;
}>;
export type LoopAttempt = Readonly<{
  id: string;
  episode: string;
  admittedAt: Clock;
  mode: 'closed' | 'half-open';
}>;
export type LoopOutcome = Readonly<{
  attempt: string;
  kind: 'accepted' | 'failed';
  failureClass: string;
  observedAt: Clock;
  completion: ConstitutionalReference<'Outcome'>;
  jitterPermille: number;
  restoration: readonly OwnedReference<'part-nine', 'VerificationAssessment'>[];
}>;

export interface SharedLoopRecord extends Owned {
  readonly type: 'LoopRecord';
  readonly schemaVersion: 1;
  readonly domain: string;
  readonly command: string;
  readonly predecessor: string;
  readonly authority: string;
  readonly tick: number;
  readonly run: string;
  readonly episode: string;
  readonly policy: SharedBreakerLoopPolicy;
  readonly attempts: number;
  readonly started: number;
  readonly nextWake: number;
  readonly state: 'scheduled' | 'running' | 'restoring' | 'waiting' | 'open-breaker' | 'half-open' | 'stopped' | 'closed';
  readonly pending: string;
  readonly currentOwnerRun: RunReference;
  readonly policyGeneration: RegisterGenerationReference;
  readonly pressureBinding: FactEnvelopeReference;
  readonly operationFamily: string;
  readonly pressureScope: LoopPressureScope;
  readonly pressureKey: string;
  readonly episodeKey: string;
  readonly transition: 'scheduled' | 'attempt-admitted' | 'outcome-recorded' | 'opened' | 'half-opened' | 'reopened' | 'closed' | 'stopped';
  readonly transitionAt: Clock;
  readonly nextEligible: Clock;
  readonly clockBasis: string;
  readonly sourceVector: LoopSourceVectorReference;
  readonly totalFailures: number;
  readonly failureCount: number;
  readonly breakerHasOpened: 0 | 1;
  readonly breakerOpenCount: number;
  readonly breakerFirstOpened: Clock;
  readonly halfOpenAdmitted: number;
  readonly halfOpenSucceeded: number;
  readonly pendingAttempts: readonly string[];
  readonly attemptLog: readonly LoopAttempt[];
  readonly outcomeLog: readonly LoopOutcome[];
  readonly outcomeWindowDigest: Hash;
  readonly closureEvidence: readonly OwnedReference<'part-nine', 'VerificationAssessment'>[];
}

export type StoredSharedLoopPolicy = Omit<SharedBreakerLoopPolicy, 'type'> & {
  readonly type: 'SharedBreakerLoopPolicy';
};
export type StoredSharedLoopRecord = Omit<SharedLoopRecord, 'type'> & {
  readonly type: 'SharedLoopRecord';
};

export interface SharedLoopClockPort {
  readonly owner: 'part-ten';
  now(): Clock;
}
export interface RestorationEvidencePort {
  readonly owner: 'part-nine';
  verify(input: Readonly<{
    reference: OwnedReference<'part-nine', 'VerificationAssessment'>;
    pressureKey: string;
    operationFamily: string;
  }>): Result<Readonly<{
    reference: OwnedReference<'part-nine', 'VerificationAssessment'>;
    operation: string;
    operationDigest: string;
    missingEvidence: readonly string[];
    captureStatuses: readonly Readonly<{ reference: string; status: string }>[];
    taints: readonly string[];
    predicates: readonly Readonly<{ predicate: string; verdict: string }>[];
    validFrom: number;
    validUntil: number;
  }>>;
}
export interface GovernedLoopScopePort {
  readonly owner: 'part-three';
  resolve(input: Readonly<{
    parentDuty: RunReference;
    operationFamily: string;
    pressureScope: LoopPressureScope;
  }>): Result<Readonly<{
    operationFamily: string;
    pressureScope: LoopPressureScope;
    witness: FactEnvelopeReference;
  }>>;
}
export interface LoopA1Host extends TransportHost {
  readonly loopClock?: SharedLoopClockPort;
  readonly restorationEvidence?: RestorationEvidencePort;
  readonly loopScopeBinding?: GovernedLoopScopePort;
}

export interface LoopEpisodeInput {
  readonly command: string;
  readonly fence: FenceToken;
  readonly currentOwnerRun: RunReference;
  readonly policy: SharedBreakerLoopPolicy;
  readonly episodeKey: string;
  readonly operationFamily: string;
  readonly pressureScope: LoopPressureScope;
  readonly sourceVector: LoopSourceVectorReference;
}
export interface LoopAttemptInput {
  readonly command: string;
  readonly fence: FenceToken;
  readonly episode: OwnedReference<'part-six', 'LoopRecord'>;
  readonly attempt: string;
}
export interface LoopOutcomeInput {
  readonly command: string;
  readonly fence: FenceToken;
  readonly episode: OwnedReference<'part-six', 'LoopRecord'>;
  readonly attempt: string;
  readonly kind: 'accepted' | 'failed';
  readonly failureClass: string;
  readonly completion: ConstitutionalReference<'Outcome'>;
  readonly jitterPermille: number;
  readonly restoration: readonly OwnedReference<'part-nine', 'VerificationAssessment'>[];
}

export interface LoopA1TransportFact {
  readonly fact: FactEnvelope;
  readonly record: TransportFact['record'] | SharedLoopRecord;
}

export interface LoopA1Spine {
  readonly store: FactStorePort;
  readonly context: FactContext;
  readonly legacy: ReturnType<typeof import('../authority.js')['createTransportSpine']>;
  append(record: SharedLoopRecord, required: readonly string[]): Result<AppendReceipt>;
}

export interface LoopA1Authority<S = never> {
  readonly legacy: TransportAuthority<S>;
  inspect(): Result<readonly LoopA1TransportFact[]>;
  acquire(command: string, expected: string, term: number): Result<FenceToken>;
  renew(command: string, fence: FenceToken, term: number): Result<FenceToken>;
  release(command: string, fence: FenceToken): Result<Lease>;
  admitWrite(command: string, fence: FenceToken): Result<Lease>;
  schedule: TransportAuthority<S>['schedule'];
  reserve(input: ReserveInput): Result<AdmissionReservation>;
  claim(command: string, fence: FenceToken, operation: string): Result<DispatchClaim>;
  consume(claim: DispatchClaim, fence: FenceToken): Result<AdmissionReservation>;
  recover(command: string, fence: FenceToken, operation: string, observer: ObservationPort): Result<RecoveryRecord>;
  close(command: string, fence: FenceToken, operation: string): Result<AdmissionReservation>;
  settle(fence: FenceToken, settlement: S): Result<SettlementApplication>;
  scheduleEpisode(input: LoopEpisodeInput): Result<SharedLoopRecord>;
  admitLoopAttempt(input: LoopAttemptInput): Result<SharedLoopRecord>;
  recordLoopOutcome(input: LoopOutcomeInput): Result<SharedLoopRecord>;
}

export type LoopA1PolicyResult = Result<import('../contracts.js').LoopPolicy | SharedBreakerLoopPolicy>;
export type LoopA1Boundary = BoundaryContext;
