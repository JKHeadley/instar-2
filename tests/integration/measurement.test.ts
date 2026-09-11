import { describe, expect, it } from 'vitest';
import {
  classifyFeatureOutcome,
  classifyProcesses,
  coalesceUnknownQuotaEpisodes,
  createMeasurementLedger,
  decodeAggregateMeasurementsPolicy,
  decodeReadCachePolicy,
  createBoundedReadCache,
  growthInvestigationLink,
  planProcessCensus,
  renderMeasurementClaim,
} from '../../src/measurement/index.js';
import { decodeAssemblyRecord } from '../../src/assembly/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { factsFixture, value } from '../facts/fixtures.js';
import { measurementFixture } from '../measurement/fixture.js';
import { judgmentFixture } from '../judgment/fixture.js';

describe('Part 16 public-port integration', () => {
  it('P16-NF-01 P16-NF-02 P16-NF-25 P16-NF-26 P16-NF-27 P16-NF-28 P16-NF-29 composes decoded P1 quantities through the bounded observational port', () => {
    const f = measurementFixture();
    const port = createMeasurementLedger(f.c);
    const first = value(port.resolveQuantity([f.witness('input', 40, { subject: 'exchange:1', sourceEvent: 'event:1' })]));
    const second = value(port.resolveQuantity([f.witness('input', 60, { subject: 'exchange:2', sourceEvent: 'event:2' })]));
    const policy = value(decodeAggregateMeasurementsPolicy({
      type: 'AggregateMeasurementsPolicy', schemaVersion: 2, id: 'aggregate:input', sourceKind: 'model-token',
      aggregateKind: 'measurement-window-aggregate', additiveUnits: ['tokens'], categories: ['input'],
      dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary',
    }, f.c));
    const aggregate = value(port.aggregate({ policy, quantities: [first, second], unit: 'tokens', category: 'input', dimensions: ['feature'],
      producer: 'probe', scope: 'scope:ordinary', start: f.clock(0), end: f.clock(200), evaluationClock: f.clock(200), frontier: 'frontier:1' }));
    expect(aggregate.amount).toBe(100);
    expect(aggregate.measurement.subject.kind).toBe('measurement-window-aggregate');
    expect(aggregate.members).toHaveLength(2);
    expect(Object.isFrozen(aggregate)).toBe(true);
    expect(value(port.trend([f.resourcePoint('one', 100, 100), f.resourcePoint('two', 160, 110)], 2))).toMatchObject({ state: 'complete', rssDeltaBytes: 10 });
    const processes = [
      { processIncarnation: 'process:1', pid: 7, startEvidence: 'start:1', tags: ['agent'] },
      { processIncarnation: 'process:2', pid: 8, startEvidence: 'start:2', tags: ['other'] },
    ];
    expect(value(planProcessCensus(processes, 1, f.c))).toMatchObject({ examined: 1, omitted: 1, truncated: true });
    expect(value(classifyProcesses(processes, [{ className: 'agent-worker', requiredTags: ['agent'] }], f.c)))
      .toEqual({ counts: { 'agent-worker': 1 }, unclassified: 1 });
  });

  it('P16-NF-05 P16-NF-12 P16-NF-13 P16-NF-22 P16-NF-23 P16-NF-30 resolves owner-issued attribution while reports, quota, and feature summaries remain advisory', async () => {
    const owner = judgmentFixture();
    value(await owner.door.judge(owner.input, owner.start()));
    const snapshot = value(owner.store.readForProjection());
    const mf = measurementFixture();
    const port = createMeasurementLedger({ ...mf.c, register: owner.ctx.decode.register, types: owner.ctx.decode });
    expect(value(port.attribute({ attempt: `attempt:${owner.input.id}:1`, claimed: { feature: 'forged', model: 'forged', machine: 'forged' },
      evaluationClock: owner.now, sourceHistory: snapshot, candidates: [] })))
      .toMatchObject({ state: 'attributed', feature: 'judgment', model: 'model', machine: 'machine-a' });
    expect(value(coalesceUnknownQuotaEpisodes(['quota:a'], [], mf.c))).toEqual({ notices: ['quota:a'], open: ['quota:a'] });
    expect(value(classifyFeatureOutcome({ kind: 'exchange', classifier: 'absent', actionProved: false, negativeProved: false, gradeOnly: false,
      feature: 'feature-a', action: 'feature-action-observed', evaluationClock: mf.now }, mf.c))).toBe('unclassified');
    expect(value(renderMeasurementClaim({ kind: 'target', hardware: 'M1', workload: 'corpus', evidence: [] }, mf.c))).toBe('target: not measured');
    expect(Object.keys(port).join(' ')).not.toMatch(/allow|place|throttle|freeze|invoke/i);
  });

  it('P16-NF-33 P16-NF-34 P16-NF-39 P16-NF-40 P16-NF-41 P16-NF-46 P16-NF-47 P16-NF-48 P16-NF-52 applies burn hysteresis and keeps bounded reads/cache separate from the signed source', () => {
    const f = measurementFixture(); const port = createMeasurementLedger(f.c);
    const high = f.burnWindow('high', [f.burnSample('exchange:high', 100, 20)], { comparisonScopeAmount: 200 });
    const baseline = f.burnWindow('baseline', [f.burnSample('exchange:baseline', 20, 0)]);
    expect(value(port.evaluateBurn(f.burnPolicy, f.closed, high, [baseline]))).toMatchObject({ notify: true, openInvestigation: true, culprit: 'feature-a' });
    const rows = [f.readRow('start', 0), f.readRow('middle', 100), f.readRow('end', 200)];
    expect(value(port.read(f.query, rows))).toMatchObject({ totalCount: 2, nextCursor: null, partial: false });
    const cachePolicy = value(decodeReadCachePolicy({ type: 'ReadCachePolicy', schemaVersion: 2, id: 'cache:integration',
      maxRows: 1, maxBytes: 100, maxAgeMs: 20, evictionBatch: 1 }, f.c));
    const cache = value(createBoundedReadCache(cachePolicy, f.c));
    value(cache.put({ key: 'read:one', createdAt: f.clock(100), bytes: 'row', byteLength: 3 }));
    expect(value(cache.get('read:one'))?.bytes).toBe('row');
    expect(value(cache.planEviction(f.clock(121)))).toEqual(['read:one']);
    expect(value(cache.inspect())).toHaveLength(1);
    const ff = factsFixture();
    const growthPolicy = value(decodeAssemblyRecord('GrowthPolicy', assemblyInput('GrowthPolicy'), ff.c));
    const observation = value(decodeAssemblyRecord('GrowthObservation', { ...assemblyInput('GrowthObservation'),
      comparisons: [{ subject: 'genesis-replay-duration', kind: 'measured', value: 15, threshold: 10, result: 'soft-breach' }] }, ff.c));
    expect(value(growthInvestigationLink(growthPolicy, [observation, observation], f.c))?.observations).toEqual([observation.id]);
    expect(Object.keys(port).sort()).toEqual(['aggregate', 'attribute', 'bindReadSource', 'evaluateBurn', 'owner', 'read', 'readCurrent', 'resolveQuantity', 'trend']);
  });
});
