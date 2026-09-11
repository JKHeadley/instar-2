import { describe, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import {
  admitMeasurementAmount, classifyFeatureOutcome, classifyLegacyResourceObservation, classifyProcesses,
  coalesceUnknownQuotaEpisodes, compareMeasurementProducerContracts, cpuUtilization, createMeasurementLedger,
  decodeAggregateMeasurementsPolicy, decodeBurnPolicy, decodeMeasurementProducerContract,
  decodeMeasurementReadQuery, decodeReadCachePolicy, planProcessCensus, reconcileProcessIncarnation,
  renderMeasurementClaim, resourceTrend, summarizeRateLimitEvents,
} from '../../src/measurement/index.js';
import { refused, value } from '../facts/fixtures.js';
import { measurementFixture } from './fixture.js';

const a1Labels = 'P16-NF-01 P16-NF-02 P16-NF-03 P16-NF-05 P16-NF-22 P16-NF-23 P16-NF-24 '
  + 'P16-NF-25 P16-NF-26 P16-NF-27 P16-NF-28 P16-NF-29 P16-NF-30 P16-NF-52 P16-NF-53';

describe('Part 16 slice A1 foundation', () => {
  it(`${a1Labels} validates only the A1 registration and resource/process/census surface`, () => {
    const f = measurementFixture();
    const ledger = createMeasurementLedger(f.c);
    expect(ledger.owner).toBe('part-sixteen');
    expect(Object.keys(ledger).sort()).toEqual(['admitAmount', 'owner', 'trend']);
    expect(value(ledger.admitAmount({ contract: f.producer, category: 'input', amount: 100 })).amount).toBe(100);
    expect(value(ledger.trend([f.resourcePoint('a', 100, 100), f.resourcePoint('b', 160, 110)], 2)))
      .toMatchObject({ state: 'complete', rssDeltaBytes: 10 });
  });

  it('F8 burn:programmatic-route:model-call burn:programmatic-route:cumulative-model-session burn:programmatic-route:quota burn:programmatic-route:rate-limit-event burn:programmatic-route:resource burn:programmatic-route:package-cost and event-family route', () => {
    const f = measurementFixture();
    for (const family of ['model-call', 'cumulative-model-session', 'quota', 'rate-limit-event', 'resource', 'package-cost'] as const) {
      const raw = f.producerInput({ family, subjectKind: 'programmatic-count',
        categories: [{ name: 'input', unit: 'tokens', relation: 'standalone' }],
        hardwareProfileRequired: family === 'resource' });
      refused(decodeMeasurementProducerContract(raw, f.withRegistered(raw)));
    }
    expect(f.eventProducer).toMatchObject({ family: 'programmatic-event', subjectKind: 'programmatic-count' });
    expect(value(admitMeasurementAmount({ contract: f.eventProducer, category: 'input', amount: 1 }, f.c)))
      .toEqual({ family: 'programmatic-event', subjectKind: 'programmatic-count', category: 'input', unit: 'tokens', amount: 1 });
  });

  it('F9 quantity:positive-fractional-token quantity:unsafe-token-count reject while fractional duration remains valid', () => {
    const f = measurementFixture();
    refused(admitMeasurementAmount({ contract: f.producer, category: 'input', amount: 0.5 }, f.c), 'safe integer');
    refused(admitMeasurementAmount({ contract: f.producer, category: 'input', amount: Number.MAX_VALUE }, f.c), 'safe integer');
    expect(value(admitMeasurementAmount({ contract: f.producer, category: 'input', amount: 0 }, f.c)).amount).toBe(0);
    expect(value(admitMeasurementAmount({ contract: f.resourceProducer, category: 'cpu', amount: 0.5 }, f.c)).amount).toBe(0.5);
  });

  it('F10 producer:same-id-new-category binds a registered identity to its complete canonical content', () => {
    const f = measurementFixture();
    expect(value(decodeMeasurementProducerContract(f.modelProducerInput, f.c)).categories.map(row => row.name))
      .toEqual(['input', 'output']);
    refused(decodeMeasurementProducerContract(f.producerInput({
      categories: [{ name: 'fictional-token', unit: 'tokens', relation: 'standalone' }],
    }), f.c), 'current registered content');
    expect(value(admitMeasurementAmount({ contract: f.producer, category: 'output', amount: 7 }, f.c)).amount).toBe(7);
    refused(admitMeasurementAmount({ contract: f.producer, category: 'fictional-token', amount: 7 }, f.c), 'not registered');
  });

  it('F11 process:false-is-not-absence quota:malformed-prior-episodes preserve typed absence and state', () => {
    const f = measurementFixture();
    const process = { processIncarnation: 'process:1', pid: 7, startEvidence: 'start:1', tags: ['worker'] };
    expect(value(reconcileProcessIncarnation(process, null, f.c))).toBe('missing');
    expect(value(reconcileProcessIncarnation(process, process, f.c))).toBe('same');
    refused(reconcileProcessIncarnation(process, false as never, f.c), 'closed object');
    expect(value(coalesceUnknownQuotaEpisodes(['account'], ['prior'], f.c)))
      .toEqual({ notices: ['account'], open: ['account', 'prior'] });
    refused(coalesceUnknownQuotaEpisodes(['account'], [null, 42] as never, f.c), 'text array');
  });

  it('owned policy/query records migrate before compare, decode totally, bind policy content, and freeze deeply', () => {
    const f = measurementFixture();
    const aggregate = value(decodeAggregateMeasurementsPolicy(f.aggregatePolicyInput, f.c));
    const burn = value(decodeBurnPolicy(f.burnPolicyInput, f.c));
    const cache = value(decodeReadCachePolicy(f.cachePolicyInput, f.c));
    const queryRaw = { type: 'MeasurementReadQuery', schemaVersion: 2, id: 'read:a',
      start: f.clockRaw(0), end: f.clockRaw(100), evaluationClock: f.clockRaw(100), clockBasis: 'utc',
      dimensions: ['family'], pageSize: 10, cursor: null, sort: 'source-time', maxExportBytes: 4096,
      detailHorizonMs: 1000, sourceHistoryDigest: 'sha256:history', sourceProjectionDigest: 'sha256:projection',
      frontier: 'frontier:a', registerGeneration: f.types.register.generation.id };
    const query = value(decodeMeasurementReadQuery(queryRaw, f.c));
    for (const decoded of [f.producer, f.eventProducer, f.resourceProducer, aggregate, burn, cache, query]) {
      expect(Object.isFrozen(decoded)).toBe(true);
      expect(value(canonical(decoded)).bytes.length).toBeGreaterThan(10);
    }
    refused(decodeBurnPolicy({ ...f.burnPolicyInput, entryExcess: 51 }, f.c), 'current registered content');
    refused(decodeReadCachePolicy({ ...f.cachePolicyInput, maxRows: 3 }, f.c), 'current registered content');

    const current = { type: 'MeasurementProducerContract', schemaVersion: 2, id: 'producer:legacy',
      family: 'model-call', subjectKind: 'model-token', producer: 'probe',
      categories: [{ name: 'value', unit: 'tokens', relation: 'standalone' }],
      evidencePredicate: 'usage-observed', sourceSampleRequired: true, hardwareProfileRequired: false } as const;
    const context = f.withRegistered(current, { ...f.c,
      register: { ...f.c.register, entries: [...f.c.register.entries, 'producer:legacy'] },
      types: { ...f.c.types, register: { ...f.c.types.register,
        entries: [...f.c.types.register.entries, 'producer:legacy'] } } });
    const legacy = { type: 'MeasurementProducerContract', schemaVersion: 1, id: 'producer:legacy',
      family: 'model-call', subjectKind: 'model-token', producer: 'probe', unit: 'tokens',
      evidencePredicate: 'usage-observed' };
    expect(value(compareMeasurementProducerContracts(legacy, current, context))).toBe(true);
  });

  it('resource/process/census validation preserves fractions, failures, identities, bounds, and private-data exclusion', () => {
    const f = measurementFixture();
    expect(value(cpuUtilization(f.resourcePoint('cpu', 100, 1), 4, 'one-core', f.c))).toBe(50);
    expect(value(cpuUtilization(f.resourcePoint('cpu-fraction', 100, 1,
      { cpuTimeMs: 0.5, monotonicIntervalMs: 2 }), 4, 'one-core', f.c))).toBe(25);
    refused(cpuUtilization({ ...f.resourcePoint('overflow', 100, 1), cpuTimeMs: Number.MAX_VALUE,
      monotonicIntervalMs: Number.MIN_VALUE }, 1, 'one-core', f.c), 'not finite');
    expect(value(classifyLegacyResourceObservation({ id: 'legacy', source: 'origin-lost', state: 'read-failed',
      value: 0, originalNumeric: false }, f.c))).toMatchObject({ state: 'legacy-origin-lost', amount: 0 });

    const processes = [
      { processIncarnation: 'p:1', pid: 1, startEvidence: 's:1', tags: ['worker'] },
      { processIncarnation: 'p:2', pid: 2, startEvidence: 's:2', tags: [] },
    ];
    expect(value(planProcessCensus(processes, 1, f.c))).toMatchObject({ examined: 1, omitted: 1, truncated: true });
    expect(value(classifyProcesses(processes, [{ className: 'agent-worker', requiredTags: ['worker'] }], f.c)))
      .toEqual({ counts: { 'agent-worker': 1 }, unclassified: 1 });
    refused(classifyProcesses([{ ...processes[0]!, command: 'secret' }] as never, [], f.c), 'undeclared');

    const first = f.resourcePoint('r:1', 100, 100);
    const second = f.resourcePoint('r:2', 160, 110);
    expect(value(resourceTrend([first, second], 2, f.c))).toMatchObject({ state: 'complete', rssDeltaBytes: 10 });
    expect(value(resourceTrend([first, f.resourcePoint('r:3', 1000, 120)], 2, f.c))).toMatchObject({ state: 'incomplete' });
    expect(value(summarizeRateLimitEvents([
      { id: 'a', source: 'breaker', kind: 'circuit-open', at: f.clock(0) },
      { id: 'b', source: 'session-sentinel', kind: '529', at: f.clock(0) },
    ], f.clock(0), f.clock(3_600_000), f.c))).toMatchObject({ counts: { '529': 1, 'circuit-open': 1 } });
  });

  it('measurement language and feature outcome classification remain observational', () => {
    const f = measurementFixture();
    expect(value(renderMeasurementClaim({ kind: 'target', hardware: null, workload: null, evidence: [] }, f.c)))
      .toBe('target: not measured');
    refused(renderMeasurementClaim({ kind: 'recorded-execution', hardware: 'm1', workload: 'w', evidence: [] }, f.c),
      'execution evidence');
    expect(value(classifyFeatureOutcome({ kind: 'event', classifier: 'absent', actionProved: false,
      negativeProved: false, gradeOnly: false, feature: null, action: null, evaluationClock: null }, f.c))).toBe('event');
    const evidence = value(decode('Evidence', f.evidenceInput({ id: 'execution:a', claim: {
      subject: 'run:a', predicate: 'execution-observed', value: { hardware: 'm1', workload: 'workload:a' },
    } }), f.types));
    const context = { ...f.c, types: { ...f.types, evidence: [...(f.types.evidence ?? []), evidence] } };
    expect(value(renderMeasurementClaim({ kind: 'recorded-execution', hardware: 'm1', workload: 'workload:a',
      evidence: ['execution:a'] }, context))).toContain('measured execution');
  });
});
