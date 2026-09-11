import { compareMeasurements, decode, decodeMeasurement, readEvidence } from '../index.js';
import type { BoundaryContext, Clock, Evidence, Json, Result } from '../index.js';
import { deriveGrowthEpisodes } from '../assembly/index.js';
import type { GrowthObservation, GrowthPolicy } from '../assembly/index.js';
import { foldProjection } from '../projections/index.js';
import type { ProjectionDefinition, ProjectionGeneration } from '../projections/index.js';
import type { JudgmentRecord } from '../judgment/index.js';
import { boundary, encoding, ensure, freeze, json, take } from './boundary.js';
import type { AggregateMeasurementsRequest, AttributionRequest, AttributionResult, BurnEpisodeState, BurnEvaluation,
  BurnPolicy, BurnSample, BurnWindow, ClassifiedFootprint, ClassifiedLegacyResourceObservation, GrowthInvestigationLink,
  LegacyResourceObservation, MeasurementAggregate,
  FeatureOutcomeClassificationRequest, MeasurementProducerContract, MeasurementReadQuery, MeasurementReadResult, MeasurementReadRow, ProcessClassRule,
  ProcessDescriptor, QuantityOwnerResolution, QuantityWitness, QuantityWitnessInput, RateLimitEventObservation,
  RateLimitEventSummary, ResolvedQuantity, ResourcePoint, ResourceTrend, PeerMeasurementInput, PeerMeasurementPool,
  MeasurementReadSourceRequest, MeasurementReadSourceBinding, CurrentMeasurementReadRequest } from './contracts.js';
import type { MeasurementDecodeContext } from './decode.js';
import { isDecodedAggregateMeasurementsPolicy, isDecodedBurnPolicy, isDecodedMeasurementProducerContract,
  isCurrentAggregateMeasurementsPolicy, isCurrentBurnPolicy, isCurrentMeasurementProducerContract, isCurrentMeasurementTuple,
  isDecodedMeasurementReadQuery } from './decode.js';

const rowFields = ['identity', 'family', 'category', 'at', 'amount', 'unit', 'state', 'producer', 'sourceSample', 'feature', 'model', 'machine', 'evidence'];
const finiteNonnegative = (value: unknown, field: string): number => {
  ensure(typeof value === 'number' && Number.isFinite(value) && value >= 0, `${field} must be finite and nonnegative`);
  return value;
};
const substantive = (value: string, field: string): void => ensure(typeof value === 'string' && value.trim().length > 0
  && value.length <= 4096, `${field} must be bounded substantive text`);
const issuedWitnesses = new WeakSet<object>();
const issuedQuantities = new WeakSet<object>();
const witnessContracts = new WeakMap<object, MeasurementProducerContract>();
const issuedBurnWindows = new Map<string, string>();
const families = ['model-call', 'cumulative-model-session', 'quota', 'rate-limit-event', 'resource', 'package-cost'] as const;
const quantityStates = ['reported', 'not-reported', 'unsupported', 'missing', 'failed', 'legacy-origin-lost', 'unattributed', 'conflicted'] as const;

function exactObject<T>(input: T, fields: readonly string[], optional: readonly string[] = []): asserts input is T & Record<string, unknown> {
  ensure(input !== null && typeof input === 'object' && !Array.isArray(input), 'closed object required');
  const keys = Object.keys(input);
  ensure(keys.every(key => fields.includes(key)) && fields.filter(field => !optional.includes(field)).every(field => Object.hasOwn(input, field)),
    'undeclared or missing field');
}

function exactTextArray(input: unknown, field: string, maximum = 1024): readonly string[] {
  ensure(Array.isArray(input) && input.length <= maximum && input.every(value => typeof value === 'string' && value.trim().length > 0),
    `${field} must be a bounded substantive text array`);
  ensure(new Set(input).size === input.length, `${field} contains duplicates`);
  return input;
}

function admittedClock(input: Clock, context: MeasurementDecodeContext, field: string): Clock {
  const decoded = take(decodeMeasurement('clock', input, context.types));
  ensure(encoding(decoded).bytes === encoding(input).bytes, `${field} must be an admitted clock`);
  return decoded;
}

function validateCurrentSourceHistory(sourceHistory: AttributionRequest['sourceHistory'], context: MeasurementDecodeContext): void {
  const kinds = [...new Set(sourceHistory.entries.map(row => row.fact.kind))].sort();
  const lineages = Object.fromEntries([...new Set(sourceHistory.entries.map(row => row.fact.machine))]
    .sort().map(machine => {
      const facts = sourceHistory.entries.filter(row => row.fact.machine === machine).map(row => row.fact);
      const head = facts.map(row => row.segment).sort((a, b) => a.epoch - b.epoch || a.position - b.position).at(-1)!;
      return [machine, { head, observedAt: null, closed: false }];
    }));
  const generation: ProjectionGeneration = { reference: context.register.generation, kinds, lineages };
  const definition: ProjectionDefinition = { id: 'measurement.source-current-validation', class: 'informational',
    stalenessBound: 1, retention: 'all-identities', decisions: Object.fromEntries(kinds.map(kind =>
      [kind, { kind: 'ignores', reason: 'current-snapshot validation only' }])) };
  take(foldProjection(definition, sourceHistory, generation, context));
}

export function createQuantityWitness(input: QuantityWitnessInput, context: MeasurementDecodeContext): Result<QuantityWitness> {
  return boundary('QuantityWitnessRead', input, context, () => {
    exactObject(input, ['contract', 'subjectInstance', 'sourceSample', 'category', 'measurement', 'evidence', 'sourceEvent', 'phase', 'predecessors', 'state', 'hardwareProfile']);
    const contract = input.contract;
    ensure(isDecodedMeasurementProducerContract(contract) && isCurrentMeasurementProducerContract(contract, context),
      'producer contract must come from its decoder and remain currently registered');
    substantive(input.subjectInstance, 'subjectInstance'); substantive(input.sourceEvent, 'sourceEvent');
    if (contract.sourceSampleRequired) substantive(input.sourceSample, 'sourceSample');
    if (contract.family === 'model-call' || contract.family === 'rate-limit-event')
      ensure(input.sourceSample === input.subjectInstance, 'source sample is not bound to the canonical event identity');
    if (contract.hardwareProfileRequired) {
      ensure(typeof input.hardwareProfile === 'string' && input.hardwareProfile.trim().length > 0, 'named hardware profile required');
      ensure(context.register.entries.includes(input.hardwareProfile), 'hardware profile is not registered');
    } else ensure(input.hardwareProfile === null, 'hardware profile is not admitted for this producer contract');
    const category = contract.categories.find(row => row.name === input.category);
    ensure(category, 'category is not registered for producer');
    ensure(['reported', 'not-reported', 'unsupported', 'missing', 'failed', 'legacy-origin-lost'].includes(input.state), 'quantity state outside closed set');
    const measurement = take(decodeMeasurement(contract.subjectKind, input.measurement, context.types));
    const evidence = take(decode('Evidence', input.evidence, context.types));
    ensure(measurement.subject.instance === input.subjectInstance, 'measurement subject instance mismatch');
    ensure(measurement.unit === category.unit && measurement.by === contract.producer, 'measurement unit or producer mismatch');
    ensure(evidence.id === input.sourceEvent, 'evidence and source-event identity mismatch');
    ensure(evidence.source === contract.producer, 'evidence producer differs from the registered measurement producer');
    const claim = take(readEvidence(evidence, measurement.at as Clock, context.preserved));
    ensure(claim.subject === input.subjectInstance && claim.predicate === contract.evidencePredicate, 'evidence binding mismatch');
    if (input.state === 'reported') finiteNonnegative(measurement.value, 'measurement value');
    ensure(input.state === 'reported' || measurement.value === 0, 'unavailable quantity cannot carry an amount');
    ensure(['partial', 'final', 'correction'].includes(input.phase), 'quantity witness phase outside closed set');
    ensure(new Set(input.predecessors).size === input.predecessors.length, 'duplicate witness predecessor');
    ensure(input.predecessors.length === 0, 'witness predecessors require signed causal history');
    if (input.state === 'reported') {
      if (typeof claim.value === 'number') {
        ensure(contract.categories.filter(entry => entry.unit === category.unit).length === 1,
          'numeric evidence does not identify one registered category');
        ensure(input.sourceSample === input.subjectInstance || input.sourceSample === `sample:${(measurement.at as Clock).value}`,
          'numeric evidence does not bind the resource source sample');
        ensure(Object.is(claim.value, measurement.value), 'measurement amount differs from evidence claim');
      } else {
        exactObject(claim.value, ['amount', 'category', 'sourceSample', 'producer']);
        ensure(Object.is(claim.value.amount, measurement.value) && claim.value.category === category.name
          && claim.value.sourceSample === input.sourceSample && claim.value.producer === contract.producer,
        'measurement evidence claim does not bind amount, category, source sample, and producer');
      }
    }
    const key = encoding({ family: contract.family, subject: input.subjectInstance, sourceSample: input.sourceSample,
      category: category.name, unit: category.unit, relation: category.relation, hardwareProfile: input.hardwareProfile }).hash;
    const witness = freeze({ key, sourceSample: input.sourceSample, category: category.name, relation: category.relation,
      measurement, evidence, producer: contract.producer, sourceEvent: input.sourceEvent, phase: input.phase,
      predecessors: [...input.predecessors].sort(), state: input.state, hardwareProfile: input.hardwareProfile });
    issuedWitnesses.add(witness);
    witnessContracts.set(witness, contract);
    return witness;
  });
}

