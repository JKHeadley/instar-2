import { compareMeasurements, consumeResult, decodeMeasurement, defineDecoder } from '../index.js';
import type { BoundaryContext, Clock, DecodeContext, Json, Result } from '../index.js';
import { bool, choice, encoding, ensure, finite, freeze, integer, json, list, record, take, text } from './boundary.js';
import type { AggregateMeasurementsPolicy, BurnAmountSelection, BurnPolicy, MeasurementCategory,
  MeasurementProducerContract, MeasurementReadQuery, ReadCachePolicy } from './contracts.js';

export interface MeasurementDecodeContext extends BoundaryContext {
  readonly types: DecodeContext;
}

const categoryRelations = ['standalone', 'subset-of-input', 'independent-billed'] as const;
const families = ['model-call', 'cumulative-model-session', 'quota', 'rate-limit-event', 'resource', 'package-cost'] as const;

function category(input: Json): MeasurementCategory {
  const v = record(input, ['name', 'unit', 'relation']);
  return freeze({ name: text(v.name, 'category.name'), unit: text(v.unit, 'category.unit'),
    relation: choice(v.relation, categoryRelations, 'category.relation') });
}

const producerDecoder = <C extends MeasurementDecodeContext>(preserved: string) => take(defineDecoder<MeasurementProducerContract, C>({
  name: 'MeasurementProducerContract', owner: 'part-sixteen', currentVersion: 2,
  versions: {
    1: { validate: value => ({ ok: true, value }) },
    2: { validate: value => ({ ok: true, value }) },
  },
  migrations: { 1: input => {
    const v = record(input, ['type', 'schemaVersion', 'id', 'family', 'subjectKind', 'producer', 'unit', 'evidencePredicate']);
    return { type: 'MeasurementProducerContract', schemaVersion: 2, id: v.id!, family: v.family!, subjectKind: v.subjectKind!,
      producer: v.producer!, categories: [{ name: 'value', unit: v.unit!, relation: 'standalone' }],
      evidencePredicate: v.evidencePredicate!, sourceSampleRequired: true, hardwareProfileRequired: v.family === 'resource' };
  } },
  decodeCurrent: input => {
    try {
      const v = record(input, ['type', 'schemaVersion', 'id', 'family', 'subjectKind', 'producer', 'categories',
        'evidencePredicate', 'sourceSampleRequired', 'hardwareProfileRequired']);
      const categories = list(v.categories, 'categories', 64).map(category);
      ensure(categories.length > 0 && new Set(categories.map(row => row.name)).size === categories.length, 'categories must be nonempty and unique');
      const family = choice(v.family, families, 'family');
      const decoded = freeze({ type: 'MeasurementProducerContract' as const, schemaVersion: 2 as const,
        id: text(v.id, 'id'), family, subjectKind: text(v.subjectKind, 'subjectKind'), producer: text(v.producer, 'producer'), categories,
        evidencePredicate: text(v.evidencePredicate, 'evidencePredicate'), sourceSampleRequired: bool(v.sourceSampleRequired, 'sourceSampleRequired'),
        hardwareProfileRequired: bool(v.hardwareProfileRequired, 'hardwareProfileRequired') });
      ensure(family === 'resource' || !decoded.hardwareProfileRequired, 'only resource producers may require a hardware profile');
      return { ok: true, value: decoded as unknown as MeasurementProducerContract };
    } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'producer contract refused' }; }
  },
}, preserved));

export function decodeMeasurementProducerContract(input: unknown, context: MeasurementDecodeContext): Result<MeasurementProducerContract> {
  return producerDecoder<MeasurementDecodeContext>(context.preserved).decode(input, context);
}

export function compareMeasurementProducerContracts(left: unknown, right: unknown, context: MeasurementDecodeContext): Result<boolean> {
  return boundaryResult('MeasurementProducerContractComparison', context, () => {
    const a = take(decodeMeasurementProducerContract(left, context));
    const b = take(decodeMeasurementProducerContract(right, context));
    return encoding(a).bytes === encoding(b).bytes;
  });
}

function selection(input: Json): BurnAmountSelection {
  const v = record(input, ['id', 'version', 'source', 'categories', 'formula', 'outputUnit', 'missingCategory']);
  const categories = list(v.categories, 'selection.categories', 2).map(value => choice(value, ['input', 'output'] as const, 'selection.category'));
  ensure(categories.length > 0 && new Set(categories).size === categories.length, 'selection categories must be unique and nonempty');
  return freeze({ id: text(v.id, 'selection.id'), version: text(v.version, 'selection.version'),
    source: choice(v.source, ['model-exchange', 'programmatic-event'] as const, 'selection.source'), categories,
    formula: choice(v.formula, ['sum'] as const, 'selection.formula'), outputUnit: text(v.outputUnit, 'selection.outputUnit'),
    missingCategory: choice(v.missingCategory, ['no-amount'] as const, 'selection.missingCategory') });
}

