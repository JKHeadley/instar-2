import { expect, it } from 'vitest';
import { round6CheckpointCases } from '../measurement/a2-round6-review/checkpoint.js';
import { round6HeldPeerCases, round6NewCases } from '../measurement/a2-round6-review/new-cases.js';

it('P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read] P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] P16-NF-36 [behavior:deterministic-historical-presentation] P16-NF-39 [behavior:all-identities-retention] P16-NF-41 [behavior:bounded-cache-eviction] P16-NF-50 [behavior:historical-restart-rebuild] round-six single-store and checkpoint cases pass through the integrated owner pipeline', () => {
  const cases = [...round6NewCases, ...round6CheckpointCases];
  expect(cases).toHaveLength(18);
  expect(cases.filter(candidate => !candidate.pass), JSON.stringify(cases, null, 2)).toEqual([]);
});

it('P16-NF-37 [behavior:peer-union-window] P16-NF-38 [behavior:peer-completeness-clock] NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge keeps round-six peer cases held outside A2a', () => {
  expect(round6HeldPeerCases).toHaveLength(4);
});
