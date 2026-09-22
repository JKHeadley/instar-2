import type { ActionFloor, BoundaryContext, Decision, Hash, OwnedReference, Result, RunReference } from '../index.js';
import type { AppendReceipt, FactContext, FactEnvelope, FactStorePort } from '../facts/index.js';
import type { DispatchClaim, FenceToken, TransportAuthority, TransportHost } from '../transport/index.js';

declare const owned: unique symbol;
interface Owned { readonly [owned]: 'part-seven' }
export interface Capture { readonly reference: string; readonly hash: Hash }
declare const capacityOwned: unique symbol;
export interface CaptureCapacity { readonly [capacityOwned]: 'part-ten'; readonly id: string; readonly maxBytes: number }
interface FactRow { readonly schemaVersion: 1; readonly id: string; readonly predecessor: string }
interface Row extends FactRow { readonly request: string }
export interface JudgmentRequest extends Row, Owned {
  readonly type: 'JudgmentRequest'; readonly logicalKey: string; readonly inputDigest: string;
  readonly run: string; readonly step: string; readonly ordinal: number;
  readonly semanticMessage: string; readonly effectRequest: string;
  readonly point: string; readonly consumer: 'advisory'; readonly generation: string;
  readonly incarnation: string; readonly deadline: number;
  readonly question: Capture; readonly context: Capture; readonly submitted: Capture;
  readonly route: string; readonly evidence: readonly string[];
  readonly maxInputBytes: number; readonly maxOutputBytes: number; readonly maxCharge: number;
}
export interface JudgmentAttemptRecord extends Row, Owned {
  readonly type: 'JudgmentAttemptRecord'; readonly attempt: string;
  readonly phase: 'prepared' | 'dispatch-observed' | 'response-observed' | 'accounting-observed' | 'decode-observed';
  readonly operation?: string; readonly reservation?: string;
  readonly receipt?: Capture;
}
export interface JudgmentResolution extends Row, Owned {
  readonly type: 'JudgmentResolution'; readonly attempt: string;
  readonly disposition: 'decided' | 'refused'; readonly response: string; readonly accounting: string; readonly decoded: string;
}
export type BenchmarkProvenance = Readonly<
  | { readonly kind: 'real'; readonly request: OwnedReference<'part-seven', 'JudgmentRequest'>; readonly generation: string; readonly vector: string }
  | { readonly kind: 'synthetic'; readonly fixture: string; readonly productionDerived: false }
>;
export type BenchmarkDecisionReference = Readonly<
  | { readonly state: 'present'; readonly id: string }
  | { readonly state: 'absent' }
