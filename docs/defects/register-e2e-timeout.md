# Defect: register e2e timeout (Rule 37 quarantine)

**Status:** OPEN. This test is quarantined under Rule 37.
**Owner:** the register test maintainer carrying `fix/register-e2e-flake`.
**Opened:** 2026-09-24.
**Governing ruling:** `.instar/lanes/astra-register-flake-ruling.md`, which follows MUST-FIX 2 of `.instar/lanes/astra-scope-freeze-class-ruling.md`.

## Test identity

- **File:** `tests/e2e/register.test.ts`, in the describe block `compiled register build adapter lifecycle`.
- **Case:** `P3-NF-09 P3-NF-13 P3-NF-19 P3-NF-24 P3-NF-26 R1/R3/R5 shipped CLI rejects invalid holders, deadlines, rungs and unbound shape changes`.
- **Affected contract IDs:** P3-NF-09, P3-NF-13, P3-NF-19, P3-NF-24, P3-NF-26.
- **Budget:** `120_000` ms. It is unchanged, and no timeout increase is authorized.
- **Quarantine form:** a literal `it.skip` whose title carries `SKIPPED: Rule 37 timeout flake; docs/defects/register-e2e-timeout.md`. The complete body, the positive controls, every refusal assertion, the cleanup and the budget are all retained.

## Evidence

All runs are six-worker parallel desk gates on unchanged test code. The logs are under `.instar/lanes/par-qual/<run>/gate.log`.

| Run | Case result | Case duration | File duration | Notes |
|---|---|---|---|---|
| `first-landing-90d3494` (content equal to main 1258873) | passed | 111,996 ms | 280,913 ms | 93% of the budget, on an otherwise clean gate |
| `sentinels-9ecfc48` | timed out | 142,313 ms | 366,503 ms | another gate was running concurrently |
| `awareness-2f586b8` | timed out | 157,448 ms | not recorded | the adjacent `P3-P4-P5 shipped CLI resolves both owners…` case also failed at 74,072 ms with `Hook timed out in 10000ms` (two hook timeouts) in the same run |
| `sessions-8689b17` (earlier) | timed out | not recorded | not recorded | host at about 90% CPU (per the ledger) |
| Prior reviewer, single-case one-worker rerun | timed out | 120 s test budget, 10 s hook | 178.21 s total | recorded in `astra-scope-freeze-class-ruling.md` |

The table includes both red and green evidence. These results establish unreliable test execution. They do not establish a register semantic defect, and they do not prove that CPU contention is the root cause.

## Coverage residue

While the case is quarantined, this shipped-CLI combination of the five P3 IDs is not executed. Other tests for the same P3 IDs remain active. Their passes do not prove that the skipped assertions ran. Report gate results as "green with one Rule 37 quarantine", never as "all P3 cases passed". The contract map keeps all five rows, with the actual skipped status.

## Repair commitment

Diagnose and remove redundant fixture or source-reading work. The repair must preserve committed-source semantics, the positive controls and every refusal assertion. The root cause is still unconfirmed.

The case makes one temporary repository and one fixture copy, then runs `scripts/build-register.mjs` 19 times against successive commits. That script imports already emitted `dist` modules, so it does not recompile. `scripts/register-source.mjs:readCommit` launches a separate `git show` for each selected source and TypeScript file on every invocation, so measure that first. Any repair must preserve exact commit binding, source bytes and normalization, roster checks and missing-source refusals. It must never read ambient working files.

## Re-surfacing cadence

Every register or landing gate report lists this open defect next to the skipped result until the defect is closed. The assigned maintainer carries it in the existing work queue. No quarantine service, registry or scheduled checker is added.

## Closure

1. In the repair revision, remove the skip and its reason, and keep the full assertion set and the budget.
2. Record the changed mechanism and the actual case duration in the normal six-worker gate, and identify the host and any overlapping work.
3. Show meaningful headroom that is attributable to the repair. Another unchanged near-limit pass is not a fix.
4. If the case is still marginal or unreliable, keep the quarantine and this defect open while unrelated work proceeds.

Keep this record after closure, and add the repair revision and its evidence.

## Rollback

Only this test stops executing, and no production path changes. If the repair regresses, revert it and restore this explicit quarantine with the defect reopened. Do not reinstate an unexplained red gate.
