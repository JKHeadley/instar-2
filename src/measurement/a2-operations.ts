import { compareMeasurements, decode, decodeMeasurement, readEvidence } from '../index.js';
import type { BoundaryContext, Claim, Clock, Evidence, Json, Result } from '../index.js';
import { causalCone } from '../facts/index.js';
import type { CausalFrontier, FactSnapshot, FactStatus } from '../facts/index.js';
import { foldProjection } from '../projections/index.js';
import type { ProjectedView, ProjectionDefinition, ProjectionGeneration } from '../projections/index.js';
import type { JudgmentRecord } from '../judgment/index.js';
import { boundary, encoding, ensure, freeze, take } from './boundary.js';
import { admitMeasurementAmount } from './operations.js';
import {
  decodeAggregateMeasurementsPolicy, decodeBurnPolicy, decodeMeasurementReadQuery,
  isCurrentMeasurementProducerContract,
} from './decode.js';
import type { MeasurementDecodeContext } from './decode.js';
import type {
  AggregateMeasurementsPolicy, AttributionRequest, AttributionResult, BurnEpisodeState,
  BurnEvaluation, BurnPolicy, BurnSample, BurnWindow, MeasurementAggregate,
  MeasurementFamily, MeasurementProducerContract, MeasurementReadResult, MeasurementReadRow,
  QuantityOwnerResolution, QuantityState, QuantityWitness, ResolvedQuantity,
} from './contracts.js';
import type {
  BurnPopulationClaim, CurrentAggregateMeasurementsRequest, CurrentBurnWindowRequest,
  CurrentPeerMeasurementPool, CurrentQuantityResolutionRequest, CurrentQuantityWitnessRequest,
  HistoricalMeasurementReadRequest, MeasurementObservationClaim, PeerHistoryMeasurementInput,
  PeerHistoryPolicy,
} from './a2-contracts.js';

const families = ['model-call', 'cumulative-model-session', 'quota', 'rate-limit-event', 'resource',
  'package-cost', 'programmatic-event'] as const;
const quantityStates = ['reported', 'not-reported', 'unsupported', 'missing', 'failed',
  'legacy-origin-lost'] as const;
const rowFields = ['identity', 'family', 'category', 'at', 'amount', 'unit', 'state', 'producer',
  'sourceSample', 'feature', 'model', 'machine', 'evidence'] as const;

type WitnessDependency = Readonly<{
  sourceHistory: FactSnapshot;
  factId: string;
  contract: MeasurementProducerContract;
  occurrenceAt: Clock;
  registerGeneration: string;
}>;
type QuantityDependency = Readonly<{
  sourceHistory: FactSnapshot;
  witnesses: readonly QuantityWitness[];
  resolution: QuantityOwnerResolution | null;
  registerGeneration: string;
}>;
type WindowDependency = Readonly<{
  sourceHistory: FactSnapshot;
  interval: string;
  observation: string;
  ownerEvidenceDebt: readonly string[];
  registerGeneration: string;
}>;
type EpisodeDependency = Readonly<{
  policy: string;
  window: BurnWindow;
  baselines: readonly BurnWindow[];
  recoveryEligible: boolean;
  recoveryCount: number;
  registerGeneration: string;
}>;

const witnessDependencies = new WeakMap<object, WitnessDependency>();
const quantityDependencies = new WeakMap<object, QuantityDependency>();
const attributionDependencies = new WeakMap<object, Readonly<{
  sourceHistory: FactSnapshot; registerGeneration: string;
}>>();
const windowDependencies = new WeakMap<object, WindowDependency>();
const episodeDependencies = new WeakMap<object, EpisodeDependency>();
const knownProducerContracts = new Map<string, Map<string, MeasurementProducerContract>>();

function rememberProducerContract(contract: MeasurementProducerContract,
  context: MeasurementDecodeContext): void {
  const generation = context.register.generation.id;
  const contracts = knownProducerContracts.get(generation) ?? new Map();
  contracts.set(contract.id, contract);
  knownProducerContracts.set(generation, contracts);
}

function currentKnownProducerContracts(context: MeasurementDecodeContext):
  readonly MeasurementProducerContract[] {
  return [...(knownProducerContracts.get(context.register.generation.id)?.values() ?? [])]
    .filter(contract => isCurrentMeasurementProducerContract(contract, context));
}

function exactObject<T>(input: T, fields: readonly string[], optional: readonly string[] = []):
  asserts input is T & Record<string, unknown> {
  ensure(input !== null && typeof input === 'object' && !Array.isArray(input), 'closed object required');
  const keys = Object.keys(input);
  ensure(keys.every(key => fields.includes(key))
    && fields.filter(field => !optional.includes(field)).every(field => Object.hasOwn(input, field)),
  'undeclared or missing field');
}

function substantive(value: unknown, field: string): asserts value is string {
  ensure(typeof value === 'string' && value.trim().length > 0 && value.length <= 4096,
    `${field} must be bounded substantive text`);
}

function finiteNonnegative(value: unknown, field: string): number {
  ensure(typeof value === 'number' && Number.isFinite(value) && value >= 0,
    `${field} must be finite and nonnegative`);
  return value;
}

function exactTextArray(value: unknown, field: string, maximum = 100_000): readonly string[] {
  ensure(Array.isArray(value) && value.length <= maximum
    && value.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= 4096),
  `${field} must be a bounded substantive text array`);
  ensure(new Set(value).size === value.length, `${field} contains duplicates`);
  return value;
}

function admittedClock(input: Clock, context: MeasurementDecodeContext, field: string): Clock {
  const decoded = take(decodeMeasurement('clock', input, context.types));
  ensure(encoding(decoded).bytes === encoding(input).bytes, `${field} must be an admitted clock`);
  return decoded;
}

function clockOrder(left: Clock, right: Clock, context: BoundaryContext): number {
  return take(compareMeasurements(left, right, context.preserved));
}

function currentGeneration(context: MeasurementDecodeContext, expected: string): void {
  ensure(context.register.generation.id === expected, 'supporting register generation is no longer current');
}

function snapshotFrontier(snapshot: FactSnapshot): CausalFrontier {
  const frontier: Record<string, { epoch: number; position: number }> = {};
  for (const { fact } of snapshot.entries) {
    const prior = frontier[fact.machine];
    if (!prior || fact.segment.epoch > prior.epoch
      || fact.segment.epoch === prior.epoch && fact.segment.position > prior.position)
      frontier[fact.machine] = { epoch: fact.segment.epoch, position: fact.segment.position };
  }
  return Object.fromEntries(Object.entries(frontier).sort(([a], [b]) => a.localeCompare(b)));
}

function validationGeneration(snapshot: FactSnapshot,
  context: MeasurementDecodeContext): ProjectionGeneration {
  const kinds = [...new Set(snapshot.entries.map(row => row.fact.kind))].sort();
  const frontier = snapshotFrontier(snapshot);
  return {
    reference: context.register.generation,
    kinds,
    lineages: Object.fromEntries(Object.entries(frontier).map(([machine, head]) =>
      [machine, { head, observedAt: null, closed: true }])),
  };
}

function validateCurrentSourceHistory(snapshot: FactSnapshot,
  context: MeasurementDecodeContext): void {
  const generation = validationGeneration(snapshot, context);
  const definition: ProjectionDefinition = {
    id: 'measurement.source-current-validation', class: 'informational',
    stalenessBound: 1, retention: 'all-identities',
    decisions: Object.fromEntries(generation.kinds.map(kind =>
      [kind, { kind: 'ignores' as const, reason: 'current-snapshot validation only' }])),
  };
  take(foldProjection(definition, snapshot, generation, context));
}

function activeFactIds(snapshot: FactSnapshot): ReadonlySet<string> {
  const inactive = new Set<string>();
  for (const status of snapshot.entries) {
    if (status.body && typeof status.body === 'object' && !Array.isArray(status.body)) {
      const body = status.body as Record<string, Json>;
      if (typeof body.target === 'string') inactive.add(body.target);
      if (typeof body.corrects === 'string') inactive.add(body.corrects);
    }
  }
  return new Set(snapshot.entries.filter(status => !inactive.has(status.fact.id)).map(status => status.fact.id));
}

function containsCanonical(root: unknown, wanted: unknown, depth = 0,
  budget: { remaining: number } = { remaining: 20_000 }): boolean {
  if (budget.remaining-- <= 0 || depth > 12) return false;
  if (root !== null && typeof root === 'object') {
    if (encoding(root).bytes === encoding(wanted).bytes) return true;
    return Array.isArray(root)
      ? root.some(value => containsCanonical(value, wanted, depth + 1, budget))
      : Object.values(root).some(value => containsCanonical(value, wanted, depth + 1, budget));
  }
  return false;
}

function cleanStatus(status: FactStatus): boolean {
  return status.taint.length === 0 && status.conflicts.length === 0;
}

function statusContaining(snapshot: FactSnapshot, wanted: readonly unknown[], label: string): FactStatus {
  const active = activeFactIds(snapshot);
  const matches = snapshot.entries.filter(status => active.has(status.fact.id) && cleanStatus(status)
    && wanted.every(value => containsCanonical(status.body, value)));
  ensure(matches.length === 1, `${label} must occur once in current clean owner history`);
  return matches[0]!;
}

function resolveAdmittedEvidence(input: Evidence, context: MeasurementDecodeContext,
  label: string, at: Clock): Evidence {
  const candidates = (context.types.evidence ?? []).filter(evidence => evidence.id === input.id);
  ensure(candidates.length > 0, `${label} is no longer admitted`);
  ensure(candidates.every(candidate => encoding(candidate).bytes === encoding(candidates[0]).bytes),
    `${label} is conflicted`);
  ensure(encoding(candidates[0]).bytes === encoding(input).bytes,
    `${label} bytes differ from current admitted evidence`);
  const evidence = take(decode('Evidence', input, context.types));
  take(readEvidence(evidence, at, context.preserved));
  return evidence;
}

function measurementClaim(evidence: Evidence, at: Clock,
  context: MeasurementDecodeContext): Readonly<{
    claim: Claim; value: MeasurementObservationClaim;
  }> {
  const claim = take(readEvidence(evidence, at, context.preserved));
  ensure(claim.value !== null && typeof claim.value === 'object' && !Array.isArray(claim.value),
    'measurement evidence claim value must be a closed object');
  exactObject(claim.value, ['amount', 'category', 'sourceSample', 'producer', 'state',
    'occurrenceAt', 'hardwareProfile']);
  const value = claim.value as unknown as MeasurementObservationClaim;
  ensure(value.amount === null || typeof value.amount === 'number' && Number.isFinite(value.amount)
    && value.amount >= 0, 'measurement evidence amount is malformed');
  substantive(value.category, 'measurement evidence category');
  substantive(value.sourceSample, 'measurement evidence source sample');
  substantive(value.producer, 'measurement evidence producer');
  ensure(quantityStates.includes(value.state), 'measurement evidence state outside closed set');
  ensure(value.hardwareProfile === null || typeof value.hardwareProfile === 'string'
    && value.hardwareProfile.trim().length > 0 && value.hardwareProfile.length <= 4096,
  'measurement evidence hardware profile is malformed');
  const occurrenceAt = admittedClock(value.occurrenceAt, context, 'measurement occurrence clock');
  return freeze({ claim, value: freeze({ ...value, occurrenceAt }) });
}

function witnessCurrent(witness: QuantityWitness, context: MeasurementDecodeContext): WitnessDependency {
  const dependency = witnessDependencies.get(witness);
  ensure(dependency !== undefined, 'quantity witness must come from the current-history constructor');
  currentGeneration(context, dependency.registerGeneration);
  validateCurrentSourceHistory(dependency.sourceHistory, context);
  ensure(isCurrentMeasurementProducerContract(dependency.contract, context),
    'quantity witness producer contract is no longer current');
  const status = statusContaining(dependency.sourceHistory, [witness.measurement, witness.evidence],
    'quantity witness evidence');
  ensure(status.fact.id === dependency.factId, 'quantity witness moved to another history fact');
  resolveAdmittedEvidence(witness.evidence, context, 'quantity witness evidence', witness.measurement.at as Clock);
  return dependency;
}

