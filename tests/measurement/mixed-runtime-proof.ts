import { consumeResult, decode } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { foldProjection } from '../../src/projections/index.js';
import {
  aggregateMeasurements, createQuantityWitness, decodeAggregateMeasurementsPolicy, decodeMeasurementProducerContract,
  measurementProjectionDefinition, mergePeerMeasurements, resolveQuantity,
} from '../../src/measurement/index.js';
import { factsFixture, value } from '../facts/fixtures.js';
import { measurementFixture } from './fixture.js';

export function exerciseP16MixedRuntimeProof() {
  const owner = factsFixture();
  const fact = owner.fact({ kind: 'note', body: { identity: 'mixed-proof', amount: '1' } }, owner.ctx);
  const storage = { owner: 'part-ten' as const, read: () => [fact], append: () => { throw new Error('proof storage is read-only'); } };
  const snapshot = value(createFactStore(owner.ctx, storage).readForProjection());
  const generation = { reference: owner.c.register.generation, kinds: ['note'],
    lineages: { 'machine-a': { head: fact.segment, observedAt: 100, closed: false } } };
  const mf = measurementFixture();
  const definition = value(measurementProjectionDefinition(generation,
    { note: { identity: 'identity', value: 'amount', merge: 'additive' } }, mf.c));
  const projection = value(foldProjection(definition, snapshot, generation, owner.c));
  const copiedSnapshotRefused = consumeResult(foldProjection(definition, { ...snapshot, entries: [...snapshot.entries] } as never,
    generation, owner.c), { Success: () => false, Refused: () => true });

  const rateTypes = { ...mf.types, register: { ...mf.types.register,
    entries: [...mf.types.register.entries, 'producer:rate', 'rate-event-observed'],
    subjects: { ...mf.types.register.subjects, 'rate-event': ['count'] } } };
  const rateContext = { ...mf.c, register: rateTypes.register, types: rateTypes };
  const contract = value(decodeMeasurementProducerContract({ type: 'MeasurementProducerContract', schemaVersion: 2,
    id: 'producer:rate', family: 'rate-limit-event', subjectKind: 'rate-event', producer: 'probe',
    categories: [{ name: 'event', unit: 'count', relation: 'standalone' }], evidencePredicate: 'rate-event-observed',
    sourceSampleRequired: true, hardwareProfileRequired: false }, rateContext));
  const rate = (id: string) => value(createQuantityWitness({ contract, subjectInstance: id, sourceSample: id, category: 'event',
    measurement: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'rate-event', instance: id }, value: 1,
      unit: 'count', at: mf.now, by: 'probe' },
    evidence: mf.evidenceInput({ id, observedAt: mf.now, claim: { subject: id, predicate: 'rate-event-observed', value: 1 } }),
    sourceEvent: id, phase: 'final', predecessors: [], state: 'reported', hardwareProfile: null }, rateContext));
  const sameMillisecondEvents = [value(resolveQuantity([rate('rate:a')], undefined, rateContext)),
    value(resolveQuantity([rate('rate:b')], undefined, rateContext))];

  const first = mf.quantity('input', 40, 'exchange:a'); const second = mf.quantity('input', 60, 'exchange:b');
  const aggregatePolicy = value(decodeAggregateMeasurementsPolicy({ type: 'AggregateMeasurementsPolicy', schemaVersion: 2,
    id: 'aggregate:input', sourceKind: 'model-token', aggregateKind: 'measurement-window-aggregate', additiveUnits: ['tokens'],
    categories: ['input'], dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary' }, mf.c));
  const aggregate = value(aggregateMeasurements({ policy: aggregatePolicy, quantities: [first, second], unit: 'tokens', category: 'input',
    dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary', start: mf.clock(0), end: mf.clock(200),
    evaluationClock: mf.clock(200), frontier: 'frontier:mixed-proof' }, mf.c));
  const peerPool = value(mergePeerMeasurements([
    { peer: 'local', state: 'admitted', lastFrontier: 'frontier:local', quantities: [first] },
    { peer: 'offline', state: 'missing', lastFrontier: 'frontier:old', quantities: [] },
  ], mf.c));
  const admittedEvidence = value(decode('Evidence', mf.evidenceInput({ id: 'mixed-proof:evidence' }), mf.types));

  return { projection: projection.values['note:mixed-proof'], copiedSnapshotRefused,
    sameMillisecondEventIds: sameMillisecondEvents.flatMap(row => row.witnesses.map(witness => witness.sourceEvent)),
    aggregateAmount: aggregate.amount, aggregateMembers: aggregate.members.length, peerPool, admittedEvidence: admittedEvidence.id };
}
