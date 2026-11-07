# Change review — Repin, regenerate and record the train-188 live 5a5fdc91 merge

Subject base: 9be0ef59c4db4030436c1b4624b94cf87afcfbf6
Review state: open
Reviewed content: none
Outcome: After merging live 5a5fdc91 into train-188 (merge 9be0ef59), refresh the two owner-reference pins the merged test files moved, regenerate the register from the committed merge, and disposition live's copied deadline evidence in the two merged records. No behaviour is added; the resource census repair (M1) is unchanged.
Affected rules: 26, 36, 44, 60, 61, 66, 71, 74, 95, 101, 116
Affected floors: secrets — none touched; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Derived pins and register publication only; the merge's hand resolution is confined to four test files and two review records, with no source change.
Side effects: none beyond derived publication. The merge keeps train-188's shipped-loader crash worker and readiness exit check, and takes live's per-case test structure, activation-notice shape cases and committed evidence locators.
Undo and recovery: Revert the merge and these commits; regenerate through the existing desk repin and register replay.
Multi-machine posture: Unchanged; git-shared derived files only.
Layer below: Read each conflicting hunk on both sides; the round7 worker keeps train-188's loader helper (no Vite server per crash boundary) under live's independent per-case structure, and journal-agent keeps the exit check plus live's CHILD_TIMEOUT with the larger 8x bound.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: No model prompt, parser or decision path changed; the merged tests only assert existing notice shapes.

1.X FIRST: Merge-only change; it inherits the 1.x comparisons recorded in reviews/resource-census-stream-1105-change-review.md and reviews/train-175-policy-cache-repair.md and adds no behaviour that needs a new one.

Decision: train-188-merge-5a5fdc91 | Keep both sides: train-188 loader worker and readiness exit check, live per-case structure, notice-shape cases and committed locators; no new mechanism. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Regenerated governing text, not a new commitment.

Verification: tsc passes. The three hand-merged test files pass with --maxWorkers 1 (journal-agent and review-layers-canary 30/30; harness-adapters-round7-regression 27/27). lint (architecture plus register wiring, issues []) and register:check pass after the desk repin (2 pins) and register replay.

## Closing block

simplestRobustRoute: Resolve each conflict by keeping both behaviours, then use only the existing desk repin and register replay. No new mechanism.
80/20: Targeted tests for the touched files plus typecheck and cheap gates; the full suite stays with the Studio pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
