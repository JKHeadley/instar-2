# Change review — Bound and schedule recovery fixtures independently

Subject base: b0f4776aad26b9623c47c4f7450d625b072c5409
Review state: open
Reviewed content: none
Outcome: Remove synchronous child-matrix starvation and give startup and nine-allocation recovery distinct finite fixture budgets while retaining all failure and safety assertions.
Affected rules: 26, 36, 37, 44, 49, 60, 61, 66, 70, 74, 95, 101, 102, 111, 113, 116
Affected floors: secrets — unchanged fixture custody; spend cap — unchanged real Six allocations; stop — unchanged three-second signal response and operator-stop refusal; no duplicate sends — retained exactly-one reply after restart; durable intake — all crash and persistent-uncertainty checks retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test scheduling, fixture allowances and runner-defect evidence only; no installed runtime, authority, prompt or parser change.
Side effects: Crash cases yield IPC while their real workers run, and use the existing shipped TypeScript loader instead of per-child Vite startup. Splitting the cases gives each cut a fresh bounded test deadline. Signal readiness allows 30 seconds before the unchanged 3-second response test; the SIGTERM case injects a 10.5-second cold start. Nine-allocation recovery gets a 60-second request; the failed-census 150ms refusal stays intact. The injected paused census proves no debit returns before observation.
Undo and recovery: Revert these test and defect-record changes; no data migration or production rollback is needed. Retain the original failed gate and targeted logs.
Multi-machine posture: Machine-local subprocess fixtures; repository-shared tests, no cross-machine identity or state changes.
Layer below: Read the constitution, resource owner admission/waiter/reconciliation and allocation deadlines, actual child launch/recovery workers, shipped loader, existing async-child runner, journal endpoint and signal fixture, and prior RPC-timeout defect. Production limits are not test harness readiness budgets.
Bug class: integration
Bug evidence: reproducer=tests/e2e/harness-adapters-round7-regression.test.ts; Supplied fast-train-188-b0f4776a/fast.log: synchronous crash matrix took 79s against 60s; idle poll readiness failed at 10s before signal; the tenth recovery request returned no launch after the nine preceding unresolved allocations. This is a test-infrastructure repair, with no claim of a product defect fixed.
Hook bypass: none
Convergence: none
Prompt review: Only test scheduling and startup delay change. The complete existing provider fixture, Decision values, prompts, parsers and expected review dispositions remain unchanged; no new model-facing path requires recorded-output replay.

1.X FIRST: Searched actual JKHeadley/instar origin/main 028483097cb0a835a7d1264680a44dc4c2acb063 src/core/hostTestRunnerSemaphore.ts, src/core/hostSpawnSemaphore.ts, src/monitoring/ResourceSampler.ts and docs/specs/per-agent-resource-ledger.md, docs/specs/blocking-process-scan-command-resolution.eli16.md; inspected history 1f90fa1a9, 618560b3e, e1a1b7218, 95b289eef and ab26b7ca3. Read ONEX-LESSONS.md section 6. Reuse bounded async child observation (per-agent-resource-ledger spec) and unknown-preserving reobservation (resolveDfLocal, hostTestRunnerSemaphore.ts:715-754). Mismatch: 1.x host-slot cleanup is not the 2.0 Two/Six crash/recovery contract. Existing 2.0 async-child.ts is the direct implementation fit, and existing resource owner recovery remains intact. Inherited census comparison: reviews/train-188-change-review.md at 1.x main 154a09ffd44749ceac6205e4a95a9df4c56f4659.

Decision: train-188-timing-fixtures | Reuse the async child runner, split independent crash scenarios, and separate readiness/recovery budgets from signal/refusal deadlines. No quarantine, production ceiling change or alternate recovery implementation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-PROGRESS.md

Subject: tests/e2e/harness-adapters-round7-regression.test.ts, tests/preview/journal-agent.test.ts, tests/preview/resource-census-recovery.test.ts, docs/defects/vitest-worker-rpc-timeouts.md.

Verification: All three complete touched files passed with nice -n 10 and --maxWorkers 1: 14 crash cases (37.66s run), 4 census cases (85.17s run), and 20 launcher cases (165.14s run). The delayed SIGTERM case passed in 26.616s including boot/resume and retained the unchanged three-second signal-response assertion. No unhandled RPC errors were reported in these runs. The full-run verdict remains the automatic Studio gate's responsibility; the saved failed report is not replaced or claimed green.

Publication: The initial cheap gate correctly refused stale owner-reference pins for the changed test. The delegated desk rehash and repin refreshed two preview source pins and their chain. Register publication is regenerated from committed source with the existing replay builder; no pin is edited by hand.

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing nonblocking runner and independent finite fixture budgets. The credible failure is event-loop starvation and boot/reconciliation consuming the wrong test interval. Existing launch limits, stop, real census evidence, retained debits and exact crash-state assertions hold. No production subsystem or autonomous capability is added; this is a tested source handoff, not live runtime acceptance.
80/20: Run the three touched files with one low-priority worker, typecheck/build and final cheap checks. The automatic Studio gate owns the fresh full run and RPC defect closure.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
