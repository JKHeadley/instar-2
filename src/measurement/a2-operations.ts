import { compareMeasurements, consumeResult, decode, decodeMeasurement, readEvidence } from '../index.js';
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
  decodeMeasurementProducerContract, isCurrentMeasurementProducerContract,
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
  EvidenceCompleteMeasurementReadRow, HistoricalMeasurementReadRequest, MeasurementObservationClaim, PeerHistoryMeasurementInput,
  PeerHistoryPolicy,
} from './a2-contracts.js';

const families = ['model-call', 'cumulative-model-session', 'quota', 'rate-limit-event', 'resource',
  'package-cost', 'programmatic-event'] as const;
const quantityStates = ['reported', 'not-reported', 'unsupported', 'missing', 'failed',
  'legacy-origin-lost'] as const;
const rowFields = ['identity', 'family', 'category', 'at', 'amount', 'unit', 'state', 'producer',
  'sourceSample', 'feature', 'model', 'machine', 'evidence', 'evidenceManifest'] as const;

type WitnessDependency = Readonly<{
  sourceHistory: FactSnapshot;
  factId: string;
  contract: MeasurementProducerContract;
  occurrenceAt: Clock | null;
  registerGeneration: string;
}>;
type QuantityDependency = Readonly<{
  sourceHistory: FactSnapshot;
  witnesses: readonly QuantityWitness[];
  usableWitnesses: readonly QuantityWitness[];
  resolution: QuantityOwnerResolution | null;
  resolutions: readonly QuantityOwnerResolution[];
  registerGeneration: string;
}>;
type WindowDependency = Readonly<{
  sourceHistory: FactSnapshot;
  interval: string;
  observation: string;
  ownerEvidenceDebt: readonly string[];
  registerGeneration: string;
}>;
type RecoveryVoteDependency = Readonly<{
  window: BurnWindow;
  baselines: readonly BurnWindow[];
}>;
type EpisodeDependency = Readonly<{
  policy: string;
  window: BurnWindow;
  baselines: readonly BurnWindow[];
  recoveryVotes: readonly RecoveryVoteDependency[];
  recoveryEligible: boolean;
  recoveryCount: number;
  registerGeneration: string;
}>;

const witnessDependencies = new WeakMap<object, WitnessDependency>();
const quantityDependencies = new WeakMap<object, QuantityDependency>();
const attributionDependencies = new WeakMap<object, Readonly<{
  request: AttributionRequest; sourceHistory: FactSnapshot; registerGeneration: string;
}>>();
const windowDependencies = new WeakMap<object, WindowDependency>();
const episodeDependencies = new WeakMap<object, EpisodeDependency>();

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

type OwnerSelection = Readonly<{ identity: string; value: string }>;
type CurrentOwnerSelection = Readonly<{
  statuses: readonly FactStatus[];
  view: ProjectedView | null;
}>;

/**
 * Ask Part Two's public fold which rows of a supported owner kind are current.
 * Retraction and correction semantics stay entirely inside that owner fold: A2
 * never interprets a generic `target` field or the projection's retraction-fact
 * identities as withdrawn target identities.
 */
function currentOwnerSelection(snapshot: FactSnapshot, kind: string,
  context: MeasurementDecodeContext): CurrentOwnerSelection {
  const rows = snapshot.entries.filter(status => status.fact.kind === kind);
  if (rows.length === 0) return { statuses: [], view: null };
  const selection: OwnerSelection | null = kind === 'measurement-observation'
    || kind === 'measurement-evidence'
    ? { identity: 'evidence.id', value: 'evidence' }
    : rows.every(status => {
      const record = (status.body as { readonly record?: { readonly id?: unknown } } | null)?.record;
      return typeof record?.id === 'string' && record.id.length > 0;
    }) ? { identity: 'record.id', value: 'record' } : null;
  ensure(selection !== null, `current ${kind} selection requires a public owner fold binding`);
  const generation = validationGeneration(snapshot, context);
  const definition: ProjectionDefinition = {
    id: `measurement.current.${kind}`, class: 'informational', stalenessBound: 1,
    retention: 'all-identities',
    decisions: Object.fromEntries(generation.kinds.map(candidate => [candidate,
      candidate === kind
        ? { kind: 'folds' as const, merge: 'set-union' as const, ...selection }
        : { kind: 'ignores' as const, reason: 'selected by another owner-current read' }])),
  };
  const view = take(foldProjection(definition, snapshot, generation, context));
  const selected = new Set(Object.entries(view.values)
    .filter(([key]) => key.startsWith(`${kind}:`))
    .flatMap(([, values]) => Array.isArray(values) ? values : [values])
    .map(value => encoding(value).bytes));
  const statuses = rows.filter(status => {
    const body = status.body as Record<string, Json>;
    const value = selection.value === 'record' ? body.record : body.evidence;
    return value !== undefined && selected.has(encoding(value).bytes);
  });
  return freeze({ statuses, view });
}

function currentOwnerStatuses(snapshot: FactSnapshot, kind: string,
  context: MeasurementDecodeContext): readonly FactStatus[] {
  return currentOwnerSelection(snapshot, kind, context).statuses;
}

function ownerSelectionDebt(snapshot: FactSnapshot, kind: string,
  context: MeasurementDecodeContext): readonly string[] {
  const selection = currentOwnerSelection(snapshot, kind, context);
  if (selection.view === null) return [];
  return [...new Set([
    ...selection.view.conflicts.map(conflict => `owner-conflict:${kind}:${conflict.key}`),
    ...selection.view.taint.map(taint => `owner-taint:${kind}:${taint}`),
  ])].sort();
}

function currentOwnerFactIds(snapshot: FactSnapshot,
  context: MeasurementDecodeContext): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const kind of new Set(snapshot.entries.map(status => status.fact.kind))) {
    if (kind === 'measurement-observation' || kind === 'measurement-evidence'
      || snapshot.entries.filter(status => status.fact.kind === kind).every(status =>
        typeof (status.body as { readonly record?: { readonly id?: unknown } } | null)
          ?.record?.id === 'string'))
      currentOwnerStatuses(snapshot, kind, context).forEach(status => ids.add(status.fact.id));
  }
  return ids;
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

function statusContaining(snapshot: FactSnapshot, wanted: readonly unknown[], label: string,
  context: MeasurementDecodeContext): FactStatus {
  const active = currentOwnerFactIds(snapshot, context);
  const matches = snapshot.entries.filter(status => active.has(status.fact.id) && cleanStatus(status)
    && wanted.every(value => containsCanonical(status.body, value)));
  ensure(matches.length === 1, `${label} must occur once in current clean owner history`);
  return matches[0]!;
}

function admittedEvidence(input: Evidence, context: MeasurementDecodeContext,
  label: string): Evidence {
  const candidates = (context.types.evidence ?? []).filter(evidence => evidence.id === input.id);
  ensure(candidates.length > 0, `${label} is no longer admitted`);
  ensure(candidates.every(candidate => encoding(candidate).bytes === encoding(candidates[0]).bytes),
    `${label} is conflicted`);
  ensure(encoding(candidates[0]).bytes === encoding(input).bytes,
    `${label} bytes differ from current admitted evidence`);
  return take(decode('Evidence', input, context.types));
}

function evidenceIsUsable(evidence: Evidence, at: Clock,
  context: MeasurementDecodeContext): boolean {
  return consumeResult(readEvidence(evidence, at, context.preserved), {
    Success: () => true,
    Refused: refusal => {
      ensure(refusal.reason === 'stale-base',
        'evidence availability failed without a freshness result');
      return false;
    },
  });
}

