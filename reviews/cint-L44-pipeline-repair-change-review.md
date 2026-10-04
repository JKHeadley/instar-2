# Change review — cint-L44 pipeline repair: macOS-only detection sees resource-owner launches, the desk-cut pressure counts the memory-failure offer, the recall packet re-pinned

Subject base: 8cec8ee2d3ee192171641169ca7b06d5be67b732
Review state: open
Reviewed content: none
Outcome: Plan row #435. The studio full run of cint-L44 at 8cec8ee2 failed 3 tests in 3 files, plus one vitest-worker RPC timeout ("Timeout calling onTaskUpdate", a worker report under load during a 1053 s run, not a test assertion). (1) tests/platform/macos-only.test.ts: the checked-in list drifted from the detection. Three native-loop files were listed but no longer detected: w4-native's repairs moved the `sandbox-exec` launch from a direct spawn into the host resource owner (`resources.execute({ executable: '/usr/bin/sandbox-exec', ... })`), which the detection's spawn pattern did not recognise, although those files still need a Mac. The source fix extends the pattern to an `executable:` field naming a macOS-only tool, with a positive case (an owner launch of sandbox-exec is detected) and a negative case (an owner launch of a portable executable is not). tests/assembly/process-inventory.test.ts (w4-native, darwin-gated) was missing from the list and is added. (2) tests/preview/journal-awareness.test.ts "cuts a long desk report under byte pressure": the test applied 1024 bytes of pressure, calibrated before w4-memlearn-s's memory-failure offer existed. Since Part 21 §16 makes that offer yield first, and memory search (with its capability guidance) varies innermost, those items alone freed the 1024 bytes and the report was never cut. Shown failing before the fix: under pressure, memorySearch 280 -> 0, memoryFailureDecision 348 -> 0, searchedTurn 28 -> 0, capability 1024 -> 675, sources unchanged. The test now derives the pressure as the bytes everything ranked below the report can free, plus 1024, so the report must yield whatever lower-ranked items exist. The source behaviour is unchanged; both sides are still asserted (whole when there is room, cut with the history verbatim under pressure). (3) tests/preview/recall-latency.test.ts "profiles full turns at 2000 turns": the pinned packet hash trailed. Both merge parents carried the same pin; the cint-L44 side (6d5cb537^1) already produced the new packet and cint-L43 (6d5cb537^2) the pinned one. Diffed field by field: two fields were added (memoryFailureDecision and searchedTurn, the memory-failure offer, because this answer follows a sent reply), and memorySearch, which only uses leftover room, holds 2 items instead of 5. Removing those two fields and restoring the 5 items reproduces the cint-L43 packet exactly, key order included. Re-pinned with that record in the test comment.
Affected rules: 37 (each failure fixed at its source or its stale calibration; nothing quarantined), 11 (memory search stays the lowest-priority evidence; the re-pin records it yielding room to the offer), 26 and 34 (both sides of the detection and of the desk-cut decision asserted), 74 (this record), 116 (one regex alternative, one list line, one derived pressure, one re-pin)
Affected floors: secrets, spend cap, stop, no duplicate sends, durable intake — all unchanged (test detection, a test calibration and a re-pin; no runtime path changed)
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: test-side detection and calibration only; no behaviour changes.
Side effects: the Linux/Mac split now runs the three native-loop files and process-inventory on the Mac half only, as they require.
Undo and recovery: revert the repair commits.
Multi-machine posture: unchanged; no runtime path is touched.
Layer below: tests/preview/journal.ts (the yield order, unchanged) and reviews/cint-L44-change-review.md.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commits; core.hooksPath is unset)
Convergence: none
Decision: cint-L44-pipeline-macos-owner-launch | the macOS-only detection also recognises a resource-owner launch (`executable:` naming a macOS-only tool) instead of dropping the native-loop files from the list: they still launch sandbox-exec and would fail the Linux half | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L44-PROGRESS.md
Decision: cint-L44-pipeline-desk-pressure | the desk-cut test derives its pressure from what the lower-ranked items free instead of a fixed 1024 bytes; the yield order (Part 21 §16) is correct and unchanged | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L44-PROGRESS.md
Prompt review: no model-facing text is added or changed. The recall packet change is w4-memlearn-s's carried offer, already reviewed in its record; this repair only records it in the pin.

Subject (5 paths): tests/platform/macos-only.mjs, tests/platform/macos-only.test.ts, tests/platform/macos-only.txt, tests/preview/journal-awareness.test.ts, tests/preview/recall-latency.test.ts

## Closing block

simplestRobustRoute: teach the detection the one launch form it missed, list the one darwin-gated file, make the desk-cut pressure follow the yield order instead of a stale constant, and re-pin the packet after a field-by-field diff.
80/20: 0 must-fix, 1 note: targeted tests only (the three files, 10/10) and tsc; the pipeline reruns the full suite.
VERDICT: author submission; the independent verdict is recorded as a pass
