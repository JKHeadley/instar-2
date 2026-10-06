# Awareness continuity: respawned session sometimes answers before the regrounding lands (Rule 37 quarantine)

**Status:** CLOSED 2026-09-29 (wave 3 unit awarecont). The cause was a race in the test's observation, not in the
grounding; repaired in the test, the skip removed. See "Closure" at the end. **Owner:** constitutional-build
integration desk (Echo). **Opened:** 2026-09-28.

`tests/e2e/awareness-continuity.test.ts` — `a compacted or respawned session comes back with identity, recent conversation and open work, and carries on` — failed once in the full run `/private/tmp/claude-501/cint1-livefix/full2.log` (`--maxWorkers 2`, busy shared host) at `expectGrounded` (line 93): the pane shows `CARRYING ON: nothing known — would have to ask the user` followed by the injected grounding and `REGROUNDED`, where `CARRYING ON: Make sure a respawned session does not ask me to repeat myself.` was expected. It passed on an isolated rerun and in the targeted re-run `rr2-failfiles.log`. A passing rerun does not clear it.

**Cause (original hypothesis, disproved below):** an ordering race under load. The stand-in session printed its CARRYING ON line before the re-grounding block reached its input, so it answered from no context. The test does not wait for the injection to be read before the stand-in answers. Host load is a hypothesis, not an exoneration.

**Reproduce:** run the file repeatedly under parallel load (for example alongside a full `vitest run --maxWorkers 2`); it needs `tmux`.

**Disposition (while open):** the case was quarantined with `it.skip` (replacing `it.skipIf(!available)`) and a comment linking here; its body and assertions are retained. While quarantined, the gate does not prove that a compacted or respawned session is re-grounded with identity, recent conversation and open work before it carries on. A green gate is reported as green with this quarantine named.

**Repair and closure:** the owner makes the stand-in wait for the delivered grounding (or makes the test observe delivery before the answer), restores `it.skipIf(!available)`, and shows the case passing repeatedly under full-suite load.

**Re-check on the cint-L2 merge (2026-09-28):** with the skip removed the case passed once (`.instar/lanes/cint-L2-merge-quar2.log`, light load). A single passing run does not clear an intermittent failure (Rule 37), so the quarantine stays until the repair above is shown.

**Multi-machine posture:** machine-local test. This record and the quarantine travel with the repository.

## Closure (2026-09-29, wave 3 unit awarecont)

**Confirmed cause: the test looked for the answer before it had been written.** The failure was never
"answered before the grounding arrived". The failing pane is step 4 (the respawn whose SessionStart hook is off,
`BOOTED hook=off`). There `CARRYING ON: nothing known` is the *expected* first answer, and the sentinel's
re-grounding is the recovery. On the pasted `=== END INSTAR GROUNDING ===` line the stand-in
(`tests/e2e/awareness-fake-harness.mjs`) saves the delivered context, prints `REGROUNDED`, writes two inbox
receipts, and only then prints its new answer. The test did `waitFor(third, 'REGROUNDED')` and then asserted on the
pane at once. It observed the marker, not the answer. A 400 ms sleep inside `regrounds()` hid the gap only because
the delivery usually landed on the first of its two ticks. If the stand-in was descheduled between `REGROUNDED` and
the answer, the pane ended at `REGROUNDED`: exactly the recorded failure. The same shape affected steps 1–3,
masked differently. In step 2 the pane check was vacuous, because the step-1 answer was still in scrollback.

Evidence, kept under the desk's `lanes/w3-awarecont-evidence/`:
- **Natural reproduction.** The un-skipped, unrepaired case ran 40 times while
  `npx vitest run tests/preview --maxWorkers 2` looped beside it (16 cores, 1-minute load average 4.9–36.8). It
  failed once (run 8, load 12.6) at `expectGrounded` → `expect(pane).toContain('CARRYING ON: Make sure …')`, and the
  pane ended at `=== END INSTAR GROUNDING ===` / `REGROUNDED` (`run-orig-8.log`, `summary-orig.txt`).
- **Mechanism.** A temporary 600 ms pause in the stand-in between `REGROUNDED` and its answer (reverted) made the
  unrepaired test fail every time with the same diff at the same line (`mech600.log`). With the repair, the same
  pause passes (`fixed-delay600.log`).
- **Not the hook.** Step 4 runs with the hook off. The delivered text is in the context file before `REGROUNDED`
  is printed, and it is the correct grounding (`pane-at-regrounded.txt`). `scripts/session-hooks/grounding.mjs` is
  unchanged.

