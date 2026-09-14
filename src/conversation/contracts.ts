import type {
  BoundaryContext, Clock, Hash, ProvenanceInput, RefusalReason, Result, SecretRef,
} from '../index.js';
import type { OwnedReference } from '../index.js';
import type {
  AdapterConformance, AdapterEvidenceContract, AssemblyHistoryReadPort, AssemblyRuntimePort,
} from '../assembly/index.js';
import type { FactStorePort } from '../facts/index.js';
import type { InboundRoute, IntakePort } from '../intake/index.js';
import type { RegisterContext, VerifiedRegister } from '../register/index.js';
import type { VerificationRuntimePort } from '../verification/index.js';
import type {
  EffectAssessmentInput, EffectAssessmentPort, EffectCustodyPort, EffectDoorway, OperationDefinition, OperationObservation,
} from '../effects/index.js';

export type TelegramIngressMode = 'long-poll' | 'webhook';
export type TelegramUpdateKind = 'reply' | 'callback' | 'edit' | 'channel-post' |
  'service-event' | 'media-metadata' | 'unsupported';

export interface TelegramBotDeclaration {
  readonly schemaVersion: 1;
  readonly bot: Readonly<{ id: string; username: string; identityEpoch: string }>;
  readonly token: SecretRef;
  readonly apiVersion: string;
  readonly recordedEndpointChoice?: Readonly<{
    mode: TelegramIngressMode;
    signedChoice: Readonly<{ owner: 'part-two'; name: 'FactEnvelope'; id: string }>;
    endpointAvailabilityEvidence: readonly string[];
    captureBeforeResponseEvidence: readonly string[];
  }>;
  readonly cursor: Readonly<{
    contractVersion: string;
    initialOffset: number;
    maxBatchItems: number;
    maxPollSeconds: number;
  }>;
  readonly limits: Readonly<{
    maxUpdateBytes: number;
    maxReplyCharacters: 4096;
    maxReplyBytes: number;
    maxEntities: number;
    maxConcurrentPolls: 1;
    maxCharge: number;
    timeout: number;
  }>;
  readonly supportedOperations: readonly ['ordinary-reply'];
}

export interface TelegramIdentityProbe {
  readonly botId: string;
  readonly username: string;
  readonly apiVersion: string;
  readonly authenticated: true;
  readonly observedAt: number;
  readonly freshFor: number;
  readonly reference: string;
  readonly capture: Readonly<{ reference: string; hash: Hash }>;
}

export interface TelegramPolledBatch {
  readonly updates: readonly string[];
  readonly response: Readonly<{ reference: string; hash: Hash }>;
}

export interface TelegramBotApiCustodianPort {
  readonly owner: 'part-ten';
  readonly id: string;
  identity(input: Readonly<{ token: SecretRef; apiVersion: string }>): Result<TelegramIdentityProbe>;
  readCapture(reference: string): Result<string>;
  authenticate(input: Readonly<{
    token: SecretRef; apiVersion: string; raw: string; route: InboundRoute; at: Clock;
  }>): Result<ProvenanceInput>;
  poll(input: Readonly<{
    token: SecretRef; apiVersion: string; offset: number; limit: number; timeout: number;
  }>): Result<TelegramPolledBatch>;
  sendMessage(input: Readonly<{
    token: SecretRef; apiVersion: string; chatId: string; messageThreadId: number | null;
    text: string; parseMode: 'HTML'; timeout: number; hiddenRetries: 0;
  }>): Result<string>;
}

export interface TelegramAdmissionEvidence {
  readonly package: string;
  readonly artifact: Hash;
  readonly parserDeclaration: string;
  readonly fixtureDigests: readonly Hash[];
  readonly sourceProvenance: readonly string[];
  readonly stages: readonly Readonly<{
    stage: string; checkRun: string; positive: readonly string[]; negative: readonly string[];
  }>[];
  readonly bars: readonly string[];
  readonly validFor: number;
  readonly positiveFixtures: readonly string[];
  readonly negativeFixtures: readonly string[];
}

