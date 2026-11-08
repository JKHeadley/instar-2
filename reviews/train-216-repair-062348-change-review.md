# Change review — train-216 repair 062348: update-lifecycle fixture holds polls during the real install

Subject base: 30de9832545472a89fdbe748f5ce6c0a715df4bd
Review state: open
Reviewed content: none
Outcome: The m5pro full run of train-216 30de9832 failed one test, tests/preview/update-lifecycle.test.ts, with "expected undefined to match object { status: 'verified' }" at line 69. Cause: the pre-update agent runs a fixed 35 cycles of 1-second polls, about 35 s, while the shipped updater does a real npm install of the copied package. Under four-way full-suite load the install outlasted the 35 cycles, the agent ended on its cycle limit with exit 0, and no update was requested or handshaken. The fixture endpoint now holds an empty poll its full 5 s only while the fixture npm shim's install marker exists, and 1 s otherwise. The agent's cycle budget then covers about 175 s of install, and the rest of the run keeps its old pace. Product code is unchanged.
Affected rules: 37, 43, 55, 74, 101, 102, 111, 113, 116
Affected floors: secrets — no credential path touched; spend cap — no model call added (tools off, zero calls asserted); stop — unchanged; no duplicate sends — no send path added; durable intake — unchanged. Test fixture only.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Two test-side files: an opt-in ninth argument on a fixture endpoint that no other caller passes (all others pass at most seven), and the one test's fixture timing. No src/ or scripts/ change, and no runtime behavior changes.
Side effects: tests/preview/journal-poll-endpoint.mjs gains optional argv[8]. When it is absent the wait is unchanged (min(timeout, 5) s), so the 21 other callers behave exactly as before. update-lifecycle passes --max-poll-seconds 5 instead of 1, and its npm shim writes and removes the marker around the real install, keeping npm's exit status. The per-invocation spawnSync bound goes from 100 s to 200 s and the test bound from 220 s to 450 s. These are safety ceilings that only matter on a loaded host. Unloaded runtime: 143 s (was 146 s).
Undo and recovery: Revert the fix commit on train-216; nothing outside the repository is written.
Multi-machine posture: Machine-local, deliberately: a single-host test fixture; nothing is shared or replicated.
Layer below: Read docs/00-the-purpose.md and docs/01-the-rules.md in full; read scripts/update-handshake.mjs, scripts/update-runner.mjs (observeUpdateBoot, drainUpdateRestart) and the journal-agent cycle loop (max-cycles, max-poll-seconds clamp 1..5) to confirm that a missing handshake means the updater never applied, not a handshake defect. 1.x comparison: JKHeadley/instar main b955d407, src/core/UpdateRestartHandshake.ts (already the ported source) and tests/e2e/update-native-candidate-lifecycle.test.ts. That test drives apply through POST /updates/apply with no cycle-bounded runner, so 1.x has no counterpart for this race and the fix is local to the 2.0 fixture. No ONEX-LESSONS.md exists in the 1.x tree.
Bug class: integration
Bug evidence: reproducer=tests/preview/update-lifecycle.test.ts
Hook bypass: none; core.hooksPath is .husky/_ (directory absent in this clone, so no hook ran); plain git commit with no bypass flag, no stash.
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: train-216-repair-062348-cause | Classified the failure as a cycle-budget race against a load-dependent real install, not a product defect. Reproduced deterministically with an injected 60 s install: the old fixture fails with the identical m5pro assertion and the new fixture passes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-216-repair-062348-PROGRESS.md
Decision: train-216-repair-062348-marker | Chose an install-window poll hold over raising --max-cycles. A larger cycle cap would also lengthen every post-update agent run on every host; the marker spends real time only while the install is in flight. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-216-repair-062348-PROGRESS.md
Decision: train-216-repair-062348-linux-transport | Did not change scripts/production-boot-io.mjs transportProcessLimit (it counts processes, but Linux RLIMIT_NPROC counts threads, so the Telegram transport child is refused on Linux). It is outside this failure and macOS-neutral, so it is reported for the desk instead of widening this repair. It was patched only locally and uncommitted, to reproduce on WSL. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-216-repair-062348-PROGRESS.md
Prompt review: No model instruction, prompt, parse or accept/refuse rule changes in this repair.

Verification: tsc, npm run lint, npm run register:check, node scripts/check-change-review.mjs check; vitest tests/preview/update-lifecycle.test.ts on WSL with bash as /bin/sh (private mount namespace) and the local-only Linux transport patch, three runs: fixed (pass), fixed plus injected 60 s install (pass), original plus injected 60 s install (fail, identical assertion). Exact outcomes in the desk report.

Subject (2 paths): tests/preview/journal-poll-endpoint.mjs, tests/preview/update-lifecycle.test.ts

## Closing block

simplestRobustRoute: The required outcome is that the update lifecycle proof passes independent of host load. The simplest robust route is to make the fixture's real-time budget follow the install window: a marker file written by the existing npm shim, read by the existing endpoint. The alternative, a larger fixed cycle cap, still races a slow enough host and slows every run. No product machinery is added. The safety guards (stop, spend, sends) are untouched.
80/20: The one failing test was run three ways (fixed, fixed with a slow install, original with a slow install) plus typecheck, lint, register and change-review checks; no full suite, per the brief.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
