# Full-suite load timeouts in rungraph and register tests (Rule 37 quarantine)

**Status:** CLOSED on cint-L4 (2026-09-29; see the last section); kept as the record. **Owner:** constitutional-build integration desk (Echo). **Opened:** 2026-09-28.

During the full repository run retained as `cbuild-4-rr1-full-5ecf9519.log` (load about 27, `--maxWorkers 4`, eight parallel builders on the same host), four cases timed out:
- `tests/rungraph/provider-answer-reply.test.ts` — the parameterized case at the `it.skip.each(['submitted', …])` line, and `P10-SI-37 reuses a still-current assessment after the clock advances and refuses withdrawn captures`. Each declares 30 000 ms but was reported as timed out at 10 s.
- `tests/register/owner-references.test.ts` — `resolves pinned fixtures/probes/documents and refuses hostile owner/hash/name inputs` and `resolves only the two paired Part Twelve Slack fixtures at their committed hashes` (10 s default).
- `tests/register/intake-owner.test.ts` — `accepts P4 and P5 independently and together without accepting another owner or an unpinned dependency` (30 000 ms declared): 158 s in the cint-1 desk run under load; in isolation 25 s on cint-1 and a FAILURE at 42 s on the live base int13 (a6f026e5), so it predates this work (added 2026-09-28).
- `tests/preview/stage2-recovery.test.ts` — `actual async launcher SIGINT with a spawned synthetic CLI` (added 2026-09-28, cint-2). In the cint-2 gate run 3 (`.instar/lanes/cint-2-gate-run3.log`, load about 12.7, `--maxWorkers 2`), the launcher had not reached its synthetic model call when the 90 s child timeout fired. It passed in gate run 2 on the same stage-2 code 40 minutes earlier, and its SIGTERM sibling took 30 s in the same run. Neither merged build touches the stage-2 launcher or this test's subject. The run also exposed a harness defect: cint-1's async `spawnNode` reported the timed-out child's graceful SIGTERM exit as status 0, so the failure first surfaced as a missing model log. The helper now reports a timeout as status `null` with a `[timed out after N ms]` marker; its passing cases are unchanged.
- `tests/preview/journal-conversations.test.ts` — `recalls a topic fact beyond the envelope into the main chat after summaries, with flat overhead across restarts`: in the cint-3 preview gate (`--maxWorkers 2`, load 10–16, other builders on the host) its final-ten non-model p95 was 1 760 ms against 168 ms for the first ten, so the flat-overhead bound (growth ≤ 1 000 ms) failed. Isolated on the same tree (cint-3 `fabcea03`) three runs were flat (first-ten 132–149 ms, final-ten 156–157 ms), as on cint-1 `2988aa95` (139–200 ms / 145–168 ms). The file is unchanged by builds 5, 9 and 11 and cint-3. A p95 over ten samples is the maximum, so one stall decides it.
None of these files is changed by constitutional build 4 or cint-1. Host load is a hypothesis, not an exoneration. The reported 10 s against a declared 30 s is itself unexplained. An isolated passing rerun does not clear them.

**Disposition:** each exact case is visibly quarantined with `it.skip` / `it.skip.each` and a comment linking here. Bodies, assertions and declared timeouts are retained. The other cases in both files stay active. While quarantined, the gate does not prove provider-answer reply delivery-state handling for the five parameterized states, the P10-SI-37 assessment reuse and withdrawal refusal, register owner-reference resolution and hostile-input refusal for pinned fixtures and the paired Slack fixtures, the stage-2 launcher's SIGINT hold through a real spawned CLI (its SIGTERM sibling and the accepted-answer case stay active), or (journal-conversations) recall of a topic fact beyond the envelope into the main chat after summaries across restarts and the flat per-turn overhead over 90 turns. The other journal-conversations cases (cross-conversation recall, restart carry-over, admission, shared caps) stay active, and `journal.test.ts` keeps its own 60-turn flat-cost assertion active. A green gate is reported as green with this quarantine named.