>;
export interface BenchmarkRecord extends FactRow, Owned {
  readonly type: 'BenchmarkRecord';
  readonly provenance: BenchmarkProvenance;
  readonly request: OwnedReference<'part-seven', 'JudgmentRequest'>;
  readonly requestDigest: Hash;
  readonly resolution: OwnedReference<'part-seven', 'JudgmentResolution'>;
  readonly run: string;
  readonly step: string;
  readonly logicalKey: string;
  readonly recordingPrincipal: string;
  readonly sourceGeneration: string;
  readonly scenarioClass: string;
  readonly inputDigest: Hash;
  readonly compatibilityDigest: Hash;
  readonly attempts: readonly OwnedReference<'part-seven', 'JudgmentAttemptRecord'>[];
  readonly captureReferences: readonly Capture[];
  readonly decision: BenchmarkDecisionReference;
  readonly conclusionEvidence: readonly string[];
  readonly reasonEvidence: readonly string[];
  readonly outcomeReferences: readonly string[];
  readonly usageReferences: readonly string[];
}
export interface BenchmarkScenario extends FactRow, Owned {
  readonly type: 'BenchmarkScenario';
  readonly version: string;
  readonly source: OwnedReference<'part-seven', 'BenchmarkRecord'>;
  readonly sourceGrade: OwnedReference<'part-nine', 'Grade'>;
  readonly pinnedGeneration: string;
  readonly pinnedVector: string;
  readonly scenarioClass: string;
  readonly promotionDecision: string;
  readonly replayInput: Capture;
  readonly originalInputHash: Hash;
  readonly transformedInputHash: Hash;
  readonly transformationVersion: string;
  readonly changedSemanticFields: readonly string[];
  readonly unavailableSemanticFields: readonly string[];
  readonly excludedAnswerFields: readonly string[];
  readonly excludedOutcomeFields: readonly string[];
  readonly floorDigest: Hash;
  readonly outputSchemaDigest: Hash;
  readonly evaluationContract: string;
  readonly dataScope: string;
  readonly captureAvailability: 'available' | 'unavailable';
}
export interface BenchmarkCandidate {
  readonly route: string;
  readonly samples: number;
}
export interface BenchmarkScenarioVersion {
  readonly scenario: OwnedReference<'part-seven', 'BenchmarkScenario'>;
  readonly version: string;
}
export interface BenchmarkExecutionDisposition {
  readonly scenario: OwnedReference<'part-seven', 'BenchmarkScenario'>;
  readonly candidate: string;
  readonly ordinal: number;
  readonly disposition: 'completed' | 'refused' | 'cancelled' | 'missing';
  readonly attempt?: OwnedReference<'part-seven', 'JudgmentAttemptRecord'>;
  readonly resolution?: OwnedReference<'part-seven', 'JudgmentResolution'>;
  readonly usage: readonly string[];
  readonly detail?: string;
}
export interface BenchmarkRunRecord extends FactRow, Owned {
  readonly type: 'BenchmarkRunRecord';
  readonly suite: string;
  readonly suiteVersion: string;
  readonly scenarios: readonly BenchmarkScenarioVersion[];
  readonly candidates: readonly BenchmarkCandidate[];
  readonly criterionDigest: Hash;
  readonly inputDigest: Hash;
  readonly compatibilityDigest: Hash;
  readonly heldOutPartition: string;
  readonly run: RunReference;
  readonly startedAt: number;
  readonly stoppedAt: number;
  readonly executions: readonly BenchmarkExecutionDisposition[];
}
export type JudgmentRecord = JudgmentRequest | JudgmentAttemptRecord | JudgmentResolution | BenchmarkRecord | BenchmarkScenario | BenchmarkRunRecord;
export interface JudgmentFact { readonly fact: FactEnvelope; readonly record: JudgmentRecord }
// Concrete custody belongs to ten. No delete, network fetch or release-pin capability.
export interface JudgmentCapturePort {
  readonly owner: 'part-ten';
  reserve(maxBytes: number): Result<CaptureCapacity>;
  /** Append-only bookkeeping close for this port instance's exact, still-unbound
   * token. It never deletes capture bytes or releases a content pin. */
  releaseReserved(capacity: CaptureCapacity): Result<void>;
  putReserved(capacity: CaptureCapacity, bytes: string): Result<Capture>;
  put(bytes: string, maxBytes: number): Result<Capture>;
  read(capture: Capture): Result<string>;
}
// Consumer requirements for ten's approved describe/prepare/exchange port.
// The slice supplies only a deterministic fake-provider realization.
export interface ModelDescription {
  readonly owner: 'part-ten'; readonly provider: string; readonly model: string; readonly route: string;
  readonly automaticRetries: 0; readonly maxInputBytes: number; readonly maxOutputBytes: number;
  readonly maxCharge: number; readonly measured: false; readonly basis: string;
}
export interface ProviderResponseEvidence {
  readonly eligibility: 'admitted' | 'held';
  readonly contract: Readonly<{ parserReference: string; parserVersion: string; evidenceContractReference: string;
    evidenceContractVersion: string; mode: 'single-final-reply'; maxMetadataBytes: number;
    maxRawTerminalBytes: number; maxCaptureBytes: number }>;
  readonly source: Readonly<{ observerPrincipal: string; controller: string; evidence: readonly string[];
    endpoint: string; account: string; credentialReference: string; executableArtifact: string;
    provider: string; model: string; route: string; call: string; request: string; attempt: string;
    operation: string; claim: string; submittedDigest: Hash; strength: 'proof' | 'observation' | 'attestation' | 'inference' }>;
  readonly terminal: Readonly<{ raw: Capture; rawDigest: Hash; evidence: string; reason: string; providerReason: string; observedAt: number;
    limited: boolean; errored: boolean; cancelled: boolean; timedOut: boolean; truncated: boolean; toolCall: boolean }>;
  readonly answer: Readonly<{ source: Capture; extractionContract: string; answerDigest: Hash }>;
}
export interface ProviderObservation {
  readonly state: 'complete' | 'rejected' | 'uncertain'; readonly bytes: string | null;
  readonly providerOperation: string | null;
  readonly usage: { readonly inputTokens: number | null; readonly outputTokens: number | null; readonly charge: number | null; readonly source: string };
  readonly retryBlocked: boolean;
  /** Absent observations retain their legacy settlement meaning but cannot be used as answers. */
  readonly responseEvidence?: ProviderResponseEvidence;
  // Adapter-owned evidence of received-but-unusable output. This never grants
  // answer eligibility; independently valid usage survives capture limitations.
  readonly limitation?: { readonly kind: 'transport-threw' | 'invalid-provider-observation' | 'response-byte-limit'; readonly observedBytesAtLeast: number | null };
}
export interface ModelExchange {
  readonly claim: DispatchClaim; readonly fence: FenceToken; readonly bytes: string;
  readonly deadline: number; readonly incarnation: string;
  // Guarded executor handoff: called only after consuming six's actual claim,
  // before invoking the provider. Failure prevents invocation, retaining exposure.
  readonly recordDispatch: () => Result<void>;
}
export interface ModelAdapterPort {
  readonly owner: 'part-ten';
  describe(): ModelDescription;
  prepare(input: unknown): Result<string>;
  exchange(input: ModelExchange): Promise<Result<ProviderObservation>>;
}
export interface JudgmentHost {
  readonly transport: TransportHost; readonly point: string; readonly floor: ActionFloor;
  readonly description: ModelDescription;
  // Ten refreshes P1's live evidence context from P2's verified fact statuses.
  // This is a disposable context fold, never a second accounting authority.
  refreshFacts(): Result<void>;
}
export interface JudgmentSpine {
  readonly store: FactStorePort;
  append(record: JudgmentRecord, attachments?: Readonly<Record<string, unknown>>): Result<AppendReceipt>;
}
export interface JudgmentBenchmarkReadPort {
  readonly owner: 'part-seven';
  readRecord(id: OwnedReference<'part-seven', 'BenchmarkRecord'>): Result<BenchmarkRecord>;
  readScenario(id: OwnedReference<'part-seven', 'BenchmarkScenario'>): Result<BenchmarkScenario>;
  readRun(id: OwnedReference<'part-seven', 'BenchmarkRunRecord'>): Result<BenchmarkRunRecord>;
  readManifest(request: OwnedReference<'part-seven', 'JudgmentRequest'>): Result<Readonly<{
    request: JudgmentRequest;
    resolution: JudgmentResolution | null;
    decision: Decision | null;
    conclusionEvidence: readonly string[];
    reasonEvidence: readonly string[];
    captureReferences: readonly Capture[];
  }>>;
}
export interface JudgmentPorts {
  readonly host: JudgmentHost; readonly authority: TransportAuthority;
  readonly spine: JudgmentSpine; readonly captures: JudgmentCapturePort;
  readonly model: ModelAdapterPort; readonly boundary: BoundaryContext;
}
export interface QuestionInput {
  readonly id: string; readonly run: RunReference; readonly step: string; readonly ordinal: number;
  readonly semanticMessage: string;
  readonly effectRequest: OwnedReference<'part-eight', 'EffectRequest'>;
  readonly question: string; readonly context: string; readonly evidence: readonly string[]; readonly deadline: number;
}
export interface RecordedAnswer {
  readonly resolution: OwnedReference<'part-seven', 'JudgmentResolution'>;
  readonly decision: Decision;
  // This is NOT five's conditional run acceptance or permission for a business effect.
}
export interface JudgmentDoorway {
  judge(input: QuestionInput, fence: FenceToken): Promise<Result<RecordedAnswer>>;
  resumeRecording(request: string): Result<OwnedReference<'part-seven', 'JudgmentResolution'>>;
  readAnswer(request: string, fence: FenceToken): Result<RecordedAnswer>;
  inspect(): Result<readonly JudgmentFact[]>;
}
export interface JudgmentAuthor { readonly context: FactContext; readonly privateKey: string }
