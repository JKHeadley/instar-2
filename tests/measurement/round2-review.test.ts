import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { canonical, consumeResult, decode } from '../../src/index.js';
import {
  aggregateMeasurements, classifyFeatureOutcome, cpuUtilization, createBoundedReadCache, createQuantityWitness,
  decodeAggregateMeasurementsPolicy, decodeBurnPolicy, decodeMeasurementProducerContract, decodeMeasurementReadQuery,
  decodeReadCachePolicy, evaluateBurn, renderBoundedRead, renderMeasurementClaim, resolveAttribution, resolveQuantity,
  resourceTrend,
} from '../../src/measurement/index.js';
import { judgmentFixture } from '../judgment/fixture.js';
import { refused, value } from '../facts/fixtures.js';
import { measurementFixture } from './fixture.js';
// @ts-expect-error Executable repository contract checker is intentionally JavaScript.
import { checkP16Architecture, p16Dispositions } from '../../scripts/check-p16-contract-map.mjs';

const aggregatePolicy = (f: ReturnType<typeof measurementFixture>, sourceKind = 'model-token') => value(decodeAggregateMeasurementsPolicy({
  type: 'AggregateMeasurementsPolicy', schemaVersion: 2, id: 'aggregate:input', sourceKind,
  aggregateKind: 'measurement-window-aggregate', additiveUnits: ['tokens'], categories: ['input'],
  dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary',
}, f.c));

const aggregate = (f: ReturnType<typeof measurementFixture>, quantities: readonly ReturnType<typeof f.quantity>[],
  overrides: Record<string, unknown> = {}) => ({ policy: aggregatePolicy(f), quantities, unit: 'tokens', category: 'input',
  dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary', start: f.clock(0), end: f.clock(200),
  evaluationClock: f.clock(200), frontier: 'frontier:review', ...overrides });

