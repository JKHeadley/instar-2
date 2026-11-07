# Change review — train-177 probe test argument bound repair

Subject base: 35250214138d593fe77a0ef4298229777f9b0247
Review state: open
Reviewed content: none
Outcome: The launcher probe delivery test exercises the launcher on every supported scratch root instead of failing with E2BIG before the launcher runs, and still sends a reply above 1 MiB through the pipe.
Affected rules: 37, 70, 74, 101, 102, 111, 113, 116
Affected floors: secrets — test paths only, no credential read or printed; spend cap — no provider call; stop — unchanged, the test uses the existing bounded child call; no duplicate sends — no send path touched; durable intake — no journal or intake path touched
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test input changes; no production, launcher or access-check byte changes.
Side effects: The test now makes 20,000 short probe rows instead of 9,000 rows under the fixture directory, about 1.5 seconds for five launcher runs on the Mama PC against a 90-second test timeout. Rows name absent paths under /n; the assertions only count rows, so a host with a real /n still passes.
Undo and recovery: Revert the test commit. No state or migration.
Multi-machine posture: Test input only, identical on every host; argument size no longer depends on the machine's scratch root. No state, authority or synchronization change.
Layer below: Read tests/preview/harness-launch.mjs --probe and tests/preview/harness-user.mjs probeAccess, which pass one argv entry per spec. Measured ARG_MAX at 1,048,576 under ulimit -s 4096, the macOS value Astra recorded. Argument load is now a constant 380,000 bytes including pointers; reply is 1,160,000 bytes. Old-launcher loss could not be reproduced on Linux, where the pre-repair launcher delivered 20,000 of 20,000 rows on three runs.
Bug class: unit
Bug evidence: reproducer=tests/preview/harness-user.test.ts; other=with ulimit -s 4096 and a 38-character INSTAR_TEST_TMP the unmodified test failed at line 345 with the gate's assertion; the repaired test passes at 38 and 70 characters
Hook bypass: none
Convergence: none
Decision: train177-probe-short-paths | Use short fixed absolute paths independent of the fixture directory, as Astra's MUST-FIX 1 named, because the failure came from argument bytes that repeated the scratch root. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-015218-PROGRESS.md
Decision: train177-probe-row-count | Raise the rows from 9,000 to 20,000, beyond the fix Astra named, because short rows halve the reply and the recorded old-launcher runs kept up to 5,633 rows; 1,160,000 reply bytes keep the output-volume proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-015218-PROGRESS.md
Decision: train177-no-repin | Run no desk repin and no register replay, because lint and register:check passed and the change touches no register input. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-015218-PROGRESS.md

1.x comparison: JKHeadley/instar main 62d5c57c19aedd65b51eba4cf6071f8d61b9ae2e; searched code for E2BIG, ARG_MAX and "argument list too long". Closest fit is upgrades/side-effects/canary-sandbox-e2big.md (buildClaudeSandboxSettings enumerated every sibling worktree until the command line passed 1 MB and every Bash call failed with E2BIG); its repair removed the growth with host contents, and this test input reuses that behavior. src/core/tmuxLiteralSend.ts bounds literal send size and src/core/crossModelReviewer.ts bounds prompt size, neither fits a test fixture. The inherited comparison in reviews/train-177-harness-probe-repair-change-review.md stands: 1.x has no separate-user access probe.

Subject (1 paths): tests/preview/harness-user.test.ts

## Closing block

simplestRobustRoute: Change the test's input, with no change to production access checks, limits, retries or gates. This is the simplest robust route; it retains the large piped reply, complete-row assertion and truncated-reply refusal control, and narrows no ability.
80/20: The named test passes at a macOS-sized argument limit on two root lengths and fails before the repair under the same limit; tsc, lint and register:check pass. The macOS run on the assigned RAM root and the old-launcher tail loss remain for the Studio and m5pro gates.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
