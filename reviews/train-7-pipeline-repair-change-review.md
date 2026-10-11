# Change review — train-7 merge review scope repair

Subject base: 4ba07c4a67650e9c394273b460890f9f6bf037e7
Review state: open
Reviewed content: none
Outcome: The merge scope treats unchanged destination reviews as historical while requiring dispositions for incoming or newly edited prompts and reviews; cover integration merge 81bc610c.
Affected rules: 12, 26, 27, 34, 37, 49, 70, 74, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets — unchanged custody; spend cap — unchanged accounting; stop — unchanged checkpoint; no duplicate sends — unchanged durable intent; durable intake — unchanged journal. The change is review tooling only.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: The review integrity checkpoint changes scope computation and therefore needs real Git positive and refusal controls. No production runtime behavior changes.
Side effects: diff-tree compares merges to their first parent rather than separately to all parents. Incoming changes and conflict resolutions are included, along with every unlanded non-merge commit; inherited destination history is no longer misclassified as newly edited. Historical debt remains visible. The merged reminder fixture repair retains its existing executor-entry and uncertain-outcome assertions.
Undo and recovery: Revert this checker/test repair to restore all-parent merge comparison and the reproducible false failure. No migration or durable runtime state change is involved; keep the integration review covering 81bc610c.
Multi-machine posture: The same Git history is evaluated on every machine. Saved execution artifacts remain deliberately rooted to the original gate checkout, revision and process; no artifact or report is relabeled.
Layer below: Inspected changeScope, record ranges, current-tree prompt scan, pending own dispositions, frozen review validation, and actual first-/second-parent trees of 81bc610c. Inspected the standing-trust source and captured self-description fixture. Contract scripts and production bytes match the saved gate.
Bug class: unit
Bug evidence: reproducer=tests/register/change-review-git.test.ts
Hook bypass: none
Convergence: none
Decision: train7-merge-scope | Use first-parent merge differences to preserve historical review identity while checking real incoming changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-7-repair-PROGRESS.md
Prompt review: No model-facing prompt or parser change. Throwaway Git fixtures exercise scanner coverage only. The carried reminder fixture uses the same synthetic UNKNOWN output after recorded executor entry. Existing standing-trust overlaps are quoted captured-prompt translations, not predetermined model verdicts.

Subject (6 paths): scripts/check-change-review.mjs, tests/preview/journal-reminder-launcher.test.ts, tests/preview/model-failure-io.mjs, tests/preview/model-failure-loader.mjs, tests/preview/model-failure-route.mjs, tests/register/change-review-git.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing Git first-parent diff mode in the existing review checkpoint. The credible failure is a false own-review classification from comparing a merge backward against its incoming branch. No new machinery or history rewrite. Start guard is actual Git ancestry; end guards are real CLI positive and refusal tests and final checks; limit guards retain commit coverage, frozen records, prompt dispositions and fail-closed invalid boundaries. No autonomous runtime completion claim.
80/20: The added regression fails before the one-line scope fix. All 32 tests in the touched Git integration file and typecheck pass; final cheap checks run after committing. All eleven contract checkers pass against the original saved gate evidence; no new full-suite success is claimed. Evidence and final outputs are in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-7-repair-PROGRESS.md.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
