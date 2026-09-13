import { describe, expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import {
  aggregateCurrentMeasurements, bindCurrentMeasurementReadSource,
  createCurrentBurnWindow, createCurrentQuantityWitness, currentPeerHistoryBinding,
  decodeAggregateMeasurementsPolicy, evaluateCurrentBurn,
  measurementProjectionDefinition, mergeCurrentPeerMeasurements,
  renderCurrentMeasurementRead, resolveCurrentQuantity,
} from '../../src/measurement/index.js';
import type { ProjectionGeneration } from '../../src/projections/index.js';
import { refused, value } from '../facts/fixtures.js';
import { measurementA2Fixture } from './a2-fixture.js';

function generationFor(f: ReturnType<typeof measurementA2Fixture>): ProjectionGeneration {
  const last = value(f.store.read()).at(-1)!;
  return { reference: f.c.register.generation,
    kinds: ['measurement-observation', 'measurement-evidence'],
    lineages: { 'machine-a': { head: last.segment, observedAt: null, closed: true } } };
}

function readRequest(f: ReturnType<typeof measurementA2Fixture>,
  sourceHistory: ReturnType<typeof f.snapshot>) {
  const sourceGeneration = generationFor(f);
  const sourceDefinition = value(measurementProjectionDefinition(sourceGeneration, {
    'measurement-observation': { identity: 'identity', value: 'measurement',
      merge: 'set-union' },
  }, f.c));
  const binding = value(bindCurrentMeasurementReadSource({ sourceHistory, sourceDefinition,
    sourceGeneration }, f.c));
  return { sourceHistory, sourceDefinition, sourceGeneration,
    query: f.readQuery(binding), producers: [f.producer], attributions: [], timedOut: false };
}

function disagreementFixture(resolutionAt = 150) {
  const f = measurementA2Fixture();
  const left = f.planObservation({ subject: 'exchange:review', sourceEvent: 'w:a',
    amount: 100, at: 100 });
  const right = f.planObservation({ subject: 'exchange:review', sourceEvent: 'w:b',
    amount: 110, at: 100 });
  [left, right].forEach(f.persistObservation);
  const evidence = f.admitEvidence(f.evidenceInput({ id: 'resolution:review',
    observedAt: f.clock(resolutionAt), freshFor: 1_000_000,
    claim: { subject: left.identity, predicate: 'quantity-resolved',
      value: { amount: 105, witnesses: ['w:a', 'w:b'] } } }));
  f.append('measurement-evidence', { evidence } as never, f.clock(resolutionAt));
  const sourceHistory = f.snapshot();
  const witnesses = [f.witness(left, sourceHistory), f.witness(right, sourceHistory)];
  const resolution = { owner: 'probe', key: left.identity, witnesses: ['w:a', 'w:b'],
    amount: 105, evidence };
  return { f, left, right, evidence, sourceHistory, witnesses, resolution };
}

describe('Part 16 A2 round-two independent review regressions', () => {
  it('history:equal-witnesses-count-once and history:owner-resolved-disagreement retain one resolved row', () => {
    const equal = measurementA2Fixture();
    const one = equal.planObservation({ subject: 'exchange:equal', sourceEvent: 'equal:a',
      amount: 100, at: 100 });
    const two = equal.planObservation({ subject: 'exchange:equal', sourceEvent: 'equal:b',
      amount: 100, at: 100 });
    [one, two].forEach(equal.persistObservation);
    expect(value(renderCurrentMeasurementRead(readRequest(equal, equal.snapshot()), equal.c)))
      .toMatchObject({ totalCount: 1, rows: [{ amount: 100 }] });

    const resolved = disagreementFixture();
    expect(value(renderCurrentMeasurementRead(readRequest(resolved.f, resolved.sourceHistory),
      resolved.f.c))).toMatchObject({ totalCount: 1, rows: [{ amount: 105 }] });
  });

  it('aggregate:withdrawn-resolution-evidence and aggregate:expired-usage-at-evaluation revalidate dependencies at use time', () => {
    const resolved = disagreementFixture();
    const quantity = value(resolveCurrentQuantity({ witnesses: resolved.witnesses,
      resolution: resolved.resolution, sourceHistory: resolved.sourceHistory,
      evaluationClock: resolved.f.clock(200) }, resolved.f.c));
    const frontier = value(currentPeerHistoryBinding(resolved.sourceHistory,
      resolved.f.c)).frontierDigest;
    const request = { policy: value(decodeAggregateMeasurementsPolicy(
      resolved.f.aggregatePolicyInput, resolved.f.c)), quantities: [quantity], unit: 'tokens',
      category: 'input', dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary',
      start: resolved.f.clock(0), end: resolved.f.clock(500),
      evaluationClock: resolved.f.clock(500), frontier };
    const withoutResolution = { ...resolved.f.c, types: { ...resolved.f.types,
      evidence: (resolved.f.types.evidence ?? []).filter(
        row => row.id !== resolved.evidence.id) } };
    refused(aggregateCurrentMeasurements(request, withoutResolution), 'evidence');

    const fresh = measurementA2Fixture();
    const observation = fresh.planObservation({ subject: 'exchange:fresh',
      sourceEvent: 'fresh:a', amount: 1, at: 100 });
    fresh.persistObservation(observation);
    const history = fresh.snapshot();
    const current = fresh.quantity([observation], history, 200);
    const currentFrontier = value(currentPeerHistoryBinding(history, fresh.c)).frontierDigest;
    refused(aggregateCurrentMeasurements({ ...request,
      policy: value(decodeAggregateMeasurementsPolicy(fresh.aggregatePolicyInput, fresh.c)),
      quantities: [current], evaluationClock: fresh.clock(2_000_000),
      frontier: currentFrontier }, fresh.c), 'expired');
  });

  it('quantity:omitted-competing-head and aggregate:unwitnessed-frontier cannot manufacture a source selection', () => {
    const r = disagreementFixture();
    expect(value(resolveCurrentQuantity({ witnesses: [r.witnesses[0]!],
      sourceHistory: r.sourceHistory, evaluationClock: r.f.clock(200) }, r.f.c)))
      .toMatchObject({ state: 'resolved', amount: 105 });
    const resolved = value(resolveCurrentQuantity({ witnesses: r.witnesses,
      resolution: r.resolution, sourceHistory: r.sourceHistory,
      evaluationClock: r.f.clock(200) }, r.f.c));
    refused(aggregateCurrentMeasurements({ policy: value(decodeAggregateMeasurementsPolicy(
      r.f.aggregatePolicyInput, r.f.c)), quantities: [resolved], unit: 'tokens',
      category: 'input', dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary',
      start: r.f.clock(0), end: r.f.clock(500), evaluationClock: r.f.clock(500),
      frontier: 'invented-frontier' }, r.f.c), 'exact current owner snapshot');
  });

  it('peer:omitted-current-quantity and peer:owner-resolved-quantity derive the owner-complete set', () => {
    const r = disagreementFixture();
    const quantity = value(resolveCurrentQuantity({ witnesses: r.witnesses,
      resolution: r.resolution, sourceHistory: r.sourceHistory,
      evaluationClock: r.f.clock(200) }, r.f.c));
    const binding = value(currentPeerHistoryBinding(r.sourceHistory, r.f.c));
    const peer = { peer: 'machine-a', state: 'admitted' as const,
      sourceHistory: r.sourceHistory, ...binding, observedAt: r.f.clock(195),
      lastFrontier: null, quantities: [quantity] };
    const policy = { requiredPeers: ['machine-a'], evaluationClock: r.f.clock(200),
      maximumClockSkewMs: 10 };
    expect(value(mergeCurrentPeerMeasurements([peer], policy, r.f.c))).toMatchObject({
      state: 'complete', unresolved: [], members: ['w:a', 'w:b'],
    });
    expect(value(mergeCurrentPeerMeasurements([{ ...peer, quantities: [] }], policy, r.f.c)))
      .toMatchObject({ state: 'complete', members: ['w:a', 'w:b'], unresolved: [] });
  });

  it('history:caller-suppresses-measurement-projection is rejected at source binding', () => {
    const f = measurementA2Fixture();
    const observation = f.planObservation({ subject: 'exchange:binding', sourceEvent: 'binding:a',
      amount: 10, at: 100 });
    f.persistObservation(observation);
    const sourceHistory = f.snapshot();
    const sourceGeneration = generationFor(f);
    const sourceDefinition = value(measurementProjectionDefinition(sourceGeneration, {}, f.c));
    refused(bindCurrentMeasurementReadSource({ sourceHistory, sourceDefinition,
      sourceGeneration }, f.c), 'suppresses');
  });

  it('witness:sample-clock-differs-from-evidence uses Measurement.at as sampled membership', () => {
    const f = measurementA2Fixture();
    const planned = f.planObservation({ subject: 'process:1', sourceEvent: 'resource:clock',
      category: 'cpu', amount: 3, at: 100, contract: f.resourceProducer,
      hardwareProfile: 'hardware:m1' });
    const measurement = value(decode('Measurement', { ...planned.measurement, at: f.clock(110) },
      f.types));
    const altered = { ...planned, measurement,
      input: { ...planned.input, measurement } };
    f.persistObservation(altered);
    refused(createCurrentQuantityWitness({ input: altered.input,
      sourceHistory: f.snapshot() }, f.c), 'occurrence time');
  });

  it('resolution:same-tick-later accepts causal succession while resolution:early refuses it', () => {
    const same = disagreementFixture(100);
    expect(value(resolveCurrentQuantity({ witnesses: same.witnesses,
      resolution: same.resolution, sourceHistory: same.sourceHistory,
      evaluationClock: same.f.clock(200) }, same.f.c))).toMatchObject({ amount: 105 });

    const early = measurementA2Fixture();
    const left = early.planObservation({ subject: 'exchange:early', sourceEvent: 'early:a',
      amount: 100, at: 100 });
    const right = early.planObservation({ subject: 'exchange:early', sourceEvent: 'early:b',
      amount: 110, at: 110 });
    early.persistObservation(left);
    const evidence = early.admitEvidence(early.evidenceInput({ id: 'resolution:early',
      observedAt: early.clock(105), freshFor: 1_000_000,
      claim: { subject: left.identity, predicate: 'quantity-resolved',
        value: { amount: 105, witnesses: ['early:a', 'early:b'] } } }));
    early.append('measurement-evidence', { evidence } as never, early.clock(100));
    early.persistObservation(right);
    const history = early.snapshot();
    refused(resolveCurrentQuantity({ witnesses: [early.witness(left, history),
      early.witness(right, history)], resolution: { owner: 'probe', key: left.identity,
      witnesses: ['early:a', 'early:b'], amount: 105, evidence }, sourceHistory: history,
      evaluationClock: early.clock(200) }, early.c), 'causally later');
  });

  it('burn:entry-neighbor does not attribute a feature from its population assertion', () => {
    const f = measurementA2Fixture();
    const observations = (['input', 'output'] as const).map((category, index) =>
      f.planObservation({ subject: 'attempt:unwitnessed',
        sourceEvent: `unwitnessed:${category}`, category, amount: index === 0 ? 150 : 0,
        at: 100 }));
    observations.forEach(f.persistObservation);
    const plan = f.persistBurnWindow({ id: 'unwitnessed-feature', start: 0, end: 200,
      samples: [{ identity: 'attempt:unwitnessed', feature: 'feature-a', observations }],
      comparisonScopeAmount: 150 });
    const history = f.snapshot();
    const window = value(createCurrentBurnWindow({ window: plan.build(history),
      sourceHistory: history }, f.c));
    expect(value(evaluateCurrentBurn(f.burnPolicy(), { state: 'open', recoveryCount: 0,
      notified: true, investigation: 'investigation:existing' }, window, [], f.c)))
      .toMatchObject({ classification: 'incomplete', notify: false,
        episode: { state: 'open' }, coverageDebt: expect.arrayContaining([
          'owner-dispatch:attempt:unwitnessed',
          'owner-attribution:attempt:unwitnessed',
        ]) });
  });
});
