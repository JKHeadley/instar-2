# Change review — Require current dispositions for restored prompts

Subject base: 825ad16d88faafeb6326ab1077f56af31da65e51
Review state: open
Reviewed content: none
Outcome: A prompt or fixture touched by own commits requires one valid disposition in an own review record even when its broad net subject cancels the edit. Unrelated older findings remain debt.
Affected rules: 12, 27, 37, 49, 70, 74, 95, 101, 102, 109, 111, 112, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Focused release-integrity checker repair; no runtime behavior or authority changes.
Side effects: All own records see findings from own prompt and fixture paths; one accepted disposition discharges missing dispositions for that finding. Explicit repair dispositions and every non-prompt validation remain blocking. Prior records only receive the round-four report locator required by the desk.
Undo and recovery: Revert this repair with a new commit; preserve branch history and prior review rounds.
Multi-machine posture: Machine-local Git and fetched remote refs, deliberately; explicit CHANGE_REVIEW_BASE remains authoritative. No shared runtime state or network behavior changes.
Layer below: Git per-commit diff-tree paths, record net subjects, scanPrompts finding paths and ids, validateRecord disposition checks, existing coverage and frozen-content validation; Astra round-three MF1 and its real-Git reproducer.
Bug class: integration
Bug evidence: reproducer=tests/register/change-review-git.test.ts
Hook bypass: none
Convergence: none
Decision: review-scope-1010-r4-D1 | Keep all added or modified paths from the existing per-commit walk and route touched findings through existing own-record validation; accept one current disposition without demanding historical record edits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/review-scope-1010-r4-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: extend the existing path set and reuse each record's existing validation result to require one own disposition. It prevents a rollback hidden by a broad net review subject from being excused as inherited debt. No base-tip comparison, extra tree scan, baseline, persistent state or new protocol. Coverage and frozen-content checks retain the start guard; the existing landing path remains the end guard; all five runtime floors remain unchanged.
80/20: The reviewer rollback fails without a current disposition and passes with one, under both default and explicit boundaries. The existing unrelated-debt, changed-fixture, coverage, freeze, governed-history and landing cases remain covered.
VERDICT: author submission; independent review remains with the desk
