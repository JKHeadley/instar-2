# train-181 pipeline repair report

The repair preserves the train's accepted members and merges the already accepted native fix e7d5dbc538d47dc75c7344d51714a4c1943a9589. The original b95fc4f6 full gate remains RED. This report makes no claim of fresh full-suite or deployed acceptance.

## Decisions

R1: accepted native supervisor/report-loss repair, unchanged. The owner backstop moves from 600ms to 850ms; the extension also applies before termination. A missing report stays UNKNOWN. The existing 150ms and 500ms report-stall controls distinguish an accounted STOPPED from missing evidence. The member's resource-owner neighbor retains the tight refusal case and uses the existing roomy limit for normal completion.

R2: journal-agent and review-layers-canary answer assertions accept the exact activation renewal notice. Added controls reject altered instructions and unrelated appended text. Answer/review behavior does not change.

R3: the local HTTP fixture exposes the observed request boundary. A controlled abort occurs there, while the test independently asserts the selected 90ms or admitted 100ms timeout. The before-arrival abort has zero server requests but the same consumed exposure and no retry. Real timer ordering no longer falsely guarantees HTTP receipt.

R4: peer subprocesses inherit the selected transpile cache and a finite 15s cold-start envelope; their admitted protocol deadline stays 3s. An injected 3.1s startup succeeds, while a forced subprocess timeout is explicitly infrastructure failure rather than a semantic refusal. The twelve-restart matrix yields between children. The gate's unattributed RPC timeout remains in the existing OPEN defect with its owner and full-qualification condition.

R5: the owner-loss test uses the existing shipped 30s term, as its stale-owner neighbor already does. The prior 6s test term left only 1s beyond the admitted 5s transport for synchronous work. Both takeovers still require exact epochs, holder, history, receipt accounting, refusal to send without a peer and no duplicate sends.

R6: local verification exposed two idle signal tests expiring before the first poll. Separate a bounded 30s cold-start readiness wait from the existing 10s polling wait and 3s signal-response bound. Inject an 11s initial startup in the SIGTERM case; the total case envelope becomes 90s to include its existing restart/status commands. No runtime timing is changed.

## 1.x comparison and constitutional floors

Actual JKHeadley/instar origin/main 67f96999fcde01181533d954a165b5db2abc1856: inspected src/monitoring/SessionWatchdog.ts, src/core/LeaseCoordinator.ts, docs/specs/launchd-process-ceiling-floor.md and docs/specs/multi-machine-lease-robustness.eli16.md, with histories e4b4d2bee/6e2872663/e0dfce86f and bf4f0d766/999fcab96/ab26b7ca3. ONEX-LESSONS sections 1, 2 and 6 cover lease timing, uncertain timeout and bounded test concurrency. The accepted native member inherits its f3f94826 watchdog/per-UID comparison. Those mechanisms inform the boundary checks but do not replace the 2.0 traced guard/report implementation; the accepted repair is reused whole.

Rules 1/26/37/70/107 retain red evidence and require source repair; 31/63/113 retain owner/history continuity; 42/95 keep missing terminal evidence unknown; 55/60/61 keep finite resource bounds; 74/101/102 require review, honest decisions and no hook bypass; 116 selects the existing owners. Secrets, spend, stop, no duplicate sends and durable intake remain enforced at their existing checkpoints. No constitutional wording or capability change occurs. Carryover-02 remains explicitly omitted; inherited open native/live and deployment-digest limits are unchanged.

## Verification

Targeted verification is being recorded in the absolute lanes progress record; this section will be finalized before publication. Only touched test files and cheap gates are authorized here. No full saved report was fetched and no full suite was run.