function resolveAdmittedEvidence(input: Evidence, context: MeasurementDecodeContext,
  label: string, at: Clock): Evidence {
  const evidence = admittedEvidence(input, context, label);
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

function quantityIdentity(contract: MeasurementProducerContract,
  subject: string, sourceSample: string, category: string, unit: string,
  relation: string, hardwareProfile: string | null, sampleAt: Clock): string {
  const sampled = contract.family === 'cumulative-model-session'
    || contract.family === 'quota' || contract.family === 'resource'
    || contract.family === 'package-cost';
  return encoding({ family: contract.family, subject, sourceSample, category, unit, relation,
    hardwareProfile, ...(sampled ? { sampleAt } : {}) }).hash;
}

/** Section 2's single window-membership table. */
function membershipClock(contract: MeasurementProducerContract, measurementAt: Clock,
  subject: string, sourceHistory: FactSnapshot, context: MeasurementDecodeContext): Clock | null {
  if (contract.family !== 'model-call') return measurementAt;
  const active = currentOwnerFactIds(sourceHistory, context);
  const attemptRows = sourceHistory.entries.filter(status => {
    if (!active.has(status.fact.id) || !cleanStatus(status)) return false;
    const record = (status.body as { readonly record?: JudgmentRecord } | null)?.record;
    return record?.type === 'JudgmentAttemptRecord' && record.attempt === subject;
  });
  if (attemptRows.length === 0) return null;
  const dispatched = attemptRows.filter(status =>
    ((status.body as unknown as { readonly record: JudgmentRecord }).record.type
      === 'JudgmentAttemptRecord'
      && (status.body as unknown as {
        readonly record: import('../judgment/index.js').JudgmentAttemptRecord;
      }).record.phase === 'dispatch-observed'));
  if (dispatched.length === 0) return null;
  ensure(dispatched.length === 1, 'model usage lacks one current owner dispatch observation');
  return admittedClock(dispatched[0]!.fact.at, context, 'model dispatch clock');
}

function snapshotProducerContracts(sourceHistory: FactSnapshot,
  context: MeasurementDecodeContext): readonly MeasurementProducerContract[] {
  const active = currentOwnerFactIds(sourceHistory, context);
  const contracts = new Map<string, MeasurementProducerContract>();
  for (const status of sourceHistory.entries) {
    if (!active.has(status.fact.id) || !cleanStatus(status)
      || status.fact.kind !== 'measurement-observation'
      || status.body === null || typeof status.body !== 'object' || Array.isArray(status.body)) continue;
    const raw = (status.body as Record<string, Json>).producerContract;
    if (raw === undefined) continue;
    ensure(typeof raw === 'string', 'snapshot producer contract content must be text');
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { ensure(false, 'snapshot producer contract content is malformed'); }
    const contract = take(decodeMeasurementProducerContract(parsed, context));
    ensure(encoding(contract).bytes === raw,
      'snapshot producer contract differs from its admitted registered bytes');
    const prior = contracts.get(contract.id);
    ensure(!prior || encoding(prior).bytes === encoding(contract).bytes,
      'snapshot carries competing producer contract content');
    contracts.set(contract.id, contract);
  }
  return [...contracts.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function witnessCurrent(witness: QuantityWitness, context: MeasurementDecodeContext,
  evaluationClock: Clock = witness.measurement.at as Clock): WitnessDependency {
  const dependency = witnessDependencies.get(witness);
  ensure(dependency !== undefined, 'quantity witness must come from the current-history constructor');
  currentGeneration(context, dependency.registerGeneration);
  validateCurrentSourceHistory(dependency.sourceHistory, context);
  ensure(isCurrentMeasurementProducerContract(dependency.contract, context),
    'quantity witness producer contract is no longer current');
  const status = statusContaining(dependency.sourceHistory, [witness.measurement, witness.evidence],
    'quantity witness evidence', context);
  ensure(status.fact.id === dependency.factId, 'quantity witness moved to another history fact');
  resolveAdmittedEvidence(witness.evidence, context, 'quantity witness evidence', evaluationClock);
  return dependency;
}

function quantityCurrent(quantity: ResolvedQuantity,
  context: MeasurementDecodeContext,
  evaluationClock?: Clock): QuantityDependency {
  const dependency = quantityDependencies.get(quantity);
  ensure(dependency !== undefined, 'quantity must come from current-history resolution');
  currentGeneration(context, dependency.registerGeneration);
  validateCurrentSourceHistory(dependency.sourceHistory, context);
  const usable = new Set(dependency.usableWitnesses);
  dependency.witnesses.forEach(witness => witnessCurrent(witness, context,
    usable.has(witness) ? evaluationClock ?? witness.measurement.at as Clock
      : witness.measurement.at as Clock));
  dependency.resolutions.forEach(resolution =>
    resolveAdmittedEvidence(resolution.evidence, context,
      'quantity resolution evidence', evaluationClock ?? resolution.evidence.observedAt));
  return dependency;
}

function resolveQuantityCurrentAt(quantity: ResolvedQuantity,
  context: MeasurementDecodeContext, evaluationClock: Clock): ResolvedQuantity {
  const dependency = quantityCurrent(quantity, context);
  return resolveQuantityFromCurrentHistory({ witnesses: dependency.witnesses,
    sourceHistory: dependency.sourceHistory, evaluationClock }, context);
}

function heads(witnesses: readonly QuantityWitness[]): readonly QuantityWitness[] {
  // Stream replacement is an owner resolution fact. Caller phase/predecessor metadata is
  // retained for audit, but never converts independent signed observations into a winner.
  return witnesses;
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
      'quantity measurement and evidence', context);
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
    const key = quantityIdentity(input.contract, input.subjectInstance, input.sourceSample,
      category.name, category.unit, category.relation, input.hardwareProfile,
      measurement.at as Clock);
    const witness = freeze({ key, sourceSample: input.sourceSample, category: category.name,
      relation: category.relation, measurement, evidence, producer: input.contract.producer,
      sourceEvent: input.sourceEvent, phase: input.phase, predecessors: [...predecessors].sort(),
      state: input.state, hardwareProfile: input.hardwareProfile });
    witnessDependencies.set(witness, freeze({ sourceHistory: request.sourceHistory,
      factId: status.fact.id, contract: input.contract,
      occurrenceAt: membershipClock(input.contract, measurement.at as Clock,
        input.subjectInstance, request.sourceHistory, context),
      registerGeneration: context.register.generation.id }));
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
  membershipAt: Clock | null;
}>;

type ObservationRows = Readonly<{
  usable: readonly ObservationSelection[];
  unavailable: readonly ObservationSelection[];
}>;

function selectObservationRows(sourceHistory: FactSnapshot,
  contracts: readonly MeasurementProducerContract[], evaluationClock: Clock,
  context: MeasurementDecodeContext,
  accepts: (row: ObservationSelection) => boolean): ObservationRows {
  const active = currentOwnerFactIds(sourceHistory, context);
  const usable: ObservationSelection[] = [];
  const unavailable: ObservationSelection[] = [];
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
    if (matches.length === 0) continue;
    ensure(matches.length === 1, 'current observation has no unique registered producer contract');
    const contract = matches[0]!;
    const relation = contract.categories.find(category => category.name === initial.value.category)!.relation;
    const identity = quantityIdentity(contract, measurement.subject.instance,
      initial.value.sourceSample, initial.value.category, measurement.unit, relation,
      initial.value.hardwareProfile, measurement.at as Clock);
    ensure(body.identity === identity, 'current observation identity is not canonical');
    const row = { status, contract, measurement, evidence, claim: initial.value, identity,
      membershipAt: membershipClock(contract, measurement.at as Clock,
        measurement.subject.instance, sourceHistory, context) };
    if (!accepts(row)) continue;
    const admitted = admittedEvidence(evidence, context, 'quantity witness evidence');
    (evidenceIsUsable(admitted, evaluationClock, context) ? usable : unavailable).push(row);
  }
  return freeze({ usable, unavailable });
}

function selectCurrentWitnesses(sourceHistory: FactSnapshot,
  contracts: readonly MeasurementProducerContract[], evaluationClock: Clock,
  supplied: readonly QuantityWitness[], context: MeasurementDecodeContext,
  accepts: (row: ObservationSelection) => boolean,
  unavailable: QuantityWitness[] = []): readonly QuantityWitness[] {
  const suppliedByEvent = new Map(supplied.map(witness => [witness.sourceEvent, witness]));
  const rows = selectObservationRows(sourceHistory, contracts, evaluationClock, context, accepts);
  const witnessFor = (row: ObservationSelection): QuantityWitness => {
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
  };
  const witnesses = rows.usable.map(witnessFor);
  const unavailableWitnesses = rows.unavailable.map(witnessFor);
  unavailable.push(...canonicalWitnesses(unavailableWitnesses));
  const selectedEvents = new Set([...witnesses, ...unavailableWitnesses]
    .map(witness => witness.sourceEvent));
  ensure(supplied.every(witness => selectedEvents.has(witness.sourceEvent)),
    'supplied quantity witness is outside the complete current selection');
  return canonicalWitnesses(witnesses);
}

type OwnerResolutionSelection = Readonly<{
  heads: readonly QuantityOwnerResolution[];
  usable: readonly QuantityOwnerResolution[];
}>;

function selectedOwnerResolutions(key: string, sourceHistory: FactSnapshot,
  evaluationClock: Clock, context: MeasurementDecodeContext): OwnerResolutionSelection {
  const active = currentOwnerFactIds(sourceHistory, context);
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
    const evidence = admittedEvidence(
      take(decode('Evidence', rawEvidence, context.types)), context,
      'quantity resolution evidence');
    ensure(typeof evidence.source === 'string',
      'quantity resolution evidence source must be a registered producer identity');
    const claim = take(readEvidence(evidence, evidence.observedAt, context.preserved));
    ensure(claim.value !== null && typeof claim.value === 'object' && !Array.isArray(claim.value),
      'quantity resolution evidence value is malformed');
    exactObject(claim.value, ['amount', 'witnesses']);
    candidates.push({ status, resolution: freeze({ owner: evidence.source, key,
      witnesses: exactTextArray((claim.value as Record<string, unknown>).witnesses,
        'quantity resolution evidence witnesses', 1024),
      amount: finiteNonnegative((claim.value as Record<string, unknown>).amount,
        'quantity resolution evidence amount'), evidence }) });
  }
  if (candidates.length === 0) return freeze({ heads: [], usable: [] });
  const facts = sourceHistory.entries.map(row => row.fact);
  const heads = candidates.filter(candidate => !candidates.some(other =>
    other.status.fact.id !== candidate.status.fact.id
      && causalCone(other.status.fact, facts).some(fact => fact.id === candidate.status.fact.id)));
  const resolutions = heads.map(head => head.resolution)
    .sort((a, b) => a.evidence.id.localeCompare(b.evidence.id));
  return freeze({ heads: resolutions,
    usable: resolutions.filter(resolution =>
      evidenceIsUsable(resolution.evidence, evaluationClock, context)) });
}

