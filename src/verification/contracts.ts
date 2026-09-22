import type { Authorization, BoundaryContext, Clock, DecodeContext, Evidence, Hash, Json, OwnedReference, Result, Scope, VerifiedPrincipal } from '../index.js';
import type { AppendReceipt, ConflictClass, FactContext, FactEnvelope, FactStorePort } from '../facts/index.js';

declare class VerificationBrand<N extends string> {
  private readonly verificationValue: N;
  private constructor();
}
type VerificationValue<N extends string, V extends 1 | 2 = 1> = VerificationBrand<N> & Readonly<{
  type: N; schemaVersion: V extends 2 ? 2 : 1 | 2; id: string; predecessors: readonly string[];
}>;

export type HolderArmKind = 'build' | 'runtime' | 'probe' | 'sentinel' | 'retrospective';
export type EvidenceStrength = 'proof' | 'observation' | 'attestation' | 'inference';
export type SettlementVerificationPredicate = 'occurrence' | 'non-occurrence' | 'quiescence' | 'charge';
export type ProviderResponsePredicate = 'response-authenticity' | 'response-completeness';
export type VerificationPredicate = SettlementVerificationPredicate | ProviderResponsePredicate;
export type VerificationVerdict = 'satisfied' | 'contradicted' | 'insufficient';
export type ProbeDisposition = 'passed' | 'failed' | 'inconclusive' | 'not-run' | 'cancelled';
export type GuardPosture = 'healthy' | 'failed' | 'stale' | 'unknown' | 'inactive';

export interface VerificationPlanV1 extends VerificationValue<'VerificationPlan'> {
  readonly subject: Readonly<{ rules: readonly number[]; holder: string; governed: string; scope: string; generation: string }>;
  readonly arms: readonly Readonly<{ id: string; kind: HolderArmKind; executable: string; fixture: string; outputContract: string; canFail: string; required: boolean }>[];
  readonly bar: Readonly<{ version: string; predicates: readonly VerificationPredicate[]; sources: readonly string[]; minimumStrength: EvidenceStrength; subjectDigest: string; captureRequired: boolean; freshness: number; complete: boolean }>;
  readonly independence: Readonly<{ testedPrincipal: string; observerPrincipal: string; witnessController: string; commonFailures: readonly string[] }>;
  readonly scheduling: Readonly<{ owner: string; run: string; loopPolicy: string; cadence: number; freshnessWindow: number; dueAction: string; recoveryBudget: string }>;
  readonly bounds: readonly Readonly<{ resource: string; limit: number }>[];
  readonly consumers: readonly Readonly<{ id: string; direction: 'open' | 'closed'; enforcedRecord: string; decoder: string; preserved: string }>[];
  readonly privacy: Readonly<{ readers: readonly string[]; providers: readonly string[]; captureClass: string; secretCustody: string; destinations: readonly string[] }>;
  readonly activation: Readonly<{ unit: readonly string[]; integration: readonly string[]; lifecycle: readonly string[]; semantic: readonly string[]; limits: readonly string[]; evidence: readonly string[] }>;
}

export interface VerificationRequestV1 extends VerificationValue<'VerificationRequest'> {
  readonly logicalKey: string; readonly operation: string; readonly attempt: string; readonly reservation: string;
  readonly operationDigest: string; readonly scope: string; readonly predicate?: SettlementVerificationPredicate;
  readonly plan: string; readonly barVersion: string; readonly initialEvidence: readonly string[];
  readonly missingEvidence: readonly string[]; readonly owner: string; readonly loop: string;
  readonly createdAt: number; readonly sourceGeneration: string;
}

export interface VerificationAssessmentV1 extends VerificationValue<'VerificationAssessment'> {
  readonly request: string; readonly operation: string; readonly attempt: string; readonly operationDigest: string;
  readonly barVersion: string; readonly observer: string; readonly evidence: readonly string[];
  readonly missingEvidence: readonly string[]; readonly vectorDigest: string; readonly knownLineages: readonly string[];
  readonly captureStatuses: readonly Readonly<{ reference: string; status: 'available' | 'tombstoned' | 'expired' | 'missing' }>[];
  readonly taints: readonly string[];
  readonly predicates: readonly VerificationVerdictRow[];
  readonly validFrom: number; readonly validUntil: number; readonly supersedes: string;
}