const burnDecoder = <C extends MeasurementDecodeContext>(preserved: string) => take(defineDecoder<BurnPolicy, C>({
  name: 'BurnPolicy', owner: 'part-sixteen', currentVersion: 2,
  versions: { 1: { validate: value => ({ ok: true, value }) }, 2: { validate: value => ({ ok: true, value }) } },
  migrations: { 1: input => {
    const v = record(input, ['type', 'schemaVersion', 'id', 'version', 'feature', 'unit', 'selection', 'minimumSamples',
      'minimumUsageCoverage', 'entryExcess', 'entryShare', 'recoveryExcess', 'recoveryShare', 'recoveryWindows']);
    return { type: 'BurnPolicy', schemaVersion: 2, id: v.id!, version: v.version!, feature: v.feature!, unit: v.unit!, selections: [v.selection!],
      minimumEligibleSamples: v.minimumSamples!, minimumUsageCoverage: v.minimumUsageCoverage!, entryExcess: v.entryExcess!, entryShare: v.entryShare!,
      recoveryExcess: v.recoveryExcess!, recoveryShare: v.recoveryShare!, recoveryWindows: v.recoveryWindows! };
  } },
  decodeCurrent: input => {
    try {
      const v = record(input, ['type', 'schemaVersion', 'id', 'version', 'feature', 'unit', 'selections', 'minimumEligibleSamples',
        'minimumUsageCoverage', 'entryExcess', 'entryShare', 'recoveryExcess', 'recoveryShare', 'recoveryWindows']);
      const selections = list(v.selections, 'selections', 2).map(selection);
      ensure(selections.length === 2 && new Set(selections.map(row => row.source)).size === 2, 'exactly one amount selection per activity source required');
      const unit = text(v.unit, 'unit');
      ensure(selections.every(row => row.outputUnit === unit), 'selection output unit differs from policy unit');
      const decoded = freeze({ type: 'BurnPolicy' as const, schemaVersion: 2 as const, id: text(v.id, 'id'), version: text(v.version, 'version'),
        feature: text(v.feature, 'feature'), unit, selections, minimumEligibleSamples: integer(v.minimumEligibleSamples, 'minimumEligibleSamples', 1),
        minimumUsageCoverage: finite(v.minimumUsageCoverage, 'minimumUsageCoverage', 0, 1), entryExcess: finite(v.entryExcess, 'entryExcess'),
        entryShare: finite(v.entryShare, 'entryShare', 0, 1), recoveryExcess: finite(v.recoveryExcess, 'recoveryExcess'),
        recoveryShare: finite(v.recoveryShare, 'recoveryShare', 0, 1), recoveryWindows: integer(v.recoveryWindows, 'recoveryWindows', 1) });
      ensure(decoded.recoveryExcess <= decoded.entryExcess && decoded.recoveryShare <= decoded.entryShare, 'recovery thresholds must not exceed entry thresholds');
      return { ok: true, value: decoded as unknown as BurnPolicy };
    } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'burn policy refused' }; }
  },
}, preserved));

export function decodeBurnPolicy(input: unknown, context: MeasurementDecodeContext): Result<BurnPolicy> {
  return burnDecoder<MeasurementDecodeContext>(context.preserved).decode(input, context);
}

export function compareBurnPolicies(left: unknown, right: unknown, context: MeasurementDecodeContext): Result<boolean> {
  return boundaryResult('BurnPolicyComparison', context, () => {
    const a = take(decodeBurnPolicy(left, context));
    const b = take(decodeBurnPolicy(right, context));
    return encoding(a).bytes === encoding(b).bytes;
  });
}

function boundaryResult<T>(name: string, context: BoundaryContext, run: () => T): Result<T> {
  const decoder = take(defineDecoder<T, BoundaryContext>({ name, owner: 'part-sixteen', currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
    decodeCurrent: () => { try { return { ok: true, value: run() }; } catch (error) { return { ok: false, detail: error instanceof Error ? error.message : `${name} refused` }; } },
  }, context.preserved));
  return decoder.decode({ type: name, schemaVersion: 1 }, context);
}

