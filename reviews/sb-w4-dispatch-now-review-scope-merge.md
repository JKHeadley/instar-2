# Change review — Merge approved review scope into dispatch-now

Subject base: 9c55b58a8acbe67ab2bf6b32f8976c13e52323d6
Review state: open
Reviewed content: none
Outcome: Merge approved main 97d8b7145a00c6f3ff927d2dcf9edd3dc52739da into dispatch-now and publish the combined register without changing runtime behavior.
Affected rules: 26, 34, 37, 49, 69, 70, 74, 90, 91, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets — unchanged disclosure checks; spend cap — unchanged reservations; stop — unchanged stop admission; no duplicate sends — unchanged ownership and intent fences; durable intake — unchanged journal custody
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Integrates approved release-review enforcement and its Git-history regression tests; no model-facing or runtime change.
Side effects: The merged review checker distinguishes older unrelated prompt debt from dispositions owed by the current change, including restored prompts. Existing baseline and source integrity checks remain enforced.
Undo and recovery: Revert the ordinary merge with a new commit and regenerate publication from the resulting committed sources; preserve both parent histories.
Multi-machine posture: Repository sources and generated publication travel together. Verification reads checkout-local Git history; runtime ownership, transport and persistence are unchanged.
Layer below: Both merge parents, changeScope remote-reachability and explicit-base handling, own-disposition validation, firstLanding shared ancestry, exact committed source hashes and desk register replay.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: dispatch-review-scope-merge | Preserve the ordinary automatic merge and regenerate through existing desk tools; targeted regressions verify the merged enforcement without changing runtime capabilities. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-dispatch-now-repair-PROGRESS.md

Subject (2 paths): scripts/check-change-review.mjs, tests/register/change-review-git.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge with no conflicts, followed by existing repin/build/rehash/register replay. No added machinery or runtime limit. Exact ancestry and committed-source checks are the start and limit guards; targeted regressions and cheap gates are the integration exit test. No live unattended-completion claim.
80/20: Run first-landing and all formerly failing additivity baseline files, the merged review-checker tests, typecheck/build, document checks and final cheap gates. Re-run every requested contract checker against the unchanged saved report and classify its historical failures; the automatic pipeline provides fresh full-suite evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
