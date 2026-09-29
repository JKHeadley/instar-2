# Defect: production boot public entry trips the runner's fixed 60s RPC deadline

**Status:** FIXED in this revision (unit U5). Not quarantined — this is a deterministic
defect, not a flake, so Rule 37's quarantine path does not apply to it.
**Opened:** 2026-09-28.
**Owner:** unit U5 (production boot defects).
**Rules:** 37 (Zero-Failure). **Design:** D14 §2 (an exact assembly that can be started and
explained) and §3 (the shared worker contract) — the case under repair is the public boot
entry for that assembly.

## Test identity

- **File:** `tests/assembly/production-boot-public-entry.test.ts`.
- **Case:** `boots the public application before Telegram poll; fixture-admitted: <the 24
  U4-G binding holds>` — the first of the file's two cases.
- **Budget:** `180_000` ms. Unchanged. No timeout increase is authorized or taken.
- **Quarantine form:** none. The case, its assertions and its budget are all retained and
  executing.

## Symptom

Every assertion passes and the run still fails:

```
 ✓ tests/assembly/production-boot-public-entry.test.ts (2 tests) 128247ms
⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯
Error: [vitest-worker]: Timeout calling "onTaskUpdate"
 Test Files  1 passed (1)
      Tests  2 passed (2)
     Errors  1 error
EXIT=1
```

This is the failure shape that matters: a green assertion set with a red process. The JSON
reporter records `success: true` and `unhandledErrors: []` for the same run, so the report
alone does not show it; only the runner's exit code does. Because `npm run test:all` chains
the contract checkers behind `vitest run`, a non-zero exit here stops the gate before
`scripts/check-assembly-contracts.mjs` and `checkBootRecoveryCoverage` ever execute.

## Mechanism

`tests/setup/yield-worker.mjs` already documents the runner constraint: a fork worker whose
test body is pure synchronous owner work never lets its event loop reach the I/O phase, so
the runner's task-update replies queue, and past birpc's deadline that surfaces as
`Timeout calling onTaskUpdate`. The deadline is `DEFAULT_TIMEOUT = 6e4` in the bundled birpc
(`node_modules/vitest/dist/chunks/index.B521nVV-.js:3`); vitest exposes no knob for it, which
is why the remedy has to be on this side.

That existing remedy is an `afterEach` yield — it yields **between** cases. It cannot help a
**single** case that is itself one contiguous synchronous block of about a minute. This case
is exactly that: `installedFixtureHost(...)`, `fixture.boot()` and `built.receive(...)` are
all synchronous owner calls with nothing awaited between them.

Measured breakdown of the case body, standalone on the same host
(`node --experimental-transform-types --import=./tests/assembly/production-boot-source-loader.mjs`):

| Step | Contiguous synchronous cost |
|---|---:|
| `installedFixtureHost(...)` | 948 ms |
| `fixture.boot()` | 7,645 ms |
| `built.receive(...)` | 11,462 ms |
| **whole case body** | **~20 s standalone; 58,035 ms measured in-runner** |

Under the runner (reduced worker priority per `tests/setup/nice-worker.mjs`, plus host
contention) the same body measured **58,034.8 ms** as one block. Added to the interval
between the runner's task-update send and the case body starting, the worker's next I/O
phase lands past 60,000 ms and the pending call is rejected.

## Evidence

Host: Mama PC (WSL2, 10 logical cores), CPU saturated by concurrent gates during every run
below (`load-assess.sh` verdict SATURATED, 99.9% busy / 0.1% idle). Branch `unit-u5` from
`origin/main` `14bc4a17`.

| Run | Files | Result | Errors | Exit |
|---|---|---|---|---|
| `/tmp/u5-before2.log` | public-entry + the 4 shards | 5 files passed, 6 tests passed | 1 (`Timeout calling "onTaskUpdate"`) | **1** |
| `/tmp/u5-pe.log` (isolated) | public-entry only | 1 file passed, 2 tests passed; case 1 = 58,034.8 ms, case 2 = 70,205.9 ms | 1 (same) | **1** |
| `/tmp/u5-pe2.log` (isolated, after repair) | public-entry only | 1 file passed, 2 tests passed; case 1 = 74,496 ms, case 2 = 77,489 ms | **0** | **0** |
| `/tmp/u5-after.log` (after repair) | public-entry + evidence + the 4 shards | 6 files passed, 71 tests passed; public-entry file 182,990 ms, shards 3,255/2,981/3,096/3,083 s | **0** | **0** |

The third row is the load-bearing one. After the repair the case is **longer in wall time**
(74.5 s against 58.0 s, the host being busier) and the run is clean. Duration did not improve;
the contiguous block did. That separates this repair from "another unchanged green run".

Counter-evidence, recorded rather than omitted: the same file passed with no error in the
2026-09-28 full RAM-tmp gate on this host (`gate-test-tmp-ram/gate.log`), where both cases
together took 29,111 ms. The defect is deterministic **in its mechanism** — a contiguous
synchronous block crossing 60,000 ms always trips it — while the block's length depends on
host load. A lighter gate can stay under the line. That is why the repair targets the block
and not the clock.

## Repair

`tests/assembly/production-boot-public-entry.test.ts` case 1 becomes `async` and takes the
same awaited real event-loop turn `tests/setup/yield-worker.mjs` uses (`setImmediate`
imported from `node:timers`, never `Promise.resolve`, `process.nextTick` or an unref'd
immediate) between its synchronous steps. Scheduling only: identical steps, identical order,
identical assertions, identical budget, no owner behavior touched.

The largest remaining contiguous block is one public-port call — `built.receive(...)`, the
11.5 s standalone step, about 33 s at the load that produced the 58 s whole-case block. That
is roughly double the margin, **not** an elimination: a host slow enough to push a single
owner call past 60 s would trip the same deadline again. Splitting that call further would
mean editing `tests/assembly/production-boot-installed-fixture.ts`, which unit U5 does not
own. If it recurs, the next repair belongs at that boundary, and this record is where to
start.

## Coverage residue

None. Nothing is skipped and no assertion is removed, so there is no unexecuted contract
while this record is open. The file's second case (`installed bin boots the same public
application and admits Four`) was already `async` and already reaches the I/O phase early
through `await import('node:child_process')`; it is unchanged.

## Sweep of the same defect class across the U5 surface

Rule 37 is a suite-level standard, so the class was swept, not just the one case. Every owned
test case was checked for a contiguous synchronous stretch approaching 60 s:

| File | Verdict | Basis |
|---|---|---|
| `production-boot-public-entry.test.ts` case 1 | **defect, repaired** | 58,034.8 ms contiguous |
| `production-boot-public-entry.test.ts` case 2 | clean | async; awaits before and after its ~1 s synchronous prefix |
| `production-boot-conversation-shard-{0,1,2,3}.test.ts` | clean | async throughout; every cycle awaits a child process. 0 errors across the shards in `/tmp/u5-before2.log` |
| `production-boot-conversation-evidence.test.ts` | clean | 65 synchronous cases, longest 1,934 ms, `afterEach` yields between them; `/tmp/u5-ev.log` exit 0 |

One instance found, one repaired, and a re-sweep of the surface returns nothing new.

## Closure

Closed when the desk's exact-tree full suite runs the four boot-conversation shards and
`production-boot-public-entry.test.ts` un-quarantined, green, with zero unhandled runner
errors and a zero exit code, on a host whose load is recorded alongside the result.

Keep this record after closure.

## Rollback

Revert the single test file. Nothing else changes: no production path, no fixture, no
runner configuration, no budget. Reverting restores the pre-repair behavior exactly,
including the defect.
