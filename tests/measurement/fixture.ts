import { decode, decodeMeasurement } from '../../src/index.js';
import type { Clock, Json, Measurement } from '../../src/index.js';
import type { BurnEpisodeState, BurnPolicy, BurnSample, BurnWindow, MeasurementDecodeContext,
  MeasurementProducerContract, MeasurementReadQuery, MeasurementReadRow, QuantityWitness,
  ResourcePoint } from '../../src/measurement/index.js';
import { createQuantityWitness, decodeBurnPolicy, decodeMeasurementProducerContract,
  decodeMeasurementReadQuery, resolveQuantity } from '../../src/measurement/index.js';
import { fixture, raw, value } from '../fixtures.js';

export function measurementFixture() {
  const f = fixture();
  const types = { ...f.ctx, register: { ...f.ctx.register,
    entries: [...f.ctx.register.entries, 'producer:model', 'usage-observed', 'burn:feature-a', 'feature-a', 'model-a',
      'selection:model-exchange', 'selection:programmatic-event'],
    subjects: { ...f.ctx.register.subjects, 'model-token': ['tokens'], 'programmatic-count': ['tokens'],
      'process-resource': ['ms', 'bytes'], 'measurement-window-aggregate': ['tokens'] } } };
  const c: MeasurementDecodeContext = { site: 'types.decode', preserved: f.ctx.preserved, register: types.register, types };
  const producerInput = (overrides: Record<string, unknown> = {}) => ({
    type: 'MeasurementProducerContract', schemaVersion: 2, id: 'producer:model', family: 'model-call',
    subjectKind: 'model-token', producer: 'probe', categories: [
      { name: 'input', unit: 'tokens', relation: 'standalone' },
      { name: 'output', unit: 'tokens', relation: 'standalone' },
    ], evidencePredicate: 'usage-observed', sourceSampleRequired: true, hardwareProfileRequired: false, ...overrides,
  });
  const producer = value(decodeMeasurementProducerContract(producerInput(), c));
  let sequence = 0;
  function witness(category: 'input' | 'output', amount: number, options: Readonly<{
    subject?: string; sourceSample?: string; sourceEvent?: string; state?: QuantityWitness['state']; predecessors?: readonly string[];
  }> = {}): QuantityWitness {
    sequence++;
    const subject = options.subject ?? 'exchange:1'; const sourceEvent = options.sourceEvent ?? `usage:${sequence}`;
    const measurement = raw('Measurement', { subject: { kind: 'model-token', instance: subject }, value: amount,
      unit: 'tokens', at: f.now, by: 'probe' });
    const evidence = f.evidenceInput({ id: sourceEvent, claim: { subject, predicate: 'usage-observed', value: amount }, observedAt: f.now });
    return value(createQuantityWitness({ contract: producer, subjectInstance: subject, sourceSample: options.sourceSample ?? subject,
      category, measurement, evidence, sourceEvent, phase: 'final', predecessors: options.predecessors ?? [], state: options.state ?? 'reported',
      hardwareProfile: null }, c));
  }
  function quantity(category: 'input' | 'output', amount: number, subject = 'exchange:1') {
    return value(resolveQuantity([witness(category, amount, { subject, sourceSample: subject })], undefined, c));
  }
  const selection = (source: 'model-exchange' | 'programmatic-event', categories: readonly ('input' | 'output')[]) => ({
    id: `selection:${source}`, version: 'v1', source, categories, formula: 'sum', outputUnit: 'tokens', missingCategory: 'no-amount',
  });
  const burnPolicyInput = (overrides: Record<string, unknown> = {}) => ({
    type: 'BurnPolicy', schemaVersion: 2, id: 'burn:feature-a', version: 'v1', feature: 'feature-a', unit: 'tokens',
    selections: [selection('model-exchange', ['input', 'output']), selection('programmatic-event', ['input'])],
    minimumEligibleSamples: 1, minimumUsageCoverage: 0.7, entryExcess: 50, entryShare: 0.5,
    recoveryExcess: 10, recoveryShare: 0.2, recoveryWindows: 2, ...overrides,
  });
  const burnPolicy = value(decodeBurnPolicy(burnPolicyInput(), c));
  function burnSample(identity: string, input: number, output: number, feature = 'feature-a'): BurnSample {
    return { identity, feature, source: 'model-exchange', selectionVersion: 'v1',
      quantities: [quantity('input', input, identity), quantity('output', output, identity)] };
  }
  function burnWindow(id: string, samples: readonly BurnSample[], overrides: Partial<BurnWindow> = {}): BurnWindow {
    const uniqueSamples = [...new Map(samples.map(sample => [sample.identity, sample])).values()];
    const suppliedAmount = uniqueSamples.reduce((sum, sample) => sum + sample.quantities.reduce((n, q) => n + (q.amount ?? 0), 0), 0);
    const desiredAmount = overrides.comparisonScopeAmount ?? suppliedAmount;
    const witnessedSamples = desiredAmount > suppliedAmount
      ? [...samples, burnSample(`comparison:${id}`, desiredAmount - suppliedAmount, 0, `comparison:${id}`)] : [...samples];
    return { id, censusComplete: true, collectorsComplete: true, observedExchanges: samples.length,
      usageSupportedExchanges: samples.length, attemptedDispatches: samples.length, provenNoExchange: 0,
      dispatchUncertain: 0, conflictedAttempts: 0, programmaticEvents: 0, samples: witnessedSamples,
      comparisonScopeAmount: suppliedAmount, ...overrides };
  }
  const closed: BurnEpisodeState = { state: 'closed', recoveryCount: 0, notified: false, investigation: null };
  const clock = (at: number): Clock => value(decodeMeasurement('clock', f.clockRaw(at), types));
  const queryInput = (overrides: Record<string, unknown> = {}) => ({
    type: 'MeasurementReadQuery', schemaVersion: 2, id: 'read:1', start: f.clockRaw(0), end: f.clockRaw(200),
    evaluationClock: f.clockRaw(200), clockBasis: 'utc', dimensions: ['feature'], pageSize: 2, cursor: null,
    sort: 'source-time', maxExportBytes: 4096, detailHorizonMs: 1000, ...overrides,
  });
  const query = value(decodeMeasurementReadQuery(queryInput(), c));
  function readRow(identity: string, at = 100, overrides: Partial<MeasurementReadRow> = {}): MeasurementReadRow {
    return { identity, family: 'model-call', category: 'input', at: clock(at), amount: 10, unit: 'tokens', state: 'reported',
      producer: 'probe', sourceSample: identity, feature: 'feature-a', model: 'model-a', machine: 'machine-a', ...overrides };
  }
  function resourcePoint(id: string, at: number, rssBytes: number | null, overrides: Partial<ResourcePoint> = {}): ResourcePoint {
    return { id, machine: 'machine-a', processIncarnation: 'process:1', sourceSample: `sample:${at}`, at: clock(at),
      hardwareProfile: 'hardware:m1', classifierGeneration: 'classifier:v1', state: rssBytes === null ? 'missing' : 'observed',
      cpuTimeMs: rssBytes === null ? null : 50, monotonicIntervalMs: rssBytes === null ? null : 100,
      rssBytes, heapBytes: null, heapState: 'unsupported', ...overrides };
  }
  return { ...f, types, c, producerInput, producer, witness, quantity, selection, burnPolicyInput, burnPolicy,
    burnSample, burnWindow, closed, clock, queryInput, query, readRow, resourcePoint };
}

export type MeasurementFixture = ReturnType<typeof measurementFixture>;
