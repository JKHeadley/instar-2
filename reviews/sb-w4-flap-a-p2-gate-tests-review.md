# Change review — align gate tests with invocation and declaration recovery

Subject base: 09eb693fb853e5afc23d312d1a89955c0f9f3566
Review state: open
Reviewed content: none
Outcome: The in-flight test observes actual model invocation; writer recovery tests account for the recorded output's invalid fulfillment declaration while preserving writer and restart assertions.
Affected rules: 26, 28, 29, 34, 36, 37, 38, 49, 55, 70, 74, 101, 102, 111, 112, 113, 116
Affected floors: secrets — no runtime or captured bytes changed; spend cap — bounded retry counts still asserted; stop — existing production gates unchanged; no duplicate sends — no in-flight notice and no reopened send still asserted; durable intake — real journal reopen and verified writer assertions retained
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Two test corrections only; no production behavior, prompt, parser, or admission policy changes.
Side effects: The in-flight check no longer depends on how many asynchronous steps precede model invocation. The writer test calls its formerly none case declaration because the real output fulfills promise 0, absent from its replay context. That causes one bounded declaration repair; a prior format retry already consumes that allowance. A confirmed timeout can precede the repair. Every prepared writer is checked, and the absent promise must remain unclosed.
Undo and recovery: Revert this commit to restore the old assertions; there is no state migration or operational change. That reintroduces the five deterministic test failures.
Multi-machine posture: Machine-local disposable test journals, deliberately. Distributed ownership, replication, authority and checkpoint behavior remain unchanged.
Layer below: Inspected validateRequestedPacket's asynchronous admission, reserve-before-model ordering, declarationDefect's offered-promise validation, settled's bounded timeout and format recovery, sessionWriterOf propagation, and journal replay. The recorded parseable answer refers to promise 0 without the test having seeded it; its declaration repair is correct.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: flapa-r3-test-contract | Correct test observations rather than alter working admission or suppress valid declaration recovery; retain original captured bytes and all identity/reopen checks | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-flap-a-p2-repair-PROGRESS.md

Verification: At the assigned gate SHA, the two named files reproduced exactly five failures and 71 passes. After the test-only repair, foreground nice -n 10 npx vitest run tests/preview/journal.test.ts tests/preview/retry-writer.test.ts tests/preview/flap-a-declarations.test.ts tests/preview/business-step-supervision.test.ts --maxWorkers 1 passed all 103 tests. nice -n 10 npm run typecheck passed. Architecture and register wiring passed with zero issues; register:check passed without regeneration. No quarantine, skip, live send, load generator or full-suite run was introduced.

Recorded evidence: retry-writer replays unchanged proofroom1-q-20261006-174418 requested-action:0 attempts 1/2 originating from update 715674580, plus the existing lostanswer-live confirmed-timeout outcome. The declaration tests additionally replay 715674119, 715674175, 715674172, 6232373, 6232374, 6232376 and 715673614, proving repaired/invalid/valid/unknown neighbors. No model-facing production change is made.

Saved gate limitation: The original .test-results.json copied from gate-sb-w4-flap-a-p2 records the five failures reproduced above and success:false. All eleven post-test contract checkers reject that unsuccessful historical run before contract mapping. Those bytes and the checkers are unchanged; a targeted green run cannot certify a successful full gate. The authorized Mama PC pipeline must produce the fresh full-run receipt after push.

## Closing block

simplestRobustRoute: This is the simplest robust route: wait on the actual model-start signal, then assert silence while its result remains pending; count and check every legitimate repair packet from the unmodified recorded outputs. No production machinery is needed. The existing checkpoint, stop, caps, durable intake and send fences remain intact. This is a test correction, not a new autonomous capability or live-provider completion claim.
80/20: Keep the repair to the two failing tests, prove the reported failures and their corrected observations, and preserve honest red historical gate evidence for the pipeline rerun.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
