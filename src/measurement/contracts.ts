import type { Clock, Evidence, Hash, Measurement, Result } from '../index.js';
import type { FactSnapshot } from '../facts/index.js';
import type { ProjectionDefinition, ProjectionGeneration } from '../projections/index.js';
import type { GrowthObservation, GrowthPolicy } from '../assembly/index.js';

declare class MeasurementPackageBrand<N extends string> {
  private readonly measurementPackageValue: N;
  private constructor();
}

type PackageValue<N extends string> = MeasurementPackageBrand<N> & Readonly<{
  type: N;
  schemaVersion: 2;
}>;

export type MeasurementFamily = 'model-call' | 'cumulative-model-session' | 'quota' |
  'rate-limit-event' | 'resource' | 'package-cost';
export type QuantityState = 'reported' | 'not-reported' | 'unsupported' | 'missing' | 'failed' | 'legacy-origin-lost';
export type CategoryRelation = 'standalone' | 'subset-of-input' | 'independent-billed';

export interface MeasurementCategory {
  readonly name: string;
  readonly unit: string;
  readonly relation: CategoryRelation;
}

/** A registered producer contract is package policy, never a fact envelope or permission. */
export interface MeasurementProducerContract extends PackageValue<'MeasurementProducerContract'> {
  readonly id: string;
  readonly family: MeasurementFamily;
  readonly subjectKind: string;
  readonly producer: string;
  readonly categories: readonly MeasurementCategory[];
  readonly evidencePredicate: string;
  readonly sourceSampleRequired: boolean;
  readonly hardwareProfileRequired: boolean;
}

/** Disposable normalized evidence used by reads. The P1 values remain authoritative. */
export interface QuantityWitness {
  readonly key: string;
  readonly sourceSample: string;
  readonly category: string;
  readonly relation: CategoryRelation;
  readonly measurement: Measurement;
  readonly evidence: Evidence;
  readonly producer: string;
  readonly sourceEvent: string;
  readonly phase: 'partial' | 'final' | 'correction';
  readonly predecessors: readonly string[];
  readonly state: QuantityState;
  readonly hardwareProfile: string | null;
}

export interface QuantityWitnessInput {
  readonly contract: MeasurementProducerContract;
  readonly subjectInstance: string;
  readonly sourceSample: string;
  readonly category: string;
  readonly measurement: unknown;
  readonly evidence: unknown;
  readonly sourceEvent: string;
  readonly phase: 'partial' | 'final' | 'correction';
  readonly predecessors: readonly string[];
  readonly state: QuantityState;
  readonly hardwareProfile: string | null;
}

export interface QuantityOwnerResolution {
  readonly owner: string;
  readonly key: string;
  readonly witnesses: readonly string[];
  readonly amount: number;
  readonly evidence: Evidence;
}

export interface ResolvedQuantity {
  readonly key: string;
  readonly amount: number | null;
  readonly state: 'resolved' | 'unresolved' | 'unavailable';
  readonly witnesses: readonly QuantityWitness[];
  readonly reason: string;
}

export interface AggregateMeasurementsPolicy extends PackageValue<'AggregateMeasurementsPolicy'> {
  readonly id: string;
  readonly sourceKind: string;
  readonly aggregateKind: 'measurement-window-aggregate';
  readonly additiveUnits: readonly string[];
  readonly categories: readonly string[];
  readonly dimensions: readonly string[];
  readonly producer: string;
  readonly scope: string;
}

export interface AggregateMeasurementsRequest {
  readonly policy: AggregateMeasurementsPolicy;
  readonly quantities: readonly ResolvedQuantity[];
  readonly unit: string;
  readonly category: string;
  readonly dimensions: readonly string[];
  readonly producer: string;
  readonly scope: string;
  readonly start: Clock;
  readonly end: Clock;
  readonly evaluationClock: Clock;
  readonly frontier: string;
}

