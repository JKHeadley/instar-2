# Change review — train-195 repair, declare the session-volume cleanup bound

Subject base: 2670d91bf29a639b7eca623a8befe46646c714ab
Review state: open
Reviewed content: none
Outcome: The session-volume cleanup hook declares its real bound, so a case whose body passed is no longer failed by vitest's 10 s hook default. This was the one failure in the Studio full run of 2670d91bf. No product code changes.
Affected rules: 13, 26, 37, 49, 70, 74, 101, 102, 107, 111, 113, 116
Affected floors: secrets — test timing only, no secret path; spend cap — no model call; stop — no stop path touched; no duplicate sends — no send path touched; durable intake — no intake path touched
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One declared hook bound in one macOS-only test file; no product, store, permission or schema change.
Side effects: A cleanup that genuinely hangs now holds its test worker for up to 240 s rather than being reported at 10 s. That is the same ceiling its synchronous detach calls already impose: the hook is synchronous, so the default never interrupted it and only labelled it afterwards.
Undo and recovery: Revert the one commit before landing. Nothing durable changes and no register replay is needed.
Multi-machine posture: Machine-local test timing; the cases run on macOS only and no state is added.
Layer below: Read detachSessionVolume in tests/preview/tool-turn.mjs: one forced hdiutil detach with a 60000 ms timeout, and a case registers at most three mounts. Read the cleanup's rmSync and the vitest configuration, which sets testTimeout but no hookTimeout, so hooks keep the 10 s default. train-197 commit 128c2057a reached the same reading from its own run of 59ed6fc24.
1.x comparison: Searched JKHeadley/instar main 5118466c2063b70d7d4e5c6d80fff02271dfe3a3. Reused practice: per-hook declared bounds such as tests/e2e/app-conversations-lease-renewal.test.ts:14 and tests/integration/telegram-origin-detector-health.test.ts:10 (afterEach with 30_000). Mismatch: src and docs/specs have no hdiutil or sparseimage match, so 1.x has no disk-image session volume whose cleanup this could inherit, and its vitest configs set no hookTimeout. ONEX-LESSONS.md is not in this worktree within three directory levels.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train195-r5-reuse-sibling-hunk | Apply the session-volume hunk of train-197's 128c2057a byte for byte rather than writing a second fix for one cause; the brief names no owner, so this is reported and only this branch's file is changed, and identical bytes keep the two branches merging clean. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-repair-025848-PROGRESS.md
Decision: train195-r5-nothing-to-shrink | The step-back directive asks for the smallest version; this failure is outside the train's reviewed behavior, so nothing is reverted and the change is this one hook bound. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-repair-025848-PROGRESS.md
Decision: train195-r5-portable-control | The cases skip off macOS, so both sides were shown with an uncommitted control test here: an 11 s synchronous cleanup fails with Hook timed out in 10000ms under the default and passes with a declared bound. It proves the timing behavior, not the volume cleanup; the Studio run decides that. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-repair-025848-PROGRESS.md
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No prompt, parser or decision wording changes; only a test hook's timeout and its comment.

Subject (1 paths): tests/preview/session-volume.test.ts

## Closing block

simplestRobustRoute: Declare the cleanup's real bound on the hook that needs it, reusing train-197's exact hunk. This proposal is that route: no machinery, quarantine, retry or restriction is added, and no assertion changes.
80/20: The single failed case is addressed at its source with a both-sides timing control and the cheap gates; the macOS run of the changed file stays with the Studio full run.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
