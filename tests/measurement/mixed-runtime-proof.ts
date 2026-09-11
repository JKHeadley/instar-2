import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consumeResult, decode } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { foldProjection } from '../../src/projections/index.js';
import { decodeAssemblyRecord } from '../../src/assembly/index.js';
import {
  aggregateMeasurements, bindMeasurementReadSource, classifyLegacyResourceObservation, createBoundedReadCache, createQuantityWitness,
  decodeAggregateMeasurementsPolicy, decodeMeasurementProducerContract, decodeMeasurementReadQuery, decodeReadCachePolicy, evaluateBurn,
  growthInvestigationLink, measurementProjectionDefinition, mergePeerMeasurements, renderBoundedRead, renderCurrentMeasurementRead, resolveQuantity,
  resourceTrend, summarizeRateLimitEvents,
} from '../../src/measurement/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { factsFixture, value } from '../facts/fixtures.js';
import { measurementFixture } from './fixture.js';
// @ts-expect-error Reference Part Ten persistence adapter is executable JavaScript.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';

export function exerciseP16MixedRuntimeProof() {
  const directory = mkdtempSync(join(tmpdir(), 'p16-mixed-proof-'));
  try {
    const owner = factsFixture();
    const fact = owner.fact({ kind: 'note', body: { identity: 'mixed-proof', amount: '1' } }, owner.ctx);
    const storage = createTransportFileStorage(directory, (run: () => unknown) => owner.success(run()));
    value(storage.append(JSON.stringify(fact), null));
    const store = createFactStore(owner.ctx, storage);
    const snapshot = value(store.readForProjection());
    const generation = { reference: owner.c.register.generation, kinds: ['note'],
      lineages: { 'machine-a': { head: fact.segment, observedAt: 100, closed: false } } };
    const mf = measurementFixture();
    const definition = value(measurementProjectionDefinition(generation,
      { note: { identity: 'identity', value: 'amount', merge: 'additive' } }, mf.c));
    const projection = value(foldProjection(definition, snapshot, generation, owner.c));
    const next = owner.next(fact, { body: { identity: 'mixed-proof-next', amount: '2' } }, owner.ctx);
    value(storage.append(JSON.stringify(next), fact.contentHash));
    const staleAfterAdvance = consumeResult(foldProjection(definition, snapshot, generation, owner.c),
      { Success: () => false, Refused: () => true });
    const freshSnapshot = value(store.readForProjection());
    const freshGeneration = { ...generation, lineages: { 'machine-a': { head: next.segment, observedAt: 100, closed: false } } };
    const freshDefinition = value(measurementProjectionDefinition(freshGeneration,
      { note: { identity: 'identity', value: 'amount', merge: 'additive' } }, mf.c));
    const freshProjection = value(foldProjection(freshDefinition, freshSnapshot, freshGeneration, owner.c));
    const sourceRequest = { sourceHistory: freshSnapshot, sourceDefinition: freshDefinition, sourceGeneration: freshGeneration };
    const sourceBinding = value(bindMeasurementReadSource(sourceRequest, mf.c));
    const historicalQuery = value(decodeMeasurementReadQuery(mf.queryInput({ ...sourceBinding }), mf.c));
    const historicalRows = [mf.readRow('historical:one', 100, {}, sourceBinding)];
    const historicalFirst = value(renderCurrentMeasurementRead({ ...sourceRequest, query: historicalQuery,
      rows: historicalRows, timedOut: false }, mf.c));
    const historicalSecond = value(renderCurrentMeasurementRead({ ...sourceRequest, query: historicalQuery,
      rows: historicalRows, timedOut: false }, mf.c));

    const rateEvents = value(summarizeRateLimitEvents([
      { id: 'rate:a', source: 'breaker', kind: 'circuit-open', at: mf.clock(100) },
      { id: 'rate:b', source: 'session-sentinel', kind: '529', at: mf.clock(100) },
      { id: 'rate:a', source: 'breaker', kind: 'circuit-open', at: mf.clock(100) },
    ], mf.clock(0), mf.clock(3_600_000), mf.c));
    const rateCollisionRefused = consumeResult(summarizeRateLimitEvents([
      { id: 'collision', source: 'breaker', kind: 'circuit-open', at: mf.clock(100) },
      { id: 'collision', source: 'breaker', kind: 'quota', at: mf.clock(100) },
    ], mf.clock(0), mf.clock(200), mf.c), { Success: () => false, Refused: () => true });

    const first = mf.quantity('input', 40, 'exchange:a'); const second = mf.quantity('input', 60, 'exchange:b');
    const aggregatePolicy = value(decodeAggregateMeasurementsPolicy({ type: 'AggregateMeasurementsPolicy', schemaVersion: 2,
      id: 'aggregate:input', sourceKind: 'model-token', aggregateKind: 'measurement-window-aggregate', additiveUnits: ['tokens'],
      categories: ['input'], dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary' }, mf.c));
    const aggregate = value(aggregateMeasurements({ policy: aggregatePolicy, quantities: [first, second], unit: 'tokens', category: 'input',
      dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary', start: mf.clock(0), end: mf.clock(200),
      evaluationClock: mf.clock(200), frontier: 'frontier:mixed-proof' }, mf.c));
    const peerUnion = value(mergePeerMeasurements([
      { peer: 'local', state: 'admitted', lastFrontier: 'frontier:shared', quantities: [first] },
      { peer: 'remote', state: 'admitted', lastFrontier: 'frontier:shared', quantities: [first, second] },
    ], mf.c));
    const missingPeer = value(mergePeerMeasurements([
      { peer: 'local', state: 'admitted', lastFrontier: 'frontier:local', quantities: [first] },
      { peer: 'offline', state: 'missing', lastFrontier: 'frontier:old', quantities: [] },
    ], mf.c));
    const skewRefused = consumeResult(mergePeerMeasurements([
      { peer: 'local', state: 'admitted', lastFrontier: 'frontier:local', quantities: [first] },
      { peer: 'remote', state: 'admitted', lastFrontier: 'frontier:skewed', quantities: [second] },
    ], mf.c), { Success: () => false, Refused: () => true });
    const baseline = mf.burnWindow('baseline', [mf.burnSample('baseline', 20, 0)]);
    const burn = value(evaluateBurn(mf.burnPolicy, mf.closed,
      mf.burnWindow('current', [mf.burnSample('current', 100, 20)]), [baseline], mf.c));
    const page = value(renderBoundedRead(mf.query, [mf.readRow('one'), mf.readRow('two', 110)], true, mf.c));
    const privacyRefused = consumeResult(renderBoundedRead(mf.query, [{ ...mf.readRow('private'), prompt: 'secret' } as never], false, mf.c),
      { Success: () => false, Refused: () => true });
    const trend = value(resourceTrend([mf.resourcePoint('p1', 100, 100), mf.resourcePoint('p2', 160, 110)], 2, mf.c));
    const legacyOrigins = ['own-resource-read', 'pid-batch', 'footprint-census', 'origin-lost'].map((source, index) =>
      value(classifyLegacyResourceObservation({ id: `legacy:${index}`, source: source as never,
        state: source === 'origin-lost' ? 'read-failed' : 'observed', value: source === 'origin-lost' ? null : index,
        originalNumeric: source !== 'origin-lost' }, mf.c)).state);

    const observerTypes = { ...mf.types, register: { ...mf.types.register,
      entries: [...mf.types.register.entries, 'producer:observer', 'observer-cost-observed'],
      subjects: { ...mf.types.register.subjects, 'observer-run': ['ms'] } } };
    const observerContext = { ...mf.c, register: observerTypes.register, types: observerTypes };
    const observerContract = value(decodeMeasurementProducerContract({ type: 'MeasurementProducerContract', schemaVersion: 2,
      id: 'producer:observer', family: 'package-cost', subjectKind: 'observer-run', producer: 'probe',
      categories: [{ name: 'scan-duration', unit: 'ms', relation: 'standalone' }], evidencePredicate: 'observer-cost-observed',
      sourceSampleRequired: true, hardwareProfileRequired: false }, observerContext));
    const observerMeasurement = value(decode('Measurement', { type: 'Measurement', schemaVersion: 1,
      subject: { kind: 'observer-run', instance: 'scan:1' }, value: 5, unit: 'ms', at: mf.now, by: 'probe' }, observerTypes));
    const observerWitness = value(createQuantityWitness({ contract: observerContract, subjectInstance: 'scan:1', sourceSample: 'scan:1',
      category: 'scan-duration', measurement: observerMeasurement, evidence: mf.evidenceInput({ id: 'observer:1',
        claim: { subject: 'scan:1', predicate: 'observer-cost-observed', value: 5 } }), sourceEvent: 'observer:1', phase: 'final',
      predecessors: [], state: 'reported', hardwareProfile: null }, observerContext));
    const observerCost = value(resolveQuantity([observerWitness], undefined, observerContext));
    const assemblyContext = factsFixture();
    const growthPolicy = value(decodeAssemblyRecord('GrowthPolicy', assemblyInput('GrowthPolicy'), assemblyContext.c));
    const growthObservation = value(decodeAssemblyRecord('GrowthObservation', { ...assemblyInput('GrowthObservation'),
      comparisons: [{ subject: 'genesis-replay-duration', kind: 'measured', value: 15, threshold: 10, result: 'soft-breach' }] }, assemblyContext.c));
    const growth = value(growthInvestigationLink(growthPolicy, [growthObservation, growthObservation], mf.c));
    const cachePolicy = value(decodeReadCachePolicy({ type: 'ReadCachePolicy', schemaVersion: 2, id: 'cache:mixed', maxRows: 1,
      maxBytes: 100, maxAgeMs: 20, evictionBatch: 1 }, mf.c));
    const cache = value(createBoundedReadCache(cachePolicy, mf.c));
    value(cache.put({ key: 'page', createdAt: mf.clock(100), bytes: 'bounded', byteLength: 7 }));

    return {
      sourceHistory: { initial: projection.values['note:mixed-proof'], staleAfterAdvance,
        fresh: freshProjection.values['note:mixed-proof-next'], persistedFacts: freshSnapshot.entries.length },
      historicalRead: { binding: sourceBinding, rows: historicalFirst.rows.length,
        deterministic: JSON.stringify(historicalFirst) === JSON.stringify(historicalSecond) },
      rateEvents: { ids: rateEvents.events.map(row => row.id), counts: rateEvents.counts,
        breakerTripsPerHour: rateEvents.breakerTripsPerHour, collisionRefused: rateCollisionRefused },
      aggregation: { amount: aggregate.amount, members: aggregate.members.length }, peerUnion: peerUnion,
      missingPeer: { ...missingPeer, skewRefused },
      burn: { classification: burn.classification, currentAmount: burn.currentAmount },
      read: { rows: page.rows.length, partial: page.partial, privacyRefused },
      resource: { state: trend.state, rssDeltaBytes: trend.rssDeltaBytes, legacyOrigins },
      observerCost: { state: observerCost.state, amount: observerCost.amount },
      growth: { key: growth?.key, observations: growth?.observations.length }, cacheRows: value(cache.inspect()).length,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export const p16MixedRuntimeReceiptMap = Object.freeze({
  'P16-NF-16': ['sourceHistory'], 'P16-NF-24': ['rateEvents', 'resource'], 'P16-NF-33': ['aggregation', 'burn'],
  'P16-NF-36': ['historicalRead'], 'P16-NF-37': ['peerUnion'], 'P16-NF-38': ['missingPeer'],
  'P16-NF-46': ['observerCost', 'growth'], 'P16-NF-47': ['read'], 'P16-NF-48': ['read'],
  'P16-NF-50': ['sourceHistory', 'historicalRead'], 'P16-NF-53': ['cacheRows'],
} as const);

export function verifyP16MixedRuntimeProof(result: ReturnType<typeof exerciseP16MixedRuntimeProof>) {
  const receipts: Record<keyof typeof p16MixedRuntimeReceiptMap, boolean> = {
    'P16-NF-16': result.sourceHistory.initial === '1' && result.sourceHistory.staleAfterAdvance
      && result.sourceHistory.fresh === '2' && result.sourceHistory.persistedFacts === 2,
    'P16-NF-24': result.rateEvents.ids.join(',') === 'rate:a,rate:b' && result.rateEvents.collisionRefused
      && result.rateEvents.breakerTripsPerHour === 1 && result.resource.legacyOrigins.join(',') === 'reported,reported,reported,legacy-origin-lost',
    'P16-NF-33': result.aggregation.amount === 100 && result.burn.currentAmount === 120,
    'P16-NF-36': result.historicalRead.rows === 1 && result.historicalRead.deterministic,
    'P16-NF-37': result.peerUnion.state === 'complete' && result.peerUnion.members.length === 2,
    'P16-NF-38': result.missingPeer.state === 'partial' && result.missingPeer.missingPeers.length === 1 && result.missingPeer.skewRefused,
    'P16-NF-46': result.observerCost.amount === 5 && result.growth.observations === 1,
    'P16-NF-47': result.read.rows === 2 && result.read.partial,
    'P16-NF-48': result.read.privacyRefused,
    'P16-NF-50': result.historicalRead.deterministic && result.sourceHistory.persistedFacts === 2,
    'P16-NF-53': result.cacheRows === 1,
  };
  for (const [id, passed] of Object.entries(receipts)) if (!passed) throw new Error(`${id}: executable mixed-arm receipt failed`);
  return result;
}
