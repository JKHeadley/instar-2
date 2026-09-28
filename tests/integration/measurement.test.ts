import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { decode, decodeMeasurement } from '../../src/index.js';
import {
  admitMeasurementAmount, classifyFeatureOutcome, classifyProcesses, coalesceUnknownQuotaEpisodes,
  cpuUtilization, createMeasurementLedger, decodeBurnPolicy, decodeMeasurementProducerContract, decodeReadCachePolicy,
  planProcessCensus, reconcileProcessIncarnation, renderMeasurementClaim, resourceTrend,
  summarizeRateLimitEvents,
} from '../../src/measurement/index.js';
// @ts-expect-error Repository contract checker is intentionally JavaScript.
import { checkP16Coverage, p16Dispositions } from '../../scripts/check-p16-contract-map.mjs';
import { refused, value } from '../facts/fixtures.js';
import { measurementFixture } from '../measurement/fixture.js';

it('P16-NF-01 [behavior:contract-inventory] resolves the complete governed check inventory', () => {
  expect(p16Dispositions()).toHaveLength(53);
});

it('P16-NF-03 [behavior:registration-current-content] enforces current identity and content bindings', () => {
  const f = measurementFixture();
  expect(value(decodeReadCachePolicy(f.cachePolicyInput, f.c)).id).toBe('cache:fixture');
  refused(decodeReadCachePolicy(f.cachePolicyInput, { ...f.c,
    register: { ...f.c.register, entries: f.c.register.entries.filter(id => id !== 'cache:fixture') },
  }), 'identity is not registered');
  const invented = { ...f.modelProducerInput,
    categories: [{ name: 'fictional-token', unit: 'tokens', relation: 'standalone' as const }] };
  refused(decodeMeasurementProducerContract(invented, f.withRegistered(invented)), 'content binding');
  const sampled = { ...f.modelProducerInput, id: 'producer:quota', family: 'quota' as const,
    subjectKind: 'quota', categories: [{ name: 'value', unit: 'percent', relation: 'standalone' as const }] };
  const register = { ...f.types.register, subjects: { ...f.types.register.subjects, quota: ['percent'] } };
  const sampledContext = f.withRegistered(sampled, { ...f.c, register,
    types: { ...f.types, register } });
  refused(decodeMeasurementProducerContract({ ...sampled, sourceSampleRequired: false }, sampledContext),
    'source sample identity');
  for (const [id, recoveryExcess, recoveryShare] of [
    ['burn:equal-excess', 50, 0.49], ['burn:equal-share', 49, 0.5], ['burn:equal-both', 50, 0.5],
  ] as const) {
    const raw = { ...f.burnPolicyInput, id, recoveryExcess, recoveryShare };
    refused(decodeBurnPolicy(raw, f.withRegistered(raw)), 'strictly lower');
  }
});

it('P16-NF-05 [behavior:measured-claim] requires admitted named execution evidence', () => {
  const f = measurementFixture();
  expect(value(renderMeasurementClaim({ kind: 'target', hardware: null, workload: null, evidence: [] }, f.c)))
    .toBe('target: not measured');
  const evidence = value(decode('Evidence', f.evidenceInput({ id: 'execution:integration', claim: {
    subject: 'run:a', predicate: 'execution-observed', value: { hardware: 'm1', workload: 'w1' },
  } }), f.types));
  const context = { ...f.c, types: { ...f.types, evidence: [evidence] } };
  expect(value(renderMeasurementClaim({ kind: 'recorded-execution', hardware: 'm1', workload: 'w1',
    evidence: [evidence.id] }, context))).toContain('measured execution');
  const competing = value(decode('Evidence', f.evidenceInput({ id: evidence.id, claim: {
    subject: 'run:a', predicate: 'execution-observed', value: { hardware: 'm2', workload: 'w1' },
  } }), f.types));
  refused(renderMeasurementClaim({ kind: 'recorded-execution', hardware: 'm1', workload: 'w1',
    evidence: [evidence.id] }, { ...f.c, types: { ...f.types, evidence: [evidence, competing] } }));
  refused(renderMeasurementClaim({ kind: 'recorded-execution', hardware: 'm1', workload: 'w1',
    evidence: [evidence.id] }, { ...f.c, types: { ...f.types, evidence: [competing, evidence] } }));
  expect(value(renderMeasurementClaim({ kind: 'recorded-execution', hardware: 'm1', workload: 'w1',
    evidence: [evidence.id] }, { ...f.c, types: { ...f.types, evidence: [evidence, evidence] } })))
    .toContain('measured execution');
  refused(renderMeasurementClaim({ kind: 'recorded-execution', hardware: 'm1', workload: 'w1',
    evidence: [evidence.id] }, { ...f.c, types: { ...f.types, evidence: [structuredClone(evidence)] } }));
  const incomplete = { id: evidence.id, observedAt: { value: 100 }, freshFor: 10,
    claim: { predicate: 'execution-observed', value: { hardware: 'm1', workload: 'w1' } } };
  refused(renderMeasurementClaim({ kind: 'recorded-execution', hardware: 'm1', workload: 'w1',
    evidence: [evidence.id] }, { ...f.c, types: { ...f.types, evidence: [incomplete as never] } }));
});

