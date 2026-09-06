import type { BoundaryContext, Clock, DecodeContext, Outcome, OwnedReference, Result, RunReference, Scope, VerifiedPrincipal } from '../index.js';
import type { AppendReceipt, DurabilityState, FactContext, FactEnvelope, FactStorePort, GovernedVersion } from '../facts/index.js';
import type { AdmissionReservation, DispatchClaim, FenceToken, TransportAuthority } from '../transport/index.js';

declare const owned: unique symbol;
interface Owned { readonly [owned]: 'part-eight' }
interface RecordIdentity extends Owned { readonly type: string; readonly schemaVersion: 1; readonly id: string }
export interface OperationDefinition extends RecordIdentity {
  readonly type: 'OperationDefinition'; readonly feature: string; readonly version: string;
  readonly generation: string; readonly adapter: string; readonly account: string;
  readonly conversation: string; readonly speaker: string; readonly scopeDigest: string;
  readonly durability: 'replicated' | 'local-durable'; readonly replicas: number;
  readonly lossModel: string; readonly maxBytes: number; readonly maxCharge: number;
  readonly timeout: number; readonly verificationBar: string;
}
export interface OutboundMessage extends RecordIdentity {
  readonly type: 'OutboundMessage'; readonly semanticMessage: string; readonly run: string;
  readonly speaker: string; readonly account: string; readonly conversation: string;
  readonly text: string; readonly purpose: 'ordinary-reply'; readonly sourceResult: string;
}
export interface EffectRequest extends RecordIdentity {
  readonly type: 'EffectRequest'; readonly definition: string; readonly message: string;
  readonly semanticMessage: string; readonly run: string; readonly pending: string;
  readonly attempt: string; readonly digest: string; readonly verificationOwner: string;
  readonly verificationBar: string; readonly obligation: string;
  readonly closure: readonly string[];
}
export interface EffectValidation extends RecordIdentity {
  readonly type: 'EffectValidation'; readonly request: string; readonly digest: string;
  readonly phase: 'reservation' | 'dispatch'; readonly generation: string;
  readonly definition: string; readonly expires: number; readonly authority: readonly string[];
}
export interface OperationObservation extends RecordIdentity {
  readonly type: 'OperationObservation'; readonly request: string; readonly operation: string;
  readonly claim: string; readonly digest: string; readonly account: string; readonly conversation: string;
  readonly stage: 'executor-accepted' | 'response' | 'unknown' | 'observer-accepted' | 'lookup';
  readonly wake: string;
  readonly capture: { readonly reference: string; readonly hash: string };
  readonly attestation: 'local-recorder';
}
export interface EffectSettlement extends RecordIdentity {
  readonly type: 'EffectSettlement'; readonly request: string; readonly operation: string;
  readonly claim: string; readonly reservation: string; readonly digest: string;
  readonly acceptance: string; readonly observations: readonly string[]; readonly outcome: Outcome;
  readonly finalCharge: number | null; readonly delayedExecutionExcluded: boolean;
  readonly retainedExposure: number; readonly retryEligible: false;
}
export type EffectRecord = OperationDefinition | OutboundMessage | EffectRequest | EffectValidation | OperationObservation | EffectSettlement;

