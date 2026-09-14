import { describe, expect, it } from 'vitest';
// @ts-expect-error Repository contract checker is intentionally JavaScript.
import { checkP16Coverage } from '../../scripts/check-p16-contract-map.mjs';
import { round5Cases } from './a2-round5-review-cases.js';

function label(name: string): string {
  if (name.startsWith('read:unwitnessed-model'))
    return 'P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-16 [behavior:current-history-read]';
  if (name.startsWith('resolution:'))
    return 'P16-NF-14 [behavior:causal-quantity-resolution]';
  if (name.startsWith('read:owner-attribution'))
    return 'P16-NF-12 [behavior:signed-history-attribution] P16-NF-13 [behavior:unattributed-conflicted]';
  if (name.startsWith('peer'))
    return 'P16-NF-37 [behavior:peer-union-window] P16-NF-38 [behavior:peer-completeness-clock] NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge';
  if (name.startsWith('burn:'))
    return 'P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt]';
  return 'P16-NF-16 [behavior:current-history-read] P16-NF-36 [behavior:deterministic-historical-presentation]';
}

describe('Part 16 A2 round-five independent review regressions', () => {
  it('imports one focused owner-machinery regression for every finding path', () => {
    expect(round5Cases).toHaveLength(11);
  });

  for (const reviewCase of round5Cases) {
    it(`${label(reviewCase.name)} ${reviewCase.name}`, () => {
      expect(reviewCase.pass,
        JSON.stringify(reviewCase.actual ?? reviewCase.exception, null, 2)).toBe(true);
    });
  }

  it('F8 rejects a mapped positive when its assertion can pass on refusal', () => {
    const neighbors = [
      'sample-clock:cumulative-model-session-successive-points-not-same-quantity',
      'sample-clock:quota-successive-points-not-same-quantity',
      'sample-clock:package-cost-successive-points-not-same-quantity',
    ];
    const report = { success: true, testResults: [
      'tests/measurement/sample.test.ts', 'tests/integration/sample.test.ts',
      'tests/e2e/sample.test.ts',
    ].map(name => ({ name, assertionResults: neighbors.map(neighbor => ({
      fullName: `P16-NF-04 ${neighbor}`, title: `P16-NF-04 [behavior:evidence-quantity-binding] ${neighbor}`,
      status: 'passed',
    })) })) };
    const dispositions = [{ id: 'P16-NF-04', number: 4, status: 'EXECUTABLE', dependencies: [] }];
    expect(() => checkP16Coverage(report, dispositions))
      .toThrow('positive acceptance neighbor permits refusal');
    const strict = { ...report, testResults: report.testResults.map(file => ({ ...file,
      assertionResults: file.assertionResults.map(assertion => ({ ...assertion,
        title: `${assertion.title} [accepts-success]` })) })) };
    expect(() => checkP16Coverage(strict, dispositions)).not.toThrow();
  });
});