export interface ResponseFactReference {
  readonly owner: 'part-two'; readonly name: 'FactEnvelope'; readonly id: string;
  readonly kind: string; readonly schemaVersion: number; readonly contentHash: Hash;
}
export interface ProviderResponseSubject {
  readonly seven: Readonly<{ request: ResponseFactReference; prepared: ResponseFactReference; attempt: string; response: ResponseFactReference }>;
  readonly eight: Readonly<{ request: ResponseFactReference; executorObservation: ResponseFactReference; responseObservation: ResponseFactReference }>;
  readonly six: Readonly<{ operation: string; consumedReservation: ResponseFactReference; dispatchClaim: ResponseFactReference }>;
  readonly submitted: Readonly<{ capture: Readonly<{ reference: string; hash: Hash }>; operationDigest: Hash }>;
  readonly route: Readonly<{ provider: string; model: string; route: string; routeBasis: string; floorDigest: Hash;
    evidence: readonly string[]; evidenceDigest: Hash; settingsDigest: Hash; outputSchemaDigest: Hash }>;
  readonly response: Readonly<{ capture: Readonly<{ reference: string; hash: Hash }>; answerDigest: Hash;
    parserReference: string; parserVersion: string; evidenceContractReference: string; evidenceContractVersion: string }>;
  readonly terminal: Readonly<{ evidence: string; capture: Readonly<{ reference: string; hash: Hash }>;
    rawDigest: Hash; sourceEvidence: readonly string[] }>;
}
export interface ProviderResponseRequirement {
  readonly predicate: ProviderResponsePredicate; readonly sources: readonly string[];
  readonly minimumStrength: EvidenceStrength; readonly requiredContract: string;
}
export interface VerificationVerdictRow<P extends VerificationPredicate = VerificationPredicate> {
  readonly predicate: P; readonly verdict: VerificationVerdict; readonly reason: string;
  readonly evidence: readonly string[]; readonly decision: string;
}
export interface ProviderResponseVerificationPlan extends VerificationValue<'VerificationPlan', 2> {
  readonly purpose: 'output-use';
  readonly subject: VerificationPlanV1['subject']; readonly arms: VerificationPlanV1['arms'];
  readonly bar: Readonly<{ version: string; predicates: readonly VerificationPredicate[]; sources: readonly string[];
    minimumStrength: EvidenceStrength; subjectDigest: string; captureRequired: true; freshness: number; complete: boolean }>;
  readonly independence: VerificationPlanV1['independence']; readonly scheduling: VerificationPlanV1['scheduling'];
  readonly bounds: VerificationPlanV1['bounds']; readonly consumers: VerificationPlanV1['consumers'];
  readonly privacy: VerificationPlanV1['privacy']; readonly activation: VerificationPlanV1['activation'];
  readonly responseContract: Readonly<{ parserReference: string; parserVersion: string;
    evidenceContractReference: string; evidenceContractVersion: string; mode: 'single-final-reply' }>;
  readonly responseRequirements: readonly ProviderResponseRequirement[];
}
export interface ProviderResponseVerificationRequest extends VerificationValue<'VerificationRequest', 2> {
  readonly purpose: 'output-use'; readonly logicalKey: string; readonly operation: string; readonly attempt: string;
  readonly reservation: string; readonly operationDigest: string; readonly scope: string;
  readonly predicate?: SettlementVerificationPredicate;
  readonly predicates: readonly ProviderResponsePredicate[]; readonly subject: ProviderResponseSubject;
  readonly plan: string; readonly barVersion: string; readonly initialEvidence: readonly string[];
  readonly missingEvidence: readonly string[]; readonly owner: string; readonly loop: string;
  readonly createdAt: number; readonly sourceGeneration: string;
}
export interface ProviderResponseVerificationAssessment extends VerificationValue<'VerificationAssessment', 2> {
  readonly purpose: 'output-use'; readonly request: string; readonly operation: string; readonly attempt: string;
  readonly operationDigest: string; readonly subject: ProviderResponseSubject; readonly barVersion: string;
  readonly observer: string; readonly evidence: readonly string[]; readonly missingEvidence: readonly string[];
  readonly vectorDigest: string; readonly knownLineages: readonly string[];
  readonly captureStatuses: VerificationAssessmentV1['captureStatuses']; readonly taints: readonly string[];
  readonly predicates: readonly VerificationVerdictRow[]; readonly validFrom: number; readonly validUntil: number;
  readonly supersedes: string;
}
// The original public names remain the v1 settlement contracts. Generic record
// paths use the explicit version union below; legacy callers are not silently
// widened into output-use issuance.
export type VerificationPlan = VerificationPlanV1;
export type VerificationRequest = VerificationRequestV1;
export type VerificationAssessment = VerificationAssessmentV1;
export type VersionedVerificationPlan = VerificationPlan | ProviderResponseVerificationPlan;
export type VersionedVerificationRequest = VerificationRequest | ProviderResponseVerificationRequest;
export type VersionedVerificationAssessment = VerificationAssessment | ProviderResponseVerificationAssessment;