function resolutionWitnessStatus(id: string, key: string,
  contract: MeasurementProducerContract, sourceHistory: FactSnapshot,
  resolutionAt: Clock, context: MeasurementDecodeContext): FactStatus {
  const matches = sourceHistory.entries.filter(status => {
    const body = status.body as { readonly evidence?: { readonly id?: unknown } } | null;
    return status.fact.kind === 'measurement-observation' && body?.evidence?.id === id;
  });
  ensure(matches.length === 1 && cleanStatus(matches[0]!),
    'quantity resolution witness lacks one clean signed history row');
  const status = matches[0]!;
  const body = status.body as unknown as Record<string, Json>;
  ensure(body.measurement !== null && typeof body.measurement === 'object'
    && !Array.isArray(body.measurement), 'quantity resolution witness measurement is malformed');
  const rawSubject = (body.measurement as Record<string, Json>).subject;
  ensure(rawSubject !== null && typeof rawSubject === 'object' && !Array.isArray(rawSubject)
    && typeof (rawSubject as Record<string, Json>).kind === 'string',
  'quantity resolution witness subject is malformed');
  const measurement = take(decodeMeasurement(
    (rawSubject as Record<string, Json>).kind as string, body.measurement, context.types));
  const evidence = admittedEvidence(
    take(decode('Evidence', body.evidence, context.types)), context,
    'quantity resolution witness evidence');
  const observed = measurementClaim(evidence, resolutionAt, context);
  const category = contract.categories.find(candidate => candidate.name === observed.value.category
    && candidate.unit === measurement.unit);
  ensure(category !== undefined && evidence.id === id && evidence.source === contract.producer
    && measurement.by === contract.producer
    && observed.claim.subject === measurement.subject.instance
    && observed.claim.predicate === contract.evidencePredicate,
  'quantity resolution witness differs from the registered quantity producer');
  const identity = quantityIdentity(contract, measurement.subject.instance,
    observed.value.sourceSample, observed.value.category, measurement.unit, category.relation,
    observed.value.hardwareProfile, measurement.at as Clock);
  ensure(body.identity === key && identity === key && observed.value.state === 'reported'
    && Object.is(observed.value.amount, measurement.value),
  'quantity resolution witness names another quantity or unavailable amount');
  return status;
}

function validateResolution(resolution: QuantityOwnerResolution, key: string,
  current: readonly QuantityWitness[], allCurrent: readonly QuantityWitness[],
  sourceHistory: FactSnapshot, context: MeasurementDecodeContext): QuantityOwnerResolution | null {
  exactObject(resolution, ['owner', 'key', 'witnesses', 'amount', 'evidence']);
  substantive(resolution.owner, 'quantity resolution owner');
  ensure(resolution.key === key, 'quantity resolution names another quantity');
  const ids = exactTextArray(resolution.witnesses, 'quantity resolution witnesses', 1024);
  const reported = current.filter(row => row.state === 'reported');
  const currentById = new Map(reported.map(row => [row.sourceEvent, row] as const));
  const contract = witnessCurrent(reported[0] ?? current[0] ?? allCurrent[0]!, context).contract;
  ensure(resolution.owner === contract.producer
    && context.types.register.producers.includes(resolution.owner),
  'quantity resolution owner differs from the registered producer');
  take(admitMeasurementAmount({ contract,
    category: reported[0]?.category ?? current[0]?.category ?? allCurrent[0]!.category,
    amount: finiteNonnegative(resolution.amount, 'quantity resolution amount') }, context));
  const evidence = admittedEvidence(resolution.evidence, context,
    'quantity resolution evidence');
  ensure(evidence.source === resolution.owner, 'quantity resolution evidence has a foreign producer');
  const claim = take(readEvidence(evidence, evidence.observedAt, context.preserved));
  exactObject(claim.value, ['amount', 'witnesses']);
  const claimIds = exactTextArray((claim.value as Record<string, unknown>).witnesses,
    'quantity resolution evidence witnesses', 1024);
  ensure(claim.subject === key && claim.predicate === 'quantity-resolved'
    && Object.is((claim.value as Record<string, unknown>).amount, resolution.amount)
    && encoding([...claimIds].sort()).bytes === encoding([...ids].sort()).bytes,
  'quantity resolution evidence does not bind key, amount, and witnesses');
  const status = statusContaining(sourceHistory, [evidence], 'quantity resolution evidence', context);
  const facts = sourceHistory.entries.map(row => row.fact);
  let namesUnavailableHistory = false;
  for (const id of ids) {
    const witness = currentById.get(id);
    const witnessStatus = witness
      ? facts.find(candidate => candidate.id === witnessCurrent(witness, context).factId)!
      : resolutionWitnessStatus(id, key, contract, sourceHistory,
        evidence.observedAt, context).fact;
    ensure(causalCone(status.fact, facts).some(fact => fact.id === witnessStatus.id),
      'quantity resolution is not causally later than every competing witness');
    if (!witness) namesUnavailableHistory = true;
  }
  if (namesUnavailableHistory) return null;
  const omitted = reported.filter(witness => !ids.includes(witness.sourceEvent));
  if (omitted.length > 0) {
    // A former complete resolution is no longer current authority when signed history
    // later or concurrently adds another disagreeing witness. Preserve that witness set
    // as unresolved. Only a witness already in the resolution's causal past proves that
    // the owner omitted evidence it necessarily knew about and makes the resolution
    // malformed; concurrent evidence was not yet available to either causal branch.
    ensure(omitted.every(witness => {
      const dependency = witnessCurrent(witness, context);
      const fact = facts.find(candidate => candidate.id === dependency.factId)!;
      return !causalCone(status.fact, facts).some(candidate => candidate.id === fact.id);
    }), 'quantity resolution does not name every current reported witness');
    return null;
  }
  return freeze({ ...resolution, witnesses: [...ids].sort(), evidence });
}