function heads(witnesses: readonly QuantityWitness[]): readonly QuantityWitness[] {
  const byId = new Map(witnesses.map(row => [row.sourceEvent, row]));
  const follows = (candidate: QuantityWitness, target: string, seen = new Set<string>()): boolean => {
    if (candidate.predecessors.includes(target)) return true;
    for (const predecessor of candidate.predecessors) {
      if (seen.has(predecessor)) continue;
      seen.add(predecessor);
      const row = byId.get(predecessor);
      if (row && follows(row, target, seen)) return true;
    }
    return false;
  };
  return witnesses.filter(row => !witnesses.some(other => other.sourceEvent !== row.sourceEvent && follows(other, row.sourceEvent)));
}

export function resolveQuantity(witnesses: readonly QuantityWitness[], resolution: QuantityOwnerResolution | undefined,
  context: MeasurementDecodeContext): Result<ResolvedQuantity> {
  return boundary('QuantityResolution', resolution ? { witnesses, resolution } : { witnesses }, context, () => {
    ensure(witnesses.length > 0 && witnesses.length <= 1024, 'quantity needs a bounded witness set');
    ensure(witnesses.every(row => issuedWitnesses.has(row)), 'quantity witness must come from its constructor');
    ensure(witnesses.every(row => {
      const contract = witnessContracts.get(row);
      return contract !== undefined && isCurrentMeasurementProducerContract(contract, context);
    }), 'quantity witness producer contract is no longer current');
    const canonical = [...new Map(witnesses.map(row => [row.sourceEvent, row])).values()]
      .sort((a, b) => a.sourceEvent.localeCompare(b.sourceEvent));
    ensure(canonical.length === witnesses.length, 'duplicate observation key');
    const key = canonical[0]!.key;
    ensure(canonical.every(row => row.key === key), 'quantity witnesses use different quantity keys');
    const current = [...heads(canonical)].sort((a, b) => a.sourceEvent.localeCompare(b.sourceEvent));
    const reported = current.filter(row => row.state === 'reported');
    let admittedResolution: QuantityOwnerResolution | undefined;
    if (resolution !== undefined) {
      exactObject(resolution, ['owner', 'key', 'witnesses', 'amount', 'evidence']);
      ensure((context.types.evidence ?? []).includes(resolution.evidence),
        'quantity resolution evidence needs an owner-admitted signed-history reference');
      substantive(resolution.owner, 'quantity resolution owner');
      ensure(resolution.key === key, 'quantity resolution names another quantity');
      const witnessIds = exactTextArray(resolution.witnesses, 'quantity resolution witnesses');
      ensure(encoding([...witnessIds].sort()).bytes === encoding(reported.map(row => row.sourceEvent).sort()).bytes,
        'quantity resolution does not name every current reported witness');
      const contract = witnessContracts.get(reported[0] ?? current[0]!);
      ensure(contract && resolution.owner === contract.producer && context.types.register.producers.includes(resolution.owner),
        'quantity resolution owner differs from the current registered producer');
      finiteNonnegative(resolution.amount, 'quantity resolution amount');
      const evidence = take(decode('Evidence', resolution.evidence, context.types));
      ensure(evidence.source === resolution.owner, 'quantity resolution evidence has a foreign producer');
      const claim = take(readEvidence(evidence, evidence.observedAt, context.preserved));
      exactObject(claim.value, ['amount', 'witnesses']);
      const claimWitnessIds = exactTextArray(claim.value.witnesses, 'quantity resolution evidence witnesses');
      ensure(claim.subject === key && claim.predicate === 'quantity-resolved'
        && Object.is(claim.value.amount, resolution.amount)
        && encoding([...claimWitnessIds].sort()).bytes === encoding([...witnessIds].sort()).bytes,
      'quantity resolution evidence does not bind its key, amount, and witnesses');
      admittedResolution = freeze({ ...resolution, witnesses: [...witnessIds].sort(), evidence });
    }
    if (!reported.length) {
      const result = freeze({ key, amount: null, state: 'unavailable' as const, witnesses: canonical,
        reason: current.map(row => row.state).sort().join(',') || 'missing' });
      issuedQuantities.add(result); return result;
    }
    const amounts = [...new Set(reported.map(row => row.measurement.value))];
    if (amounts.length === 1) {
      const result = freeze({ key, amount: amounts[0]!, state: 'resolved' as const, witnesses: canonical, reason: 'compatible witnesses' });
      issuedQuantities.add(result); return result;
    }
    if (admittedResolution) {
      const result = freeze({ key, amount: admittedResolution.amount, state: 'resolved' as const, witnesses: canonical,
        reason: `resolved by ${admittedResolution.owner} evidence ${admittedResolution.evidence.id}` });
      issuedQuantities.add(result); return result;
    }
    const result = freeze({ key, amount: null, state: 'unresolved' as const, witnesses: canonical, reason: 'witness amounts disagree' });
    issuedQuantities.add(result); return result;
  });
}

function clockOrder(left: Clock, right: Clock, context: BoundaryContext): number {
  return take(compareMeasurements(left, right, context.preserved));
}

export function aggregateMeasurements(request: AggregateMeasurementsRequest, context: MeasurementDecodeContext): Result<MeasurementAggregate> {
  return boundary('AggregateMeasurements', request, context, () => {
    exactObject(request, ['policy', 'quantities', 'unit', 'category', 'dimensions', 'producer', 'scope', 'start', 'end', 'evaluationClock', 'frontier']);
    const policy = request.policy;
    ensure(isDecodedAggregateMeasurementsPolicy(policy) && isCurrentAggregateMeasurementsPolicy(policy, context),
      'aggregate policy must come from its decoder and remain currently registered');
    substantive(request.frontier, 'aggregate frontier');
    ensure(policy.additiveUnits.includes(request.unit) && policy.categories.includes(request.category), 'unit or category is not additive');
    ensure(request.dimensions.length > 0 && new Set(request.dimensions).size === request.dimensions.length
      && request.dimensions.every(dimension => policy.dimensions.includes(dimension)), 'aggregate dimensions are not registered');
    ensure(policy.producer === request.producer && policy.scope === request.scope, 'producer or scope differs from registered aggregate');
    admittedClock(request.start, context, 'aggregate start'); admittedClock(request.end, context, 'aggregate end');
    admittedClock(request.evaluationClock, context, 'aggregate evaluation clock');
    ensure(clockOrder(request.start, request.end, context) < 0 && clockOrder(request.end, request.evaluationClock, context) <= 0, 'aggregate clocks are incomparable or inverted');
    ensure(request.quantities.every(row => issuedQuantities.has(row)), 'aggregate quantity must come from quantity resolution');
    ensure(new Set(request.quantities.map(row => row.key)).size === request.quantities.length, 'aggregate repeats a quantity');
    const contracts = new Set<string>(); const relations = new Set<string>(); const hardware = new Set<string | null>();
    for (const row of request.quantities) {
      ensure(row.witnesses.length > 0, 'aggregate quantity has no witnesses');
      ensure(row.witnesses.every(witness => witness.measurement.unit === request.unit && witness.producer === request.producer
        && witness.category === request.category && witness.measurement.subject.kind === policy.sourceKind), 'aggregate member basis differs');
      for (const witness of row.witnesses) {
        const contract = witnessContracts.get(witness);
        ensure(contract && isCurrentMeasurementProducerContract(contract, context), 'aggregate witness producer contract is no longer registered');
        contracts.add(contract.id); relations.add(witness.relation); hardware.add(witness.hardwareProfile);
      }
      ensure(row.witnesses.every(witness => clockOrder(request.start, witness.measurement.at as Clock, context) <= 0
        && clockOrder(witness.measurement.at as Clock, request.end, context) < 0), 'aggregate member outside half-open window');
    }
    ensure(contracts.size <= 1 && relations.size <= 1 && hardware.size <= 1,
      'aggregate member category relation, hardware, or producer-contract basis differs');
    const members = [...new Set(request.quantities.filter(row => row.state === 'resolved')
      .flatMap(row => row.witnesses.map(witness => witness.sourceEvent)))].sort();
    const amount = request.quantities.reduce((sum, row) => row.state === 'resolved' ? sum + finiteNonnegative(row.amount, 'resolved amount') : sum, 0);
    ensure(Number.isFinite(amount) && amount >= 0, 'aggregate amount overflow');
    if (request.unit === 'tokens' || request.unit === 'bytes') ensure(Number.isSafeInteger(amount), 'aggregate discrete amount overflow');
    const dimensions = request.dimensions.slice().sort();
    const identityInput = { policy: policy.id, scope: request.scope, start: request.start, end: request.end,
      category: request.category, unit: request.unit, dimensions, frontier: request.frontier, evaluationClock: request.evaluationClock };
    const identity = encoding(identityInput).hash;
    const measurement = take(decodeMeasurement('measurement-window-aggregate', { type: 'Measurement', schemaVersion: 1,
      subject: { kind: 'measurement-window-aggregate', instance: identity }, value: amount, unit: request.unit,
      at: request.end, by: request.producer }, context.types));
    return freeze({ identity, measurement, amount, unit: request.unit,
      category: request.category, dimensions, members, unresolved: request.quantities.filter(row => row.state !== 'resolved')
        .flatMap(row => row.witnesses.map(witness => witness.sourceEvent)).sort(),
      start: request.start, end: request.end, evaluationClock: request.evaluationClock, frontier: request.frontier });
  });
}

