import { describe, expect, it } from 'vitest';
import { round6CheckpointCases } from './a2-round6-review/checkpoint.js';
import { round6HeldPeerCases, round6NewCases } from './a2-round6-review/new-cases.js';

function label(name: string): string {
  if (name.startsWith('mixed:'))
    return 'P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read] P16-NF-36 [behavior:deterministic-historical-presentation]';
  if (name.startsWith('burn:'))
    return 'P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt]';
  if (name.startsWith('definition:'))
    return 'P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-39 [behavior:all-identities-retention]';
  if (name.startsWith('checkpoint:') || name.startsWith('projection:'))
    return 'P16-NF-50 [behavior:historical-restart-rebuild]';
  if (name.startsWith('cache:'))
    return 'P16-NF-41 [behavior:bounded-cache-eviction] P16-NF-50 [behavior:historical-restart-rebuild]';
  return 'P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read]';
}

describe('Part 16 A2a round-six independent review regressions', () => {
  it('imports every executable single-store new-case and checkpoint case', () => {
    expect(round6NewCases).toHaveLength(10);
    expect(round6CheckpointCases).toHaveLength(8);
  });

  for (const reviewCase of [...round6NewCases, ...round6CheckpointCases]) {
    it(`${label(reviewCase.name)} ${reviewCase.name}`, () => {
      expect(reviewCase.pass,
        JSON.stringify(reviewCase.actual ?? reviewCase.exception, null, 2)).toBe(true);
    });
  }

  it('P16-NF-37 [behavior:peer-union-window] P16-NF-38 [behavior:peer-completeness-clock] NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge preserves every reviewer peer case as an explicit A2b hold', () => {
    expect(round6HeldPeerCases).toEqual([
      'mixed:true:peer-resolved-state',
      'mixed:false:peer-resolved-state',
      'peer-correction:later-replica-control',
      'peer-correction:union-drops-superseded-prefix',
    ].map(name => ({ name,
      disposition: 'NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge' })));
  });
});
