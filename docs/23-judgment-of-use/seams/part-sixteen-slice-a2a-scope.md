# Part Sixteen — re-slice of slice A2 into A2a (this branch) and A2b (later)

Directed by Echo for round 6 after independent rereview4 returned six findings and the prior
slice's review sequence ran 9 → 13 → 7 → 8 → 6 findings. The split follows the owner boundary:
single-store current history remains here; cross-machine peer union moves as one coherent later
slice.

## A2a — stays on `impl-part-sixteen-a2` (the current repair slice)

- Single-store quantity witness selection and owner resolution, including causal refinements,
  later or concurrent witnesses, unavailable evidence, and evidence-complete resolved rows.
- Registered cross-instance aggregation over quantities already resolved from one current
  owner-issued Part Two snapshot.
- Burn-window membership, population validation, baseline evidence, amount selection, recovery
  hysteresis, and coverage debt.
- Signed-history attribution, current-source binding, bounded historical presentation,
  deterministic rebuild, retention, privacy, and bounded disposable caches.
- Projection-definition construction and closed boundary validation for the local source fold.

## A2b — REMOVED from A2a acceptance, built later as its own slice

- Cross-machine peer merge: admission of peers, union of admitted peers' current histories and
  causal frontiers, cross-replica current-head and correction supersession, overlap removal,
  missing/incomparable peer handling, pool completeness, and peer clock-skew presentation.
- The peer implementation remains in source for the later repair slice, but no peer-merge positive
  is credited in A2a. Every P16-NF-37/38 peer arm and any other test arm that exercises peer merge
  is held under the exact label `NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge`.

## Preserved boundaries

- Slice A1's landed records, decoders, schemas, validators and fixtures remain byte-identical.
  A2a composes only through public owner ports and additive measurement exports.
- The A1-architecture analyzer remains separately held under
  `NON-EXECUTABLE-UNTIL-slice-A1-arch`; this re-slice neither implements nor renames it.
- Every other unlanded owner seam keeps its existing exact dependency label. A grant is permission
  to build, never evidence that its positive behavior is executable.