**Repair (test only).** `expectGrounded(session, marker)` now waits, bounded at 100 × 50 ms, for the complete
`CARRYING ON: …` line that follows the *last* occurrence of that step's marker (`BOOTED hook=on`, `COMPACTED`,
`REGROUNDED`). It asserts that this answer *is* the unanswered user message, alongside the delivered context
(identity, recent conversation, UNANSWERED, open commitment, other running work). An answer from before the marker,
or left in scrollback by an earlier step, no longer counts. This also makes the compaction step's answer check
real. There is no sleep-and-hope, and no timeout was raised. `it.skipIf(!available)` is restored.

**Both sides (Rule 34).**
- **Passing side:** the repaired case passed 20 of 20 consecutive runs while `npx vitest run tests/preview
  --maxWorkers 2` looped beside it (load average 23.6–36.3, `summary-fixed.txt`).
- **Failing side:** the case still fails when grounding is genuinely missing or late. Each temporary mutation below
  was reverted.
  - Hook on but no grounding file: fails at `expectGrounded`, context `''` (`neg-a2-…`).
  - Stand-in answers *before* applying the delivered grounding: fails at `expectGrounded`, answer `nothing known`
    (`neg-b-…`).
  - Re-ground delivery dropped: `expectGrounded` times out waiting for the answer after `REGROUNDED` (`neg-c-…`).
  - Fresh session launched without the hook: fails in `expectGrounded` (`neg-a-…`).

## Second failure mode, repaired 2026-10-05 (pipeline repair of sb-w4-a7c, plan row #542)

**What the gate saw.** The full run on `sb-w4-a7c` head `29062b71` failed this one case at the
COMPACTION step: `Error: timed out waiting for the answer after COMPACTED:` — and nothing after
the colon. The timeout message interpolates the last pane it captured, so the pane was the empty
string. That is not a blank pane: `tmux capture-pane` answers a session it cannot find with exit
status **1 and empty stdout** (verified: `can't find session`/`no server running`), while a live
but blank pane answers status 0 with newlines. So the stand-in's tmux session had **gone**, and
the case reported it as an unreadable blank. This is a different cause from the 2026-09-29
closure above (which was the case reading the pane before the answer was written); that repair
stands and is untouched.

**Cause.** `tests/e2e/awareness-fake-harness.mjs` mirrored its context and its receipts to disk
with bare `writeFileSync`/`renameSync` inside the `for await` input loop. Any write that failed —
the host out of descriptors under an 819-file run, the shared scratch volume momentarily gone,
a full RAM volume (the ENOSPC class already recorded in `full-suite-load-timeouts.md` and seen on
the cint-L50 gate) — threw out of that loop, ended the process, and took the tmux session with
it. Nothing printed, nothing logged: the session simply disappeared. Same for a `spawnSync` of
the SessionStart hook that never started (EAGAIN/EMFILE), which silently became "no grounding".

**Repair (test and stand-in only; no product file touched).**
- The stand-in's two mirror writes go through `mirror()`, a finite retry (20 attempts, 25 ms
  apart, directory re-created first). Both files are mirrors of what the stand-in already holds
  in memory, so a retry invents nothing and the bytes written are unchanged.
- A `spawnSync` that *never started* the hook is retried inside the same bound; it wrote no
  receipt, so a retry duplicates nothing. A hook that did run is taken exactly as it answered.
- Every way the input loop can end (exhausted, or throwing) now prints `HARNESS INPUT ENDED` or
  `HARNESS FAILED: <code> <message>` **into the pane** and holds the session open on a bounded
  timer (`HARNESS_HOLD_MS`, default 120 s) instead of exiting. The stand-in can no longer vanish
  without saying why.
- `answerAfter` in the case separates a *failed* capture from an empty pane: it keeps the last
  real pane, and after three consecutive failed captures it confirms with `has-session` and fails
  at once naming the gone stand-in, the capture status and tmux's own stderr.

**Both sides (Rule 34).** Proven with an injected write fault at the compaction step (a scratch
driver, not committed; a `chmod 444` on the context file, cleared from another process):

| injected fault | stand-in before the repair | stand-in after the repair |
|---|---|---|
| none | passes | passes |
| cleared inside the retry window | **session gone, capture exit 1, empty stdout, no answer** — the gate's exact signature | **recovers, answers correctly** |
| permanent | session gone, empty capture | session alive, pane reads `HARNESS FAILED: EACCES …` |

And for the case's own guard: killing the stand-in's tmux server as soon as its session exists
now fails in 216 ms with `the stand-in instar20-… is gone before the answer after BOOTED hook=on
(capture: 1; stderr: no server running on …)` instead of spinning for five seconds and printing
a blank.

**Not reproducible under WSL.** The external trigger is host-side (macOS `/Volumes` scratch
mounts, descriptor exhaustion, or a full RAM volume on the Studio under an 819-file run) and
cannot be raised on the Mama PC. What is proven here is the fault *class* and that the stand-in
survives it or names it; the repair removes the silent death, which is what made the gate failure
unreadable. No quarantine was added and none is needed — the case stays armed.
