import { canonical, decodeMeasurement } from '../../src/index.js';
import type { Clock, Json } from '../../src/index.js';
import type { MeasurementDecodeContext, ResourcePoint } from '../../src/measurement/index.js';
import { decodeMeasurementProducerContract } from '../../src/measurement/index.js';
import { fixture, value } from '../fixtures.js';

export function measurementFixture() {
  const f = fixture();
  const modelProducerInput = {
    type: 'MeasurementProducerContract', schemaVersion: 2, id: 'producer:model', family: 'model-call',
    subjectKind: 'model-token', producer: 'probe', categories: [
      { name: 'input', unit: 'tokens', relation: 'standalone' },
      { name: 'output', unit: 'tokens', relation: 'standalone' },
    ], evidencePredicate: 'usage-observed', sourceSampleRequired: true, hardwareProfileRequired: false,
  } as const;
  const eventProducerInput = {
    type: 'MeasurementProducerContract', schemaVersion: 2, id: 'producer:event', family: 'programmatic-event',
    subjectKind: 'programmatic-count', producer: 'probe',
    categories: [{ name: 'input', unit: 'tokens', relation: 'standalone' }],
    evidencePredicate: 'event-observed', sourceSampleRequired: true, hardwareProfileRequired: false,
  } as const;
  const resourceProducerInput = {
    type: 'MeasurementProducerContract', schemaVersion: 2, id: 'producer:resource', family: 'resource',
    subjectKind: 'process-resource', producer: 'probe', categories: [
      { name: 'cpu', unit: 'ms', relation: 'standalone' },
      { name: 'rss', unit: 'bytes', relation: 'standalone' },
    ], evidencePredicate: 'resource-observed', sourceSampleRequired: true, hardwareProfileRequired: true,
  } as const;
  const aggregatePolicyInput = {
    type: 'AggregateMeasurementsPolicy', schemaVersion: 2, id: 'aggregate:input', sourceKind: 'model-token',
    aggregateKind: 'measurement-window-aggregate', additiveUnits: ['tokens'], categories: ['input'],
    dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary',
  } as const;
  const burnPolicyInput = {
    type: 'BurnPolicy', schemaVersion: 2, id: 'burn:feature-a', version: 'v1', feature: 'feature-a', unit: 'tokens',
    selections: [
      { id: 'selection:model-exchange', version: 'v1', source: 'model-exchange', categories: ['input', 'output'],
        formula: 'sum', outputUnit: 'tokens', missingCategory: 'no-amount' },
      { id: 'selection:programmatic-event', version: 'v1', source: 'programmatic-event', categories: ['input'],
        formula: 'sum', outputUnit: 'tokens', missingCategory: 'no-amount' },
    ],
    minimumEligibleSamples: 1, minimumUsageCoverage: 0.7, entryExcess: 50, entryShare: 0.5,
    recoveryExcess: 10, recoveryShare: 0.2, recoveryWindows: 2,
  } as const;
  const cachePolicyInput = {
    type: 'ReadCachePolicy', schemaVersion: 2, id: 'cache:fixture', maxRows: 2,
    maxBytes: 1024, maxAgeMs: 1000, evictionBatch: 1,
  } as const;
  const processRuleInput = { className: 'agent-worker', requiredTags: ['worker'] } as const;
  const binding = (raw: unknown) => `measurement-content:${value(canonical(raw)).hash}`;
  const registeredInputs = [modelProducerInput, eventProducerInput, resourceProducerInput,
    aggregatePolicyInput, burnPolicyInput, cachePolicyInput] as const;
  const types = { ...f.ctx, register: { ...f.ctx.register,
    entries: [...f.ctx.register.entries, 'producer:model', 'producer:event', 'producer:resource',
      'usage-observed', 'event-observed', 'resource-observed', 'burn:feature-a', 'feature-a',
      'selection:model-exchange', 'selection:programmatic-event', 'aggregate:input', 'scope:ordinary',
      'cache:fixture', 'hardware:m1', 'hardware:other', 'classifier:v1', 'agent-worker',
      'feature-action-observed',
      ...registeredInputs.map(binding), binding(processRuleInput)],
    subjects: { ...f.ctx.register.subjects, 'model-token': ['tokens'], 'programmatic-count': ['tokens'],
      'process-resource': ['ms', 'bytes'], 'measurement-window-aggregate': ['tokens'] } } };
  const registeredContracts: Record<string, Json> = Object.fromEntries(
    registeredInputs.map(raw => [raw.id, binding(raw)]));
  const c: MeasurementDecodeContext = {
    site: 'types.decode', preserved: f.ctx.preserved, register: types.register, types, registeredContracts,
  };
  const producerInput = (overrides: Record<string, unknown> = {}) => ({ ...modelProducerInput, ...overrides });
  const withRegistered = (raw: Readonly<{ id: string }>, context: MeasurementDecodeContext = c): MeasurementDecodeContext => ({
    ...context,
    register: context.register.entries.includes(raw.id) ? context.register : {
      ...context.register, entries: [...context.register.entries, raw.id, binding(raw)],
    },
    types: context.register.entries.includes(raw.id) ? context.types : { ...context.types, register: {
      ...context.types.register, entries: [...context.types.register.entries, raw.id, binding(raw)],
    } },
    registeredContracts: { ...context.registeredContracts, [raw.id]: binding(raw) },
  });
  const producer = value(decodeMeasurementProducerContract(modelProducerInput, c));
  const eventProducer = value(decodeMeasurementProducerContract(eventProducerInput, c));
  const resourceProducer = value(decodeMeasurementProducerContract(resourceProducerInput, c));
  const clock = (at: number): Clock => value(decodeMeasurement('clock', f.clockRaw(at), types));
  function resourcePoint(id: string, at: number, rssBytes: number | null,
    overrides: Partial<ResourcePoint> = {}): ResourcePoint {
    return { id, machine: 'machine-a', processIncarnation: 'process:1', sourceSample: `sample:${at}`,
      at: clock(at), hardwareProfile: 'hardware:m1', classifierGeneration: 'classifier:v1', cadenceMs: 60,
      state: rssBytes === null ? 'missing' : 'observed', cpuTimeMs: rssBytes === null ? null : 50,
      monotonicIntervalMs: rssBytes === null ? null : 100, rssBytes, heapBytes: null,
      heapState: rssBytes === null ? 'missing' : 'unsupported', ...overrides };
  }
  return { ...f, types, c, registeredContracts, producerInput, modelProducerInput, eventProducerInput,
    resourceProducerInput, aggregatePolicyInput, burnPolicyInput, cachePolicyInput, withRegistered,
    processRuleInput, binding, producer, eventProducer, resourceProducer, clock, resourcePoint };
}

export type MeasurementFixture = ReturnType<typeof measurementFixture>;