export interface MeasurementAggregate {
  readonly identity: Hash;
  readonly measurement: Measurement;
  readonly amount: number;
  readonly unit: string;
  readonly category: string;
  readonly dimensions: readonly string[];
  readonly members: readonly string[];
  readonly unresolved: readonly string[];
  readonly start: Clock;
  readonly end: Clock;
  readonly evaluationClock: Clock;
  readonly frontier: string;
}

export interface AttributionCandidate {
  readonly attempt: string;
  readonly factReferences: readonly string[];
}

export interface AttributionRequest {
  readonly attempt: string;
  readonly claimed: Readonly<{ feature: string; model: string; machine: string }>;
  readonly evaluationClock: Clock;
  readonly sourceHistory: FactSnapshot;
  readonly candidates: readonly AttributionCandidate[];
}

export interface AttributionResult {
  readonly attempt: string;
  readonly state: 'attributed' | 'unattributed' | 'conflicted';
  readonly feature: string | null;
  readonly model: string | null;
  readonly machine: string | null;
  readonly run: string | null;
  readonly facts: readonly string[];
}

export interface ResourcePoint {
  readonly id: string;
  readonly machine: string;
  readonly processIncarnation: string;
  readonly sourceSample: string;
  readonly at: Clock;
  readonly hardwareProfile: string;
  readonly classifierGeneration: string;
  readonly state: 'observed' | 'missing' | 'failed';
  readonly cpuTimeMs: number | null;
  readonly monotonicIntervalMs: number | null;
  readonly rssBytes: number | null;
  readonly heapBytes: number | null;
  readonly heapState: 'reported' | 'unsupported' | 'missing';
}

export interface ResourceTrend {
  readonly state: 'complete' | 'incomplete';
  readonly points: readonly ResourcePoint[];
  readonly rssDeltaBytes: number | null;
  readonly reasons: readonly string[];
}

export interface ProcessDescriptor {
  readonly processIncarnation: string;
  readonly pid: number;
  readonly startEvidence: string;
  readonly tags: readonly string[];
}

export interface ProcessClassRule {
  readonly className: string;
  readonly requiredTags: readonly string[];
}

export interface ClassifiedFootprint {
  readonly counts: Readonly<Record<string, number>>;
  readonly unclassified: number;
}

export interface BurnAmountSelection {
  readonly id: string;
  readonly version: string;
  readonly source: 'model-exchange' | 'programmatic-event';
  readonly categories: readonly ('input' | 'output')[];
  readonly formula: 'sum';
  readonly outputUnit: string;
  readonly missingCategory: 'no-amount';
}

export interface BurnPolicy extends PackageValue<'BurnPolicy'> {
  readonly id: string;
  readonly version: string;
  readonly feature: string;
  readonly unit: string;
  readonly selections: readonly BurnAmountSelection[];
  readonly minimumEligibleSamples: number;
  readonly minimumUsageCoverage: number;
  readonly entryExcess: number;
  readonly entryShare: number;
  readonly recoveryExcess: number;
  readonly recoveryShare: number;
  readonly recoveryWindows: number;
}

export interface BurnSample {
  readonly identity: string;
  readonly feature: string;
  readonly source: 'model-exchange' | 'programmatic-event';
  readonly selectionVersion: string;
  readonly quantities: readonly ResolvedQuantity[];
}

export interface BurnWindow {
  readonly id: string;
  readonly censusComplete: boolean;
  readonly collectorsComplete: boolean;
  readonly observedExchanges: number;
  readonly usageSupportedExchanges: number;
  readonly attemptedDispatches: number;
  readonly provenNoExchange: number;
  readonly dispatchUncertain: number;
  readonly conflictedAttempts: number;
  readonly programmaticEvents: number;
  readonly samples: readonly BurnSample[];
  readonly comparisonScopeAmount: number;
}

export interface BurnEpisodeState {
  readonly state: 'open' | 'closed';
  readonly recoveryCount: number;
  readonly notified: boolean;
  readonly investigation: string | null;
}

