# Change review — Scope record validation to the change

Subject base: a035d5ed1206d72d26a81861283dbbebe8f221f7
Review state: open
Reviewed content: none
Outcome: Own review records and failures newly caused on untouched records gate the change; inherited findings remain visible as counted debt.
Affected rules: 12, 27, 37, 49, 74, 90, 95, 101, 102, 109, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes the scope of a release-integrity check, with real Git CLI regression coverage.
Side effects: Untouched records report inherited failures as debt; new failures still block check. Commit coverage and invalid Subject base still block globally. Landing evidence requirements are unchanged.
Undo and recovery: Revert this commit to restore all-current-record validation; review records and Git history remain intact.
Multi-machine posture: Machine-local Git graph and remote-tracking refs, deliberately; fetch before checking. CHANGE_REVIEW_BASE pins an explicit boundary across clones.
Layer below: Git reachability and per-commit changed paths; docs/01-the-rules.md Rules 74 and 109 require review coverage and frozen documents, not repeated validation of every untouched record.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: review-scope-1010-D1 | Use per-commit diff-tree paths rather than a net tree diff so a touched then reverted record still receives validation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/review-scope-1010-r4-PROGRESS.md

Subject (2 paths): scripts/check-change-review.mjs, tests/register/change-review-git.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: derive own commits from remote reachability or an explicit base, select their added or modified review paths, and reuse existing validation. No new validator or persisted state. Invalid overrides fail closed; the existing check remains the end-state guard.
80/20: Targeted real Git histories cover old debt, added and modified failures, explicit boundaries, detached pushed tips and descendant refs; existing coverage and frozen-subject tests remain intact.
VERDICT: author submission; the independent verdict is recorded as a pass
