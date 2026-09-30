# Preview journal load-timing flakes (Rule 37 quarantine)

**Status:** PARTLY CLOSED (2026-09-29, wave-3 unit jload). `journal-dated-memory` and `journal-audit` are repaired and un-skipped. `journal-assembled` stays visibly skipped: its cause is now diagnosed and lies in the shared transport launch shim, outside the test (see the last section). The original record below is kept unchanged.

| File | Case | Red result |
| --- | --- | --- |
| `tests/preview/journal-dated-memory.test.ts` | stores the Telegram turn-time date in the default operator zone and sends its absolute date once | Test timed out in 10000 ms |
| `tests/preview/journal-audit.test.ts` | exits nonzero for a recorded packet without a verifiable provenance chain | `audit` child exit status `null` (killed at its 10 s `spawnSync` limit), expected 1 |
| `tests/preview/journal-assembled.test.ts` | measures 60 assembled journal turns with real adapters, polling, prompt construction and timed restarts | `getUpdates` result kind `uncertain`, expected `response` |

**Evidence:** On branch `cbuild-6`, round 5 gate run 3 (`nice -n 10`, `--maxWorkers 2`, load average about 13–17) failed all three (`/tmp/cb6r5-gate-run3.log`). An unchanged isolated run of the same files passed all three (`/tmp/cb6r5-four.log`), and gate run 4 passed them (`/tmp/cb6r5-gate.log`). A passing rerun does not clear the red result. Each case waits on a real child process or a real polling round trip under a fixed wall-clock limit, so host scheduling contention can exceed the limit. No cause has been diagnosed. None of the three touches the resource owner changed in that round.

**Coverage while open:**
- `journal-dated-memory`: the gate does not prove, end to end, that a Telegram turn-time relative date is stored in the default operator zone, sent once, and kept after restart. It also does not prove that `status` reports the default and `--time-zone` zones. The other 23 cases in the file still cover zone parsing, relative-date resolution, journaling, replay and imminent-date behavior. `self-state` and `self-state-launcher` still exercise the status time zone.
- `journal-audit`: the gate does not prove that the `audit` CLI exits 1 without leaking the body when a recorded prompt is unreadable or the journal tail is torn. The other 10 cases in the file still cover the audit findings in process, including refusal of lost provenance.
- `journal-assembled`: this is the only case in the file. The gate does not prove the 60-turn assembled run with real adapters, polling, prompt construction and timed restarts, or its timing samples. Component coverage for each part stays active in the other preview files.

Report green results as green with this Rule 37 quarantine.

**Repair and closure:** Diagnose each case's wall-clock dependency under the normal parallel gate. Repair the measurement, the wait, or the underlying cost, then remove `it.skip` and show each case passing under the diagnosed condition. Raising a timeout without a diagnosed cause is not a repair, and an unchanged isolated pass is insufficient.

**Repair owner:** Echo, as the owner of the preview journal harness. The defect is carried in the repository until closed.

**Multi-machine posture:** The fixtures are machine-local; this record and the visible quarantine travel with the repository.

## Diagnosis and repair, 2026-09-29 (wave-3 unit jload)

The three cases did not share one cause. The two child-spawning cases waited on loader start-up. The assembled case
had no wait problem at all: its transport child exited non-zero within about 36 ms.

### `journal-dated-memory` and `journal-audit`: CLOSED, skips removed

**Cause.** Each case launches `tests/preview/journal-agent.mjs` twice in sequence with `spawnSync` and
`--loader ./scripts/slice-ts-loader.mjs`. Almost all of a child's cost is loader start-up, and it grows with CPU
contention. The dated-memory case had the 10 s default deadline for two children. The audit case gave each child a
10 s `spawnSync` limit, also under the 10 s default. `spawnSync` also blocks the worker's event loop, so the case
deadline could not fire until the child returned. That is why the audit case below reports "timed out in 10000ms"
after 15.7 s.

