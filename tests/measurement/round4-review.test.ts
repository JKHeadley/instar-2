import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { consumeResult, decode } from '../../src/index.js';
import {
  aggregateMeasurements, bindMeasurementReadSource, classifyLegacyResourceObservation, classifyProcesses,
  cpuUtilization, createBoundedReadCache, createQuantityWitness, decodeAggregateMeasurementsPolicy,
  decodeBurnPolicy, decodeMeasurementProducerContract, decodeMeasurementReadQuery, decodeReadCachePolicy,
  evaluateBurn, measurementProjectionDefinition, renderBoundedRead, renderCurrentMeasurementRead,
  renderMeasurementClaim, resolveQuantity, resourceTrend, summarizeRateLimitEvents,
} from '../../src/measurement/index.js';
import { judgmentFixture } from '../judgment/fixture.js';
import { refused, value } from '../facts/fixtures.js';
import { measurementFixture } from './fixture.js';

const aggregatePolicy = (f: ReturnType<typeof measurementFixture>, context = f.c) => value(decodeAggregateMeasurementsPolicy({
  type: 'AggregateMeasurementsPolicy', schemaVersion: 2, id: 'aggregate:input', sourceKind: 'model-token',
  aggregateKind: 'measurement-window-aggregate', additiveUnits: ['tokens'], categories: ['input'],
  dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary',
}, context));

