# Change review — train-197 repair: launcher and volume-cleanup test budgets

Subject base: 59ed6fc245698b715ae748a4c2514aeb9d4cc92d
Review state: open
Reviewed content: none
Outcome: the two cases that failed the Studio full run of 59ed6fc24 stop failing on budgets smaller than their real work. channel-source-launcher gets child budgets sized for a loaded run and reports a spent budget as one instead of as a launcher refusal; session-volume's cleanup hook declares the bound of the detaches it performs.
Affected rules: 2, 37, 42, 70, 74, 101, 102, 107, 111, 113, 116
Affected floors: secrets — unchanged, no credential path touched; spend cap — unchanged, the case runs the offline fixture with tools off; stop — unchanged, the launcher's signal pause is observed, not altered; no duplicate sends — unchanged, no send path touched; durable intake — unchanged, the import assertions keep their exact values
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: test files only; no product, launcher or configuration byte changes and no assertion is relaxed.
Side effects: on a real wedge either case now takes longer to fail (the launcher case up to 500 s instead of 45 s, the volume cleanup up to 240 s instead of being reported at 10 s). Global timeouts and every other test keep their budgets.
Undo and recovery: revert this commit; nothing persistent changes.
Multi-machine posture: machine-local test budgets; both files travel with the repository and behave the same on any host, while session-volume's cases stay macOS-only.
Layer below: read spawnSync's timeout behavior through a real interrupted launcher (status 1, cut stderr, ETIMEDOUT in result.error, run log reason "paused by signal SIGTERM"); detachSessionVolume's own 60 s bound in tests/preview/tool-turn.mjs; vitest's default 10 s hookTimeout, unset in vitest.config.ts; docs/defects/full-suite-load-timeouts.md for the recorded loaded-child size and margin convention.
Bug class: unit
Bug evidence: reproducer=tests/preview/channel-source-launcher.test.ts
Hook bypass: none
Convergence: none
Decision: per-case-budgets | raise each case's own budget rather than a global hookTimeout or testTimeout, because only these two failed and a global change would widen every other case's failure time | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-197-repair-230451-PROGRESS.md
Decision: report-spent-budget | assert result.error before status, because this repair first read as a launcher refusal and the signal-cut exit gives no other sign of a spent budget | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-197-repair-230451-PROGRESS.md
Decision: leave-linux-process-cap | leave transportProcessLimit unchanged: it stops this launcher reaching identity on this WSL host, which is a host-dependent limit outside this repair, so it is named in the report instead | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-197-repair-230451-PROGRESS.md

Verification: on the Mama PC with the transport process cap lifted by an uncommitted local patch, later removed: the repaired launcher case passed in 27.8 s; an earlier probe with generous budgets measured runs of 8.2 s and 7.9 s in a 43 s case. A probe cutting runs at 1000 to 6500 ms gave status null before the signal handler (1000, 1500), status 1 with cut stderr from 2000 to 5000, and clean status 0 from 5500. The same fixed test with a 3 s run budget failed on "the launcher outlived its budget ... ETIMEDOUT". An 11 s synchronous afterEach failed "Hook timed out in 10000ms" on the default and passed on the declared budget. session-volume's cases skip on Linux, so the real detach path runs only at the Studio gate.
Residue: volume-hook-cause | low | the Studio report shows the hook passed 10 s but not whether the forced detach or the rmSync used the time; the declared bound covers the detach bound and the Studio gate is the real run.
Residue: load-is-hypothesis | low | no Studio load measurement backs the 15 s expiry; the failure signature matches a spent budget exactly and the idle margin was under 2x, so a recurrence at the new budgets reopens the question.
1.X comparison: JKHeadley/instar fad23b1a43ed2948b711ca703f2f81de82d602e4. Searched src, docs/specs and config for the same symptom. vitest.config.ts testTimeout 120000 and tests/fixtures/test-runner-bound/vitest.fixture.config.ts hookTimeout 120_000 show the same practice of budgets declared above real work under load, which this reuses. A code search for hdiutil names no session-volume counterpart, and this launcher case is 2.0's own, so no 1.x feature code applies.

Subject (2 paths): tests/preview/channel-source-launcher.test.ts, tests/preview/session-volume.test.ts

## Closing block

simplestRobustRoute: raise the two cases' own budgets to what their work can take and name a spent budget in the assertion. This proposal IS that route: no new machinery, no assertion relaxed, no quarantine, no product change.
80/20: the two failed assertions from the gate are repaired at their source; the two residues are low and do not change the fix.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