function quantityCurrent(quantity: ResolvedQuantity,
  context: MeasurementDecodeContext): QuantityDependency {
  const dependency = quantityDependencies.get(quantity);
  ensure(dependency !== undefined, 'quantity must come from current-history resolution');
  currentGeneration(context, dependency.registerGeneration);
  validateCurrentSourceHistory(dependency.sourceHistory, context);
  dependency.witnesses.forEach(witness => witnessCurrent(witness, context));
  if (dependency.resolution !== null)
    resolveAdmittedEvidence(dependency.resolution.evidence, context,
      'quantity resolution evidence', dependency.resolution.evidence.observedAt);
  return dependency;
}

function follows(candidate: QuantityWitness, target: string,
  byId: ReadonlyMap<string, QuantityWitness>, seen = new Set<string>()): boolean {
  if (candidate.predecessors.includes(target)) return true;
  for (const predecessor of candidate.predecessors) {
    if (seen.has(predecessor)) continue;
    seen.add(predecessor);
    const row = byId.get(predecessor);
    if (row && follows(row, target, byId, seen)) return true;
  }
  return false;
}

function heads(witnesses: readonly QuantityWitness[]): readonly QuantityWitness[] {
  const byId = new Map(witnesses.map(row => [row.sourceEvent, row]));
  return witnesses.filter(row => !witnesses.some(other => other.sourceEvent !== row.sourceEvent
    && follows(other, row.sourceEvent, byId)));
}

function canonicalWitnesses(witnesses: readonly QuantityWitness[]): readonly QuantityWitness[] {
  const byId = new Map<string, QuantityWitness>();
  for (const witness of witnesses) {
    const prior = byId.get(witness.sourceEvent);
    ensure(!prior || encoding(prior).bytes === encoding(witness).bytes,
      'observation identity has incompatible content');
    if (!prior) byId.set(witness.sourceEvent, witness);
  }
  return [...byId.values()].sort((a, b) => a.sourceEvent.localeCompare(b.sourceEvent));
}

export function createCurrentQuantityWitness(request: CurrentQuantityWitnessRequest,
  context: MeasurementDecodeContext): Result<QuantityWitness> {
  return boundary('CurrentQuantityWitness', request, context, () => {
    exactObject(request, ['input', 'sourceHistory']);
    exactObject(request.input, ['contract', 'subjectInstance', 'sourceSample', 'category', 'measurement',
      'evidence', 'sourceEvent', 'phase', 'predecessors', 'state', 'hardwareProfile']);
    validateCurrentSourceHistory(request.sourceHistory, context);
    const input = request.input;
    ensure(isCurrentMeasurementProducerContract(input.contract, context),
      'producer contract must remain bound to current registered content');
    substantive(input.subjectInstance, 'quantity subject instance');
    substantive(input.sourceSample, 'quantity source sample');
    substantive(input.sourceEvent, 'quantity source event');
    ensure(['partial', 'final', 'correction'].includes(input.phase),
      'quantity witness phase outside closed set');
    ensure(quantityStates.includes(input.state), 'quantity witness state outside closed set');
    const predecessors = exactTextArray(input.predecessors, 'quantity witness predecessors', 1024);
    const category = input.contract.categories.find(row => row.name === input.category);
    ensure(category !== undefined, 'quantity category is not registered by its producer contract');
    const measurement = take(decodeMeasurement(input.contract.subjectKind, input.measurement, context.types));
    ensure(encoding(measurement).bytes === encoding(input.measurement).bytes,
      'quantity measurement differs from its admitted bytes');
    ensure(measurement.subject.instance === input.subjectInstance,
      'measurement subject instance mismatch');
    ensure(measurement.unit === category.unit && measurement.by === input.contract.producer,
      'measurement unit or producer mismatch');
    ensure(input.contract.sourceSampleRequired ? input.sourceSample.length > 0 : true,
      'registered source sample identity is missing');
    if (input.contract.family === 'model-call' || input.contract.family === 'rate-limit-event'
      || input.contract.family === 'programmatic-event')
      ensure(input.sourceSample === input.subjectInstance,
        'source sample is not bound to the canonical event identity');
    if (input.contract.hardwareProfileRequired) {
      substantive(input.hardwareProfile, 'quantity hardware profile');
      ensure(context.register.entries.includes(input.hardwareProfile),
        'quantity hardware profile is not registered');
    } else ensure(input.hardwareProfile === null,
      'hardware profile is not admitted for this producer contract');
    const evidence = take(decode('Evidence', input.evidence, context.types));
    ensure(encoding(evidence).bytes === encoding(input.evidence).bytes,
      'quantity evidence differs from its admitted bytes');
    ensure(evidence.id === input.sourceEvent && evidence.source === input.contract.producer,
      'evidence event identity or producer mismatch');
    const read = measurementClaim(evidence, measurement.at as Clock, context);
    const claim = read.value;
    ensure(read.claim.subject === input.subjectInstance
      && read.claim.predicate === input.contract.evidencePredicate,
    'evidence binding predicate or subject mismatch');
    ensure(claim.category === category.name && claim.sourceSample === input.sourceSample
      && claim.producer === input.contract.producer && claim.state === input.state
      && claim.hardwareProfile === input.hardwareProfile
      && encoding(claim.occurrenceAt).bytes === encoding(evidence.observedAt).bytes
      && encoding(claim.occurrenceAt).bytes === encoding(measurement.at).bytes,
    'measurement evidence does not bind category, sample, producer, state, hardware, and occurrence time');
    if (input.state === 'reported') {
      take(admitMeasurementAmount({ contract: input.contract, category: input.category,
        amount: measurement.value }, context));
      ensure(Object.is(claim.amount, measurement.value),
        'measurement amount differs from current evidence');
    } else {
      ensure(measurement.value === 0 && claim.amount === null,
        'unavailable quantity carries a usable amount');
    }
    const status = statusContaining(request.sourceHistory, [measurement, evidence],
      'quantity measurement and evidence');
    const facts = request.sourceHistory.entries.map(row => row.fact);
    for (const predecessor of predecessors) {
      const prior = request.sourceHistory.entries.filter(row => containsCanonical(row.body, { ...evidence, id: predecessor }));
      const priorByEvidence = request.sourceHistory.entries.filter(row => {
        const values = (context.types.evidence ?? []).filter(candidate => candidate.id === predecessor);
        return values.some(value => containsCanonical(row.body, value));
      });
      const matches = priorByEvidence.length ? priorByEvidence : prior;
      ensure(matches.length === 1 && causalCone(status.fact, facts).some(fact => fact.id === matches[0]!.fact.id),
        'witness predecessor lacks signed causal succession');
    }
    const key = encoding({ family: input.contract.family, subject: input.subjectInstance,
      sourceSample: input.sourceSample, category: category.name, unit: category.unit,
      relation: category.relation, hardwareProfile: input.hardwareProfile }).hash;
    const witness = freeze({ key, sourceSample: input.sourceSample, category: category.name,
      relation: category.relation, measurement, evidence, producer: input.contract.producer,
      sourceEvent: input.sourceEvent, phase: input.phase, predecessors: [...predecessors].sort(),
      state: input.state, hardwareProfile: input.hardwareProfile });
    witnessDependencies.set(witness, freeze({ sourceHistory: request.sourceHistory,
      factId: status.fact.id, contract: input.contract, occurrenceAt: claim.occurrenceAt,
      registerGeneration: context.register.generation.id }));
    rememberProducerContract(input.contract, context);
    return witness;
  });
}

type ObservationSelection = Readonly<{
  status: FactStatus;
  contract: MeasurementProducerContract;
  measurement: QuantityWitness['measurement'];
  evidence: Evidence;
  claim: MeasurementObservationClaim;
  identity: string;
}>;

function selectObservationRows(sourceHistory: FactSnapshot,
  contracts: readonly MeasurementProducerContract[], evaluationClock: Clock,
  context: MeasurementDecodeContext,
  accepts: (row: ObservationSelection) => boolean): readonly ObservationSelection[] {
  const active = activeFactIds(sourceHistory);
  const selected: ObservationSelection[] = [];
  for (const status of sourceHistory.entries) {
    if (!active.has(status.fact.id) || !cleanStatus(status)
      || status.fact.kind !== 'measurement-observation'
      || status.body === null || typeof status.body !== 'object' || Array.isArray(status.body)) continue;
    const body = status.body as Record<string, Json>;
    if (typeof body.identity !== 'string' || body.measurement === null
      || typeof body.measurement !== 'object' || Array.isArray(body.measurement)
      || body.evidence === null || typeof body.evidence !== 'object'
      || Array.isArray(body.evidence)) continue;
    const rawSubject = (body.measurement as Record<string, Json>).subject;
    ensure(rawSubject !== null && typeof rawSubject === 'object' && !Array.isArray(rawSubject)
      && typeof (rawSubject as Record<string, Json>).kind === 'string',
    'current measurement subject is malformed');
    const measurement = take(decodeMeasurement(
      (rawSubject as Record<string, Json>).kind as string, body.measurement, context.types));
    const evidence = take(decode('Evidence', body.evidence, context.types));
    const initial = measurementClaim(evidence, measurement.at as Clock, context);
    const matches = contracts.filter(contract => isCurrentMeasurementProducerContract(contract, context)
      && contract.subjectKind === measurement.subject.kind
      && contract.producer === measurement.by
      && initial.claim.subject === measurement.subject.instance
      && initial.claim.predicate === contract.evidencePredicate
      && contract.categories.some(category => category.name === initial.value.category
        && category.unit === measurement.unit));
    ensure(matches.length === 1, 'current observation has no unique registered producer contract');
    const contract = matches[0]!;
    const relation = contract.categories.find(category => category.name === initial.value.category)!.relation;
    const identity = encoding({ family: contract.family, subject: measurement.subject.instance,
      sourceSample: initial.value.sourceSample, category: initial.value.category,
      unit: measurement.unit, relation, hardwareProfile: initial.value.hardwareProfile }).hash;
    ensure(body.identity === identity, 'current observation identity is not canonical');
    const row = { status, contract, measurement, evidence, claim: initial.value, identity };
    if (!accepts(row)) continue;
    resolveAdmittedEvidence(evidence, context, 'quantity witness evidence', evaluationClock);
    selected.push(row);
    rememberProducerContract(contract, context);
  }
  return selected;
}

function selectCurrentWitnesses(sourceHistory: FactSnapshot,
  contracts: readonly MeasurementProducerContract[], evaluationClock: Clock,
  supplied: readonly QuantityWitness[], context: MeasurementDecodeContext,
  accepts: (row: ObservationSelection) => boolean): readonly QuantityWitness[] {
  const suppliedByEvent = new Map(supplied.map(witness => [witness.sourceEvent, witness]));
  const rows = selectObservationRows(sourceHistory, contracts, evaluationClock, context, accepts);
  const witnesses = rows.map(row => {
    const suppliedWitness = suppliedByEvent.get(row.evidence.id);
    if (suppliedWitness) {
      ensure(encoding(suppliedWitness.measurement).bytes === encoding(row.measurement).bytes
        && encoding(suppliedWitness.evidence).bytes === encoding(row.evidence).bytes,
      'supplied quantity witness differs from current owner history');
      return suppliedWitness;
    }
    return take(createCurrentQuantityWitness({ sourceHistory, input: {
      contract: row.contract, subjectInstance: row.measurement.subject.instance,
      sourceSample: row.claim.sourceSample, category: row.claim.category,
      measurement: row.measurement, evidence: row.evidence, sourceEvent: row.evidence.id,
      phase: 'final', predecessors: [], state: row.claim.state,
      hardwareProfile: row.claim.hardwareProfile,
    } }, context));
  });
  const selectedEvents = new Set(witnesses.map(witness => witness.sourceEvent));
  ensure(supplied.every(witness => selectedEvents.has(witness.sourceEvent)),
    'supplied quantity witness is outside the complete current selection');
  return canonicalWitnesses(witnesses);
}