**Repair and closure:** the owner diagnoses why the declared 30 s timeout is reported as 10 s, and whether the cases are CPU- or disk-bound under parallel load. The owner repairs the cause, removes the skips, and shows the retained assertions passing under the original full-suite conditions with headroom. If a repair regresses, the quarantine is restored and this record reopened.

**Repaired, not quarantined: `tests/preview/journal-assembled.test.ts` (cint-23).** In the cint-23 preview gate (`.instar/lanes/cint-23-gate1.log`, `--maxWorkers 4`, load about 14) the flat-cost assertion failed with growth 1 467 ms (first-ten 224.9 ms, final-ten 1 692.1 ms). Its "p95" of ten samples is their maximum, so one stall decided it. Isolated on cint-23 three runs measured growth 248–258 ms, and cint-2 `3d699ff1` measured 244–259 ms the same way; that apparent growth was itself one consistently slow sample in the last ten turns (maximum about 380 ms), not a rising per-turn cost. The cause is the statistic, so it is repaired: growth now compares the medians of the first and last ten turns (isolated: 0.2–24.9 ms), and the final-ten maximum is printed beside it. Every other assertion (60 calls and replies, recall, the desk report in every prompt, the overall p95 bound) is unchanged, and no case is skipped.

**Re-check on cint-L3b post-check repair (2026-09-29):** the parameterized `P9-NF-66 reads historical assessment with %s capture loss while current use refuses` case is restored, because `scripts/check-verification-contracts.mjs` refuses P9-NF-66 unless every case carrying that id executed and passed. In isolation (`--maxWorkers 1`, load about 8) each of the five states took about 2 s against the file's 60 s `vi.setConfig` timeout and the case's declared 30 s (17 passed, 1 skipped in `tests/rungraph/provider-answer-reply.test.ts`). An isolated pass does not by itself clear the load finding; if the case times out in a full gate run, it is quarantined again and this record keeps it. `P10-SI-37 reuses a still-current assessment …` and the other cases listed above stay quarantined.

**Multi-machine posture:** the tests are machine-local. This record and the quarantine travel with the repository.

---

## Unit U6, 2026-09-28: the preview cases, repaired — plus the root cause under all of them

### The root cause, measured

Every preview case that spawns a child starts it with `--loader ./scripts/slice-ts-loader.mjs`. That loader is 19
lines and calls `ts.transpileModule` on each `.ts` file it resolves, **with no cache**, so every child re-transpiles
the whole TypeScript graph it imports from scratch. Measured on this runner at load about 43:

