import type { BoundaryContext, Clock, FactEnvelopeReference, Hash, Json, Result, Scope, VerifiedPrincipal } from '../index.js';
import type { AppendReceipt, ConflictClass, FactContext, FactEnvelope, FactSnapshot, FactStorePort } from '../facts/index.js';
import type { IntakePort } from '../intake/index.js';
import type { JudgmentDoorway, ModelAdapterPort } from '../judgment/index.js';
import type { MinimalDependency, IndependentSurfaceVerifierPort, OperatorSurfacePort, minimalPlaneProjectionIds } from '../operator/index.js';
import type { ProjectionDefinition } from '../projections/index.js';
import type { RunGraphPort } from '../rungraph/index.js';
import type { TransportAuthority } from '../transport/index.js';
import type { EffectDoorway } from '../effects/index.js';
import type { VerificationRuntimePort } from '../verification/index.js';

declare class AssemblyBrand<N extends string> {
  private readonly assemblyValue: N;
  private constructor();
}
type AssemblyValue<N extends string> = AssemblyBrand<N> & Readonly<{
  type: N; schemaVersion: 1; id: string; predecessors: readonly string[]; dependencyFacts: readonly string[];
}>;

export interface AssemblyManifest extends AssemblyValue<'AssemblyManifest'> {
  readonly manifestDigest: Hash; readonly packages: readonly Readonly<{ id: string; digest: Hash; artifact: Hash }>[];
  readonly compatibility: Readonly<{ runtime: string; toolchain: string; platforms: readonly string[]; schemas: readonly string[]; rollback: readonly string[] }>;
  readonly publicPorts: readonly Readonly<{ port: string; version: string; scope: string; implementation: string; artifact: Hash }>[];
  readonly requiredGraph: readonly Readonly<{ consumer: string; dependencies: readonly string[] }>[];
  readonly generation: string; readonly declarationSources: readonly string[]; readonly genesisAnchor: string; readonly trustRoots: readonly string[];
  readonly servicePrincipals: readonly string[]; readonly grants: readonly string[]; readonly custodyPolicies: readonly string[];
  readonly resourcePolicies: readonly Readonly<{ class: 'ordinary' | 'repair' | 'control'; resource: string; limit: number }>[];
  readonly requiredChecks: readonly Readonly<{ tier: 'unit' | 'integration' | 'lifecycle'; ids: readonly string[] }>[];
  /** Additive Part Eleven production bindings. Legacy/non-production manifests omit this field. */
  readonly productionBindings?: readonly AssemblyProductionBindingSet[];
}

export type MinimalPlaneProjectionId = (typeof minimalPlaneProjectionIds)[number];
export type AssemblyRequiredFactBinding = Readonly<{
  readonly reference: string;
  readonly expectedKind: string;
  readonly required: true;
}>;
export type AssemblyImplementationBinding = Readonly<{
  readonly implementation: string;
  readonly fact: AssemblyRequiredFactBinding;
}>;
export type AssemblyProductionBindingSet = Readonly<{
  readonly scope: string;
  /** Signed row-45 activation; omission preserves the landed Part Eleven
   * compatibility fixture while presence requires the real delivery chain. */
  readonly productionGrounding?: Readonly<{ implementation: 'context-delivery-v1' }>;
  readonly surface: Readonly<{
    adapter: AssemblyImplementationBinding;
    challengeVerifier: AssemblyImplementationBinding & Readonly<{ administration: 'independent' }>;
  }>;
  readonly verifiedActIntake: AssemblyImplementationBinding & Readonly<{ operation: 'admitVerifiedAct' }>;
  readonly minimalPlane: Readonly<{
    folds: readonly Readonly<{ projection: MinimalPlaneProjectionId; implementation: string; fact: AssemblyRequiredFactBinding }>[];
    sourceOnlyReplay: AssemblyImplementationBinding;
  }>;
  readonly minimalResponder: AssemblyImplementationBinding & Readonly<{
    budgets: Readonly<{ worker: number; storage: number; queue: number; transport: number; effect: number }>;
  }>;
  readonly dependencies: readonly Readonly<{ name: MinimalDependency; fact: AssemblyRequiredFactBinding }>[];
  readonly lifecycle: Readonly<{ cut: AssemblyImplementationBinding; recovery: AssemblyImplementationBinding }>;
  readonly deliveryWitness: AssemblyImplementationBinding & Readonly<{
    identity: string;
    platform: string;
    requester: string;
    effectAdapter: string;
  }>;
}>;

