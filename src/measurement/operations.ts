import { compareMeasurements, decode, decodeMeasurement, readEvidence } from '../index.js';
import type { BoundaryContext, Clock, Result } from '../index.js';
import { boundary, contentRegistrationId, encoding, ensure, freeze, take } from './boundary.js';
import type {
  AdmittedMeasurementAmount, ClassifiedFootprint, ClassifiedLegacyResourceObservation,
  FeatureOutcomeClassificationRequest, LegacyResourceObservation, MeasurementAmountInput,
  ProcessClassRule, ProcessDescriptor, RateLimitEventObservation, RateLimitEventSummary,
  ResourcePoint, ResourceTrend,
} from './contracts.js';
import type { MeasurementDecodeContext } from './decode.js';
import { isCurrentMeasurementProducerContract } from './decode.js';

const finiteNonnegative = (value: unknown, field: string): number => {
  ensure(typeof value === 'number' && Number.isFinite(value) && value >= 0,
    `${field} must be finite and nonnegative`);
  return value;
};

const substantive = (value: unknown, field: string): void => ensure(typeof value === 'string'
  && value.trim().length > 0 && value.length <= 4096, `${field} must be bounded substantive text`);

function exactObject<T>(input: T, fields: readonly string[], optional: readonly string[] = []): asserts input is T & Record<string, unknown> {
  ensure(input !== null && typeof input === 'object' && !Array.isArray(input), 'closed object required');
  const keys = Object.keys(input);
  ensure(keys.every(key => fields.includes(key))
    && fields.filter(field => !optional.includes(field)).every(field => Object.hasOwn(input, field)),
  'undeclared or missing field');
}

function exactTextArray(input: unknown, field: string, maximum = 1024): readonly string[] {
  ensure(Array.isArray(input) && input.length <= maximum
    && input.every(value => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096),
  `${field} must be a bounded substantive text array`);
  ensure(new Set(input).size === input.length, `${field} contains duplicates`);
  return input;
}

function admittedClock(input: Clock, context: MeasurementDecodeContext, field: string): Clock {
  const decoded = take(decodeMeasurement('clock', input, context.types));
  ensure(encoding(decoded).bytes === encoding(input).bytes, `${field} must be an admitted clock`);
  return decoded;
}

function clockOrder(left: Clock, right: Clock, context: BoundaryContext): number {
  return take(compareMeasurements(left, right, context.preserved));
}

/**
 * Slice A1 admits only the registered category/value tuple. Evidence membership,
 * witness reconciliation and historical quantity resolution belong to slice A2.
 */
export function admitMeasurementAmount(input: MeasurementAmountInput,
  context: MeasurementDecodeContext): Result<AdmittedMeasurementAmount> {
  return boundary('MeasurementAmountAdmission', input, context, () => {
    exactObject(input, ['contract', 'category', 'amount']);
    ensure(isCurrentMeasurementProducerContract(input.contract, context),
      'producer contract must come from its decoder and remain bound to current registered content');
    substantive(input.category, 'measurement category');
    const category = input.contract.categories.find(row => row.name === input.category);
    ensure(category !== undefined, 'measurement category is not registered by this producer contract');
    const amount = finiteNonnegative(input.amount, 'measurement amount');
    if (category.unit === 'tokens' || category.unit === 'bytes')
      ensure(Number.isSafeInteger(amount), `${category.unit} quantity must be a nonnegative safe integer`);
    return freeze({ family: input.contract.family, subjectKind: input.contract.subjectKind,
      category: category.name, unit: category.unit, amount });
  });
}