export function decodeAggregateMeasurementsPolicy(input: unknown, context: MeasurementDecodeContext): Result<AggregateMeasurementsPolicy> {
  return boundaryResult('AggregateMeasurementsPolicyDecode', context, () => {
    const v = record(json(input), ['type', 'schemaVersion', 'id', 'sourceKind', 'aggregateKind', 'additiveUnits', 'categories', 'dimensions', 'producer', 'scope']);
    ensure(v.type === 'AggregateMeasurementsPolicy' && v.schemaVersion === 2 && v.aggregateKind === 'measurement-window-aggregate', 'aggregate policy identity/version');
    const additiveUnits = list(v.additiveUnits, 'additiveUnits', 32).map(value => text(value, 'additiveUnit'));
    const categories = list(v.categories, 'categories', 64).map(value => text(value, 'category'));
    const dimensions = list(v.dimensions, 'dimensions', 16).map(value => text(value, 'dimension'));
    ensure(additiveUnits.length > 0 && categories.length > 0 && dimensions.length > 0 && new Set(additiveUnits).size === additiveUnits.length
      && new Set(categories).size === categories.length && new Set(dimensions).size === dimensions.length, 'aggregate policy sets must be unique and nonempty');
    return freeze({ type: 'AggregateMeasurementsPolicy' as const, schemaVersion: 2 as const, id: text(v.id, 'id'), sourceKind: text(v.sourceKind, 'sourceKind'),
      aggregateKind: 'measurement-window-aggregate' as const, additiveUnits, categories, dimensions,
      producer: text(v.producer, 'producer'), scope: text(v.scope, 'scope') }) as unknown as AggregateMeasurementsPolicy;
  });
}

export function decodeMeasurementReadQuery(input: unknown, context: MeasurementDecodeContext): Result<MeasurementReadQuery> {
  return boundaryResult('MeasurementReadQueryDecode', context, () => {
    const v = record(json(input), ['type', 'schemaVersion', 'id', 'start', 'end', 'evaluationClock', 'clockBasis', 'dimensions', 'pageSize', 'cursor', 'sort', 'maxExportBytes', 'detailHorizonMs']);
    ensure(v.type === 'MeasurementReadQuery' && v.schemaVersion === 2, 'read query identity/version');
    const start = take(decodeMeasurement('clock', v.start, context.types));
    const end = take(decodeMeasurement('clock', v.end, context.types));
    const evaluationClock = take(decodeMeasurement('clock', v.evaluationClock, context.types));
    ensure(take(compareMeasurements(start, end, context.preserved)) < 0, 'read window must be increasing and comparable');
    ensure(take(compareMeasurements(end, evaluationClock, context.preserved)) <= 0, 'evaluation clock precedes read window');
    const dimensions = list(v.dimensions, 'dimensions', 5).map(value => choice(value, ['family', 'category', 'feature', 'model', 'machine'] as const, 'dimension'));
    ensure(new Set(dimensions).size === dimensions.length, 'dimensions contain duplicates');
    ensure(v.cursor === null || typeof v.cursor === 'string', 'cursor must be null or text');
    return freeze({ type: 'MeasurementReadQuery' as const, schemaVersion: 2 as const, id: text(v.id, 'id'), start, end, evaluationClock,
      clockBasis: choice(v.clockBasis, ['utc'] as const, 'clockBasis'), dimensions, pageSize: integer(v.pageSize, 'pageSize', 1),
      cursor: v.cursor as string | null, sort: choice(v.sort, ['source-time', 'identity'] as const, 'sort'), maxExportBytes: integer(v.maxExportBytes, 'maxExportBytes', 1),
      detailHorizonMs: integer(v.detailHorizonMs, 'detailHorizonMs', 1) }) as unknown as MeasurementReadQuery;
  });
}

export function decodeReadCachePolicy(input: unknown, context: MeasurementDecodeContext): Result<ReadCachePolicy> {
  return boundaryResult('ReadCachePolicyDecode', context, () => {
    const v = record(json(input), ['type', 'schemaVersion', 'id', 'maxRows', 'maxBytes', 'maxAgeMs', 'evictionBatch']);
    ensure(v.type === 'ReadCachePolicy' && v.schemaVersion === 2, 'cache policy identity/version');
    const policy = freeze({ type: 'ReadCachePolicy' as const, schemaVersion: 2 as const, id: text(v.id, 'id'), maxRows: integer(v.maxRows, 'maxRows', 1),
      maxBytes: integer(v.maxBytes, 'maxBytes', 1), maxAgeMs: integer(v.maxAgeMs, 'maxAgeMs', 1), evictionBatch: integer(v.evictionBatch, 'evictionBatch', 1) });
    ensure(policy.evictionBatch <= policy.maxRows, 'eviction batch exceeds row bound');
    return policy as ReadCachePolicy;
  });
}