export interface BurnEvaluation {
  readonly classification: 'inactive' | 'incomplete' | 'insufficient-evidence' | 'zero-metered-activity' | 'activity';
  readonly confidence: 'adequate' | 'insufficient-evidence';
  readonly currentAmount: number | null;
  readonly baselineAmount: number | null;
  readonly excess: number | null;
  readonly share: number | null;
  readonly eligibleSampleCount: number;
  readonly coverage: number | null;
  readonly coverageDebt: readonly string[];
  readonly culprit: string | null;
  readonly episode: BurnEpisodeState;
  readonly notify: boolean;
  readonly openInvestigation: boolean;
}

export interface MeasurementReadQuery extends PackageValue<'MeasurementReadQuery'> {
  readonly id: string;
  readonly start: Clock;
  readonly end: Clock;
  readonly evaluationClock: Clock;
  readonly clockBasis: 'utc';
  readonly dimensions: readonly ('family' | 'category' | 'feature' | 'model' | 'machine')[];
  readonly pageSize: number;
  readonly cursor: string | null;
  readonly sort: 'source-time' | 'identity';
  readonly maxExportBytes: number;
  readonly detailHorizonMs: number;
}

export interface MeasurementReadRow {
  readonly identity: string;
  readonly family: MeasurementFamily;
  readonly category: string;
  readonly at: Clock;
  readonly amount: number | null;
  readonly unit: string;
  readonly state: QuantityState | 'unattributed' | 'conflicted';
  readonly producer: string;
  readonly sourceSample: string;
  readonly feature: string | null;
  readonly model: string | null;
  readonly machine: string;
}

export interface MeasurementReadResult {
  readonly query: string;
  readonly rows: readonly MeasurementReadRow[];
  readonly totalCount: number;
  readonly nextCursor: string | null;
  readonly partial: boolean;
  readonly reason: string | null;
  readonly evaluationClock: Clock;
  readonly exportBytes: number;
}

export interface ReadCachePolicy extends PackageValue<'ReadCachePolicy'> {
  readonly id: string;
  readonly maxRows: number;
  readonly maxBytes: number;
  readonly maxAgeMs: number;
  readonly evictionBatch: number;
}

export interface ReadCacheEntry {
  readonly key: string;
  readonly createdAt: Clock;
  readonly bytes: string;
  readonly byteLength: number;
}

export interface BoundedReadCache {
  readonly owner: 'part-sixteen';
  put(entry: ReadCacheEntry): Result<void>;
  get(key: string): Result<ReadCacheEntry | null>;
  planEviction(evaluationClock: Clock): Result<readonly string[]>;
  applyEviction(keys: readonly string[]): Result<number>;
  inspect(): Result<readonly ReadCacheEntry[]>;
}

export interface GrowthInvestigationLink {
  readonly key: string;
  readonly run: string;
  readonly loop: string;
  readonly observations: readonly string[];
}

export interface MeasurementLedgerPort {
  readonly owner: 'part-sixteen';
  resolveQuantity(witnesses: readonly QuantityWitness[], resolution?: QuantityOwnerResolution): Result<ResolvedQuantity>;
  aggregate(request: AggregateMeasurementsRequest): Result<MeasurementAggregate>;
  attribute(request: AttributionRequest): Result<AttributionResult>;
  evaluateBurn(policy: BurnPolicy, previous: BurnEpisodeState, current: BurnWindow, baselines: readonly BurnWindow[]): Result<BurnEvaluation>;
  trend(points: readonly ResourcePoint[], minimumSamples: number): Result<ResourceTrend>;
  read(query: MeasurementReadQuery, rows: readonly MeasurementReadRow[], timedOut?: boolean): Result<MeasurementReadResult>;
}

export interface MeasurementPackageInputs {
  readonly sourceHistory: FactSnapshot;
  readonly projection: Readonly<{ definition: ProjectionDefinition; generation: ProjectionGeneration }>;
  readonly growth: Readonly<{ policy: GrowthPolicy; observations: readonly GrowthObservation[] }>;
}
