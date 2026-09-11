import { compareMeasurements, decode, decodeMeasurement, readEvidence } from '../index.js';
import type { BoundaryContext, Clock, Json, Result } from '../index.js';
import { deriveGrowthEpisodes } from '../assembly/index.js';
import type { GrowthObservation, GrowthPolicy } from '../assembly/index.js';
import type { ProjectionDefinition, ProjectionGeneration } from '../projections/index.js';
import { boundary, encoding, ensure, freeze, json, take } from './boundary.js';
import type { AggregateMeasurementsRequest, AttributionRequest, AttributionResult, BurnEpisodeState, BurnEvaluation,
  BurnPolicy, BurnSample, BurnWindow, ClassifiedFootprint, GrowthInvestigationLink, MeasurementAggregate,
  MeasurementProducerContract, MeasurementReadQuery, MeasurementReadResult, MeasurementReadRow, ProcessClassRule,
  ProcessDescriptor, QuantityOwnerResolution, QuantityWitness, QuantityWitnessInput, ResolvedQuantity, ResourcePoint,
  ResourceTrend } from './contracts.js';
import type { MeasurementDecodeContext } from './decode.js';

const rowFields = ['identity', 'family', 'category', 'at', 'amount', 'unit', 'state', 'producer', 'sourceSample', 'feature', 'model', 'machine'];
const finiteNonnegative = (value: unknown, field: string): number => {
  ensure(typeof value === 'number' && Number.isFinite(value) && value >= 0, `${field} must be finite and nonnegative`);
  return value;
};
const substantive = (value: string, field: string): void => ensure(value.trim().length > 0 && value.length <= 4096, `${field} must be bounded substantive text`);

