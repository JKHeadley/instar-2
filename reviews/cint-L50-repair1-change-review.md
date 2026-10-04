# Change review — cint-L50 repair 1: a shared RAM test root other runs have filled sends this run's temp files to the real disk

Subject base: 2afadf1e068ded469a378ef4219ef4bb62a69bb5
Review state: open
Reviewed content: none
Outcome: Repairs the cint-L50 studio gate (EXIT=1, 12 failed in 4 files: tests/assembly/fixed-installation-live, tests/model-provider/refusals, tests/preview/journal-commitments, tests/preview/native-harness-contract). Every failure was ENOSPC on /Volumes/instar-test-ram, the 8 GiB RAM volume the vitest globalSetup puts test temp files on; it is shared with other test runs on the host and had 639 MiB free (5.9 GiB held by other runs' directories outside this suite's instar-test-<pid> sweep). No product code was at fault. tests/setup/test-tmp.ts now uses the platform RAM root only when it has RAM_MIN_FREE_BYTES (4 GiB) free after this suite's own dead runs are swept; short of that it falls back, with one loud warning, to the explicit real-disk root /var/tmp (kind ram-full), not to the inherited TMPDIR, because a harness may point TMPDIR at the same full volume (this session's did). An explicit INSTAR_TEST_TMP override is unchanged and never second-guessed on space. All four failing files pass in targeted runs on this tree (47 + 54 tests).
Affected rules: 37 (fixed at the source of the false failures, the temp-root choice, with no quarantine), 36 (both sides proven: a root one byte under the floor falls back, a root at the floor is used, and the live run lands on /var/tmp on this host), 116 (one free-space comparison in the existing chooser; no reservation, quota or cleanup daemon).
Affected floors: secrets — unchanged; spend cap — unchanged, test infrastructure only; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged, product durability code is untouched
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: test infrastructure only; no src/ file changes.
Side effects: on a host whose shared RAM volume is under 4 GiB free, the suite's temp files go to /var/tmp on the real disk for that run (more disk writes, same cleanup at teardown). The 5.9 GiB of other runs' leftovers on the studio RAM volume are not touched by this change and are reported to the desk.
Undo and recovery: revert the commit and this record. Nothing is persisted.
Multi-machine posture: unchanged on Linux (/dev/shm gets the same floor); each machine measures its own RAM root.
Layer below: statfsSync(root).bavail * bsize, after sweepDeadRuns(root).
Bug class: unit
Bug evidence: reproducer=tests/unit/test-tmp-redirect.test.ts
Hook bypass: none
Convergence: none
Decision: cint-L50-ram-full-fallback | fall back to /var/tmp, not the inherited TMPDIR, when the RAM root lacks 4 GiB, because the inherited TMPDIR here is itself on the full RAM volume | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L50-PROGRESS.md
Prompt review: no model-facing change.

Subject (3 paths): reviews/cint-L50-repair1-change-review.md, tests/setup/test-tmp.ts, tests/unit/test-tmp-redirect.test.ts

## Closing block

simplestRobustRoute: required outcome: the suite never fails on space other runs took. Route: one free-space floor on the existing RAM-root choice, falling back to the existing real-disk root.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
