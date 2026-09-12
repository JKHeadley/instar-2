import { describe, expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { classifyFeatureOutcome } from '../../src/measurement/index.js';
import { refused, value } from '../facts/fixtures.js';
import { measurementFixture } from './fixture.js';

describe('Part 16 A1 round 8 independent-review regressions', () => {
  it('P16-NF-30 [behavior:fired-and-no-op] feature:copy-added-to-evidence-list and feature:altered-copy-added-to-evidence-list refuse', () => {
    const f = measurementFixture();
    const admitted = value(decode('Evidence', f.evidenceInput({ id: 'action:round8', claim: {
      subject: 'feature-a', predicate: 'feature-action-observed', value: 'fired',
    } }), f.types));
    const request = { kind: 'exchange' as const, classifier: 'complete' as const, actionProved: true,
      negativeProved: false, gradeOnly: false, feature: 'feature-a', action: 'feature-action-observed' as const,
      evaluationClock: f.clock(100), evidence: admitted };
    expect(value(classifyFeatureOutcome(request, { ...f.c,
      types: { ...f.types, evidence: [admitted] } }))).toBe('fired');

    const copied = structuredClone(admitted);
    refused(classifyFeatureOutcome({ ...request, evidence: copied }, { ...f.c,
      types: { ...f.types, evidence: [copied] } }), 'comparison domain');
    const altered = { ...copied, claim: { ...copied.claim, value: 'no-op' } };
    refused(classifyFeatureOutcome({ ...request, actionProved: false, negativeProved: true,
      evidence: altered as never }, { ...f.c, types: { ...f.types, evidence: [altered as never] } }),
    'comparison domain');
    expect(value(classifyFeatureOutcome({ ...request, evidence: copied }, { ...f.c,
      types: { ...f.types, evidence: [admitted] } }))).toBe('unclassified');
  });
});
