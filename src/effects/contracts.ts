import type { BoundaryContext, Clock, DecodeContext, Outcome, OwnedReference, Refused, Result, RunReference, Scope, VerifiedPrincipal } from '../index.js';
import type { AppendReceipt, DurabilityState, FactContext, FactEnvelope, FactStorePort, GovernedVersion } from '../facts/index.js';
import type { AdmissionReservation, DispatchClaim, FenceToken, TransportAuthority } from '../transport/index.js';

declare const owned: unique symbol;
interface Owned { readonly [owned]: 'part-eight' }
interface RecordIdentity extends Owned { readonly type: string; readonly schemaVersion: 1; readonly id: string }

export type EffectPurpose = 'requested-result' | 'required-action' | 'ordinary-reply' | 'infrastructure-receipt';
export type ConversationEffectKind = 'post-text' | 'post-media' | 'edit-message' | 'react' | 'create-topic' |
  'acknowledge' | 'fetch-inbound-media' | 'derive-transcript';
export type RecoveryEffectKind = 'process-control' | 'scheduler-control' | 'account-route-change' |
  'configuration-change' | 'filesystem-mutation' | 'git-mutation' | 'infrastructure-notice';
export type EffectPayloadKind = 'ordinary-reply' | ConversationEffectKind | RecoveryEffectKind;
export interface ObservationCapabilities {
  readonly occurrence: string; readonly nonOccurrence: string; readonly quiescence: string; readonly charge: string;
}

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

interface EffectPayloadIdentity extends Owned {
  readonly type: 'EffectPayload'; readonly schemaVersion: 1; readonly id: string;
  readonly kind: ConversationEffectKind | RecoveryEffectKind; readonly semanticMessage: string;
  readonly run: string; readonly step: string; readonly sourceResult: string;
  readonly logicalEffect: string; readonly targetDigest: string;
}
interface ConversationPayload extends EffectPayloadIdentity {
  readonly kind: ConversationEffectKind; readonly speaker: string; readonly account: string;
  readonly conversation: string; readonly purpose: EffectPurpose;
}
export interface PostTextPayload extends ConversationPayload { readonly kind: 'post-text'; readonly text: string }
export interface PostMediaPayload extends ConversationPayload {
  readonly kind: 'post-media'; readonly caption: string;
  readonly attachments: readonly Readonly<{ capture: { reference: string; hash: string }; mediaType: string; bytes: number; filename: string }>[];
}
export interface EditMessagePayload extends ConversationPayload { readonly kind: 'edit-message'; readonly targetMessage: string; readonly text: string }
export interface ReactPayload extends ConversationPayload { readonly kind: 'react'; readonly targetMessage: string; readonly reaction: string }
export interface CreateTopicPayload extends ConversationPayload {
  readonly kind: 'create-topic'; readonly parentConversation: string; readonly title: string;
  readonly attributes: readonly Readonly<{ key: string; value: string }>[];
}
export interface AcknowledgePayload extends ConversationPayload {
  readonly kind: 'acknowledge'; readonly inboundFact: string;
  readonly acknowledgment: 'reaction' | 'read-receipt' | 'typing' | 'text'; readonly value: string; readonly decorative: true;
}
export interface FetchInboundMediaPayload extends ConversationPayload {
  readonly kind: 'fetch-inbound-media'; readonly inboundReceipt: string; readonly platformFile: string;
  readonly maximumBytes: number; readonly mediaTypes: readonly string[];
}
export interface DeriveTranscriptPayload extends ConversationPayload {
  readonly kind: 'derive-transcript'; readonly sourceCapture: { readonly reference: string; readonly hash: string };
  readonly providerOperation: string; readonly model: string; readonly maximumOutputBytes: number;
  readonly destinationStep: string; readonly originatingIntake: string;
}
export interface ProcessControlPayload extends EffectPayloadIdentity {
  readonly kind: 'process-control'; readonly action: 'start' | 'interrupt' | 'terminate' | 'close' | 'compact';
  readonly machine: string; readonly processId: string; readonly processIncarnation: string;
  readonly parentIdentity: string; readonly startIdentity: string; readonly executable: string; readonly arguments: readonly string[];
}
export interface SchedulerControlPayload extends EffectPayloadIdentity {
  readonly kind: 'scheduler-control'; readonly action: 'pause' | 'resume'; readonly jobId: string;
  readonly jobGeneration: string; readonly finiteScope: string; readonly undoOperation: string; readonly reviewAt: number;
}
export interface AccountRouteChangePayload extends EffectPayloadIdentity {
  readonly kind: 'account-route-change'; readonly routeRun: string; readonly provider: string;
  readonly fromAccount: string; readonly toAccount: string; readonly sourceGeneration: string; readonly rollbackRoute: string;
}
export interface ConfigurationChangePayload extends EffectPayloadIdentity {
  readonly kind: 'configuration-change'; readonly canonicalTarget: string; readonly expectedPriorDigest: string;
  readonly proposedBytes: string; readonly proposedDigest: string; readonly undoReference: string;
}
export interface FilesystemMutationPayload extends EffectPayloadIdentity {
  readonly kind: 'filesystem-mutation'; readonly action: 'create' | 'replace' | 'move' | 'remove';
  readonly fileTargets: readonly Readonly<{ canonicalPath: string; resolvedPath: string; ancestryDigest: string; priorDigest: string }>[];
  readonly proposedBytes: string; readonly proposedDigest: string; readonly undoSemantics: string; readonly protectedTargetPolicy: string;
}
export interface GitMutationPayload extends EffectPayloadIdentity {
  readonly kind: 'git-mutation'; readonly action: 'checkout' | 'branch-create' | 'branch-delete' | 'commit' | 'merge' |
    'rebase' | 'reset' | 'tag-create' | 'tag-delete' | 'worktree-add' | 'worktree-remove' | 'push';
  readonly repository: string; readonly worktree: string; readonly ref: string; readonly base: string;
  readonly targets: readonly string[]; readonly expectedHeads: readonly Readonly<{ ref: string; digest: string }>[];
  readonly rollbackConstraints: readonly string[];
}
export interface InfrastructureNoticePayload extends EffectPayloadIdentity {
  readonly kind: 'infrastructure-notice'; readonly notice: 'action-needed' | 'result';
  readonly infrastructureProvenance: string; readonly causalEpisode: string; readonly text: string;
}
export type TypedEffectPayload = PostTextPayload | PostMediaPayload | EditMessagePayload | ReactPayload |
  CreateTopicPayload | AcknowledgePayload | FetchInboundMediaPayload | DeriveTranscriptPayload |
  ProcessControlPayload | SchedulerControlPayload | AccountRouteChangePayload | ConfigurationChangePayload |
  FilesystemMutationPayload | GitMutationPayload | InfrastructureNoticePayload;
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

