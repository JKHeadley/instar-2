# train-181 pipeline repair report

The repair preserves the train's accepted members and merges the already accepted native fix e7d5dbc538d47dc75c7344d51714a4c1943a9589. The original b95fc4f6 full gate remains RED. This report makes no claim of fresh full-suite or deployed acceptance.

## Decisions

t181-r1: accepted native supervisor/report-loss repair, unchanged. The owner backstop moves from 600ms to 850ms; the extension also applies before termination. A missing report stays UNKNOWN. The existing 150ms and 500ms report-stall controls distinguish an accounted STOPPED from missing evidence. The member's resource-owner neighbor retains the tight refusal case and uses the existing roomy limit for normal completion.

t181-r2: journal-agent and review-layers-canary answer assertions accept the exact activation renewal notice. Added controls reject altered instructions and unrelated appended text. Answer/review behavior does not change.

t181-r3: the local HTTP fixture exposes the observed request boundary. A controlled abort occurs there, while the test independently asserts the selected 90ms or admitted 100ms timeout. The before-arrival abort has zero server requests but the same consumed exposure and no retry. Real timer ordering no longer falsely guarantees HTTP receipt.

t181-r4: peer subprocesses inherit the selected transpile cache and a finite 15s cold-start envelope; their admitted protocol deadline stays 3s. An injected 3.1s startup succeeds, while a forced subprocess timeout is explicitly infrastructure failure rather than a semantic refusal. The twelve-restart matrix yields between children. The gate's unattributed RPC timeout remains in the existing OPEN defect with its owner and full-qualification condition.

t181-r5: the owner-loss test uses the existing shipped 30s term, as its stale-owner neighbor already does. The prior 6s test term left only 1s beyond the admitted 5s transport for synchronous work. Both takeovers still require exact epochs, holder, history, receipt accounting, refusal to send without a peer and no duplicate sends.

t181-r6: local verification exposed two idle signal tests expiring before the first poll. Separate a bounded 30s cold-start readiness wait from the existing 10s polling wait and 3s signal-response bound. Inject an 11s initial startup in the SIGTERM case; the total case envelope becomes 90s to include its existing restart/status commands. No runtime timing is changed.

## 1.x comparison and constitutional floors

Actual JKHeadley/instar origin/main 67f96999fcde01181533d954a165b5db2abc1856: inspected src/monitoring/SessionWatchdog.ts, src/core/LeaseCoordinator.ts, docs/specs/launchd-process-ceiling-floor.md and docs/specs/multi-machine-lease-robustness.eli16.md, with histories e4b4d2bee/6e2872663/e0dfce86f and bf4f0d766/999fcab96/ab26b7ca3. ONEX-LESSONS sections 1, 2 and 6 cover lease timing, uncertain timeout and bounded test concurrency. The accepted native member inherits its f3f94826 watchdog/per-UID comparison. Those mechanisms inform the boundary checks but do not replace the 2.0 traced guard/report implementation; the accepted repair is reused whole.

Rules 1/26/37/70/107 retain red evidence and require source repair; 31/63/113 retain owner/history continuity; 42/95 keep missing terminal evidence unknown; 55/60/61 keep finite resource bounds; 74/101/102 require review, honest decisions and no hook bypass; 116 selects the existing owners. Secrets, spend, stop, no duplicate sends and durable intake remain enforced at their existing checkpoints. No constitutional wording or capability change occurs. Carryover-02 remains explicitly omitted; inherited open native/live and deployment-digest limits are unchanged.

## Verification

All 67 selected checks pass across seven affected test files, run in the foreground with `nice -n 10` and `--maxWorkers 1`:

- `tests/integration/model-provider-refusals.test.ts`: 19 passed; `tests/integration/fixed-installation-peer.test.ts`: 14 passed (combined 113.67s).
- `tests/preview/two-machine-runner.test.ts`: 6 passed; `tests/preview/review-layers-canary.test.ts`: 4 passed.
- `tests/preview/journal-agent.test.ts`: final run 20 passed in 149.45s, including the injected eleven-second initial startup. The earlier local run's two startup failures remain recorded and motivated t181-r6; that earlier run had 28 passed/2 failed across three files.
- Native `one accounted slot` and both `guard report stall` cases: 3 passed. Resource-owner `kills a launch that forks past its process ceiling`: 1 passed. This explicit selection left 50 other cases unselected, including CPU burners prohibited on the Studio; it is not a quarantine. Combined 15.32s.

Build and final typecheck exited 0. Architecture independently exited 0 without an R105 exception. Delegated desk rehash updated one preview owner-reference pin; the grounding inventory had no changed pin. Generated register replay at 9a5d860f6351bec12064fc131d1ed3afedea6a33 has generation sha256:b9cd16ba937933661c2dda3e7a59bd576622b54586e58aadc0f598f4771f4322: 298 entries, 121 rules, 34 terms, 113 prerequisites, explicitly shape-only.

The final post-commit lint, register check, change-review check, whitespace check and publication evidence are recorded in `/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-181-repair-PROGRESS.md`. Local record validation has no findings. No full saved report was fetched, no full suite was run, and no test result file was fabricated. The desk's full rerun remains the acceptance event for the unassigned RPC recurrence and whole candidate. Native tests are local unprivileged observations, not fresh installed-host certification.
