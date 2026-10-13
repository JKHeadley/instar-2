# Change review — Install compiler dependencies in the register wiring fixture

Subject base: d8eb897b5430cd64fb1a7ec8410c1fadd7ddb024
Review state: open
Reviewed content: none
Outcome: The isolated R2 register fixture supplies installed compiler dependencies so the direct wiring command can build its missing core and exercise the intended committed-source checks.
Affected rules: 1, 26, 37, 49, 70, 74, 101, 102, 111, 113, 116; purpose constraint 3.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. Only temporary test setup changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Repairs a test fixture precondition; production code, agent abilities and acceptance rules are unchanged.
Side effects: The temporary working checkout receives a dependency symlink immediately before its direct wiring check, after all fixture commits. The real compiler creates local dist output. Existing missing-bridge and ambient-source refusals remain asserted; no committed dependency or compiled-output shortcut is introduced.
Undo and recovery: Revert the fixture and review commit. Temporary directories are removed by the existing finally block; removing the symlink does not remove its target.
Multi-machine posture: Deliberately machine-local temporary fixture dependencies and compiler output; the committed source graph remains identical across fixture clones and is checked on each test host.
Layer below: Inspected buildCoreIfAbsent in scripts/check-architecture.mjs, its direct wiring caller, tests/register/wiring-clean-build.test.ts dependency setup, and the isolated fixture commit/clone sequence. The compiler is invoked through node_modules/typescript/bin/tsc in the fixture working directory.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: register-fixture-installed-compiler | supply the isolated working fixture with installed dependencies instead of weakening the real build or wiring checks | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-answer-cancel-transient-1013-repair-PROGRESS.md

Subject (1 paths): tests/e2e/register.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the installed dependency symlink already used by the clean-build fixtures. Start with no compiled core; the real wiring command must build it and accept valid pinned evidence; adding untracked source must still refuse. No new production machinery or autonomous-completion claim.
80/20: The exact reported R2 assertion failed before the repair and passed afterward, including both bridge refusals, committed bridge acceptance, actual core creation, and untracked-roster refusal. Typecheck passes. The full changed test file and cheap gates are verified before submission; independent acceptance remains with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