export function resolveAttribution(request: AttributionRequest, context: MeasurementDecodeContext): Result<AttributionResult> {
  return boundary('MeasurementAttribution', request, context, () => {
    exactObject(request, ['attempt', 'claimed', 'evaluationClock', 'sourceHistory', 'candidates']);
    substantive(request.attempt, 'attribution attempt');
    exactObject(request.claimed, ['feature', 'model', 'machine']);
    substantive(request.claimed.feature, 'claimed feature'); substantive(request.claimed.model, 'claimed model');
    substantive(request.claimed.machine, 'claimed machine');
    const evaluationClock = admittedClock(request.evaluationClock, context, 'attribution evaluation clock');
    ensure(Array.isArray(request.candidates) && request.candidates.length <= 1024, 'attribution candidates must be bounded');
    for (const candidate of request.candidates) {
      exactObject(candidate, ['attempt', 'factReferences']);
      ensure(candidate.attempt === request.attempt, 'attribution candidate names another attempt');
      exactTextArray(candidate.factReferences, 'attribution fact references');
    }
    validateCurrentSourceHistory(request.sourceHistory, context);
    const contested = request.sourceHistory.entries.filter(status => {
      const record = (status.body as { readonly record?: JudgmentRecord }).record;
      if (!record || !status.conflicts.length) return false;
      if (record.type === 'JudgmentRequest') return `attempt:${record.id}:1` === request.attempt;
      if (record.type === 'JudgmentAttemptRecord' || record.type === 'JudgmentResolution') return record.attempt === request.attempt;
      return false;
    });
    if (contested.length) return freeze({ attempt: request.attempt, state: 'conflicted' as const, feature: null, model: null,
      machine: null, run: null, facts: [...new Set(contested.flatMap(status => status.conflicts.flatMap(conflict => conflict.facts)))].sort() });
    const found: { feature: string; model: string; run: string; machine: string; facts: string[] }[] = [];
    const clean = request.sourceHistory.entries.filter(row => !row.taint.length && !row.conflicts.length
      && clockOrder(row.fact.at, evaluationClock, context) <= 0);
    const records = clean.flatMap(status => {
      const record = (status.body as { readonly record?: JudgmentRecord }).record;
      if (!record || !['JudgmentRequest', 'JudgmentAttemptRecord', 'JudgmentResolution'].includes(record.type)
        || status.fact.kind !== `judgment-${record.type}`) return [];
      return [{ status, record }];
    });
    for (const attempt of records) {
      if (attempt.record.type !== 'JudgmentAttemptRecord' || attempt.record.attempt !== request.attempt) continue;
      const requestId = attempt.record.request;
      const ownerRequest = records.find(row => row.record.type === 'JudgmentRequest' && row.record.id === requestId);
      if (!ownerRequest || ownerRequest.record.type !== 'JudgmentRequest') continue;
      const resolution = records.find(row => row.record.type === 'JudgmentResolution' && row.record.request === requestId);
      if (!resolution || resolution.record.type !== 'JudgmentResolution' || resolution.record.attempt !== request.attempt) continue;
      const decisionInput = resolution && (resolution.status.body as { readonly decision?: unknown }).decision;
      const decision = decisionInput ? take(decode('Decision', decisionInput, context.types)) : null;
      const model = decision && 'model' in decision.by ? decision.by.model : null;
      if (typeof model !== 'string' || !model.length) continue;
      found.push({ feature: ownerRequest.record.point, model, run: ownerRequest.record.run,
        machine: attempt.status.fact.machine, facts: [ownerRequest.status.fact.id, attempt.status.fact.id, resolution.status.fact.id].sort() });
    }
    const grouped = new Map<string, typeof found[number]>();
    for (const row of found) {
      const key = encoding({ feature: row.feature, model: row.model, run: row.run, machine: row.machine }).bytes;
      const prior = grouped.get(key);
      grouped.set(key, prior ? { ...row, facts: [...new Set([...prior.facts, ...row.facts])].sort() } : row);
    }
    const unique = [...grouped.values()];
    if (!unique.length) return freeze({ attempt: request.attempt, state: 'unattributed' as const, feature: null, model: null,
      machine: null, run: null, facts: [] });
    if (unique.length > 1) return freeze({ attempt: request.attempt, state: 'conflicted' as const, feature: null, model: null,
      machine: null, run: null, facts: [...new Set(unique.flatMap(row => row.facts))].sort() });
    const value = unique[0]!;
    return freeze({ attempt: request.attempt, state: 'attributed' as const, feature: value.feature, model: value.model,
      machine: value.machine, run: value.run, facts: value.facts });
  });
}

export function renderMeasurementClaim(input: Readonly<{ kind: 'recorded-execution' | 'target' | 'estimate' | 'configured-threshold';
  hardware: string | null; workload: string | null; evidence: readonly string[] }>, context: MeasurementDecodeContext): Result<string> {
  return boundary('MeasurementClaimRender', input, context, () => {
    exactObject(input, ['kind', 'hardware', 'workload', 'evidence']);
    ensure(['recorded-execution', 'target', 'estimate', 'configured-threshold'].includes(input.kind),
      'measurement claim kind outside closed set');
    ensure(input.hardware === null || typeof input.hardware === 'string', 'measurement claim hardware must be text or absent');
    ensure(input.workload === null || typeof input.workload === 'string', 'measurement claim workload must be text or absent');
    if (input.hardware !== null) substantive(input.hardware, 'measurement claim hardware');
    if (input.workload !== null) substantive(input.workload, 'measurement claim workload');
    exactTextArray(input.evidence, 'measurement claim evidence');
    if (input.kind !== 'recorded-execution') return `${input.kind}: not measured`;
    ensure(input.hardware?.trim() && input.workload?.trim() && input.evidence.length > 0, 'measured requires named hardware, workload, and execution evidence');
    const expected = { hardware: input.hardware, workload: input.workload };
    ensure(input.evidence.every(id => (context.types.evidence ?? []).some(evidence => {
      if (evidence.id !== id) return false;
      const claim = take(readEvidence(evidence, evidence.observedAt, context.preserved));
      return claim.predicate === 'execution-observed' && encoding(claim.value).bytes === encoding(expected).bytes;
    })), 'measured execution evidence is not admitted or does not bind the claim');
    return `measured execution on ${input.hardware} for ${input.workload}`;
  });
}

export function coalesceUnknownQuotaEpisodes(keys: readonly string[], alreadyOpen: readonly string[], context: BoundaryContext): Result<Readonly<{ notices: readonly string[]; open: readonly string[] }>> {
  return boundary('QuotaUnknownEpisodeCoalescing', keys, context, () => {
    keys.forEach(key => substantive(key, 'quota episode key'));
    const open = [...new Set([...alreadyOpen, ...keys])].sort();
    const prior = new Set(alreadyOpen);
    return freeze({ notices: [...new Set(keys)].filter(key => !prior.has(key)).sort(), open });
  });
}

const resourcePointFields = ['id', 'machine', 'processIncarnation', 'sourceSample', 'at', 'hardwareProfile',
  'classifierGeneration', 'cadenceMs', 'state', 'cpuTimeMs', 'monotonicIntervalMs', 'rssBytes', 'heapBytes', 'heapState'];
const processDescriptorFields = ['processIncarnation', 'pid', 'startEvidence', 'tags'];

function validateResourcePoint(point: ResourcePoint, context: MeasurementDecodeContext): ResourcePoint {
  exactObject(point, resourcePointFields);
  for (const [value, field] of [[point.id, 'resource id'], [point.machine, 'resource machine'],
    [point.processIncarnation, 'process incarnation'], [point.sourceSample, 'resource source sample'],
    [point.hardwareProfile, 'hardware profile'], [point.classifierGeneration, 'classifier generation']] as const)
    substantive(value, field);
  ensure(context.register.entries.includes(point.machine), 'resource machine is not registered');
  ensure(context.register.entries.includes(point.hardwareProfile), 'resource hardware profile is not registered');
  ensure(context.register.entries.includes(point.classifierGeneration), 'resource classifier generation is not registered');
  ensure(Number.isSafeInteger(point.cadenceMs) && point.cadenceMs > 0, 'resource cadence must be a positive safe integer');
  const at = admittedClock(point.at, context, 'resource sample clock');
  ensure(['observed', 'missing', 'failed'].includes(point.state), 'resource state outside closed set');
  ensure(['reported', 'unsupported', 'missing'].includes(point.heapState), 'heap state outside closed set');
  ensure((point.cpuTimeMs === null) === (point.monotonicIntervalMs === null), 'CPU time and interval presence differ');
  if (point.cpuTimeMs !== null) finiteNonnegative(point.cpuTimeMs, 'cpu time');
  if (point.monotonicIntervalMs !== null)
    ensure(Number.isFinite(point.monotonicIntervalMs) && point.monotonicIntervalMs > 0, 'monotonic interval must be positive');
  if (point.rssBytes !== null)
    ensure(Number.isSafeInteger(point.rssBytes) && point.rssBytes >= 0, 'RSS bytes must be a nonnegative safe integer');
  if (point.heapBytes !== null)
    ensure(Number.isSafeInteger(point.heapBytes) && point.heapBytes >= 0, 'heap bytes must be a nonnegative safe integer');
  ensure((point.heapState === 'reported') === (point.heapBytes !== null), 'heap state and amount disagree');
  if (point.state !== 'observed')
    ensure(point.cpuTimeMs === null && point.monotonicIntervalMs === null && point.rssBytes === null
      && point.heapBytes === null && point.heapState === 'missing', 'missing resource observation carries usable amounts');
  return freeze({ id: point.id, machine: point.machine, processIncarnation: point.processIncarnation,
    sourceSample: point.sourceSample, at, hardwareProfile: point.hardwareProfile,
    classifierGeneration: point.classifierGeneration, cadenceMs: point.cadenceMs, state: point.state, cpuTimeMs: point.cpuTimeMs,
    monotonicIntervalMs: point.monotonicIntervalMs, rssBytes: point.rssBytes, heapBytes: point.heapBytes,
    heapState: point.heapState });
}