function resolveQuantityFromCurrentHistory(request: CurrentQuantityResolutionRequest,
  context: MeasurementDecodeContext): ResolvedQuantity {
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
  const unavailable: QuantityWitness[] = [];
  const complete = selectCurrentWitnesses(request.sourceHistory, [...contracts.values()],
    evaluationClock, supplied, context, row => row.identity === key, unavailable);
  const allCurrent = canonicalWitnesses([...complete, ...unavailable]);
  ensure(allCurrent.length > 0, 'quantity has no current observation heads in owner history');
  const current = [...heads(complete)].sort((a, b) => a.sourceEvent.localeCompare(b.sourceEvent));
  const reported = current.filter(row => row.state === 'reported');
  const selected = selectedOwnerResolutions(key, request.sourceHistory,
    evaluationClock, context);
  const validated = selected.heads.map(candidate => ({ candidate,
    current: validateResolution(candidate, key, current, allCurrent,
      request.sourceHistory, context) }));
  const usableResolutionIds = new Set(selected.usable.map(candidate => candidate.evidence.id));
  const currentResolutions = validated
    .filter(candidate => candidate.current !== null
      && usableResolutionIds.has(candidate.candidate.evidence.id))
    .map(candidate => candidate.current!);
  if (request.resolution !== undefined) {
    ensure(currentResolutions.length === 1
      && encoding(currentResolutions[0]).bytes === encoding(request.resolution).bytes,
    'caller-supplied quantity resolution differs from the current owner selection');
  }
  const resolution = currentResolutions.length === 1 ? currentResolutions[0]! : null;
  const occurrenceClocks = new Set(reported.map(witness =>
    encoding(witnessCurrent(witness, context).occurrenceAt).bytes));
  let result: ResolvedQuantity;
  if (currentResolutions.length > 1)
    result = freeze({ key, amount: null, state: 'unresolved' as const,
      witnesses: allCurrent, reason: 'competing current owner resolutions' });
  else if (reported.length === 0)
    result = freeze({ key, amount: null, state: 'unavailable' as const, witnesses: allCurrent,
      reason: current.map(row => row.state).sort().join(',')
        || (unavailable.length > 0 ? 'current witnesses expired or lie in the future' : 'missing') });
  else {
    const amounts = [...new Set(reported.map(row => row.measurement.value))];
    if (occurrenceClocks.size > 1)
      result = freeze({ key, amount: null, state: 'unresolved' as const,
        witnesses: allCurrent, reason: 'current witness occurrence clocks disagree' });
    else if (amounts.length === 1)
      result = freeze({ key, amount: amounts[0]!, state: 'resolved' as const,
        witnesses: allCurrent, reason: 'compatible current witnesses' });
    else if (resolution)
      result = freeze({ key, amount: resolution.amount, state: 'resolved' as const,
        witnesses: allCurrent,
        reason: `resolved by ${resolution.owner} evidence ${resolution.evidence.id}` });
    else result = freeze({ key, amount: null, state: 'unresolved' as const,
      witnesses: allCurrent, reason: 'current witness amounts disagree' });
  }
  quantityDependencies.set(result, freeze({ sourceHistory: request.sourceHistory,
    witnesses: allCurrent, usableWitnesses: complete, resolution,
    resolutions: currentResolutions, registerGeneration: context.register.generation.id }));
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
    // Establish provenance without treating the witnesses that happened to be usable
    // when the caller resolved the quantity as the current selection. The selection
    // below replays every retained witness at the consequential clock, so an expired
    // witness remains audit evidence while a fresh equivalent witness can still carry
    // the amount.
    const dependencies = request.quantities.map(quantity =>
      quantityCurrent(quantity, context));
    request.quantities.forEach((quantity, index) => {
      const hasUsableWitness = dependencies[index]!.witnesses.some(witness =>
        evidenceIsUsable(admittedEvidence(witness.evidence, context,
          'quantity witness evidence'), evaluationClock, context));
      if (!hasUsableWitness) quantityCurrent(quantity, context, evaluationClock);
    });
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
        && row.membershipAt !== null
        && clockOrder(start, row.membershipAt, context) <= 0
        && clockOrder(row.membershipAt, end, context) < 0);
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
        ...(resolution ? { resolution } : {}) }, context);
    });
    ensure(request.quantities.every(quantity => groupedQuantities.has(quantity.key)),
      'aggregate caller quantity is outside the complete current source selection');
    const contracts = new Set<string>();
    const relations = new Set<string>();
    const hardware = new Set<string | null>();
    for (const quantity of quantities) {
      quantityCurrent(quantity, context, evaluationClock);
      ensure(quantity.witnesses.length > 0, 'aggregate quantity has no witnesses');
      for (const witness of quantity.witnesses) {
        const dependency = witnessCurrent(witness, context);
        ensure(witness.measurement.unit === request.unit && witness.producer === request.producer
          && witness.category === request.category
          && witness.measurement.subject.kind === policy.sourceKind,
        'aggregate member basis differs from registered policy');
        ensure(dependency.occurrenceAt !== null,
          'aggregate member lacks an owner-recorded membership clock');
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
    const current = currentOwnerFactIds(request.sourceHistory, context);
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
    const clean = request.sourceHistory.entries.filter(status => current.has(status.fact.id)
      && cleanStatus(status)
      && clockOrder(status.fact.at, evaluationClock, context) <= 0);
    const records = clean.flatMap(status => {
      const record = (status.body as { readonly record?: JudgmentRecord }).record;
      if (!record || !['JudgmentRequest', 'JudgmentAttemptRecord', 'JudgmentResolution'].includes(record.type)
        || status.fact.kind !== `judgment-${record.type}`) return [];
      return [{ status, record }];
    });
    const contested = request.sourceHistory.entries.filter(status => current.has(status.fact.id)
      && (() => {
      const record = (status.body as { readonly record?: JudgmentRecord }).record;
      if (!record || status.conflicts.length === 0) return false;
      if (record.type === 'JudgmentRequest') return `attempt:${record.id}:1` === request.attempt;
      return (record.type === 'JudgmentAttemptRecord' || record.type === 'JudgmentResolution')
        && record.attempt === request.attempt;
      })());
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
    attributionDependencies.set(result, freeze({ request, sourceHistory: request.sourceHistory,
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
  context: MeasurementDecodeContext,
  evaluationClock: Clock = window.evidenceHorizon): WindowDependency {
  const dependency = windowDependencies.get(window);
  ensure(dependency !== undefined, 'burn window must come from its current-history constructor');
  currentGeneration(context, dependency.registerGeneration);
  validateCurrentSourceHistory(dependency.sourceHistory, context);
  const evidence = resolveAdmittedEvidence(window.populationEvidence, context,
    'burn population evidence', evaluationClock);
  statusContaining(dependency.sourceHistory, [evidence], 'burn population evidence', context);
  window.samples.flatMap(sample => sample.quantities).forEach(quantity =>
    quantityCurrent(quantity, context));
  return dependency;
}

function burnOwnerEvidenceDebt(sourceHistory: FactSnapshot, horizon: Clock,
  samples: readonly BurnSample[], observed: readonly string[], noExchange: readonly string[],
  context: MeasurementDecodeContext): readonly string[] {
  const active = currentOwnerFactIds(sourceHistory, context);
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
  const debt: string[] = [...new Set(sourceHistory.entries.map(status => status.fact.kind))]
    .filter(kind => kind === 'measurement-observation' || kind === 'measurement-evidence'
      || sourceHistory.entries.filter(status => status.fact.kind === kind).every(status =>
        typeof (status.body as { readonly record?: { readonly id?: unknown } } | null)
          ?.record?.id === 'string'))
    .flatMap(kind => ownerSelectionDebt(sourceHistory, kind, context));
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

function rosterDebt(actual: ReadonlySet<string>, claimed: readonly string[], label: string,
  exact = false): readonly string[] {
  const debt = [...actual].filter(identity => !claimed.includes(identity))
    .map(identity => `population-omits-${label}:${identity}`);
  if (exact) debt.push(...claimed.filter(identity => !actual.has(identity))
    .map(identity => `population-invents-${label}:${identity}`));
  return debt;
}

/** Enumerate the exact signed population before considering the population claim. */
function reconcileBurnPopulation(sourceHistory: FactSnapshot, start: Clock, end: Clock,
  horizon: Clock, samples: readonly BurnSample[], arrays: Readonly<{
    attempts: readonly string[]; observed: readonly string[]; supported: readonly string[];
    noExchange: readonly string[]; uncertain: readonly string[]; conflicted: readonly string[];
    events: readonly string[];
  }>, context: MeasurementDecodeContext): readonly string[] {
  const suppliedContracts = samples.flatMap(sample => sample.quantities)
    .flatMap(quantity => {
      quantityCurrent(quantity, context, horizon);
      return quantity.witnesses.map(witness => witnessCurrent(witness, context).contract);
    });
  const contracts = [...new Map([
    ...snapshotProducerContracts(sourceHistory, context), ...suppliedContracts,
  ].map(contract => [contract.id, contract] as const)).values()];
  const observations = selectObservationRows(sourceHistory, contracts, horizon, context,
    row => row.membershipAt !== null
      && clockOrder(start, row.membershipAt, context) <= 0
      && clockOrder(row.membershipAt, end, context) < 0);
  const selectedObservations = [...observations.usable, ...observations.unavailable];
  const modelExchanges = new Set(selectedObservations
    .filter(row => row.contract.family === 'model-call')
    .map(row => row.measurement.subject.instance));
  const modelUsage = new Set(observations.usable
    .filter(row => row.contract.family === 'model-call')
    .map(row => row.measurement.subject.instance));
  const events = new Set(selectedObservations
    .filter(row => row.contract.family === 'programmatic-event')
    .map(row => row.measurement.subject.instance));

  const active = currentOwnerFactIds(sourceHistory, context);
  const attempts = new Map<string, FactStatus[]>();
  for (const status of sourceHistory.entries) {
    if (!active.has(status.fact.id)) continue;
    const record = (status.body as { readonly record?: JudgmentRecord } | null)?.record;
    if (record?.type !== 'JudgmentAttemptRecord') continue;
    const bucket = attempts.get(record.attempt) ?? [];
    bucket.push(status); attempts.set(record.attempt, bucket);
  }
  const actualAttempts = new Set(modelExchanges);
  const observed = new Set(modelExchanges);
  const uncertain = new Set<string>();
  const conflicted = new Set<string>();
  for (const [attempt, rows] of attempts) {
    const phase = (name: import('../judgment/index.js').JudgmentAttemptRecord['phase']) =>
      rows.filter(status => {
        const record = (status.body as unknown as {
          readonly record: import('../judgment/index.js').JudgmentAttemptRecord;
        }).record;
        return record.phase === name;
      });
    const dispatch = phase('dispatch-observed');
    const prepared = phase('prepared');
    const anchor = dispatch[0] ?? prepared[0];
    if (!anchor || clockOrder(start, anchor.fact.at, context) > 0
      || clockOrder(anchor.fact.at, end, context) >= 0) continue;
    actualAttempts.add(attempt);
    if (phase('response-observed').some(cleanStatus)) observed.add(attempt);
    if (rows.some(status => status.conflicts.length > 0)) conflicted.add(attempt);
    else if (dispatch.length !== 1 || rows.some(status => status.taint.length > 0))
      uncertain.add(attempt);
  }
  const noExchange = new Set<string>();
  for (const status of sourceHistory.entries) {
    if (!active.has(status.fact.id) || !cleanStatus(status)) continue;
    const record = (status.body as { readonly record?: JudgmentRecord } | null)?.record;
    if (record?.type !== 'BenchmarkRunRecord') continue;
    for (const execution of record.executions)
      if (execution.attempt !== undefined
        && (execution.disposition === 'refused' || execution.disposition === 'cancelled')
        && actualAttempts.has(execution.attempt.id)) noExchange.add(execution.attempt.id);
  }
  return [...new Set([
    ...rosterDebt(actualAttempts, arrays.attempts, 'attempt'),
    ...rosterDebt(observed, arrays.observed, 'observed-exchange'),
    ...rosterDebt(modelUsage, arrays.supported, 'usage-supported', true),
    ...rosterDebt(events, arrays.events, 'programmatic-event', true),
    ...rosterDebt(noExchange, arrays.noExchange, 'proven-no-exchange'),
    ...rosterDebt(uncertain, arrays.uncertain, 'dispatch-uncertain'),
    ...rosterDebt(conflicted, arrays.conflicted, 'conflicted-attempt'),
  ])].sort();
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
          if (witnessDependency.occurrenceAt !== null) {
            ensure(clockOrder(start, witnessDependency.occurrenceAt, context) <= 0
              && clockOrder(witnessDependency.occurrenceAt, end, context) < 0,
            'burn sample is outside its half-open source-time window');
            occurrences.add(encoding(witnessDependency.occurrenceAt).bytes);
          }
        }
      }
      ensure(occurrences.size === 1 || sample.source === 'model-exchange' && occurrences.size === 0,
        'burn sample quantities use different occurrence times');
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
    const status = statusContaining(request.sourceHistory, [evidence], 'burn population evidence', context);
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
    const populationDebt = reconcileBurnPopulation(request.sourceHistory, start, end, horizon,
      input.samples, arrays, context);
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
    const ownerEvidenceDebt = [...new Set([...burnOwnerEvidenceDebt(request.sourceHistory, horizon,
      input.samples, arrays.observed, arrays.noExchange, context), ...populationDebt])].sort();
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
  evaluationClock: Clock, context: MeasurementDecodeContext): number | null {
  const selection = policy.selections.find(row => row.source === sample.source);
  if (!selection || selection.version !== sample.selectionVersion) return null;
  const expectedFamily = sample.source === 'model-exchange' ? 'model-call' : 'programmatic-event';
  const amounts = selection.categories.map(category => {
    const matches = sample.quantities.map(quantity => ({ quantity,
      current: resolveQuantityCurrentAt(quantity, context, evaluationClock) }))
      .filter(({ current }) => current.state === 'resolved' && current.witnesses.length > 0
        && current.witnesses.every(witness => witnessCurrent(witness, context).contract.family === expectedFamily
          && witness.category === category && witness.measurement.unit === policy.unit
          && witness.measurement.subject.instance === sample.identity));
    ensure(matches.length <= 1, 'burn sample has competing category quantities');
    return matches[0]?.current.amount ?? null;
  });
  if (amounts.some(value => value === null)) return null;
  const amount = amounts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  ensure(Number.isFinite(amount) && amount >= 0, 'burn selected amount overflow');
  if (policy.unit === 'tokens' || policy.unit === 'bytes')
    ensure(Number.isSafeInteger(amount), 'burn selected discrete amount overflow');
  return amount;
}

function resolvedSamples(policy: BurnPolicy, samples: readonly BurnSample[],
  evaluationClock: Clock, context: MeasurementDecodeContext) {
  let amount = 0;
  let discreteAmount = 0n;
  let count = 0;
  let lostCurrentSupport = false;
  const debt: string[] = [];
  for (const sample of samples) {
    const selected = selectedAmount(policy, sample, evaluationClock, context);
    if (selected === null) {
      debt.push(`unresolved:${sample.identity}`);
      if (sample.quantities.some(quantity => quantity.state === 'resolved'
        && resolveQuantityCurrentAt(quantity, context, evaluationClock).state !== 'resolved'))
        lostCurrentSupport = true;
    }
    else {
      if (policy.unit === 'tokens' || policy.unit === 'bytes') discreteAmount += BigInt(selected);
      else amount += selected;
      count++;
    }
  }
  if (policy.unit === 'tokens' || policy.unit === 'bytes') {
    ensure(discreteAmount <= BigInt(Number.MAX_SAFE_INTEGER),
      'burn resolved discrete amount overflow');
    amount = Number(discreteAmount);
  } else ensure(Number.isFinite(amount) && amount >= 0, 'burn resolved amount overflow');
  return freeze({ amount, count, debt: [...new Set(debt)].sort(),
    lostCurrentSupport, identities: samples.map(sample => sample.identity).sort() });
}

function burnWindowCondition(policy: BurnPolicy, window: BurnWindow,
  dependency: WindowDependency, evaluationClock: Clock,
  context: MeasurementDecodeContext) {
  const target = resolvedSamples(policy,
    window.samples.filter((sample: BurnSample) => sample.feature === policy.feature),
    evaluationClock, context);
  const comparison = resolvedSamples(policy, window.samples, evaluationClock, context);
  ensure(comparison.lostCurrentSupport || window.comparisonScopeAmount === comparison.amount,
    'comparison denominator differs from its current registered-selection population');
  const coverage = window.observedExchanges === 0 ? null
    : window.usageSupportedExchanges / window.observedExchanges;
  const ownerDebt = dependency.ownerEvidenceDebt;
  const structural = target.debt.length > 0 || comparison.debt.length > 0
    || ownerDebt.length > 0;
  const incomplete = !window.censusComplete || !window.collectorsComplete
    || window.dispatchUncertain > 0 || window.conflictedAttempts > 0 || structural;
  const adequate = !incomplete && target.count >= policy.minimumEligibleSamples
    && (coverage === null || coverage >= policy.minimumUsageCoverage);
  return { target, comparison, coverage, incomplete, adequate, ownerDebt };
}

function exactNumberRational(value: number): Readonly<{
  numerator: bigint; denominator: bigint;
}> {
  ensure(Number.isFinite(value), 'burn baseline median input must be finite');
  const bytes = new ArrayBuffer(8);
  const view = new DataView(bytes);
  view.setFloat64(0, value, false);
  const bits = view.getBigUint64(0, false);
  const negative = (bits >> 63n) !== 0n;
  const exponentBits = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  let numerator = exponentBits === 0 ? fraction : (1n << 52n) | fraction;
  const exponent = exponentBits === 0 ? -1074 : exponentBits - 1023 - 52;
  let denominator = 1n;
  if (exponent >= 0) numerator <<= BigInt(exponent);
  else denominator <<= BigInt(-exponent);
  if (negative) numerator = -numerator;
  return { numerator, denominator };
}

function exactMean(left: number, right: number): number {
  const a = exactNumberRational(left);
  const b = exactNumberRational(right);
  const numerator = a.numerator * b.denominator + b.numerator * a.denominator;
  const denominator = 2n * a.denominator * b.denominator;
  const candidate = left / 2 + right / 2;
  const represented = exactNumberRational(candidate);
  ensure(represented.numerator * denominator === numerator * represented.denominator,
    'burn baseline median is not exactly representable');
  return candidate;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]!
    : exactMean(ordered[middle - 1]!, ordered[middle]!);
}

function recoveryVoteCurrent(policy: BurnPolicy, vote: RecoveryVoteDependency,
  evaluationClock: Clock, context: MeasurementDecodeContext): boolean {
  const currentDependency = validateWindowCurrent(vote.window, context, evaluationClock);
  const baselineDependencies = vote.baselines.map(window =>
    validateWindowCurrent(window, context, evaluationClock));
  const conditions = [burnWindowCondition(policy, vote.window, currentDependency,
    evaluationClock, context), ...vote.baselines.map((window, index) =>
    burnWindowCondition(policy, window, baselineDependencies[index]!,
      evaluationClock, context))];
  const confidence = vote.baselines.length > 0 && conditions.every(row => row.adequate);
  const currentAmount = conditions[0]!.target.count > 0
    ? conditions[0]!.target.amount : null;
  const baselineAmount = confidence
    ? median(conditions.slice(1).map(row => row.target.amount)) : null;
  const share = currentAmount === null || conditions[0]!.comparison.amount === 0
    ? null : currentAmount / conditions[0]!.comparison.amount;
  const excess = currentAmount === null || baselineAmount === null
    ? null : Math.max(0, currentAmount - baselineAmount);
  return confidence && excess !== null && share !== null
    && excess <= policy.recoveryExcess && share <= policy.recoveryShare;
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
  for (const field of ['lastEvaluatedWindow', 'lastEvaluatedObservation'] as const)
    if (Object.hasOwn(previous, field))
      ensure(previous[field] === null || typeof previous[field] === 'string'
        && previous[field]!.trim().length > 0,
      `burn episode ${field} is malformed`);
  ensure(Object.hasOwn(previous, 'lastEvaluatedWindow')
    === Object.hasOwn(previous, 'lastEvaluatedObservation'),
  'burn episode evaluation references must be present together');
}

export function evaluateCurrentBurn(policyInput: BurnPolicy, previous: BurnEpisodeState,
  current: BurnWindow, baselines: readonly BurnWindow[],
  context: MeasurementDecodeContext): Result<BurnEvaluation> {
  return boundary('CurrentBurnEvaluation', { policyInput, previous, current, baselines }, context, () => {
    const policy = currentBurnPolicy(policyInput, context);
    validateEpisode(previous);
    ensure(Array.isArray(baselines) && baselines.length <= 10_000,
      'burn baseline windows must be bounded');
    const consequentialClock = current.evidenceHorizon;
    const currentDependency = validateWindowCurrent(current, context, consequentialClock);
    const baselineDependencies = baselines.map(window =>
      validateWindowCurrent(window, context, consequentialClock));
    ensure(new Set([currentDependency.interval, ...baselineDependencies.map(row => row.interval)]).size
      === baselines.length + 1, 'burn current and baseline intervals must be distinct');
    let currentRecoveryVotes: readonly RecoveryVoteDependency[] = [];
    const priorRecoveryDebt: string[] = [];
    if (previous.recoveryCount > 0) {
      const prior = episodeDependencies.get(previous);
      ensure(prior !== undefined && prior.policy === policy.id
        && prior.recoveryCount === previous.recoveryCount
        && prior.recoveryVotes.length === previous.recoveryCount
        && prior.registerGeneration === context.register.generation.id
        && prior.recoveryEligible,
      'prior burn recovery count lacks its current owner observation');
      const finalVote = prior.recoveryVotes.at(-1)!;
      ensure(finalVote.window === prior.window
        && encoding(finalVote.baselines).bytes === encoding(prior.baselines).bytes,
      'prior burn recovery chain differs from its latest vote');
      const priorWindow = validateWindowCurrent(finalVote.window, context, consequentialClock);
      ensure(previous.lastEvaluatedWindow === priorWindow.interval
        && previous.lastEvaluatedObservation === priorWindow.observation,
      'prior burn recovery references differ from their owner observation');
      for (const vote of prior.recoveryVotes) {
        if (!recoveryVoteCurrent(policy, vote, consequentialClock, context)) {
          priorRecoveryDebt.push(
            `prior-recovery:${vote.window.id}:evidence-no-longer-usable`);
          currentRecoveryVotes = [];
          continue;
        }
        const dependency = validateWindowCurrent(vote.window, context, consequentialClock);
        const preceding = currentRecoveryVotes.at(-1);
        const precedingInterval = preceding === undefined ? null
          : intervalFromToken(validateWindowCurrent(preceding.window, context,
            consequentialClock).interval);
        currentRecoveryVotes = preceding === undefined || precedingInterval === null
          || encoding(precedingInterval.end).bytes !== encoding(vote.window.start).bytes
          ? [vote] : [...currentRecoveryVotes, vote];
        ensure(dependency.interval === intervalToken(vote.window.start, vote.window.end),
          'prior recovery vote interval is no longer owner-bound');
      }
    }
    const orderedBaselines = baselines.map((window, index) => ({ window,
      dependency: baselineDependencies[index]! })).sort((a, b) =>
      clockOrder(a.window.start, b.window.start, context));
    for (let index = 0; index < orderedBaselines.length; index++) {
      const nextStart = index + 1 < orderedBaselines.length
        ? orderedBaselines[index + 1]!.window.start : current.start;
      ensure(clockOrder(orderedBaselines[index]!.window.end, nextStart, context) <= 0,
        'burn baseline windows must be nonoverlapping and precede the current interval');
    }
    const all = [current, ...orderedBaselines.map(row => row.window)];
    const allDependencies = [currentDependency, ...orderedBaselines.map(row => row.dependency)];
    const conditions = all.map((window, index) => burnWindowCondition(policy, window,
      allDependencies[index]!, consequentialClock, context));
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
    debt.push(...priorRecoveryDebt);
    if (!current.censusComplete) debt.push('census-incomplete');
    if (!current.collectorsComplete) debt.push('collector-incomplete');
    if (current.dispatchUncertain > 0) debt.push('dispatch-uncertain');
    if (current.conflictedAttempts > 0) debt.push('attempt-conflict');
    if (now.target.count < policy.minimumEligibleSamples) debt.push('eligible-sample-floor');
    if (now.coverage !== null && now.coverage < policy.minimumUsageCoverage)
      debt.push('usage-coverage-floor');
    // Current-window debt above is the landed presentation vocabulary. Baseline evidence
    // composes beside it: never drop a failed baseline merely because the current window
    // is complete. Each inadequate baseline retains its identity, failed conditions,
    // completeness bits, and raw population counts in one deterministic evidence row.
    for (let index = 1; index < all.length; index++) {
      const window = all[index]!;
      const condition = conditions[index]!;
      if (condition.adequate) continue;
      const failures = [
        ...condition.target.debt,
        ...condition.comparison.debt,
        ...condition.ownerDebt,
        !window.censusComplete ? 'census-incomplete' : null,
        !window.collectorsComplete ? 'collector-incomplete' : null,
        window.dispatchUncertain > 0 ? 'dispatch-uncertain' : null,
        window.conflictedAttempts > 0 ? 'attempt-conflict' : null,
        condition.target.count < policy.minimumEligibleSamples ? 'eligible-sample-floor' : null,
        condition.coverage !== null && condition.coverage < policy.minimumUsageCoverage
          ? 'usage-coverage-floor' : null,
      ].filter((value): value is string => value !== null);
      debt.push(`baseline:${window.id}:failed=${[...new Set(failures)].sort().join(',')}`
        + `;censusComplete=${window.censusComplete};collectorsComplete=${window.collectorsComplete}`
        + `;eligibleSampleCount=${condition.target.count};minimumEligibleSamples=${policy.minimumEligibleSamples}`
        + `;observedExchanges=${window.observedExchanges}`
        + `;usageSupportedExchanges=${window.usageSupportedExchanges}`
        + `;usageCoverage=${condition.coverage === null ? 'undefined' : condition.coverage}`
        + `;minimumUsageCoverage=${policy.minimumUsageCoverage}`
        + `;attemptedDispatches=${window.attemptedDispatches}`
        + `;provenNoExchange=${window.provenNoExchange}`
        + `;dispatchUncertain=${window.dispatchUncertain}`
        + `;conflictedAttempts=${window.conflictedAttempts}`
        + `;programmaticEvents=${window.programmaticEvents}`);
    }
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
      const priorVote = currentRecoveryVotes.at(-1);
      const priorInterval = priorVote === undefined ? null
        : intervalFromToken(validateWindowCurrent(priorVote.window, context,
          consequentialClock).interval);
      const same = priorVote !== undefined
        && validateWindowCurrent(priorVote.window, context,
          consequentialClock).interval === currentDependency.interval;
      const consecutive = priorVote !== undefined && priorInterval !== null
        && encoding(priorInterval.end).bytes === encoding(current.start).bytes;
      const currentVote = freeze({ window: current, baselines: [...baselines] });
      currentRecoveryVotes = same ? currentRecoveryVotes
        : consecutive ? [...currentRecoveryVotes, currentVote] : [currentVote];
      const recoveryCount = currentRecoveryVotes.length;
      episode = freeze({ ...previous,
        state: recoveryCount >= policy.recoveryWindows ? 'closed' as const : 'open' as const,
        recoveryCount: recoveryCount >= policy.recoveryWindows ? 0 : recoveryCount,
        lastEvaluatedWindow: currentDependency.interval,
        lastEvaluatedObservation: currentDependency.observation });
    } else {
      currentRecoveryVotes = [];
      episode = freeze({ ...previous, recoveryCount: 0,
        lastEvaluatedWindow: currentDependency.interval,
        lastEvaluatedObservation: currentDependency.observation });
    }
    const recoveryEligible = classification !== 'incomplete'
      && confidence === 'adequate' && excess !== null && share !== null
      && excess <= policy.recoveryExcess && share <= policy.recoveryShare;
    episodeDependencies.set(episode, freeze({ policy: policy.id, window: current,
      baselines: [...baselines], recoveryVotes: episode.recoveryCount > 0
        ? currentRecoveryVotes : [], recoveryEligible, recoveryCount: episode.recoveryCount,
      registerGeneration: context.register.generation.id }));
    return freeze({ classification, confidence, currentAmount, baselineAmount, excess, share,
      eligibleSampleCount: now.target.count, coverage: now.coverage,
      coverageDebt: [...new Set(debt)].sort(),
      culprit: currentAmount !== null && now.target.count > 0 ? policy.feature : null,
      episode, notify, openInvestigation });
  });
}

function currentAttribution(attribution: AttributionResult, sourceHistory: FactSnapshot,
  evaluationClock: Clock, context: MeasurementDecodeContext): void {
  const dependency = attributionDependencies.get(attribution);
  ensure(dependency !== undefined && dependency.sourceHistory === sourceHistory,
    'read attribution must come from this exact current source history');
  currentGeneration(context, dependency.registerGeneration);
  validateCurrentSourceHistory(sourceHistory, context);
  const current = take(resolveCurrentAttribution({ ...dependency.request, sourceHistory,
    evaluationClock }, context));
  ensure(encoding(current).bytes === encoding(attribution).bytes,
    'read attribution is no longer supported by current owner evidence');
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
  return matches[0]!;
}

function parseObservation(status: FactStatus, projection: ProjectedView,
  request: HistoricalMeasurementReadRequest,
  context: MeasurementDecodeContext): EvidenceCompleteMeasurementReadRow | null {
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
  // Decode the signed claim at its observation point first. Freshness at the query
  // clock applies only after owner-recorded membership places the sample inside the
  // requested bounded interval; expired evidence outside that interval is not an
  // input to this presentation.
  const read = measurementClaim(evidence, measurement.at as Clock, context);
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
  const identity = quantityIdentity(contract, measurement.subject.instance, claim.sourceSample,
    claim.category, measurement.unit,
    contract.categories.find(row => row.name === claim.category)!.relation,
    claim.hardwareProfile, measurement.at as Clock);
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
  const at = membershipClock(contract, occurrenceAt, measurement.subject.instance,
    request.sourceHistory, context);
  ensure(at !== null, 'model usage lacks an owner-recorded dispatch membership clock');
  if (clockOrder(request.query.start, at, context) > 0
    || clockOrder(at, request.query.end, context) >= 0
    || request.query.evaluationClock.value - at.value > request.query.detailHorizonMs) return null;
  const currentEvidence = resolveAdmittedEvidence(evidence, context,
    'historical measurement evidence', request.query.evaluationClock);
  measurementClaim(currentEvidence, request.query.evaluationClock, context);
  let state: QuantityState | 'unattributed' | 'conflicted' = claim.state;
  let feature: string | null = null;
  let model: string | null = null;
  let machine = status.fact.machine;
  if (family === 'model-call') {
    const issued = request.attributions.filter(row => row.attempt === measurement.subject.instance);
    ensure(issued.length <= 1, 'read carries competing caller attribution agreements');
    const attribution = take(resolveCurrentAttribution({
      attempt: measurement.subject.instance,
      claimed: { feature: 'signed-history-only', model: 'signed-history-only',
        machine: 'signed-history-only' },
      evaluationClock: request.query.evaluationClock,
      sourceHistory: request.sourceHistory,
      candidates: [],
    }, context));
    if (issued[0]) {
      currentAttribution(issued[0], request.sourceHistory,
        request.query.evaluationClock, context);
      ensure(encoding(issued[0]).bytes === encoding(attribution).bytes,
        'caller attribution differs from the signed-history result');
    }
    if (attribution.state === 'unattributed') state = 'unattributed';
    else if (attribution.state === 'conflicted') state = 'conflicted';
    else {
      feature = attribution.feature; model = attribution.model; machine = attribution.machine!;
    }
  }
  return freeze({ identity, family, category: claim.category, at,
    amount: state === 'conflicted' ? null : expectedAmount, unit: measurement.unit, state,
    producer: measurement.by, sourceSample: claim.sourceSample, feature, model, machine,
    evidence: currentEvidence, evidenceManifest: [currentEvidence] });
}

function validateReadRow(row: EvidenceCompleteMeasurementReadRow,
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
  ensure(Array.isArray(row.evidenceManifest) && row.evidenceManifest.length > 0,
    'historical row evidence manifest must be nonempty');
  row.evidenceManifest.forEach(evidence => take(decode('Evidence', evidence, context.types)));
}

function cursorBinding(query: HistoricalMeasurementReadRequest['query'],
  source: readonly EvidenceCompleteMeasurementReadRow[]): string {
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

function boundedRead(request: HistoricalMeasurementReadRequest,
  rows: readonly EvidenceCompleteMeasurementReadRow[],
  sourcePartial: boolean, context: MeasurementDecodeContext,
  sourceReason = 'source history contains conflict or taint'): MeasurementReadResult {
  const query = request.query;
  ensure(query.pageSize <= 500 && query.maxExportBytes <= 1_048_576
    && query.detailHorizonMs <= 90 * 24 * 60 * 60 * 1000,
  'historical query exceeds registered bound');
  ensure(rows.length <= 100_000, 'historical read input exceeds hard cardinality bound');
  rows.forEach(row => validateReadRow(row, context));
  const canonical = new Map<string, EvidenceCompleteMeasurementReadRow>();
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
      sourcePartial ? sourceReason : null,
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
    // Establish the closed primitive kind set before either membership lookup or object-key
    // construction. Object.fromEntries would otherwise coerce a numeric kind into "42".
    const kinds = exactTextArray(generation.kinds, 'projection generation kinds', 100_000);
    ensure(Object.keys(bindings).every(kind => kinds.includes(kind)),
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
      decisions: Object.fromEntries(kinds.map(kind => [kind, bindings[kind]
        ? { kind: 'folds' as const, ...bindings[kind]! }
        : { kind: 'ignores' as const, reason: 'not a registered measurement source' }])) });
  });
}

