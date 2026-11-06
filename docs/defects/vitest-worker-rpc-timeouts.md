# Vitest worker→main RPC timeouts under load (Rule 37, runner defect)

**Status:** OPEN. **Owner:** constitutional-build integration desk (Echo). **Opened:** 2026-09-28.

Two runs recorded unhandled runner errors `[vitest-worker]: Timeout calling "onTaskUpdate"`: the full run `cbuild-4-rr1-full-5ecf9519.log` (3) and the preview run `cbuild-4-rr3-preview-run2.log` (2, with 1,055 passed and 0 failed). Vitest counts these as errors, so the run exits 1 whatever the test results. The stack resolves through a sibling worktree's `node_modules/vitest` (`../part-six-run-admission/node_modules/vitest`) via the symlinked `node_modules`. The known local causes are host saturation and a test file doing long synchronous work that starves its fork worker's IPC. Neither is confirmed for these runs.

**Disposition:** not quarantinable per test; runner errors are infrastructure. These runs stay recorded as RED; no gate built on them is reported green. Coverage withheld: none by quarantine. The runs' own results are valid evidence only for the tests they report as passed.

**Cause found and repaired (2026-09-28, cint-1):** `tests/preview/stage2-recovery.test.ts` ran the launcher with blocking `spawnSync` calls (timeouts of 90 s and 30 s). A child running over 60 s under load froze the worker's event loop, so its `onTaskUpdate` RPC timed out. Those calls now use an async `spawnNode` helper. The file alone passes 42/42 with no runner error in 827 s under load. This record stays OPEN until a full run shows zero runner errors, since other blocking calls may exist.

**Recurrence after the repair (2026-09-28, cint-2):** four full preview-gate runs on the merged tree (`--maxWorkers 2`, retained as `.instar/lanes/cint-2-gate-run{2,3,4,5}.log`) recorded 0, 0, 1 and 0 runner errors. Run 4 (load 10–13) had one `onTaskUpdate` timeout attributed to no test. The next run, on the same commit `6e7ef07d`, had zero. A diagnostic probe (a 1 s interval in a setup file, logging any gap over 20 s with the running test) was run over the eight longest files (successive, rerecord-profile, stage2, journal-continuity, clarification-binding, journal-migrate, preview, journal-summary-crash). It recorded no stall; the same probe did record a synthetic 22 s block. The remaining cause is therefore not long synchronous work inside those tests. Still candidates: main-process or host starvation, and files outside the probed set. The record stays OPEN.

**Second cause found and repaired (2026-09-28, cint-1, repair round 2):** after the stage2 repair two full runs still ended with runner errors (`full-rr2.log`: 2; `full-rr2-lag.log`: 1, zero or one test failures otherwise). A temporary, uncommitted setup file recorded every worker event-loop stall over 20 s with the running test. The only stall over the 60 s deadline was 69 s in `tests/e2e/transport-loop-a1.test.ts` (`SLB-A1-REPAIR17-E2E-114`): its `runChild` ran a whole nested vitest run through blocking `spawnSync` (timeout 90 s), as did the six `transport-loop-a1-repair*.test.ts` files. All seven now await `runChildAsync` (`tests/e2e/transport-loop-a1-child.ts`), which keeps the same result shape and still reports a failing or timed-out child as non-zero. The next largest stalls were 42 s (`tests/e2e/harness-adapters-round12-regression.test.ts`) and 36 s (`tests/conversation/telegram.round24.integration.test.ts`); they are below the deadline but have little headroom under heavier load.

**Recurrence (2026-09-28, cint-1, repair round 2b):** the preview run `/tmp/claude-501/cint1-fr/preview-run1.log` (tests/preview, `--maxWorkers 2`, host load ~11) recorded 1 runner error `Timeout calling "onTaskUpdate"`, again resolved through `../part-six-run-admission/node_modules/vitest`, alongside 10 test failures that run 2b's own change caused and repaired. The starving file was not identified; that run stays RED. The next preview run (`preview.log`, 17:02 PDT) had 0 runner errors, which is not treated as exoneration.

**Second cause found and repaired (2026-09-28, cint-5):** the cint-5 gate at `ed66cfcb` passed every test but exited 1 on one `onTaskUpdate` timeout. A full traced run (worker-side RPC trace, per-file) showed task-update replies left unanswered while a single case ran blocking child processes: `tests/e2e/transport-loop-a1.test.ts` 65 s (24 `spawnSync` vitest children in one case; that run's error), `tests/e2e/register.test.ts` 41 s (the synchronous P3-P5 CLI case), `tests/e2e/harness-adapters-round12-regression.test.ts` 37 s, `tests/e2e/harness-adapters-round9-regression.test.ts` 26 s, and `tests/conversation/telegram.round24.integration.test.ts` 28 s (a synchronous 21-case matrix). The four spawning files now use one async child helper, `tests/e2e/async-child.ts` (spawnSync's result shape and SIGTERM timeout), and the round24 matrix yields a real event-loop turn per case, as round20 already did. No assertion or timeout changed. Re-traced, the worst unanswered interval in those files is 2.3 s. The remaining blocks under 22 s are mostly module import at file start.