it('P16-NF-22 [behavior:quota-coalescing] coalesces repeated valid missing-state observations', () => {
  const f = measurementFixture();
  expect(value(coalesceUnknownQuotaEpisodes(['account', 'account'], [], f.c)))
    .toEqual({ notices: ['account'], open: ['account'] });
  refused(coalesceUnknownQuotaEpisodes(['account'], [null] as never, f.c));
});

it('P16-NF-23 [behavior:observational-port] exposes no allow, place, or throttle operation', () => {
  expect(Object.keys(createMeasurementLedger(measurementFixture().c)).sort()).toEqual(['admitAmount', 'owner', 'trend']);
});

it('P16-NF-24 [behavior:rate-event-populations] keeps breaker and session populations distinct', () => {
  const f = measurementFixture();
  expect(value(summarizeRateLimitEvents([
    { id: 'open', source: 'breaker', kind: 'circuit-open', at: f.clock(0) },
    { id: 'quota', source: 'session-sentinel', kind: 'quota', at: f.clock(0) },
  ], f.clock(0), f.clock(3_600_000), f.c)).counts).toEqual({ 'circuit-open': 1, quota: 1 });
});

it('P16-NF-25 [behavior:cpu-and-byte] normalizes CPU and keeps byte quantities discrete', () => {
  const f = measurementFixture(); const point = f.resourcePoint('cpu', 100, 100);
  expect(value(cpuUtilization(point, 4, 'one-core', f.c))).toBe(50);
  expect(value(cpuUtilization(point, 4, 'whole-machine', f.c))).toBe(12.5);
  refused(admitMeasurementAmount({ contract: f.resourceProducer, category: 'rss', amount: 0.5 }, f.c), 'safe integer');
});

it('P16-NF-26 [behavior:process-incarnation] distinguishes absence and process reincarnation', () => {
  const f = measurementFixture();
  const process = { processIncarnation: 'p:1', pid: 7, startEvidence: 's:1', tags: ['worker'] };
  expect(value(reconcileProcessIncarnation(process, null, f.c))).toBe('missing');
  expect(value(reconcileProcessIncarnation(process, { ...process, processIncarnation: 'p:2',
    startEvidence: 's:2' }, f.c))).toBe('new-incarnation');
  refused(reconcileProcessIncarnation(process, false as never, f.c));
});

it('P16-NF-27 [behavior:limit-plus-one-census] produces one bounded truncated census batch', () => {
  const f = measurementFixture();
  const rows = [
    { processIncarnation: 'p:1', pid: 7, startEvidence: 's:1', tags: ['worker'] },
    { processIncarnation: 'p:2', pid: 8, startEvidence: 's:2', tags: ['worker'] },
  ];
  expect(value(planProcessCensus(rows, 1, f.c))).toMatchObject({ examined: 1, omitted: 1, truncated: true });
  refused(planProcessCensus([rows[0]!, { ...rows[1]!, pid: 7 }], 2, f.c), 'one PID');
});

it('P16-NF-28 [behavior:classified-and-unclassified] counts matched and unmatched processes without private data', () => {
  const f = measurementFixture();
  const rows = [
    { processIncarnation: 'p:1', pid: 7, startEvidence: 's:1', tags: ['worker'] },
    { processIncarnation: 'p:2', pid: 8, startEvidence: 's:2', tags: [] },
  ];
  expect(value(classifyProcesses(rows, [f.processRuleInput], f.c)))
    .toEqual({ counts: { 'agent-worker': 1 }, unclassified: 1 });
  refused(classifyProcesses([rows[0]!, { ...rows[1]!, pid: 7 }], [f.processRuleInput], f.c), 'one PID');
  refused(classifyProcesses(rows, [{ className: 'agent-worker', requiredTags: ['changed'] }], f.c), 'content binding');
});

it('P16-NF-29 [behavior:resource-trend] accepts complete points and refuses reused witness identity', () => {
  const f = measurementFixture(); const one = f.resourcePoint('r1', 100, 100); const two = f.resourcePoint('r2', 160, 110);
  expect(value(resourceTrend([one, two], 2, f.c))).toMatchObject({ state: 'complete', rssDeltaBytes: 10 });
  refused(resourceTrend([one, { ...two, id: one.id }], 2, f.c), 'identity repeated');
});