/**
 * Part Two's public fold remains the semantic decoder. Its current public seam
 * deliberately accepts structurally open TypeScript descriptors, so this A2
 * binding additionally requires the borrowed wire descriptors to be closed
 * before passing them to that owner. This check adds no repair/currentness
 * semantics; it only prevents type-confused or extended input from crossing the
 * public fold boundary as a valid measurement binding.
 */
function validateBorrowedProjectionDescriptors(definition: ProjectionDefinition,
  generation: ProjectionGeneration): void {
  exactObject(definition, ['id', 'class', 'stalenessBound', 'decisions', 'retention']);
  substantive(definition.id, 'projection definition id');
  ensure(definition.class === 'authority-answering' || definition.class === 'informational',
    'projection class is outside the owner closed set');
  ensure(typeof definition.stalenessBound === 'number'
    && Number.isFinite(definition.stalenessBound) && definition.stalenessBound > 0,
  'projection staleness bound is malformed');
  ensure(definition.retention === 'all-identities', 'projection retention is malformed');
  exactObject(definition.decisions, Object.keys(definition.decisions));
  for (const [kind, decision] of Object.entries(definition.decisions)) {
    substantive(kind, 'projection decision kind');
    ensure(decision !== null && typeof decision === 'object' && !Array.isArray(decision),
      'projection decision is malformed');
    if (decision.kind === 'ignores') {
      exactObject(decision, ['kind', 'reason']);
      substantive(decision.reason, 'projection ignore reason');
    } else {
      exactObject(decision, ['kind', 'merge', 'identity', 'value', 'cap'], ['cap']);
      ensure(decision.kind === 'folds', 'projection decision kind is outside the owner closed set');
      ensure(['additive', 'set-union', 'max', 'min', 'exclusive-singleton',
        'cap-checked aggregate'].includes(decision.merge),
      'projection merge is outside the owner closed set');
      substantive(decision.identity, 'projection identity selector');
      substantive(decision.value, 'projection value selector');
      if (decision.merge === 'cap-checked aggregate')
        ensure(typeof decision.cap === 'string', 'projection cap is malformed');
      else ensure(decision.cap === undefined, 'projection cap is only valid for capped folds');
    }
  }

  exactObject(generation, ['reference', 'kinds', 'lineages']);
  exactObject(generation.reference, ['owner', 'name', 'id']);
  ensure(generation.reference.owner === 'part-three'
    && generation.reference.name === 'RegisterGeneration',
  'projection generation reference is not owner-issued');
  substantive(generation.reference.id, 'projection generation id');
  const kinds = exactTextArray(generation.kinds, 'projection generation kinds', 100_000);
  ensure(Object.keys(definition.decisions).length === kinds.length
    && kinds.every(kind => Object.hasOwn(definition.decisions, kind)),
  'projection decisions differ from generation kinds');
  exactObject(generation.lineages, Object.keys(generation.lineages));
  for (const [machine, lineage] of Object.entries(generation.lineages)) {
    substantive(machine, 'projection lineage machine');
    exactObject(lineage, ['head', 'observedAt', 'closed']);
    ensure(lineage.observedAt === null || typeof lineage.observedAt === 'number'
      && Number.isFinite(lineage.observedAt), 'projection lineage observed-at is malformed');
    ensure(typeof lineage.closed === 'boolean', 'projection lineage closed state is malformed');
    if (lineage.head !== null) {
      exactObject(lineage.head, ['machine', 'epoch', 'position'], ['machine']);
      const headMachine = (lineage.head as unknown as { readonly machine?: unknown }).machine;
      ensure(!Object.hasOwn(lineage.head, 'machine')
        || typeof headMachine === 'string' && headMachine === machine,
      'projection lineage head machine is malformed');
      ensure(Number.isSafeInteger(lineage.head.epoch) && lineage.head.epoch >= 0
        && Number.isSafeInteger(lineage.head.position) && lineage.head.position >= 0,
      'projection lineage head is malformed');
    }
  }
}

