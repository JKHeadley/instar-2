# Awareness continuity: respawned session sometimes answers before the regrounding lands (Rule 37 quarantine)

**Status:** OPEN. **Owner:** constitutional-build integration desk (Echo). **Opened:** 2026-09-28.

`tests/e2e/awareness-continuity.test.ts` — `a compacted or respawned session comes back with identity, recent conversation and open work, and carries on` — failed once in the full run `/private/tmp/claude-501/cint1-livefix/full2.log` (`--maxWorkers 2`, busy shared host) at `expectGrounded` (line 93): the pane shows `CARRYING ON: nothing known — would have to ask the user` followed by the injected grounding and `REGROUNDED`, where `CARRYING ON: Make sure a respawned session does not ask me to repeat myself.` was expected. It passed on an isolated rerun and in the targeted re-run `rr2-failfiles.log`. A passing rerun does not clear it.

**Cause (hypothesis, unconfirmed):** an ordering race under load. The stand-in session printed its CARRYING ON line before the re-grounding block reached its input, so it answered from no context. The test does not wait for the injection to be read before the stand-in answers. Host load is a hypothesis, not an exoneration.

**Reproduce:** run the file repeatedly under parallel load (for example alongside a full `vitest run --maxWorkers 2`); it needs `tmux`.

**Disposition:** the case is quarantined with `it.skip` (replacing `it.skipIf(!available)`) and a comment linking here; its body and assertions are retained. While quarantined, the gate does not prove that a compacted or respawned session is re-grounded with identity, recent conversation and open work before it carries on. A green gate is reported as green with this quarantine named.

**Repair and closure:** the owner makes the stand-in wait for the delivered grounding (or makes the test observe delivery before the answer), restores `it.skipIf(!available)`, and shows the case passing repeatedly under full-suite load.

**Re-check on the cint-L2 merge (2026-09-28):** with the skip removed the case passed once (`.instar/lanes/cint-L2-merge-quar2.log`, light load). A single passing run does not clear an intermittent failure (Rule 37), so the quarantine stays until the repair above is shown.

**Multi-machine posture:** machine-local test. This record and the quarantine travel with the repository.