export function createQuantityWitness(input: QuantityWitnessInput, context: MeasurementDecodeContext): Result<QuantityWitness> {
  return boundary('QuantityWitnessRead', input, context, () => {
    const contract = input.contract;
    ensure(Object.isFrozen(contract) && contract.type === 'MeasurementProducerContract' && contract.schemaVersion === 2,
      'producer contract must come from its decoder');
    substantive(input.subjectInstance, 'subjectInstance'); substantive(input.sourceEvent, 'sourceEvent');
    if (contract.sourceSampleRequired) substantive(input.sourceSample, 'sourceSample');
    if (contract.hardwareProfileRequired) ensure(input.hardwareProfile !== null && input.hardwareProfile.trim().length > 0, 'named hardware profile required');
    const category = contract.categories.find(row => row.name === input.category);
    ensure(category, 'category is not registered for producer');
    ensure(['reported', 'not-reported', 'unsupported', 'missing', 'failed', 'legacy-origin-lost'].includes(input.state), 'quantity state outside closed set');
    const measurement = take(decodeMeasurement(contract.subjectKind, input.measurement, context.types));
    const evidence = take(decode('Evidence', input.evidence, context.types));
    ensure(measurement.subject.instance === input.subjectInstance, 'measurement subject instance mismatch');
    ensure(measurement.unit === category.unit && measurement.by === contract.producer, 'measurement unit or producer mismatch');
    ensure(evidence.id === input.sourceEvent, 'evidence and source-event identity mismatch');
    const claim = take(readEvidence(evidence, measurement.at as Clock, context.preserved));
    ensure(claim.subject === input.subjectInstance && claim.predicate === contract.evidencePredicate, 'evidence binding mismatch');
    if (input.state === 'reported') finiteNonnegative(measurement.value, 'measurement value');
    ensure(input.state === 'reported' || measurement.value === 0, 'unavailable quantity cannot carry an amount');
    ensure(new Set(input.predecessors).size === input.predecessors.length, 'duplicate witness predecessor');
    const key = encoding({ family: contract.family, subject: input.subjectInstance, sourceSample: input.sourceSample,
      category: category.name, unit: category.unit, relation: category.relation, hardwareProfile: input.hardwareProfile }).hash;
    return freeze({ key, sourceSample: input.sourceSample, category: category.name, relation: category.relation,
      measurement, evidence, producer: contract.producer, sourceEvent: input.sourceEvent, phase: input.phase,
      predecessors: [...input.predecessors].sort(), state: input.state, hardwareProfile: input.hardwareProfile });
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
  context: BoundaryContext): Result<ResolvedQuantity> {
  return boundary('QuantityResolution', resolution ? { witnesses, resolution } : { witnesses }, context, () => {
    ensure(witnesses.length > 0 && witnesses.length <= 1024, 'quantity needs a bounded witness set');
    const canonical = [...new Map(witnesses.map(row => [row.sourceEvent, row])).values()];
    ensure(canonical.length === witnesses.length, 'duplicate observation key');
    const key = canonical[0]!.key;
    ensure(canonical.every(row => row.key === key), 'quantity witnesses use different quantity keys');
    const current = [...heads(canonical)].sort((a, b) => a.sourceEvent.localeCompare(b.sourceEvent));
    const reported = current.filter(row => row.state === 'reported');
    if (!reported.length) return freeze({ key, amount: null, state: 'unavailable' as const, witnesses: canonical,
      reason: current.map(row => row.state).sort().join(',') || 'missing' });
    const amounts = [...new Set(reported.map(row => row.measurement.value))];
    if (amounts.length === 1) return freeze({ key, amount: amounts[0]!, state: 'resolved' as const, witnesses: canonical, reason: 'compatible witnesses' });
    if (resolution) {
      ensure(resolution.key === key && resolution.owner === reported[0]!.producer, 'quantity resolution owner or key mismatch');
      ensure(new Set(resolution.witnesses).size === resolution.witnesses.length
        && current.every(row => resolution.witnesses.includes(row.sourceEvent))
        && resolution.witnesses.every(id => current.some(row => row.sourceEvent === id)), 'resolution must name every current witness exactly');
      finiteNonnegative(resolution.amount, 'resolved amount');
      const claim = take(readEvidence(resolution.evidence, resolution.evidence.observedAt, context.preserved));
      ensure(claim.subject === key && claim.predicate === 'quantity-resolved', 'owner resolution evidence mismatch');
      return freeze({ key, amount: resolution.amount, state: 'resolved' as const, witnesses: canonical, reason: 'owner-produced resolution' });
    }
    return freeze({ key, amount: null, state: 'unresolved' as const, witnesses: canonical, reason: 'witness amounts disagree' });
  });
}

function clockOrder(left: Clock, right: Clock, context: BoundaryContext): number {
  return take(compareMeasurements(left, right, context.preserved));
}

export function aggregateMeasurements(request: AggregateMeasurementsRequest, context: MeasurementDecodeContext): Result<MeasurementAggregate> {
  return boundary('AggregateMeasurements', request, context, () => {
    const policy = request.policy;
    ensure(Object.isFrozen(policy) && policy.schemaVersion === 2 && policy.aggregateKind === 'measurement-window-aggregate', 'aggregate policy must come from its decoder');
    ensure(policy.additiveUnits.includes(request.unit) && policy.categories.includes(request.category), 'unit or category is not additive');
    ensure(request.dimensions.length > 0 && new Set(request.dimensions).size === request.dimensions.length
      && request.dimensions.every(dimension => policy.dimensions.includes(dimension)), 'aggregate dimensions are not registered');
    ensure(policy.producer === request.producer && policy.scope === request.scope, 'producer or scope differs from registered aggregate');
    ensure(clockOrder(request.start, request.end, context) < 0 && clockOrder(request.end, request.evaluationClock, context) <= 0, 'aggregate clocks are incomparable or inverted');
    const members = [...new Set(request.quantities.filter(row => row.state === 'resolved').map(row => row.key))].sort();
    ensure(members.length === request.quantities.filter(row => row.state === 'resolved').length, 'aggregate repeats a resolved quantity');
    for (const row of request.quantities) if (row.witnesses[0]) {
      ensure(row.witnesses.every(witness => witness.measurement.unit === request.unit && witness.producer === request.producer
        && witness.category === request.category), 'aggregate member basis differs');
    }
    const amount = request.quantities.reduce((sum, row) => row.state === 'resolved' ? sum + finiteNonnegative(row.amount, 'resolved amount') : sum, 0);
    ensure(Number.isSafeInteger(amount), 'aggregate amount overflow');
    const dimensions = request.dimensions.slice().sort();
    const identityInput = { policy: policy.id, scope: request.scope, start: request.start, end: request.end,
      category: request.category, unit: request.unit, dimensions, frontier: request.frontier, evaluationClock: request.evaluationClock };
    const identity = encoding(identityInput).hash;
    const measurement = take(decodeMeasurement('measurement-window-aggregate', { type: 'Measurement', schemaVersion: 1,
      subject: { kind: 'measurement-window-aggregate', instance: identity }, value: amount, unit: request.unit,
      at: request.end, by: request.producer }, context.types));
    return freeze({ identity, measurement, amount, unit: request.unit,
      category: request.category, dimensions, members, unresolved: request.quantities.filter(row => row.state !== 'resolved').map(row => row.key).sort(),
      start: request.start, end: request.end, evaluationClock: request.evaluationClock, frontier: request.frontier });
  });
}

export function resolveAttribution(request: AttributionRequest, context: MeasurementDecodeContext): Result<AttributionResult> {
  return boundary('MeasurementAttribution', request, context, () => {
    const entries = new Map(request.sourceHistory.entries.map(row => [row.fact.id, row]));
    const found: { feature: string; model: string; run: string; machine: string; facts: string[] }[] = [];
    for (const candidate of request.candidates.filter(row => row.attempt === request.attempt)) {
      ensure(candidate.factReferences.length > 0 && new Set(candidate.factReferences).size === candidate.factReferences.length, 'attribution candidate facts incomplete');
      const rows = candidate.factReferences.map(reference => entries.get(reference));
      if (rows.some(row => !row || row.taint.length || row.conflicts.length)) continue;
      for (const row of rows) for (const item of row!.constitutional) if (item.value.type === 'Evidence') {
        const claim = take(readEvidence(item.value, request.evaluationClock, context.preserved));
        if (claim.subject !== request.attempt || claim.predicate !== 'registered-measurement-attribution'
          || !claim.value || typeof claim.value !== 'object' || Array.isArray(claim.value)) continue;
        const value = claim.value as Record<string, Json>;
        if (Object.keys(value).length !== 3 || !['feature', 'model', 'run'].every(field => typeof value[field] === 'string' && value[field]!.length > 0)) continue;
        found.push({ feature: value.feature as string, model: value.model as string, run: value.run as string,
          machine: row!.fact.machine, facts: candidate.factReferences.slice().sort() });
      }
    }
    const unique = [...new Map(found.map(row => [encoding(row).bytes, row])).values()];
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
  hardware: string | null; workload: string | null; evidence: readonly string[] }>, context: BoundaryContext): Result<string> {
  return boundary('MeasurementClaimRender', input, context, () => {
    if (input.kind !== 'recorded-execution') return `${input.kind}: not measured`;
    ensure(input.hardware?.trim() && input.workload?.trim() && input.evidence.length > 0, 'measured requires named hardware, workload, and execution evidence');
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

export function cpuUtilization(point: ResourcePoint, wholeMachineCores: number, basis: 'one-core' | 'whole-machine', context: BoundaryContext): Result<number | null> {
  return boundary('CpuUtilization', point, context, () => {
    ensure(Number.isSafeInteger(wholeMachineCores) && wholeMachineCores > 0, 'named machine core count required');
    if (point.state !== 'observed' || point.cpuTimeMs === null || point.monotonicIntervalMs === null) return null;
    finiteNonnegative(point.cpuTimeMs, 'cpu time');
    ensure(Number.isFinite(point.monotonicIntervalMs) && point.monotonicIntervalMs > 0, 'monotonic interval must be positive');
    const oneCore = point.cpuTimeMs / point.monotonicIntervalMs * 100;
    return basis === 'one-core' ? oneCore : oneCore / wholeMachineCores;
  });
}

export function reconcileProcessIncarnation(previous: ProcessDescriptor, observed: ProcessDescriptor | null, context: BoundaryContext): Result<'same' | 'new-incarnation' | 'missing'> {
  return boundary('ProcessIncarnationReconciliation', { previous, observed }, context, () => {
    if (!observed) return 'missing';
    ensure(Number.isSafeInteger(previous.pid) && previous.pid > 0 && Number.isSafeInteger(observed.pid) && observed.pid > 0, 'PID must be positive');
    return previous.pid === observed.pid && previous.startEvidence === observed.startEvidence
      && previous.processIncarnation === observed.processIncarnation ? 'same' : 'new-incarnation';
  });
}

export function planProcessCensus(processes: readonly ProcessDescriptor[], limit: number, context: BoundaryContext): Result<Readonly<{ batch: readonly ProcessDescriptor[]; examined: number; omitted: number; truncated: boolean }>> {
  return boundary('ProcessCensusPlan', { processes, limit }, context, () => {
    ensure(Number.isSafeInteger(limit) && limit > 0, 'process census limit must be positive');
    ensure(processes.length <= 100_000, 'process inventory exceeds hard input bound');
    const identities = processes.map(row => row.processIncarnation);
    ensure(identities.every(Boolean) && new Set(identities).size === identities.length, 'process incarnations must be unique');
    const batch = processes.slice(0, limit);
    return freeze({ batch, examined: batch.length, omitted: Math.max(0, processes.length - limit), truncated: processes.length > limit });
  });
}

export function classifyProcesses(processes: readonly ProcessDescriptor[], rules: readonly ProcessClassRule[], context: BoundaryContext): Result<ClassifiedFootprint> {
  return boundary('ProcessFootprintClassification', { processes, rules }, context, () => {
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

export function resourceTrend(points: readonly ResourcePoint[], minimumSamples: number, context: BoundaryContext): Result<ResourceTrend> {
  return boundary('ResourceTrend', { points, minimumSamples }, context, () => {
    ensure(Number.isSafeInteger(minimumSamples) && minimumSamples >= 2, 'trend minimum must be at least two');
    const ordered = points.slice().sort((a, b) => clockOrder(a.at, b.at, context));
    const reasons: string[] = [];
    if (ordered.length < minimumSamples) reasons.push('insufficient samples');
    if (ordered.some(row => row.state !== 'observed' || row.rssBytes === null)) reasons.push('missing tick');
    if (new Set(ordered.map(row => row.machine)).size > 1) reasons.push('machine changed');
    if (new Set(ordered.map(row => row.hardwareProfile)).size > 1) reasons.push('hardware changed');
    if (new Set(ordered.map(row => row.classifierGeneration)).size > 1) reasons.push('classifier changed');
    if (new Set(ordered.map(row => row.sourceSample)).size !== ordered.length) reasons.push('duplicate source sample');
    for (let index = 1; index < ordered.length; index++) if (clockOrder(ordered[index - 1]!.at, ordered[index]!.at, context) >= 0) reasons.push('sample clocks not increasing');
    if (reasons.length) return freeze({ state: 'incomplete' as const, points: ordered, rssDeltaBytes: null, reasons: [...new Set(reasons)].sort() });
    const first = ordered[0]!.rssBytes!; const last = ordered.at(-1)!.rssBytes!;
    return freeze({ state: 'complete' as const, points: ordered, rssDeltaBytes: last - first, reasons: [] });
  });
}

export function classifyFeatureOutcome(input: Readonly<{ kind: 'exchange' | 'shed' | 'error' | 'parser-failure' | 'event';
  classifier: 'complete' | 'absent' | 'incomplete' | 'conflicted'; actionProved: boolean; negativeProved: boolean; gradeOnly: boolean }>,
  context: BoundaryContext): Result<'fired' | 'no-op' | 'unclassified' | 'shed' | 'error' | 'parser-failure' | 'event'> {
  return boundary('FeatureOutcomeClassification', input, context, () => {
    if (input.kind !== 'exchange') return input.kind;
    if (input.classifier !== 'complete' || input.gradeOnly) return 'unclassified';
    ensure(!(input.actionProved && input.negativeProved), 'classifier evidence contradicts itself');
    return input.actionProved ? 'fired' : input.negativeProved ? 'no-op' : 'unclassified';
  });
}

function selectedAmount(policy: BurnPolicy, sample: BurnSample): number | null {
  const selection = policy.selections.find(row => row.source === sample.source);
  if (!selection || selection.version !== sample.selectionVersion) return null;
  const amounts = selection.categories.map(category => sample.quantities.find(row => row.state === 'resolved'
    && row.witnesses[0]?.category === category)?.amount ?? null);
  if (amounts.some(value => value === null)) return null;
  return amounts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const ordered = values.slice().sort((a, b) => a - b); const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function windowAmount(policy: BurnPolicy, window: BurnWindow): Readonly<{ amount: number; count: number; debt: readonly string[] }> {
  const identities = new Set<string>(); let amount = 0; const debt: string[] = [];
  for (const sample of window.samples.filter(row => row.feature === policy.feature)) {
    if (identities.has(sample.identity)) { debt.push(`duplicate:${sample.identity}`); continue; }
    identities.add(sample.identity);
    const selected = selectedAmount(policy, sample);
    if (selected === null) debt.push(`unresolved:${sample.identity}`); else { amount += selected; }
  }
  return { amount, count: identities.size - debt.filter(value => value.startsWith('unresolved:')).length, debt };
}

function adequate(policy: BurnPolicy, window: BurnWindow, amount: ReturnType<typeof windowAmount>): boolean {
  const coverage = window.observedExchanges === 0 ? null : window.usageSupportedExchanges / window.observedExchanges;
  return window.censusComplete && window.collectorsComplete && amount.count >= policy.minimumEligibleSamples
    && (coverage === null || coverage >= policy.minimumUsageCoverage);
}

export function evaluateBurn(policy: BurnPolicy, previous: BurnEpisodeState, current: BurnWindow,
  baselines: readonly BurnWindow[], context: BoundaryContext): Result<BurnEvaluation> {
  return boundary('BurnEvaluation', { policy, previous, current, baselines }, context, () => {
    ensure(Object.isFrozen(policy) && policy.schemaVersion === 2, 'burn policy must come from its decoder');
    ensure(baselines.length > 0, 'burn baseline cannot be empty');
    const currentResolved = windowAmount(policy, current); const baselineResolved = baselines.map(row => windowAmount(policy, row));
    const coverage = current.observedExchanges === 0 ? null : current.usageSupportedExchanges / current.observedExchanges;
    const debt = [...currentResolved.debt];
    if (!current.censusComplete) debt.push('census-incomplete');
    if (!current.collectorsComplete) debt.push('collector-incomplete');
    if (current.dispatchUncertain) debt.push('dispatch-uncertain');
    if (current.conflictedAttempts) debt.push('attempt-conflict');
    const completeInactive = current.censusComplete && current.collectorsComplete && current.observedExchanges === 0
      && current.programmaticEvents === 0 && current.dispatchUncertain === 0 && current.conflictedAttempts === 0
      && current.attemptedDispatches === current.provenNoExchange;
    const confidence = adequate(policy, current, currentResolved) && baselines.every((row, index) => adequate(policy, row, baselineResolved[index]!))
      ? 'adequate' as const : 'insufficient-evidence' as const;
    const baselineAmount = confidence === 'adequate' ? median(baselineResolved.map(row => row.amount)) : null;
    const amount = currentResolved.count ? currentResolved.amount : completeInactive ? 0 : null;
    const share = amount === null || current.comparisonScopeAmount === 0 ? null : amount / current.comparisonScopeAmount;
    const excess = amount === null || baselineAmount === null ? null : Math.max(0, amount - baselineAmount);
    const classification = !current.censusComplete || !current.collectorsComplete || current.dispatchUncertain > 0 || current.conflictedAttempts > 0
      ? 'incomplete' as const : completeInactive ? 'inactive' as const : confidence !== 'adequate'
        ? 'insufficient-evidence' as const : amount === 0 ? 'zero-metered-activity' as const : 'activity' as const;
    let next: BurnEpisodeState = previous; let notify = false; let openInvestigation = false;
    if (completeInactive) next = freeze({ ...previous, state: 'closed' as const, recoveryCount: 0 });
    else if (previous.state === 'closed') {
      if (confidence === 'adequate' && excess !== null && share !== null && excess >= policy.entryExcess && share >= policy.entryShare) {
        notify = !previous.notified; openInvestigation = previous.investigation === null;
        next = freeze({ state: 'open' as const, recoveryCount: 0, notified: true,
          investigation: previous.investigation ?? `investigation:${policy.id}:${current.id}` });
      }
    } else if (confidence === 'adequate' && excess !== null && share !== null
      && excess <= policy.recoveryExcess && share <= policy.recoveryShare) {
      const recoveryCount = previous.recoveryCount + 1;
      next = freeze({ ...previous, state: recoveryCount >= policy.recoveryWindows ? 'closed' as const : 'open' as const,
        recoveryCount: recoveryCount >= policy.recoveryWindows ? 0 : recoveryCount });
    } else next = freeze({ ...previous, recoveryCount: 0 });
    return freeze({ classification, confidence, currentAmount: amount, baselineAmount, excess, share,
      eligibleSampleCount: currentResolved.count, coverage, coverageDebt: [...new Set(debt)].sort(),
      culprit: amount !== null && currentResolved.count > 0 ? policy.feature : null, episode: next, notify, openInvestigation });
  });
}

function validateReadRow(row: MeasurementReadRow, context: BoundaryContext): void {
  ensure(row && typeof row === 'object' && Object.keys(row).length === rowFields.length && rowFields.every(field => Object.hasOwn(row, field)), 'read row has undeclared or missing field');
  for (const value of [row.identity, row.category, row.unit, row.producer, row.sourceSample, row.machine]) substantive(value, 'read metadata');
  ensure(row.amount === null || Number.isFinite(row.amount), 'read amount must be finite or unknown');
  ensure(clockOrder(row.at, row.at, context) === 0, 'read row clock invalid');
}

export function renderBoundedRead(query: MeasurementReadQuery, rows: readonly MeasurementReadRow[], timedOut: boolean,
  context: BoundaryContext): Result<MeasurementReadResult> {
  return boundary('MeasurementBoundedRead', query, context, () => {
    ensure(Object.isFrozen(query) && query.type === 'MeasurementReadQuery' && query.schemaVersion === 2, 'query must come from its decoder');
    ensure(query.pageSize <= 500 && query.maxExportBytes <= 1_048_576 && query.detailHorizonMs <= 90 * 24 * 60 * 60 * 1000,
      'query exceeds registered bound');
    ensure(rows.length <= 100_000, 'read input exceeds hard cardinality bound'); rows.forEach(row => validateReadRow(row, context));
    const available = rows.filter(row => clockOrder(query.start, row.at, context) <= 0 && clockOrder(row.at, query.end, context) < 0
      && query.evaluationClock.value - row.at.value <= query.detailHorizonMs);
    available.sort((a, b) => query.sort === 'identity' ? a.identity.localeCompare(b.identity)
      : clockOrder(a.at, b.at, context) || a.identity.localeCompare(b.identity));
    const offset = query.cursor === null ? 0 : Number(query.cursor);
    ensure(Number.isSafeInteger(offset) && offset >= 0 && offset <= available.length, 'cursor is outside result set');
    const page: MeasurementReadRow[] = []; let exportBytes = 2;
    for (const row of available.slice(offset, offset + query.pageSize)) {
      const bytes = Buffer.byteLength(encoding(row).bytes) + (page.length ? 1 : 0);
      if (exportBytes + bytes > query.maxExportBytes) break;
      page.push(freeze({ ...row })); exportBytes += bytes;
    }
    const next = offset + page.length;
    const partial = timedOut || next < available.length;
    return freeze({ query: query.id, rows: page, totalCount: available.length, nextCursor: next < available.length ? String(next) : null,
      partial, reason: timedOut ? 'timeout at pinned bounded horizon' : next < available.length ? 'page or export bound' : null,
      evaluationClock: query.evaluationClock, exportBytes });
  });
}

export function measurementProjectionDefinition(generation: ProjectionGeneration,
  bindings: Readonly<Record<string, Readonly<{ identity: string; value: string; merge: 'additive' | 'set-union' | 'max' | 'min' | 'exclusive-singleton' }>>>,
  context: BoundaryContext): Result<ProjectionDefinition> {
  return boundary('MeasurementProjectionDefinition', { generation, bindings }, context, () => {
    ensure(Object.keys(bindings).every(kind => generation.kinds.includes(kind)), 'projection binding names unregistered kind');
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