export function renderMeasurementClaim(input: Readonly<{
  kind: 'recorded-execution' | 'target' | 'estimate' | 'configured-threshold';
  hardware: string | null; workload: string | null; evidence: readonly string[];
}>, context: MeasurementDecodeContext): Result<string> {
  return boundary('MeasurementClaimRender', input, context, () => {
    exactObject(input, ['kind', 'hardware', 'workload', 'evidence']);
    ensure(['recorded-execution', 'target', 'estimate', 'configured-threshold'].includes(input.kind),
      'measurement claim kind outside closed set');
    ensure(input.hardware === null || typeof input.hardware === 'string',
      'measurement claim hardware must be text or absent');
    ensure(input.workload === null || typeof input.workload === 'string',
      'measurement claim workload must be text or absent');
    if (input.hardware !== null) substantive(input.hardware, 'measurement claim hardware');
    if (input.workload !== null) substantive(input.workload, 'measurement claim workload');
    exactTextArray(input.evidence, 'measurement claim evidence');
    if (input.kind !== 'recorded-execution') return `${input.kind}: not measured`;
    ensure(input.hardware?.trim() && input.workload?.trim() && input.evidence.length > 0,
      'measured requires named hardware, workload, and execution evidence');
    const expected = { hardware: input.hardware, workload: input.workload };
    ensure(input.evidence.every(id => (context.types.evidence ?? []).some(evidence => {
      if (evidence.id !== id) return false;
      const claim = take(readEvidence(evidence, evidence.observedAt, context.preserved));
      return claim.predicate === 'execution-observed'
        && encoding(claim.value).bytes === encoding(expected).bytes;
    })), 'measured execution evidence is not admitted or does not bind the claim');
    return `measured execution on ${input.hardware} for ${input.workload}`;
  });
}