export interface ProbeRecord extends VerificationValue<'ProbeRecord'> {
  readonly plan: string; readonly planVersion: string; readonly arm: string; readonly slot: string; readonly attempt: string;
  readonly subject: string; readonly challengeDigest: string; readonly run: string; readonly operation: string;
  readonly startedAt: number; readonly completedAt: number; readonly witnesses: readonly string[];
  readonly comparison: string; readonly disposition: ProbeDisposition; readonly missingPhases: readonly string[];
  readonly captureStatus: 'available' | 'tombstoned' | 'expired' | 'missing';
  readonly costs: readonly Readonly<{ resource: string; amount: number }>[];
}

export interface RetrospectiveReviewRecord extends VerificationValue<'RetrospectiveReviewRecord'> {
  readonly plan: string; readonly reviewer: string; readonly independenceEvidence: readonly string[];
  readonly populationQuery: string; readonly vectorDigest: string; readonly sourceGeneration: string;
  readonly eligibleCases: readonly string[]; readonly inspected: readonly string[];
  readonly omitted: readonly Readonly<{ caseId: string; reason: string }>[];
  readonly sampling: Readonly<{ seed: string; strata: readonly string[] }>;
  readonly modelAttempts: readonly string[]; readonly decisions: readonly string[];
  readonly findings: readonly Readonly<{ id: string; category: string; severity: string; owner: string; evidence: readonly string[] }>[];
  readonly layerBelow: readonly string[]; readonly nextWork: readonly string[];
  readonly closure: 'open' | 'incomplete' | 'converged'; readonly acceptedResidue: readonly string[];
}

export interface SemanticReviewRecord extends VerificationValue<'SemanticReviewRecord'> {
  readonly edge: string; readonly generation: string; readonly ruleVersion: string;
  readonly holderHash: string; readonly fixtureHash: string; readonly decoderHash: string;
  readonly checkRuns: readonly string[]; readonly evidencePopulation: readonly string[];
  readonly reviewer: string; readonly decision: string; readonly coverageLimits: readonly string[];
  readonly layerBelow: readonly string[]; readonly compliantCases: readonly string[];
  readonly violatingCases: readonly string[]; readonly verdict: 'adequate' | 'partial' | 'inadequate';
}

export interface Grade extends VerificationValue<'Grade'> {
  readonly benchmarkRecord: string; readonly request: string; readonly resolution: string; readonly decision: string;
  readonly criterion: string; readonly planVersion: string; readonly grader: string; readonly gradingDecision: string;
  readonly vectorDigest: string; readonly sourceGeneration: string; readonly inspected: readonly string[];
  readonly missing: readonly string[]; readonly captureStatuses: readonly Readonly<{ reference: string; status: 'available' | 'tombstoned' | 'expired' | 'missing' }>[];
  readonly taints: readonly string[]; readonly window: Readonly<{ start: number; end: number }>;
  readonly conclusion: Readonly<{ assessment: 'supported' | 'contradicted' | 'unverifiable' | 'not-applicable'; reason: string; evidence: readonly string[] }>;
  readonly statedReason: Readonly<{ assessment: 'supported' | 'contradicted' | 'unverifiable' | 'not-applicable'; reason: string; evidence: readonly string[] }>;
  readonly outcome: Readonly<{ assessment: 'met' | 'unmet' | 'pending' | 'unverifiable' | 'not-applicable'; reason: string; evidence: readonly string[] }>;
  readonly processAssessments: readonly Readonly<{ requirement: string; assessment: 'satisfied' | 'violated' | 'unverifiable'; reason: string; evidence: readonly string[] }>[];
  readonly completeness: Readonly<{ assessment: 'complete' | 'incomplete' | 'disputed'; missing: readonly string[]; conflicts: readonly string[] }>;
  readonly supersedes: string;
}