function validateProcessDescriptor(descriptor: ProcessDescriptor): void {
  exactObject(descriptor, processDescriptorFields);
  substantive(descriptor.processIncarnation, 'process incarnation');
  ensure(Number.isSafeInteger(descriptor.pid) && descriptor.pid > 0, 'PID must be positive');
  substantive(descriptor.startEvidence, 'process start evidence');
  exactTextArray(descriptor.tags, 'process tags', 256);
}

export function cpuUtilization(point: ResourcePoint, wholeMachineCores: number, basis: 'one-core' | 'whole-machine', context: MeasurementDecodeContext): Result<number | null> {
  return boundary('CpuUtilization', point, context, () => {
    ensure(Number.isSafeInteger(wholeMachineCores) && wholeMachineCores > 0, 'named machine core count required');
    ensure(basis === 'one-core' || basis === 'whole-machine', 'CPU basis outside closed set');
    const admitted = validateResourcePoint(point, context);
    if (admitted.state !== 'observed' || admitted.cpuTimeMs === null || admitted.monotonicIntervalMs === null) return null;
    const oneCore = admitted.cpuTimeMs / admitted.monotonicIntervalMs * 100;
    const result = basis === 'one-core' ? oneCore : oneCore / wholeMachineCores;
    ensure(Number.isFinite(result) && result >= 0, 'CPU utilization result is not finite');
    return result;
  });
}

export function reconcileProcessIncarnation(previous: ProcessDescriptor, observed: ProcessDescriptor | null, context: BoundaryContext): Result<'same' | 'new-incarnation' | 'missing'> {
  return boundary('ProcessIncarnationReconciliation', { previous, observed }, context, () => {
    validateProcessDescriptor(previous);
    if (!observed) return 'missing';
    validateProcessDescriptor(observed);
    return previous.pid === observed.pid && previous.startEvidence === observed.startEvidence
      && previous.processIncarnation === observed.processIncarnation ? 'same' : 'new-incarnation';
  });
}

export function planProcessCensus(processes: readonly ProcessDescriptor[], limit: number, context: BoundaryContext): Result<Readonly<{ batch: readonly ProcessDescriptor[]; examined: number; omitted: number; truncated: boolean }>> {
  return boundary('ProcessCensusPlan', { processes, limit }, context, () => {
    ensure(Number.isSafeInteger(limit) && limit > 0, 'process census limit must be positive');
    ensure(processes.length <= 100_000, 'process inventory exceeds hard input bound');
    processes.forEach(validateProcessDescriptor);
    const identities = processes.map(row => row.processIncarnation);
    ensure(identities.every(Boolean) && new Set(identities).size === identities.length, 'process incarnations must be unique');
    const batch = processes.slice(0, limit);
    return freeze({ batch, examined: batch.length, omitted: Math.max(0, processes.length - limit), truncated: processes.length > limit });
  });
}

export function classifyProcesses(processes: readonly ProcessDescriptor[], rules: readonly ProcessClassRule[], context: BoundaryContext): Result<ClassifiedFootprint> {
  return boundary('ProcessFootprintClassification', { processes, rules }, context, () => {
    processes.forEach(validateProcessDescriptor);
    ensure(new Set(processes.map(row => row.processIncarnation)).size === processes.length, 'process incarnation appears more than once');
    for (const rule of rules) {
      exactObject(rule, ['className', 'requiredTags']);
      substantive(rule.className, 'process class');
      ensure(context.register.entries.includes(rule.className), 'process class is not registered');
      exactTextArray(rule.requiredTags, 'required process tags', 256);
      ensure(rule.requiredTags.length > 0, 'process class requires at least one tag');
    }
    ensure(new Set(rules.map(row => row.className)).size === rules.length, 'duplicate process class');
    const counts: Record<string, number> = Object.fromEntries(rules.map(row => [row.className, 0]));
    let unclassified = 0;
    for (const descriptor of processes) {
      const matches = rules.filter(rule => rule.requiredTags.length > 0 && rule.requiredTags.every(tag => descriptor.tags.includes(tag)));
      ensure(matches.length <= 1, 'process matches several registered classes');
      if (matches[0]) counts[matches[0].className] = (counts[matches[0].className] ?? 0) + 1;
      else unclassified++;
    }
    return freeze({ counts: Object.fromEntries(Object.entries(counts).sort()), unclassified });
  });
}

export function summarizeRateLimitEvents(events: readonly RateLimitEventObservation[], start: Clock, end: Clock,
  context: MeasurementDecodeContext): Result<RateLimitEventSummary> {
  return boundary('MeasurementRateLimitEventSummary', { events, start, end }, context, () => {
    admittedClock(start, context, 'rate window start'); admittedClock(end, context, 'rate window end');
    ensure(clockOrder(start, end, context) < 0, 'rate event window is inverted');
    const byId = new Map<string, RateLimitEventObservation>();
    for (const event of events) {
      exactObject(event, ['id', 'source', 'kind', 'at']); substantive(event.id, 'rate event id');
      ensure(['breaker', 'session-sentinel'].includes(event.source), 'rate event source outside closed set');
      ensure(['circuit-open', 'circuit-recover', 'throttle', 'quota', '529'].includes(event.kind), 'rate event kind outside closed set');
      ensure(event.source === 'breaker' ? event.kind === 'circuit-open' || event.kind === 'circuit-recover'
        : event.kind === 'throttle' || event.kind === 'quota' || event.kind === '529',
      'rate event kind is inconsistent with its source population');
      admittedClock(event.at, context, 'rate event clock');
      const prior = byId.get(event.id);
      if (prior) ensure(encoding(prior).bytes === encoding(event).bytes, 'rate event identity has conflicting replay');
      else byId.set(event.id, freeze({ ...event }));
    }
    const admitted = [...byId.values()].filter(event => clockOrder(start, event.at, context) <= 0 && clockOrder(event.at, end, context) < 0)
      .sort((a, b) => clockOrder(a.at, b.at, context) || a.id.localeCompare(b.id));
    const counts: Record<string, number> = {};
    for (const event of admitted) counts[event.kind] = (counts[event.kind] ?? 0) + 1;
    const hours = (end.value - start.value) / 3_600_000;
    return freeze({ events: admitted, counts, breakerTripsPerHour: (counts['circuit-open'] ?? 0) / hours });
  });
}

export function classifyLegacyResourceObservation(input: LegacyResourceObservation,
  context: BoundaryContext): Result<ClassifiedLegacyResourceObservation> {
  return boundary('MeasurementLegacyResourceObservation', input, context, () => {
    exactObject(input, ['id', 'source', 'state', 'value', 'originalNumeric']); substantive(input.id, 'legacy observation id');
    ensure(['own-resource-read', 'pid-batch', 'footprint-census', 'origin-lost'].includes(input.source), 'legacy observation source outside closed set');
    ensure(['observed', 'read-failed'].includes(input.state) && typeof input.originalNumeric === 'boolean', 'legacy observation state is malformed');
    if (input.source === 'origin-lost') {
      ensure(input.originalNumeric === false && (input.value === null || typeof input.value === 'number' && Number.isFinite(input.value)),
        'origin-lost observation must retain only finite legacy numeric evidence or explicit absence');
      return freeze({ id: input.id, state: 'legacy-origin-lost' as const, amount: input.value,
        reason: input.value === null ? 'legacy origin and amount unavailable' : 'legacy numeric retained with origin unavailable' });
    }
    if (input.state === 'read-failed') {
      ensure(input.value === null && input.originalNumeric === false, 'failed resource observation carries usable amount');
      return freeze({ id: input.id, state: input.source === 'own-resource-read' ? 'failed' as const : 'missing' as const,
        amount: null, reason: `${input.source} did not produce an observation` });
    }
    ensure(input.originalNumeric && typeof input.value === 'number' && Number.isFinite(input.value) && input.value >= 0,
      'reported legacy observation requires its original finite nonnegative number');
    return freeze({ id: input.id, state: 'reported' as const, amount: input.value, reason: 'original numeric observation retained' });
  });
}