**Repair and closure:** the owner (1) identifies the starving file or the host condition from the worker trace, (2) confirms the resolved vitest package is the worktree's intended version, not a sibling's, and (3) repairs the cause, for example by an async yield in a long synchronous file, lower worker count or a per-worktree install. Closure needs a full run with zero runner errors under the original conditions. If a later run shows the error again, this record reopens.

**Multi-machine posture:** runner and host are machine-local. This record travels with the repository.

## train-159 recurrence, 2026-10-26

The supplied Studio gate excerpt for `66869f8ffc69a8c4c15ae52826e5901f9c68618a` records
93 failed files, 148 failed tests and 61 `onTaskUpdate` errors over 8,494.84 seconds. Failures
span independent synchronous owner matrices, bounded child launches, launcher polling and
wall-time performance assertions. The desk starts each concurrent gate with a four-worker
cap. The first reported case, the held/malformed/throwing reservation matrix, took 81,095 ms
against its 30,000 ms ceiling; unchanged under one worker it took 3,125 ms (the entire file
passed 10 tests in 9,182 ms). After building the package in the fresh checkout, the unchanged
fixed-peer file passed all 13 cases in 10,598 ms, including refusal and crash boundaries.
An earlier local attempt lacked `dist/` and failed with exit status 1; that setup failure is
distinct from the gate's null subprocess status and is not evidence of a product regression.

The source repair makes Vitest's existing serial file mode the default and bounds its pool
to one worker, even with the desk's `INSTAR_TEST_MAX_WORKERS=4` and `VITEST_SERIAL_GATE=0`.
This removes competition between files within each run without increasing deadlines,
quarantining cases, swallowing errors or altering product code. The existing cap parser,
fork isolation, priority reduction, IPC yield and child bounds remain. The worker-limit
test checks unset, valid and invalid caps with both legacy serial settings, and an actual
two-file runner probe uses an injected asynchronous delay instead of burning CPU.

**Qualification remains open.** These targeted results establish large timing sensitivity
and the scheduling contract, not a proof that every original failure had the same cause.
They do not recreate the original host pressure or establish a faster full suite. The
pipeline must rerun the complete gate; the original failures and all assertions remain.
This change does not bound other programs on the host or cure a single test that blocks
its own event loop beyond the RPC deadline. No new full-run result is asserted here.

## Narrow scheduling repair, 2026-10-26

The serial-all workaround also serialized the roughly thousand ordinary test files. The
M5 Pro qualification report (`lanes/m5pro-slot-1025-PROGRESS.md`, desk record) observed only
132 files completed in 65 minutes at d936c5c6. That workaround is replaced by the prior
bounded parallel pool: half the available CPUs, at most six, lowered by
`INSTAR_TEST_MAX_WORKERS`. `VITEST_SERIAL_GATE=1` remains an explicit serial comparator.

Only the fourteen files named by the trace/timing evidence above are scheduled separately:
`stage2-recovery`; the seven e2e `transport-loop-a1` files; e2e `register`; e2e harness
adapter rounds 9 and 12; conversation `telegram.round24.integration`; assembly
`provider-response-evidence` and `fixed-installation-peer`. The exact paths live in
`serialFixtureFiles` in `vitest.config.ts`. They run after the ordinary parallel group,
one file per ordered Vitest project. Each file retains a fresh isolated fork. This uses
Vitest's existing sequence groups instead of introducing a lock, blocked worker queue or
shared-process fixture state. Both platform splits retain every selected test exactly once.

This list bounds the recorded heavy fixtures; it does not establish that the 61 unattributed
train-159 RPC errors came from those files or that all timing-sensitive files share a lock.
The earlier asynchronous child repairs, worker IPC yields, child deadlines, RAM scratch
setup, priority reduction and host admission remain necessary. No assertion, case deadline,
skip or product behavior is changed. Host admission limits concurrent suites; it is separate
from this config's worker limit within one suite, as in 1.x's host semaphore/setup split.

The regression runs the actual shipped scheduling configuration with asynchronous rendezvous
fixtures: ordinary files must overlap, selected files must run successively, and all files
must use different process ids. Discovery checks compare the actual runner inventory against
all tracked test files in unsplit, macOS-only and non-macOS modes. Full-suite qualification
and repeated real-fixture runs are recorded in the builder's absolute lanes progress record;
this defect remains open until that evidence establishes zero runner errors.

