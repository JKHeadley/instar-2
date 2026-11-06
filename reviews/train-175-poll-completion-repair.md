# Change review — finish the local poll response once

Subject base: f76f20ef89d1dec12c3a74f6b186838832ab551c
Review state: open
Reviewed content: none
Outcome: The integration fixture completes its HTTP response once whether the fallback or launch settlement arrives first; async completion is judged by the child result rather than cleanup latency.
Affected rules: 24, 34, 37, 55, 60, 70, 74, 101, 102, 107, 112, 113, 116
Affected floors: secrets — synthetic credential and local endpoint only; spend cap — no provider calls; stop — existing finite child/transport bounds unchanged; no duplicate sends — production send path unchanged; durable intake — no production store changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test fixture and its regression; no product, prompt, parser, policy or capability change.
Side effects: The endpoint's second completion becomes a no-op. The invalid cleanup-before-poll timing assertion is removed; successful child code, no timeout, exact stdout, response status/body and the synchronous timeout/no-output control remain. One added case forces the fallback to respond before releasing the child.
Undo and recovery: Revert these test changes; no installed state needs recovery. Keep the supplied full-run failure and local red logs as evidence.
Multi-machine posture: Deliberately machine-local, ephemeral loopback endpoint and resource owner; no cross-machine behavior changes.
Layer below: scripts/production-boot-io.mjs uses async child IO for poll and spawnSync for invoke. scripts/resource-owner.mjs finalize clears the execution timer before cleanupTree; execute resolves only after cleanup. Thus cleanup settlement after the response fallback does not prove event-loop starvation.
Bug class: integration
Bug evidence: reproducer=tests/integration/telegram-poll-concurrency.test.ts; other=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-poll-repro.log
Hook bypass: none
Convergence: none
Decision: train175-poll-once | Reuse a completed-response guard at the existing completion closure, retaining the original timeout limits and transport/owner composition. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md
Decision: train175-poll-observation | Remove the cleanup-settlement ordering measurement after an actual run showed a successful child settling at 4248.9ms after a poll at 3161.5ms; retain direct child success/timeout checks and the synchronous negative control. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md

1.x FIRST: searched actual JKHeadley/instar main 9eb59f4fab78ff6ca9be18ff09ef42b3f74d33ba src/ and docs/specs/ for headersSent, writableEnded and long-poll. Reuse the complete responseAlreadyCommitted predicate from src/server/middleware.ts (introduced in ab26b7ca3) at this single fixture write boundary. Inspected src/messaging/TelegramAdapter.ts async poll/getUpdates and its history (63877852a, 555abc253, 6e042b293), docs/specs/test-runner-concurrency-bound.md and history 1f90fa1a9/618560b3e/c91b8780e, plus ONEX-LESSONS.md section 6. The response guard fits the exact double-header symptom; Express method wrappers and the host semaphore do not belong in a local Node HTTP test. The existing 2.0 async poll/resource owner already supply the fitting integration behavior.

Step-back disposition: The supplied full run passed 1025 files and failed both cases here with ERR_HTTP_HEADERS_SENT. Prior 9ba065757 added a timer/settlement race without a completion guard and measured final cleanup against the hold. Repair only those two mistakes; no timeout inflation, retries, quarantine, production edits or ability reduction. Accepted browser/mobile/resource repairs are retained; this failure supplies no cause to revert them.

Evidence: The original two tests passed locally in 5.76s; this did not exonerate the full-run red. Before the guard, the new forced fallback case failed with the exact double-header exception in 602ms. After the guard, that case and the synchronous control passed, while the original ordering assertion failed at 4248.9ms versus 3161.5ms despite code=0, limited=false and exact stdout. Both red logs are retained in canonical lanes. Final targeted and cheap-check results are recorded in the progress report. No new full-run result is claimed; the pipeline owns qualification.

## Closing block

simplestRobustRoute: This is the simplest route: one existing completed-response predicate at the fixture write, and direct execution-result assertions instead of a cleanup-speed proxy. One forced ordering regression proves the failure without CPU load. No new product machinery.
80/20: Restrict the repair to the named integration file and this author record; run its three cases, TypeScript and final committed-head cheap checks. Preserve the full-run red and leave independent acceptance to the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