function selectedOwnerResolution(key: string, sourceHistory: FactSnapshot,
  evaluationClock: Clock, context: MeasurementDecodeContext): QuantityOwnerResolution | null {
  const active = activeFactIds(sourceHistory);
  const candidates: Array<{ status: FactStatus; resolution: QuantityOwnerResolution }> = [];
  for (const status of sourceHistory.entries) {
    if (!active.has(status.fact.id) || !cleanStatus(status)
      || status.body === null || typeof status.body !== 'object' || Array.isArray(status.body)) continue;
    const rawEvidence = (status.body as Record<string, Json>).evidence;
    if (rawEvidence === null || typeof rawEvidence !== 'object' || Array.isArray(rawEvidence)) continue;
    const rawClaim = (rawEvidence as Record<string, Json>).claim;
    if (rawClaim === null || typeof rawClaim !== 'object' || Array.isArray(rawClaim)) continue;
    if ((rawClaim as Record<string, Json>).subject !== key
      || (rawClaim as Record<string, Json>).predicate !== 'quantity-resolved') continue;
    const evidence = resolveAdmittedEvidence(
      take(decode('Evidence', rawEvidence, context.types)), context,
      'quantity resolution evidence', evaluationClock);
    ensure(typeof evidence.source === 'string',
      'quantity resolution evidence source must be a registered producer identity');
    const claim = take(readEvidence(evidence, evaluationClock, context.preserved));
    ensure(claim.value !== null && typeof claim.value === 'object' && !Array.isArray(claim.value),
      'quantity resolution evidence value is malformed');
    exactObject(claim.value, ['amount', 'witnesses']);
    candidates.push({ status, resolution: freeze({ owner: evidence.source, key,
      witnesses: exactTextArray((claim.value as Record<string, unknown>).witnesses,
        'quantity resolution evidence witnesses', 1024),
      amount: finiteNonnegative((claim.value as Record<string, unknown>).amount,
        'quantity resolution evidence amount'), evidence }) });
  }
  if (candidates.length === 0) return null;
  const facts = sourceHistory.entries.map(row => row.fact);
  const heads = candidates.filter(candidate => !candidates.some(other =>
    other.status.fact.id !== candidate.status.fact.id
      && causalCone(other.status.fact, facts).some(fact => fact.id === candidate.status.fact.id)));
  ensure(heads.length === 1, 'quantity has competing current owner resolutions');
  return heads[0]!.resolution;
}

function validateResolution(resolution: QuantityOwnerResolution, key: string,
  current: readonly QuantityWitness[], sourceHistory: FactSnapshot,
  evaluationClock: Clock, context: MeasurementDecodeContext): QuantityOwnerResolution {
  exactObject(resolution, ['owner', 'key', 'witnesses', 'amount', 'evidence']);
  substantive(resolution.owner, 'quantity resolution owner');
  ensure(resolution.key === key, 'quantity resolution names another quantity');
  const ids = exactTextArray(resolution.witnesses, 'quantity resolution witnesses', 1024);
  const reported = current.filter(row => row.state === 'reported');
  ensure(encoding([...ids].sort()).bytes
    === encoding(reported.map(row => row.sourceEvent).sort()).bytes,
  'quantity resolution does not name every current reported witness');
  const contract = witnessCurrent(reported[0] ?? current[0]!, context).contract;
  ensure(resolution.owner === contract.producer
    && context.types.register.producers.includes(resolution.owner),
  'quantity resolution owner differs from the registered producer');
  take(admitMeasurementAmount({ contract, category: reported[0]?.category ?? current[0]!.category,
    amount: finiteNonnegative(resolution.amount, 'quantity resolution amount') }, context));
  const evidence = resolveAdmittedEvidence(resolution.evidence, context,
    'quantity resolution evidence', evaluationClock);
  ensure(evidence.source === resolution.owner, 'quantity resolution evidence has a foreign producer');
  const claim = take(readEvidence(evidence, evaluationClock, context.preserved));
  exactObject(claim.value, ['amount', 'witnesses']);
  const claimIds = exactTextArray((claim.value as Record<string, unknown>).witnesses,
    'quantity resolution evidence witnesses', 1024);
  ensure(claim.subject === key && claim.predicate === 'quantity-resolved'
    && Object.is((claim.value as Record<string, unknown>).amount, resolution.amount)
    && encoding([...claimIds].sort()).bytes === encoding([...ids].sort()).bytes,
  'quantity resolution evidence does not bind key, amount, and witnesses');
  const status = statusContaining(sourceHistory, [evidence], 'quantity resolution evidence');
  const facts = sourceHistory.entries.map(row => row.fact);
  for (const witness of reported) {
    const dependency = witnessCurrent(witness, context);
    ensure(causalCone(status.fact, facts).some(fact => fact.id === dependency.factId),
      'quantity resolution is not causally later than every competing witness');
  }
  return freeze({ ...resolution, witnesses: [...ids].sort(), evidence });
}

function resolveQuantityFromCurrentHistory(request: CurrentQuantityResolutionRequest,
  context: MeasurementDecodeContext, autoSelectResolution = false): ResolvedQuantity {
  ensure(Array.isArray(request.witnesses) && request.witnesses.length > 0
    && request.witnesses.length <= 1024, 'quantity needs a bounded nonempty witness set');
  validateCurrentSourceHistory(request.sourceHistory, context);
  const evaluationClock = admittedClock(request.evaluationClock, context,
    'quantity evaluation clock');
  const supplied = canonicalWitnesses(request.witnesses);
  ensure(supplied.length === request.witnesses.length, 'duplicate observation identity');
  const key = supplied[0]!.key;
  ensure(supplied.every(row => row.key === key), 'quantity witnesses use different quantity keys');
  const contracts = new Map<string, MeasurementProducerContract>();
  for (const witness of supplied) {
    const dependency = witnessCurrent(witness, context);
    ensure(dependency.sourceHistory === request.sourceHistory,
      'quantity witnesses do not belong to the supplied owner snapshot');
    contracts.set(dependency.contract.id, dependency.contract);
  }
  const complete = selectCurrentWitnesses(request.sourceHistory, [...contracts.values()],
    evaluationClock, supplied, context, row => row.identity === key);
  ensure(complete.length > 0, 'quantity has no current observation heads in owner history');
  const current = [...heads(complete)].sort((a, b) => a.sourceEvent.localeCompare(b.sourceEvent));
  const reported = current.filter(row => row.state === 'reported');
  const selectedResolution = request.resolution !== undefined || autoSelectResolution
    ? selectedOwnerResolution(key, request.sourceHistory, evaluationClock, context) : null;
  if (request.resolution !== undefined) {
    ensure(selectedResolution !== null
      && encoding(selectedResolution).bytes === encoding(request.resolution).bytes,
    'caller-supplied quantity resolution differs from the current owner selection');
  }
  const resolution = selectedResolution === null ? null
    : validateResolution(selectedResolution, key, current, request.sourceHistory,
      evaluationClock, context);
  let result: ResolvedQuantity;
  if (reported.length === 0)
    result = freeze({ key, amount: null, state: 'unavailable' as const, witnesses: complete,
      reason: current.map(row => row.state).sort().join(',') || 'missing' });
  else {
    const amounts = [...new Set(reported.map(row => row.measurement.value))];
    if (amounts.length === 1)
      result = freeze({ key, amount: amounts[0]!, state: 'resolved' as const,
        witnesses: complete, reason: 'compatible current witnesses' });
    else if (resolution)
      result = freeze({ key, amount: resolution.amount, state: 'resolved' as const,
        witnesses: complete,
        reason: `resolved by ${resolution.owner} evidence ${resolution.evidence.id}` });
    else result = freeze({ key, amount: null, state: 'unresolved' as const,
      witnesses: complete, reason: 'current witness amounts disagree' });
  }
  quantityDependencies.set(result, freeze({ sourceHistory: request.sourceHistory,
    witnesses: complete, resolution, registerGeneration: context.register.generation.id }));
  return result;
}

export function resolveCurrentQuantity(request: CurrentQuantityResolutionRequest,
  context: MeasurementDecodeContext): Result<ResolvedQuantity> {
  return boundary('CurrentQuantityResolution', request, context, () => {
    exactObject(request, ['witnesses', 'resolution', 'sourceHistory', 'evaluationClock'], ['resolution']);
    return resolveQuantityFromCurrentHistory(request, context);
  });
}

function currentAggregatePolicy(policy: AggregateMeasurementsPolicy,
  context: MeasurementDecodeContext): AggregateMeasurementsPolicy {
  const decoded = take(decodeAggregateMeasurementsPolicy(policy, context));
  ensure(encoding(decoded).bytes === encoding(policy).bytes,
    'aggregate policy is not current registered content');
  return decoded;
}

