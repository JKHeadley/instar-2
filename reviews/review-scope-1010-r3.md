# Change review — Limit the exception to older prompt dispositions

Subject base: a40066dc631d65af3c58ff2ef39cfc07c49a998c
Review state: open
Reviewed content: none
Affected rules: 12, 27, 37, 49, 70, 74, 90, 95, 101, 102, 109, 111, 112, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Release-integrity tooling and integration of already-reviewed governed main content.
Undo and recovery: Revert through an ordinary new commit; retain both merge parents and the prior review history.
Multi-machine posture: Machine-local Git graph and fetched remote refs, deliberately; CHANGE_REVIEW_BASE pins a caller-selected boundary. No runtime state changes.
Hook bypass: none
Convergence: none
Outcome: Validate every current record as on main; require prompt dispositions only for records added or modified by own commits. Count missing older dispositions once as review-debt-1010.
Side effects: Removes base-tip comparison and broad error demotion; frozen content, required fields, prompt review, version history, deferrals, skips, decision reporting and landing evidence keep their main behavior. Historical rounds remain in Git; their report locators now name this round's consolidated report.
Layer below: Main check current-record selection, validateRecord error categories, Git per-commit diff-tree and remote reachability; the two Astra NO reports and their frozen-subject reproductions.
Bug class: integration
Bug evidence: reproducer=tests/register/change-review-git.test.ts
Decision: review-scope-1010-r3-D1 | Restore main's current-record selection and single validation pass; demote only missing or invalid Prompt finding dispositions on untouched records, never other validation errors. No base-tip or second prompt scan. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/review-scope-1010-r4-PROGRESS.md
Decision: review-scope-1010-r3-D2 | Preserve per-commit own-record selection including merge-parent diffs and touched-then-reverted paths; ignore remote tips containing HEAD and retain CHANGE_REVIEW_BASE precedence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/review-scope-1010-r4-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: keep main's validator and landing path, and count just its older prompt-disposition findings as debt. It prevents retroactive prompt-scan debt blocking unrelated changes without concealing frozen-subject violations. Existing coverage and exact-tree landing checks remain the start and end-state guards; no runtime floor or new persistent mechanism changes.
80/20: Targeted real Git CLI cases cover both sides of prompt scope, unchanged non-prompt validation, explicit bases, detached pushed tips and the two-parent frozen-subject reproducer with explicit reopening.
VERDICT: author submission; independent review remains with the desk
