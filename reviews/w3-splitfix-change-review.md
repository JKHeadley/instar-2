# Change review — w3-splitfix: the gate's explicit-file vitest steps follow the Linux/Mac split

Subject base: 37483a600e42abaf5be4a9bb5863ea4bdaa3adf5
Review state: open
Reviewed content: none
Outcome: The desk's split validation on cint-L11 37483a60 (lanes/par-qual/splitval-L11-37483a60-only-macos/gate.log lines 85-100) showed that INSTAR_TEST_PLATFORM_SPLIT only narrowed the main vitest run. The two explicit-file steps of `npm run test:durability` still called `vitest run <files>`. Under only-macos, the first step names five portable files and none of them is in tests/platform/macos-only.txt, so vitest printed "No test files found" and exited 1. Under exclude-macos, the second step names only tests/assembly/fixed-installation-live.test.ts, which is on the list, so it fails the same way. Both steps now run through scripts/vitest-split-step.mjs. With the split unset or empty, the wrapper runs `vitest run <arguments>` with the same arguments and environment. Under a split, it keeps only the named files that belong to this half, keeps the vitest options (the `-t` filter), and prints the files it leaves to the other half. When none of the step's files is in this half, it prints that the step was skipped and exits 0. An invalid split value is refused exactly as vitest.config.ts refuses it. tests/platform/gate-split.test.ts reads test:gate from package.json and expands nested `npm run` steps. For every explicit-file vitest step it checks two things: no step is run empty in either half, and the files run across both halves equal the step's unsplit files exactly once. Evidence: before the fix it failed for both halves ("only-macos: <the five durability files>", "exclude-macos: tests/assembly/fixed-installation-live.test.ts"; see lanes/w3-splitfix/red.log). After the fix it passes, together with tests/platform/macos-only.test.ts and tests/assembly/tool-inventory.test.ts (8 tests). `INSTAR_TEST_PLATFORM_SPLIT=only-macos npm run test:durability` exits 0 on the Studio: step 1 is skipped with its log line, and step 2 runs the two native journal cases (2 passed, 43 skipped by -t, as unsplit). Running step 2 alone with exclude-macos prints the skip line and exits 0. The Linux half of step 1 is left to the desk's Mama PC validation.
Affected rules: 37 (each half of the gate can now be green; before this fix, each half failed on a step that had nothing to run), 2 (no test is silently dropped: the new test checks that every file named by an explicit-file step runs exactly once across the halves, and every skip or hand-off is printed), 3 (the evidence is the red-then-green run of the new test and a real only-macos test:durability exit 0), 116 (one small wrapper in the existing script; the main run's split is untouched)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: test-selection tooling only; with the split unset, the same vitest arguments run the same files, and no production source changes
Side effects: none while the split is unset. With the split set, a step whose files all belong to the other half exits 0 after printing that it was skipped. That exit 0 is safe only because the other half runs those files; the new test checks this for every explicit-file step in test:gate.
Undo and recovery: revert this commit
Multi-machine posture: each host runs its half of every explicit-file step from the same checked-in list; the two halves together run each named file once
Layer below: vitest.config.ts include/exclude (w3-gatesplit), tests/platform/macos-only.txt and readList in tests/platform/macos-only.mjs, the desk's splitval-L11 gate.log
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: w3-splitfix-wrapper-not-passwithnotests | a per-step wrapper decides the files for its half and prints each skip; the alternative, vitest's passWithNoTests, would also let an empty main run pass unnoticed | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-splitfix-PROGRESS.md

Subject (4 paths): package.json, scripts/vitest-split-step.d.mts, scripts/vitest-split-step.mjs, tests/platform/gate-split.test.ts

## Closing block

simplestRobustRoute: the split already lives in vitest.config.ts. The gate's two explicit-file steps need only to name this half's files, or not run when there are none. One small wrapper does that, reusing the checked-in list and its reader, with an exact passthrough when unset. A blanket passWithNoTests is simpler but would hide an empty main run. Editing the npm script into two variants per half would duplicate the file list and could drift. The new test that reads package.json is the guard: it fails on any future raw `vitest run <files>` step that breaks a half.
80/20: 0 must-fix, 1 note (the exclude-macos half of step 1 has not run here; the desk validates it on the Mama PC)
VERDICT: author submission; the independent verdict is recorded as a pass