export interface AssemblyAdmission extends AssemblyValue<'AssemblyAdmission'> {
  readonly manifest: string; readonly manifestDigest: Hash; readonly machine: string; readonly incarnation: string;
  readonly scope: string; readonly sourceGeneration: string; readonly sourceVector: Hash;
  readonly artifacts: readonly string[]; readonly environmentEvidence: readonly string[]; readonly conformance: readonly string[];
  readonly isolationEvidence: readonly string[]; readonly custodyEvidence: readonly string[]; readonly probeEvidence: readonly string[];
  readonly resourceReservation: string; readonly observedAt: number; readonly validUntil: number; readonly priorAdmission: string;
  readonly disposition: 'prepared' | 'active' | 'inhibited' | 'draining' | 'retired'; readonly reason: string; readonly repairOwner: string;
}

export interface HarnessLaunchSpec extends AssemblyValue<'HarnessLaunchSpec'> {
  readonly run: string; readonly step: string; readonly principal: string; readonly incarnation: string;
  readonly harness: string; readonly artifactDigest: Hash; readonly machine: string; readonly workingScope: string;
  readonly processOperation: string; readonly resourceReferences: readonly string[]; readonly portHandles: readonly string[];
  readonly environment: readonly Readonly<{ name: string; valueDigest: Hash }>[];
  readonly contextManifest: readonly Readonly<{ class: string; reference: string; digest: Hash }>[];
  readonly input: string; readonly inputDigest: Hash; readonly consumptionMode: 'model-context-boundary' | 'advisory';
}

/** One immutable delivery attempt against an already-launched process. The
 * launch remains the process identity; this record owns the current step,
 * input, and ordered context delivered under one admitted operation/claim. */
export interface ContextDeliverySpecification extends AssemblyValue<'ContextDeliverySpecification'> {
  readonly launch: string; readonly run: string; readonly step: string; readonly input: string; readonly inputDigest: Hash;
  readonly incarnation: string; readonly harness: string; readonly artifactDigest: Hash; readonly machine: string;
  readonly generation: string; readonly executionContext: string;
  readonly contextManifest: readonly Readonly<{ class: string; reference: string; digest: Hash }>[];
  readonly reason: 'initial' | 'live-input' | 'compaction';
  readonly operation: string; readonly claim: string; readonly previousDelivery: string; readonly controlObservation: string;
}

export interface HarnessObservation extends AssemblyValue<'HarnessObservation'> {
  readonly launch: string; readonly run: string; readonly step: string; readonly input: string; readonly incarnation: string;
  /** Absent only on the original launch-shaped compatibility schema. */
  readonly contextDelivery?: string;
  readonly sourceEvidence: readonly string[]; readonly contextDigests: readonly Hash[]; readonly generation: string;
  readonly causalReferences: readonly string[]; readonly observedAt: number; readonly freshFor: number;
  readonly phase: 'launched' | 'input-accepted' | 'context-consumed' | 'output-observed' | 'pause-observed' | 'exit-observed' | 'refused' | 'uncertain';
  readonly boundaryEvidence: string; readonly detail: string;
}

export type AdapterCapabilityName = 'stable-lookup' | 'application-stage' | 'decisive-non-occurrence' |
  'delayed-execution-exclusion' | 'final-charge' | 'prerequisite-durability';