export interface AssessmentClosure extends VerificationValue<'AssessmentClosure'> {
  readonly caseId: string; readonly sourceVectorDigest: string; readonly requiredAssessments: readonly string[];
  readonly dispositions: readonly Readonly<{ assessment: string; disposition: 'assessed' | 'evidence-unavailable-with-reason'; reference: string; reason: string }>[];
  readonly activeDisputes: readonly string[]; readonly terminalResolutions: readonly string[];
  readonly settlements: readonly string[]; readonly reviewer: string; readonly decision: string;
  readonly releasesPin: string;
}

export interface FeedbackDisposition extends VerificationValue<'FeedbackDisposition'> {
  readonly sourceIntent: string; readonly sourceCapture: string; readonly scope: string;
  readonly detectionDecision: string; readonly explicitSubmission: string; readonly relatedCases: readonly string[];
  readonly relatedClaims: readonly string[]; readonly relatedFindings: readonly string[]; readonly classification: string;
  readonly owner: string; readonly improvementRun: string; readonly evidence: readonly string[];
  readonly nextDueAt: number; readonly disposition: 'detected' | 'investigating' | 'improvement-owned' | 'verified-improvement' | 'duplicate-linked' | 'declined-with-reason';
  readonly reason: string; readonly duplicates: readonly string[];
}

export interface BenchmarkEvaluation extends VerificationValue<'BenchmarkEvaluation'> {
  readonly benchmarkRun: string; readonly candidates: readonly string[]; readonly scenarios: readonly string[];
  readonly executions: readonly string[]; readonly inputDigest: string; readonly compatibilityDigest: string;
  readonly criterion: string; readonly grades: readonly string[]; readonly missing: readonly string[];
  readonly cancelled: readonly string[]; readonly refused: readonly string[]; readonly sampleSize: number;
  readonly heldOutGroups: readonly Readonly<{ group: string; sources: readonly string[] }>[];
  readonly costs: readonly Readonly<{ resource: string; amount: number }>[];
  readonly routeDecision: string; readonly selection: string; readonly complete: boolean;
}

export type VerificationRecord = VersionedVerificationPlan | VersionedVerificationRequest | VersionedVerificationAssessment | ProbeRecord |
  RetrospectiveReviewRecord | SemanticReviewRecord | Grade | AssessmentClosure | FeedbackDisposition | BenchmarkEvaluation;
