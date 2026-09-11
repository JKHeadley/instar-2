import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import type { FactContext, FactSchema } from '../../src/facts/index.js';
import { checkpoint, foldProjection, readProjection, verifyRebuild } from '../../src/projections/index.js';
import {
  createBoundedReadCache,
  createMeasurementLedger,
  decodeReadCachePolicy,
  growthInvestigationLink,
  measurementProjectionDefinition,
} from '../../src/measurement/index.js';
import { decodeAssemblyRecord } from '../../src/assembly/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { factsFixture, refused, value } from '../facts/fixtures.js';
import { measurementFixture } from '../measurement/fixture.js';
// @ts-expect-error The physical file adapter is an executable JavaScript boundary.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';

it('P16-NF-12 P16-NF-13 P16-NF-39 P16-NF-40 P16-NF-41 P16-NF-46 durable lifecycle rebuilds from signed facts, invalidates stale views, and reconstructs disposable cache', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p16-measurement-'));
  const f = factsFixture();
  const evidence = value(decode('Evidence', f.evidenceInput({ id: 'attribution:lifecycle', observedAt: f.now, freshFor: 100,
    claim: { subject: 'attempt:lifecycle', predicate: 'registered-measurement-attribution',
      value: { feature: 'feature:signed', model: 'model:signed', run: 'run:signed' } } }), f.ctx.decode));
  f.evidence.push(evidence);
  const attributionSchema: FactSchema = { kind: 'measurement-attribution', version: 1,
    fields: { evidence: { kind: 'constitutional', type: 'Evidence' } }, machineScope: 'shared', standing: 'requester',
    action: 'work', scope: f.scope, causallyBound: false, requiredReferences: [], authority: 'none' };
  const context: FactContext = { ...f.ctx, schemas: [...f.ctx.schemas, attributionSchema], decode: { ...f.ctx.decode, evidence: f.evidence } };
  const storage = createTransportFileStorage(directory, <T>(run: () => T) => f.success(run()));
  const store = createFactStore(context, storage);
  const attributionFact = value(store.append(f.wire({ kind: attributionSchema.kind, body: { evidence } }, context))).fact;
  const note = f.next(attributionFact, { kind: 'note', body: { identity: 'one', amount: '10' } }, context);
  value(store.append(note));
  const snapshot = value(store.readForProjection());
  const generation = { reference: f.c.register.generation, kinds: ['measurement-attribution', 'note'],
    lineages: { 'machine-a': { head: note.segment, observedAt: 100, closed: false } } };
  const mf = measurementFixture(); const measurementContext = { ...mf.c, types: context.decode };
  const definition = value(measurementProjectionDefinition(generation, { note: { identity: 'identity', value: 'amount', merge: 'additive' } }, measurementContext));
  const firstView = value(foldProjection(definition, snapshot, generation, f.c));
  expect(firstView.values['note:one']).toBe('10');
  expect(value(createMeasurementLedger(measurementContext).attribute({ attempt: 'attempt:lifecycle',
    claimed: { feature: 'forged', model: 'forged', machine: 'forged' }, evaluationClock: f.now, sourceHistory: snapshot,
    candidates: [{ attempt: 'attempt:lifecycle', factReferences: [attributionFact.id] }] })))
    .toMatchObject({ state: 'attributed', feature: 'feature:signed', machine: 'machine-a' });

  const restartedStore = createFactStore(context, storage);
  const restartedSnapshot = value(restartedStore.readForProjection());
  const rebuilt = value(foldProjection(definition, restartedSnapshot, generation, f.c));
  expect(value(verifyRebuild(checkpoint(firstView), checkpoint(rebuilt), f.c))).toBe('equal');

  const cachePolicy = value(decodeReadCachePolicy({ type: 'ReadCachePolicy', schemaVersion: 2, id: 'cache:lifecycle',
    maxRows: 2, maxBytes: 100, maxAgeMs: 20, evictionBatch: 1 }, mf.c));
  const cache = createBoundedReadCache(cachePolicy, mf.c);
  value(cache.put({ key: 'old', createdAt: mf.clock(100), bytes: 'disposable', byteLength: 10 }));
  expect(value(createBoundedReadCache(cachePolicy, mf.c).inspect())).toEqual([]);

  const later = f.next(note, { kind: 'note', body: { identity: 'one', amount: '5' } }, context);
  value(restartedStore.append(later));
  refused(foldProjection(definition, snapshot, generation, f.c), 'current admitted status snapshot');
  refused(readProjection(firstView, definition, f.now, f.c), 'source changed');
  const currentSnapshot = value(createFactStore(context, storage).readForProjection());
  const currentGeneration = { ...generation, lineages: { 'machine-a': { head: later.segment, observedAt: 100, closed: false } } };
  const currentDefinition = value(measurementProjectionDefinition(currentGeneration, { note: { identity: 'identity', value: 'amount', merge: 'additive' } }, measurementContext));
  expect(value(foldProjection(currentDefinition, currentSnapshot, currentGeneration, f.c)).values['note:one']).toBe('15');

  const growthPolicy = value(decodeAssemblyRecord('GrowthPolicy', assemblyInput('GrowthPolicy'), f.c));
  const growthObservation = value(decodeAssemblyRecord('GrowthObservation', { ...assemblyInput('GrowthObservation'),
    comparisons: [{ subject: 'genesis-replay-duration', kind: 'measured', value: 15, threshold: 10, result: 'soft-breach' }] }, f.c));
  expect(value(growthInvestigationLink(growthPolicy, [growthObservation, growthObservation], mf.c)))
    .toMatchObject({ run: growthPolicy.ownerRun, loop: growthPolicy.loopPolicy, observations: [growthObservation.id] });
}, 30_000);