export function aggregateCurrentMeasurements(request: CurrentAggregateMeasurementsRequest,
  context: MeasurementDecodeContext): Result<MeasurementAggregate> {
  return boundary('CurrentMeasurementAggregate', request, context, () => {
    exactObject(request, ['policy', 'quantities', 'unit', 'category', 'dimensions', 'producer',
      'scope', 'start', 'end', 'evaluationClock', 'frontier']);
    const policy = currentAggregatePolicy(request.policy, context);
    substantive(request.frontier, 'aggregate frontier');
    ensure(policy.additiveUnits.includes(request.unit) && policy.categories.includes(request.category),
      'aggregate unit or category is not registered as additive');
    ensure(Array.isArray(request.dimensions) && request.dimensions.length > 0
      && new Set(request.dimensions).size === request.dimensions.length
      && request.dimensions.every(dimension => policy.dimensions.includes(dimension)),
    'aggregate dimensions are not registered');
    ensure(request.producer === policy.producer && request.scope === policy.scope,
      'aggregate producer or scope differs from registered policy');
    const start = admittedClock(request.start, context, 'aggregate start');
    const end = admittedClock(request.end, context, 'aggregate end');
    const evaluationClock = admittedClock(request.evaluationClock, context,
      'aggregate evaluation clock');
    ensure(clockOrder(start, end, context) < 0 && clockOrder(end, evaluationClock, context) <= 0,
      'aggregate clocks are incomparable or inverted');
    ensure(Array.isArray(request.quantities) && request.quantities.length > 0
      && request.quantities.length <= 100_000,
    'aggregate quantities must be bounded and identify an owner snapshot');
    ensure(new Set(request.quantities.map(row => row.key)).size === request.quantities.length,
      'aggregate repeats a quantity key');
    const dependencies = request.quantities.map(quantity => quantityCurrent(quantity, context));
    const sourceHistory = dependencies[0]!.sourceHistory;
    ensure(dependencies.every(dependency => dependency.sourceHistory === sourceHistory),
      'aggregate quantities do not share one exact current owner snapshot');
    const actualFrontier = peerFrontierDigest(snapshotFrontier(sourceHistory));
    ensure(request.frontier === actualFrontier,
      'aggregate frontier is not bound to the exact current owner snapshot');
    const suppliedWitnesses = request.quantities.flatMap(quantity => quantity.witnesses);
    const candidateContracts = [...new Map(suppliedWitnesses.map(witness => {
      const dependency = witnessCurrent(witness, context);
      return [dependency.contract.id, dependency.contract] as const;
    })).values()];
    const completeWitnesses = selectCurrentWitnesses(sourceHistory, candidateContracts,
      evaluationClock, suppliedWitnesses, context, row => row.contract.subjectKind === policy.sourceKind
        && row.contract.producer === request.producer
        && row.claim.category === request.category
        && row.measurement.unit === request.unit
        && clockOrder(start, row.claim.occurrenceAt, context) <= 0
        && clockOrder(row.claim.occurrenceAt, end, context) < 0);
    const groupedQuantities = new Map<string, QuantityWitness[]>();
    for (const witness of completeWitnesses) {
      const bucket = groupedQuantities.get(witness.key) ?? [];
      bucket.push(witness);
      groupedQuantities.set(witness.key, bucket);
    }
    const quantities = [...groupedQuantities.entries()].map(([key, witnesses]) => {
      const prior = request.quantities.find(quantity => quantity.key === key);
      const resolution = prior ? quantityDependencies.get(prior)?.resolution ?? undefined : undefined;
      return resolveQuantityFromCurrentHistory({ witnesses, sourceHistory, evaluationClock,
        ...(resolution ? { resolution } : {}) }, context, true);
    });
    ensure(request.quantities.every(quantity => groupedQuantities.has(quantity.key)),
      'aggregate caller quantity is outside the complete current source selection');
    const contracts = new Set<string>();
    const relations = new Set<string>();
    const hardware = new Set<string | null>();
    for (const quantity of quantities) {
      quantityCurrent(quantity, context);
      ensure(quantity.witnesses.length > 0, 'aggregate quantity has no witnesses');
      for (const witness of quantity.witnesses) {
        const dependency = witnessCurrent(witness, context);
        ensure(witness.measurement.unit === request.unit && witness.producer === request.producer
          && witness.category === request.category
          && witness.measurement.subject.kind === policy.sourceKind,
        'aggregate member basis differs from registered policy');
        ensure(clockOrder(start, dependency.occurrenceAt, context) <= 0
          && clockOrder(dependency.occurrenceAt, end, context) < 0,
        'aggregate member is outside the half-open source-time window');
        contracts.add(dependency.contract.id);
        relations.add(witness.relation);
        hardware.add(witness.hardwareProfile);
      }
    }
    ensure(contracts.size <= 1 && relations.size <= 1 && hardware.size <= 1,
      'aggregate category relation, hardware, or producer-contract basis differs');
    let amount = 0;
    for (const quantity of quantities)
      if (quantity.state === 'resolved') amount += finiteNonnegative(quantity.amount, 'resolved amount');
    ensure(Number.isFinite(amount) && amount >= 0, 'aggregate amount overflow');
    if (request.unit === 'tokens' || request.unit === 'bytes')
      ensure(Number.isSafeInteger(amount), 'aggregate discrete amount overflow');
    const dimensions = [...request.dimensions].sort();
    const identity = encoding({ policy: policy.id, scope: request.scope, start, end,
      category: request.category, unit: request.unit, dimensions, frontier: request.frontier,
      evaluationClock }).hash;
    const measurement = take(decodeMeasurement('measurement-window-aggregate', {
      type: 'Measurement', schemaVersion: 1,
      subject: { kind: 'measurement-window-aggregate', instance: identity },
      value: amount, unit: request.unit, at: end, by: request.producer,
    }, context.types));
    return freeze({ identity, measurement, amount, unit: request.unit,
      category: request.category, dimensions,
      members: quantities.filter(row => row.state === 'resolved')
        .flatMap(row => row.witnesses.map((witness: QuantityWitness) => witness.sourceEvent)).sort(),
      unresolved: quantities.filter(row => row.state !== 'resolved')
        .flatMap(row => row.witnesses.map((witness: QuantityWitness) => witness.sourceEvent)).sort(),
      start, end, evaluationClock, frontier: request.frontier });
  });
}

export function resolveCurrentAttribution(request: AttributionRequest,
  context: MeasurementDecodeContext): Result<AttributionResult> {
  return boundary('CurrentMeasurementAttribution', request, context, () => {
    exactObject(request, ['attempt', 'claimed', 'evaluationClock', 'sourceHistory', 'candidates']);
    substantive(request.attempt, 'attribution attempt');
    exactObject(request.claimed, ['feature', 'model', 'machine']);
    substantive(request.claimed.feature, 'claimed feature');
    substantive(request.claimed.model, 'claimed model');
    substantive(request.claimed.machine, 'claimed machine');
    const evaluationClock = admittedClock(request.evaluationClock, context,
      'attribution evaluation clock');
    validateCurrentSourceHistory(request.sourceHistory, context);
    ensure(Array.isArray(request.candidates) && request.candidates.length <= 1024,
      'attribution candidates must be bounded');
    const factIds = new Set(request.sourceHistory.entries.map(row => row.fact.id));
    for (const candidate of request.candidates) {
      exactObject(candidate, ['attempt', 'factReferences']);
      ensure(candidate.attempt === request.attempt, 'attribution candidate names another attempt');
      const refs = exactTextArray(candidate.factReferences, 'attribution fact references', 16);
      ensure(refs.every(id => factIds.has(id)),
        'attribution candidate cites a fact outside current owner history');
    }
    const clean = request.sourceHistory.entries.filter(status => cleanStatus(status)
      && clockOrder(status.fact.at, evaluationClock, context) <= 0);
    const records = clean.flatMap(status => {
      const record = (status.body as { readonly record?: JudgmentRecord }).record;
      if (!record || !['JudgmentRequest', 'JudgmentAttemptRecord', 'JudgmentResolution'].includes(record.type)
        || status.fact.kind !== `judgment-${record.type}`) return [];
      return [{ status, record }];
    });
    const contested = request.sourceHistory.entries.filter(status => {
      const record = (status.body as { readonly record?: JudgmentRecord }).record;
      if (!record || status.conflicts.length === 0) return false;
      if (record.type === 'JudgmentRequest') return `attempt:${record.id}:1` === request.attempt;
      return (record.type === 'JudgmentAttemptRecord' || record.type === 'JudgmentResolution')
        && record.attempt === request.attempt;
    });
    let result: AttributionResult;
    if (contested.length) result = freeze({ attempt: request.attempt,
      state: 'conflicted' as const, feature: null, model: null, machine: null, run: null,
      facts: [...new Set(contested.flatMap(status =>
        status.conflicts.flatMap(conflict => conflict.facts)))].sort() });
    else {
      const found: Array<{ feature: string; model: string; run: string;
        machine: string; facts: string[] }> = [];
      for (const attempt of records) {
        if (attempt.record.type !== 'JudgmentAttemptRecord'
          || attempt.record.attempt !== request.attempt) continue;
        const requestId = attempt.record.request;
        const ownerRequest = records.find(row => row.record.type === 'JudgmentRequest'
          && row.record.id === requestId);
        if (!ownerRequest || ownerRequest.record.type !== 'JudgmentRequest') continue;
        const resolution = records.find(row => row.record.type === 'JudgmentResolution'
          && row.record.request === requestId
          && row.record.attempt === request.attempt);
        if (!resolution || resolution.record.type !== 'JudgmentResolution') continue;
        const decisionInput = (resolution.status.body as { readonly decision?: unknown }).decision;
        const decision = decisionInput ? take(decode('Decision', decisionInput, context.types)) : null;
        const model = decision && 'model' in decision.by ? decision.by.model : null;
        if (typeof model !== 'string' || model.length === 0
          || !context.register.entries.includes(model)
          || !context.register.entries.includes(ownerRequest.record.point)) continue;
        found.push({ feature: ownerRequest.record.point, model, run: ownerRequest.record.run,
          machine: attempt.status.fact.machine,
          facts: [ownerRequest.status.fact.id, attempt.status.fact.id,
            resolution.status.fact.id].sort() });
      }
      const grouped = new Map<string, typeof found[number]>();
      for (const row of found) {
        const key = encoding({ feature: row.feature, model: row.model, run: row.run,
          machine: row.machine }).bytes;
        const prior = grouped.get(key);
        grouped.set(key, prior ? { ...row,
          facts: [...new Set([...prior.facts, ...row.facts])].sort() } : row);
      }
      const unique = [...grouped.values()];
      result = unique.length === 0
        ? freeze({ attempt: request.attempt, state: 'unattributed' as const,
          feature: null, model: null, machine: null, run: null, facts: [] })
        : unique.length > 1
          ? freeze({ attempt: request.attempt, state: 'conflicted' as const,
            feature: null, model: null, machine: null, run: null,
            facts: [...new Set(unique.flatMap(row => row.facts))].sort() })
          : freeze({ attempt: request.attempt, state: 'attributed' as const,
            feature: unique[0]!.feature, model: unique[0]!.model,
            machine: unique[0]!.machine, run: unique[0]!.run,
            facts: unique[0]!.facts });
    }
    attributionDependencies.set(result, freeze({ sourceHistory: request.sourceHistory,
      registerGeneration: context.register.generation.id }));
    return result;
  });
}

function currentBurnPolicy(policy: BurnPolicy, context: MeasurementDecodeContext): BurnPolicy {
  const decoded = take(decodeBurnPolicy(policy, context));
  ensure(encoding(decoded).bytes === encoding(policy).bytes,
    'burn policy is not current registered content');
  return decoded;
}

function readPopulationClaim(evidence: Evidence, horizon: Clock,
  context: MeasurementDecodeContext): Readonly<{ claim: Claim; value: BurnPopulationClaim }> {
  const claim = take(readEvidence(evidence, horizon, context.preserved));
  ensure(claim.value !== null && typeof claim.value === 'object' && !Array.isArray(claim.value),
    'burn population evidence must contain a closed roster');
  exactObject(claim.value, ['start', 'end', 'evidenceHorizon', 'censusComplete',
    'collectorsComplete', 'attemptIdentities', 'observedExchangeIdentities',
    'usageSupportedExchangeIdentities', 'provenNoExchangeIdentities',
    'dispatchUncertainIdentities', 'conflictedAttemptIdentities',
    'programmaticEventIdentities', 'samples', 'comparisonScopeAmount']);
  return freeze({ claim, value: claim.value as unknown as BurnPopulationClaim });
}

function sampleDescriptor(sample: BurnSample) {
  return {
    identity: sample.identity, feature: sample.feature, source: sample.source,
    selectionVersion: sample.selectionVersion,
    quantityKeys: sample.quantities.map(quantity => quantity.key).sort(),
  };
}

function intervalToken(start: Clock, end: Clock): string {
  return `burn-interval:${Buffer.from(encoding({ start, end }).bytes).toString('base64url')}`;
}

function intervalFromToken(token: string | null | undefined):
  { start: unknown; end: unknown } | null {
  if (!token?.startsWith('burn-interval:')) return null;
  try {
    const value = JSON.parse(Buffer.from(token.slice('burn-interval:'.length),
      'base64url').toString('utf8')) as { start?: unknown; end?: unknown };
    return Object.hasOwn(value, 'start') && Object.hasOwn(value, 'end')
      ? { start: value.start, end: value.end } : null;
  } catch { return null; }
}

function validateWindowCurrent(window: BurnWindow,
  context: MeasurementDecodeContext): WindowDependency {
  const dependency = windowDependencies.get(window);
  ensure(dependency !== undefined, 'burn window must come from its current-history constructor');
  currentGeneration(context, dependency.registerGeneration);
  validateCurrentSourceHistory(dependency.sourceHistory, context);
  const evidence = resolveAdmittedEvidence(window.populationEvidence, context,
    'burn population evidence', window.evidenceHorizon);
  statusContaining(dependency.sourceHistory, [evidence], 'burn population evidence');
  window.samples.flatMap(sample => sample.quantities).forEach(quantity => quantityCurrent(quantity, context));
  return dependency;
}

