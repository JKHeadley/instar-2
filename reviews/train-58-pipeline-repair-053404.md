# Change review — train-58 pipeline assertion repair

Subject base: 7c69a3c5bfb8c24e018414d82ada928b22f3c5d1
Review state: open
Reviewed content: none
Outcome: Restore regression checks for the accepted compact self-state and source-grounded memory update guidance, preserving runtime behavior.
Affected rules: 1, 26, 34, 36, 37, 49, 70, 74, 84, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — add explicit prompt secret exclusion assertions; spend cap — retain cap counts and raised-cap checks; stop — unchanged; no duplicate sends — retain reply counts and restart checks; durable intake — retain memory reopening and exact-source rejection checks.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Two regression test corrections; no runtime, prompt, authority or schema edits.
Side effects: Tests recognize compact prompt counts and admitted credential metadata. The status surface keeps its full-text assertions. A broken changed-fact instruction or missing exact-source/replacement still fails the memory assertion.
Undo and recovery: Revert this test-only commit; no data migration or live effect occurs. Keep the accepted runtime and captured fixture history.
Multi-machine posture: Shared repository assertions apply on every host. Real launcher admission remains host-dependent; Studio executes the launcher check and the full suite. No replicated or local runtime state changes.
Layer below: Read selfStateBrief compact rendering, readSelfAccess screening, selfStateSource metadata, journal memoryDecision and formatReminder, and the recorded memory fixture. Both constitution documents read in full and match origin/main.
Bug class: integration
Bug evidence: reproducer=tests/preview/memory-update-replaces.test.ts
Hook bypass: none; core.hooksPath unset; common hooks directory contains sample hooks only.
Convergence: none
Decision: train58-repair-memory-guidance | Assert both shipped instruction forms with their complete old-source and new-clause requirement; retain historical replay and admission checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-58-repair-053404-PROGRESS.md
Decision: train58-repair-self-state | Assert the compact prompt facts and screened access metadata while retaining plain activation labels, secret exclusions, status agreement and restart/cap checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-58-repair-053404-PROGRESS.md

Subject (2 paths): tests/preview/memory-update-replaces.test.ts, tests/preview/self-state-launcher.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: repair stale assertions at their source rather than change accepted guidance or hide useful access awareness. Existing replay tests retain exact-source admission, independent facts, recall non-authority and restart durability. Existing launcher guards and counts remain intact; no new machinery or live effectiveness claim.
80/20: Run both changed files, typecheck, architecture/register checks and the required pinned tests. Preserve red host evidence and let the Studio gate decide the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