it('P16-NF-01 P16-NF-02 P16-NF-05 P16-NF-22 P16-NF-23 P16-NF-25 P16-NF-26 P16-NF-27 P16-NF-28 P16-NF-29 P16-NF-30 P16-NF-33 P16-NF-34 P16-NF-47 P16-NF-48 P16-NF-52 fresh process exposes only bounded observational measurement operations', () => {
  const f = measurementFixture();
  const code = `
    import { readFileSync } from 'node:fs';
    import { consumeResult, decodeMeasurement } from '@instar/constitutional-types';
    import { classifyFeatureOutcome, coalesceUnknownQuotaEpisodes, createMeasurementLedger, decodeBurnPolicy,
      decodeMeasurementProducerContract, decodeMeasurementReadQuery, renderMeasurementClaim } from '@instar/constitutional-types/measurement';
    const seed = JSON.parse(readFileSync(0, 'utf8'));
    const take = result => consumeResult(result, { Success: value => value, Refused: refusal => { throw new Error(refusal.detail); } });
    const now = take(decodeMeasurement('clock', seed.now, seed.types));
    const types = { ...seed.types, now };
    const context = { site: 'types.decode', preserved: seed.preserved, register: types.register, types };
    const producer = take(decodeMeasurementProducerContract(seed.producer, context));
    const policy = take(decodeBurnPolicy(seed.burnPolicy, context));
    const query = take(decodeMeasurementReadQuery(seed.query, context));
    const port = createMeasurementLedger(context);
    const start = take(decodeMeasurement('clock', seed.start, types));
    const read = take(port.read(query, [{ identity: 'one', family: 'model-call', category: 'input', at: start, amount: 1,
      unit: 'tokens', state: 'reported', producer: 'probe', sourceSample: 'one', feature: null, model: null, machine: 'machine-a' }]));
    console.log(JSON.stringify({ owner: port.owner, operations: Object.keys(port).sort(), producer: producer.id, policy: policy.id,
      rows: read.totalCount, unknown: take(coalesceUnknownQuotaEpisodes(['quota:one'], [], context)).notices.length,
      outcome: take(classifyFeatureOutcome({ kind: 'exchange', classifier: 'absent', actionProved: false, negativeProved: false, gradeOnly: false }, context)),
      claim: take(renderMeasurementClaim({ kind: 'estimate', hardware: null, workload: null, evidence: [] }, context)) }));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', code], { input: JSON.stringify({
    types: f.types, preserved: f.c.preserved, now: f.clock(200), start: f.clock(0), producer: f.producerInput(),
    burnPolicy: f.burnPolicyInput(), query: f.queryInput(),
  }), encoding: 'utf8' });
  expect(JSON.parse(output)).toEqual({ owner: 'part-sixteen', operations: ['aggregate', 'attribute', 'evaluateBurn', 'owner', 'read', 'resolveQuantity', 'trend'],
    producer: 'producer:model', policy: 'burn:feature-a', rows: 1, unknown: 1, outcome: 'unclassified', claim: 'estimate: not measured' });
});