export type VerificationRecordName = VerificationRecord['type'];
export interface VerificationDecodeContext extends BoundaryContext {}
export interface VerificationIdentity { readonly id: string; readonly logicalKey: string; readonly canonicalHash: Hash }
export interface VerificationFact { readonly fact: FactEnvelope; readonly record: VerificationRecord }
export interface CurrentVerificationFact extends VerificationFact {
  readonly taint: readonly string[]; readonly conflicts: readonly ConflictClass[];
}
export interface VerificationSpine {
  readonly store: FactStorePort;
  append(record: VerificationRecord, required?: readonly string[]): Result<AppendReceipt>;
}
export interface VerificationAuthor { readonly context: FactContext; readonly privateKey: string }
export interface VerificationHost {
  readonly machine: string; readonly principal: VerifiedPrincipal; readonly scope: Scope;
  readonly boundary: VerificationDecodeContext;
  // A non-waiting snapshot supplied by the executable assembly. Runtime guards
  // may read it synchronously but cannot refresh providers or mutate the spine.
  current(): Readonly<{ decode: DecodeContext; clock: Clock; generation: string; stopped: boolean;
    facts: FactContext; evidence: readonly Evidence[] }>;
}
export interface VerificationDueItem {
  readonly plan: string; readonly arm: string; readonly instance: string;
  readonly dueAt: number; readonly lastAttempt: string; readonly overdueBy: number;
}
export interface GuardArmStatus {
  readonly arm: string; readonly lastAttempt: string; readonly lastSuccess: string;
  readonly sourceStatus: 'available' | 'unavailable' | 'unknown'; readonly posture: GuardPosture;
}
export interface GuardPostureView {
  readonly plan: string; readonly generation: string; readonly evaluatedAt: number;
  readonly arms: readonly GuardArmStatus[]; readonly posture: GuardPosture;
}
export interface VerificationRuntimePort {
  readonly owner: 'part-nine';
  record<N extends VerificationRecordName>(name: N, input: unknown): Result<Extract<VerificationRecord, { type: N }>>;
  inspect(): Result<readonly VerificationFact[]>;
  inspectCurrent(): Result<readonly CurrentVerificationFact[]>;
  due(now: Clock): Result<readonly VerificationDueItem[]>;
  posture(plan: string, now: Clock): Result<GuardPostureView>;
}
export interface ConsumedProviderResponseAssessment {
  readonly assessment: OwnedReference<'part-nine', 'VerificationAssessment'>;
  readonly assessmentFact: ResponseFactReference;
  readonly subject: ProviderResponseSubject; readonly answerDigest: Hash;
  readonly evidence: readonly string[]; readonly validUntil: number; readonly required: readonly string[];
}
export interface ProviderResponseAssessmentInput {
  readonly plan: string; readonly bar: string; readonly generation: string; readonly subject: ProviderResponseSubject;
}
export interface CapturedProviderDecision {
  readonly owner: 'part-seven'; readonly decision: Json; readonly answerBytes: string;
  readonly answerDigest: Hash; readonly response: ResponseFactReference; readonly responseEvidence: Json;
  readonly required: readonly string[];
}
export interface ProviderDecisionReadPort {
  readonly owner: 'part-seven';
  decodeCapturedProviderDecision(subject: ProviderResponseSubject): Result<CapturedProviderDecision>;
}
export interface ProviderResponseAssessmentPort {
  readonly owner: 'part-nine';
  assess(input: ProviderResponseAssessmentInput): Result<OwnedReference<'part-nine', 'VerificationAssessment'>>;
  consumeProviderResponseAssessment<T>(reference: OwnedReference<'part-nine', 'VerificationAssessment'>,
    subject: ProviderResponseSubject, consumer: (view: ConsumedProviderResponseAssessment) => T): Result<T>;
  consumeEffectSettlementAssessment<T>(reference: OwnedReference<'part-nine', 'VerificationAssessment'>,
    input: import('./effect-consumption.js').EffectSettlementAssessmentInput,
    consumer: (view: import('./effect-consumption.js').ConsumedEffectAssessment) => T): Result<T>;
}
export interface CaptureAdmissionState {
  readonly capacity: number; readonly retained: number; readonly reserved: number;
  readonly repairReserve: number; readonly pinned: readonly Readonly<{ reference: string; bytes: number; reasons: readonly string[] }>[];
}
export interface CaptureAdmissionDecision {
  readonly admitted: boolean; readonly requested: number; readonly remaining: number;
  readonly reason: 'within-capacity' | 'capacity-refused';
}
export interface ProtectedInstallationRequest {
  readonly operation: string; readonly path: string; readonly base: string; readonly proposed: string;
  readonly authorization: Authorization;
}
export interface ProtectionJournalEntry {
  readonly operation: string; readonly requestDigest: Hash; readonly path: string; readonly base: string;
  readonly proposedHash: Hash; readonly authorization: string; readonly priorHash: Hash;
  readonly effectiveHash: Hash; readonly disposition: 'committed' | 'refused'; readonly attestation: string;
}
export interface ProtectionJournalPort {
  readonly owner: 'part-ten'; readonly administration: 'independent' | 'agent-writable';
  query(operation: string): Result<ProtectionJournalEntry | null>;
  transact(input: Readonly<Omit<ProtectionJournalEntry, 'effectiveHash' | 'disposition' | 'attestation'>>,
    apply: () => Result<Hash>): Result<ProtectionJournalEntry>;
}
export interface ProtectedLoaderPort {
  readonly owner: 'part-ten'; readonly administration: 'independent' | 'agent-writable';
  protection(path: string): Result<Readonly<{ exactPath: string; parentWriteDenied: boolean; symlinkSwapDenied: boolean;
    alternateLoaderDenied: boolean; debuggerDenied: boolean; rootPinned: boolean }>>;
  current(path: string): Result<Readonly<{ hash: Hash; base: string }>>;
  install(path: string, expected: Hash, proposed: string): Result<Hash>;
}
export interface ExternalProtectionBrokerPort {
  readonly owner: 'part-nine';
  install(request: ProtectedInstallationRequest): Result<ProtectionJournalEntry>;
  query(operation: string): Result<ProtectionJournalEntry | null>;
  posture(path: string): Result<'protected' | 'unprotected'>;
}
export interface VerificationComparison {
  readonly equal: boolean; readonly conflict?: ConflictClass;
}
export interface VerificationPayloadEnvelope { readonly record: Json }
