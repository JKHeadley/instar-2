# Change review — w3-gatesplit: a full test run can split into a Linux half and a macOS-only half

Subject base: 12e9f1b471cc7c0265eebfdb65546044afe9b52e
Review state: open
Reviewed content: none
Outcome: The Mama PC (Windows/WSL) has run no full test since 2026-09-29 11:35, when macOS-only tests failed there, so every full test queues on the one Studio slot. INSTAR_TEST_PLATFORM_SPLIT=exclude-macos runs every test file except the checked-in list tests/platform/macos-only.txt; only-macos runs exactly that list; unset or empty runs everything as before; any other value refuses. A guard test keeps the list equal to a detection of macOS-only mechanisms (spawning sandbox-exec, launchctl, plutil, hdiutil or diskutil, BSD stat -f, or a darwin runIf/skipIf gate), directly or through a relative import under tests/ or scripts/ (tests/setup/ is the shared, platform-aware harness and is not followed). Evidence: the guard's 4 tests pass and fail when a list line is removed; vitest list shows the halves are disjoint and together equal the unsplit 709 files.
Affected rules: 37 (each half is a complete, green-able suite; nothing is quarantined, a portable test moved to the Mac half still runs), 26 (the list is checked against what the files actually execute, not against a hand-kept label), 116 (one list, one env var in the existing config, one guard; no new runner or service), 74
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: test-selection configuration only; the default (unset) run is byte-for-byte the same file set, and no production source changes
Side effects: none while the variable is unset. With exclude-macos, an explicit path to a listed file finds no tests (by design). Post-test contract checkers read one results file, so a split run must merge both halves' results before they run.
Undo and recovery: revert this commit; unset the variable
Multi-machine posture: selects test files per host; the list is checked in, so every machine reads the same split
Layer below: vitest.config.ts include/exclude, the 09-29 11:35 Mama PC report, the self-host harness's sandbox-exec launch, the native worker tests' darwin gates
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Skip: tests/platform/macos-only.test.ts:42 | scope=fixture text written to a temporary file to prove detection of a darwin skipIf gate; no test in this repository is skipped
Decision: w3-gatesplit-import-conservative | a file importing a local helper that spawns a macOS tool is listed even if it may only use a portable export, because over-listing only moves a portable test to the Mac half while under-listing turns the Linux half red | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-gatesplit-PROGRESS.md

Subject (4 paths): tests/platform/macos-only.mjs, tests/platform/macos-only.test.ts, tests/platform/macos-only.txt, vitest.config.ts

## Closing block

simplestRobustRoute: a checked-in list read by the existing vitest config through one environment variable, kept honest by one test that re-derives the list from what the files execute. That is the route; no new runner, script or gate.
80/20: 0 must-fix, 1 note (the Linux half is still expected to fail the limit-shim tests until the shim's `ulimit -u`, which dash rejects, is made portable; a separate unit)
VERDICT: author submission; the independent verdict is recorded as a pass
