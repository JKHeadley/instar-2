# Change review — cint-L6: refuse an unsupported Node in one line; remove a desk-file read and two load-fragile budgets

Subject base: 05dd2dd7d4ec88d7219d50f9f138bb2e634b0d19
Review state: open
Reviewed content: none
Outcome: The gate at 05dd2dd7 ran on the Laptop with Node 26.10.0 and no RAM temp root, and 41 cases failed. The earlier Studio gate on Node 24.14.1 failed one case, and the only change since then was a test-harness timeout. Diagnosis from the Laptop's full log: 33 cases fail because Node 26 rejects --experimental-transform-types ("bad option", exit 9) or aborts the copied runtime under sandbox-exec (signal 6), and R105 correctly refuses a runtime the register does not certify (node-24.14.1). operator.test read a desk file through ../../.instar/lanes, outside the repository, so it fails on any host with a different layout. resource-owner slept a fixed 600 ms waiting for a child's startup. round20 e2e and journal-boundaries took 20x longer than on the Studio because their fsyncs landed on the real disk, and they had the default 10 s budget. Fixes: a globalSetup preflight (tests/setup/runtime.ts) refuses the run in one line when the runtime cannot accept the flag, and it is unit-tested both ways (admits v24 with the flag, refuses v26 and names the version). operator.test now asserts the in-repo production hold NON-EXECUTABLE-UNTIL-platform-delivery-witness. resource-owner polls for elevation, with a 10 s bound. The two fsync-heavy cases get explicit 60 s budgets. All 5 touched files pass locally, 55 of 55 (nice -n 10, --maxWorkers 1).
Affected rules: 2, 37, 74, 116 (37: source fixes, no quarantine; 116: one preflight line instead of per-test runtime shims; 2: a wrong runtime reports its cause, not 41 unrelated failures)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: test infrastructure and test budgets only; no src/ or production path change
Side effects: a gate on a Node without --experimental-transform-types now stops before any test with one REFUSED line; the gate host needs the certified node-24 runtime
Undo and recovery: revert the commit to restore the previous setup, the desk-file read, the fixed sleep and the default budgets
Multi-machine posture: every gate host must run a Node that accepts the flag; the Studio (v24.14.1) does, the Laptop's default Node 26.10.0 does not
Layer below: scripts/resource-owner.mjs, src/assembly/production-holds.ts (unchanged)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed; the system prompt is unchanged

Subject (7 paths): tests/e2e/part-eleven-round20.test.ts, tests/integration/operator.test.ts, tests/integration/resource-owner.test.ts, tests/preview/journal-boundaries.test.ts, tests/setup/runtime.ts, tests/unit/test-runtime-preflight.test.ts, vitest.config.ts

## Closing block

simplestRobustRoute: one runtime preflight, one in-repo assertion, one poll and two explicit budgets; no retry machinery and no per-test runtime shims
80/20: 0 must-fix, 1 note — the Laptop gate host needs node-24 and a RAM temp root (scripts/ensure-test-ramdisk.sh), which is desk-side setup
VERDICT: author submission; the independent verdict is recorded as a pass