describe('Part 16 round-two independent data-validation reproductions', { timeout: 30_000 }, () => {
  it('R2-F01 copied, altered, stale, and selectively supplied history cannot become attribution', async () => {
    const owner = judgmentFixture();
    value(await owner.door.judge(owner.input, owner.start()));
    const snapshot = value(owner.store.readForProjection());
    const f = measurementFixture();
    const context = { ...f.c, register: owner.ctx.decode.register, types: owner.ctx.decode };
    const request = { attempt: `attempt:${owner.input.id}:1`, claimed: { feature: 'forged', model: 'forged', machine: 'forged' },
      evaluationClock: owner.now, sourceHistory: snapshot, candidates: [] };
    expect(value(resolveAttribution(request, context))).toMatchObject({ state: 'attributed', feature: 'judgment', model: 'model' });
    refused(resolveAttribution({ ...request, sourceHistory: { ...snapshot, entries: [...snapshot.entries] } as never }, context), 'current admitted status snapshot');
    refused(resolveAttribution({ ...request, sourceHistory: { ...snapshot, entries: snapshot.entries.map(row => ({ ...row,
      fact: { ...row.fact, machine: 'machine:forged' } })) } as never }, context), 'current admitted status snapshot');
    const head = snapshot.entries.map(row => row.fact).sort((a, b) => a.segment.position - b.segment.position).at(-1)!;
    value(owner.store.append(owner.next(head, { kind: 'judgment-context-evidence', body: { evidence: owner.evidence[0]! } }, owner.ctx)));
    refused(resolveAttribution(request, context), 'current admitted status snapshot');
    const current = value(owner.store.readForProjection());
    expect(value(resolveAttribution({ ...request, sourceHistory: current, candidates: [{ attempt: request.attempt, factReferences: ['omitted'] }] }, context)).state)
      .toBe('attributed');
  });

  it('R2-F02 unregistered and counterfeit decoded contracts are refused', () => {
    const f = measurementFixture();
    refused(decodeMeasurementProducerContract(f.producerInput({ id: 'unregistered', producer: 'counterfeit',
      subjectKind: 'counterfeit', evidencePredicate: 'counterfeit' }), f.c), 'not registered');
    const witness = f.witness('input', 100);
    refused(createQuantityWitness({ contract: Object.freeze({ ...f.producer, id: 'counterfeit' }) as never, subjectInstance: 'exchange:1',
      sourceSample: 'exchange:1', category: 'input', measurement: witness.measurement, evidence: witness.evidence,
      sourceEvent: witness.sourceEvent, phase: 'final', predecessors: [], state: 'reported', hardwareProfile: null }, f.c), 'decoder');
    const baseline = f.burnWindow('baseline', [f.burnSample('baseline', 20, 0)]);
    refused(evaluateBurn(Object.freeze({ ...f.burnPolicy, entryShare: -1, recoveryWindows: 0 }) as never, f.closed,
      f.burnWindow('current', [f.burnSample('current', 100, 20)]), [baseline], f.c), 'decoder');
  });

  it('R2-F03 quantity amount, phase, copied witness, predecessor, and owner resolution are witnessed', () => {
    const f = measurementFixture(); const witness = f.witness('input', 100);
    refused(createQuantityWitness({ contract: f.producer, subjectInstance: 'exchange:1', sourceSample: 'exchange:1', category: 'input',
      measurement: { ...witness.measurement, value: 999 }, evidence: witness.evidence, sourceEvent: witness.sourceEvent,
      phase: 'final', predecessors: [], state: 'reported', hardwareProfile: null }, f.c), 'evidence claim');
    refused(createQuantityWitness({ contract: f.producer, subjectInstance: 'exchange:1', sourceSample: 'exchange:1', category: 'input',
      measurement: witness.measurement, evidence: witness.evidence, sourceEvent: witness.sourceEvent,
      phase: 'invented', predecessors: [], state: 'reported', hardwareProfile: null } as never, f.c), 'phase');
    refused(resolveQuantity([{ ...witness, measurement: { ...witness.measurement, value: 999 } } as never], undefined, f.c), 'constructor');
    const a = f.witness('input', 100, { sourceEvent: 'quantity:a' });
    const b = f.witness('input', 110, { sourceEvent: 'quantity:b' });
    expect(value(resolveQuantity([a, b], undefined, f.c)).state).toBe('unresolved');
    refused(resolveQuantity([a, { ...b, predecessors: ['quantity:a'] }], undefined, f.c), 'constructor');
    const evidence = value(decode('Evidence', f.evidenceInput({ id: 'quantity:resolution', observedAt: f.now,
      claim: { subject: a.key, predicate: 'quantity-resolved', value: 105 } }), f.types));
    refused(resolveQuantity([a, b], { owner: 'probe', key: a.key, witnesses: ['quantity:a', 'quantity:b'], amount: 999, evidence }, f.c),
      'signed-history reference');
  });

  it('R2-F04 aggregates require issued compatible witnesses in the half-open window and retain witness ids', () => {
    const f = measurementFixture(); const quantity = f.quantity('input', 100);
    refused(aggregateMeasurements(aggregate(f, [{ key: 'invented', amount: 999, state: 'resolved', witnesses: [], reason: 'invented' } as never]), f.c), 'resolution');
    refused(aggregateMeasurements(aggregate(f, [{ ...quantity, amount: 999 }]), f.c), 'resolution');
    refused(decodeAggregateMeasurementsPolicy({ type: 'AggregateMeasurementsPolicy', schemaVersion: 2, id: 'aggregate:input',
      sourceKind: 'other-source-kind', aggregateKind: 'measurement-window-aggregate', additiveUnits: ['tokens'], categories: ['input'],
      dimensions: ['feature'], producer: 'probe', scope: 'scope:ordinary' }, f.c), 'subject kind');
    refused(aggregateMeasurements(aggregate(f, [quantity], { end: f.clock(100) }), f.c), 'half-open');
    expect(value(aggregateMeasurements(aggregate(f, [quantity]), f.c)).members).toEqual([quantity.witnesses[0]!.sourceEvent]);
  });

  it('R2-F05 model-only and migrated legacy burn policies are admitted', () => {
    const f = measurementFixture();
    expect(value(decodeBurnPolicy(f.burnPolicyInput({ selections: [f.selection('model-exchange', ['input', 'output'])] }), f.c)).selections).toHaveLength(1);
    const legacy = { ...f.burnPolicyInput(), schemaVersion: 1, selection: f.selection('model-exchange', ['input', 'output']), minimumSamples: 1 } as Record<string, unknown>;
    delete legacy.selections; delete legacy.minimumEligibleSamples;
    expect(value(decodeBurnPolicy(legacy, f.c)).selections).toHaveLength(1);
  });

  it('R2-F06 incomplete burn evidence retains the episode and resets recovery', () => {
    const f = measurementFixture(); const baseline = f.burnWindow('baseline', [f.burnSample('baseline', 20, 0)]);
    const result = value(evaluateBurn(f.burnPolicy, { state: 'open', recoveryCount: 1, notified: true, investigation: 'prior' },
      f.burnWindow('uncertain', [f.burnSample('uncertain', 0, 0)], { comparisonScopeAmount: 20, dispatchUncertain: 1, attemptedDispatches: 2 }), [baseline], f.c));
    expect(result).toMatchObject({ classification: 'incomplete', confidence: 'insufficient-evidence', episode: { state: 'open', recoveryCount: 0 } });
  });

  it('R2-F07 burn population rejects incompatible quantities, counts, duplicates, and unproved denominators', () => {
    const f = measurementFixture(); const baseline = f.burnWindow('baseline', [f.burnSample('baseline', 20, 0)]);
    refused(evaluateBurn(f.burnPolicy, f.closed, f.burnWindow('counts', [f.burnSample('counts', 0, 0)], {
      observedExchanges: 1, usageSupportedExchanges: 2 }), [baseline], f.c), 'exceed');
    refused(evaluateBurn(f.burnPolicy, f.closed, f.burnWindow('denominator', [f.burnSample('denominator', 100, 20)], {
      comparisonScopeAmount: 1 }), [baseline], f.c), 'denominator');
    const sample = f.burnSample('duplicate', 100, 20);
    refused(evaluateBurn(f.burnPolicy, f.closed, f.burnWindow('duplicate', [{ ...sample,
      quantities: [...sample.quantities, f.quantity('input', 999, 'duplicate')] }], { comparisonScopeAmount: 1200 }), [baseline], f.c), 'competing');
    const altered = { ...sample, quantities: sample.quantities.map(quantity => ({ ...quantity, witnesses: quantity.witnesses.map(witness => ({ ...witness,
      measurement: { ...witness.measurement, unit: 'bytes', subject: { kind: 'process-resource', instance: 'other' } } })) })) };
    refused(evaluateBurn(f.burnPolicy, f.closed, { ...f.burnWindow('altered', []), samples: [altered], observedExchanges: 1,
      usageSupportedExchanges: 1, attemptedDispatches: 1, comparisonScopeAmount: 200 } as never, [baseline], f.c), 'resolution');
  });

  it('R2-F08 burn recovery is replay-safe and a later episode notifies independently', () => {
    const f = measurementFixture(); const baseline = f.burnWindow('baseline', [f.burnSample('baseline', 20, 0)]);
    const recovery = f.burnWindow('same', [f.burnSample('same', 0, 0)], { comparisonScopeAmount: 20 });
    const first = value(evaluateBurn(f.burnPolicy, { state: 'open', recoveryCount: 0, notified: true, investigation: 'prior' }, recovery, [baseline], f.c));
    const replay = value(evaluateBurn(f.burnPolicy, first.episode, recovery, [baseline], f.c));
    expect(replay.episode).toMatchObject({ state: 'open', recoveryCount: 1 });
    const high = f.burnWindow('high', [f.burnSample('high', 100, 20)], { comparisonScopeAmount: 200 });
    const opened = value(evaluateBurn(f.burnPolicy, f.closed, high, [baseline], f.c));
    const closed = value(evaluateBurn(f.burnPolicy, opened.episode,
      f.burnWindow('inactive', [], { attemptedDispatches: 1, provenNoExchange: 1 }), [baseline], f.c));
    const later = value(evaluateBurn(f.burnPolicy, closed.episode, { ...high, id: 'later' }, [baseline], f.c));
    expect(later).toMatchObject({ notify: true, openInvestigation: true });
  });

  it('R2-F09 execution and action labels require admitted Evidence', () => {
    const f = measurementFixture();
    refused(renderMeasurementClaim({ kind: 'recorded-execution', hardware: 'invented', workload: 'invented', evidence: ['never-executed'] }, f.c), 'not admitted');
    expect(value(classifyFeatureOutcome({ kind: 'exchange', classifier: 'complete', actionProved: true,
      negativeProved: false, gradeOnly: false, feature: 'feature-a', action: 'feature-action-observed', evaluationClock: f.now }, f.c))).toBe('unclassified');
  });

  it('R2-F10 default reads refuse invalid enums, negative amounts, and nested private values', () => {
    const f = measurementFixture();
    refused(renderBoundedRead(f.query, [f.readRow('bad', 100, { family: 'invented', state: 'invented', amount: -10 } as never)], false, f.c), 'closed set');
    refused(renderBoundedRead(f.query, [f.readRow('private', 100, { feature: { secret: 'synthetic', prompt: 'private' } } as never)], false, f.c), 'text or absent');
  });

  it('R2-F11 cursors bind source/query and export bounds include a progressing response', () => {
    const f = measurementFixture();
    const query = value(decodeMeasurementReadQuery(f.queryInput({ pageSize: 1 }), f.c));
    const first = value(renderBoundedRead(query, [f.readRow('a'), f.readRow('b')], false, f.c));
    const foreign = value(decodeMeasurementReadQuery(f.queryInput({ id: 'foreign', pageSize: 1, cursor: first.nextCursor }), f.c));
    refused(renderBoundedRead(foreign, [f.readRow('x'), f.readRow('y')], false, f.c), 'another query or source');
    const tiny = value(decodeMeasurementReadQuery(f.queryInput({ maxExportBytes: 1 }), f.c));
    refused(renderBoundedRead(tiny, [f.readRow('one')], false, f.c), 'cannot encode');
    expect(first.exportBytes).toBe(Buffer.byteLength(value(canonical(first)).bytes));
  });

  it('R2-F12 resource arithmetic closes basis/state/incarnation and coalesces equal sample witnesses', () => {
    const f = measurementFixture();
    refused(cpuUtilization(f.resourcePoint('one', 100, 100), 4, 'invented' as never, f.c), 'closed set');
    refused(resourceTrend([f.resourcePoint('one', 100, -1), f.resourcePoint('two', 160, 110)], 2, f.c), 'RSS bytes');
    expect(value(resourceTrend([f.resourcePoint('one', 100, 100), f.resourcePoint('two', 160, 110, {
      processIncarnation: 'other' })], 2, f.c)).state).toBe('incomplete');
    const a = f.resourcePoint('a', 100, 100); const b = { ...a, id: 'peer:b' }; const c = f.resourcePoint('c', 160, 110);
    expect(value(resourceTrend([a, b, c], 2, f.c))).toMatchObject({ state: 'complete', rssDeltaBytes: 10, points: [{ id: 'a' }, { id: 'c' }] });
  });

  it('R2-F13 cache clocks must be complete admitted measurements', () => {
    const f = measurementFixture(); const policy = value(decodeReadCachePolicy({ type: 'ReadCachePolicy', schemaVersion: 2,
      id: 'cache:review', maxRows: 2, maxBytes: 100, maxAgeMs: 20, evictionBatch: 1 }, f.c));
    const cache = value(createBoundedReadCache(policy, f.c));
    refused(cache.put({ key: 'a', createdAt: { value: 100 } as never, bytes: 'row', byteLength: 3 }));
    value(cache.put({ key: 'a', createdAt: f.clock(100), bytes: 'row', byteLength: 3 }));
    refused(cache.planEviction({ value: 121 } as never));
    expect(value(cache.planEviction(f.clock(121)))).toEqual(['a']);
  });

  it('R2-F14 the contract map requires an executed mixed-arm proof, not labels alone', () => {
    expect(checkP16Architecture()).toMatchObject({ proofFiles: 3 });
  });

  it('R2-F15 mixed executable and unavailable arms retain exact named grants', () => {
    const rows = p16Dispositions() as { id: string; status: string; dependencies: string[] }[];
    for (const id of ['P16-NF-16', 'P16-NF-24', 'P16-NF-33', 'P16-NF-36', 'P16-NF-37', 'P16-NF-38',
      'P16-NF-46', 'P16-NF-47', 'P16-NF-48', 'P16-NF-50'])
      expect(rows.find(row => row.id === id)?.status).toMatch(/^MIXED-EXECUTABLE-FOUNDATION-PLUS-/);
    expect(rows.find(row => row.id === 'P16-NF-24')?.dependencies.join(' ')).toContain('P16-P10-process-resource-observation-v1');
    expect(rows.find(row => row.id === 'P16-NF-47')?.dependencies.join(' ')).toContain('P16-P11-measurement-spend-surface-v1');
  });

  it('R2-F16 all 53 fixture ids are mapped and main-owned package/root files remain byte-identical', () => {
    const rows = p16Dispositions() as { id: string }[];
    expect(rows).toHaveLength(53); expect(rows.at(-1)?.id).toBe('P16-NF-53');
    expect(execFileSync('git', ['diff', '--name-only', 'main', '--', 'src/index.ts', 'package.json'], { encoding: 'utf8' }).trim()).toBe('');
  });
});
