import { describe, expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import {
  classifyFeatureOutcome, classifyProcesses, decodeBurnPolicy, planProcessCensus,
  renderMeasurementClaim,
} from '../../src/measurement/index.js';
// @ts-expect-error Repository contract checker is intentionally JavaScript.
import { checkP16Coverage, p16Dispositions } from '../../scripts/check-p16-contract-map.mjs';
import { refused, value } from '../facts/fixtures.js';
import { measurementFixture } from './fixture.js';

describe('Part 16 A1 round 7 independent-review regressions', () => {
  it('finding 1 malformed, uncaptured, copied, and altered Evidence cannot establish measured execution', () => {
    const f = measurementFixture();
    const admitted = value(decode('Evidence', f.evidenceInput({ id: 'execution:round7', claim: {
      subject: 'run:a', predicate: 'execution-observed', value: { hardware: 'm1', workload: 'w' },
    } }), f.types));
    const claim = { kind: 'recorded-execution' as const, hardware: 'm1', workload: 'w',
      evidence: ['execution:round7'] };
    expect(value(renderMeasurementClaim(claim, { ...f.c,
      types: { ...f.types, evidence: [admitted] } }))).toBe('measured execution on m1 for w');

    const copied = structuredClone(admitted);
    refused(renderMeasurementClaim(claim, { ...f.c,
      types: { ...f.types, evidence: [copied] } }));
    const incomplete = { id: admitted.id, observedAt: { value: 100 }, freshFor: 10,
      claim: { predicate: 'execution-observed', value: { hardware: 'm1', workload: 'w' } } };
    refused(decode('Evidence', incomplete, f.types));
    refused(renderMeasurementClaim(claim, { ...f.c,
      types: { ...f.types, evidence: [incomplete as never] } }));
    const uncaptured = { ...structuredClone(admitted), source: 'unregistered-producer',
      capture: { reference: 'missing-capture', hash: `sha256:${'0'.repeat(64)}` } };
    refused(decode('Evidence', uncaptured, f.types));
    refused(renderMeasurementClaim(claim, { ...f.c,
      types: { ...f.types, evidence: [uncaptured as never] } }));
    const altered = { ...structuredClone(admitted), claim: { subject: 'run:b',
      predicate: 'execution-observed', value: { hardware: 'm2', workload: 'w2' } } };
    refused(renderMeasurementClaim({ ...claim, hardware: 'm2', workload: 'w2' }, { ...f.c,
      types: { ...f.types, evidence: [altered as never] } }));
  });

  it('P16-NF-26 [behavior:process-incarnation] P16-NF-28 [behavior:classified-and-unclassified] finding 2 classification reuses census validation for duplicate PID populations', () => {
    const f = measurementFixture();
    const first = { processIncarnation: 'process:1', pid: 7, startEvidence: 'start:1', tags: ['worker'] };
    const second = { processIncarnation: 'process:2', pid: 8, startEvidence: 'start:2', tags: ['worker'] };
    expect(value(classifyProcesses([first, second], [f.processRuleInput], f.c)))
      .toEqual({ counts: { 'agent-worker': 2 }, unclassified: 0 });
    const duplicatePid = [first, { ...second, pid: 7 }];
    refused(planProcessCensus(duplicatePid, 2, f.c), 'one PID');
    refused(classifyProcesses(duplicatePid, [f.processRuleInput], f.c), 'one PID');
    refused(classifyProcesses([first, { ...second, pid: 7, tags: ['unmatched'] }],
      [f.processRuleInput], f.c), 'one PID');
  });

  it('P16-NF-30 [behavior:fired-and-no-op] finding 3 a removed action predicate cannot establish fired', () => {
    const f = measurementFixture();
    const evidence = value(decode('Evidence', f.evidenceInput({ id: 'action:round7', claim: {
      subject: 'feature-a', predicate: 'feature-action-observed', value: 'fired',
    } }), f.types));
    const context = { ...f.c, types: { ...f.types, evidence: [evidence] } };
    const request = { kind: 'exchange' as const, classifier: 'complete' as const, actionProved: true,
      negativeProved: false, gradeOnly: false, feature: 'feature-a', action: 'feature-action-observed' as const,
      evaluationClock: f.clock(100), evidence };
    expect(value(classifyFeatureOutcome(request, context))).toBe('fired');
    const withdrawn = { ...f.types.register,
      entries: f.types.register.entries.filter(id => id !== 'feature-action-observed') };
    refused(classifyFeatureOutcome(request, { ...context, register: withdrawn,
      types: { ...context.types, register: withdrawn } }), 'predicate is not registered');
  });

  it('P16-NF-52 [behavior:non-executable-exclusion] finding 4 rejects passed assertions for every blocked check', () => {
    const rows = p16Dispositions() as { id: string; number: number; status: string }[];
    const markers: Record<number, string> = { 1: 'contract-inventory',
      3: 'registration-current-content', 5: 'measured-claim', 22: 'quota-coalescing',
      23: 'observational-port', 24: 'rate-event-populations', 25: 'cpu-and-byte',
      26: 'process-incarnation', 27: 'limit-plus-one-census', 28: 'classified-and-unclassified',
      29: 'resource-trend', 30: 'fired-and-no-op', 52: 'non-executable-exclusion', 53: 'legacy-additivity' };
    const executable = rows.filter(row => !row.status.startsWith('NON-EXECUTABLE'));
    const report = { success: true, testResults: [
      'tests/measurement/foundation.test.ts', 'tests/integration/measurement.test.ts',
      'tests/e2e/measurement.test.ts',
    ].map(name => ({ name: `${process.cwd()}/${name}`, assertionResults: executable.map(row => ({
      fullName: `${row.id} [behavior:${markers[row.number]}]`,
      title: `${row.id} [behavior:${markers[row.number]}]`, status: 'passed',
    })) })) };
    expect(() => checkP16Coverage(report)).not.toThrow();
    for (const row of rows.filter(row => row.status.startsWith('NON-EXECUTABLE'))) {
      const attacked = structuredClone(report);
      attacked.testResults[0]!.assertionResults.push({ fullName: `${row.id} falsely passed`,
        title: 'ordinary passing assertion', status: 'passed' });
      expect(() => checkP16Coverage(attacked), row.id)
        .toThrow('non-executable row was counted as a pass');
    }
  });

  it('finding 6 burn recovery thresholds must both be strictly lower than entry thresholds', () => {
    const f = measurementFixture();
    const decodeBoundary = (id: string, recoveryExcess: number, recoveryShare: number) => {
      const raw = { ...f.burnPolicyInput, id, recoveryExcess, recoveryShare };
      return decodeBurnPolicy(raw, f.withRegistered(raw));
    };
    expect(value(decodeBoundary('burn:lower-neighbor', 49, 0.49))).toMatchObject({
      recoveryExcess: 49, recoveryShare: 0.49,
    });
    refused(decodeBoundary('burn:equal-excess', 50, 0.49), 'strictly lower');
    refused(decodeBoundary('burn:equal-share', 49, 0.5), 'strictly lower');
    refused(decodeBoundary('burn:equal-both', 50, 0.5), 'strictly lower');
  });
});