it('P16-NF-30 [behavior:fired-and-no-op] executes positive, negative, absent, and malformed classifier controls', () => {
  const f = measurementFixture();
  const fired = value(decode('Evidence', f.evidenceInput({ id: 'fired:integration', claim: {
    subject: 'feature-a', predicate: 'feature-action-observed', value: 'fired',
  } }), f.types));
  const noOp = value(decode('Evidence', f.evidenceInput({ id: 'noop:integration', claim: {
    subject: 'feature-a', predicate: 'feature-action-observed', value: 'no-op',
  } }), f.types));
  const base = { kind: 'exchange' as const, classifier: 'complete' as const, actionProved: true,
    negativeProved: false, gradeOnly: false, feature: 'feature-a', action: 'feature-action-observed' as const,
    evaluationClock: f.clock(100) };
  expect(value(classifyFeatureOutcome({ ...base, evidence: fired }, { ...f.c,
    types: { ...f.types, evidence: [fired] } }))).toBe('fired');
  expect(value(classifyFeatureOutcome({ ...base, actionProved: false, negativeProved: true, evidence: noOp },
    { ...f.c, types: { ...f.types, evidence: [noOp] } }))).toBe('no-op');
  const competingNoOp = value(decode('Evidence', f.evidenceInput({ id: fired.id, claim: {
    subject: 'feature-a', predicate: 'feature-action-observed', value: 'no-op',
  } }), f.types));
  for (const evidence of [[fired, competingNoOp], [competingNoOp, fired]] as const)
    refused(classifyFeatureOutcome({ ...base, evidence: fired }, { ...f.c,
      types: { ...f.types, evidence } }));
  refused(classifyFeatureOutcome({ ...base, actionProved: false, negativeProved: true,
    evidence: competingNoOp }, { ...f.c, types: { ...f.types, evidence: [fired, competingNoOp] } }));
  expect(value(classifyFeatureOutcome({ ...base, evidence: fired }, { ...f.c,
    types: { ...f.types, evidence: [fired, fired] } }))).toBe('fired');
  const copied = structuredClone(fired);
  refused(classifyFeatureOutcome({ ...base, evidence: copied }, { ...f.c,
    types: { ...f.types, evidence: [copied] } }), 'comparison domain');
  const altered = { ...copied, claim: { ...copied.claim, value: 'no-op' } };
  refused(classifyFeatureOutcome({ ...base, actionProved: false, negativeProved: true,
    evidence: altered as never }, { ...f.c, types: { ...f.types, evidence: [altered as never] } }),
  'comparison domain');
  expect(value(classifyFeatureOutcome({ ...base, evidence: copied }, { ...f.c,
    types: { ...f.types, evidence: [fired] } }))).toBe('unclassified');
  expect(value(classifyFeatureOutcome({ ...base, classifier: 'absent', actionProved: false, action: null }, f.c)))
    .toBe('unclassified');
  refused(classifyFeatureOutcome({ ...base, evidence: false } as never, f.c));
  const foreignClock = value(decodeMeasurement('clock', f.clockRaw(100, 'machine-b'), f.types));
  refused(classifyFeatureOutcome({ ...base, evaluationClock: foreignClock, evidence: fired }, { ...f.c,
    types: { ...f.types, evidence: [fired] } }), 'mismatch');
  const withdrawn = { ...f.types.register,
    entries: f.types.register.entries.filter(id => id !== 'feature-action-observed') };
  refused(classifyFeatureOutcome({ ...base, evidence: fired }, { ...f.c, register: withdrawn,
    types: { ...f.types, register: withdrawn, evidence: [fired] } }), 'predicate is not registered');
});

it('P16-NF-52 [behavior:non-executable-exclusion] keeps every A2 row outside passing acceptance', () => {
  const rows = p16Dispositions() as { id: string; number: number; status: string }[];
  expect(rows.filter(row => row.status === 'NON-EXECUTABLE-UNTIL-slice-A2')).toHaveLength(16);
  const markers: Record<number, string> = { 1: 'contract-inventory',
    3: 'registration-current-content', 5: 'measured-claim', 22: 'quota-coalescing', 23: 'observational-port',
    24: 'rate-event-populations', 25: 'cpu-and-byte', 26: 'process-incarnation',
    27: 'limit-plus-one-census', 28: 'classified-and-unclassified', 29: 'resource-trend',
    30: 'fired-and-no-op', 52: 'non-executable-exclusion', 53: 'legacy-additivity' };
  const assertions = rows.filter(row => !row.status.startsWith('NON-EXECUTABLE')).map(row => ({
    fullName: `${row.id} [behavior:${markers[row.number]}]`,
    title: `${row.id} [behavior:${markers[row.number]}]`, status: 'passed',
  }));
  assertions.push({ fullName: 'P16-NF-04 falsely passed', title: 'ordinary passing assertion', status: 'passed' });
  const report = { success: true, testResults: ['measurement', 'integration', 'e2e'].map(tier => ({
    name: `${process.cwd()}/tests/${tier === 'measurement' ? 'measurement/foundation' : tier + '/measurement'}.test.ts`,
    assertionResults: assertions,
  })) };
  expect(() => checkP16Coverage(report)).toThrow('non-executable row was counted as a pass');
});

// Rule 37 quarantine: see docs/defects/stale-main-baseline-additivity.md
it.skip('P16-NF-53 [behavior:legacy-additivity] reports first-landing scope inapplicability after measurement lands', () => {
  expect(execFileSync(process.execPath, ['scripts/check-p16-additivity.mjs'], { encoding: 'utf8' }))
    .toContain('first-landing additivity inapplicable');
});
