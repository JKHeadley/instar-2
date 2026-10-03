# Change review — cint-L39 pipeline repair: the synchronous-poll proof waits for the launched child

Subject base: c6b2e2faf1f4aa1aa018e92528d80c65212ac43a
Review state: open
Reviewed content: none
Outcome: The Studio full run of cint-L39 c6b2e2fa failed one test: tests/integration/telegram-poll-concurrency.test.ts "the same composition over the synchronous transport freezes the launch past its timeout" received a clean launch (limited false, stdout "ok"). Cause, in the test: it started the synchronous long poll a fixed 50 ms after asking the resource owner to launch. Before the owner spawns the child it awaits admission and a process-limit query, and under full-suite load that can take more than 50 ms. The freeze then started before the child and its timeout timer existed, so the launch ran after the freeze and finished normally. Fix: the launched shell first writes a marker file, and the test waits (async, 5 ms polls, 10 s bound) for that marker before starting the poll; the child's work is 0.5 s after the marker so a slow detection still lands inside the work. Product code is unchanged. Both tests pass three times in a row in a targeted run.
Affected rules: 37 (the failure is fixed at its source, the test's race, with no quarantine), 116 (one wait on an observed event replaces a fixed delay), 74 (this record)
Affected floors: secrets — unchanged, test only; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: a test-only timing fix; no product code, prompt or register entry changes.
Side effects: none
Undo and recovery: revert the repair commit.
Multi-machine posture: none; test only.
Layer below: scripts/resource-owner.mjs execute (admit, processLimit, spawn, gate, timer) and scripts/production-boot-io.mjs invoke/poll, unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commit; no bypass flag)
Convergence: none
Decision: cint-L39-poll-proof-wait | the negative proof waits for the child's own marker instead of a fixed 50 ms, because the owner's admission and process-limit awaits can outlast any fixed delay under load; a longer fixed delay would only move the race | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L39-PROGRESS.md
Prompt review: none; no model-facing text changed.

Subject (2 paths): reviews/cint-L39-pipeline-repair-change-review.md, tests/integration/telegram-poll-concurrency.test.ts

## Closing block

simplestRobustRoute: wait for an observed event (the child's marker) instead of a fixed delay; product code untouched.
80/20: one failing test fixed at its source; targeted runs only, the pipeline reruns the full suite.
VERDICT: author submission; the independent verdict is recorded as a pass
