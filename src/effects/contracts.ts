import type { BoundaryContext, Clock, DecodeContext, Outcome, OwnedReference, Refused, Result, RunReference, Scope, VerifiedPrincipal } from '../index.js';
import type { AppendReceipt, DurabilityState, FactContext, FactEnvelope, FactStorePort, GovernedVersion } from '../facts/index.js';
import type { AdmissionReservation, DispatchClaim, FenceToken, TransportAuthority } from '../transport/index.js';
import type { ConversationEffectKind, EffectPayloadKind, ObservationCapabilities, RecoveryEffectKind, TypedEffectPayload } from './payloads.js';
import type { AggregateEvidenceStage, OrderedEffectAggregate } from './aggregate.js';
export type { EffectPurpose, ConversationEffectKind, RecoveryEffectKind, EffectPayloadKind, ObservationCapabilities,
  PostTextPayload, PostMediaPayload, EditMessagePayload, ReactPayload, CreateTopicPayload, AcknowledgePayload,
  FetchInboundMediaPayload, DeriveTranscriptPayload, ProcessControlPayload, SchedulerControlPayload,
  AccountRouteChangePayload, ConfigurationChangePayload, FilesystemMutationPayload, GitMutationPayload,
  InfrastructureNoticePayload, TypedEffectPayload } from './payloads.js';
export type { AggregateEvidenceStage, AggregateChildDisposition, OrderedEffectAggregate } from './aggregate.js';

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
  // Absent only from the historical ordinary-reply definition. New definitions
  // pin their exact schema and four independent evidence questions.
  readonly payloadKind?: EffectPayloadKind;
  readonly inputSchema?: string;
  readonly canonicalization?: 'instar-canonical-json-v1';
  readonly observationCapabilities?: ObservationCapabilities;
}

// Deliberately unchanged: the byte-for-byte legacy ordinary-reply payload arm.
export interface OutboundMessage extends RecordIdentity {
  readonly type: 'OutboundMessage'; readonly semanticMessage: string; readonly run: string;
  readonly speaker: string; readonly account: string; readonly conversation: string;
  readonly text: string; readonly purpose: 'ordinary-reply'; readonly sourceResult: string;
}

export type EffectPayload = OutboundMessage | TypedEffectPayload;

export interface EffectRequestBinding {
  readonly subject: string; readonly target: string; readonly sourceVector: string; readonly sourceGeneration: string;
  readonly principal: string; readonly definition: Readonly<{ id: string; version: string }>;
  readonly payload: Readonly<{ id: string; digest: string }>; readonly logicalEffect: string;
  readonly run: string; readonly step: string; readonly lease: string; readonly fence: string;
  readonly reservation: Readonly<{ request: string; attempt: string; charge: number; run: string; semanticMessage: string;
    durability: 'local-durable' | 'replicated'; replicas: number }>;
  readonly claim: Readonly<{ attempt: string; executor: string }>;
}
export interface EffectRequest extends RecordIdentity {
  readonly type: 'EffectRequest'; readonly definition: string; readonly message: string;
  readonly semanticMessage: string; readonly run: string; readonly pending: string;
  readonly attempt: string; readonly digest: string; readonly verificationOwner: string;
  readonly verificationBar: string; readonly obligation: string; readonly closure: readonly string[];
  // Absent on byte-for-byte historical ordinary-reply records.
  readonly payload?: string; readonly payloadDigest?: string; readonly binding?: EffectRequestBinding;
}
export interface EffectValidation extends RecordIdentity {
  readonly type: 'EffectValidation'; readonly request: string; readonly digest: string;
  readonly phase: 'reservation' | 'dispatch'; readonly generation: string;
  readonly definition: string; readonly expires: number; readonly authority: readonly string[];
}
export interface OperationObservation extends RecordIdentity {
  readonly type: 'OperationObservation'; readonly request: string; readonly operation: string;
  readonly claim: string; readonly digest: string; readonly account: string; readonly conversation: string;
  readonly stage: 'executor-accepted' | 'response' | 'refused' | 'unknown' | 'observer-accepted' | 'lookup';
  readonly wake: string; readonly capture: { readonly reference: string; readonly hash: string };
  readonly attestation: 'local-recorder';
  readonly refusal?: Readonly<Pick<Refused, 'reason' | 'detail' | 'site' | 'failDirection' | 'preserved'>>;
}
export interface EffectSettlement extends RecordIdentity {
  readonly type: 'EffectSettlement'; readonly request: string; readonly operation: string;
  readonly claim: string; readonly reservation: string; readonly digest: string;
  readonly acceptance: string; readonly observations: readonly string[]; readonly outcome: Outcome;
  readonly finalCharge: number | null; readonly delayedExecutionExcluded: boolean;
  readonly retainedExposure: number; readonly retryEligible: false;
  readonly refusal?: Readonly<Pick<Refused, 'reason' | 'detail' | 'site' | 'failDirection' | 'preserved'>>;
  readonly retryClosure?: Readonly<{ didNotHappen: boolean; quiescent: boolean; chargeSettled: boolean }>;
}
export interface EffectRefusal extends RecordIdentity {
  readonly type: 'EffectRefusal'; readonly request: string; readonly digest: string; readonly sourceResult: string;
  readonly refusal: Readonly<Pick<Refused, 'reason' | 'detail' | 'site' | 'failDirection' | 'preserved'>>;
}