function burnOwnerEvidenceDebt(sourceHistory: FactSnapshot, horizon: Clock,
  samples: readonly BurnSample[], observed: readonly string[], noExchange: readonly string[],
  context: MeasurementDecodeContext): readonly string[] {
  const active = activeFactIds(sourceHistory);
  const records = sourceHistory.entries.flatMap(status => {
    if (!active.has(status.fact.id) || !cleanStatus(status)
      || clockOrder(status.fact.at, horizon, context) > 0) return [];
    const record = (status.body as { readonly record?: JudgmentRecord } | null)?.record;
    return record === undefined || status.fact.kind !== `judgment-${record.type}` ? [] : [record];
  });
  const dispatched = new Set(records.flatMap(record => record.type === 'JudgmentAttemptRecord'
    && ['dispatch-observed', 'response-observed', 'accounting-observed', 'decode-observed']
      .includes(record.phase) ? [record.attempt] : []));
  const prepared = new Set(records.flatMap(record => record.type === 'JudgmentAttemptRecord'
    && record.phase === 'prepared' ? [record.attempt] : []));
  const ownerNoExchange = new Set(records.flatMap(record => record.type === 'BenchmarkRunRecord'
    ? record.executions.flatMap(execution => execution.attempt !== undefined
      && (execution.disposition === 'refused' || execution.disposition === 'cancelled')
      ? [execution.attempt.id] : []) : []));
  const debt: string[] = [];
  for (const identity of observed)
    if (!dispatched.has(identity)) debt.push(`owner-dispatch:${identity}`);
  for (const identity of noExchange)
    if (!prepared.has(identity) || !ownerNoExchange.has(identity) || dispatched.has(identity))
      debt.push(`owner-no-exchange:${identity}`);
  for (const sample of samples.filter(row => row.source === 'model-exchange')) {
    const attribution = take(resolveCurrentAttribution({ attempt: sample.identity,
      claimed: { feature: sample.feature, model: 'owner-resolution-required',
        machine: 'owner-resolution-required' }, evaluationClock: horizon,
      sourceHistory, candidates: [] }, context));
    if (attribution.state !== 'attributed' || attribution.feature !== sample.feature)
      debt.push(`owner-attribution:${sample.identity}`);
  }
  return [...new Set(debt)].sort();
}

export function createCurrentBurnWindow(request: CurrentBurnWindowRequest,
  context: MeasurementDecodeContext): Result<BurnWindow> {
  return boundary('CurrentBurnWindow', request, context, () => {
    exactObject(request, ['window', 'sourceHistory']);
    validateCurrentSourceHistory(request.sourceHistory, context);
    const input = request.window;
    exactObject(input, ['id', 'start', 'end', 'evidenceHorizon', 'populationEvidence',
      'censusComplete', 'collectorsComplete', 'observedExchanges', 'usageSupportedExchanges',
      'attemptedDispatches', 'provenNoExchange', 'dispatchUncertain', 'conflictedAttempts',
      'programmaticEvents', 'samples', 'comparisonScopeAmount']);
    substantive(input.id, 'burn window identity');
    const start = admittedClock(input.start, context, 'burn window start');
    const end = admittedClock(input.end, context, 'burn window end');
    const horizon = admittedClock(input.evidenceHorizon, context, 'burn evidence horizon');
    ensure(clockOrder(start, end, context) < 0 && clockOrder(end, horizon, context) <= 0,
      'burn window and evidence horizon must be ordered');
    ensure(typeof input.censusComplete === 'boolean' && typeof input.collectorsComplete === 'boolean',
      'burn completeness fields must be boolean');
    ensure(Array.isArray(input.samples) && input.samples.length <= 100_000,
      'burn samples must be bounded');
    const sampleIds = new Set<string>();
    for (const sample of input.samples) {
      exactObject(sample, ['identity', 'feature', 'source', 'selectionVersion', 'quantities']);
      substantive(sample.identity, 'burn sample identity');
      substantive(sample.feature, 'burn sample feature');
      substantive(sample.selectionVersion, 'burn selection version');
      ensure(sample.source === 'model-exchange' || sample.source === 'programmatic-event',
        'burn sample source outside closed set');
      ensure(!sampleIds.has(sample.identity), 'burn sample identity is duplicated');
      sampleIds.add(sample.identity);
      ensure(Array.isArray(sample.quantities) && sample.quantities.length > 0
        && sample.quantities.length <= 64, 'burn sample quantities must be bounded and nonempty');
      const occurrences = new Set<string>();
      for (const quantity of sample.quantities) {
        const dependency = quantityCurrent(quantity, context);
        ensure(dependency.sourceHistory === request.sourceHistory,
          'burn quantity belongs to another owner snapshot');
        for (const witness of quantity.witnesses) {
          const witnessDependency = witnessCurrent(witness, context);
          const expectedFamily = sample.source === 'model-exchange' ? 'model-call' : 'programmatic-event';
          ensure(witnessDependency.contract.family === expectedFamily,
            'burn sample source differs from its registered producer family');
          ensure(witness.measurement.subject.instance === sample.identity,
            'burn sample identity differs from its quantity subject');
          ensure(clockOrder(start, witnessDependency.occurrenceAt, context) <= 0
            && clockOrder(witnessDependency.occurrenceAt, end, context) < 0,
          'burn sample is outside its half-open source-time window');
          occurrences.add(encoding(witnessDependency.occurrenceAt).bytes);
        }
      }
      ensure(occurrences.size === 1, 'burn sample quantities use different occurrence times');
    }
    for (const [name, count] of Object.entries({ observedExchanges: input.observedExchanges,
      usageSupportedExchanges: input.usageSupportedExchanges,
      attemptedDispatches: input.attemptedDispatches, provenNoExchange: input.provenNoExchange,
      dispatchUncertain: input.dispatchUncertain, conflictedAttempts: input.conflictedAttempts,
      programmaticEvents: input.programmaticEvents }))
      ensure(Number.isSafeInteger(count) && count >= 0,
        `${name} must be a nonnegative safe integer`);
    finiteNonnegative(input.comparisonScopeAmount, 'comparison scope amount');
    const evidence = resolveAdmittedEvidence(input.populationEvidence, context,
      'burn population evidence', horizon);
    const status = statusContaining(request.sourceHistory, [evidence], 'burn population evidence');
    const population = readPopulationClaim(evidence, horizon, context);
    const claim = population.value;
    const arrays = {
      attempts: exactTextArray(claim.attemptIdentities, 'burn attempt identities'),
      observed: exactTextArray(claim.observedExchangeIdentities, 'burn observed exchanges'),
      supported: exactTextArray(claim.usageSupportedExchangeIdentities,
        'burn usage-supported exchanges'),
      noExchange: exactTextArray(claim.provenNoExchangeIdentities, 'burn proven no-exchange'),
      uncertain: exactTextArray(claim.dispatchUncertainIdentities, 'burn dispatch-uncertain'),
      conflicted: exactTextArray(claim.conflictedAttemptIdentities, 'burn conflicted attempts'),
      events: exactTextArray(claim.programmaticEventIdentities, 'burn programmatic events'),
    };
    ensure(arrays.observed.length === input.observedExchanges
      && arrays.supported.length === input.usageSupportedExchanges
      && arrays.attempts.length === input.attemptedDispatches
      && arrays.noExchange.length === input.provenNoExchange
      && arrays.uncertain.length === input.dispatchUncertain
      && arrays.conflicted.length === input.conflictedAttempts
      && arrays.events.length === input.programmaticEvents,
    'burn population counts differ from the authoritative identity roster');
    ensure(arrays.supported.every(id => arrays.observed.includes(id)),
      'usage-supported exchange is absent from the observed roster');
    const classes = [...arrays.observed, ...arrays.noExchange, ...arrays.uncertain,
      ...arrays.conflicted];
    ensure(new Set(classes).size === classes.length,
      'burn attempt classifications overlap');
    ensure(!input.censusComplete || encoding([...classes].sort()).bytes
      === encoding([...arrays.attempts].sort()).bytes,
    'complete burn census does not classify its exact attempt roster');
    const modelSamples = input.samples.filter(sample => sample.source === 'model-exchange')
      .map(sample => sample.identity).sort();
    const eventSamples = input.samples.filter(sample => sample.source === 'programmatic-event')
      .map(sample => sample.identity).sort();
    ensure(encoding(modelSamples).bytes === encoding([...arrays.supported].sort()).bytes,
      'burn model samples differ from the usage-supported exchange roster');
    ensure(encoding(eventSamples).bytes === encoding([...arrays.events].sort()).bytes,
      'burn event samples differ from the programmatic-event roster');
    const expectedClaim: BurnPopulationClaim = {
      start, end, evidenceHorizon: horizon, censusComplete: input.censusComplete,
      collectorsComplete: input.collectorsComplete,
      attemptIdentities: [...arrays.attempts], observedExchangeIdentities: [...arrays.observed],
      usageSupportedExchangeIdentities: [...arrays.supported],
      provenNoExchangeIdentities: [...arrays.noExchange],
      dispatchUncertainIdentities: [...arrays.uncertain],
      conflictedAttemptIdentities: [...arrays.conflicted],
      programmaticEventIdentities: [...arrays.events],
      samples: input.samples.map(sampleDescriptor),
      comparisonScopeAmount: input.comparisonScopeAmount,
    };
    ensure(population.claim.subject === input.id
      && population.claim.predicate === 'burn-window-population'
      && encoding(claim).bytes === encoding(expectedClaim).bytes,
    'burn population evidence does not bind interval, state, roster, and quantities');
    const ownerEvidenceDebt = burnOwnerEvidenceDebt(request.sourceHistory, horizon,
      input.samples, arrays.observed, arrays.noExchange, context);
    const window = freeze({ ...input, start, end, evidenceHorizon: horizon,
      populationEvidence: evidence,
      samples: input.samples.map(sample => freeze({ ...sample,
        quantities: [...sample.quantities] })) }) as BurnWindow;
    const interval = intervalToken(start, end);
    windowDependencies.set(window, freeze({ sourceHistory: request.sourceHistory, interval,
      observation: encoding({ fact: status.fact.contentHash, claim: evidence }).hash,
      ownerEvidenceDebt,
      registerGeneration: context.register.generation.id }));
    return window;
  });
}

function selectedAmount(policy: BurnPolicy, sample: BurnSample,
  context: MeasurementDecodeContext): number | null {
  const selection = policy.selections.find(row => row.source === sample.source);
  if (!selection || selection.version !== sample.selectionVersion) return null;
  const expectedFamily = sample.source === 'model-exchange' ? 'model-call' : 'programmatic-event';
  const amounts = selection.categories.map(category => {
    const matches = sample.quantities.filter(quantity => {
      quantityCurrent(quantity, context);
      return quantity.state === 'resolved' && quantity.witnesses.length > 0
        && quantity.witnesses.every(witness => witnessCurrent(witness, context).contract.family === expectedFamily
          && witness.category === category && witness.measurement.unit === policy.unit
          && witness.measurement.subject.instance === sample.identity);
    });
    ensure(matches.length <= 1, 'burn sample has competing category quantities');
    return matches[0]?.amount ?? null;
  });
  if (amounts.some(value => value === null)) return null;
  const amount = amounts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  ensure(Number.isFinite(amount) && amount >= 0, 'burn selected amount overflow');
  if (policy.unit === 'tokens' || policy.unit === 'bytes')
    ensure(Number.isSafeInteger(amount), 'burn selected discrete amount overflow');
  return amount;
}

