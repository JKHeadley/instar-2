# Change review — bounded asynchronous crash proofs and launcher readiness

Subject base: 1cc69a4f38cccd93d3bc92d33bddfa7b8faf166a
Review state: open
Reviewed content: none
Outcome: Reuse the existing asynchronous crash-boundary proof and activation notice matcher; separate launcher readiness and nine-row census recovery budgets from the signal-response and capacity-refusal contracts.
Affected rules: 26, 34, 36, 37, 60, 70, 74, 101, 102, 107, 112, 113, 116
Affected floors: secrets — no credential or runtime changes; spend cap — no model calls or resource ceiling changes; stop — real child deadlines reject and exact child cleanup remains; no duplicate sends — exact answer and release assertions retained; durable intake — persistent uncertainty and nine real debit assertions retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair; no production admission, resource accounting, parser, signal handling or authority change.
Side effects: Each crash cut is independently bounded and yields to Vitest IPC. Readiness may wait thirty seconds but signal response remains three seconds. The tenth census launch gets a finite sixty-second recovery budget; no assertion treats unknown census as clean. Fixture argv is split below Linux's per-argument limit without reducing aggregate census size.
Undo and recovery: Revert the repair commit. No runtime state migration. Noise processes retain intrinsic lifetime and exact-child cleanup, including a failed spawn.
Multi-machine posture: Portable checks run at nice 10 with one Vitest worker on Mama PC. Physical ulimit and process census proofs require Studio/macOS; local failures are reported, never relabelled passing. No full suite or load generator.
Layer below: The synchronous nineteen-child matrix prevents Vitest task-update IPC from progressing and combines unrelated crash cuts under one deadline. Reuse be9ab8e836bb1123d67ff0f06bdb0b4da88d2cea's exact file and journal activation regex. The activation reminder is legitimate existing output. Real startup and nine-row recovery require distinct bounded observation windows; the underlying production ceilings and freshness rules stay intact.
Bug class: integration
Bug evidence: reproducer=tests/e2e/harness-adapters-round7-regression.test.ts; other=tests/preview/journal-agent.test.ts
Hook bypass: none
Convergence: none
Decision: train187-221630-async-reuse | Reuse be9ab8e83's async crash matrix and activation matcher rather than create another repair for the same cause; a timed-out worker explicitly rejects. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-221630-PROGRESS.md
Decision: train187-221630-observation-budget | Separate readiness and multi-row recovery waits while preserving the exact three-second signal response, 150ms capacity refusal, physical census completeness and all debit assertions. Recovery remains subject to native-host verification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-221630-PROGRESS.md
Decision: train187-221630-argv | Split each fixture's 200k argument into two 100k arguments, retaining the legacy greater-than-1MiB census failure and compact-query proof; cleanup handles a child that never spawned. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-221630-PROGRESS.md

Decision: train187-221630-pins | Refresh changed-source pins with the delegated desk scripts and replay the register from the committed tree; no hand-edited hashes or altered authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-221630-PROGRESS.md

1.x comparison: Actual local JKHeadley/instar origin/main 028483097cb0a835a7d1264680a44dc4c2acb063; searched src/core, src/monitoring and docs/specs for process census, quiescence, SIGTERM, maxBuffer and concurrency. Read SessionWatchdog.ts shellExecAsync and test-runner-concurrency-bound.md, history e4b4d2bee, 618560b3e and c91b8780e, plus ONEX-LESSONS sections on sessions/recovery and section 6. Reuse asynchronous subprocess observation and bounded workers. Do not transplant its empty-on-query-failure behavior into authoritative cleanup: failed census remains unknown. The prior train-187 review documents the inherited ExternalHogProcTable compact census implementation. Exact fitting 2.0 repair owner is be9ab8e83.

Verification: Targeted changed-file tests and typecheck; completion, logs, host limitations and final committed cheap gates are recorded in the cited report. No fresh full-run report is created or claimed. The supplied gate log is the before evidence. Crash cases retain real kill/reopen assertions; notice checks retain exact answers; recovery retains both unknown/held and proven/returned sides.

## Closing block

simplestRobustRoute: Reuse the owned repair at the fixture seam, retain production bounds and semantic assertions, and report native verification separately.
80/20: Targeted three-file verification and cheap final committed gates; Studio owns full qualification.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
