# Change review — sb-w4-a7c pipeline repair 3: merge origin/main (7964cd5a, w4-r105) into the branch

Subject base: 2a6179392d8cc370749c0e31471c4d37a856fe26
Review state: open
Reviewed content: none
Outcome: main advanced by one landed unit (#151, w4-r105: the architecture check reaches a true R105 verdict on an unchanged main) and this branch did not contain it. An ordinary `git merge origin/main` applied with no conflicts; the three paths it brings are main's own reviewed content (its record, reviews/w4-r105-change-review.md, arrives with it) and are taken exactly as main has them. No source, generated file, prompt or record kind on this branch was edited by hand. After the merge `tsc --noEmit` and `npm run build` exit 0, `npm run lint` exits 0 (architecture checks passed, register wiring zero issues), and `build-register.mjs --check` is check:true with no repin needed, because the merge touches no pinned source. The one other change-review failure, Rule 102 on reviews/w4-a7c-change-review.md, was fixed at its source by adding the four decision ids to that unit's desk report, which had never named them.
Affected rules: 74 (this record), 101 (plain commit and merge; no hook-bypass flag, no git stash), 102 (the w4-a7c report now names its four decisions), 69 and 90 (no generated/ file changed; the register check passes on the merged tree), 116 (an ordinary merge with no new machinery)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. The merge brings only main's check-architecture R105 change and its type test.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: a no-conflict merge of already-landed main content; reversible by the agent alone, no money, no policy-sensitive change.
Side effects: the branch now carries main's R105 architecture-check behaviour (scripts/check-architecture.mjs, its .d.mts, tests/types/shipped-clients.test.ts). Nothing else moves.
Undo and recovery: reset the branch to 2a6179392d8cc370749c0e31471c4d37a856fe26; nothing persisted differs.
Multi-machine posture: unchanged; no replicated state, lease or peer path is touched.
Layer below: git's merge of 7964cd5a into 2a617939 (merge base already shared), and main's own review record for the incoming change.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

Subject (3 paths): scripts/check-architecture.d.mts, scripts/check-architecture.mjs, tests/types/shipped-clients.test.ts

## Closing block

simplestRobustRoute: an ordinary merge of main with no conflicts and no hand edits is the simplest route that makes this branch contain main; no repin is needed because no pinned source moved.
80/20: 0 must-fixes. Residue (low): the full suite was not run here per the operator rule; the pipeline reruns it on the Mama PC after the push.
VERDICT: author submission; the independent verdict is recorded as a pass
