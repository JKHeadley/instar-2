# Change review — train-181 native report repair and failing fixture boundaries

Subject base: b95fc4f6ad08e02d180ab476eb6e744a0ed1e53a
Review state: open
Reviewed content: none
Outcome: combine the accepted native report-loss repair and correct the five failing test files at their timing/notice boundaries, retaining all effect and accounting assertions; retain the unattributed runner error as an open defect for full qualification.
Affected rules: 1, 26, 31, 37, 42, 55, 60, 61, 63, 70, 74, 95, 101, 102, 107, 113, 116
Affected floors: secrets — no custody changes, HTTP fixture credentials remain local; spend cap — timeout uncertainty retains maximum exposure; stop — accepted exact-child supervisor backstop and stale-owner refusal retained; no duplicate sends — same-operation repeat refusal and exact send accounting retained; durable intake — peer history, orphan-capture refusal and replicated receipt assertions retained.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: accepted native enforcement timing repair is combined intact; remaining changes are test infrastructure and evidence. No product capabilities or model behavior are narrowed.
Side effects: supervisor owner backstop is 850ms, including before worker termination, not a hard 600ms termination guarantee; absent terminal report remains UNKNOWN. Test outer peer startup bound is 15s while peer work remains 3s; owner-loss fixture uses the shipped 30s term. No deployment occurs.
Undo and recovery: revert this repair's merge and fixture commit together only if replacing the accepted native repair; keep retained failure evidence and unknown effect ownership. No live journal or installed release is changed.
Multi-machine posture: native enforcement is host-local; the two-runner test retains replicated history, exact epochs and receipts across both takeovers. No cross-host success is inferred from same-host fixtures.
Layer below: supervisor guard report consumption and deadline backstop; HTTP intake versus timer scheduling; child cold module loading versus peer protocol deadline; lease renewal versus synchronous launcher work; Vitest worker event-loop service between receiver restarts.
Bug class: integration
Bug evidence: reproducer=tests/assembly/fixed-worker-monitor-native.test.ts; other=tests/integration/fixed-installation-peer.test.ts
Hook bypass: none
Convergence: none
Decision: R1 | merge accepted e7d5dbc538d47dc75c7344d51714a4c1943a9589 intact, retaining its timing disclosure and UNKNOWN neighbor | reported=docs/release-evidence/train-181-repair-report.md
Decision: R2 | admit the exact activation reminder in the two answer assertions with negative controls, preserving the answer and other suffix restrictions | reported=docs/release-evidence/train-181-repair-report.md
Decision: R3 | inject the timeout event after real HTTP intake and prove the before-arrival neighbor separately, checking the selected bound and retained exposure | reported=docs/release-evidence/train-181-repair-report.md
Decision: R4 | separate cold child startup from the unchanged peer work bound, forward the selected cache, distinguish infrastructure failure, and yield between restarts | reported=docs/release-evidence/train-181-repair-report.md
Decision: R5 | use the shipped lease term in the owner-loss fixture while retaining all epoch, history, hold and uniqueness assertions | reported=docs/release-evidence/train-181-repair-report.md

Decision: R6 | separate launcher startup from idle polling and signal response, with an injected slow-start positive control | reported=docs/release-evidence/train-181-repair-report.md

1.x comparison: actual JKHeadley/instar origin/main 67f96999fcde01181533d954a165b5db2abc1856 inspected at src/monitoring/SessionWatchdog.ts (hardCeilingExceeded, signalIfIdentityMatches), src/core/LeaseCoordinator.ts (renewal/self-fence), docs/specs/launchd-process-ceiling-floor.md and docs/specs/multi-machine-lease-robustness.eli16.md. History e4b4d2bee/6e2872663/e0dfce86f and bf4f0d766/999fcab96/ab26b7ca3 inspected; ONEX-LESSONS sections 1, 2 and 6 read. The native member inherits f3f94826's watchdog and per-UID ceiling comparison. These provide separate timing bounds, exact identity and honest uncertainty principles, but do not implement the 2.0 traced guard/report or local fixture transport. Reuse the accepted 2.0 implementation whole, not a replacement subsystem. The independent review's member comparisons and carryover-02 omission remain applicable.

Model-facing scope: no prompts, model output parsers, accept/escalate/refuse runtime decision or delivered reply construction changes. The review canaries retain their existing replay/launcher coverage. No fresh deployed-journal or live-model proof is claimed.

Verification and limits: see the committed repair report. The b95fc4f6 full run remains RED. The unattributed onTaskUpdate error stays OPEN in docs/defects/vitest-worker-rpc-timeouts.md; yielding removes a known opportunity but does not establish attribution. Full suite, installed native certification and independent acceptance belong to the desk.

## Closing block

simplestRobustRoute: retain all accepted train members and the existing native owner; combine its accepted repair, then fix only the failing fixture assumptions at their existing boundaries.
80/20: one accepted source repair, bounded fixture changes with paired controls, no new watcher or capability restrictions, no quarantine or full-run claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
