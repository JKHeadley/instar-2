# Change review — sb-w4-rollback repair 5: the workspace-volume test mounts at a fresh name per run

Subject base: 599a9761b0db97500a85a07385716f67ed7e7653
Review state: open
Reviewed content: none
Outcome: The full-suite gate (2026-10-05 16:43) failed `tests/preview/tool-turn.test.ts` "bounds a workspace's whole storage" at `detachScratch(turn)` returning false. The cause was not a busy volume: a volume from an earlier interrupted run of this same test was still mounted at the test's fixed mount point `/private/tmp/itw-0123456789ab` (`hdiutil info` named its image under a `/private/tmp/tool-scratch-*` root that no longer existed). The test's own volume mounted on top of it, so after the test's detach the path still sat on another device and `scratchMounted` stayed true. Widening the unmount wait to about 10 s was tried and the test still failed (it waits on a mount that will never leave), so that change was discarded. The fix gives the test a fresh `itw-<12 hex>` name per run: a fixed machine-wide mount name collides with an orphan or with the same test running in another worktree. The two orphan volumes (disk6 at the fixed name, disk14 at itw-fdd43a083f32, both with deleted backing roots) were detached by exact device. Runner code is unchanged.
Affected rules: 26, 37, 60, 74, 101, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged (test-only).
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: a test-only change of one mount name; no executed runner byte changes.
Side effects: none at runtime.
Undo and recovery: revert this commit and this record.
Multi-machine posture: machine-local test; a per-run name makes it safe to run concurrently on one machine.
Layer below: reviews/sb-w4-rollback-repair1-change-review.md (the bounded unmount wait)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: sb-w4-rollback-r5-fresh-mount-name | the test mounts at a random name per run instead of a fixed one, because the failure was a stacked mount at the fixed machine-wide name, proved by `hdiutil info` and by a widened wait still failing; a source change to the unmount wait was rejected because no wait clears a mount that is not this test's | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rollback-PROGRESS.md
Prompt review: not model-facing. The change is one test's mount name.

Subject (1 path): tests/preview/tool-turn.test.ts

## Closing block

simplestRobustRoute: required outcome — the workspace-volume test is independent of other runs on the host. Simplest robust route: a per-run random mount name. Added machinery: none.
80/20: `nice -n 10 npx vitest run tests/preview/tool-turn.test.ts --maxWorkers 1` failed with the orphan present and a 10 s wait, then 14 passed with the per-run name; no volume left mounted afterwards.
VERDICT: author submission; the independent verdict is recorded as a pass