function validateCompleteMeasurementProjection(sourceHistory: FactSnapshot,
  definition: ProjectionDefinition, generation: ProjectionGeneration,
  context: MeasurementDecodeContext): void {
  const actualFrontier = snapshotFrontier(sourceHistory);
  for (const [machine, head] of Object.entries(actualFrontier)) {
    const supplied = generation.lineages[machine]?.head;
    ensure(supplied !== null && supplied !== undefined
      && supplied.epoch === head.epoch && supplied.position === head.position,
    'historical source generation does not bind the current owner frontier');
  }
  ensure(sourceHistory.entries.every(status => generation.kinds.includes(status.fact.kind)),
    'historical source generation omits a current owner fact kind');
  const active = currentOwnerFactIds(sourceHistory, context);
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
    validateBorrowedProjectionDescriptors(request.sourceDefinition, request.sourceGeneration);
    ensure(request.sourceDefinition.id === 'measurement.source.all-identities'
      && request.sourceDefinition.retention === 'all-identities',
    'historical source projection must retain all identities');
    ensure(encoding(request.sourceGeneration.reference).bytes
      === encoding(context.register.generation).bytes,
    'historical source register generation is not current');
    validateCompleteMeasurementProjection(request.sourceHistory, request.sourceDefinition,
      request.sourceGeneration, context);
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
    request.attributions.forEach(attribution => currentAttribution(attribution,
      request.sourceHistory, request.query.evaluationClock, context));
    const projection = take(foldProjection(request.sourceDefinition, request.sourceHistory,
      request.sourceGeneration, context));
    const currentSelection = currentOwnerSelection(request.sourceHistory,
      'measurement-observation', context);
    const observationRows: EvidenceCompleteMeasurementReadRow[] = [];
    let quarantined = 0;
    for (const status of currentSelection.statuses) {
      try {
        const row = parseObservation(status, projection, request, context);
        if (row !== null) observationRows.push(row);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        if (!['measurement comparison: subject, instance, or unit mismatch',
          'evidence expired or observation lies in the future',
          'model usage lacks an owner-recorded dispatch membership clock']
          .some(message => detail.includes(message))) throw error;
        quarantined++;
      }
    }
    const boundedIdentities = new Set(observationRows.map(row => row.identity));
    const witnesses = selectCurrentWitnesses(request.sourceHistory, request.producers,
      request.query.evaluationClock, [], context, row => boundedIdentities.has(row.identity));
    const groupedWitnesses = new Map<string, QuantityWitness[]>();
    for (const witness of witnesses) {
      const bucket = groupedWitnesses.get(witness.key) ?? [];
      bucket.push(witness);
      groupedWitnesses.set(witness.key, bucket);
    }
    const quantities = new Map([...groupedWitnesses.entries()].map(([key, selected]) =>
      [key, resolveQuantityFromCurrentHistory({ witnesses: selected,
        sourceHistory: request.sourceHistory,
        evaluationClock: request.query.evaluationClock }, context)]));
    const groupedRows = new Map<string, EvidenceCompleteMeasurementReadRow[]>();
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
      const dependency = quantityDependencies.get(quantity);
      const resolution = dependency?.resolution ?? null;
      const resolutions = dependency?.resolutions ?? [];
      const supportingWitness = quantity.state === 'resolved'
        ? quantity.witnesses.find(witness => witness.state === 'reported'
          && Object.is(witness.measurement.value, quantity.amount)) ?? null
        : null;
      const reportedWitness = quantity.witnesses.find(witness => witness.state === 'reported') ?? null;
      const representative = ordered.find(row =>
        row.evidence.id === (supportingWitness ?? reportedWitness)?.evidence.id) ?? ordered[0]!;
      const evidenceManifest = [...new Map([
        ...quantity.witnesses.map(witness => witness.evidence),
        ...resolutions.map(candidate => candidate.evidence),
      ].map(evidence => [evidence.id, evidence] as const)).values()]
        .sort((a, b) => a.id.localeCompare(b.id));
      if (quantity.state === 'unresolved')
        return freeze({ ...representative, amount: null, state: 'conflicted' as const,
          evidenceManifest });
      if (quantity.state === 'unavailable')
        return freeze({ ...representative, amount: null, evidenceManifest });
      // A resolved amount is presented through a reported witness that actually carries
      // that amount. When an owner resolution selects an amount not carried by a witness,
      // that resolution becomes the primary evidence. Witness-name ordering never chooses
      // a missing/failed state for a resolved amount.
      return freeze({ ...representative, amount: quantity.amount,
        evidence: supportingWitness ? representative.evidence
          : resolution?.evidence ?? representative.evidence,
        evidenceManifest });
    });
    const ownerPartial = (currentSelection.view?.taint.length ?? 0) > 0
      || (currentSelection.view?.conflicts.length ?? 0) > 0
      || request.sourceHistory.entries.some(status =>
        status.taint.length > 0 || status.conflicts.length > 0);
    const quantityPartial = [...quantities.values()].some(quantity => quantity.state === 'unresolved');
    return boundedRead(request, rows, ownerPartial || quantityPartial || quarantined > 0, context,
      quantityPartial ? 'quantity witnesses disagree without a current owner resolution'
        : quarantined > 0 ? 'source sample lacks comparable, fresh owner membership evidence'
          : 'source history contains conflict or taint');
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
    const ownerUnresolvedByPeer = new Map<string, readonly string[]>();
    const digests = new Set<string>();
    const frontiers: Record<string, string> = {};
    for (const peer of peers) {
      exactObject(peer, ['peer', 'state', 'sourceHistory', 'sourceHistoryDigest', 'frontier',
        'frontierDigest', 'observedAt', 'lastFrontier', 'quantities']);
      substantive(peer.peer, 'peer identity');
      ensure(peer.lastFrontier === null || typeof peer.lastFrontier === 'string'
        && peer.lastFrontier.length > 0, 'peer last frontier is malformed');
      ensure(Array.isArray(peer.quantities) && peer.quantities.length <= 100_000,
        'peer quantities must be a bounded array');
      if (peer.state === 'missing') {
        ensure(peer.sourceHistory === null && peer.sourceHistoryDigest === null
          && peer.frontier === null && peer.frontierDigest === null && peer.observedAt === null
          && peer.quantities.length === 0, 'missing peer carries admitted current data');
        missing.push({ peer: peer.peer, lastFrontier: peer.lastFrontier, reason: 'missing' });
        continue;
      }
      try {
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
        const ownerBound = peer.sourceHistory.entries.some((status: FactStatus) =>
          status.fact.machine === peer.peer);
        if (!ownerBound) {
          missing.push({ peer: peer.peer, lastFrontier: actualDigest,
            reason: 'unwitnessed-frontier' });
          continue;
        }
        for (const quantity of peer.quantities) {
          const dependency = quantityCurrent(quantity, context, evaluation);
          ensure(dependency.sourceHistory === peer.sourceHistory,
            'peer quantity belongs to another owner history');
        }
        const sourceHistory = peer.sourceHistory;
        const suppliedWitnesses: readonly QuantityWitness[] = peer.quantities
          .flatMap((quantity: ResolvedQuantity) => quantity.witnesses);
        const contracts: readonly MeasurementProducerContract[] = [...new Map<
          string, MeasurementProducerContract>([
            ...snapshotProducerContracts(sourceHistory, context).map(contract =>
              [contract.id, contract] as const),
            ...suppliedWitnesses.map((witness: QuantityWitness) => {
            const dependency = witnessCurrent(witness, context);
            return [dependency.contract.id, dependency.contract] as const;
          }),
          ]).values()];
        const currentWitnesses = selectCurrentWitnesses(sourceHistory, contracts,
          evaluation, suppliedWitnesses, context, () => true);
        const grouped = new Map<string, QuantityWitness[]>();
        for (const witness of currentWitnesses) {
          const bucket = grouped.get(witness.key) ?? [];
          bucket.push(witness);
          grouped.set(witness.key, bucket);
        }
        const selected = [...grouped.values()].map(witnesses =>
          resolveQuantityFromCurrentHistory({ witnesses, sourceHistory,
            evaluationClock: evaluation }, context));
        ensure(peer.quantities.every((quantity: ResolvedQuantity) => grouped.has(quantity.key)),
          'peer caller quantity is outside the complete current owner selection');
        const observationSelection = currentOwnerSelection(sourceHistory,
          'measurement-observation', context);
        const ownerUnresolved = observationSelection.view === null ? [] : [
          ...observationSelection.view.conflicts.flatMap(conflict => {
            const evidenceIds = conflict.facts.flatMap(factId => {
              const status = sourceHistory.entries.find((row: FactStatus) => row.fact.id === factId);
              const evidence = (status?.body as { readonly evidence?: { readonly id?: unknown } }
                | null)?.evidence;
              return typeof evidence?.id === 'string' ? [evidence.id] : [];
            });
            return evidenceIds.length > 0 ? evidenceIds
              : [`owner-conflict:${peer.peer}:${conflict.key}`];
          }),
          ...observationSelection.view.taint.map(taint => `owner-taint:${peer.peer}:${taint}`),
        ];
        admitted.push(peer);
        selectedByPeer.set(peer.peer, selected);
        ownerUnresolvedByPeer.set(peer.peer, [...new Set(ownerUnresolved)].sort());
        digests.add(peer.sourceHistoryDigest);
        frontiers[peer.peer] = actualDigest;
      } catch {
        missing.push({ peer: peer.peer, lastFrontier: peer.lastFrontier,
          reason: 'unwitnessed-frontier' });
      }
    }
    for (const peer of required)
      if (!peers.some(row => row.peer === peer))
        missing.push({ peer, lastFrontier: null, reason: 'missing' });
    const members = new Set<string>();
    const unresolved = new Set<string>(admitted.flatMap(peer =>
      ownerUnresolvedByPeer.get(peer.peer) ?? []));
    const grouped = new Map<string, ResolvedQuantity[]>();
    for (const peer of admitted) for (const quantity of selectedByPeer.get(peer.peer) ?? []) {
      const bucket = grouped.get(quantity.key) ?? [];
      bucket.push(quantity); grouped.set(quantity.key, bucket);
    }
    for (const quantities of grouped.values()) {
      // Union current signed witness heads before deriving an amount. A quantity
      // resolved in a later replica can therefore cover a genuine prefix replica;
      // comparing the replicas' already-derived 83/86 totals would discard that
      // owner resolution and manufacture uncertainty.
      const witnesses = canonicalWitnesses(quantities.flatMap(quantity => quantity.witnesses));
      const reported = witnesses.filter(witness => witness.state === 'reported');
      const witnessIds = reported.map(witness => witness.sourceEvent).sort();
      const witnessAmounts = new Set(reported.map(witness => witness.measurement.value));
      const coveringResolutions = quantities.flatMap(quantity => {
        const resolution = quantityDependencies.get(quantity)?.resolution ?? null;
        return resolution !== null
          && encoding([...resolution.witnesses].sort()).bytes === encoding(witnessIds).bytes
          ? [resolution] : [];
      });
      const resolutionAmounts = new Set(coveringResolutions.map(resolution => resolution.amount));
      const resolved = reported.length === witnesses.length && reported.length > 0
        && (witnessAmounts.size === 1 || resolutionAmounts.size === 1);
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