export function resourceTrend(points: readonly ResourcePoint[], minimumSamples: number, context: MeasurementDecodeContext): Result<ResourceTrend> {
  return boundary('ResourceTrend', { points, minimumSamples }, context, () => {
    ensure(Number.isSafeInteger(minimumSamples) && minimumSamples >= 2, 'trend minimum must be at least two');
    const reasons: string[] = [];
    const bySample = new Map<string, ResourcePoint[]>();
    for (const raw of points) {
      const point = validateResourcePoint(raw, context);
      const witnesses = bySample.get(point.sourceSample) ?? [];
      ensure(!witnesses.some(prior => prior.id === point.id), 'resource witness identity repeated');
      witnesses.push(point); bySample.set(point.sourceSample, witnesses);
    }
    const samples = [...bySample.values()].map(witnesses => {
      const material = (row: ResourcePoint) => ({ ...row, id: '' });
      if (witnesses.some(row => encoding(material(row)).bytes !== encoding(material(witnesses[0]!)).bytes))
        reasons.push('conflicting source sample');
      return witnesses.slice().sort((a, b) => a.id.localeCompare(b.id))[0]!;
    }).sort((a, b) => clockOrder(a.at, b.at, context) || a.sourceSample.localeCompare(b.sourceSample));
    const retained = [...bySample.values()].flat().sort((a, b) => clockOrder(a.at, b.at, context) || a.id.localeCompare(b.id));
    if (samples.length < minimumSamples) reasons.push('insufficient samples');
    if (samples.some(row => row.state !== 'observed' || row.rssBytes === null)) reasons.push('missing tick');
    if (new Set(samples.map(row => row.machine)).size > 1) reasons.push('machine changed');
    if (new Set(samples.map(row => row.hardwareProfile)).size > 1) reasons.push('hardware changed');
    if (new Set(samples.map(row => row.classifierGeneration)).size > 1) reasons.push('classifier changed');
    if (new Set(samples.map(row => row.processIncarnation)).size > 1) reasons.push('process incarnation changed');
    if (new Set(samples.map(row => row.cadenceMs)).size > 1) reasons.push('cadence changed');
    for (let index = 1; index < samples.length; index++) {
      const prior = samples[index - 1]!; const next = samples[index]!;
      if (clockOrder(prior.at, next.at, context) >= 0) reasons.push('sample clocks not increasing');
      else if (next.at.value - prior.at.value > prior.cadenceMs) reasons.push('missing tick');
    }
    if (reasons.length) return freeze({ state: 'incomplete' as const, points: retained, rssDeltaBytes: null, reasons: [...new Set(reasons)].sort() });
    const first = samples[0]!.rssBytes!; const last = samples.at(-1)!.rssBytes!;
    return freeze({ state: 'complete' as const, points: retained, rssDeltaBytes: last - first, reasons: [] });
  });
}

export function mergePeerMeasurements(peers: readonly PeerMeasurementInput[], context: MeasurementDecodeContext): Result<PeerMeasurementPool> {
  return boundary('PeerMeasurementPool', peers, context, () => {
    ensure(peers.length > 0 && peers.length <= 1024, 'peer measurement input must be bounded and nonempty');
    ensure(new Set(peers.map(row => row.peer)).size === peers.length, 'peer measurement identity repeated');
    const members = new Set<string>(); const unresolved = new Set<string>();
    const missingPeers: { peer: string; lastFrontier: string | null }[] = [];
    const byQuantity = new Map<string, QuantityWitness[]>();
    const admittedFrontiers = new Set<string>();
    for (const peer of peers) {
      exactObject(peer, ['peer', 'state', 'lastFrontier', 'quantities']);
      substantive(peer.peer, 'peer identity');
      ensure(peer.lastFrontier === null || typeof peer.lastFrontier === 'string' && peer.lastFrontier.length > 0, 'peer frontier invalid');
      if (peer.state === 'missing') {
        ensure(peer.quantities.length === 0, 'missing peer cannot contribute quantities');
        missingPeers.push({ peer: peer.peer, lastFrontier: peer.lastFrontier }); continue;
      }
      ensure(peer.state === 'admitted' && peer.quantities.every(row => issuedQuantities.has(row)), 'peer quantities must be admitted resolutions');
      ensure(peer.lastFrontier !== null, 'admitted peer requires a source frontier');
      admittedFrontiers.add(peer.lastFrontier);
      for (const quantity of peer.quantities) {
        const bucket = byQuantity.get(quantity.key) ?? [];
        bucket.push(...quantity.witnesses); byQuantity.set(quantity.key, bucket);
      }
    }
    ensure(admittedFrontiers.size <= 1, 'admitted peers do not share one source frontier');
    for (const witnesses of byQuantity.values()) {
      const byEvent = new Map<string, QuantityWitness>(); let conflict = false;
      for (const witness of witnesses) {
        const prior = byEvent.get(witness.sourceEvent);
        if (prior && encoding(prior).bytes !== encoding(witness).bytes) conflict = true;
        else if (!prior) byEvent.set(witness.sourceEvent, witness);
      }
      const canonical = [...byEvent.values()];
      if (conflict) { canonical.forEach(witness => unresolved.add(witness.sourceEvent)); continue; }
      const quantity = take(resolveQuantity(canonical, undefined, context));
      canonical.forEach(witness => (quantity.state === 'resolved' ? members : unresolved).add(witness.sourceEvent));
    }
    return freeze({ state: missingPeers.length || unresolved.size ? 'partial' as const : 'complete' as const,
      members: [...members].sort(), unresolved: [...unresolved].sort(), missingPeers: missingPeers.sort((a, b) => a.peer.localeCompare(b.peer)) });
  });
}

export function classifyFeatureOutcome(input: FeatureOutcomeClassificationRequest,
  context: MeasurementDecodeContext): Result<'fired' | 'no-op' | 'unclassified' | 'shed' | 'error' | 'parser-failure' | 'event'> {
  return boundary('FeatureOutcomeClassification', input, context, () => {
    exactObject(input, ['kind', 'classifier', 'actionProved', 'negativeProved', 'gradeOnly', 'feature', 'action', 'evaluationClock', 'evidence'], ['evidence']);
    ensure(['exchange', 'shed', 'error', 'parser-failure', 'event'].includes(input.kind), 'feature outcome kind outside closed set');
    ensure(['complete', 'absent', 'incomplete', 'conflicted'].includes(input.classifier), 'feature classifier outside closed set');
    ensure(typeof input.actionProved === 'boolean' && typeof input.negativeProved === 'boolean' && typeof input.gradeOnly === 'boolean',
      'feature classifier flags must be boolean');
    if (input.kind !== 'exchange') {
      ensure(input.feature === null && input.action === null && input.evaluationClock === null && input.evidence === undefined,
        'non-exchange outcome cannot carry action-classifier authority');
      return input.kind;
    }
    substantive(input.feature as string, 'feature identity');
    ensure(context.register.entries.includes(input.feature as string), 'feature identity is not registered');
    ensure(input.action === 'feature-action-observed', 'feature action predicate is not registered');
    ensure(input.evaluationClock !== null, 'feature classification requires an explicit evaluation clock');
    const evaluationClock = admittedClock(input.evaluationClock, context, 'feature evaluation clock');
    if (input.kind !== 'exchange') return input.kind;
    if (input.classifier !== 'complete' || input.gradeOnly) return 'unclassified';
    ensure(!(input.actionProved && input.negativeProved), 'classifier evidence contradicts itself');
    if (!input.actionProved && !input.negativeProved) return 'unclassified';
    if (!input.evidence || !(context.types.evidence ?? []).includes(input.evidence)) return 'unclassified';
    const claim = take(readEvidence(input.evidence, evaluationClock, context.preserved));
    const expected = input.actionProved ? 'fired' : 'no-op';
    return claim.subject === input.feature && claim.predicate === input.action && claim.value === expected ? expected : 'unclassified';
  });
}

