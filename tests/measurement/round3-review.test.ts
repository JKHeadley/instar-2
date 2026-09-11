import { describe, expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import {
  aggregateMeasurements, classifyFeatureOutcome, classifyLegacyResourceObservation, classifyProcesses,
  cpuUtilization, createBoundedReadCache, createQuantityWitness, decodeAggregateMeasurementsPolicy,
  decodeBurnPolicy, decodeMeasurementProducerContract, decodeReadCachePolicy, evaluateBurn, mergePeerMeasurements,
  planProcessCensus, renderBoundedRead, resolveAttribution, resolveQuantity, resourceTrend,
  summarizeRateLimitEvents,
} from '../../src/measurement/index.js';
import { judgmentFixture } from '../judgment/fixture.js';
import { refused, value } from '../facts/fixtures.js';
import { measurementFixture } from './fixture.js';

describe('Part 16 round-three independent review regressions', () => {
  it('R3-F01 requires currently registered aggregate policy, scope, and producer contracts', () => {
    const f = measurementFixture();
    refused(decodeAggregateMeasurementsPolicy({ type: 'AggregateMeasurementsPolicy', schemaVersion: 2,
      id: 'NEVER-REGISTERED', sourceKind: 'model-token', aggregateKind: 'measurement-window-aggregate',
      additiveUnits: ['tokens'], categories: ['input'], dimensions: ['feature'], producer: 'probe',
      scope: 'UNAUTHORIZED-POOL' }, f.c), 'registered');
    const witness = f.witness('input', 100);
    const register = { ...f.types.register, generation: { ...f.types.register.generation, id: 'generation:2' },
      entries: f.types.register.entries.filter(id => id !== 'producer:model') };
    refused(createQuantityWitness({ contract: f.producer, subjectInstance: 'exchange:1', sourceSample: 'exchange:1',
      category: 'input', measurement: witness.measurement, evidence: witness.evidence, sourceEvent: witness.sourceEvent,
      phase: 'final', predecessors: [], state: 'reported', hardwareProfile: null },
    { ...f.c, register, types: { ...f.types, register } }), 'currently registered');
  });

  it('R3-F02 closes witness input and binds model samples to the observed exchange', () => {
    const f = measurementFixture(); const witness = f.witness('input', 100, { sourceEvent: 'qa' });
    const input = { contract: f.producer, subjectInstance: 'exchange:1', sourceSample: 'exchange:1', category: 'input',
      measurement: witness.measurement, evidence: witness.evidence, sourceEvent: witness.sourceEvent,
      phase: 'final' as const, predecessors: [], state: 'reported' as const, hardwareProfile: null };
    refused(createQuantityWitness({ ...input, sourceSample: 'invented-second-sample' }, f.c), 'canonical event identity');
    refused(createQuantityWitness({ ...input, extra: true } as never, f.c), 'undeclared');
    refused(createQuantityWitness({ ...input, hardwareProfile: 4 } as never, f.c), 'hardware');
  });

  it('R3-F03 refuses caller-created owner resolution and canonicalizes equal witness permutations', () => {
    const f = measurementFixture(); const a = f.witness('input', 100, { sourceEvent: 'qa' });
    const b = f.witness('input', 110, { sourceEvent: 'qb' });
    const evidence = { type: 'Evidence', schemaVersion: 1, id: 'never-admitted-resolution',
      claim: { subject: a.key, predicate: 'quantity-resolved', value: { amount: 105, witnesses: ['qa', 'qb'] } },
      source: 'unregistered-foreign-owner', observedAt: f.clock(0), freshFor: 0, capture: null, strength: 'proof' };
    refused(resolveQuantity([a, b], { owner: 'probe', key: a.key, witnesses: ['qa', 'qb'], amount: 105,
      evidence: evidence as never }, f.c), 'signed-history');
    const equal = f.witness('input', 100, { sourceEvent: 'qc' });
    expect(value(resolveQuantity([a, equal], undefined, f.c)).witnesses.map(row => row.sourceEvent)).toEqual(['qa', 'qc']);
    expect(value(resolveQuantity([equal, a], undefined, f.c)).witnesses.map(row => row.sourceEvent)).toEqual(['qa', 'qc']);
  });

  it('R3-F04 rejects incompatible aggregate semantics and malformed frontiers', () => {
    const f = measurementFixture(); const policy = value(decodeAggregateMeasurementsPolicy({ type: 'AggregateMeasurementsPolicy',
      schemaVersion: 2, id: 'aggregate:input', sourceKind: 'model-token', aggregateKind: 'measurement-window-aggregate',
      additiveUnits: ['tokens'], categories: ['input'], dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary' }, f.c));
    const independent = value(decodeMeasurementProducerContract(f.producerInput({ categories:
      [{ name: 'input', unit: 'tokens', relation: 'independent-billed' }] }), f.c));
    const base = f.witness('input', 100, { sourceEvent: 'base' });
    const other = value(createQuantityWitness({ contract: independent, subjectInstance: 'exchange:2', sourceSample: 'exchange:2',
      category: 'input', measurement: { ...base.measurement, subject: { ...base.measurement.subject, instance: 'exchange:2' } },
      evidence: f.evidenceInput({ id: 'other', claim: { subject: 'exchange:2', predicate: 'usage-observed', value: 100 } }),
      sourceEvent: 'other', phase: 'final', predecessors: [], state: 'reported', hardwareProfile: null }, f.c));
    const request = { policy, quantities: [value(resolveQuantity([base], undefined, f.c)), value(resolveQuantity([other], undefined, f.c))],
      unit: 'tokens', category: 'input', dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary',
      start: f.clock(0), end: f.clock(200), evaluationClock: f.clock(200), frontier: 'frontier:1' };
    refused(aggregateMeasurements(request, f.c), 'basis differs');
    refused(aggregateMeasurements({ ...request, quantities: request.quantities.slice(0, 1), frontier: 4 as never }, f.c), 'frontier');
  });

  it('R3-F05 reconciles burn populations, strict booleans, and prior episode state', () => {
    const f = measurementFixture(); const high = f.burnWindow('current', [f.burnSample('current', 100, 20)]);
    const baseline = f.burnWindow('baseline', [f.burnSample('baseline', 20, 0)]);
    const open = { state: 'open' as const, recoveryCount: 1, notified: true, investigation: 'prior' };
    refused(evaluateBurn(f.burnPolicy, open, { ...high, observedExchanges: 0, usageSupportedExchanges: 0,
      attemptedDispatches: 0 }, [baseline], f.c), 'constructor');
    refused(evaluateBurn(f.burnPolicy, f.closed, { ...high, censusComplete: 'false' as never }, [baseline], f.c), 'constructor');
    refused(evaluateBurn(f.burnPolicy, { state: 'open', notified: true, investigation: 'prior' } as never,
      high, [baseline], f.c), 'undeclared');
  });

  it('R3-F06 retains conflicts, unresolved evidence, empty baselines, and coverage debt', () => {
    const f = measurementFixture(); const baseline = f.burnWindow('baseline', [f.burnSample('baseline', 20, 0)]);
    const open = { state: 'open' as const, recoveryCount: 1, notified: true, investigation: 'prior' };
    const conflict = f.burnWindow('conflict', [f.burnSample('dupe', 100, 20), f.burnSample('dupe', 999, 20)]);
    refused(evaluateBurn(f.burnPolicy, open, conflict, [baseline], f.c), 'comparison population');
    const a = f.witness('input', 100, { sourceEvent: 'a' }); const b = f.witness('input', 110, { sourceEvent: 'b' });
    const unresolved = value(resolveQuantity([a, b], undefined, f.c));
    const incomplete = f.burnWindow('incomplete', [{ identity: 'exchange:1', feature: 'feature-a', source: 'model-exchange' as const,
      selectionVersion: 'v1', quantities: [unresolved, f.quantity('output', 20)] }]);
    refused(evaluateBurn(f.burnPolicy, open, incomplete, [baseline], f.c), 'comparison population');
    expect(value(evaluateBurn(f.burnPolicy, open, f.burnWindow('current', [f.burnSample('current', 100, 20)]), [], f.c)).confidence)
      .toBe('insufficient-evidence');
    const policy = value(decodeBurnPolicy(f.burnPolicyInput({ minimumUsageCoverage: 0.8 }), f.c));
    const lowCoverage = f.burnWindow('coverage', [f.burnSample('one', 10, 0)], { observedExchanges: 4,
      usageSupportedExchanges: 3, attemptedDispatches: 4, provenNoExchange: 0 });
    expect(value(evaluateBurn(policy, open, lowCoverage, [baseline], f.c)).coverageDebt).toContain('usage-coverage-floor');
  });

  it('R3-F07 closes feature variants and requires current evidence for the exact feature action', () => {
    const f = measurementFixture(); const evidence = value(decode('Evidence', f.evidenceInput({ id: 'foreign', observedAt: f.now,
      freshFor: 1, claim: { subject: 'unrelated-feature', predicate: 'feature-action-observed', value: 'fired' } }), f.types));
    f.evidence.push(evidence);
    refused(classifyFeatureOutcome({ kind: 'invented' } as never, f.c), 'undeclared');
    refused(classifyFeatureOutcome({ kind: 'exchange', classifier: 'complete', actionProved: true, negativeProved: false,
      gradeOnly: false, feature: 'feature-a', action: 'feature-action-observed', evaluationClock: f.clock(10_000), evidence }, f.c), 'expired');
  });

  it('R3-F08 F09 validates read unknowns, tuples, and duplicate identities', () => {
    const f = measurementFixture();
    refused(renderBoundedRead(f.query, [f.readRow('missing', 100, { state: 'missing', amount: 0 })], false, f.c), 'unknown');
    refused(renderBoundedRead(f.query, [f.readRow('alien', 100, { unit: 'unsupported', category: 'unsupported' })], false, f.c), 'tuple');
    refused(renderBoundedRead(f.query, [f.readRow('same', 100, { amount: 10 }), f.readRow('same', 100, { amount: 20 })], false, f.c), 'conflicting');
  });

  it('R3-F10 validates complete resource/process tuples and excludes private extras', () => {
    const f = measurementFixture(); const point = f.resourcePoint('p1', 100, 100);
    const missing = { ...point } as Record<string, unknown>; delete missing.at; delete missing.machine;
    refused(cpuUtilization(missing as never, 4, 'one-core', f.c), 'undeclared');
    refused(resourceTrend([{ ...point, heapBytes: 40, heapState: 'unsupported' }, f.resourcePoint('p2', 160, 110)], 2, f.c), 'heap');
    refused(resourceTrend([{ ...point, rssBytes: 0.5 }, f.resourcePoint('p2', 160, 110)], 2, f.c), 'RSS');
    refused(resourceTrend([{ ...point, environment: 'private', commandLine: 'secret' } as never,
      f.resourcePoint('p2', 160, 110)], 2, f.c), 'undeclared');
    refused(planProcessCensus([{ processIncarnation: 'p1', pid: -1, startEvidence: '', tags: ['worker'] }], 1, f.c), 'PID');
    refused(classifyProcesses([{ processIncarnation: 'p1', pid: 1, startEvidence: 'start:1', tags: ['worker'] }],
      [{ className: 'never-registered', requiredTags: ['worker'] }], f.c), 'registered');
  });

  it('R3-F11 reconciles peer witnesses together at one frontier', () => {
    const f = measurementFixture(); const qa = f.quantity('input', 100); const qb = f.quantity('input', 110);
    refused(mergePeerMeasurements([{ peer: 'a', state: 'admitted', lastFrontier: 'frontier:a', quantities: [qa] },
      { peer: 'b', state: 'admitted', lastFrontier: 'frontier:b', quantities: [qb] }], f.c), 'frontier');
    expect(value(mergePeerMeasurements([{ peer: 'a', state: 'admitted', lastFrontier: 'frontier:one', quantities: [qa] },
      { peer: 'b', state: 'admitted', lastFrontier: 'frontier:one', quantities: [qb] }], f.c))).toMatchObject({ state: 'partial',
      unresolved: [qa.witnesses[0]!.sourceEvent, qb.witnesses[0]!.sourceEvent] });
  });

  it('R3-F12 closes attribution and keeps owner-issued Judgment records', async () => {
    const owner = judgmentFixture(); value(await owner.door.judge(owner.input, owner.start()));
    const f = measurementFixture(); const context = { ...f.c, register: owner.ctx.decode.register, types: owner.ctx.decode };
    const request = { attempt: `attempt:${owner.input.id}:1`, claimed: { feature: 'forged', model: 'forged', machine: 'forged' },
      evaluationClock: owner.now, sourceHistory: value(owner.store.readForProjection()), candidates: [] };
    expect(value(resolveAttribution(request, context)).state).toBe('attributed');
    const noClock = { ...request } as Record<string, unknown>; delete noClock.evaluationClock;
    refused(resolveAttribution(noClock as never, context), 'undeclared');
    refused(resolveAttribution({ ...request, attempt: '' }, context), 'substantive');
  });

  it('R3-F12-B typed cache construction and P16-NF-24 P16-NF-26 legacy neighbors stay explicit', () => {
    const f = measurementFixture();
    refused(createBoundedReadCache({ type: 'ReadCachePolicy', schemaVersion: 2, id: 'caller', maxRows: 1,
      maxBytes: 1, maxAgeMs: 1, evictionBatch: 1 } as never, f.c), 'decoder');
    const policy = value(decodeReadCachePolicy({ type: 'ReadCachePolicy', schemaVersion: 2, id: 'cache:test',
      maxRows: 2, maxBytes: 100, maxAgeMs: 20, evictionBatch: 1 }, f.c));
    expect(value(createBoundedReadCache(policy, f.c)).owner).toBe('part-sixteen');
    const same = f.clock(100); const summary = value(summarizeRateLimitEvents([
      { id: 'a', source: 'breaker', kind: 'circuit-open', at: same },
      { id: 'b', source: 'session-sentinel', kind: '529', at: same },
      { id: 'a', source: 'breaker', kind: 'circuit-open', at: same },
    ], f.clock(0), f.clock(3_600_000), f.c));
    expect(summary).toMatchObject({ counts: { 'circuit-open': 1, '529': 1 }, breakerTripsPerHour: 1 });
    refused(summarizeRateLimitEvents([{ id: 'a', source: 'breaker', kind: 'circuit-open', at: same },
      { id: 'a', source: 'breaker', kind: 'circuit-recover', at: same }], f.clock(0), f.clock(200), f.c), 'conflicting');
    expect(value(classifyLegacyResourceObservation({ id: 'own', source: 'own-resource-read', state: 'read-failed',
      value: null, originalNumeric: false }, f.c)).state).toBe('failed');
    expect(value(classifyLegacyResourceObservation({ id: 'pid', source: 'pid-batch', state: 'read-failed',
      value: null, originalNumeric: false }, f.c)).state).toBe('missing');
    expect(value(classifyLegacyResourceObservation({ id: 'lost', source: 'origin-lost', state: 'read-failed',
      value: null, originalNumeric: false }, f.c)).state).toBe('legacy-origin-lost');
  });
});
