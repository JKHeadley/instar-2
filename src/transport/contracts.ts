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
  readonly state: 'prepared' | 'dispatch-claimed' | 'consumed';
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
export interface RecoveryRecord extends Row, Owned {
  readonly type: 'RecoveryRecord'; readonly operation: string; readonly episode: string;
  readonly observation: string; readonly disposition: 'waiting' | 'stopped-at-bound';
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
export interface SettlementAccountingInput {
  readonly id: string; readonly operation: string; readonly request: string;
  readonly reservation: string; readonly claim: string; readonly digest: string;
  readonly outcome: Outcome; readonly finalCharge: number | null;
  readonly delayedExecutionExcluded: boolean; readonly retainedExposure: number;
  readonly retryEligible: false;
}
export type SettlementConsumer<S> = <T>(value: S, boundary: BoundaryContext,
  consumer: (value: SettlementAccountingInput) => T) => Result<T>;
export type TransportRecord = Lease | AdmissionReservation | LoopRecord | RecoveryRecord | SettlementApplication;
export interface TransportFact { readonly fact: FactEnvelope; readonly record: TransportRecord }

// Trusted host seams. P10 supplies the monotonic clock and fresh process identity.
// P3/current authority supplies a live context, not a candidate-supplied generation.
export interface TransportHost {
  readonly domain: string; readonly machine: string; readonly incarnation: string;
  readonly authorityIncarnation: string; readonly principal: VerifiedPrincipal;
  readonly scope: Scope; readonly maxLeaseTerm: number; readonly budget: number;
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
  settle(fence: FenceToken, settlement: S): Result<SettlementApplication>;
}