function resolvedSamples(policy: BurnPolicy, samples: readonly BurnSample[],
  context: MeasurementDecodeContext) {
  let amount = 0;
  let count = 0;
  const debt: string[] = [];
  for (const sample of samples) {
    const selected = selectedAmount(policy, sample, context);
    if (selected === null) debt.push(`unresolved:${sample.identity}`);
    else { amount += selected; count++; }
  }
  return freeze({ amount, count, debt: [...new Set(debt)].sort(),
    identities: samples.map(sample => sample.identity).sort() });
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]!
    : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function validateEpisode(previous: BurnEpisodeState): void {
  exactObject(previous, ['state', 'recoveryCount', 'notified', 'investigation',
    'lastEvaluatedWindow', 'lastEvaluatedObservation'],
  ['lastEvaluatedWindow', 'lastEvaluatedObservation']);
  ensure(previous.state === 'open' || previous.state === 'closed',
    'burn episode state outside closed set');
  ensure(Number.isSafeInteger(previous.recoveryCount) && previous.recoveryCount >= 0,
    'burn recovery count must be a nonnegative safe integer');
  ensure(typeof previous.notified === 'boolean'
    && (previous.investigation === null || typeof previous.investigation === 'string'),
  'burn episode notification state is malformed');
}

export function evaluateCurrentBurn(policyInput: BurnPolicy, previous: BurnEpisodeState,
  current: BurnWindow, baselines: readonly BurnWindow[],
  context: MeasurementDecodeContext): Result<BurnEvaluation> {
  return boundary('CurrentBurnEvaluation', { policyInput, previous, current, baselines }, context, () => {
    const policy = currentBurnPolicy(policyInput, context);
    validateEpisode(previous);
    ensure(Array.isArray(baselines) && baselines.length <= 10_000,
      'burn baseline windows must be bounded');
    const currentDependency = validateWindowCurrent(current, context);
    const baselineDependencies = baselines.map(window => validateWindowCurrent(window, context));
    ensure(new Set([currentDependency.interval, ...baselineDependencies.map(row => row.interval)]).size
      === baselines.length + 1, 'burn current and baseline intervals must be distinct');
    if (previous.recoveryCount > 0) {
      const prior = episodeDependencies.get(previous);
      ensure(prior !== undefined && prior.policy === policy.id
        && prior.recoveryCount === previous.recoveryCount
        && prior.registerGeneration === context.register.generation.id
        && prior.recoveryEligible,
      'prior burn recovery count lacks its current owner observation');
      const priorWindow = validateWindowCurrent(prior.window, context);
      prior.baselines.forEach(window => validateWindowCurrent(window, context));
      ensure(previous.lastEvaluatedWindow === priorWindow.interval
        && previous.lastEvaluatedObservation === priorWindow.observation,
      'prior burn recovery references differ from their owner observation');
    }
    const orderedBaselines = baselines.map((window, index) => ({ window,
      dependency: baselineDependencies[index]! })).sort((a, b) =>
      clockOrder(a.window.start, b.window.start, context));
    for (let index = 0; index < orderedBaselines.length; index++) {
      const nextStart = index + 1 < orderedBaselines.length
        ? orderedBaselines[index + 1]!.window.start : current.start;
      ensure(clockOrder(orderedBaselines[index]!.window.end, nextStart, context) === 0,
        'burn baseline windows must be consecutive and precede the current interval');
    }
    const all = [current, ...orderedBaselines.map(row => row.window)];
    const allDependencies = [currentDependency, ...orderedBaselines.map(row => row.dependency)];
    const selected = all.map(window => resolvedSamples(policy,
      window.samples.filter((sample: BurnSample) => sample.feature === policy.feature), context));
    const comparisons = all.map(window => resolvedSamples(policy, window.samples, context));
    all.forEach((window, index) => ensure(window.comparisonScopeAmount === comparisons[index]!.amount,
      'comparison denominator differs from its current registered-selection population'));
    const conditions = all.map((window, index) => {
      const target = selected[index]!;
      const comparison = comparisons[index]!;
      const coverage = window.observedExchanges === 0 ? null
        : window.usageSupportedExchanges / window.observedExchanges;
      const ownerDebt = allDependencies[index]!.ownerEvidenceDebt;
      const structural = target.debt.length > 0 || comparison.debt.length > 0
        || ownerDebt.length > 0;
      const incomplete = !window.censusComplete || !window.collectorsComplete
        || window.dispatchUncertain > 0 || window.conflictedAttempts > 0 || structural;
      const adequate = !incomplete && target.count >= policy.minimumEligibleSamples
        && (coverage === null || coverage >= policy.minimumUsageCoverage);
      return { target, comparison, coverage, incomplete, adequate, ownerDebt };
    });
    const now = conditions[0]!;
    const confidence = baselines.length > 0 && conditions.every(row => row.adequate)
      ? 'adequate' as const : 'insufficient-evidence' as const;
    const completeInactive = current.censusComplete && current.collectorsComplete
      && current.observedExchanges === 0 && current.programmaticEvents === 0
      && current.dispatchUncertain === 0 && current.conflictedAttempts === 0
      && current.attemptedDispatches === current.provenNoExchange
      && currentDependency.ownerEvidenceDebt.length === 0;
    const currentAmount = now.target.count > 0 ? now.target.amount
      : completeInactive ? 0 : null;
    const baselineAmount = confidence === 'adequate'
      ? median(conditions.slice(1).map(row => row.target.amount)) : null;
    const share = currentAmount === null || now.comparison.amount === 0
      ? null : currentAmount / now.comparison.amount;
    const excess = currentAmount === null || baselineAmount === null
      ? null : Math.max(0, currentAmount - baselineAmount);
    const debt = [...now.target.debt, ...now.comparison.debt, ...now.ownerDebt];
    if (!current.censusComplete) debt.push('census-incomplete');
    if (!current.collectorsComplete) debt.push('collector-incomplete');
    if (current.dispatchUncertain > 0) debt.push('dispatch-uncertain');
    if (current.conflictedAttempts > 0) debt.push('attempt-conflict');
    if (now.target.count < policy.minimumEligibleSamples) debt.push('eligible-sample-floor');
    if (now.coverage !== null && now.coverage < policy.minimumUsageCoverage)
      debt.push('usage-coverage-floor');
    const classification = now.incomplete ? 'incomplete' as const
      : completeInactive ? 'inactive' as const
        : confidence !== 'adequate' ? 'insufficient-evidence' as const
          : currentAmount === 0 ? 'zero-metered-activity' as const : 'activity' as const;
    let episode: BurnEpisodeState = previous;
    let notify = false;
    let openInvestigation = false;
    if (classification === 'inactive') episode = freeze({ state: 'closed' as const,
      recoveryCount: 0, notified: false, investigation: null,
      lastEvaluatedWindow: currentDependency.interval,
      lastEvaluatedObservation: currentDependency.observation });
    else if (classification === 'incomplete' || confidence === 'insufficient-evidence')
      episode = freeze({ ...previous, recoveryCount: 0,
        lastEvaluatedWindow: currentDependency.interval,
        lastEvaluatedObservation: currentDependency.observation });
    else if (previous.state === 'closed') {
      if (excess !== null && share !== null && excess >= policy.entryExcess
        && share >= policy.entryShare) {
        notify = true; openInvestigation = true;
        episode = freeze({ state: 'open' as const, recoveryCount: 0, notified: true,
          investigation: `investigation:${policy.id}:${encoding({ interval: currentDependency.interval,
            observation: currentDependency.observation }).hash}`,
          lastEvaluatedWindow: currentDependency.interval,
          lastEvaluatedObservation: currentDependency.observation });
      } else episode = freeze({ ...previous,
        lastEvaluatedWindow: currentDependency.interval,
        lastEvaluatedObservation: currentDependency.observation });
    } else if (excess !== null && share !== null && excess <= policy.recoveryExcess
      && share <= policy.recoveryShare) {
      const priorInterval = intervalFromToken(previous.lastEvaluatedWindow);
      const same = previous.lastEvaluatedWindow === currentDependency.interval;
      const consecutive = priorInterval !== null
        && encoding(priorInterval.end).bytes === encoding(current.start).bytes;
      const recoveryCount = same ? Math.max(previous.recoveryCount, 1)
        : consecutive ? previous.recoveryCount + 1 : 1;
      episode = freeze({ ...previous,
        state: recoveryCount >= policy.recoveryWindows ? 'closed' as const : 'open' as const,
        recoveryCount: recoveryCount >= policy.recoveryWindows ? 0 : recoveryCount,
        lastEvaluatedWindow: currentDependency.interval,
        lastEvaluatedObservation: currentDependency.observation });
    } else episode = freeze({ ...previous, recoveryCount: 0,
      lastEvaluatedWindow: currentDependency.interval,
      lastEvaluatedObservation: currentDependency.observation });
    const recoveryEligible = classification !== 'incomplete'
      && confidence === 'adequate' && excess !== null && share !== null
      && excess <= policy.recoveryExcess && share <= policy.recoveryShare;
    episodeDependencies.set(episode, freeze({ policy: policy.id, window: current,
      baselines: [...baselines], recoveryEligible, recoveryCount: episode.recoveryCount,
      registerGeneration: context.register.generation.id }));
    return freeze({ classification, confidence, currentAmount, baselineAmount, excess, share,
      eligibleSampleCount: now.target.count, coverage: now.coverage,
      coverageDebt: [...new Set(debt)].sort(),
      culprit: currentAmount !== null && now.target.count > 0 ? policy.feature : null,
      episode, notify, openInvestigation });
  });
}

function currentAttribution(attribution: AttributionResult, sourceHistory: FactSnapshot,
  context: MeasurementDecodeContext): void {
  const dependency = attributionDependencies.get(attribution);
  ensure(dependency !== undefined && dependency.sourceHistory === sourceHistory,
    'read attribution must come from this exact current source history');
  currentGeneration(context, dependency.registerGeneration);
  validateCurrentSourceHistory(sourceHistory, context);
  if (attribution.state === 'attributed') {
    ensure(attribution.feature !== null && attribution.model !== null && attribution.machine !== null
      && context.register.entries.includes(attribution.feature)
      && context.register.entries.includes(attribution.model),
    'attribution labels are no longer current');
  }
}

function currentProducerFor(family: MeasurementFamily, category: string, subjectKind: string,
  unit: string, producer: string, producers: readonly MeasurementProducerContract[],
  context: MeasurementDecodeContext): MeasurementProducerContract {
  const matches = producers.filter(contract => isCurrentMeasurementProducerContract(contract, context)
    && contract.family === family && contract.subjectKind === subjectKind
    && contract.producer === producer
    && contract.categories.some(row => row.name === category && row.unit === unit));
  ensure(matches.length === 1, 'historical row has no unique current registered producer contract');
  rememberProducerContract(matches[0]!, context);
  return matches[0]!;
}