export interface AdapterEvidenceContract extends AssemblyValue<'AdapterEvidenceContract'> {
  readonly adapter: string; readonly artifact: Hash; readonly parserDeclaration: string; readonly stimulusClass:
    'bot-workspace' | 'device-conversation' | 'web-conversation' | 'webhook' | 'scheduler-ipc' | 'model-provider' | 'host-review' | 'agent-transport';
  readonly authenticatedFields: readonly string[]; readonly authenticationMethod: string; readonly credentialBinding: string;
  readonly senderNamespace: string; readonly conversationNamespace: string; readonly stabilityRules: readonly string[];
  readonly forwardingTreatment: string; readonly impersonationTreatment: string; readonly churnDetector: string; readonly revocationResponse: string;
  readonly eventIdAuthority: string; readonly replayPolicy: string; readonly ackPolicy: 'always' | 'bound-only' | 'never';
  readonly disclosureScopes: readonly string[]; readonly positiveFixtures: readonly string[]; readonly negativeFixtures: readonly string[];
  readonly probes: readonly string[]; readonly capabilities: readonly Readonly<{ name: AdapterCapabilityName; support: 'supported' | 'unsupported'; source: string; predicate: string; subjectBinding: string; horizon: string; budget: number; conformance: string; reason: string }>[];
  readonly contractVersion: string;
}

export interface AdapterConformance extends AssemblyValue<'AdapterConformance'> {
  readonly contract: string; readonly adapter: string; readonly package: string; readonly artifact: Hash; readonly platform: string; readonly mode: string;
  readonly portVersion: string; readonly schemaVersions: readonly string[]; readonly generation: string;
  readonly fixtureDigests: readonly Hash[]; readonly sourceProvenance: readonly string[];
  readonly stageChecks: readonly Readonly<{ stage: string; checkRun: string; positive: readonly string[]; negative: readonly string[] }>[];
  readonly probes: readonly string[]; readonly bars: readonly string[]; readonly limitations: readonly string[];
  readonly testedAt: number; readonly validUntil: number; readonly disposition: 'passed' | 'failed' | 'unsupported';
}

export interface StoreCustodyPolicy extends AssemblyValue<'StoreCustodyPolicy'> {
  readonly governedVersion: string; readonly store: string; readonly locations: readonly Readonly<{ class: string; location: string }>[];
  readonly custodians: readonly string[]; readonly readOperation: string; readonly disclosureScopes: readonly string[];
  readonly grants: readonly string[]; readonly stalenessPolicy: string;
  readonly encryption: Readonly<{ suite: 'AES-256-GCM'; version: string; implementationEvidence: readonly string[] }>;
  readonly wrappingKey: string; readonly dataKeys: readonly Readonly<{ id: string; epoch: number }>[];
  readonly recoveryCustody: string; readonly restoreProcedure: string; readonly rotationProcedure: string; readonly migrationBound: number;
  readonly plaintextRestrictions: readonly string[]; readonly metadataExposure: readonly string[];
  readonly auditBound: number; readonly rateBound: number; readonly resourceBound: number; readonly compromiseResponse: string;
}

export interface StorageAccessObservation extends AssemblyValue<'StorageAccessObservation'> {
  readonly store: string; readonly objectClass: string; readonly requester: string; readonly service: string;
  readonly grant: string; readonly policy: string; readonly generation: string; readonly operation: string;
  readonly observedAt: number; readonly byteCount: number; readonly result: 'allowed' | 'refused' | 'uncertain'; readonly refusalReference: string;
}

export interface LocalCapabilityPackage extends AssemblyValue<'LocalCapabilityPackage'> {
  readonly namespace: string; readonly ownerPrincipal: string; readonly version: string; readonly contentDigest: Hash; readonly sourceDigest: Hash;
  readonly parent: string; readonly upstream: string; readonly priorPackage: string;
  readonly portRequirements: readonly Readonly<{ port: string; version: string }>[];
  readonly dependencies: readonly Readonly<{ package: string; digest: Hash; contract: string }>[];
  readonly entrypoints: readonly Readonly<{ id: string; path: string; digest: Hash }>[];
  readonly declarationIds: readonly string[]; readonly dataScopes: readonly string[]; readonly custodyScopes: readonly string[]; readonly grants: readonly string[];
  readonly resources: readonly Readonly<{ resource: string; limit: number }>[]; readonly platforms: readonly string[]; readonly modes: readonly string[];
  readonly migrationCompatibility: readonly string[]; readonly rollbackCompatibility: readonly string[];
  readonly checks: Readonly<{ unit: readonly string[]; integration: readonly string[]; lifecycle: readonly string[] }>;
  readonly maturation: readonly string[]; readonly probes: readonly string[]; readonly awarenessSource: string;
}

