# Intake restart harness child stall

Status: OPEN — cause unknown; tolerated by one whole-scenario rerun, 2026-11-08.
Owner: Echo / test-harness repair desk.
Recheck: the next gate run that prints `child-stall-retry:` on stderr, and no later than 2026-11-22.

Two observations, both on the Studio gate, both in `tests/e2e/intake.test.ts`:

1. 2026-10-05, sb-w4-d1b full run: one `scripts/test-intake-restart.mjs` child sat at 0% CPU
   for 54 minutes and the suite waited on it. That produced the per-child 20 s bound
   (`harnessBound`) and the suite-wide doorway `tests/setup/bound-children.mjs`.
2. 2026-11-08, train-221 head `0e1efa921d959d93974dac5b9912ce5edbe26dd9`: the process-death case
   failed at 20,157 ms with `spawnSync /usr/local/bin/node ETIMEDOUT`. The call was the first
   `run(raw)` after the cut child had exited 86 (test line 34, called from line 37). The two
   sibling cases, five children between them, finished in 477 ms and 299 ms in that same run, so
   a healthy child takes about 100 ms there. One child running past 20 s is a stall, not slowness.

What is known: the child's only blocking calls are reading stdin (92 KB of JSON) and three
`fsyncSync` calls, one of them on a directory. None of these is unique to this script.
Thirteen other scripts read stdin the same way, and more than a dozen fsync a directory,
including `scripts/production-boot-io.mjs`. Each child also takes 1.5 to 4.6 s on the Mama PC
(WSL), which comes from its module load, not a stall. The stall did not reproduce there.

Tolerance, not a fix: each of the five cuts already runs in its own fresh directory, so
`tests/e2e/child-stall-retry.ts` reruns a cut once, from nothing, but only when a child was
killed by its bound (`code: 'ETIMEDOUT'`). It writes a `child-stall-retry:` line to stderr. A
second stall, any assertion failure and any other error all fail the case as before, so a
deterministic hang or regression is still caught. No assertion is skipped, and the durable-intake
floor's proof runs in full. The case budget rose from 30 s to 120 s to fit one stall plus a rerun.
The bound itself is unchanged at 20 s.

Close when: the stall's cause is found and removed, or a full month of gate runs shows no
`child-stall-retry:` line. Then delete the retry. Undo: unwrap the loop and restore the 30 s budget.
