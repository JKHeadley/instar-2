import type { Clock, Evidence, Result } from '../index.js';
import type { CausalFrontier, FactSnapshot } from '../facts/index.js';
import type { ProjectionDefinition, ProjectionGeneration } from '../projections/index.js';
import type {
  AttributionRequest, AttributionResult, BoundedReadCache, BurnEpisodeState, BurnEvaluation,
  BurnPolicy, BurnWindow, MeasurementAggregate, MeasurementProducerContract, MeasurementReadQuery,
  MeasurementReadResult, ReadCachePolicy,
  QuantityOwnerResolution, QuantityWitness, QuantityWitnessInput, ResolvedQuantity,
} from './contracts.js';

/** A witness is usable only while this exact owner-issued history remains current. */
export interface CurrentQuantityWitnessRequest {
  readonly input: QuantityWitnessInput;
  readonly sourceHistory: FactSnapshot;
}

export interface CurrentQuantityResolutionRequest {
  readonly witnesses: readonly QuantityWitness[];
  readonly resolution?: QuantityOwnerResolution;
  readonly sourceHistory: FactSnapshot;
  readonly evaluationClock: Clock;
}

export interface CurrentAggregateMeasurementsRequest {
  readonly policy: import('./contracts.js').AggregateMeasurementsPolicy;
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

/** The exact identity roster asserted by the current burn-population evidence. */
export interface BurnPopulationClaim {
  readonly start: Clock;
  readonly end: Clock;
  readonly evidenceHorizon: Clock;
  readonly censusComplete: boolean;
  readonly collectorsComplete: boolean;
  readonly attemptIdentities: readonly string[];
  readonly observedExchangeIdentities: readonly string[];
  readonly usageSupportedExchangeIdentities: readonly string[];
  readonly provenNoExchangeIdentities: readonly string[];
  readonly dispatchUncertainIdentities: readonly string[];
  readonly conflictedAttemptIdentities: readonly string[];
  readonly programmaticEventIdentities: readonly string[];
  readonly samples: readonly Readonly<{
    identity: string;
    feature: string;
    source: 'model-exchange' | 'programmatic-event';
    selectionVersion: string;
    quantityKeys: readonly string[];
  }>[];
  readonly comparisonScopeAmount: number;
}

export interface CurrentBurnWindowRequest {
  readonly window: BurnWindow;
  readonly sourceHistory: FactSnapshot;
}

export interface HistoricalMeasurementReadRequest {
  readonly sourceHistory: FactSnapshot;
  readonly sourceDefinition: ProjectionDefinition;
  readonly sourceGeneration: ProjectionGeneration;
  readonly query: MeasurementReadQuery;
  readonly producers: readonly MeasurementProducerContract[];
  readonly attributions: readonly AttributionResult[];
  readonly timedOut: boolean;
}

export interface PeerHistoryMeasurementInput {
  readonly peer: string;
  readonly state: 'admitted' | 'missing';
  readonly sourceHistory: FactSnapshot | null;
  readonly sourceHistoryDigest: string | null;
  readonly frontier: CausalFrontier | null;
  readonly frontierDigest: string | null;
  readonly observedAt: Clock | null;
  readonly lastFrontier: string | null;
  readonly quantities: readonly ResolvedQuantity[];
}

export interface PeerHistoryPolicy {
  readonly requiredPeers: readonly string[];
  readonly evaluationClock: Clock;
  readonly maximumClockSkewMs: number;
}

export interface CurrentPeerMeasurementPool {
  readonly state: 'complete' | 'partial';
  readonly members: readonly string[];
  readonly unresolved: readonly string[];
  readonly admittedPeers: readonly string[];
  readonly sourceHistoryDigests: readonly string[];
  readonly frontiers: Readonly<Record<string, string>>;
  readonly missingPeers: readonly Readonly<{
    peer: string;
    lastFrontier: string | null;
    reason: 'missing' | 'clock-skew' | 'unwitnessed-frontier';
  }>[];
}

export interface MeasurementA2Port {
  readonly owner: 'part-sixteen';
  witness(request: CurrentQuantityWitnessRequest): Result<QuantityWitness>;
  resolve(request: CurrentQuantityResolutionRequest): Result<ResolvedQuantity>;
  aggregate(request: CurrentAggregateMeasurementsRequest): Result<MeasurementAggregate>;
  attribute(request: AttributionRequest): Result<AttributionResult>;
  window(request: CurrentBurnWindowRequest): Result<BurnWindow>;
  burn(policy: BurnPolicy, previous: BurnEpisodeState,
    current: BurnWindow, baselines: readonly BurnWindow[]): Result<BurnEvaluation>;
  bindRead(request: Pick<HistoricalMeasurementReadRequest,
    'sourceHistory' | 'sourceDefinition' | 'sourceGeneration'>): Result<Readonly<{
      sourceHistoryDigest: string; sourceProjectionDigest: string; frontier: string;
      registerGeneration: string;
    }>>;
  read(request: HistoricalMeasurementReadRequest): Result<MeasurementReadResult>;
  bindPeer(sourceHistory: FactSnapshot): Result<Readonly<{
    sourceHistoryDigest: string; frontier: CausalFrontier; frontierDigest: string;
  }>>;
  mergePeers(peers: readonly PeerHistoryMeasurementInput[],
    policy: PeerHistoryPolicy): Result<CurrentPeerMeasurementPool>;
  cache(policy: ReadCachePolicy): Result<BoundedReadCache>;
}

/** Evidence stored beside a measurement binds every field that changes a read answer. */
export interface MeasurementObservationClaim {
  readonly amount: number | null;
  readonly category: string;
  readonly sourceSample: string;
  readonly producer: string;
  readonly state: import('./contracts.js').QuantityState;
  readonly occurrenceAt: Clock;
  readonly hardwareProfile: string | null;
}

export interface StoredMeasurementObservation {
  readonly identity: string;
  readonly measurement: unknown;
  readonly evidence: Evidence;
  readonly corrects?: string;
}
