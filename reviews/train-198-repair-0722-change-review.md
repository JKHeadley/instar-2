# Change review — train-198 repair: a never-started file is already on the host clock

Subject base: afbdd6c035e7011249b9f77a0fd1dbc3cc890bfc
Review state: open
Reviewed content: none
Outcome: Two merge-step checks refused the real M5 report at afbdd6c0 because hostFileWindow subtracted the run's clock shift from every file, including files none of whose tests ever started. Vitest's main process stamps those with the report start, already on the host clock, so the shift pushed them about 15.7 days past the run's end. Leave that exact stamp unshifted. A shifted worker file outside the run still fails, and a run with no shift behaves as before.
Affected rules: 26 the decision reads the real stamp Vitest wrote, not a label or a size; 37 the gate can pass an honestly green run; 42 a real out-of-window file stays a refusal; 70 reproducer and both-sides tests; 74 this record; 95 the check keeps failing closed; 107 evidence submitted as it is; 111 layer below read; 113 posture stated; 116 simplest route stated.
Affected floors: secrets — none touched; spend cap — no model call or limit added; stop — no stop path touched; no duplicate sends — no send path touched; durable intake — no intake path touched.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: One condition in a gate evidence check and its tests; no product source, authority or live state changes, but the check guards landing.
Side effects: The report window check and both other hostFileWindow callers use the new rule. The receipt window at line 88 and the grounding window in check-assembly-contracts read only files holding a passed test, whose stamps come from a worker, so they still shift. A worker file stamped by chance at exactly the report start with no span would read as unshifted; on a shift of days that means a worker clock reading the report start while the host is days away from it, which a real run does not reach. Nothing outside the gate script and tests changes, and dist is unchanged.
Undo and recovery: Revert the repair commit. No state or migration is involved; the next gate run rewrites its report and exit row.
Multi-machine posture: Machine-local by design. Each host's exit row records that host's own shift and report start, and the check compares a host's report with its own row.
Layer below: Read Vitest 3.2.7's JsonReporter: a file with no test result.startTime gets this.start for startTime, endTime stays there, and report.startTime is the same this.start. A test skipped at runtime has a result, so it keeps a worker stamp; all skipped is therefore not the deciding property. Read the exit-row writer in tests/assembly/production-grounding-process-evidence.mjs, which records reportStart from the report, and the three hostFileWindow callers. Replayed the real Studio half at afbdd6c0 (31 files, shift -1357193218): one file, native-loop-live.test.ts, carries the report start with start equal to end, 3 skipped tests and no durations; the other 30 are on the worker clock and hold passed tests. Maximum file end went from 15.70 days past the run to inside the window, and all 30 worker files shift exactly as before. The M5 report is not readable from this machine; the desk replays it.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-boot-conversation-evidence.test.ts; detail=with the repair removed, exactly the two new accept tests fail (shifted-run CLI accept and the report-start stamp unit test) and every refusal control passes; with it, 83 of 83 pass in tests/assembly/production-boot-conversation-evidence.test.ts and tests/unit/test-clock-evidence.test.ts
Hook bypass: none
Convergence: none

1.X FIRST: Searched JKHeadley/instar main 32dc9e82023daeb26c9a94ebe28e9f60d6fc0cb0 through the GitHub code search for reportStart, clockShift and INSTAR_TEST_CLOCK_SHIFT (no results), and git-grepped main 25bc3e66bb6a94d3c81d2406d48efa04bf67733d for reportStart and clockShift across the tree (no match). Read src/localVerify/laneReport.ts at 25bc3e66, the 1.x parser of the same Vitest JSON report: it uses endTime minus startTime only as a duration, so it has no window check and no shift to reuse. Grepped the in-repo legacy-1x tree for reportStart, clockShift and .startTime (no match). ONEX-LESSONS.md, read from the Studio lanes, has no entry on Vitest report stamps or clock shifts; its three clock matches concern other behaviours. Fit: none; this is a 2.0 gate behaviour with no 1.x counterpart.

Prompt review: No model prompt, output parser or judgment criterion changed. The repair touches one gate script and its tests.
Decision: train-198-never-started-stamp | Decide from the exact stamp Vitest's main process writes, start and end both equal to the report start, rather than from all tests skipped, because a test skipped at runtime has a worker stamp and must still shift. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-198-repair-0722-PROGRESS.md
Decision: train-198-never-started-exit-row | Read the report start from the exit row hostFileWindow already receives, because the check has already bound that row to this report, so no caller or signature changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-198-repair-0722-PROGRESS.md

Subject (4 paths): reviews/train-198-repair-0722-change-review.md, scripts/check-boot-conversation-evidence.mjs, tests/assembly/production-boot-conversation-evidence.test.ts, tests/unit/test-clock-evidence.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: one condition in the existing helper, using a value already on the exit row it receives. Rewriting the report would break its digest binding, and writing the shift per file would need a Vitest reporter change for a fact the report already shows. The fail-closed window check, the digest binding and the exit-row binding all remain.
80/20: Ran tsc, the two targeted test files, the real Studio half replay, lint, register check and the change-review check. The M5 report replay and the full test remain with the desk, as the brief states.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