function selectedAmount(policy: BurnPolicy, sample: BurnSample): number | null {
  const selection = policy.selections.find(row => row.source === sample.source);
  if (!selection || selection.version !== sample.selectionVersion) return null;
  ensure(sample.quantities.every(row => issuedQuantities.has(row)), 'burn quantity must come from quantity resolution');
  const expectedKind = sample.source === 'model-exchange' ? 'model-token' : 'programmatic-count';
  const amounts = selection.categories.map(category => {
    const matches = sample.quantities.filter(row => row.state === 'resolved' && row.witnesses.length > 0
      && row.witnesses.every(witness => witness.category === category && witness.measurement.unit === policy.unit
        && witness.measurement.subject.kind === expectedKind && witness.measurement.subject.instance === sample.identity));
    ensure(matches.length <= 1, 'burn sample has competing category quantities');
    return matches[0]?.amount ?? null;
  });
  if (amounts.some(value => value === null)) return null;
  return amounts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const ordered = values.slice().sort((a, b) => a - b); const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function resolvedSamples(policy: BurnPolicy, samples: readonly BurnSample[]): Readonly<{
  amount: number; count: number; debt: readonly string[]; identities: readonly string[];
}> {
  const grouped = new Map<string, BurnSample[]>();
  for (const sample of samples) {
    const group = grouped.get(sample.identity) ?? []; group.push(sample); grouped.set(sample.identity, group);
  }
  let amount = 0; let count = 0; const debt: string[] = [];
  for (const [identity, group] of grouped) {
    if (group.some(sample => encoding(sample).bytes !== encoding(group[0]).bytes)) {
      debt.push(`conflicting-duplicate:${identity}`); continue;
    }
    const selected = selectedAmount(policy, group[0]!);
    if (selected === null) debt.push(`unresolved:${identity}`);
    else { amount += selected; count++; }
  }
  return { amount, count, debt, identities: [...grouped.keys()].sort() };
}

function windowAmount(policy: BurnPolicy, window: BurnWindow): ReturnType<typeof resolvedSamples> {
  return resolvedSamples(policy, window.samples.filter(row => row.feature === policy.feature));
}

function comparisonAmount(policy: BurnPolicy, window: BurnWindow): number | null {
  const resolved = resolvedSamples(policy, window.samples);
  return resolved.debt.length ? null : resolved.amount;
}

function adequate(policy: BurnPolicy, window: BurnWindow, amount: ReturnType<typeof windowAmount>): boolean {
  const coverage = window.observedExchanges === 0 ? null : window.usageSupportedExchanges / window.observedExchanges;
  return window.censusComplete && window.collectorsComplete && window.dispatchUncertain === 0 && window.conflictedAttempts === 0
    && amount.count >= policy.minimumEligibleSamples
    && (coverage === null || coverage >= policy.minimumUsageCoverage);
}

/** Closes and issues one owner-observation window before it may affect episode state. */
export function createBurnWindow(input: BurnWindow, context: MeasurementDecodeContext): Result<BurnWindow> {
  return boundary('BurnWindowConstruction', input, context, () => {
    exactObject(input, ['id', 'start', 'end', 'evidenceHorizon', 'populationEvidence', 'censusComplete', 'collectorsComplete', 'observedExchanges', 'usageSupportedExchanges',
      'attemptedDispatches', 'provenNoExchange', 'dispatchUncertain', 'conflictedAttempts', 'programmaticEvents', 'samples', 'comparisonScopeAmount']);
    substantive(input.id, 'burn window identity');
    const start = admittedClock(input.start, context, 'burn window start');
    const end = admittedClock(input.end, context, 'burn window end');
    const evidenceHorizon = admittedClock(input.evidenceHorizon, context, 'burn evidence horizon');
    ensure(clockOrder(start, end, context) < 0 && clockOrder(end, evidenceHorizon, context) <= 0,
      'burn window and evidence horizon must be ordered');
    ensure(typeof input.censusComplete === 'boolean' && typeof input.collectorsComplete === 'boolean', 'burn completeness fields must be boolean');
    ensure(Array.isArray(input.samples) && input.samples.length <= 100_000, 'burn samples must be bounded');
    const samples = input.samples as readonly BurnSample[];
    for (const sample of samples) {
      exactObject(sample, ['identity', 'feature', 'source', 'selectionVersion', 'quantities']);
      substantive(sample.identity, 'burn sample identity'); substantive(sample.feature, 'burn sample feature');
      substantive(sample.selectionVersion, 'burn selection version');
      ensure(sample.source === 'model-exchange' || sample.source === 'programmatic-event', 'burn sample source outside closed set');
      ensure(Array.isArray(sample.quantities) && sample.quantities.length <= 64
        && sample.quantities.every(quantity => issuedQuantities.has(quantity)), 'burn quantity must come from quantity resolution');
    }
    for (const [name, count] of Object.entries({ observedExchanges: input.observedExchanges,
      usageSupportedExchanges: input.usageSupportedExchanges, attemptedDispatches: input.attemptedDispatches,
      provenNoExchange: input.provenNoExchange, dispatchUncertain: input.dispatchUncertain,
      conflictedAttempts: input.conflictedAttempts, programmaticEvents: input.programmaticEvents }))
      ensure(Number.isSafeInteger(count) && count >= 0, `${name} must be a nonnegative safe integer`);
    finiteNonnegative(input.comparisonScopeAmount, 'comparison scope amount');
    const binding = { id: input.id, start, end, evidenceHorizon, censusComplete: input.censusComplete,
      collectorsComplete: input.collectorsComplete, observedExchanges: input.observedExchanges,
      usageSupportedExchanges: input.usageSupportedExchanges, attemptedDispatches: input.attemptedDispatches,
      provenNoExchange: input.provenNoExchange, dispatchUncertain: input.dispatchUncertain,
      conflictedAttempts: input.conflictedAttempts, programmaticEvents: input.programmaticEvents,
      samples,
      comparisonScopeAmount: input.comparisonScopeAmount };
    ensure((context.types.evidence ?? []).includes(input.populationEvidence), 'burn population evidence is not owner-admitted');
    const populationEvidence = take(decode('Evidence', input.populationEvidence, context.types));
    ensure(typeof populationEvidence.source === 'string' && context.types.register.producers.includes(populationEvidence.source),
      'burn population evidence producer is not registered');
    const claim = take(readEvidence(populationEvidence, evidenceHorizon, context.preserved));
    ensure(claim.subject === input.id && claim.predicate === 'burn-window-population'
      && encoding(claim.value).bytes === encoding(binding).bytes,
    'burn population evidence does not bind its interval, census, membership, and quantities');
    const window = freeze({ ...binding, populationEvidence,
      samples: samples.map(sample => freeze({ ...sample, quantities: [...sample.quantities] })) }) as BurnWindow;
    const observation = encoding({ start: window.start, end: window.end, evidenceHorizon: window.evidenceHorizon,
      populationEvidence: window.populationEvidence.id, censusComplete: window.censusComplete, collectorsComplete: window.collectorsComplete,
      observedExchanges: window.observedExchanges, usageSupportedExchanges: window.usageSupportedExchanges,
      attemptedDispatches: window.attemptedDispatches, provenNoExchange: window.provenNoExchange,
      dispatchUncertain: window.dispatchUncertain, conflictedAttempts: window.conflictedAttempts,
      programmaticEvents: window.programmaticEvents, samples: window.samples.map(sample => ({ identity: sample.identity, source: sample.source,
        selectionVersion: sample.selectionVersion, quantities: sample.quantities.map(quantity => ({ key: quantity.key,
          witnesses: quantity.witnesses.map(witness => witness.sourceEvent).sort() })) })).sort((a, b) => a.identity.localeCompare(b.identity)) }).hash;
    issuedBurnWindows.set(encoding(window).hash, observation);
    return window;
  });
}

export function evaluateBurn(policy: BurnPolicy, previous: BurnEpisodeState, current: BurnWindow,
  baselines: readonly BurnWindow[], context: MeasurementDecodeContext): Result<BurnEvaluation> {
  return boundary('BurnEvaluation', { policy, previous, current, baselines }, context, () => {
    ensure(isDecodedBurnPolicy(policy) && isCurrentBurnPolicy(policy, context), 'burn policy must come from its decoder and remain current');
    const currentObservation = issuedBurnWindows.get(encoding(current).hash);
    const baselineObservations = baselines.map(window => issuedBurnWindows.get(encoding(window).hash));
    ensure(currentObservation !== undefined && baselineObservations.every(observation => observation !== undefined),
      'burn window must come from its constructor');
    exactObject(previous, ['state', 'recoveryCount', 'notified', 'investigation', 'lastEvaluatedWindow', 'lastEvaluatedObservation'],
      ['lastEvaluatedWindow', 'lastEvaluatedObservation']);
    ensure(previous.state === 'open' || previous.state === 'closed', 'burn episode state outside closed set');
    ensure(Number.isSafeInteger(previous.recoveryCount) && previous.recoveryCount >= 0, 'burn recovery count must be a nonnegative safe integer');
    ensure(typeof previous.notified === 'boolean' && (previous.investigation === null || typeof previous.investigation === 'string'),
      'burn episode notification or investigation state invalid');
    if (previous.investigation !== null) substantive(previous.investigation, 'burn investigation');
    ensure(previous.lastEvaluatedWindow === undefined || previous.lastEvaluatedWindow === null || typeof previous.lastEvaluatedWindow === 'string',
      'last evaluated burn window invalid');
    ensure(previous.lastEvaluatedObservation === undefined || previous.lastEvaluatedObservation === null
      || typeof previous.lastEvaluatedObservation === 'string', 'last evaluated burn observation invalid');
    ensure(new Set([current.id, ...baselines.map(window => window.id)]).size === baselines.length + 1,
      'current and baseline windows must have distinct identities');
    ensure(baselineObservations.every(observation => observation !== currentObservation),
      'current observation cannot be reused as baseline evidence');
    ensure(baselines.every(window => clockOrder(window.end, current.start, context) <= 0),
      'baseline window must end before the current window starts');
    for (const window of [current, ...baselines]) {
      exactObject(window, ['id', 'start', 'end', 'evidenceHorizon', 'populationEvidence', 'censusComplete', 'collectorsComplete', 'observedExchanges', 'usageSupportedExchanges',
        'attemptedDispatches', 'provenNoExchange', 'dispatchUncertain', 'conflictedAttempts', 'programmaticEvents', 'samples', 'comparisonScopeAmount']);
      substantive(window.id, 'burn window identity');
      ensure(typeof window.censusComplete === 'boolean' && typeof window.collectorsComplete === 'boolean',
        'burn completeness fields must be boolean');
      ensure(Array.isArray(window.samples) && window.samples.length <= 100_000, 'burn samples must be bounded');
      for (const sample of window.samples) {
        exactObject(sample, ['identity', 'feature', 'source', 'selectionVersion', 'quantities']);
        substantive(sample.identity, 'burn sample identity'); substantive(sample.feature, 'burn sample feature');
        substantive(sample.selectionVersion, 'burn selection version');
        ensure(sample.source === 'model-exchange' || sample.source === 'programmatic-event', 'burn sample source outside closed set');
        ensure(Array.isArray(sample.quantities) && sample.quantities.length <= 64, 'burn sample quantities must be bounded');
        const quantities = sample.quantities as readonly ResolvedQuantity[];
        ensure(quantities.every(quantity => issuedQuantities.has(quantity)), 'burn quantity must come from quantity resolution');
      }
      for (const [name, count] of Object.entries({ observedExchanges: window.observedExchanges,
        usageSupportedExchanges: window.usageSupportedExchanges, attemptedDispatches: window.attemptedDispatches,
        provenNoExchange: window.provenNoExchange, dispatchUncertain: window.dispatchUncertain,
        conflictedAttempts: window.conflictedAttempts, programmaticEvents: window.programmaticEvents }))
        ensure(Number.isSafeInteger(count) && count >= 0, `${name} must be a nonnegative safe integer`);
      ensure(window.usageSupportedExchanges <= window.observedExchanges, 'usage-supported exchanges exceed observed exchanges');
      ensure(window.observedExchanges <= window.attemptedDispatches, 'observed exchanges exceed attempted dispatches');
      ensure(window.observedExchanges + window.provenNoExchange + window.dispatchUncertain + window.conflictedAttempts <= window.attemptedDispatches,
        'dispatch classifications exceed attempted dispatches');
      if (window.censusComplete) ensure(window.observedExchanges + window.provenNoExchange + window.dispatchUncertain
        + window.conflictedAttempts === window.attemptedDispatches, 'complete census leaves attempted dispatches unclassified');
      const namedModelSamples = new Set(window.samples.filter(sample => sample.feature === policy.feature && sample.source === 'model-exchange').map(sample => sample.identity));
      const namedEventSamples = new Set(window.samples.filter(sample => sample.feature === policy.feature && sample.source === 'programmatic-event').map(sample => sample.identity));
      ensure(namedModelSamples.size <= window.usageSupportedExchanges, 'witnessed model samples exceed usage-supported exchange census');
      ensure(namedEventSamples.size <= window.programmaticEvents, 'witnessed programmatic samples exceed event census');
      finiteNonnegative(window.comparisonScopeAmount, 'comparison scope amount');
    }
    const currentResolved = windowAmount(policy, current); const baselineResolved = baselines.map(row => windowAmount(policy, row));
    const currentComparison = comparisonAmount(policy, current);
    const baselineComparisons = baselines.map(row => comparisonAmount(policy, row));
    ensure(currentComparison !== null && baselineComparisons.every(amount => amount !== null),
      'comparison population contains unresolved quantities');
    ensure(current.comparisonScopeAmount === currentComparison
      && baselines.every((row, index) => row.comparisonScopeAmount === baselineComparisons[index]),
    'comparison denominator differs from its witnessed registered-selection population');
    const coverage = current.observedExchanges === 0 ? null : current.usageSupportedExchanges / current.observedExchanges;
    const debt = [...currentResolved.debt];
    if (!current.censusComplete) debt.push('census-incomplete');
    if (!current.collectorsComplete) debt.push('collector-incomplete');
    if (current.dispatchUncertain) debt.push('dispatch-uncertain');
    if (current.conflictedAttempts) debt.push('attempt-conflict');
    if (currentResolved.count < policy.minimumEligibleSamples) debt.push('eligible-sample-floor');
    if (coverage !== null && coverage < policy.minimumUsageCoverage) debt.push('usage-coverage-floor');
    const completeInactive = current.censusComplete && current.collectorsComplete && current.observedExchanges === 0
      && current.programmaticEvents === 0 && current.dispatchUncertain === 0 && current.conflictedAttempts === 0
      && current.attemptedDispatches === current.provenNoExchange;
    const confidence = baselines.length > 0 && adequate(policy, current, currentResolved) && baselines.every((row, index) => adequate(policy, row, baselineResolved[index]!))
      ? 'adequate' as const : 'insufficient-evidence' as const;
    const baselineAmount = confidence === 'adequate' ? median(baselineResolved.map(row => row.amount)) : null;
    const amount = currentResolved.count ? currentResolved.amount : completeInactive ? 0 : null;
    const share = amount === null || current.comparisonScopeAmount === 0 ? null : amount / current.comparisonScopeAmount;
    const excess = amount === null || baselineAmount === null ? null : Math.max(0, amount - baselineAmount);
    const structuralDebt = currentResolved.debt.some(item => item.startsWith('unresolved:') || item.startsWith('conflicting-duplicate:'));
    const classification = !current.censusComplete || !current.collectorsComplete || current.dispatchUncertain > 0 || current.conflictedAttempts > 0 || structuralDebt
      ? 'incomplete' as const : completeInactive ? 'inactive' as const : confidence !== 'adequate'
        ? 'insufficient-evidence' as const : amount === 0 ? 'zero-metered-activity' as const : 'activity' as const;
    let next: BurnEpisodeState = previous; let notify = false; let openInvestigation = false;
    if (classification === 'incomplete')
      next = freeze({ ...previous, state: previous.state, recoveryCount: 0, lastEvaluatedWindow: current.id,
        lastEvaluatedObservation: currentObservation });
    else if (completeInactive) next = freeze({ state: 'closed' as const, recoveryCount: 0, notified: false,
      investigation: null, lastEvaluatedWindow: current.id, lastEvaluatedObservation: currentObservation });
    else if (confidence === 'insufficient-evidence')
      next = freeze({ ...previous, state: previous.state, recoveryCount: 0, lastEvaluatedWindow: current.id,
        lastEvaluatedObservation: currentObservation });
    else if (previous.state === 'closed') {
      if (confidence === 'adequate' && excess !== null && share !== null && excess >= policy.entryExcess && share >= policy.entryShare) {
        notify = true; openInvestigation = true;
        next = freeze({ state: 'open' as const, recoveryCount: 0, notified: true,
          investigation: `investigation:${policy.id}:${current.id}`, lastEvaluatedWindow: current.id,
          lastEvaluatedObservation: currentObservation });
      }
    } else if (confidence === 'adequate' && excess !== null && share !== null
      && excess <= policy.recoveryExcess && share <= policy.recoveryShare) {
      const recoveryCount = previous.lastEvaluatedObservation === currentObservation ? previous.recoveryCount : previous.recoveryCount + 1;
      next = freeze({ ...previous, state: recoveryCount >= policy.recoveryWindows ? 'closed' as const : 'open' as const,
        recoveryCount: recoveryCount >= policy.recoveryWindows ? 0 : recoveryCount, lastEvaluatedWindow: current.id,
        lastEvaluatedObservation: currentObservation });
    } else next = freeze({ ...previous, recoveryCount: 0, lastEvaluatedWindow: current.id,
      lastEvaluatedObservation: currentObservation });
    return freeze({ classification, confidence, currentAmount: amount, baselineAmount, excess, share,
      eligibleSampleCount: currentResolved.count, coverage, coverageDebt: [...new Set(debt)].sort(),
      culprit: amount !== null && currentResolved.count > 0 ? policy.feature : null, episode: next, notify, openInvestigation });
  });
}

function validateReadRow(row: MeasurementReadRow, query: MeasurementReadQuery, context: MeasurementDecodeContext): void {
  ensure(row && typeof row === 'object' && Object.keys(row).length === rowFields.length && rowFields.every(field => Object.hasOwn(row, field)), 'read row has undeclared or missing field');
  for (const value of [row.identity, row.category, row.unit, row.producer, row.sourceSample, row.machine]) substantive(value, 'read metadata');
  ensure(families.includes(row.family), 'read family outside closed set');
  ensure(quantityStates.includes(row.state), 'read state outside closed set');
  ensure(row.feature === null || typeof row.feature === 'string', 'read feature must be text or absent');
  ensure(row.model === null || typeof row.model === 'string', 'read model must be text or absent');
  if (row.feature !== null) substantive(row.feature, 'read feature');
  if (row.model !== null) substantive(row.model, 'read model');
  ensure(context.types.register.producers.includes(row.producer), 'read producer is not registered');
  ensure(context.types.register.entries.includes(row.machine), 'read machine is not registered');
  ensure(row.feature === null || context.types.register.entries.includes(row.feature), 'read feature is not registered');
  ensure(row.model === null || context.types.register.entries.includes(row.model), 'read model is not registered');
  ensure(row.amount === null || Number.isFinite(row.amount) && row.amount >= 0, 'read amount must be finite nonnegative or unknown');
  ensure(row.state !== 'reported' || row.amount !== null, 'reported read row requires amount');
  ensure(!['not-reported', 'unsupported', 'missing', 'failed', 'legacy-origin-lost', 'conflicted'].includes(row.state) || row.amount === null,
    'unknown or conflicted read row cannot carry an amount');
  if (row.amount !== null && ['tokens', 'bytes'].includes(row.unit))
    ensure(Number.isSafeInteger(row.amount), 'discrete read amount must be a safe integer');
  ensure(isCurrentMeasurementTuple(row.family, row.category, row.unit, row.producer, context),
    'read family/category/unit tuple is not registered');
  admittedClock(row.at, context, 'read row clock');
  ensure((context.types.evidence ?? []).includes(row.evidence), 'read row evidence is not owner-admitted');
  ensure(row.evidence.source === row.producer, 'read row evidence has a foreign producer');
  const claim = take(readEvidence(row.evidence, query.evaluationClock, context.preserved));
  exactObject(claim.value, ['family', 'category', 'sourceSample', 'amount', 'unit', 'producer', 'feature', 'model', 'machine',
    'sourceHistoryDigest', 'sourceProjectionDigest', 'frontier', 'registerGeneration']);
  ensure(claim.subject === row.identity && claim.predicate === 'measurement-read-row'
    && encoding(claim.value).bytes === encoding({ family: row.family, category: row.category, sourceSample: row.sourceSample,
      amount: row.amount, unit: row.unit, producer: row.producer, feature: row.feature, model: row.model, machine: row.machine,
      sourceHistoryDigest: query.sourceHistoryDigest, sourceProjectionDigest: query.sourceProjectionDigest,
      frontier: query.frontier, registerGeneration: query.registerGeneration }).bytes,
  'read row evidence does not bind the source projection row');
}

function cursorBinding(query: MeasurementReadQuery, source: readonly MeasurementReadRow[]): string {
  const { cursor: _cursor, ...pinned } = query;
  return encoding({ query: pinned, source: source.map(row => encoding(row).hash).sort() }).hash;
}

function encodeCursor(offset: number, binding: string): string {
  return Buffer.from(encoding({ offset, binding }).bytes, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string, binding: string): number {
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); } catch { ensure(false, 'cursor is not an admitted continuation'); }
  ensure(parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed), 'cursor is not an admitted continuation');
  const value = parsed as Record<string, unknown>;
  ensure(Object.keys(value).length === 2 && Number.isSafeInteger(value.offset) && (value.offset as number) >= 0
    && value.binding === binding, 'cursor belongs to another query or source');
  return value.offset as number;
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