| what | cost |
|---|---|
| `node -e 0` | 0.11 s |
| loader hooks active, nothing TypeScript imported | 1.3–1.6 s |
| the journal-agent graph, one process at a time | 12.5–14.8 s |
| the same child inside the 5-worker preview suite | about 50 s (a provider child's first heartbeat arrived after 48 288 ms; a 60 s child budget still fired) |

So roughly **90% of a cold preview child is uncached transpilation**, and that — not any case's subject — is what
host load multiplies. This is why so many unrelated preview cases share one failure shape: a 10 s child timeout or
a 10 s default deadline is below the cost of *starting* the child, on any loaded host. The real repair is a
content-addressed transpile cache in that shared loader; U6 does not own `scripts/slice-ts-loader.mjs` and did not
change it. Until that lands, child budgets in these files are watchdogs sized to the measurement above, the
observed child cost is **printed on every run**, and no assertion about any subject was relaxed.

### `tests/preview/journal-conversations.test.ts` — REPAIRED, skip removed

The recorded diagnosis was right and the cause was the statistic. A "p95" of ten samples is their maximum, so one
scheduler stall decided the flat-overhead assertion (final-ten 1 760 ms against 168 ms under load; 132–157 ms
isolated). Growth now compares the **median** of the first and last ten turns — the same repair already applied to
`journal-assembled.test.ts` and recorded above — and the final-ten maximum is printed beside it. The 1 000 ms bound
is unchanged, and a per-turn cost that really grows with the journal moves the median as much as the maximum.

Measured un-skipped inside the 5-worker preview suite, twice, at host load 24 and 42:

```
non-model p95=720.1 ms, first-ten median=90.4 ms, final-ten median=307.1 ms, growth=216.7 ms, final-ten max=433.7 ms
non-model p95=620.3 ms, first-ten median=84.8 ms, final-ten median=308.9 ms, growth=224.1 ms, final-ten max=459.4 ms
```

Growth 216.7 ms and 224.1 ms against the retained 1 000 ms bound: stable across a near-doubling of host load, which
is the property the old statistic lacked. The case's own wall time was 25.1 s against a 30 s budget at load 24, so
that budget sized the host rather than the work and is now sized to the measurement.

### `tests/preview/stage2-recovery.test.ts` — SIGINT skip removed, watchdog measured

The SIGINT instance was quarantined because a 90 s child watchdog fired while the launcher had not yet reached its
synthetic model call, on a run where its SIGTERM sibling took 30 s. That watchdog is a hang detector for a full
stage-2 launcher boot — a cold `--loader` transpile of the whole tree, i.e. exactly the cost measured above — and
never a bound on what the case asserts (one model call, `phase: 'held'`, zero `sendMessage`, `stop.reason` of
`signal`). It is now sized to that measurement, and **the launcher's observed wall time is printed on every run**,
so a genuine hang is still caught, still reported as a timeout rather than as success (Rule 42), and any drift in
the boot cost becomes visible instead of hiding behind a constant.

### Not closed by U6

- The `rungraph` and `register` cases in this record are untouched: they are not preview files and not U6's.
- `tests/preview/memory-sentinel.test.ts`'s quarantined case is **re-diagnosed, not repaired**: it fails
  deterministically in isolation on a recall assertion, and the fix is in `tests/preview/journal.ts`, which U6 does
  not own. See `memory-sentinel-timing-flake.md`. (Since closed, 2026-09-29: the recall input was repaired in the cint-L4
  pipeline repair and the case restored.)
- The uncached-transpile root cause above remains open, in a file U6 does not own.

### Gate evidence (U6), and what it does NOT cover

Host: 10 CPUs, WSL2, `maxWorkers` 5, several sibling units running full suites concurrently. Host load 22–43
throughout, i.e. the "load ≥ 20" condition was exceeded roughly twofold.

**Seven of the eight files are green twice with every repaired case un-skipped.**

Run A (all eight files, 2.4 h):
```
✓ memory-sentinel (18 tests | 1 skipped) · ✓ journal-packet-priority (4) · ✓ real-model-recall-sample (4)
✓ self-state (14) · ✓ journal-assembled (1) · ✓ journal-conversations (11) · ✓ journal-channel-memory (4)
❯ stage2-recovery (42 tests | 22 failed)
```
Run B (those seven files): `Test Files 7 passed (7) · Tests 55 passed | 1 skipped (56)`, 147 s.

The one remaining skip in both runs is the memory-sentinel recall case, quarantined for its re-diagnosed cause.

**`stage2-recovery.test.ts` is NOT green at this load, and U6 did not make it green.** Its own un-skipped SIGINT
case — the defect in U6's row — passes twice: 113 273 ms in run A and 65 846 ms in a targeted launcher run, and its
launcher child ran 169 461 / 113 221 / 65 821 ms across runs, all inside the measured watchdog. A targeted run of
just the three launcher cases passes all three (`Tests 3 passed | 39 skipped`), including the accept case that fails
inside the full file — so that case's remaining sensitivity is the launcher's own `--max-cycles 3
--max-poll-seconds 1` budget in `tests/preview/agent.mjs` (U2's file) when 39 other child-spawning cases compete
with it, not the watchdog.

The file's 22 failures at load 24–43 break down as:

| count | failure | owner |
|---|---|---|
| 15 | `Hook timed out in 10000ms` — vitest's global `hookTimeout` default, fired from `tests/setup/yield-worker.mjs` | `vitest.config.ts` + `tests/setup/**` — **not U6's** |
| 16 | `Test timed out in 60000ms` / `120000ms` on cases outside U6's six defects | in U6's file: **budgets now sized to each case's own observed duration in run A** |
| 3 | crash children exceeding even a 300 s child timer | in U6's file: raised to 600 s |
| 1 | the accept case's sidecar, per the launcher's internal cycle budget | `tests/preview/agent.mjs` — **not U6's** |

The in-file budgets above were raised after run A, so they are **not yet proven** by a green full-file run; a
2.4-hour iteration per attempt on a host at load 40 put that beyond this unit. The 15 hook timeouts keep the file
red regardless until `hookTimeout` is raised, which is U7's file. **Do not read "U6 repaired the preview flakes" as
"stage2-recovery is green."**

Both gate runs also emitted `[vitest-worker]: Timeout calling "onTaskUpdate"` twice — the separate tracked defect
`vitest-worker-rpc-timeouts.md`, also U7's row.

## Batch cint-L4, 2026-09-29: the rungraph and register cases, skips removed

The root cause measured by U6 — an uncached `ts.transpileModule` on every child start — is repaired on main (#137, the content-addressed slice transpile cache, warmed once per test run). On cint-L4 the four remaining cases in this record are un-skipped with bodies, assertions and declared timeouts unchanged, and pass under `nice -n 10`, `--maxWorkers 1`:
- `tests/rungraph/provider-answer-reply.test.ts`: all 18 cases passed in 48.2 s, including the five parameterized capture-loss states (about 2 s each) and `P10-SI-37 reuses a still-current assessment…`; the mirrored `tests/e2e/fixed-installation-reply.test.ts` passed 19/19 in 58.4 s.
- `tests/register/owner-references.test.ts`: 7/7 in 1.4 s; the two cases took 833 ms and 547 ms against their 10 s default.

These isolated passes show headroom, not the original full-suite conditions; the Mama PC pipeline run is the full-suite evidence, and a recurrence reopens this record with the quarantine restored. The `intake-owner` and `journal-conversations` cases are already active, and `stage2-recovery` was closed by U6, so no case in this record remains quarantined. **Status:** CLOSED on cint-L4 (2026-09-29).

## Recurrence 2026-09-29 (cb7-r90 gate on the Mama PC): the register normal-workflow case

`tests/e2e/register.test.ts` › `… R1 normal extract and completion workflows invoke the provider and full graph ladder`
timed out at 125 s against its 120 s budget. It is a fixture execution budget over a full-tree copy, a git commit of
that tree and eleven register builds. The branch did not grow the work: isolated under `nice -n 10`,
`--maxWorkers 1` it took 37.1 s on cb7-r90 and 51.2 s on the main tree it builds on. Earlier full-suite gates took
41 s to 72 s. The budget is now 300 s, about 2.4 times the worst full-suite duration seen. Its body and assertions
are unchanged, and no case is skipped.

## Recurrence 2026-10-04 (cint-L50 gate at 67544546, Studio): six cases on the global default timeout

The gate run that started 00:01 UTC failed eight tests. Six belong to this record's class, and the cause is the
**global default** `testTimeout` rather than any declared budget:

| case | gate duration | isolated here (`nice -n 10`, `--maxWorkers 1`) | body |
|---|---|---|---|
| `tests/e2e/round10-conformance.test.ts` › `P11-NF-43 P11-NF-49 R10-F1 public production boot refuses a missing required method against durable storage` | 10 179 ms | 1 312 ms | sync |
| `tests/preview/journal-burst.test.ts` › `fsyncs a ten-update burst in update order across a mid-batch crash, merges the edit, and sends once per other turn` | 12 929 ms | 1 056 ms | async |
| `tests/e2e/part-eleven-round20.test.ts` › `round20 V16/V61/V62 lifecycle: live generation drift refuses without a durable disposition append` | 17 053 ms | 589 ms | sync |
| `tests/preview/packet-growth-replay.test.ts` › `grounds a short accepted summary in every original turn, then switches at the fixed history budget` | 17 167 ms | about 130 ms | sync |
| `tests/scheduled/review-round17.test.ts` › `P15 round-seventeen F2 compares first landing, then reports inapplicability while retaining baseline checks` | 25 207 ms | 273 ms | sync |
| `tests/preview/journal-recall-rank.test.ts` › `Rule 11 … reproduces the miss through the real packet path where no stem is shared (sample B)` | 38 040 ms | about 325 ms | sync |

None declares a timeout, so each ran on the 10 s default. Five of the six have **synchronous** bodies, which is why
the reported durations exceed the bound they broke: a 10 s timer cannot fire while a synchronous body holds the
event loop, so vitest records the real body time and then delivers the expired verdict. Measured directly on this
runner with a scratch case whose body blocks for 20 s: `Error: Test timed out in 10000ms.`, duration 20.00 s, code
frame on the `it(` line — the same shape the gate printed for `packet-growth-replay` (`:8:1`, its `it(` line).

The branch did not grow the work. The previous full gate on the same tree 30 minutes earlier (bf76a6e9, 23:08 UTC)
failed only the six `tests/e2e/register.test.ts` pin cases and passed all six cases above; everything 67544546 adds
over it is `generated/*`, one owner-reference pin and a review record, none of which these cases read.

**Repair (not a quarantine):** the global default is raised to 90 s in `vitest.config.ts` — 2.4x the worst duration
seen here (38.0 s), the margin convention this record already applies. No case is skipped, no assertion or declared
budget is changed, and a case needing a tighter bound still declares its own. A hung case still fails as a timeout
(Rule 42); it now takes longer to say so.

### Also in that run, and NOT of this class: the two-machine stale-owner exit code

`tests/preview/two-machine-runner.test.ts` › `an owner that stalls past its term and comes back is stale: it sends
nothing, retires, and is wanted back as the standby` failed at 8 225 ms on `expect(await studio.exited)
.toMatchObject({ status: 0 })` with `{ status: 1, signal: null }`. The case declares 240 s, so the timeout repair
above does not touch it.

Reproduced on the Mama PC twice in fourteen targeted runs (about 14 %), then not once in twelve further runs with
the child's stderr and `runs.jsonl` captured, so **its source is not yet named**. What the passing runs show is the
intended end: `reason: "conversation ownership lost"`, `retired: "conversation ownership lost"`,
`revival: "queued"`, exit 0. The exit-1 paths reachable in `tests/preview/journal-agent.mjs` were enumerated and
none is satisfied by this scenario on inspection: poll exhaustion needs 5 consecutive 409s or 20 failures
(`exhaustedPollReason`) and the fixture issues neither here; the run-log append failure needs an unwritable root;
`shared.sync()` cannot throw (`authority.request` returns `{ok:false,reason:'unreachable'}` rather than throwing,
`shipper.pump()` catches into `failed()`, `dispatch.flush/settle/outcome` only read typed answers, and
`lease.renew()` is called with `.catch(() => {})`). The unguarded teardown steps in `main`'s inner `finally`
(`gate.stop()`, `proxy.close()`, `journal.close()`, `storage.close()`, `ownerClaim.release()`) would produce exactly
this shape — a recorded clean end followed by exit 1 — but nothing observed shows one of them rejecting, so they are
left alone rather than guarded on a guess (Rule 116).

**Disposition:** recorded, **not quarantined**. The case covers the Rules 31/63 replicated(1) floor, and
`scripts/check-*-contract-map.mjs` refuses a skipped proof case, so a skip would cost real floor coverage and fail
the post-test checkers. It stays active; a recurrence in the pipeline rerun carries the stderr needed to name the
source.

### Recurrence 2026-10-05 (sb-w4-workmemory gate at d9e34cce, Studio): the same stale-owner exit code

The one failure in that gate run is the case above, with the same shape: `expect(await studio.exited)
.toMatchObject({ status: 0 })` received `{ status: 1, signal: null }`, at 8 130 ms against the case's declared
240 s (cint-L50 saw 8 225 ms). It is still **not quarantined**: the case carries the Rules 31/63 replicated(1)
floor and `scripts/check-*-contract-map.mjs` refuses a skipped proof case.

**Not reproduced here, in 33 targeted runs on the Mama PC** (WSL2, 10 CPUs, `nice -n 10`, `--maxWorkers 1`):
12 sequential targeted runs; 12 runs as three concurrent instances (four rounds of three, i.e. self-contention
rather than an arranged load run); 6 runs of a variant that sends `SIGCONT` immediately after the takeover
instead of after the new owner reads the second message (the gate's gap between those two points is about a
fifth of the one measured here, so that gap was the first suspect); and 3 runs of the whole file. Every run
exited 0.

**Timing, measured.** Instrumented here, the passing path is: studio owning at 1.0 s, standby at 4.0 s, cursor
past the first update at 4.3 s, `SIGSTOP` at 4.3 s, takeover at 9.1 s (the authority's 6 s term, minus the time
since the last renew), the new owner's second turn at 12.1 s, `SIGCONT` and exit at 12.1 s. The gate's 8.1 s is
that same shape on a faster host (about 1.5 s to the cursor, the 6 s term, then under a second), so the run is
**not** evidence that the studio child had already exited before the `SIGSTOP`; equally, nothing here excludes
it, because a child that exits cleanly releases its lease and the takeover is then immediate, which also lands
near 8 s. Both readings stay open.

**Narrowed by reading, on this scenario (`--tools off`, no delegated session):**
- `gate`, `stepEgress` and `sessionWork` are all null — `gate` is built only when a session setup exists or the
  doorway carries a Claude Code tool turn — so three of the five unguarded teardown steps cint-L50 named
  cannot run at all here. `ownerClaim.release()` is internally guarded (`conversation-owner.ts`, `try/catch`
  around `held.close()`). Of that list only `journal?.close()` and `storage.close()` remain reachable.
- The writer lease (`src/assembly/production-storage.ts`) is **PID-based with no TTL**, so a six-second
  `SIGSTOP` cannot expire it and a write after the resume cannot be refused for a lapsed lease.
- `await lane.settle()` and `if (lane.error() && !signalled) throw lane.error()` cannot fire here.
  `lane.error()` is set only after **eight** consecutive failures with growing backoff (`createOrdinaryLane`,
  `live-sentinels.ts`), which needs about two minutes, and the lane's job promise can only reject through
  `ports.after()` — `summarizeLater`, whose three tails (`summarizeIfNeeded`, `checkSteps`, `retrospect`) are
  all `async` in `journal.ts`, so a synchronous throw inside them becomes a rejection their own
  `.catch(() => {})` absorbs.
- Poll exhaustion still needs 5 consecutive 409s or 20 failures, and a woken stale owner breaks on
  `ownerHeld()` after at most one poll.

**Repaired here: the evidence, not the exit.** The cause is unnamed after two gates because the case discarded
the only evidence that would name it — the child's stderr (which distinguishes a thrown `main` with its
`preview refused to start or continue` line from an unhandled rejection's stack) and its `runs.jsonl` (which
says whether the clean end was recorded before the exit). Both were already captured by the harness and thrown
away with it. The case now writes them to the run output when the exit is non-zero, before the unchanged
assertion, so the next recurrence in any gate carries what it needs. No assertion, body or budget is changed,
and nothing is skipped. Guarding `journal.close()` / `storage.close()` on a guess is still declined (Rule 116).
