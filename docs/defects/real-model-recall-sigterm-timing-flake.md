# Real-model recall SIGTERM-reap timing flake (Rule 37 quarantine)

**Status:** OPEN. **Owner:** real-model recall sample owner (tests/preview/real-model-recall-sample.ts). **Opened:** 2026-09-28.

The case `reaps a physical provider child on SIGTERM and starts no next question` in `tests/preview/real-model-recall-sample.test.ts` failed during the constitutional build 3 repair-2 full affected-suite run (145 files, `--maxWorkers 4`, host load about 21). It failed at the precondition `expect(existsSync(heartbeat), stderr).toBe(true)` (line 102 at the time): the spawned sample's physical provider child had not written its first heartbeat within the test's 15-second wait, so the SIGTERM arm of the test never ran. The same run reported two unhandled vitest-worker errors, `Timeout calling "onTaskUpdate"`, so that run is not clean evidence for any file. The build 3 change touched no file on this path. An isolated rerun of the file passed 4/4, including this case in 12.4 s.

That pass does not explain or repair the earlier failure. The likely cause, a cold `--loader ./scripts/slice-ts-loader.mjs` child start plus the provider child start under heavy parallel load exceeding the fixed 15-second heartbeat wait, is a hypothesis, not an exoneration.

**Retained evidence:** the failing summary was `Test Files 1 failed | 142 passed | 2 skipped (145)`, `Tests 1 failed | 1235 passed | 12 skipped (1248)`, `Errors 2 errors`, started 01:40:49 and lasting 1590 s. The isolated pass was `Tests 4 passed (4)`, started 02:07:37. Both logs are kept at the desk path `.instar/lanes/cbuild-3-evidence/cb3r2-full.log` and `cb3r2-rm.log`.

**Disposition:** The exact case is visibly quarantined with `it.skip` and this link. Its full body, the heartbeat precondition, the SIGTERM exit-code, reaped-child and no-next-question assertions, and their timeouts are retained unchanged. The other three cases in the file remain active. The skipped case leaves the SIGTERM reaping of a physical provider child unproven by the current gate. Report a green gate as green with this Rule 37 quarantine.

**Repair and closure:** The owner must diagnose the start-time failure, repair the cause (for example by separating child start-up from the reaping assertion so the wait measures the right thing), remove the skip, and show the retained assertions pass with headroom under the original parallel full-suite conditions. An isolated passing rerun alone cannot close this defect. If a repair regresses, restore the quarantine and reopen this record.

**Multi-machine posture:** The test fixture is machine-local. This tracked defect and quarantine travel with the repository.

## Repaired 2026-09-28 (unit U6): skip removed, start-up separated from the reaping

The record's own suggested repair — "separating child start-up from the reaping assertion so the wait measures the
right thing" — is what was done. The failing line was never an assertion about SIGTERM reaping; it was a fixed
15-second wait for the spawned sample's provider child to write its first heartbeat, i.e. a setup deadline sized by
guess. Measured inside the 5-worker preview suite at load 42, that heartbeat arrived after **48 288 ms** (12.4 s
when the file runs alone), so the 15 s constant could not be met and host load decided the case.

The wait now ends as soon as the provider child is alive, stops early if the child dies, carries a budget with about
5x headroom over the measured cost, and **prints the observed start-up time on every run** so the cost stays
visible instead of hiding behind a constant. A failure message now names how long it waited.

Every assertion about the subject is unchanged and still tight: the 5-second race for the sample's exit, the exit
code, the frozen-heartbeat check after 150 ms of quiescence, and the single-invocation check. A slow start now
*delays* this case instead of failing it.

The file's first case, `skips the command without both the live flag and preview login profile`, spawns four cold
`--loader` children and was failing the 10 s default deadline; its budget is now sized to the measured child cost.
Its refusal assertions are unchanged.

**Why the underlying cost is not repaired here:** about 90% of a cold preview child is uncached TypeScript
transpilation by `scripts/slice-ts-loader.mjs`, shared infrastructure unit U6 does not own. See
`full-suite-load-timeouts.md` for the measurements and the real fix.

**Status:** the quarantine is CLOSED — no case in this file is skipped.
