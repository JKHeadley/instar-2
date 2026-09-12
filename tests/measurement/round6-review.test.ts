import { describe, expect, it } from 'vitest';
import { compareMeasurements, decode, decodeMeasurement } from '../../src/index.js';
import * as measurementInternals from '../../src/measurement/decode.js';
import {
  admitMeasurementAmount, classifyFeatureOutcome, classifyProcesses, coalesceUnknownQuotaEpisodes,
  decodeMeasurementProducerContract, decodeReadCachePolicy, planProcessCensus, resourceTrend,
} from '../../src/measurement/index.js';
import { refused, value } from '../facts/fixtures.js';
import { measurementFixture } from './fixture.js';

describe('Part 16 A1 round 6 independent-review regressions', () => {
  it('finding 1 cache:missing-registered-id refuses without its current registered identity', () => {
    const f = measurementFixture();
    expect(value(decodeReadCachePolicy(f.cachePolicyInput, f.c)).id).toBe('cache:fixture');
    refused(decodeReadCachePolicy(f.cachePolicyInput, { ...f.c,
      register: { ...f.c.register, entries: f.c.register.entries.filter(id => id !== 'cache:fixture') },
    }), 'identity is not registered');
  });

  it('finding 2 sampled producer contracts require sample identity for cumulative, quota, and package cost', () => {
    const f = measurementFixture();
    for (const [family, subjectKind, unit] of [
      ['cumulative-model-session', 'cumulative-model-session', 'tokens'],
      ['quota', 'quota', 'percent'],
      ['package-cost', 'observer-run', 'ms'],
    ] as const) {
      const good = { ...f.modelProducerInput, id: `producer:${family}`, family, subjectKind,
        categories: [{ name: 'value', unit, relation: 'standalone' as const }], sourceSampleRequired: true };
      const register = { ...f.types.register,
        subjects: { ...f.types.register.subjects, [subjectKind]: [unit] } };
      const context = f.withRegistered(good, { ...f.c, register,
        types: { ...f.types, register } });
      expect(value(decodeMeasurementProducerContract(good, context)).sourceSampleRequired).toBe(true);
      refused(decodeMeasurementProducerContract({ ...good, sourceSampleRequired: false }, context),
        'source sample identity');
    }
  });

  it('P16-NF-03 [behavior:registration-current-content] P16-NF-28 [behavior:classified-and-unclassified] finding 3 registration:substitute-content-map and classifier:changed-tags-same-registered-class refuse', () => {
    const f = measurementFixture();
    const invented = { ...f.modelProducerInput,
      categories: [{ name: 'fictional-token', unit: 'tokens', relation: 'standalone' as const }] };
    const substituted = f.withRegistered(invented);
    refused(decodeMeasurementProducerContract(invented, substituted), 'content binding is not registered');
    refused(admitMeasurementAmount({ contract: f.producer, category: 'input', amount: 1 }, substituted),
      'current registered content');
    expect(value(classifyProcesses([
      { processIncarnation: 'process:1', pid: 7, startEvidence: 'start:1', tags: ['worker'] },
    ], [f.processRuleInput], f.c))).toEqual({ counts: { 'agent-worker': 1 }, unclassified: 0 });
    refused(classifyProcesses([
      { processIncarnation: 'process:1', pid: 7, startEvidence: 'start:1', tags: ['worker'] },
    ], [{ className: 'agent-worker', requiredTags: ['unregistered-tag'] }], f.c), 'content binding');
  });

  it('finding 4 malformed feature evidence and contradictory flags refuse before uncertainty classification', () => {
    const f = measurementFixture();
    const base = { kind: 'exchange' as const, classifier: 'complete' as const, actionProved: true,
      negativeProved: false, gradeOnly: false, feature: 'feature-a', action: 'feature-action-observed' as const,
      evaluationClock: f.clock(100) };
    for (const evidence of [false, 42, null, { not: 'Evidence' }])
      refused(classifyFeatureOutcome({ ...base, evidence } as never, f.c));
    refused(classifyFeatureOutcome({ ...base, classifier: 'incomplete', negativeProved: true } as never, f.c),
      'contradicts');
  });

  it('finding 5 feature:known-feature-absent-classifier stays unclassified without an action predicate', () => {
    const f = measurementFixture();
    expect(value(classifyFeatureOutcome({ kind: 'exchange', classifier: 'absent', actionProved: false,
      negativeProved: false, gradeOnly: false, feature: 'feature-a', action: null,
      evaluationClock: f.clock(100) }, f.c))).toBe('unclassified');
    expect(value(classifyFeatureOutcome({ kind: 'exchange', classifier: 'absent', actionProved: false,
      negativeProved: false, gradeOnly: false, feature: null, action: null,
      evaluationClock: null }, f.c))).toBe('unclassified');
  });

  it('P16-NF-30 [behavior:fired-and-no-op] finding 6 feature:foreign-clock-evidence refuses an incomparable evidence clock', () => {
    const f = measurementFixture();
    const evidence = value(decode('Evidence', f.evidenceInput({ id: 'action:clock', claim: {
      subject: 'feature-a', predicate: 'feature-action-observed', value: 'fired',
    } }), f.types));
    const context = { ...f.c, types: { ...f.types, evidence: [evidence] } };
    const foreign = value(decodeMeasurement('clock', f.clockRaw(100, 'machine-b'), f.types));
    refused(compareMeasurements(evidence.observedAt, foreign, f.c.preserved), 'mismatch');
    refused(classifyFeatureOutcome({ kind: 'exchange', classifier: 'complete', actionProved: true,
      negativeProved: false, gradeOnly: false, feature: 'feature-a', action: 'feature-action-observed',
      evaluationClock: foreign, evidence }, context), 'mismatch');
    expect(value(classifyFeatureOutcome({ kind: 'exchange', classifier: 'complete', actionProved: true,
      negativeProved: false, gradeOnly: false, feature: 'feature-a', action: 'feature-action-observed',
      evaluationClock: f.clock(100), evidence }, context))).toBe('fired');
    const noOp = value(decode('Evidence', f.evidenceInput({ id: 'action:no-op', claim: {
      subject: 'feature-a', predicate: 'feature-action-observed', value: 'no-op',
    } }), f.types));
    expect(value(classifyFeatureOutcome({ kind: 'exchange', classifier: 'complete', actionProved: false,
      negativeProved: true, gradeOnly: false, feature: 'feature-a', action: 'feature-action-observed',
      evaluationClock: f.clock(100), evidence: noOp }, { ...f.c,
      types: { ...f.types, evidence: [noOp] } }))).toBe('no-op');
  });

  it('P16-NF-27 [behavior:limit-plus-one-census] P16-NF-29 [behavior:resource-trend] finding 7 contradictory census and trend identities refuse while distinct neighbors pass', () => {
    const f = measurementFixture();
    const first = { processIncarnation: 'process:1', pid: 7, startEvidence: 'start:1', tags: ['worker'] };
    const second = { processIncarnation: 'process:2', pid: 8, startEvidence: 'start:2', tags: ['worker'] };
    expect(value(planProcessCensus([first, second], 2, f.c)).batch).toHaveLength(2);
    expect(value(planProcessCensus([first, second], 1, f.c)))
      .toMatchObject({ examined: 1, omitted: 1, truncated: true });
    refused(planProcessCensus([first, { ...second, pid: 7 }], 2, f.c), 'one PID');
    const p1 = f.resourcePoint('r1', 100, 100); const p2 = f.resourcePoint('r2', 160, 110);
    expect(value(resourceTrend([p1, p2], 2, f.c)).state).toBe('complete');
    refused(resourceTrend([p1, { ...p2, id: 'r1' }], 2, f.c), 'identity repeated');
  });

  it('P16-NF-22 [behavior:quota-coalescing] finding 8 quota:repeated-missing-input coalesces repeated valid observations once', () => {
    const f = measurementFixture();
    expect(value(coalesceUnknownQuotaEpisodes(['account', 'account'], [], f.c)))
      .toEqual({ notices: ['account'], open: ['account'] });
    expect(value(coalesceUnknownQuotaEpisodes(['account'], ['account', 'account'], f.c)).notices).toEqual([]);
    refused(coalesceUnknownQuotaEpisodes(['account'], [null, 42] as never, f.c), 'text array');
  });

  it('P16-NF-25 [behavior:cpu-and-byte] finding 9 resource:fractional-admitted-bytes refuses while integer bytes and fractional duration pass', () => {
    const f = measurementFixture();
    refused(admitMeasurementAmount({ contract: f.resourceProducer, category: 'rss', amount: 0.5 }, f.c),
      'safe integer');
    expect(value(admitMeasurementAmount({ contract: f.resourceProducer, category: 'rss', amount: 1 }, f.c)).amount)
      .toBe(1);
    expect(value(admitMeasurementAmount({ contract: f.resourceProducer, category: 'cpu', amount: 0.5 }, f.c)).amount)
      .toBe(0.5);
  });

  it('finding 11 retired A2 runtime validators are absent from the emitted decode module', () => {
    for (const name of ['isDecodedMeasurementReadQuery', 'isDecodedReadCachePolicy',
      'isCurrentAggregateMeasurementsPolicy', 'isCurrentMeasurementTuple', 'isCurrentBurnPolicy'])
      expect(measurementInternals).not.toHaveProperty(name);
  });
});
