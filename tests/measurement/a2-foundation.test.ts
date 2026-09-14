import { describe, expect, it } from 'vitest';
import {
  aggregateCurrentMeasurements, bindCurrentMeasurementReadSource, createBoundedReadCache,
  createCurrentBurnWindow, createCurrentQuantityWitness, currentPeerHistoryBinding, decodeAggregateMeasurementsPolicy,
  decodeReadCachePolicy, evaluateCurrentBurn, measurementProjectionDefinition,
  mergeCurrentPeerMeasurements, renderCurrentMeasurementRead, resolveCurrentQuantity,
  resolveCurrentAttribution,
} from '../../src/measurement/index.js';
import type { BurnWindow, QuantityOwnerResolution } from '../../src/measurement/index.js';
import type { ProjectionGeneration } from '../../src/projections/index.js';
import { routineAgeRemovalAllowed } from '../../src/verification/index.js';
import { refused, value } from '../facts/fixtures.js';
import { captureRetentionProof, measurementA2Fixture } from './a2-fixture.js';
import { judgmentFixture } from '../judgment/fixture.js';

function generationFor(f: ReturnType<typeof measurementA2Fixture>): ProjectionGeneration {
  const last = value(f.store.read()).at(-1)!;
  return {
    reference: f.c.register.generation,
    kinds: ['measurement-observation', 'measurement-evidence'],
    lineages: { 'machine-a': { head: last.segment, observedAt: null, closed: true } },
  };
}