export interface PackageTransition extends AssemblyValue<'PackageTransition'> {
  readonly package: string; readonly manifestDigest: Hash; readonly priorActiveDigest: string; readonly machine: string; readonly scope: string;
  readonly cause: string; readonly responsiblePrincipal: string; readonly grants: readonly string[]; readonly generation: string;
  readonly testEvidence: readonly string[]; readonly migrationEvidence: readonly string[]; readonly probeEvidence: readonly string[];
  readonly operation: string; readonly claim: string; readonly observedArtifactDigest: string;
  readonly from: 'none' | 'staged' | 'validated' | 'eligible' | 'activating' | 'active' | 'inhibited' | 'retired';
  readonly to: 'staged' | 'validated' | 'eligible' | 'activating' | 'active' | 'inhibited' | 'retired'; readonly outstandingWork: readonly string[];
}

export interface GrowthPolicy extends AssemblyValue<'GrowthPolicy'> {
  readonly policyVersion: string; readonly storeScope: string; readonly projectionScope: string;
  readonly subjects: readonly Readonly<{ subject: string; producer: string; unit: string; cadence: number; freshness: number; workloadSizes: readonly number[]; softThreshold: number; hardThreshold: number }>[];
  readonly replayTimeCeiling: number; readonly replayMemoryCeiling: number; readonly loopPolicy: string;
  readonly sampleCap: number; readonly breaker: string; readonly notificationBudget: number; readonly ownerRun: string; readonly diagnosticBudget: string;
}

export interface GrowthObservation extends AssemblyValue<'GrowthObservation'> {
  readonly policy: string; readonly policyGeneration: string; readonly machine: string; readonly subjectScope: string; readonly pinnedVector: Hash;
  readonly assemblyProfile: string; readonly backendProfile: string; readonly hardwareProfile: string;
  readonly startedAt: number; readonly endedAt: number; readonly clockUncertainty: number; readonly workloadSizes: readonly number[];
  readonly measurements: readonly string[]; readonly sampleCount: number; readonly denominator: number; readonly timeouts: number;
  readonly partialScans: number; readonly unavailableInputs: readonly string[];
  readonly comparisons: readonly Readonly<{ subject: string; kind: 'measured' | 'estimate' | 'policy-bound'; value: number; threshold: number; result: 'within' | 'soft-breach' | 'hard-breach' | 'unknown' }>[];
  readonly completion: 'complete' | 'incomplete'; readonly episode: string; readonly investigationRun: string;
}

export type AssemblyRecord = AssemblyManifest | AssemblyAdmission | HarnessLaunchSpec | HarnessObservation |
  AdapterEvidenceContract | AdapterConformance | StoreCustodyPolicy | StorageAccessObservation |
  LocalCapabilityPackage | PackageTransition | GrowthPolicy | GrowthObservation;
export type AssemblyRecordName = AssemblyRecord['type'];
/** Additive history union. AssemblyRecord/AssemblyRecordName intentionally keep
 * their landed compatibility surface so existing exhaustive fixtures retain
 * their exact source and bytes. */
