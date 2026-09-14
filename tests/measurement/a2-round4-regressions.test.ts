import { describe, expect, it } from 'vitest';
import { closureCases } from './a2-round4-review/closure.js';
import { edgeCases } from './a2-round4-review/edge-cases.js';
import { verifyCases } from './a2-round4-review/verify.js';

type ReviewCase = Readonly<{
  name: string;
  pass: boolean;
  actual?: unknown;
  exception?: string;
}>;

const sampledAcceptanceCases = new Set([
  'sample-clock:cumulative-model-session-successive-points-not-same-quantity',
  'sample-clock:cumulative-model-session-read-retains-both-source-times',
  'sample-clock:quota-successive-points-not-same-quantity',
  'sample-clock:quota-read-retains-both-source-times',
  'sample-clock:package-cost-successive-points-not-same-quantity',
  'sample-clock:package-cost-read-retains-both-source-times',
]);

function assertSampledAcceptance(reviewCase: ReviewCase): void {
  if (!sampledAcceptanceCases.has(reviewCase.name)) return;
  if (reviewCase.name.endsWith('successive-points-not-same-quantity')) {
    const results = reviewCase.actual as Array<{ kind?: string; value?: { key?: string } }>;
    expect(results).toHaveLength(2);
    expect(results.every(result => result.kind === 'Success')).toBe(true);
    expect(results[0]?.value?.key).not.toBe(results[1]?.value?.key);
    return;
  }
  const result = reviewCase.actual as { kind?: string; value?: {
    totalCount?: number; rows?: Array<{ at?: { value?: number } }>;
  } };
  expect(result.kind).toBe('Success');
  expect(result.value?.totalCount).toBe(2);
  expect(result.value?.rows?.map(row => row.at?.value)).toEqual([100, 150]);
}

const cases = [...verifyCases, ...edgeCases, ...closureCases] as ReviewCase[];

function label(name: string): string {
  if (name.startsWith('sample-clock:'))
    return 'P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-16 [behavior:current-history-read]';
  if (name.startsWith('resolution:'))
    return 'P16-NF-14 [behavior:causal-quantity-resolution]';
  if (name.startsWith('attribution:'))
    return 'P16-NF-12 [behavior:signed-history-attribution] P16-NF-13 [behavior:unattributed-conflicted]';
  if (name.startsWith('peer:') || name.startsWith('retraction:peer'))
    return 'P16-NF-38 [behavior:peer-completeness-clock] NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge';
  if (name.startsWith('binding:') || name.startsWith('history:')
    || name.startsWith('retraction:read') || name.startsWith('unrelated-note:')
    || name.startsWith('restored-retraction:'))
    return 'P16-NF-16 [behavior:current-history-read] P16-NF-36 [behavior:deterministic-historical-presentation]';
  return '';
}

describe('Part 16 A2 round-four independent review regressions', () => {
  it('imports exactly the reviewer\'s 76 executable cases', () => {
    expect(cases).toHaveLength(76);
    expect(verifyCases).toHaveLength(39);
    expect(edgeCases).toHaveLength(19);
    expect(closureCases).toHaveLength(18);
  });

  for (const reviewCase of cases) {
    const acceptance = sampledAcceptanceCases.has(reviewCase.name) ? '[accepts-success]' : '';
    it(`${label(reviewCase.name)} ${acceptance} ${reviewCase.name}`.trim(), () => {
      assertSampledAcceptance(reviewCase);
      expect(reviewCase.pass,
        JSON.stringify(reviewCase.actual ?? reviewCase.exception, null, 2)).toBe(true);
    });
  }
});