describe('Part 16 slice A2 current-history measurement semantics', () => {
  it('P16-NF-12 [behavior:signed-history-attribution] P16-NF-13 [behavior:unattributed-conflicted] owner attribution ignores claimed labels and joins the current Part Seven request, attempt, resolution, and decision', async () => {
    const owner = judgmentFixture();
    value(await owner.door.judge(owner.input, owner.start()));
    const sourceHistory = value(owner.store.readForProjection());
    const f = measurementA2Fixture();
    const context = { ...f.c, register: owner.ctx.decode.register,
      types: owner.ctx.decode };
    const attempt = `attempt:${owner.input.id}:1`;
    expect(value(resolveCurrentAttribution({ attempt,
      claimed: { feature: 'forged', model: 'forged', machine: 'forged' },
      evaluationClock: owner.now, sourceHistory, candidates: [] }, context))).toMatchObject({
      state: 'attributed', feature: 'judgment', model: 'model',
      machine: 'machine-a', run: owner.input.run.id,
    });
    expect(value(resolveCurrentAttribution({ attempt: 'attempt:absent',
      claimed: { feature: 'forged', model: 'forged', machine: 'forged' },
      evaluationClock: owner.now, sourceHistory, candidates: [] }, context))).toMatchObject({
      state: 'unattributed', feature: null, model: null, machine: null,
    });
  });

  it('P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] admits equal witnesses once, retains disagreement, and requires a causally later owner resolution', () => {
    const f = measurementA2Fixture();
    const equalA = f.planObservation({ subject: 'exchange:equal', sourceEvent: 'usage:equal:a', amount: 10, at: 100 });
    const equalB = f.planObservation({ subject: 'exchange:equal', sourceEvent: 'usage:equal:b', amount: 10, at: 110 });
    f.persistObservation(equalA); f.persistObservation(equalB);
    const differentA = f.planObservation({ subject: 'exchange:different', sourceEvent: 'usage:different:a', amount: 10, at: 120 });
    const differentB = f.planObservation({ subject: 'exchange:different', sourceEvent: 'usage:different:b', amount: 12, at: 130 });
    f.persistObservation(differentA); f.persistObservation(differentB);
    const resolutionEvidence = f.admitEvidence(f.evidenceInput({
      id: 'resolution:different', observedAt: f.clock(140), freshFor: 1_000_000,
      claim: { subject: differentA.identity, predicate: 'quantity-resolved',
        value: { amount: 11, witnesses: [differentA.sourceEvent, differentB.sourceEvent] } },
    }));
    f.append('measurement-evidence', { evidence: resolutionEvidence } as never, f.clock(140));
    const history = f.snapshot();
    const equal = f.quantity([equalA, equalB], history);
    expect(equal).toMatchObject({ state: 'resolved', amount: 10 });
    expect(equal.witnesses).toHaveLength(2);
    const witnesses = [f.witness(differentA, history), f.witness(differentB, history)];
    expect(value(resolveCurrentQuantity({ witnesses, sourceHistory: history,
      evaluationClock: f.clock(200) }, f.c))).toMatchObject({ state: 'resolved', amount: 11 });
    const resolution: QuantityOwnerResolution = { owner: 'probe', key: differentA.identity,
      witnesses: [differentA.sourceEvent, differentB.sourceEvent], amount: 11,
      evidence: resolutionEvidence };
    expect(value(resolveCurrentQuantity({ witnesses, resolution, sourceHistory: history,
      evaluationClock: f.clock(200) }, f.c))).toMatchObject({ state: 'resolved', amount: 11 });

    const staleHistory = history;
    const later = f.planObservation({ subject: 'exchange:later', sourceEvent: 'usage:later', amount: 1, at: 150 });
    f.persistObservation(later);
    refused(resolveCurrentQuantity({ witnesses: equal.witnesses, sourceHistory: staleHistory,
      evaluationClock: f.clock(200) }, f.c), 'current');
    refused(resolveCurrentQuantity({ witnesses: [structuredClone(equal.witnesses[0]!)],
      sourceHistory: f.snapshot(), evaluationClock: f.clock(200) }, f.c), 'constructor');

    const moved = measurementA2Fixture();
    const movedObservation = moved.planObservation({ subject: 'exchange:moved',
      sourceEvent: 'usage:moved', amount: 1, at: 100, claimOccurrenceAt: 101 });
    moved.persistObservation(movedObservation);
    refused(createCurrentQuantityWitness({ input: movedObservation.input,
      sourceHistory: moved.snapshot() }, moved.c), 'occurrence time');

    const currentAgain = f.snapshot();
    const currentWitness = f.witness(later, currentAgain);
    const nextGeneration = { owner: 'part-three' as const, name: 'RegisterGeneration' as const,
      id: 'generation:next' };
    const nextRegister: typeof f.c.register = { ...f.c.register, generation: nextGeneration };
    refused(resolveCurrentQuantity({ witnesses: [currentWitness], sourceHistory: currentAgain,
      evaluationClock: f.clock(200) }, { ...f.c, register: nextRegister,
      types: { ...f.types, register: nextRegister } as typeof f.c.types }), 'generation');

    const early = measurementA2Fixture();
    const earlyA = early.planObservation({ subject: 'exchange:early', sourceEvent: 'early:a',
      amount: 10, at: 100 });
    early.persistObservation(earlyA);
    const earlyResolutionEvidence = early.admitEvidence(early.evidenceInput({
      id: 'resolution:early', observedAt: early.clock(105), freshFor: 1_000_000,
      claim: { subject: earlyA.identity, predicate: 'quantity-resolved',
        value: { amount: 11, witnesses: ['early:a', 'early:b'] } },
    }));
    early.append('measurement-evidence', { evidence: earlyResolutionEvidence } as never,
      early.clock(105));
    const earlyB = early.planObservation({ subject: 'exchange:early', sourceEvent: 'early:b',
      amount: 12, at: 110 });
    early.persistObservation(earlyB);
    const earlyHistory = early.snapshot();
    const earlyWitnesses = [early.witness(earlyA, earlyHistory), early.witness(earlyB, earlyHistory)];
    refused(resolveCurrentQuantity({ witnesses: earlyWitnesses, sourceHistory: earlyHistory,
      evaluationClock: early.clock(200), resolution: { owner: 'probe', key: earlyA.identity,
        witnesses: ['early:a', 'early:b'], amount: 11, evidence: earlyResolutionEvidence } },
    early.c), 'causally later');
  });

  it('P16-NF-12 [behavior:signed-history-attribution] P16-NF-13 [behavior:unattributed-conflicted] P16-NF-16 [behavior:current-history-read] P16-NF-36 [behavior:deterministic-historical-presentation] P16-NF-47 [behavior:privacy] P16-NF-48 [behavior:bounded-query] P16-NF-50 [behavior:historical-restart-rebuild] derives rows from the current fold and rejects invented or stale bindings', () => {
    const f = measurementA2Fixture();
    const observation = f.planObservation({ subject: 'exchange:read', sourceEvent: 'usage:read',
      amount: 7, at: 100, contract: f.eventProducer });
    f.persistObservation(observation);
    const history = f.snapshot();
    const generation = generationFor(f);
    const definition = value(measurementProjectionDefinition(generation, {
      'measurement-observation': { identity: 'identity', value: 'measurement', merge: 'set-union' },
    }, f.c));
    const binding = value(bindCurrentMeasurementReadSource({ sourceHistory: history,
      sourceDefinition: definition, sourceGeneration: generation }, f.c));
    const query = f.readQuery(binding);
    const first = value(renderCurrentMeasurementRead({ sourceHistory: history,
      sourceDefinition: definition, sourceGeneration: generation, query,
      producers: [f.eventProducer], attributions: [], timedOut: false }, f.c));
    expect(first).toMatchObject({ totalCount: 1, partial: false,
      rows: [{ identity: observation.identity, amount: 7, state: 'reported',
        feature: null, model: null }] });
    expect(JSON.stringify(first)).not.toMatch(/prompt|response|command|environment/i);
    expect(first.exportBytes).toBeLessThanOrEqual(query.maxExportBytes);
    expect(value(renderCurrentMeasurementRead({ sourceHistory: history,
      sourceDefinition: definition, sourceGeneration: generation, query,
      producers: [f.eventProducer], attributions: [], timedOut: false }, f.c))).toEqual(first);
    const inventedQuery = f.readQuery({ ...binding, sourceHistoryDigest: 'sha256:invented' });
    refused(renderCurrentMeasurementRead({ sourceHistory: history, sourceDefinition: definition,
      sourceGeneration: generation, query: inventedQuery, producers: [f.eventProducer],
      attributions: [], timedOut: false }, f.c), 'exact owner snapshot');
  });

  it('P16-NF-38 [behavior:peer-completeness-clock] P16-NF-37 [behavior:peer-union-window] uses owner snapshots, actual frontiers, and measured clock skew while preserving missing peers', () => {
    const f = measurementA2Fixture();
    const observation = f.planObservation({ subject: 'exchange:peer', sourceEvent: 'usage:peer', amount: 5, at: 100 });
    f.persistObservation(observation);
    const history = f.snapshot();
    const quantity = f.quantity([observation], history);
    const binding = value(currentPeerHistoryBinding(history, f.c));
    const admitted = { peer: 'machine-a', state: 'admitted' as const, sourceHistory: history,
      ...binding, observedAt: f.clock(190), lastFrontier: null, quantities: [quantity] };
    expect(value(mergeCurrentPeerMeasurements([admitted], { requiredPeers: ['machine-a', 'machine-b'],
      evaluationClock: f.clock(200), maximumClockSkewMs: 20 }, f.c))).toMatchObject({
      state: 'partial', admittedPeers: ['machine-a'],
      missingPeers: [{ peer: 'machine-b', reason: 'missing' }],
    });
    const invented = { ...admitted, frontierDigest: 'sha256:invented' };
    expect(value(mergeCurrentPeerMeasurements([invented], { requiredPeers: ['machine-a'],
      evaluationClock: f.clock(200), maximumClockSkewMs: 20 }, f.c))).toMatchObject({
      state: 'partial', admittedPeers: [],
      missingPeers: [{ peer: 'machine-a', reason: 'unwitnessed-frontier' }],
    });
    const skewed = { ...admitted, observedAt: f.clock(100) };
    expect(value(mergeCurrentPeerMeasurements([skewed], { requiredPeers: ['machine-a'],
      evaluationClock: f.clock(200), maximumClockSkewMs: 20 }, f.c))).toMatchObject({
      state: 'partial', missingPeers: [{ reason: 'clock-skew' }],
    });
  });

  it('historical reads preserve registered resource hardware and source-sample identity', () => {
    const f = measurementA2Fixture();
    const observation = f.planObservation({ subject: 'process:resource',
      sourceEvent: 'resource:sample:1', category: 'cpu', amount: 50, at: 100,
      contract: f.resourceProducer, hardwareProfile: 'hardware:m1' });
    f.persistObservation(observation);
    const history = f.snapshot();
    const generation = generationFor(f);
    const definition = value(measurementProjectionDefinition(generation, {
      'measurement-observation': { identity: 'identity', value: 'measurement', merge: 'set-union' },
    }, f.c));
    const binding = value(bindCurrentMeasurementReadSource({ sourceHistory: history,
      sourceDefinition: definition, sourceGeneration: generation }, f.c));
    expect(value(renderCurrentMeasurementRead({ sourceHistory: history,
      sourceDefinition: definition, sourceGeneration: generation,
      query: f.readQuery(binding), producers: [f.resourceProducer], attributions: [],
      timedOut: false }, f.c))).toMatchObject({ rows: [{ family: 'resource', category: 'cpu',
      amount: 50, sourceSample: 'process:resource' }] });
  });

  it('P16-NF-34 [behavior:coverage-debt] P16-NF-33 [behavior:burn-hysteresis] P16-NF-39 [behavior:all-identities-retention] P16-NF-40 [behavior:capture-retention] P16-NF-41 [behavior:bounded-cache-eviction] burn:high-window-forged-as-prior-recovery keeps durable identities separate from bounded disposable cache work', () => {
    const f = measurementA2Fixture();
    const observation = f.planObservation({ subject: 'exchange:aggregate',
      sourceEvent: 'usage:aggregate', amount: 9, at: 100, contract: f.eventProducer });
    f.persistObservation(observation);
    const history = f.snapshot();
    const quantity = f.quantity([observation], history);
    const frontier = value(currentPeerHistoryBinding(history, f.c)).frontierDigest;
    const eventAggregate = { ...f.aggregatePolicyInput, id: 'aggregate:event',
      sourceKind: 'programmatic-count' };
    const aggregateContext = f.withRegistered(eventAggregate);
    const policy = value(decodeAggregateMeasurementsPolicy(eventAggregate, aggregateContext));
    expect(value(aggregateCurrentMeasurements({ policy, quantities: [quantity], unit: 'tokens',
      category: 'input', dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary',
      start: f.clock(0), end: f.clock(200), evaluationClock: f.clock(200),
      frontier }, aggregateContext))).toMatchObject({ amount: 9, members: ['usage:aggregate'] });
    const generation = generationFor(f);
    expect(value(measurementProjectionDefinition(generation, {
      'measurement-observation': { identity: 'identity', value: 'measurement', merge: 'set-union' },
    }, f.c))).toMatchObject({ retention: 'all-identities' });
    expect(routineAgeRemovalAllowed()).toBe(false);
    expect(captureRetentionProof()).toMatchObject({ protectedDetail: expect.stringContaining('protected'),
      tombstone: { status: 'tombstoned', bytes: null } });
    const cachePolicy = value(decodeReadCachePolicy(f.cachePolicyInput, f.c));
    const cache = value(createBoundedReadCache(cachePolicy, f.c));
    value(cache.put({ key: 'a', createdAt: f.clock(100), bytes: 'one', byteLength: 3 }));
    value(cache.put({ key: 'b', createdAt: f.clock(110), bytes: 'two', byteLength: 3 }));
    expect(value(cache.planEviction(f.clock(1_200)))).toEqual(['a']);
    expect(value(cache.applyEviction(['a']))).toBe(1);
    expect(value(cache.inspect()).map(row => row.key)).toEqual(['b']);

    const burn = measurementA2Fixture();
    const makeWindow = (id: string, start: number, end: number,
      target: readonly [number, number], other: readonly [number, number]) => {
      const targetRows = [burn.planObservation({ subject: `${id}:target`,
        sourceEvent: `${id}:target:input`, category: 'input',
        amount: target[0] + target[1], at: start + 50, contract: burn.eventProducer })];
      const otherRows = [burn.planObservation({ subject: `${id}:other`,
        sourceEvent: `${id}:other:input`, category: 'input',
        amount: other[0] + other[1], at: start + 50, contract: burn.eventProducer })];
      [...targetRows, ...otherRows].forEach(burn.persistObservation);
      return burn.persistBurnWindow({ id, start, end, comparisonScopeAmount:
        target[0] + target[1] + other[0] + other[1], samples: [
        { identity: `${id}:target`, feature: 'feature-a', source: 'programmatic-event',
          observations: targetRows },
        { identity: `${id}:other`, feature: 'comparison', source: 'programmatic-event',
          observations: otherRows },
      ] });
    };
    const basePlan = makeWindow('base', 0, 200, [5, 5], [90, 0]);
    const highPlan = makeWindow('high', 200, 400, [100, 50], [50, 0]);
    const lowPlan = makeWindow('low', 400, 600, [5, 5], [90, 0]);
    const nextPlan = makeWindow('next', 600, 800, [5, 5], [90, 0]);
    const burnHistory = burn.snapshot();
    const port = (window: BurnWindow) => value(createCurrentBurnWindow({ window,
      sourceHistory: burnHistory }, burn.c));
    const base = port(basePlan.build(burnHistory));
    const high = port(highPlan.build(burnHistory));
    const low = port(lowPlan.build(burnHistory));
    const next = port(nextPlan.build(burnHistory));
    const policyBurn = burn.burnPolicy();
    const closed = { state: 'closed' as const, recoveryCount: 0, notified: false,
      investigation: null };
    const opened = value(evaluateCurrentBurn(policyBurn, closed, high, [base], burn.c));
    expect(opened).toMatchObject({ classification: 'activity', notify: true,
      openInvestigation: true, episode: { state: 'open' } });
    refused(evaluateCurrentBurn(policyBurn, { ...opened.episode, recoveryCount: 1,
      lastEvaluatedObservation: 'invented-recovery' }, low, [high], burn.c),
    'lacks its current owner observation');
    const recovering = value(evaluateCurrentBurn(policyBurn, opened.episode, low, [high], burn.c));
    expect(recovering.episode).toMatchObject({ state: 'open', recoveryCount: 1 });
    const replay = value(evaluateCurrentBurn(policyBurn, recovering.episode, low, [high], burn.c));
    expect(replay.episode).toMatchObject({ state: 'open', recoveryCount: 1 });
    const recovered = value(evaluateCurrentBurn(policyBurn, recovering.episode, next, [low], burn.c));
    expect(recovered.episode).toMatchObject({ state: 'closed', recoveryCount: 0 });
    refused(createCurrentBurnWindow({ window: { ...highPlan.build(burnHistory),
      observedExchanges: 3 }, sourceHistory: burnHistory }, burn.c), 'counts differ');

    const debtFixture = measurementA2Fixture();
    const one = debtFixture.planObservation({ subject: 'debt:target', sourceEvent: 'debt:a',
      category: 'input', amount: 1, at: 100 });
    const two = debtFixture.planObservation({ subject: 'debt:target', sourceEvent: 'debt:b',
      category: 'input', amount: 2, at: 100 });
    const output = debtFixture.planObservation({ subject: 'debt:target', sourceEvent: 'debt:output',
      category: 'output', amount: 1, at: 100 });
    [one, two, output].forEach(debtFixture.persistObservation);
    const debtPlan = debtFixture.persistBurnWindow({ id: 'debt', start: 0, end: 200,
      comparisonScopeAmount: 0, samples: [{ identity: 'debt:target', feature: 'feature-a',
        observations: [one, two, output] }] });
    const debtHistory = debtFixture.snapshot();
    const debtWindow = value(createCurrentBurnWindow({ window: debtPlan.build(debtHistory),
      sourceHistory: debtHistory }, debtFixture.c));
    const debt = value(evaluateCurrentBurn(debtFixture.burnPolicy(), closed,
      debtWindow, [], debtFixture.c));
    expect(debt).toMatchObject({ classification: 'incomplete', currentAmount: null,
      culprit: null });
    expect(debt.coverageDebt).toContain('unresolved:debt:target');

    const endpoint = measurementA2Fixture();
    const endpointObservation = endpoint.planObservation({ subject: 'endpoint:target',
      sourceEvent: 'endpoint:input', category: 'input', amount: 1, at: 200 });
    endpoint.persistObservation(endpointObservation);
    const endpointPlan = endpoint.persistBurnWindow({ id: 'endpoint', start: 0, end: 200,
      comparisonScopeAmount: 1, samples: [{ identity: 'endpoint:target', feature: 'feature-a',
        observations: [endpointObservation] }] });
    const endpointHistory = endpoint.snapshot();
    const endpointWindow = value(createCurrentBurnWindow({ window: endpointPlan.build(endpointHistory),
      sourceHistory: endpointHistory }, endpoint.c));
    refused(evaluateCurrentBurn(endpoint.burnPolicy(), closed, endpointWindow, [], endpoint.c),
      'comparison denominator');
  });
});
