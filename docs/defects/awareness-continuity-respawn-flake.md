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

## Second repair (2026-10-06, sb-w4-d1c pipeline repair): a failed tmux call was read as an empty pane

**Status:** CLOSED 2026-10-06. Same case, a different observation defect; no quarantine was taken.

The full run of sb-w4-d1c at `bc8097b1` (studio gate, 827 files, six fork workers) failed this case once:
`Error: timed out waiting for the answer after REGROUNDED:` with **nothing after the colon** — the pane text the
message interpolates was empty. Steps 1-3 and the step-4 `BOOTED hook=off` answer had all been read from that same
pane, and `expect(regrounds()).toHaveLength(1)` had already passed, so the re-grounding was delivered.

**Cause: the wait could not tell "no answer yet" from "nobody answered".** `pane()` returned
`spawnSync(tmux, ['capture-pane', …]).stdout`, which is empty both when the pane says nothing *and* when the call
fails — spawnSync itself erroring (EAGAIN: a loaded host cannot fork) or tmux exiting non-zero (its server gone,
the session killed under it). `answerAfter` then counted that empty string as a poll. Because a failed call returns
at once, the 100-poll bound was spent in milliseconds instead of the intended ~5 s, and the case reported a
timeout with an empty pane and no cause named at all.

**Repair (test only).** `capture()` returns either the pane text or a named failure (status, spawn error, stderr).
`answerAfter` is bounded by a **wall-clock deadline** (15 s) rather than a poll count, retries a failed capture
until that deadline, and names in the failure how many captures failed and the last reason. A transient
fork failure now recovers inside the window; a genuinely gone session reads as a genuinely gone session. The case
budget moves from 30 s to the configured full-suite bound (five waits of up to 15 s), and the unused `pane()`
helper is gone. No assertion was weakened: the answer must still be the unanswered user message, alongside the
delivered context.

**Both sides (Rule 34), each mutation reverted; load-independent (observer #93: injected slow path, not host load).**
- **Passing side:** 3 of 3 consecutive runs on an idle host, 3.16-3.32 s (unchanged from before the repair).
- **A — the session is gone before the wait** (`kill-session` injected before step 4's `expectGrounded`): fails
  with `262 capture(s) of instar20-… failed, last: status=1 error=none stderr=no server running on
  /tmp/tmux-1000/instar20-aw-83d314ff` — the gate's empty-pane symptom, now diagnosed.
- **B — the re-ground delivery dropped** (`paste-buffer` skipped for the respawn operation): fails with
  `0 capture(s) … failed` and the real pane (`BOOTED hook=off` / `CARRYING ON: nothing known`). The two causes are
  distinguishable from the message alone.
- **C — starvation between `REGROUNDED` and the answer** (6 s pause injected in the stand-in): passes with the
  repaired wait; the pre-repair poll-count wait fails on the same mutation with the same timeout shape. That is the
  load dependence the deadline removes.
