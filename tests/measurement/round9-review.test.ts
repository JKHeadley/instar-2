import { describe, expect, it } from 'vitest';
import { canonical, compare, decode } from '../../src/index.js';
import { classifyFeatureOutcome, renderMeasurementClaim } from '../../src/measurement/index.js';
import { refused, value } from '../facts/fixtures.js';
import { measurementFixture } from './fixture.js';

describe('Part 16 A1 round 9 independent-review regressions', () => {
  it('P16-NF-30 [behavior:fired-and-no-op] feature:competing-current-same-id stays unresolved across selection and order', () => {
    const f = measurementFixture();
    const organization = value(decode('Scope', {
      type: 'Scope', schemaVersion: 1, kind: 'organization',
    }, f.types));
    const admitted = (raw: ReturnType<typeof f.evidenceInput>) => {
      const hash = value(canonical(raw)).hash;
      return value(decode('Evidence', raw, { ...f.types,
        recordSubjects: { ...(f.types.recordSubjects ?? {}), [hash]: organization },
      }));
    };
    const fired = admitted(f.evidenceInput({ id: 'action:round9-conflict', claim: {
      subject: 'feature-a', predicate: 'feature-action-observed', value: 'fired',
    } }));
    const noOp = admitted(f.evidenceInput({ id: 'action:round9-conflict', claim: {
      subject: 'feature-a', predicate: 'feature-action-observed', value: 'no-op',
    } }));
    expect(value(compare('Evidence', fired, noOp, 'identity', organization, f.c.preserved)))
      .toMatchObject({ type: 'Conflict', fields: ['claim'] });
    const request = { kind: 'exchange' as const, classifier: 'complete' as const, actionProved: true,
      negativeProved: false, gradeOnly: false, feature: 'feature-a', action: 'feature-action-observed' as const,
      evaluationClock: f.clock(100), evidence: fired };
    expect(value(classifyFeatureOutcome(request, { ...f.c,
      types: { ...f.types, evidence: [fired] } }))).toBe('fired');
    for (const evidence of [[fired, noOp], [noOp, fired]] as const)
      refused(classifyFeatureOutcome(request, { ...f.c, types: { ...f.types, evidence } }), 'conflicted');
    refused(classifyFeatureOutcome({ ...request, actionProved: false, negativeProved: true, evidence: noOp },
      { ...f.c, types: { ...f.types, evidence: [fired, noOp] } }), 'conflicted');
    expect(value(classifyFeatureOutcome(request, { ...f.c,
      types: { ...f.types, evidence: [fired, fired] } }))).toBe('fired');
  });

  it('P16-NF-05 [behavior:measured-claim] claim:competing-current-same-id cannot establish measured execution', () => {
    const f = measurementFixture();
    const execution = (hardware: string) => value(decode('Evidence', f.evidenceInput({
      id: 'execution:round9-conflict', claim: {
        subject: 'run:a', predicate: 'execution-observed', value: { hardware, workload: 'w' },
      },
    }), f.types));
    const m1 = execution('m1'); const m2 = execution('m2');
    const claim = { kind: 'recorded-execution' as const, hardware: 'm1', workload: 'w',
      evidence: ['execution:round9-conflict'] };
    expect(value(renderMeasurementClaim(claim, { ...f.c,
      types: { ...f.types, evidence: [m1] } }))).toContain('measured execution on m1');
    for (const evidence of [[m1, m2], [m2, m1]] as const)
      refused(renderMeasurementClaim(claim, { ...f.c, types: { ...f.types, evidence } }));
    expect(value(renderMeasurementClaim(claim, { ...f.c,
      types: { ...f.types, evidence: [m1, m1] } }))).toContain('measured execution on m1');
  });
});