export interface TelegramAdmissionDependencies {
  readonly boundary: BoundaryContext;
  readonly governance: Readonly<{ register: VerifiedRegister; context: RegisterContext }>;
  readonly assembly: AssemblyRuntimePort;
  readonly history: AssemblyHistoryReadPort;
  readonly verification: VerificationRuntimePort;
  readonly api: TelegramBotApiCustodianPort;
  readonly clock: () => Clock;
  readonly generation: string;
  readonly evidence: TelegramAdmissionEvidence;
}

export interface AdmittedTelegramAdapter {
  readonly id: string;
  readonly account: string;
  readonly mode: TelegramIngressMode;
  readonly declaration: TelegramBotDeclaration;
  readonly probe: TelegramIdentityProbe;
  readonly contract: AdapterEvidenceContract;
  readonly conformance: AdapterConformance;
}

export interface TelegramConversationTarget {
  readonly chatId: string;
  readonly forum: boolean;
  readonly messageThreadId: number | null;
}

export type TelegramDeliveryClaim = 'provider-accepted' | 'human-delivered' | 'human-read';
export type TelegramDeliveryStatusForm = 'word' | 'emoji';

export interface TelegramReplyAssessmentDependencies {
  readonly admitted: AdmittedTelegramAdapter;
  readonly api: TelegramBotApiCustodianPort;
  readonly target: TelegramConversationTarget;
  readonly effects: Pick<EffectDoorway, 'owner' | 'inspect'>;
  readonly assessment: EffectAssessmentPort;
  readonly verification: VerificationRuntimePort;
  readonly custody: EffectCustodyPort;
  readonly definition: OperationDefinition;
  readonly boundary: BoundaryContext;
}

export interface TelegramReplyAssessmentInput {
  readonly effect: EffectAssessmentInput;
  readonly claim: TelegramDeliveryClaim;
  readonly existing: OwnedReference<'part-nine', 'VerificationAssessment'> | null;
}

export interface TelegramProviderAcceptance {
  readonly assessment: OwnedReference<'part-nine', 'VerificationAssessment'>;
  readonly stage: 'provider-accepted';
  readonly sourceStage: 'response';
  readonly operation: string;
  readonly account: string;
  readonly conversation: string;
  readonly digest: string;
  readonly observation: string;
  readonly evidence: readonly string[];
  readonly unsupported: readonly ['human-delivered', 'human-read'];
}

export interface TelegramDeliveryStatus {
  readonly stage: 'provider-accepted';
  readonly sourceStage: 'response';
  readonly form: TelegramDeliveryStatusForm;
  readonly text: 'accepted by platform' | '📨';
  readonly accessibleLabel: 'accepted by platform';
  readonly legend: 'accepted by platform';
  readonly assessment: OwnedReference<'part-nine', 'VerificationAssessment'>;
  readonly observation: string;
}

export interface TelegramExtractedUpdate {
  readonly updateId: number;
  readonly kind: TelegramUpdateKind;
  readonly route: InboundRoute;
  readonly conversation: string;
  readonly target: TelegramConversationTarget;
  readonly principal: Readonly<{ id: string; kind: 'person' | 'system' }>;
}

export interface TelegramIntakeOutcome {
  readonly updateId: number;
  readonly kind: TelegramUpdateKind;
  readonly route: InboundRoute;
  readonly custody: 'durable';
  readonly receipt: string;
  readonly intake: 'admitted' | 'duplicate' | 'stopped' | 'stop-signal' | 'owned-refusal';
  readonly preserved: string;
  readonly refusalReason: RefusalReason | '';
}

export interface TelegramPollCycle {
  readonly requestedOffset: number;
  readonly committedThrough: number | null;
  readonly nextOffset: number;
  readonly captured: readonly TelegramIntakeOutcome[];
  readonly blockedOnUpdate: number | null;
}

export interface TelegramWebhookOutcome {
  readonly protocolAcknowledgment: 'success';
  readonly captured: TelegramIntakeOutcome;
}

export interface TelegramIngressDependencies {
  readonly boundary: BoundaryContext;
  readonly admitted: AdmittedTelegramAdapter;
  readonly api: TelegramBotApiCustodianPort;
  readonly intake: IntakePort;
  readonly facts: FactStorePort;
  readonly observer: string;
}