// The host is a scoped assembly dependency, never request-supplied policy.
export interface EffectHost {
  readonly machine: string; readonly incarnation: string; readonly principal: VerifiedPrincipal;
  readonly scope: Scope; readonly boundary: BoundaryContext;
  // Non-waiting local snapshot/clock accessor; never refresh external providers here.
  current(): { readonly decode: DecodeContext; readonly clock: Clock; readonly stopped: boolean;
    readonly versions: readonly GovernedVersion[]; readonly authority: readonly string[] };
  capture(bytes: string): Result<{ readonly reference: string; readonly hash: string }>;
}
export interface EffectSpine {
  readonly store: FactStorePort;
  append(record: EffectRecord, required: readonly string[]): Result<AppendReceipt>;
}
// P10 authenticates its configured peer/custody endpoints; P2 owns each receipt.
// This checks EXACT facts, not a configuration count, quorum or unrelated head.
export interface EffectDurabilityPort {
  readonly owner: 'part-ten';
  ensure(facts: readonly FactEnvelope[]): Result<readonly AppendReceipt[]>;
}
// Current physical custody, separate from durability of the referring facts.
// The assembly binds the declared loss model to authenticated custody endpoints.
export interface EffectCustodyPort {
  readonly owner: 'part-ten';
  verify(captures: readonly OperationObservation['capture'][],
    policy: Pick<OperationDefinition, 'durability' | 'replicas' | 'lossModel'>): Result<void>;
}
export interface OperationAdapterPort {
  readonly owner: 'part-ten'; readonly id: string;
  describe(): Readonly<{ readonly contract: string; readonly account: string; readonly conversation: string;
    readonly maxCharge: number; readonly timeout: number; readonly hiddenRetries: 0 }>;
  invoke(input: { readonly operation: string; readonly claim: string; readonly digest: string;
    readonly message: OutboundMessage }): Result<string>;
  // No claim and no create-if-missing input. This is a bounded read-only query.
  observe(input: { readonly operation: string; readonly digest: string; readonly account: string;
    readonly conversation: string }): Result<string>;
}
// Consumer requirements only, not a replacement nine-owned record or constructor.
// The assembly must bind this port to nine's independent assessor, not the adapter.
export interface EffectAssessmentInput {
  readonly request: EffectRequest; readonly reservation: AdmissionReservation;
  readonly claim: string; readonly observations: readonly OperationObservation[]; readonly bar: string;
}
export interface EffectAssessmentView {
  readonly outcome: Outcome; readonly finalCharge: number | null;
  readonly delayedExecutionExcluded: boolean; readonly required: readonly string[];
}
export interface EffectAssessmentPort {
  readonly owner: 'part-nine';
  assess(input: EffectAssessmentInput): Result<OwnedReference<'part-nine', 'VerificationAssessment'>>;
  read(acceptance: OwnedReference<'part-nine', 'VerificationAssessment'>, input: EffectAssessmentInput): Result<EffectAssessmentView>;
  // Non-waiting, synchronous owner guard, NOT another potentially blocking read.
  // Must establish current binding/availability and hold the complete assessment
  // stable through the callback; no I/O, refresh, yield or reentrant mutation.
  // If this cannot be established immediately, refuse WITHOUT calling consumer.
  // The callback must not wait or defer use. No production guard is inferred from
  // the explicit in-process nine stand-in shipped by this reference slice.
  consumeCurrent<T>(acceptance: OwnedReference<'part-nine', 'VerificationAssessment'>, input: EffectAssessmentInput,
    consumer: (current: EffectAssessmentView) => T): Result<T>;
}
export interface EffectDoorway {
  readonly owner: 'part-eight';
  prepare(input: { readonly definition: string; readonly message: OutboundMessage; readonly run: RunReference;
    readonly pending: string; readonly attempt: string; readonly verificationOwner: string;
    readonly obligation: string; readonly closure: readonly string[]; readonly fence: FenceToken }): Result<EffectRequest>;
  dispatch(request: EffectRequest, fence: FenceToken): Result<OperationObservation>;
  handoff(request: EffectRequest, reservation: AdmissionReservation, claim: DispatchClaim, fence: FenceToken): Result<OperationObservation>;
  observe(operation: string): Result<OwnedReference<'part-eight', 'OperationObservation'>>;
  settle(operation: string): Result<EffectSettlement>;
  inspect(): Result<readonly { readonly fact: FactEnvelope; readonly record: EffectRecord }[]>;
}
export interface EffectComposition {
  readonly host: EffectHost; readonly spine: EffectSpine; readonly transport: TransportAuthority;
  readonly durability: EffectDurabilityPort; readonly adapter: OperationAdapterPort;
  readonly custody: EffectCustodyPort;
  readonly assessment: EffectAssessmentPort | null;
}
export interface EffectAuthor { readonly context: FactContext; readonly privateKey: string }
export type { DurabilityState };