**Evidence** (this host, 16 cores; the gate's niced worker competing with normal-priority work):

| condition | one journal-agent child |
| --- | --- |
| transpile cache warm, isolated | 0.36–0.40 s |
| cache warm, parallel preview suite, load 20–93 | 0.44–0.97 s |
| cache off (the quarantine's condition: it predates the cache, 02753cdc), load 24 | 2.4–2.9 s |
| cache off, normal-priority CPU burners, load 69–91 | 6.8–7.3 s |

With the cache off and burners running, the unchanged cases (un-skipped only) failed both reproductions: dated-memory
`Test timed out in 10000ms` (15.1 s wall) and audit `Test timed out in 10000ms` (15.8 s wall). Two 7 s children cannot
fit a 10 s case. U6 recorded up to about 50 s for a cold child inside a loaded 5-worker suite
(`full-suite-load-timeouts.md`).

**Repair.** Both files now launch the CLI through one small async helper (`runAgent`), following the U6 pattern.
The worker stays responsive while a child runs. The observed time of every child is printed on every run. The child
watchdog (120 s) is a hang detector sized above the worst recorded cold start, never a bound on what a case asserts.
A watchdog kill is reported as status `null` with a `[timed out after N ms]` marker, never as success. Each case
budget is its child count times the watchdog plus 30 s, so a hung child is reported by the watchdog rather than by
the case deadline. The other four CLI launches in these two files use the same helper and budgets, because they had
the same exposure. No assertion changed. That includes the send-once and restart assertions (`sends` stays 1, then
2, across a restart), exit status 1, and the no-body-leak checks.

**Both sides shown.** The repaired cases pass under the condition that failed the unchanged cases (cache off,
burners, load 69–91: audit 14.0 s, dated-memory 14.6 s). They also pass twice beside a parallel
`npx vitest run tests/preview --maxWorkers 2` under `nice -n 10` (load 88–97: cache on 3.0–3.3 s per file; cache
off 8.0–10.1 s per file), and in isolation. Deliberately broken inputs still fail. A readable, provenance-valid
journal makes the audit exit 0, and the case fails with `expected +0 to be 1`. A status run in another zone fails
the `time zone UTC` check. A child that outlives a 50 ms watchdog is reported as `null`, never as success.

### `journal-assembled`: OPEN, still skipped; the cause is in the transport launch shim

**Cause.** The failure is not a timeout. `createProductionTelegramIO` (`scripts/production-boot-io.mjs`) launches each
Bot API call through the resource shim (`LIMIT_SCRIPT` in `scripts/resource-owner.mjs`, emitted as
`scripts/limit-exec.sh`). It passes a per-user process limit of "the user's current process count + 4". The shim's
`lim` function lowers the soft `-u` limit and then runs `h=$(ulimit -H -u)`. That command substitution forks under
the limit it has just lowered. When other processes start between the `ps` count and that fork, as they do in any
parallel gate, the fork fails with `fork: Resource temporarily unavailable` (exit 128). `settle` then returns
`{kind:'uncertain', stage:'child-exit'}`.

**Evidence.**
- Under a short-lived-process storm, the un-skipped case failed three runs out of three in about 36 ms, at turns 7, 2
  and 0, with `{"kind":"uncertain","limitation":"transport","stage":"child-exit"}`. The original red failed at 6.5 s
  total, so it was not a wait either.
- Direct probe of the shim with the same `count + 4` limit: 6 of 40 launches failed with the fork error during an
  ordinary parallel preview run, and 9 of 40 under the storm.
- The same probe with `lim` reading both the soft and the hard value before lowering either (so nothing forks after
  the limit drops) succeeded in 80 of 80 launches under the storm.

**Why this unit did not repair it.** The defect is in shared product code that this unit does not own:
`scripts/resource-owner.mjs` (`LIMIT_SCRIPT`, `lim`) and its generated `scripts/limit-exec.sh`, with the headroom in
`scripts/production-boot-io.mjs`. It is a live-path defect as well as a test one. The same shim carries production
`getUpdates` and `sendMessage`, so a busy host can turn a send into a false `uncertain` before any request leaves.
Raising the case's timeout would change nothing, because nothing times out. **Repair owner:** the resource-owner or
transport owner. Suggested repair: `lim` reads `s` and `h` before setting either limit, so no fork follows a
lowered `-u`. Then un-skip this case and show it passing twice beside the parallel preview suite. Coverage while it
stays open is as stated above.