export function renderBoundedRead(query: MeasurementReadQuery, rows: readonly MeasurementReadRow[], timedOut: boolean,
  context: MeasurementDecodeContext): Result<MeasurementReadResult> {
  return boundary('MeasurementBoundedRead', query, context, () => {
    ensure(isDecodedMeasurementReadQuery(query), 'query must come from its decoder');
    ensure(typeof timedOut === 'boolean', 'read timeout state must be boolean');
    ensure(query.pageSize <= 500 && query.maxExportBytes <= 1_048_576 && query.detailHorizonMs <= 90 * 24 * 60 * 60 * 1000,
      'query exceeds registered bound');
    ensure(rows.length <= 100_000, 'read input exceeds hard cardinality bound'); rows.forEach(row => validateReadRow(row, query, context));
    const canonicalRows = new Map<string, MeasurementReadRow>();
    for (const row of rows) {
      const prior = canonicalRows.get(row.identity);
      ensure(!prior || encoding(prior).bytes === encoding(row).bytes, 'read identity has conflicting rows');
      if (!prior) canonicalRows.set(row.identity, row);
    }
    const admittedRows = [...canonicalRows.values()];
    const available = admittedRows.filter(row => clockOrder(query.start, row.at, context) <= 0 && clockOrder(row.at, query.end, context) < 0
      && query.evaluationClock.value - row.at.value <= query.detailHorizonMs);
    available.sort((a, b) => query.sort === 'identity' ? a.identity.localeCompare(b.identity)
      : clockOrder(a.at, b.at, context) || a.identity.localeCompare(b.identity));
    const binding = cursorBinding(query, admittedRows);
    const offset = query.cursor === null ? 0 : decodeCursor(query.cursor, binding);
    ensure(Number.isSafeInteger(offset) && offset >= 0 && offset <= available.length, 'cursor is outside result set');
    const candidates = available.slice(offset, offset + query.pageSize);
    let output: MeasurementReadResult | null = null;
    for (let count = candidates.length; count >= 0; count--) {
      const page = candidates.slice(0, count).map(row => freeze({ ...row }));
      const next = offset + page.length;
      const partial = timedOut || next < available.length;
      const candidate = sizedRead({ query: query.id, rows: page, totalCount: available.length,
        nextCursor: next < available.length ? encodeCursor(next, binding) : null, partial,
        reason: timedOut ? 'timeout at pinned bounded horizon' : next < available.length ? 'page or export bound' : null,
        evaluationClock: query.evaluationClock, sourceHistoryDigest: query.sourceHistoryDigest,
        sourceProjectionDigest: query.sourceProjectionDigest, frontier: query.frontier,
        registerGeneration: query.registerGeneration });
      if (candidate.exportBytes <= query.maxExportBytes) { output = candidate; break; }
    }
    ensure(output, 'export bound cannot encode a response');
    ensure(offset >= available.length || output.rows.length > 0, 'export bound cannot make forward progress');
    return output;
  });
}

