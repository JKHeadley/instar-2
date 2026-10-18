# Change review — Recognize already landed units in shared history

Subject base: 6310b8dcabdd6520f42f3ca79fff50e6b4153d16
Review state: open
Reviewed content: none
Outcome: Repair all saved gate stale-main failures by recognizing units already present in the actual shared ancestor. Preserve the full-baseline requirement for first landing; P15 reuses the same helper.
Affected rules: 26, 34, 37, 49, 70, 74, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets — unchanged runtime disclosure checks; spend cap — unchanged reservations; stop — unchanged admission checks; no duplicate sends — unchanged intent and ownership checks; durable intake — unchanged journal custody
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Shared verification helper affects first-landing scope checks across multiple owners; no runtime path changes.
Side effects: Already landed units remain inapplicable to first-landing comparisons when main advances independently. Structural contract checks still execute. Unlanded units, incomplete evidence sets and missing refs continue to refuse stale or unavailable baselines.
Undo and recovery: Revert this repair commit to restore unconditional ancestry checks; no state migration or durable data changes.
Multi-machine posture: Deliberately checkout-local Git evidence; shared runtime state and inter-machine authority are untouched.
Layer below: Git merge-base and exact ls-tree evidence; P15 source/test population enumeration; first-landing callers retain structural and coverage checks.
Bug class: integration
Bug evidence: reproducer=tests/first-landing.test.ts; integration=tests/scheduled/review-round17.test.ts
Hook bypass: none
Convergence: none
Decision: dispatch-repair-shared-history | Recognize prior landing using the actual shared ancestor; retain stale-baseline refusal for units absent from shared history and reuse the helper in P15. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-dispatch-now-repair-PROGRESS.md

Subject (4 paths): scripts/check-p15-additivity.mjs, scripts/first-landing.mjs, tests/first-landing.test.ts, tests/scheduled/review-round17.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: test landed evidence in shared history before refusing a divergent baseline, and reuse firstLanding in P15. The named failure is main advancing independently after a unit has already landed. Shared ancestry proves prior landing without weakening the stale-baseline guard for new units. Start guard: both refs resolve; limit guard: every evidence path exists in the shared tree or full main ancestry is required; end state: an explicit applicable result or refusal. No new runtime machinery or autonomous shipped-path claim.
80/20: Targeted real Git fixtures prove accepted shared-history divergence and refused main-only, partially landed, absent-unit and missing-ref neighbors. All 13 previously failing test files pass in targeted chunks, including measurement end-to-end collection. Typecheck, build, architecture, wiring and register checks pass. The untouched saved full-gate report remains red; its global success precondition is not fabricated.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
