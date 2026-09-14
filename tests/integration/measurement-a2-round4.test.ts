import { expect, it } from 'vitest';
import { closureCases } from '../measurement/a2-round4-review/closure.js';
import { edgeCases } from '../measurement/a2-round4-review/edge-cases.js';
import { verifyCases } from '../measurement/a2-round4-review/verify.js';

const exposing = new Set([
  'resolution:signed-history-selected-without-caller-hint',
  'resolution:burn-re-resolves-owner-resolution-at-use',
  'retraction:read-current-source', 'retraction:peer-current-source',
  'peer:incomparable-clock-keeps-local-partial',
  'peer:relabel-history-as-required-peer-needs-owner-binding',
  'unrelated-note:target-field-must-not-suppress-observation',
  'restored-retraction:current-read-accepts-restored-point',
  'sample-clock:cumulative-model-session-successive-points-not-same-quantity',
  'sample-clock:cumulative-model-session-read-retains-both-source-times',
  'sample-clock:quota-successive-points-not-same-quantity',
  'sample-clock:quota-read-retains-both-source-times',
  'sample-clock:package-cost-successive-points-not-same-quantity',
  'sample-clock:package-cost-read-retains-both-source-times',
  'binding:numeric-projection-class-must-refuse',
  'binding:malformed-lineage-must-refuse',
  'attribution:retracted-resolution-no-longer-attributes',
]);

it('P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-12 [behavior:signed-history-attribution] P16-NF-13 [behavior:unattributed-conflicted] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read] P16-NF-36 [behavior:deterministic-historical-presentation] P16-NF-38 [behavior:peer-completeness-clock] NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge round-four reviewer neighbors pass through real owner machinery', () => {
  const cases = [...verifyCases, ...edgeCases, ...closureCases]
    .filter(candidate => exposing.has(candidate.name));
  expect(cases).toHaveLength(17);
  expect(cases.every(candidate => candidate.pass), JSON.stringify(cases, null, 2)).toBe(true);
});