export function bindMeasurementReadSource(request: MeasurementReadSourceRequest,
  context: MeasurementDecodeContext): Result<MeasurementReadSourceBinding> {
  return boundary('MeasurementReadSourceBinding', request, context, () => {
    exactObject(request, ['sourceHistory', 'sourceDefinition', 'sourceGeneration']);
    ensure(encoding(request.sourceGeneration.reference).bytes === encoding(context.register.generation).bytes,
      'historical read source register generation is not current');
    const projection = take(foldProjection(request.sourceDefinition, request.sourceHistory, request.sourceGeneration, context));
    return freeze({ sourceHistoryDigest: encoding(request.sourceHistory).hash,
      sourceProjectionDigest: encoding(projection).hash, frontier: encoding(projection.foldedThrough).hash,
      registerGeneration: context.register.generation.id });
  });
}

export function renderCurrentMeasurementRead(request: CurrentMeasurementReadRequest,
  context: MeasurementDecodeContext): Result<MeasurementReadResult> {
  return boundary('CurrentMeasurementRead', request, context, () => {
    exactObject(request, ['query', 'rows', 'timedOut', 'sourceHistory', 'sourceDefinition', 'sourceGeneration']);
    const binding = take(bindMeasurementReadSource({ sourceHistory: request.sourceHistory,
      sourceDefinition: request.sourceDefinition, sourceGeneration: request.sourceGeneration }, context));
    ensure(encoding(binding).bytes === encoding({ sourceHistoryDigest: request.query.sourceHistoryDigest,
      sourceProjectionDigest: request.query.sourceProjectionDigest, frontier: request.query.frontier,
      registerGeneration: request.query.registerGeneration }).bytes,
    'historical read query is not bound to its current owner snapshot and source projection');
    return take(renderBoundedRead(request.query, request.rows, request.timedOut, context));
  });
}

export function measurementProjectionDefinition(generation: ProjectionGeneration,
  bindings: Readonly<Record<string, Readonly<{ identity: string; value: string; merge: 'additive' | 'set-union' | 'max' | 'min' | 'exclusive-singleton' }>>>,
  context: BoundaryContext): Result<ProjectionDefinition> {
  return boundary('MeasurementProjectionDefinition', { generation, bindings }, context, () => {
    ensure(bindings !== null && typeof bindings === 'object' && !Array.isArray(bindings), 'projection bindings must be a closed object');
    ensure(Object.keys(bindings).every(kind => generation.kinds.includes(kind)), 'projection binding names unregistered kind');
    for (const binding of Object.values(bindings)) {
      exactObject(binding, ['identity', 'value', 'merge']);
      substantive(binding.identity, 'projection identity selector'); substantive(binding.value, 'projection value selector');
      ensure(['additive', 'set-union', 'max', 'min', 'exclusive-singleton'].includes(binding.merge),
        'projection merge is outside the closed set');
    }
    const decisions = Object.fromEntries(generation.kinds.map(kind => [kind, bindings[kind]
      ? { kind: 'folds' as const, ...bindings[kind]! }
      : { kind: 'ignores' as const, reason: 'not a registered measurement-plane input' }]));
    return freeze({ id: 'measurement.source.all-identities', class: 'informational' as const,
      stalenessBound: 60_000, retention: 'all-identities' as const, decisions });
  });
}

export function growthInvestigationLink(policy: GrowthPolicy, observations: readonly GrowthObservation[],
  context: BoundaryContext): Result<GrowthInvestigationLink | null> {
  return boundary('MeasurementGrowthInvestigationLink', { policy, observations }, context, () => {
    const episodes = take(deriveGrowthEpisodes(policy, observations, [], context));
    if (!episodes.length) return null;
    ensure(episodes.length === 1, 'one growth evaluation opened several investigations');
    const episode = episodes[0]!;
    return freeze({ key: episode.key, run: policy.ownerRun, loop: policy.loopPolicy, observations: [...new Set(episode.observations)].sort() });
  });
}