describe('Part 16 round-four independent data-validation regressions', { timeout: 30_000 }, () => {
  it('R4-F01 binding:input-evidence-reused-as-output binding:foreign-evidence-producer binding:same-resource-evidence-new-sample burn:same-evidence-counted-twice', () => {
    const f = measurementFixture(); const witness = f.witness('input', 100, { sourceEvent: 'binding:input' });
    const input = { contract: f.producer, subjectInstance: 'exchange:1', sourceSample: 'exchange:1', category: 'input' as const,
      measurement: witness.measurement, evidence: witness.evidence, sourceEvent: witness.sourceEvent,
      phase: 'final' as const, predecessors: [], state: 'reported' as const, hardwareProfile: null };
    refused(createQuantityWitness({ ...input, category: 'output' }, f.c), 'category');
    refused(createQuantityWitness({ ...input, evidence: { ...witness.evidence, source: 'host' } }, f.c), 'producer');

    const resource = value(decodeMeasurementProducerContract(f.producerInput({ family: 'resource', subjectKind: 'process-resource',
      categories: [{ name: 'rss', unit: 'bytes', relation: 'standalone' }], hardwareProfileRequired: true }), f.c));
    const resourceInput = { ...input, contract: resource, subjectInstance: 'process:1', sourceSample: 'sample:100', category: 'rss',
      measurement: { ...witness.measurement, subject: { kind: 'process-resource', instance: 'process:1' }, unit: 'bytes' },
      evidence: f.evidenceInput({ id: 'binding:resource', claim: { subject: 'process:1', predicate: 'usage-observed',
        value: { amount: 100, category: 'rss', sourceSample: 'sample:100', producer: 'probe' } } }),
      sourceEvent: 'binding:resource', hardwareProfile: 'hardware:m1' };
    expect(value(createQuantityWitness(resourceInput, f.c)).sourceSample).toBe('sample:100');
    refused(createQuantityWitness({ ...resourceInput, sourceSample: 'sample:invented' }, f.c), 'source sample');
  });

  it('R4-F02 stale:quantity-after-contract-removed stale:burn-after-policy-removed', () => {
    const f = measurementFixture(); const quantity = f.quantity('input', 100);
    const current = f.burnWindow('current', [f.burnSample('current', 100, 20)]);
    const baseline = f.burnWindow('baseline', [f.burnSample('baseline', 20, 0)]);
    const register = { ...f.types.register, generation: { ...f.types.register.generation, id: 'generation:removed' },
      entries: f.types.register.entries.filter(id => !['producer:model', 'burn:feature-a', 'feature-a'].includes(id)), producers: [] };
    const stale = { ...f.c, register, types: { ...f.types, register } };
    refused(resolveQuantity(quantity.witnesses, undefined, stale), 'no longer current');
    refused(evaluateBurn(f.burnPolicy, f.closed, current, [baseline], stale), 'remain current');
  });

  it('R4-F03 burn:complete-census-has-unclassified-attempt burn:unresolved-comparison-amount-accepted', () => {
    const f = measurementFixture(); const current = f.burnWindow('current', [f.burnSample('current', 100, 20)]);
    const baseline = f.burnWindow('baseline', [f.burnSample('baseline', 20, 0)]);
    refused(evaluateBurn(f.burnPolicy, f.closed, { ...current, attemptedDispatches: 2 }, [baseline], f.c), 'constructor');
    const unresolved = value(resolveQuantity([
      f.witness('input', 1, { subject: 'other', sourceEvent: 'other:a' }),
      f.witness('input', 2, { subject: 'other', sourceEvent: 'other:b' }),
    ], undefined, f.c));
    const other = { identity: 'other', feature: 'other', source: 'model-exchange' as const,
      selectionVersion: 'v1', quantities: [unresolved] };
    refused(evaluateBurn(f.burnPolicy, f.closed, { ...current, samples: [...current.samples, other] }, [baseline], f.c), 'constructor');
  });

  it('R4-F04 burn:current-window-reused-as-baseline burn:relabel-other-feature-as-target burn:renamed-window-closes-without-new-observation', () => {
    const f = measurementFixture(); const baseline = f.burnWindow('baseline', [f.burnSample('baseline', 20, 0)]);
    const current = f.burnWindow('current', [f.burnSample('current', 100, 20)]);
    refused(evaluateBurn(f.burnPolicy, f.closed, current, [current], f.c));
    const other = f.burnWindow('other-current', [f.burnSample('other-current', 100, 20, 'other')]);
    expect(value(evaluateBurn(f.burnPolicy, f.closed, other, [baseline], f.c)).currentAmount).toBeNull();
    refused(evaluateBurn(f.burnPolicy, f.closed, { ...other,
      samples: other.samples.map(sample => ({ ...sample, feature: 'feature-a' })) }, [baseline], f.c), 'constructor');
    const recovery = f.burnWindow('recovery', [f.burnSample('recovery', 0, 0)], { comparisonScopeAmount: 20 });
    const first = value(evaluateBurn(f.burnPolicy,
      { state: 'open', recoveryCount: 0, notified: true, investigation: 'prior' }, recovery, [baseline], f.c));
    refused(evaluateBurn(f.burnPolicy, first.episode, { ...recovery, id: 'new-name' }, [baseline], f.c), 'constructor');
  });

  it('R4-F05 owner-resolution fields are closed and owner-supported disagreement resolves', () => {
    const f = measurementFixture(); const a = f.witness('input', 100, { sourceEvent: 'resolution:a' });
    const b = f.witness('input', 110, { sourceEvent: 'resolution:b' });
    const evidence = value(decode('Evidence', f.evidenceInput({ id: 'resolution:owner', observedAt: f.now,
      claim: { subject: a.key, predicate: 'quantity-resolved', value: { amount: 105, witnesses: ['resolution:a', 'resolution:b'] } } }), f.types));
    f.evidence.push(evidence);
    const resolution = { owner: 'probe', key: a.key, witnesses: ['resolution:a', 'resolution:b'], amount: 105, evidence };
    expect(value(resolveQuantity([a, b], resolution, f.c))).toMatchObject({ state: 'resolved', amount: 105 });
    for (const field of Object.keys(resolution)) {
      const missing = { ...resolution } as Record<string, unknown>; delete missing[field];
      refused(resolveQuantity([a, b], missing as never, f.c));
      refused(resolveQuantity([a, b], { ...resolution, [field]: field === 'owner' || field === 'key' ? 7 : 'INVALID' } as never, f.c));
    }
    refused(resolveQuantity([a], { owner: 'foreign', key: 'wrong', witnesses: [], amount: -1, evidence: {} } as never, f.c));
    refused(resolveQuantity([a, b], { ...resolution, extra: true } as never, f.c), 'undeclared');
  });

  it('R4-F06 aggregate:fractional-cpu-valid arithmetic:CPU-result-finite legacy:valid-fractional-cpu', () => {
    const f = measurementFixture();
    refused(cpuUtilization({ ...f.resourcePoint('overflow', 100, 1), cpuTimeMs: Number.MAX_VALUE,
      monotonicIntervalMs: Number.MIN_VALUE }, 1, 'one-core', f.c), 'not finite');
    expect(value(classifyLegacyResourceObservation({ id: 'legacy:fraction', source: 'own-resource-read', state: 'observed',
      value: 12.5, originalNumeric: true }, f.c)).amount).toBe(12.5);
    const types = { ...f.types, register: { ...f.types.register,
      subjects: { ...f.types.register.subjects, 'measurement-window-aggregate': ['tokens', 'ms'] } } };
    const context = { ...f.c, register: types.register, types };
    const contract = value(decodeMeasurementProducerContract(f.producerInput({ family: 'resource', subjectKind: 'process-resource',
      categories: [{ name: 'cpu', unit: 'ms', relation: 'standalone' }], hardwareProfileRequired: true }), context));
    const evidence = f.evidenceInput({ id: 'cpu:fraction', claim: { subject: 'process:1', predicate: 'usage-observed',
      value: { amount: 0.5, category: 'cpu', sourceSample: 'sample:100', producer: 'probe' } } });
    const witness = value(createQuantityWitness({ contract, subjectInstance: 'process:1', sourceSample: 'sample:100', category: 'cpu',
      measurement: { type: 'Measurement', schemaVersion: 1, subject: { kind: 'process-resource', instance: 'process:1' },
        value: 0.5, unit: 'ms', at: f.now, by: 'probe' }, evidence, sourceEvent: 'cpu:fraction', phase: 'final',
      predecessors: [], state: 'reported', hardwareProfile: 'hardware:m1' }, context));
    const quantity = value(resolveQuantity([witness], undefined, context));
    const policy = value(decodeAggregateMeasurementsPolicy({ type: 'AggregateMeasurementsPolicy', schemaVersion: 2,
      id: 'aggregate:input', sourceKind: 'process-resource', aggregateKind: 'measurement-window-aggregate', additiveUnits: ['ms'],
      categories: ['cpu'], dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary' }, context));
    expect(value(aggregateMeasurements({ policy, quantities: [quantity], unit: 'ms', category: 'cpu', dimensions: ['feature'],
      producer: 'probe', scope: 'scope:ordinary', start: f.clock(0), end: f.clock(200), evaluationClock: f.clock(200), frontier: 'f' }, context)).amount).toBe(0.5);
  });

  it('R4-F07 legacy:origin-lost-zero-preserved', () => {
    const f = measurementFixture();
    expect(value(classifyLegacyResourceObservation({ id: 'legacy:lost-zero', source: 'origin-lost', state: 'read-failed',
      value: 0, originalNumeric: false }, f.c))).toEqual({ id: 'legacy:lost-zero', state: 'legacy-origin-lost', amount: 0,
      reason: 'legacy numeric retained with origin unavailable' });
  });

  it('R4-F08 resource:missing-tick-omitted resource:witnesses-retained', () => {
    const f = measurementFixture(); const first = f.resourcePoint('p1', 100, 100);
    expect(value(resourceTrend([first, f.resourcePoint('p3', 100_000, 120)], 2, f.c)).state).toBe('incomplete');
    expect(value(resourceTrend([first, { ...first, id: 'witness:2' }, f.resourcePoint('p2', 160, 110)], 2, f.c)).points.map(row => row.id))
      .toEqual(['p1', 'witness:2', 'p2']);
  });

  it('R4-F09 rate:breaker-kind-on-session-source', () => {
    const f = measurementFixture();
    refused(summarizeRateLimitEvents([{ id: 'rate:bad', source: 'session-sentinel', kind: 'circuit-open', at: f.clock(100) }],
      f.clock(0), f.clock(200), f.c), 'inconsistent');
  });

  it('R4-F10 closes claim, projection, timeout, cache, and process public values', () => {
    const f = measurementFixture();
    const claim = { kind: 'target' as const, hardware: null, workload: null, evidence: [] };
    for (const field of Object.keys(claim)) {
      const missing = { ...claim } as Record<string, unknown>; delete missing[field];
      refused(renderMeasurementClaim(missing as never, f.c));
      refused(renderMeasurementClaim({ ...claim, [field]: {} } as never, f.c));
    }
    for (const input of [null, 7, {}, { kind: 'INVENTED', hardware: null, workload: null, evidence: [] },
      { ...claim, extra: true }])
      refused(renderMeasurementClaim(input as never, f.c));
    const generation = { reference: f.c.register.generation, kinds: ['note'], lineages: {} };
    const binding = { identity: 'identity', value: 'amount', merge: 'additive' as const };
    for (const field of Object.keys(binding)) {
      const missing = { ...binding } as Record<string, unknown>; delete missing[field];
      refused(measurementProjectionDefinition(generation, { note: missing } as never, f.c));
      refused(measurementProjectionDefinition(generation, { note: { ...binding, [field]: {} } } as never, f.c));
    }
    refused(measurementProjectionDefinition(generation, { note: { ...binding, kind: 'INVENTED' } } as never, f.c));
    for (const input of [null, [], 'binding', 7]) refused(measurementProjectionDefinition(generation, input as never, f.c));
    refused(renderBoundedRead(f.query, [f.readRow('one')], 'false' as never, f.c), 'boolean');
    refused(classifyProcesses([{ processIncarnation: 'process:1', pid: 7, startEvidence: 'start:1', tags: ['worker'] },
      { processIncarnation: 'process:1', pid: 7, startEvidence: 'start:1', tags: ['worker'] }],
    [{ className: 'agent-worker', requiredTags: ['worker'] }], f.c), 'more than once');
    const cache = value(createBoundedReadCache(value(decodeReadCachePolicy({ type: 'ReadCachePolicy', schemaVersion: 2,
      id: 'cache:r4', maxRows: 2, maxBytes: 100, maxAgeMs: 10, evictionBatch: 1 }, f.c)), f.c));
    refused(cache.get(null as never)); refused(cache.get('')); refused(cache.applyEviction([7] as never));
    value(cache.put({ key: 'timed', createdAt: f.clock(100), bytes: 'one', byteLength: 3 }));
    const foreignClock = value(decode('Measurement', f.clockRaw(120, 'machine-b'), f.types));
    refused(cache.planEviction(foreignClock as never), 'clock');
  });

  it('R4-F11 decoder-order:cold policy:registered-id-reinterpreted-as-other-family policy:unknown-burn-unit', () => {
    const f = measurementFixture();
    expect(aggregatePolicy(f).id).toBe('aggregate:input');
    refused(decodeMeasurementProducerContract(f.producerInput({ family: 'quota' }), f.c), 'family');
    refused(decodeMeasurementProducerContract(f.producerInput({ family: 'resource', subjectKind: 'process-resource',
      categories: [{ name: 'rss', unit: 'bytes', relation: 'standalone' }], sourceSampleRequired: false,
      hardwareProfileRequired: false }), f.c), 'requires');
    refused(decodeBurnPolicy(f.burnPolicyInput({ unit: 'alien',
      selections: [{ ...f.selection('model-exchange', ['input']), outputUnit: 'alien' }] }), f.c), 'not registered');
  });

  it('R4-F12 read:unwitnessed-page and current historical reads bind the exact owner snapshot and fold', async () => {
    const owner = judgmentFixture(); value(await owner.door.judge(owner.input, owner.start()));
    const f = measurementFixture(); const snapshot = value(owner.store.readForProjection());
    const register = { ...owner.ctx.decode.register,
      entries: [...new Set([...owner.ctx.decode.register.entries, ...f.types.register.entries])],
      producers: [...new Set([...owner.ctx.decode.register.producers, ...f.types.register.producers])],
      subjects: { ...owner.ctx.decode.register.subjects, ...f.types.register.subjects } };
    const types = { ...owner.ctx.decode, register };
    const context = { ...f.c, register, types };
    const kinds = [...new Set(snapshot.entries.map(row => row.fact.kind))].sort();
    const lineages = Object.fromEntries([...new Set(snapshot.entries.map(row => row.fact.machine))].map(machine => {
      const fact = snapshot.entries.filter(row => row.fact.machine === machine).map(row => row.fact)
        .sort((a, b) => a.segment.epoch - b.segment.epoch || a.segment.position - b.segment.position).at(-1)!;
      return [machine, { head: fact.segment, observedAt: null, closed: false }];
    }));
    const sourceGeneration = { reference: register.generation, kinds, lineages };
    const sourceDefinition = value(measurementProjectionDefinition(sourceGeneration, {}, context));
    const source = { sourceHistory: snapshot, sourceDefinition, sourceGeneration };
    const binding = value(bindMeasurementReadSource(source, context));
    const query = value(decodeMeasurementReadQuery(f.queryInput({ ...binding }), context));
    const row = f.readRow('history:one', 100, {}, binding);
    const readContext = { ...context, types: { ...types, evidence: [...(types.evidence ?? []), ...f.evidence] } };
    const request = { ...source, query, rows: [row], timedOut: false };
    const first = value(renderCurrentMeasurementRead(request, readContext));
    const second = value(renderCurrentMeasurementRead(request, readContext));
    expect(first).toEqual(second); expect(first).toMatchObject({ totalCount: 1, ...binding });
    refused(renderBoundedRead(query, [{ ...row, amount: 999 }], false, readContext), 'does not bind');
    const head = snapshot.entries.map(entry => entry.fact)
      .sort((a, b) => a.segment.epoch - b.segment.epoch || a.segment.position - b.segment.position).at(-1)!;
    value(owner.store.append(owner.next(head, { kind: 'judgment-context-evidence', body: { evidence: owner.evidence[0]! } }, owner.ctx)));
    refused(renderCurrentMeasurementRead(request, readContext), 'current admitted status snapshot');
  });

  it('R4-F13 contract evidence uses the named semantics and P16-NF-53 is explicitly supplemental', () => {
    const map = readFileSync('scripts/check-p16-contract-map.mjs', 'utf8');
    const runtime = readFileSync('tests/measurement/mixed-runtime-proof.ts', 'utf8');
    expect(map).toContain('SUPPLEMENTAL-EXECUTABLE-NON-GOVERNING');
    expect(runtime).toContain("'P16-NF-36': ['historicalRead']");
    expect(runtime).toContain("'P16-NF-37': ['peerUnion']");
    expect(runtime).toContain("'P16-NF-38': ['missingPeer']");
  });

  it('R4-F14 exports @instar/constitutional-types/measurement', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { exports: Record<string, unknown> };
    expect(pkg.exports['./measurement']).toEqual({ types: './dist/measurement/index.d.ts', default: './dist/measurement/index.js' });
  });
});
