import { describe, expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import {
  classifyFeatureOutcome, classifyProcesses, coalesceUnknownQuotaEpisodes, compareBurnPolicies,
  compareMeasurementProducerContracts, cpuUtilization, createBoundedReadCache, createMeasurementLedger,
  decodeAggregateMeasurementsPolicy, decodeBurnPolicy, decodeMeasurementProducerContract, decodeMeasurementReadQuery, decodeReadCachePolicy,
  evaluateBurn, growthInvestigationLink, measurementProjectionDefinition, planProcessCensus,
  reconcileProcessIncarnation, renderMeasurementClaim, resolveAttribution, resolveQuantity, resourceTrend,
} from '../../src/measurement/index.js';
import { closureReleasedPins, routineAgeRemovalAllowed } from '../../src/verification/index.js';
import { decodeAssemblyRecord } from '../../src/assembly/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
import { measurementFixture } from './fixture.js';
import { judgmentFixture } from '../judgment/fixture.js';

describe('Part 16 foundation records and observational boundaries', () => {
  it('P16-NF-01 P16-NF-02 construction is closed, immutable, version-migrated, canonical, and exports no authority decision', () => {
    const f = measurementFixture();
    const current = value(decodeMeasurementProducerContract(f.producerInput(), f.c));
    expect(Object.isFrozen(current)).toBe(true);
    const legacy = { type: 'MeasurementProducerContract', schemaVersion: 1, id: 'producer:model', family: 'model-call',
      subjectKind: 'model-token', producer: 'probe', unit: 'tokens', evidencePredicate: 'usage-observed' };
    expect(value(compareMeasurementProducerContracts(legacy, {
      ...f.producerInput(), categories: [{ name: 'value', unit: 'tokens', relation: 'standalone' }],
    }, f.c))).toBe(true);
    refused(decodeMeasurementProducerContract({ ...f.producerInput(), allow: true }, f.c), 'undeclared');
    const port = createMeasurementLedger(f.c);
    expect(Object.keys(port).sort()).toEqual(['aggregate', 'attribute', 'evaluateBurn', 'owner', 'read', 'resolveQuantity', 'trend']);
    expect(JSON.stringify(port)).not.toMatch(/canRun|place|throttle|allow|retry|freeze|effect|standing/i);
  });

  it('P16-NF-05 only named recorded execution is rendered as measured', () => {
    const f = measurementFixture();
    const execution = value(decode('Evidence', f.evidenceInput({ id: 'execution:1', observedAt: f.now,
      claim: { subject: 'execution:1', predicate: 'execution-observed', value: { hardware: 'M1 Max', workload: 'release-corpus-v1' } } }), f.types));
    f.evidence.push(execution);
    expect(value(renderMeasurementClaim({ kind: 'recorded-execution', hardware: 'M1 Max', workload: 'release-corpus-v1', evidence: [execution.id] }, f.c)))
      .toContain('measured execution');
    expect(value(renderMeasurementClaim({ kind: 'estimate', hardware: 'M1 Max', workload: 'release-corpus-v1', evidence: [] }, f.c)))
      .toBe('estimate: not measured');
    refused(renderMeasurementClaim({ kind: 'recorded-execution', hardware: null, workload: 'release-corpus-v1', evidence: ['run:1'] }, f.c), 'named hardware');
  });

  it('P16-NF-12 P16-NF-13 attribution joins the current Part Seven request, attempt, and decision', async () => {
    const owner = judgmentFixture();
    value(await owner.door.judge(owner.input, owner.start()));
    const snapshot = value(owner.store.readForProjection());
    const mf = measurementFixture();
    const context = { ...mf.c, register: owner.ctx.decode.register, types: owner.ctx.decode };
    const attempt = `attempt:${owner.input.id}:1`;
    const result = value(resolveAttribution({ attempt, claimed: { feature: 'forged', model: 'forged', machine: 'forged' },
      evaluationClock: owner.now, sourceHistory: snapshot, candidates: [] }, context));
    expect(result).toMatchObject({ state: 'attributed', feature: 'judgment', model: 'model', machine: 'machine-a', run: owner.input.run.id });
    expect(value(resolveAttribution({ attempt: 'attempt:missing', claimed: { feature: 'forged', model: 'forged', machine: 'forged' },
      evaluationClock: owner.now, sourceHistory: snapshot, candidates: [] }, context))).toMatchObject({ state: 'unattributed', feature: null });
  });

  it('P16-NF-22 P16-NF-23 quota unknown stays unknown, coalesces, and exposes no scheduling operation', () => {
    const f = measurementFixture();
    expect(value(coalesceUnknownQuotaEpisodes(['account:a:window:1', 'account:a:window:1'], [], f.c))).toEqual({ notices: ['account:a:window:1'], open: ['account:a:window:1'] });
    expect(value(coalesceUnknownQuotaEpisodes(['account:a:window:1'], ['account:a:window:1'], f.c)).notices).toEqual([]);
    expect(Object.keys(createMeasurementLedger(f.c)).join(' ')).not.toMatch(/allow|place|throttle|canRun/i);
  });

  it('P16-NF-25 P16-NF-26 P16-NF-27 P16-NF-28 resource arithmetic keeps failures, incarnations, bounds, and privacy distinct', () => {
    const f = measurementFixture(); const point = f.resourcePoint('p1', 100, 100 * 1024 * 1024);
    expect(value(cpuUtilization(point, 4, 'one-core', f.c))).toBe(50);
    expect(value(cpuUtilization(point, 4, 'whole-machine', f.c))).toBe(12.5);
    expect(value(cpuUtilization(f.resourcePoint('missing', 100, null), 4, 'one-core', f.c))).toBeNull();
    const old = { processIncarnation: 'process:old', pid: 7, startEvidence: 'start:old', tags: ['agent'] };
    expect(value(reconcileProcessIncarnation(old, { ...old, processIncarnation: 'process:new', startEvidence: 'start:new' }, f.c))).toBe('new-incarnation');
    expect(value(reconcileProcessIncarnation(old, null, f.c))).toBe('missing');
    const processes = [old, { processIncarnation: 'process:2', pid: 8, startEvidence: 'start:2', tags: ['unknown'] }];
    expect(value(planProcessCensus(processes, 1, f.c))).toMatchObject({ examined: 1, omitted: 1, truncated: true });
    expect(value(classifyProcesses(processes, [{ className: 'agent-worker', requiredTags: ['agent'] }], f.c)))
      .toEqual({ counts: { 'agent-worker': 1 }, unclassified: 1 });
    expect(JSON.stringify(value(classifyProcesses(processes, [{ className: 'agent-worker', requiredTags: ['agent'] }], f.c))))
      .not.toMatch(/command|environment/i);
  });

  it('P16-NF-29 resource trends keep distinct sample times and reject gaps or basis changes', () => {
    const f = measurementFixture(); const first = f.resourcePoint('p1', 100, 100 * 1024 * 1024); const second = f.resourcePoint('p2', 160, 110 * 1024 * 1024);
    expect(value(resourceTrend([second, first], 2, f.c))).toMatchObject({ state: 'complete', rssDeltaBytes: 10 * 1024 * 1024 });
    expect(value(resourceTrend([first, { ...second, state: 'missing', rssBytes: null }], 2, f.c))).toMatchObject({ state: 'incomplete', rssDeltaBytes: null });
    expect(value(resourceTrend([first, { ...second, hardwareProfile: 'hardware:other' }], 2, f.c)).reasons).toContain('hardware changed');
    const equalA = f.witness('input', 100, { sourceEvent: 'witness:a' }); const equalB = f.witness('input', 100, { sourceEvent: 'witness:b' });
    expect(value(resolveQuantity([equalA, equalB], undefined, f.c))).toMatchObject({ amount: 100, state: 'resolved' });
    const disagree = f.witness('input', 110, { sourceEvent: 'witness:c' });
    expect(value(resolveQuantity([equalA, disagree], undefined, f.c))).toMatchObject({ amount: null, state: 'unresolved' });
  });

  it('P16-NF-30 feature outcomes keep calls, shed, failures, events, and unclassified evidence distinct', () => {
    const f = measurementFixture();
    const fired = value(decode('Evidence', f.evidenceInput({ id: 'action:fired', observedAt: f.now,
      claim: { subject: 'feature-a', predicate: 'feature-action-observed', value: 'fired' } }), f.types));
    const noOp = value(decode('Evidence', f.evidenceInput({ id: 'action:no-op', observedAt: f.now,
      claim: { subject: 'feature-a', predicate: 'feature-action-observed', value: 'no-op' } }), f.types));
    f.evidence.push(fired, noOp);
    expect(value(classifyFeatureOutcome({ kind: 'exchange', classifier: 'complete', actionProved: true, negativeProved: false, gradeOnly: false, evidence: fired }, f.c))).toBe('fired');
    expect(value(classifyFeatureOutcome({ kind: 'exchange', classifier: 'complete', actionProved: false, negativeProved: true, gradeOnly: false, evidence: noOp }, f.c))).toBe('no-op');
    expect(value(classifyFeatureOutcome({ kind: 'exchange', classifier: 'absent', actionProved: false, negativeProved: false, gradeOnly: false }, f.c))).toBe('unclassified');
    expect(value(classifyFeatureOutcome({ kind: 'exchange', classifier: 'complete', actionProved: true, negativeProved: false, gradeOnly: true }, f.c))).toBe('unclassified');
    for (const kind of ['shed', 'error', 'parser-failure', 'event'] as const)
      expect(value(classifyFeatureOutcome({ kind, classifier: 'complete', actionProved: false, negativeProved: false, gradeOnly: false }, f.c))).toBe(kind);
  });

  it('P16-NF-33 P16-NF-34 burn selection counts one exchange once, applies coverage boundaries, and never blames absent instrumentation', () => {
    const f = measurementFixture();
    const sample = f.burnSample('exchange:one', 100, 20); const baseline = f.burnWindow('baseline', [f.burnSample('exchange:baseline', 20, 0)]);
    const opened = value(evaluateBurn(f.burnPolicy, f.closed, f.burnWindow('current', [sample, sample], { comparisonScopeAmount: 200,
      observedExchanges: 1, usageSupportedExchanges: 1 }), [baseline], f.c));
    expect(opened).toMatchObject({ currentAmount: 120, eligibleSampleCount: 1, baselineAmount: 20, excess: 100, share: 0.6, notify: true, openInvestigation: true });
    const replay = value(evaluateBurn(f.burnPolicy, opened.episode, f.burnWindow('current', [sample], { comparisonScopeAmount: 200 }), [baseline], f.c));
    expect(replay).toMatchObject({ notify: false, openInvestigation: false });
    const incomplete = value(evaluateBurn(f.burnPolicy, { ...opened.episode, recoveryCount: 1 }, f.burnWindow('gap', [], {
      censusComplete: false, collectorsComplete: false, observedExchanges: 0, usageSupportedExchanges: 0, attemptedDispatches: 1,
      dispatchUncertain: 1, comparisonScopeAmount: 0 }), [baseline], f.c));
    expect(incomplete).toMatchObject({ classification: 'incomplete', culprit: null, episode: { state: 'open', recoveryCount: 0 } });
    expect(incomplete.coverageDebt).toContain('census-incomplete');
    const legacy = { ...f.burnPolicyInput(), schemaVersion: 1, selection: f.selection('model-exchange', ['input', 'output']), minimumSamples: 1 } as Record<string, unknown>;
    delete legacy.selections; delete legacy.minimumEligibleSamples;
    expect(value(decodeBurnPolicy(legacy, f.c)).selections).toHaveLength(1);
    expect(value(compareBurnPolicies(f.burnPolicyInput(), f.burnPolicyInput(), f.c))).toBe(true);
  });

  it('P16-NF-39 P16-NF-40 P16-NF-41 retention stays on the signed spine while disposable cache work is bounded and separate', () => {
    const f = measurementFixture();
    const generation = { reference: f.types.register.generation, kinds: ['note'], lineages: {} };
    expect(value(measurementProjectionDefinition(generation, { note: { identity: 'identity', value: 'amount', merge: 'additive' } }, f.c)))
      .toMatchObject({ retention: 'all-identities', id: 'measurement.source.all-identities' });
    expect(routineAgeRemovalAllowed()).toBe(false);
    expect(closureReleasedPins({ type: 'AssessmentClosure', schemaVersion: 1, id: 'closure:1', caseId: 'case:1', predecessor: '',
      requiredAssessments: [], dispositions: [], activeDisputes: [], releasesPin: 'assessment-pin:case:1' } as never)).toEqual([]);
    const policy = value(decodeReadCachePolicy({ type: 'ReadCachePolicy', schemaVersion: 2, id: 'cache:1', maxRows: 2, maxBytes: 100,
      maxAgeMs: 20, evictionBatch: 1 }, f.c));
    const cache = createBoundedReadCache(policy, f.c); value(cache.put({ key: 'a', createdAt: f.clock(100), bytes: 'one', byteLength: 3 }));
    value(cache.put({ key: 'b', createdAt: f.clock(110), bytes: 'two', byteLength: 3 }));
    expect(value(cache.planEviction(f.clock(130)))).toEqual(['a']); expect(value(cache.applyEviction(['a']))).toBe(1);
    expect(value(cache.inspect()).map(row => row.key)).toEqual(['b']);
  });

  it('P16-NF-46 growth evidence names exactly one existing Part Five run and Part Six loop', () => {
    const f = measurementFixture(); const fc = factsFixture();
    const policy = value(decodeAssemblyRecord('GrowthPolicy', assemblyInput('GrowthPolicy'), fc.c));
    const observation = value(decodeAssemblyRecord('GrowthObservation', { ...assemblyInput('GrowthObservation'),
      comparisons: [{ subject: 'genesis-replay-duration', kind: 'measured', value: 15, threshold: 10, result: 'soft-breach' }] }, fc.c));
    const link = value(growthInvestigationLink(policy, [observation, observation], f.c));
    expect(link).toMatchObject({ run: policy.ownerRun, loop: policy.loopPolicy });
    expect(link!.observations).toEqual([observation.id]);
  });

  it('P16-NF-47 P16-NF-48 bounded read rejects private fields, keeps half-open windows, pages, cursors and timeout honesty', () => {
    const f = measurementFixture(); const port = createMeasurementLedger(f.c);
    const rows = [f.readRow('before', -1), f.readRow('start', 0), f.readRow('middle', 100), f.readRow('end', 200)];
    expect(value(port.read(f.query, rows))).toMatchObject({ totalCount: 2, nextCursor: null, partial: false });
    const pageOne = value(port.read(f.query, rows, true));
    expect(pageOne).toMatchObject({ partial: true, reason: 'timeout at pinned bounded horizon' });
    const leaked = { ...f.readRow('leak'), prompt: 'secret prompt' };
    refused(port.read(f.query, [leaked as never]), 'undeclared');
    const overbound = value(decodeMeasurementReadQuery(f.queryInput({ pageSize: 501 }), f.c));
    refused(port.read(overbound, rows), 'registered bound');
  });
});