function parseObservation(status: FactStatus, projection: ProjectedView,
  request: HistoricalMeasurementReadRequest, context: MeasurementDecodeContext): MeasurementReadRow | null {
  if (!cleanStatus(status) || status.body === null || typeof status.body !== 'object'
    || Array.isArray(status.body)) return null;
  const body = status.body as Record<string, Json>;
  if (typeof body.identity !== 'string' || body.measurement === undefined
    || body.evidence === undefined) return null;
  const decision = request.sourceDefinition.decisions[status.fact.kind];
  if (!decision || decision.kind !== 'folds') return null;
  const rawMeasurement = body.measurement;
  ensure(rawMeasurement !== null && typeof rawMeasurement === 'object'
    && !Array.isArray(rawMeasurement), 'historical measurement body is malformed');
  const subject = (rawMeasurement as Record<string, Json>).subject;
  ensure(subject !== null && typeof subject === 'object' && !Array.isArray(subject)
    && typeof (subject as Record<string, Json>).kind === 'string',
  'historical measurement subject is malformed');
  const measurement = take(decodeMeasurement((subject as Record<string, Json>).kind as string,
    rawMeasurement, context.types));
  const evidence = take(decode('Evidence', body.evidence, context.types));
  const currentEvidence = resolveAdmittedEvidence(evidence, context,
    'historical measurement evidence', request.query.evaluationClock);
  const read = measurementClaim(currentEvidence, request.query.evaluationClock, context);
  const claim = read.value;
  ensure(read.claim.subject === measurement.subject.instance,
    'historical measurement evidence names another subject');
  const family = families.find(value => request.producers.some(contract =>
    contract.family === value && contract.subjectKind === measurement.subject.kind
    && contract.producer === measurement.by
    && contract.categories.some(row => row.name === claim.category && row.unit === measurement.unit)));
  ensure(family !== undefined, 'historical measurement family is not registered');
  const contract = currentProducerFor(family, claim.category, measurement.subject.kind,
    measurement.unit, measurement.by, request.producers, context);
  ensure(read.claim.predicate === contract.evidencePredicate
    && claim.sourceSample.length > 0 && claim.producer === measurement.by,
  'historical measurement evidence does not match its current producer contract');
  if (contract.hardwareProfileRequired) {
    substantive(claim.hardwareProfile, 'historical measurement hardware profile');
    ensure(context.register.entries.includes(claim.hardwareProfile),
      'historical measurement hardware profile is no longer registered');
  } else ensure(claim.hardwareProfile === null,
    'historical measurement has an undeclared hardware profile');
  const identity = encoding({ family, subject: measurement.subject.instance,
    sourceSample: claim.sourceSample, category: claim.category, unit: measurement.unit,
    relation: contract.categories.find(row => row.name === claim.category)!.relation,
    hardwareProfile: claim.hardwareProfile }).hash;
  ensure(body.identity === identity, 'historical measurement identity is not canonical');
  const expectedAmount = claim.state === 'reported' ? measurement.value : null;
  ensure(claim.state === 'reported' ? Object.is(claim.amount, measurement.value)
    : claim.amount === null && measurement.value === 0,
  'historical measurement amount and state are not evidence-bound');
  const occurrenceAt = admittedClock(claim.occurrenceAt, context,
    'historical occurrence clock');
  ensure(encoding(occurrenceAt).bytes === encoding(measurement.at).bytes,
  'sampled historical measurement moved away from its measurement clock');
  const projectionKey = `${status.fact.kind}:${body.identity}`;
  const projected = projection.values[projectionKey];
  ensure(projected !== undefined && containsCanonical(projected, measurement),
    'reported history row does not exist in the current source projection');
  let state: QuantityState | 'unattributed' | 'conflicted' = claim.state;
  let feature: string | null = null;
  let model: string | null = null;
  let machine = status.fact.machine;
  if (family === 'model-call') {
    const attribution = request.attributions.find(row => row.attempt === measurement.subject.instance);
    if (!attribution || attribution.state === 'unattributed') state = 'unattributed';
    else {
      currentAttribution(attribution, request.sourceHistory, context);
      if (attribution.state === 'conflicted') state = 'conflicted';
      else {
        feature = attribution.feature; model = attribution.model; machine = attribution.machine!;
      }
    }
  }
  return freeze({ identity, family, category: claim.category, at: occurrenceAt,
    amount: state === 'conflicted' ? null : expectedAmount, unit: measurement.unit, state,
    producer: measurement.by, sourceSample: claim.sourceSample, feature, model, machine,
    evidence: currentEvidence });
}

function validateReadRow(row: MeasurementReadRow,
  context: MeasurementDecodeContext): void {
  exactObject(row, [...rowFields]);
  for (const value of [row.identity, row.category, row.unit, row.producer, row.sourceSample,
    row.machine]) substantive(value, 'historical read metadata');
  ensure(families.includes(row.family), 'historical read family outside closed set');
  ensure([...quantityStates, 'unattributed', 'conflicted'].includes(row.state),
    'historical read state outside closed set');
  admittedClock(row.at, context, 'historical read row clock');
  ensure(row.amount === null || Number.isFinite(row.amount) && row.amount >= 0,
    'historical read amount must be finite nonnegative or unknown');
  if (row.amount !== null && (row.unit === 'tokens' || row.unit === 'bytes'))
    ensure(Number.isSafeInteger(row.amount), 'historical discrete amount must be a safe integer');
}

function cursorBinding(query: HistoricalMeasurementReadRequest['query'],
  source: readonly MeasurementReadRow[]): string {
  const { cursor: _cursor, ...pinned } = query;
  return encoding({ query: pinned, source: source.map(row => encoding(row).hash).sort() }).hash;
}

function encodeCursor(offset: number, binding: string): string {
  return Buffer.from(encoding({ offset, binding }).bytes, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string, binding: string): number {
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); }
  catch { ensure(false, 'cursor is not an admitted continuation'); }
  exactObject(parsed, ['offset', 'binding']);
  ensure(Number.isSafeInteger(parsed.offset) && (parsed.offset as number) >= 0
    && parsed.binding === binding, 'cursor belongs to another query or source');
  return parsed.offset as number;
}

function sizedRead(result: Omit<MeasurementReadResult, 'exportBytes'>): MeasurementReadResult {
  let exportBytes = 0;
  for (let iteration = 0; iteration < 8; iteration++) {
    const next = Buffer.byteLength(encoding({ ...result, exportBytes }).bytes);
    if (next === exportBytes) return freeze({ ...result, exportBytes });
    exportBytes = next;
  }
  return freeze({ ...result, exportBytes });
}

function boundedRead(request: HistoricalMeasurementReadRequest, rows: readonly MeasurementReadRow[],
  sourcePartial: boolean, context: MeasurementDecodeContext): MeasurementReadResult {
  const query = request.query;
  ensure(query.pageSize <= 500 && query.maxExportBytes <= 1_048_576
    && query.detailHorizonMs <= 90 * 24 * 60 * 60 * 1000,
  'historical query exceeds registered bound');
  ensure(rows.length <= 100_000, 'historical read input exceeds hard cardinality bound');
  rows.forEach(row => validateReadRow(row, context));
  const canonical = new Map<string, MeasurementReadRow>();
  for (const row of rows) {
    const prior = canonical.get(row.identity);
    ensure(!prior || encoding(prior).bytes === encoding(row).bytes,
      'historical identity has competing current rows');
    if (!prior) canonical.set(row.identity, row);
  }
  const all = [...canonical.values()];
  const available = all.filter(row => clockOrder(query.start, row.at, context) <= 0
    && clockOrder(row.at, query.end, context) < 0
    && query.evaluationClock.value - row.at.value <= query.detailHorizonMs)
    .sort((a, b) => query.sort === 'identity' ? a.identity.localeCompare(b.identity)
      : clockOrder(a.at, b.at, context) || a.identity.localeCompare(b.identity));
  const binding = cursorBinding(query, all);
  const offset = query.cursor === null ? 0 : decodeCursor(query.cursor, binding);
  ensure(offset <= available.length, 'cursor is outside the current result set');
  const candidates = available.slice(offset, offset + query.pageSize);
  for (let count = candidates.length; count >= 0; count--) {
    const page = candidates.slice(0, count);
    const next = offset + page.length;
    const partial = request.timedOut || sourcePartial || next < available.length;
    const reasons = [request.timedOut ? 'timeout at pinned bounded horizon' : null,
      sourcePartial ? 'source history contains conflict or taint' : null,
      next < available.length ? 'page or export bound' : null].filter(Boolean);
    const result = sizedRead({ query: query.id, rows: page, totalCount: available.length,
      nextCursor: next < available.length ? encodeCursor(next, binding) : null,
      partial, reason: reasons.join('; ') || null, evaluationClock: query.evaluationClock,
      sourceHistoryDigest: query.sourceHistoryDigest,
      sourceProjectionDigest: query.sourceProjectionDigest, frontier: query.frontier,
      registerGeneration: query.registerGeneration });
    if (result.exportBytes <= query.maxExportBytes) {
      ensure(offset >= available.length || result.rows.length > 0,
        'export bound cannot make forward progress');
      return result;
    }
  }
  throw new Error('export bound cannot encode a response');
}

export function measurementProjectionDefinition(generation: ProjectionGeneration,
  bindings: Readonly<Record<string, Readonly<{ identity: string; value: string;
    merge: 'additive' | 'set-union' | 'max' | 'min' | 'exclusive-singleton' }>>>,
  context: BoundaryContext): Result<ProjectionDefinition> {
  return boundary('MeasurementProjectionDefinitionA2', { generation, bindings }, context, () => {
    ensure(bindings !== null && typeof bindings === 'object' && !Array.isArray(bindings),
      'projection bindings must be a closed object');
    ensure(Object.keys(bindings).every(kind => generation.kinds.includes(kind)),
      'projection binding names an unregistered kind');
    for (const binding of Object.values(bindings)) {
      exactObject(binding, ['identity', 'value', 'merge']);
      substantive(binding.identity, 'projection identity selector');
      substantive(binding.value, 'projection value selector');
      ensure(['additive', 'set-union', 'max', 'min', 'exclusive-singleton'].includes(binding.merge),
        'projection merge is outside the closed set');
    }
    return freeze({ id: 'measurement.source.all-identities', class: 'informational' as const,
      stalenessBound: 60_000, retention: 'all-identities' as const,
      decisions: Object.fromEntries(generation.kinds.map(kind => [kind, bindings[kind]
        ? { kind: 'folds' as const, ...bindings[kind]! }
        : { kind: 'ignores' as const, reason: 'not a registered measurement source' }])) });
  });
}

function validateCompleteMeasurementProjection(sourceHistory: FactSnapshot,
  definition: ProjectionDefinition, generation: ProjectionGeneration): void {
  const actualFrontier = snapshotFrontier(sourceHistory);
  for (const [machine, head] of Object.entries(actualFrontier)) {
    const supplied = generation.lineages[machine]?.head;
    ensure(supplied !== null && supplied !== undefined
      && supplied.epoch === head.epoch && supplied.position === head.position,
    'historical source generation does not bind the current owner frontier');
  }
  ensure(sourceHistory.entries.every(status => generation.kinds.includes(status.fact.kind)),
    'historical source generation omits a current owner fact kind');
  const active = activeFactIds(sourceHistory);
  for (const status of sourceHistory.entries) {
    if (!active.has(status.fact.id) || !cleanStatus(status)
      || status.fact.kind !== 'measurement-observation'
      || status.body === null || typeof status.body !== 'object' || Array.isArray(status.body)) continue;
    const body = status.body as Record<string, Json>;
    if (typeof body.identity !== 'string' || body.measurement === undefined
      || body.evidence === undefined) continue;
    const decision = definition.decisions[status.fact.kind];
    ensure(decision?.kind === 'folds' && decision.identity === 'identity'
      && decision.value === 'measurement' && decision.merge === 'set-union',
    'historical source projection suppresses or changes a current measurement observation');
  }
}

export function bindCurrentMeasurementReadSource(request: Pick<HistoricalMeasurementReadRequest,
  'sourceHistory' | 'sourceDefinition' | 'sourceGeneration'>,
context: MeasurementDecodeContext): Result<Readonly<{
  sourceHistoryDigest: string; sourceProjectionDigest: string; frontier: string;
  registerGeneration: string;
}>> {
  return boundary('CurrentMeasurementReadSourceBinding', request, context, () => {
    exactObject(request, ['sourceHistory', 'sourceDefinition', 'sourceGeneration']);
    ensure(request.sourceDefinition.id === 'measurement.source.all-identities'
      && request.sourceDefinition.retention === 'all-identities',
    'historical source projection must retain all identities');
    ensure(encoding(request.sourceGeneration.reference).bytes
      === encoding(context.register.generation).bytes,
    'historical source register generation is not current');
    validateCompleteMeasurementProjection(request.sourceHistory, request.sourceDefinition,
      request.sourceGeneration);
    const projection = take(foldProjection(request.sourceDefinition, request.sourceHistory,
      request.sourceGeneration, context));
    return freeze({ sourceHistoryDigest: encoding(request.sourceHistory).hash,
      sourceProjectionDigest: encoding(projection).hash,
      frontier: encoding(projection.foldedThrough).hash,
      registerGeneration: context.register.generation.id });
  });
}