export type EffectRecord = OperationDefinition | OutboundMessage | TypedEffectPayload | EffectRequest | EffectValidation |
  OperationObservation | EffectSettlement | EffectRefusal | OrderedEffectAggregate;

export interface EffectHost {
  readonly machine: string; readonly incarnation: string; readonly principal: VerifiedPrincipal;
  readonly scope: Scope; readonly boundary: BoundaryContext;
  current(): { readonly decode: DecodeContext; readonly clock: Clock; readonly stopped: boolean;
    readonly versions: readonly GovernedVersion[]; readonly authority: readonly string[] };
  capture(bytes: string): Result<{ readonly reference: string; readonly hash: string }>;
  referenceFacts?(): Result<readonly FactEnvelope[]>;
  resolvePath?(path: string): Result<string>;
}
export interface EffectSpine { readonly store: FactStorePort; append(record: EffectRecord, required: readonly string[]): Result<AppendReceipt> }
export interface EffectDurabilityPort { readonly owner: 'part-ten'; ensure(facts: readonly FactEnvelope[]): Result<readonly AppendReceipt[]> }
export interface EffectCustodyPort {
  readonly owner: 'part-ten';
  verify(captures: readonly OperationObservation['capture'][], policy: Pick<OperationDefinition, 'durability' | 'replicas' | 'lossModel'>): Result<void>;
}
export interface OperationAdapterPort {
  readonly owner: 'part-ten'; readonly id: string;
  describe(): Readonly<{ readonly contract: string; readonly account: string; readonly conversation: string;
    readonly maxCharge: number; readonly timeout: number; readonly hiddenRetries: 0 }>;
  invoke(input: { readonly operation: string; readonly claim: string; readonly digest: string; readonly message: OutboundMessage }): Result<string>;
  // Landed adapters omit these methods. Absence is unsupported before claim.
  describePayload?(): Readonly<{ readonly kinds: readonly (ConversationEffectKind | RecoveryEffectKind)[];
    readonly schemas: readonly string[]; readonly canonicalization: 'instar-canonical-json-v1';
    readonly observations: Readonly<Record<string, ObservationCapabilities>> }>;
  invokePayload?(input: { readonly operation: string; readonly claim: string; readonly digest: string; readonly payload: TypedEffectPayload }): Result<string>;
  observe(input: { readonly operation: string; readonly digest: string; readonly account: string; readonly conversation: string }): Result<string>;
}
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
  consumeCurrent<T>(acceptance: OwnedReference<'part-nine', 'VerificationAssessment'>, input: EffectAssessmentInput,
    consumer: (current: EffectAssessmentView) => T): Result<T>;
}
export interface EffectDoorway {
  readonly owner: 'part-eight';
  prepare(input: { readonly definition: string; readonly message: OutboundMessage; readonly run: RunReference;
    readonly pending: string; readonly attempt: string; readonly verificationOwner: string;
    readonly obligation: string; readonly closure: readonly string[]; readonly fence: FenceToken }): Result<EffectRequest>;
  preparePayload(input: { readonly definition: string; readonly payload: TypedEffectPayload; readonly run: RunReference;
    readonly pending: string; readonly attempt: string; readonly verificationOwner: string;
    readonly obligation: string; readonly closure: readonly string[]; readonly fence: FenceToken }): Result<EffectRequest>;
  adopt(input: { readonly definition: string; readonly message: OutboundMessage; readonly run: RunReference;
    readonly pending: string; readonly attempt: string; readonly verificationOwner: string;
    readonly obligation: string; readonly closure: readonly string[] }): Result<EffectRequest>;
  dispatch(request: EffectRequest, fence: FenceToken): Result<OperationObservation>;
  handoff(request: EffectRequest, reservation: AdmissionReservation, claim: DispatchClaim, fence: FenceToken): Result<OperationObservation>;
  observe(operation: string): Result<OwnedReference<'part-eight', 'OperationObservation'>>;
  settle(operation: string): Result<EffectSettlement>;
  recordRefusal(request: EffectRequest, refusal: Refused): Result<EffectRefusal>;
  createAggregate(input: { readonly semanticMessage: string; readonly run: RunReference;
    readonly children: readonly Readonly<{ request: EffectRequest; demandedStage: AggregateEvidenceStage;
      inhibitLater: boolean; required: boolean }>[]; readonly reconciliationOwner: string }): Result<OrderedEffectAggregate>;
  updateAggregate(input: { readonly aggregate: string; readonly request: string;
    readonly settlement?: EffectSettlement; readonly refusal?: Refused; readonly refusalFact?: string;
    readonly fence?: FenceToken }): Result<OrderedEffectAggregate>;
  nextAggregateChild(aggregate: string): Result<EffectRequest | null>;
  inspect(): Result<readonly { readonly fact: FactEnvelope; readonly record: EffectRecord }[]>;
}
export interface EffectComposition {
  readonly host: EffectHost; readonly spine: EffectSpine; readonly transport: TransportAuthority;
  readonly durability: EffectDurabilityPort; readonly adapter: OperationAdapterPort;
  readonly custody: EffectCustodyPort; readonly assessment: EffectAssessmentPort | null;
}
export interface EffectAuthor { readonly context: FactContext; readonly privateKey: string }
export type { DurabilityState };