export type AggregateEvidenceStage = 'occurrence' | 'non-occurrence' | 'quiescence' | 'charge' | 'complete';
export type AggregateChildDisposition = 'pending' | 'partial' | 'satisfied' | 'refused' | 'uncertain';
export interface OrderedEffectAggregate extends RecordIdentity {
  readonly type: 'OrderedEffectAggregate'; readonly aggregate: string; readonly revision: number; readonly predecessor: string;
  readonly semanticMessage: string; readonly run: string;
  readonly children: readonly Readonly<{ order: number; request: string; digest: string; payloadKind: EffectPayloadKind;
    demandedStage: AggregateEvidenceStage; inhibitLater: boolean; required: boolean }>[];
  readonly settlements: readonly Readonly<{ request: string; settlement: string; assessment: string;
    disposition: AggregateChildDisposition; applied: boolean;
    refusal?: Readonly<Pick<Refused, 'reason' | 'detail' | 'site' | 'failDirection' | 'preserved'>> }>[];
  readonly state: 'pending' | 'partial' | 'satisfied' | 'refused' | 'uncertain';
  readonly openEvidence: readonly string[]; readonly openCharge: readonly string[]; readonly openRecovery: readonly string[];
  readonly reconciliationOwner: string;
}
export type EffectRecord = OperationDefinition | OutboundMessage | TypedEffectPayload | EffectRequest | EffectValidation |
  OperationObservation | EffectSettlement | OrderedEffectAggregate;

export interface EffectHost {
  readonly machine: string; readonly incarnation: string; readonly principal: VerifiedPrincipal;
  readonly scope: Scope; readonly boundary: BoundaryContext;
  current(): { readonly decode: DecodeContext; readonly clock: Clock; readonly stopped: boolean;
    readonly versions: readonly GovernedVersion[]; readonly authority: readonly string[] };
  capture(bytes: string): Result<{ readonly reference: string; readonly hash: string }>;
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
  createAggregate(input: { readonly semanticMessage: string; readonly run: RunReference;
    readonly children: readonly Readonly<{ request: EffectRequest; demandedStage: AggregateEvidenceStage;
      inhibitLater: boolean; required: boolean }>[]; readonly reconciliationOwner: string }): Result<OrderedEffectAggregate>;
  updateAggregate(input: { readonly aggregate: string; readonly request: string;
    readonly settlement?: EffectSettlement; readonly refusal?: Refused }): Result<OrderedEffectAggregate>;
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