export function renderCurrentMeasurementRead(request: HistoricalMeasurementReadRequest,
  context: MeasurementDecodeContext): Result<MeasurementReadResult> {
  return boundary('CurrentMeasurementHistoricalRead', request, context, () => {
    exactObject(request, ['sourceHistory', 'sourceDefinition', 'sourceGeneration', 'query',
      'producers', 'attributions', 'timedOut']);
    ensure(typeof request.timedOut === 'boolean', 'historical read timeout state must be boolean');
    const decodedQuery = take(decodeMeasurementReadQuery(request.query, context));
    ensure(encoding(decodedQuery).bytes === encoding(request.query).bytes,
      'historical query is not current decoded content');
    const binding = take(bindCurrentMeasurementReadSource({
      sourceHistory: request.sourceHistory,
      sourceDefinition: request.sourceDefinition,
      sourceGeneration: request.sourceGeneration,
    }, context));
    ensure(encoding(binding).bytes === encoding({
      sourceHistoryDigest: decodedQuery.sourceHistoryDigest,
      sourceProjectionDigest: decodedQuery.sourceProjectionDigest,
      frontier: decodedQuery.frontier,
      registerGeneration: decodedQuery.registerGeneration,
    }).bytes, 'historical query is not bound to this exact owner snapshot and projection');
    request.producers.forEach(producer => ensure(isCurrentMeasurementProducerContract(producer, context),
      'historical read producer contract is no longer current'));
    request.producers.forEach(producer => rememberProducerContract(producer, context));
    request.attributions.forEach(attribution => currentAttribution(attribution,
      request.sourceHistory, context));
    const projection = take(foldProjection(request.sourceDefinition, request.sourceHistory,
      request.sourceGeneration, context));
    const excluded = new Set([...projection.retractions,
      ...projection.corrections.map(row => row.original)]);
    const observationRows = request.sourceHistory.entries.filter(status => !excluded.has(status.fact.id))
      .map(status => parseObservation(status, projection, request, context))
      .filter((row): row is MeasurementReadRow => row !== null);
    const witnesses = selectCurrentWitnesses(request.sourceHistory, request.producers,
      request.query.evaluationClock, [], context, row => !excluded.has(row.status.fact.id));
    const groupedWitnesses = new Map<string, QuantityWitness[]>();
    for (const witness of witnesses) {
      const bucket = groupedWitnesses.get(witness.key) ?? [];
      bucket.push(witness);
      groupedWitnesses.set(witness.key, bucket);
    }
    const quantities = new Map([...groupedWitnesses.entries()].map(([key, selected]) =>
      [key, resolveQuantityFromCurrentHistory({ witnesses: selected,
        sourceHistory: request.sourceHistory,
        evaluationClock: request.query.evaluationClock }, context, true)]));
    const groupedRows = new Map<string, MeasurementReadRow[]>();
    for (const row of observationRows) {
      const bucket = groupedRows.get(row.identity) ?? [];
      bucket.push(row);
      groupedRows.set(row.identity, bucket);
    }
    const rows = [...groupedRows.entries()].map(([identity, alternatives]) => {
      const quantity = quantities.get(identity);
      ensure(quantity !== undefined, 'historical row is absent from the complete quantity selection');
      const ordered = [...alternatives].sort((a, b) =>
        a.evidence.id.localeCompare(b.evidence.id));
      const representative = ordered[0]!;
      const resolvedState = quantity.state === 'unresolved' ? 'conflicted' as const
        : representative.state;
      return freeze({ ...representative, amount: quantity.state === 'resolved'
        ? quantity.amount : null, state: resolvedState });
    });
    const sourcePartial = request.sourceHistory.entries.some(status =>
      status.taint.length > 0 || status.conflicts.length > 0);
    return boundedRead(request, rows, sourcePartial, context);
  });
}

function peerFrontierDigest(frontier: CausalFrontier): string {
  return encoding(frontier).hash;
}

export function mergeCurrentPeerMeasurements(peers: readonly PeerHistoryMeasurementInput[],
  policy: PeerHistoryPolicy, context: MeasurementDecodeContext): Result<CurrentPeerMeasurementPool> {
  return boundary('CurrentPeerMeasurementPool', { peers, policy }, context, () => {
    ensure(Array.isArray(peers) && peers.length > 0 && peers.length <= 1024,
      'peer measurement input must be bounded and nonempty');
    exactObject(policy, ['requiredPeers', 'evaluationClock', 'maximumClockSkewMs']);
    const required = exactTextArray(policy.requiredPeers, 'required peer identities', 1024);
    const evaluation = admittedClock(policy.evaluationClock, context, 'peer evaluation clock');
    ensure(Number.isSafeInteger(policy.maximumClockSkewMs) && policy.maximumClockSkewMs >= 0,
      'peer clock-skew bound must be a nonnegative safe integer');
    ensure(new Set(peers.map(row => row.peer)).size === peers.length,
      'peer identity is repeated');
    const missing: Array<{ peer: string; lastFrontier: string | null;
      reason: 'missing' | 'clock-skew' | 'unwitnessed-frontier' }> = [];
    const admitted: PeerHistoryMeasurementInput[] = [];
    const selectedByPeer = new Map<string, readonly ResolvedQuantity[]>();
    const digests = new Set<string>();
    const frontiers: Record<string, string> = {};
    for (const peer of peers) {
      exactObject(peer, ['peer', 'state', 'sourceHistory', 'sourceHistoryDigest', 'frontier',
        'frontierDigest', 'observedAt', 'lastFrontier', 'quantities']);
      substantive(peer.peer, 'peer identity');
      ensure(peer.lastFrontier === null || typeof peer.lastFrontier === 'string'
        && peer.lastFrontier.length > 0, 'peer last frontier is malformed');
      if (peer.state === 'missing') {
        ensure(peer.sourceHistory === null && peer.sourceHistoryDigest === null
          && peer.frontier === null && peer.frontierDigest === null && peer.observedAt === null
          && peer.quantities.length === 0, 'missing peer carries admitted current data');
        missing.push({ peer: peer.peer, lastFrontier: peer.lastFrontier, reason: 'missing' });
        continue;
      }
      ensure(peer.state === 'admitted' && peer.sourceHistory !== null
        && peer.sourceHistoryDigest !== null && peer.frontier !== null
        && peer.frontierDigest !== null && peer.observedAt !== null,
      'admitted peer lacks owner history, frontier, or clock evidence');
      validateCurrentSourceHistory(peer.sourceHistory, context);
      const actualFrontier = snapshotFrontier(peer.sourceHistory);
      const actualDigest = peerFrontierDigest(actualFrontier);
      if (encoding(actualFrontier).bytes !== encoding(peer.frontier).bytes
        || actualDigest !== peer.frontierDigest
        || encoding(peer.sourceHistory).hash !== peer.sourceHistoryDigest) {
        missing.push({ peer: peer.peer, lastFrontier: peer.lastFrontier,
          reason: 'unwitnessed-frontier' });
        continue;
      }
      admittedClock(peer.observedAt, context, 'peer observation clock');
      const order = clockOrder(peer.observedAt, evaluation, context);
      const skew = Math.abs(evaluation.value - peer.observedAt.value);
      if (order > 0 || skew > policy.maximumClockSkewMs) {
        missing.push({ peer: peer.peer, lastFrontier: actualDigest, reason: 'clock-skew' });
        continue;
      }
      for (const quantity of peer.quantities) {
        const dependency = quantityCurrent(quantity, context);
        ensure(dependency.sourceHistory === peer.sourceHistory,
          'peer quantity belongs to another owner history');
      }
      const sourceHistory = peer.sourceHistory;
      const suppliedWitnesses: readonly QuantityWitness[] = peer.quantities
        .flatMap((quantity: ResolvedQuantity) => quantity.witnesses);
      const contracts: readonly MeasurementProducerContract[] = suppliedWitnesses.length > 0
        ? [...new Map<string, MeasurementProducerContract>(suppliedWitnesses.map(
          (witness: QuantityWitness) => {
          const dependency = witnessCurrent(witness, context);
          return [dependency.contract.id, dependency.contract] as const;
        })).values()]
        : currentKnownProducerContracts(context);
      const currentWitnesses = selectCurrentWitnesses(sourceHistory, contracts,
        evaluation, suppliedWitnesses, context, () => true);
      const grouped = new Map<string, QuantityWitness[]>();
      for (const witness of currentWitnesses) {
        const bucket = grouped.get(witness.key) ?? [];
        bucket.push(witness);
        grouped.set(witness.key, bucket);
      }
      const selected = [...grouped.entries()].map(([key, witnesses]) => {
        const supplied = peer.quantities.find((quantity: ResolvedQuantity) => quantity.key === key);
        const resolution = supplied === undefined
          ? undefined : quantityDependencies.get(supplied)?.resolution ?? undefined;
        return resolveQuantityFromCurrentHistory({ witnesses, sourceHistory,
          evaluationClock: evaluation, ...(resolution === undefined ? {} : { resolution }) }, context,
        true);
      });
      ensure(peer.quantities.every((quantity: ResolvedQuantity) => grouped.has(quantity.key)),
        'peer caller quantity is outside the complete current owner selection');
      const hasObservation = sourceHistory.entries.some((status: FactStatus) =>
        status.fact.kind === 'measurement-observation' && cleanStatus(status));
      if (hasObservation && selected.length === 0) {
        missing.push({ peer: peer.peer, lastFrontier: actualDigest,
          reason: 'unwitnessed-frontier' });
        continue;
      }
      admitted.push(peer);
      selectedByPeer.set(peer.peer, selected);
      digests.add(peer.sourceHistoryDigest);
      frontiers[peer.peer] = actualDigest;
    }
    for (const peer of required)
      if (!peers.some(row => row.peer === peer))
        missing.push({ peer, lastFrontier: null, reason: 'missing' });
    const members = new Set<string>();
    const unresolved = new Set<string>();
    const grouped = new Map<string, ResolvedQuantity[]>();
    for (const peer of admitted) for (const quantity of selectedByPeer.get(peer.peer) ?? []) {
      const bucket = grouped.get(quantity.key) ?? [];
      bucket.push(quantity); grouped.set(quantity.key, bucket);
    }
    for (const quantities of grouped.values()) {
      const witnesses = quantities.flatMap(quantity => quantity.witnesses);
      const amounts = new Set(quantities.filter(quantity => quantity.state === 'resolved')
        .map(quantity => quantity.amount));
      const resolved = quantities.every(quantity => quantity.state === 'resolved')
        && amounts.size === 1;
      witnesses.forEach(witness => (resolved ? members : unresolved).add(witness.sourceEvent));
    }
    return freeze({ state: missing.length > 0 || unresolved.size > 0 ? 'partial' as const
      : 'complete' as const, members: [...members].sort(), unresolved: [...unresolved].sort(),
      admittedPeers: admitted.map(peer => peer.peer).sort(),
      sourceHistoryDigests: [...digests].sort(),
      frontiers: Object.fromEntries(Object.entries(frontiers).sort(([a], [b]) => a.localeCompare(b))),
      missingPeers: [...new Map(missing.map(row => [row.peer, row])).values()]
        .sort((a, b) => a.peer.localeCompare(b.peer)) });
  });
}

/** Used by tests and peer callers to bind the frontier to the exact owner snapshot. */
export function currentPeerHistoryBinding(sourceHistory: FactSnapshot,
  context: MeasurementDecodeContext): Result<Readonly<{
    sourceHistoryDigest: string; frontier: CausalFrontier; frontierDigest: string;
  }>> {
  return boundary('CurrentPeerHistoryBinding', sourceHistory, context, () => {
    validateCurrentSourceHistory(sourceHistory, context);
    const frontier = snapshotFrontier(sourceHistory);
    return freeze({ sourceHistoryDigest: encoding(sourceHistory).hash, frontier,
      frontierDigest: peerFrontierDigest(frontier) });
  });
}