export type AssemblyStoredRecord = AssemblyRecord | ContextDeliverySpecification;
export type AssemblyStoredRecordName = AssemblyStoredRecord['type'];
export interface AssemblyHistoryReadPort {
  readonly owner: 'part-ten';
  current(): Result<readonly CurrentAssemblyFact[]>;
  lookup(reference: string): Result<Readonly<{ fact: FactEnvelope; record?: AssemblyStoredRecord; taint: readonly string[]; conflicts: readonly ConflictClass[]; completeness: 'complete' | 'partial' }> | null>;
  resolve(record: AssemblyRecord): Result<AssemblyHistoryVerdict>;
  /** Additive resolver kept separate so landed narrow fixture implementations remain source-compatible. */
  resolveContextDelivery?(record: ContextDeliverySpecification): Result<AssemblyHistoryVerdict>;
}
export interface AssemblyDecodeContext extends BoundaryContext {
  readonly history?: AssemblyHistoryReadPort;
  readonly validateReferences?: boolean;
  /** Current Part Two context used to run registered owner-body decoders. */
  readonly ownerFacts?: FactContext;
}
export interface AssemblyIdentity { readonly id: string; readonly logicalKey: string; readonly canonicalHash: Hash }
export interface AssemblyFact { readonly fact: FactEnvelope; readonly record: AssemblyStoredRecord }
export interface CurrentAssemblyFact extends AssemblyFact { readonly taint: readonly string[]; readonly conflicts: readonly ConflictClass[] }
export interface AssemblyHistoryVerdict {
  readonly admitted: boolean;
  readonly completeness: 'complete' | 'partial';
  readonly facts: readonly string[];
  readonly conflicts: readonly ConflictClass[];
  readonly missing: readonly string[];
}
export interface AssemblySpine { readonly store: FactStorePort; append(record: AssemblyStoredRecord, required?: readonly string[]): Result<AppendReceipt> }
export interface AssemblyAuthor { readonly context: FactContext; readonly privateKey: string }
export interface AssemblyHost {
  readonly machine: string; readonly principal: VerifiedPrincipal; readonly scope: Scope; readonly boundary: AssemblyDecodeContext;
  current(): Readonly<{ facts: FactContext; generation: string; stopped: boolean; clock: Clock }>;
}

interface FirstInputHarnessAdapterPort {
  readonly owner: 'part-ten'; readonly id: string;
  describe(): Readonly<{ artifact: Hash; platform: string; contextModes: readonly string[]; outputModes: readonly string[]; interruptionModes: readonly string[]; custodyModes: readonly string[]; observationModes: readonly string[]; conformance: string }>;
  launch(spec: HarnessLaunchSpec, operation: string, claim: string): Result<HarnessObservation>;
  deliver(input: Readonly<{ launch: string; intake: string; digest: Hash; incarnation: string; operation: string;
    /** Required by the production arm; omitted only by the landed compatibility arm. */
    contextDelivery?: string; claim?: string }>): Result<HarnessObservation>;
  observe(input: Readonly<{ launch: string; delivery: string; operation: string }>): Result<HarnessObservation>;
}

/** One public adapter family. Version 1 is the retained first-input compatibility arm;
 * continuing hosts require version 2 and cannot advertise a v1 worker as conforming. */
export type HarnessAdapterPort<Version extends 1 | 2 = 1> = Version extends 2
  ? ContinuingHarnessAdapterPort : FirstInputHarnessAdapterPort;

/** Public conversation protocol v2. Custody, queue, admission and cursors belong to the host.
 * All worker operations are asynchronous; the installed driver supplies their finite deadlines. */
export interface HarnessWorkerHandle {
  readonly launch: string; readonly incarnation: string; readonly claim: string;
}
export interface HarnessInputDelivery extends HarnessWorkerHandle {
  readonly operation: string; readonly text: string; readonly digest: string;
  readonly resultPath: string; readonly maxBytes: number;
}
export type HarnessNormalizedObservation =
  | Readonly<{ kind: 'reply'; delivery: string; text: string; digest: string }>
  | Readonly<{ kind: 'turn-end'; delivery: string; state: 'completed' | 'no-reply' | 'uncertain' }>
  | Readonly<{ kind: 'exit' | 'paused'; evidence: string; reason?: string; safetyDeadline?: number }>;
interface ContinuingHarnessAdapterPort {
  describe(): Readonly<{ version: 2; subsequentInput: true; output: 'reply-and-turn-end'; resume: boolean }>;
  launch(input: Readonly<{ operation: string; claim: string; artifact: string; incarnation: string; workingScope: string; restore?: { operation: string; digest: string; deadline: number } }>): Promise<HarnessWorkerHandle>;
  deliver(input: HarnessInputDelivery): Promise<Readonly<{ state: 'accepted' | 'busy-not-dispatched' | 'refused-not-dispatched' | 'uncertain'; evidence: string }>>;
  observe(input: HarnessWorkerHandle & Readonly<{ delivery: HarnessInputDelivery | null; cursor: number; limit: number }>): Promise<Readonly<{