## train-171 repair, 2026-11-05

The supplied M5 Pro gate excerpt at `b932b7f716a64998a782b4aff94d23107b59e55f`
records the intake-owner manifest matrix at 94,553 ms against its 60 s test bound,
a later intake-owner afterEach at 11,037 ms against its 10 s hook bound, and one
unattributed `onTaskUpdate` error. The original run remains red. Intake-owner
now joins the existing ordered fixture lane, retaining all 24 cases and their
bounds. Its manifest matrix caches exact bytes read by `git show` from one
immutable fixture commit through the existing loader port, avoiding repeated
subprocesses for the same artifacts. Hash checks and hostile manifests still run
on every load; neither working-tree bytes nor prior validation results are cached.
This addresses repeated work and within-suite contention, not unrelated host load.
The unattributed RPC error still needs the pipeline's full-run qualification.

The same gate ran three Studio-dependent preview files on both hosts despite
the remote command's CLI exclusions. Vitest 3.2.7's inline-project option
forwarding omits `cliExclude`; actual file discovery reproduced the leak with
`--exclude tests/preview/trust-setup.test.ts`. Each project now applies the root's
parsed exclusions through Vitest's public `configureVitest` hook before discovery.
The inventory regression exercises ordinary and serial files, both CLI spellings,
and the positive Studio selection, proving an exact disjoint union with the full
inventory. No test is quarantined and no assertion or product ability is removed.

## train-181 recurrence, 2026-11-05

The retained gate at b95fc4f6ad08e02d180ab476eb6e744a0ed1e53a reports one
unattributed `onTaskUpdate` timeout, 11 failing assertions and 9,304 passing tests.
No worker trace in the supplied bounded excerpt identifies its cause. This repair
adds an event-loop yield between the integration peer test's twelve synchronous
receiver restarts and forwards the selected transpile cache to those children.
That removes a known starvation opportunity, not proof of attribution for this run.
The defect remains OPEN with the existing desk owner and closure condition: trace
any recurrence and qualify the final candidate with a full run reporting zero
runner errors. No test is skipped, quarantined or relabelled; the retained run is RED.
Only the desk runs that full qualification; targeted passing tests do not close it.

## train-181 READY-gate register recurrence, 2026-11-05

The subsequent eight-file READY run at 995b147a reports two register CLI case
timeouts and one unattributed onTaskUpdate error (118 passed, two failed;
797.73s). The bridge case still used synchronous children for four builds and
two wiring checks; the earlier conversion had not covered it. All six remaining
CLI/wiring call sites in tests/e2e/register.test.ts now use its existing async
runNode/runChild path, including the malformed-source matrix. This closes that
concrete starvation path, without claiming attribution of the untraced RPC error.
The ten-build defaults case becomes three fresh groups of at most four builds;
the bridge case becomes four fresh groups of at most two calls. Their 120s
and 60s case bounds remain unchanged, and every prior assertion is retained.
A real CLI preload waits for its parent worker to release a file barrier: the
async path releases it and builds, while the unreleased neighbor refuses before
the CLI runs. This demonstrates event-loop progress without artificial CPU load.
The isolated original cases took 82.391s and 30.560s and passed; that rerun does
not erase the retained READY failure. The existing desk owner and full-run
closure condition remain in force; no case is quarantined.

The first train-181 affected-file run also retained a 300.015s timeout in the nineteen-build malformed-source matrix. Its holder/deadline, colocated-construct and shape/anchor groups now own fresh fixtures, at most nine builds each, and the same 300s case bound. Async register children explicitly receive the enclosing case timeout, preserving a finite child duration formerly supplied by the synchronous-child wrapper. Neither observation attributes the desk's untraced RPC error to a particular child.

That local run also timed out in the three-call ambient-wiring group at 60.442s. Clean and ambient wiring now each prepare their own committed output and run one wiring check (two CLI calls per group), keeping 60s and both assertions. The committed-clone comparison remains paired within one group.

## train-187 cumulative wiring budget, 2026-11-05

The imported 99db9a096 affected-file run retained one clean-wiring timeout at 60,008ms, with 14 tests passing in 770.58s and no reported RPC error. Both parent-release controls and current-time CLI replay passed. The existing owner 7b78ea242 already repairs the same two-scan fixture budget: its independent review measured valid wiring at 52,387ms and untracked wiring timing out at 60,013ms. Train-187 reuses that 120s cumulative case budget over the four isolated bridge groups, with each build/wiring child explicitly retaining its 60s SIGTERM bound. No assertion, scan, model ability or production latency contract changes. The old red remains and the defect stays OPEN for desk full-run qualification.
