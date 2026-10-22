# Change review — Restore the macOS split inventory for self-host doorway tests

Subject base: 4bb74c9f2a6b9d05e83114cc0137b9d7638e027d
Review state: open
Reviewed content: none
Outcome: Make the checked-in macOS split inventory match detection by including the self-host doorway test.
Affected rules: Rules 26, 37, 49, 70, 74, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged; only test placement metadata changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test inventory entry; no runtime, prompt, parser, assertion or authority changes.
Side effects: Split runs assign self-host-doorway.test.ts to the macOS half; unsplit runs still include it. The detector and all assertions remain intact.
Undo and recovery: Revert this commit to restore the old inventory and its demonstrated missing-entry failure; no product state recovery is needed.
Multi-machine posture: Shared test inventory routes a test reaching sandbox-exec to the macOS runner; no product state or replication changes.
Layer below: tests/platform/macos-only.mjs follows relative imports to tests/preview/self-host-harness.mjs, which spawns /usr/bin/sandbox-exec. vitest.config.ts consumes the inventory for both split modes. The existing test proves missing and stale drift and portable-file exclusion.
Bug class: none
Bug evidence: Test inventory metadata maintenance only; the unchanged tests/platform/macos-only.test.ts reproduced the missing-entry failure before the inventory addition and passes all four cases afterward. No product integration or runtime behavior changes; the red/green results are recorded in the repair progress report.
Hook bypass: none
Convergence: none
Decision: train119-macos-inventory | Add the missing sorted inventory entry using the existing detector and split consumer; retain the test and all checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-119-p2-repair-PROGRESS.md

Subject (1 paths): tests/platform/macos-only.txt

Validation: The reported assertion reproduced with one failure and three passes; adding the entry passes all four tests. TypeScript typecheck passes. Final cheap checks are recorded in the repair progress report. Full-suite rerun belongs to the Studio pipeline under the repair dispatch.

## Closing block

simplestRobustRoute: Add the one detected missing path to the existing sorted inventory; this is the simplest robust route, with no new mechanism or weakened check. Start guard is the reproduced drift; end guard is exact inventory equality plus missing/stale and portable-file controls. No autonomous product capability is claimed.
80/20: The sole reported failure is repaired at its inventory source; runtime behavior and accepted member evidence remain unchanged.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