export function coalesceUnknownQuotaEpisodes(keys: readonly string[], alreadyOpen: readonly string[],
  context: BoundaryContext): Result<Readonly<{ notices: readonly string[]; open: readonly string[] }>> {
  return boundary('QuotaUnknownEpisodeCoalescing', { keys, alreadyOpen }, context, () => {
    const admitRepeated = (input: unknown, field: string): readonly string[] => {
      ensure(Array.isArray(input) && input.length <= 1024
        && input.every(value => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096),
      `${field} must be a bounded substantive text array`);
      return input;
    };
    const admittedKeys = admitRepeated(keys, 'quota episode keys');
    const admittedOpen = admitRepeated(alreadyOpen, 'open quota episode keys');
    const open = [...new Set([...admittedOpen, ...admittedKeys])].sort();
    const prior = new Set(admittedOpen);
    return freeze({ notices: [...new Set(admittedKeys)].filter(key => !prior.has(key)).sort(), open });
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
  ensure(Number.isSafeInteger(point.cadenceMs) && point.cadenceMs > 0,
    'resource cadence must be a positive safe integer');
  const at = admittedClock(point.at, context, 'resource sample clock');
  ensure(['observed', 'missing', 'failed'].includes(point.state), 'resource state outside closed set');
  ensure(['reported', 'unsupported', 'missing'].includes(point.heapState), 'heap state outside closed set');
  ensure((point.cpuTimeMs === null) === (point.monotonicIntervalMs === null),
    'CPU time and interval presence differ');
  if (point.cpuTimeMs !== null) finiteNonnegative(point.cpuTimeMs, 'cpu time');
  if (point.monotonicIntervalMs !== null)
    ensure(Number.isFinite(point.monotonicIntervalMs) && point.monotonicIntervalMs > 0,
      'monotonic interval must be positive');
  if (point.rssBytes !== null)
    ensure(Number.isSafeInteger(point.rssBytes) && point.rssBytes >= 0,
      'RSS bytes must be a nonnegative safe integer');
  if (point.heapBytes !== null)
    ensure(Number.isSafeInteger(point.heapBytes) && point.heapBytes >= 0,
      'heap bytes must be a nonnegative safe integer');
  ensure((point.heapState === 'reported') === (point.heapBytes !== null),
    'heap state and amount disagree');
  if (point.state !== 'observed')
    ensure(point.cpuTimeMs === null && point.monotonicIntervalMs === null && point.rssBytes === null
      && point.heapBytes === null && point.heapState === 'missing',
    'missing resource observation carries usable amounts');
  return freeze({ id: point.id, machine: point.machine, processIncarnation: point.processIncarnation,
    sourceSample: point.sourceSample, at, hardwareProfile: point.hardwareProfile,
    classifierGeneration: point.classifierGeneration, cadenceMs: point.cadenceMs, state: point.state,
    cpuTimeMs: point.cpuTimeMs, monotonicIntervalMs: point.monotonicIntervalMs,
    rssBytes: point.rssBytes, heapBytes: point.heapBytes, heapState: point.heapState });
}

function validateProcessDescriptor(descriptor: ProcessDescriptor): void {
  exactObject(descriptor, processDescriptorFields);
  substantive(descriptor.processIncarnation, 'process incarnation');
  ensure(Number.isSafeInteger(descriptor.pid) && descriptor.pid > 0, 'PID must be positive');
  substantive(descriptor.startEvidence, 'process start evidence');
  exactTextArray(descriptor.tags, 'process tags', 256);
}

export function cpuUtilization(point: ResourcePoint, wholeMachineCores: number,
  basis: 'one-core' | 'whole-machine', context: MeasurementDecodeContext): Result<number | null> {
  return boundary('CpuUtilization', { point, wholeMachineCores, basis }, context, () => {
    ensure(Number.isSafeInteger(wholeMachineCores) && wholeMachineCores > 0,
      'named machine core count required');
    ensure(basis === 'one-core' || basis === 'whole-machine', 'CPU basis outside closed set');
    const admitted = validateResourcePoint(point, context);
    if (admitted.state !== 'observed' || admitted.cpuTimeMs === null
      || admitted.monotonicIntervalMs === null) return null;
    const oneCore = admitted.cpuTimeMs / admitted.monotonicIntervalMs * 100;
    const result = basis === 'one-core' ? oneCore : oneCore / wholeMachineCores;
    ensure(Number.isFinite(result) && result >= 0, 'CPU utilization result is not finite');
    return result;
  });
}

export function reconcileProcessIncarnation(previous: ProcessDescriptor, observed: ProcessDescriptor | null,
  context: BoundaryContext): Result<'same' | 'new-incarnation' | 'missing'> {
  return boundary('ProcessIncarnationReconciliation', { previous, observed }, context, () => {
    validateProcessDescriptor(previous);
    if (observed === null) return 'missing';
    validateProcessDescriptor(observed);
    return previous.pid === observed.pid && previous.startEvidence === observed.startEvidence
      && previous.processIncarnation === observed.processIncarnation ? 'same' : 'new-incarnation';
  });
}

export function planProcessCensus(processes: readonly ProcessDescriptor[], limit: number,
  context: BoundaryContext): Result<Readonly<{
    batch: readonly ProcessDescriptor[]; examined: number; omitted: number; truncated: boolean;
  }>> {
  return boundary('ProcessCensusPlan', { processes, limit }, context, () => {
    ensure(Array.isArray(processes), 'process inventory must be an array');
    ensure(Number.isSafeInteger(limit) && limit > 0, 'process census limit must be positive');
    ensure(processes.length <= 100_000, 'process inventory exceeds hard input bound');
    processes.forEach(validateProcessDescriptor);
    const identities = processes.map(row => row.processIncarnation);
    ensure(new Set(identities).size === identities.length, 'process incarnations must be unique');
    ensure(new Set(processes.map(row => row.pid)).size === processes.length,
      'one census cannot contain several incarnations for one PID');
    const batch = processes.slice(0, limit);
    return freeze({ batch, examined: batch.length, omitted: Math.max(0, processes.length - limit),
      truncated: processes.length > limit });
  });
}

export function classifyProcesses(processes: readonly ProcessDescriptor[], rules: readonly ProcessClassRule[],
  context: MeasurementDecodeContext): Result<ClassifiedFootprint> {
  return boundary('ProcessFootprintClassification', { processes, rules }, context, () => {
    ensure(Array.isArray(processes) && Array.isArray(rules), 'processes and rules must be arrays');
    processes.forEach(validateProcessDescriptor);
    ensure(new Set(processes.map(row => row.processIncarnation)).size === processes.length,
      'process incarnation appears more than once');
    for (const rule of rules) {
      exactObject(rule, ['className', 'requiredTags']);
      substantive(rule.className, 'process class');
      ensure(context.register.entries.includes(rule.className), 'process class is not registered');
      exactTextArray(rule.requiredTags, 'required process tags', 256);
      ensure(rule.requiredTags.length > 0, 'process class requires at least one tag');
      ensure(context.register.entries.includes(contentRegistrationId(rule)),
        'process class rule content binding is not registered');
    }
    ensure(new Set(rules.map(row => row.className)).size === rules.length, 'duplicate process class');
    const counts: Record<string, number> = Object.fromEntries(rules.map(row => [row.className, 0]));
    let unclassified = 0;
    for (const descriptor of processes) {
      const matches = rules.filter(rule => rule.requiredTags.every((tag: string) => descriptor.tags.includes(tag)));
      ensure(matches.length <= 1, 'process matches several registered classes');
      if (matches[0]) counts[matches[0].className] = (counts[matches[0].className] ?? 0) + 1;
      else unclassified++;
    }
    return freeze({ counts: Object.fromEntries(Object.entries(counts).sort()), unclassified });
  });
}

export function summarizeRateLimitEvents(events: readonly RateLimitEventObservation[], start: Clock,
  end: Clock, context: MeasurementDecodeContext): Result<RateLimitEventSummary> {
  return boundary('MeasurementRateLimitEventSummary', { events, start, end }, context, () => {
    ensure(Array.isArray(events), 'rate events must be an array');
    admittedClock(start, context, 'rate window start'); admittedClock(end, context, 'rate window end');
    ensure(clockOrder(start, end, context) < 0, 'rate event window is inverted');
    const byId = new Map<string, RateLimitEventObservation>();
    for (const event of events) {
      exactObject(event, ['id', 'source', 'kind', 'at']); substantive(event.id, 'rate event id');
      ensure(event.source === 'breaker' || event.source === 'session-sentinel',
        'rate event source outside closed set');
      ensure(event.source === 'breaker' ? event.kind === 'circuit-open' || event.kind === 'circuit-recover'
        : event.kind === 'throttle' || event.kind === 'quota' || event.kind === '529',
      'rate event kind is inconsistent with its source population');
      admittedClock(event.at, context, 'rate event clock');
      const prior = byId.get(event.id);
      if (prior) ensure(encoding(prior).bytes === encoding(event).bytes,
        'rate event identity has conflicting replay');
      else byId.set(event.id, freeze({ ...event }));
    }
    const admitted = [...byId.values()]
      .filter(event => clockOrder(start, event.at, context) <= 0 && clockOrder(event.at, end, context) < 0)
      .sort((a, b) => clockOrder(a.at, b.at, context) || a.id.localeCompare(b.id));
    const counts: Record<string, number> = {};
    for (const event of admitted) counts[event.kind] = (counts[event.kind] ?? 0) + 1;
    const hours = (end.value - start.value) / 3_600_000;
    return freeze({ events: admitted, counts,
      breakerTripsPerHour: (counts['circuit-open'] ?? 0) / hours });
  });
}

export function classifyLegacyResourceObservation(input: LegacyResourceObservation,
  context: BoundaryContext): Result<ClassifiedLegacyResourceObservation> {
  return boundary('MeasurementLegacyResourceObservation', input, context, () => {
    exactObject(input, ['id', 'source', 'state', 'value', 'originalNumeric']);
    substantive(input.id, 'legacy observation id');
    ensure(['own-resource-read', 'pid-batch', 'footprint-census', 'origin-lost'].includes(input.source),
      'legacy observation source outside closed set');
    ensure(['observed', 'read-failed'].includes(input.state) && typeof input.originalNumeric === 'boolean',
      'legacy observation state is malformed');
    if (input.source === 'origin-lost') {
      ensure(input.originalNumeric === false && (input.value === null
        || typeof input.value === 'number' && Number.isFinite(input.value)),
      'origin-lost observation must retain only finite legacy numeric evidence or explicit absence');
      return freeze({ id: input.id, state: 'legacy-origin-lost' as const, amount: input.value,
        reason: input.value === null ? 'legacy origin and amount unavailable'
          : 'legacy numeric retained with origin unavailable' });
    }
    if (input.state === 'read-failed') {
      ensure(input.value === null && input.originalNumeric === false,
        'failed resource observation carries usable amount');
      return freeze({ id: input.id,
        state: input.source === 'own-resource-read' ? 'failed' as const : 'missing' as const,
        amount: null, reason: `${input.source} did not produce an observation` });
    }
    ensure(input.originalNumeric && typeof input.value === 'number'
      && Number.isFinite(input.value) && input.value >= 0,
    'reported legacy observation requires its original finite nonnegative number');
    return freeze({ id: input.id, state: 'reported' as const, amount: input.value,
      reason: 'original numeric observation retained' });
  });
}

export function resourceTrend(points: readonly ResourcePoint[], minimumSamples: number,
  context: MeasurementDecodeContext): Result<ResourceTrend> {
  return boundary('ResourceTrend', { points, minimumSamples }, context, () => {
    ensure(Array.isArray(points), 'resource points must be an array');
    ensure(Number.isSafeInteger(minimumSamples) && minimumSamples >= 2,
      'trend minimum must be at least two');
    const reasons: string[] = [];
    const bySample = new Map<string, ResourcePoint[]>();
    const witnessIds = new Set<string>();
    for (const raw of points) {
      const point = validateResourcePoint(raw, context);
      ensure(!witnessIds.has(point.id), 'resource witness identity repeated');
      witnessIds.add(point.id);
      const witnesses = bySample.get(point.sourceSample) ?? [];
      witnesses.push(point); bySample.set(point.sourceSample, witnesses);
    }
    const samples = [...bySample.values()].map(witnesses => {
      const material = (row: ResourcePoint) => ({ ...row, id: '' });
      if (witnesses.some(row => encoding(material(row)).bytes !== encoding(material(witnesses[0]!)).bytes))
        reasons.push('conflicting source sample');
      return witnesses.slice().sort((a, b) => a.id.localeCompare(b.id))[0]!;
    }).sort((a, b) => clockOrder(a.at, b.at, context) || a.sourceSample.localeCompare(b.sourceSample));
    const retained = [...bySample.values()].flat()
      .sort((a, b) => clockOrder(a.at, b.at, context) || a.id.localeCompare(b.id));
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
    if (reasons.length) return freeze({ state: 'incomplete' as const, points: retained,
      rssDeltaBytes: null, reasons: [...new Set(reasons)].sort() });
    return freeze({ state: 'complete' as const, points: retained,
      rssDeltaBytes: samples.at(-1)!.rssBytes! - samples[0]!.rssBytes!, reasons: [] });
  });
}

export function classifyFeatureOutcome(input: FeatureOutcomeClassificationRequest,
  context: MeasurementDecodeContext): Result<'fired' | 'no-op' | 'unclassified' | 'shed' | 'error' | 'parser-failure' | 'event'> {
  return boundary('FeatureOutcomeClassification', input, context, () => {
    exactObject(input, ['kind', 'classifier', 'actionProved', 'negativeProved', 'gradeOnly',
      'feature', 'action', 'evaluationClock', 'evidence'], ['evidence']);
    ensure(['exchange', 'shed', 'error', 'parser-failure', 'event'].includes(input.kind),
      'feature outcome kind outside closed set');
    ensure(['complete', 'absent', 'incomplete', 'conflicted'].includes(input.classifier),
      'feature classifier outside closed set');
    ensure(typeof input.actionProved === 'boolean' && typeof input.negativeProved === 'boolean'
      && typeof input.gradeOnly === 'boolean', 'feature classifier flags must be boolean');
    ensure(!(input.actionProved && input.negativeProved), 'classifier evidence contradicts itself');
    const hasEvidence = Object.hasOwn(input, 'evidence');
    const decodedEvidence = hasEvidence ? take(decode('Evidence', input.evidence, context.types)) : undefined;
    if (decodedEvidence)
      ensure(encoding(decodedEvidence).bytes === encoding(input.evidence).bytes,
        'feature evidence must be an admitted Evidence record');
    if (input.kind !== 'exchange') {
      ensure(input.feature === null && input.action === null && input.evaluationClock === null
        && !hasEvidence, 'non-exchange outcome cannot carry action-classifier authority');
      return input.kind;
    }
    if (input.feature !== null) {
      substantive(input.feature, 'feature identity');
      ensure(context.register.entries.includes(input.feature), 'feature identity is not registered');
    }
    ensure(input.action === null || input.action === 'feature-action-observed',
      'feature action predicate is not registered');
    const evaluationClock = input.evaluationClock === null ? null
      : admittedClock(input.evaluationClock, context, 'feature evaluation clock');
    if (input.classifier === 'absent') {
      ensure(!input.actionProved && !input.negativeProved && input.action === null,
        'absent classifier cannot carry an action conclusion');
      return 'unclassified';
    }
    if (input.classifier !== 'complete' || input.gradeOnly) return 'unclassified';
    ensure(input.feature !== null, 'complete classifier requires a registered feature identity');
    ensure(input.action === 'feature-action-observed', 'feature action predicate is not registered');
    ensure(evaluationClock !== null, 'feature classification requires an explicit evaluation clock');
    if (!input.actionProved && !input.negativeProved) return 'unclassified';
    if (!decodedEvidence || !(context.types.evidence ?? []).includes(input.evidence!)) return 'unclassified';
    take(compareMeasurements(decodedEvidence.observedAt, evaluationClock, context.preserved));
    const claim = take(readEvidence(decodedEvidence, evaluationClock, context.preserved));
    const expected = input.actionProved ? 'fired' : 'no-op';
    return claim.subject === input.feature && claim.predicate === input.action && claim.value === expected
      ? expected : 'unclassified';
  });
}
