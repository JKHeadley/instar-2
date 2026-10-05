# Change review — rc-1 pipeline repair: merge origin/main 7964cd5a (w4-r105) into rc-1

Subject base: a7969993e2581d7e5933926891fcf2068805ebe5
Review state: open
Reviewed content: none
Outcome: main advanced to 7964cd5a (#151, w4-r105: the architecture check builds the core when dist/ is absent and asks whether this host is the certified machine only on the certified platform) and rc-1 at a7969993 did not contain it. One ordinary merge of origin/main into rc-1 (85c4f3fa); it merged without conflict and touches only scripts/check-architecture.mjs, scripts/check-architecture.d.mts, tests/types/shipped-clients.test.ts and main's own review record. No src/, docs/, generated/ or register-source/ file changes, so the desk chain is a no-op: the rehash refreshed 0 pins, the repin chain updated 0 inventory entries, and build-register --check still passes against the replay at 3242e7e5. With the merged check, `npm run lint` passes on this tree, including the self-host tuple's conformance digest (sha256:a89c42e1…) recomputed against the merged composition.
Affected rules: 74 (this record covers the merge commit), 105 (the merged R105 check passes for every harness tuple here), 116 (an ordinary merge and the standard desk tools; nothing hand-edited), 66, 69, 90 (register replayed, not hand-edited; unchanged), 101 (plain commits, no hook bypass), 102 (decision below)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged (no shipped code changes in the merge)
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: the merge brings only main's already-reviewed architecture-check change (reviews/w4-r105-change-review.md) and changes no shipped code.
Side effects: the architecture check now builds dist/ itself when absent, as on main.
Undo and recovery: revert the merge commit 85c4f3fa with -m 1 and this record; no state, journal or generated file is touched.
Multi-machine posture: none; a lint script and a type test.
Layer below: main's record reviews/w4-r105-change-review.md, carried byte for byte.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commit and ordinary merge; core.hooksPath unset; no git stash)
Convergence: none
Decision: rc1-main-merge | merged origin/main 7964cd5a into rc-1 with one ordinary merge (no conflicts) and ran the desk chain, which changed nothing; the local verification used a gitignored node_modules link that is not committed | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rc-1-PROGRESS.md

Subject (3 paths): scripts/check-architecture.d.mts, scripts/check-architecture.mjs, tests/types/shipped-clients.test.ts

## Closing block

simplestRobustRoute: one ordinary merge of main and the standard desk tools; this is that route.
80/20: 0 must-fixes. tsc clean; lint, register:check, governed-docs and changelog checks pass; first-landing, additivity and shipped-clients tests 26/26 in the foreground. The pipeline runs the full suite.
VERDICT: author submission; the independent verdict is recorded as a pass
