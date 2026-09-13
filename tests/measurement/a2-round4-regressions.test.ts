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

const cases = [...verifyCases, ...edgeCases, ...closureCases] as ReviewCase[];

function label(name: string): string {
  if (name.startsWith('sample-clock:'))
    return 'P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-16 [behavior:current-history-read]';
  if (name.startsWith('resolution:'))
    return 'P16-NF-14 [behavior:causal-quantity-resolution]';
  if (name.startsWith('attribution:'))
    return 'P16-NF-12 [behavior:signed-history-attribution] P16-NF-13 [behavior:unattributed-conflicted]';
  if (name.startsWith('peer:') || name.startsWith('retraction:peer'))
    return 'P16-NF-38 [behavior:peer-completeness-clock]';
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
    it(`${label(reviewCase.name)} ${reviewCase.name}`.trim(), () => {
      expect(reviewCase.pass,
        JSON.stringify(reviewCase.actual ?? reviewCase.exception, null, 2)).toBe(true);
    });
  }
});
