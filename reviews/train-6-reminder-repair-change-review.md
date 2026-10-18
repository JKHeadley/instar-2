# Change review — Restore executor evidence in the reminder launcher fixture

Subject base: 733fbd5e331a104f3d1b7b6cb5d3b53844e4798a
Review state: open
Reviewed content: none
Outcome: The offline model-failure fixture crosses the launcher's observed executor boundary before returning UNKNOWN, restoring the three reminder/cancellation launcher checks.
Affected rules: 26, 34, 37, 46, 49, 70, 74, 93, 101, 102, 111, 113, 116.
Affected floors: secrets — no real credentials or provider calls; spend cap — existing reservations and launch accounting retained; stop — existing checkpoints retained; no duplicate sends — original one-send assertions retained; durable intake — original journal preservation retained.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Offline fixture repair only; no shipped launcher, model instructions, parsing, acceptance decisions, authority, or limits change.
Side effects: The shared failure loader also serves the predecessor renewal tests, which pass. It replaces only physical subscription IO; Telegram and storage exports still come from production IO. The route's synthetic outcomes remain unchanged, but now carry executor-entry evidence.
Undo and recovery: Revert this commit to restore the old fixture and its three failures. No migration or runtime-state recovery is needed.
Multi-machine posture: Machine-local test processes and HTTP endpoints, with fixtures shared through git. Production ownership, replication, and cross-machine behavior are unchanged.
Layer below: Inspected createModelLaunchBoundary, the launcher's physicalIO.execute wrapper, observedSubscriptionIO, subscriptionExchange, ordinary-lane settlement, and the preserved journal's model-not-started hold. Long polling still failed, excluding the initial cycle-race hypothesis; that diagnostic edit was removed.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-reminder-launcher.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model-facing prompt or parser changes. The fixture uses the existing exact prepared input only to traverse observed executor entry. Its fixed reply-review response is unchanged; no test phrase or expected answer was added to a production prompt or dispatch.
Decision: reminder-executor-fixture | Preserve the production not-started safeguard and repair the offline fixture at the physical executor seam; add assertions for recorded timeout and uncertain requested action. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-6-repair-PROGRESS.md

Subject (4 paths): tests/preview/journal-reminder-launcher.test.ts, tests/preview/model-failure-io.mjs, tests/preview/model-failure-loader.mjs, tests/preview/model-failure-route.mjs

## Closing block

simplestRobustRoute: This is the simplest robust route: the existing loader replaces physical provider execution with a timeout result while the real launcher records entry. A six-line IO fixture prevents the credible false pre-launch classification caused by bypassing that seam; production needs no new machinery. Start guard is explicit fixture activation; end guards are cancellation preserved before due work and exactly one requested reply for an empty queue; limits remain the existing launcher cycle, call and process bounds. No autonomous production completion claim.
80/20: Original three failures reproduced, then 13/13 tests passed in the reminder launcher, shared renewal consumer, and pre-launch boundary files. The latter proves both before-launch refusal and after-launch UNKNOWN, including recorded proof-room journal replay. Typecheck and initial architecture/wiring checks pass. All eleven saved-report contract checks stop at the old report's failed-suite status; its only failures are the three restored reminder tests. The pipeline owns fresh full-suite evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
