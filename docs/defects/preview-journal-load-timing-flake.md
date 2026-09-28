# Preview journal load-timing flakes (Rule 37 quarantine)

**Status:** OPEN. Three preview cases are visibly skipped. Their bodies, assertions and timeouts are unchanged and remain for repair.

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
