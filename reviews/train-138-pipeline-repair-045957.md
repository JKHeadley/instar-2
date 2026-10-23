# Change review — Align historical replay assertions with single-copy preferences

Subject base: ab01b0eeb701ba0349702d7e6cd6edefa7e91277
Review state: open
Reviewed content: none
Outcome: The historical reply-format replay tests verify the accepted single-copy preference behavior, and the in-role memory replay checks the current guidance casing.
Affected rules: Rules 33/36/37/49/70/74/85/93/101/102/111/112/113/116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain existing enforcement; only test assertions and this review change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Regression test maintenance for an already accepted behavior; no runtime, guidance, fixture or governing document changes.
Side effects: Historical dual-classification model outputs are now expected to retain one preference instead of an identical directive. The tests still enforce distinct-clause and standalone directive persistence and one-off exclusion. Original fixed replay indices 0/3 have identical clauses; indices 1/2/4 have distinct clauses and keep their directives. Captured outputs remain byte-identical and are explicitly labeled historical.
Undo and recovery: Revert this test-only change; no journal schema, state or deployment migration is involved.
Multi-machine posture: Test-local temporary journals only; production custody and replication unchanged.
Layer below: Inspected readAnswer, the journal worker's validated preference/directive handling, openDirectives, encrypted reopen and correction-sticks regression coverage. A saved preference is checked after a later turn and disk reopen, not inferred from reply text.
Bug class: integration
Bug evidence: reproducer=tests/preview/directive-reply-format.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Decision: train138-replay-contract | Preserve accepted single-copy behavior; update obsolete duplicate-directive and casing assertions, retain captured bytes and add a standalone-directive restart neighbor. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-138-repair-045957-PROGRESS.md

Evidence scope: Recorded live updates 46040376/46040368 and original current/fixed/oneOff model replay arrays are reused unchanged. In-role cases 715675444/715675448 retain durable-intake, restart/no-repeat-send and public-authority checks. correction-sticks provides later-correction and distinct/superseding/invalid-source neighbors. No new model-facing behavior or fresh model generation is claimed.

simplestRobustRoute: This is the simplest robust route: correct the obsolete tests to measure the accepted durable preference contract without undoing it or introducing runtime machinery. Start guard: existing authenticated source and exact validated clause. End state: preference survives reopen without a duplicate directive; standalone directives retain their lifecycle. Limits: existing test fixture budgets and all product floors unchanged.
80/20: Run only the focused replay suites, typecheck and mandated machine checks; full-suite acceptance belongs to the Studio pipeline.
VERDICT: author submission; no independent convergence claim
