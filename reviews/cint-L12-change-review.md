# Change review — cint-L12: cint-L11 plus w3-splitfix

Subject base: 37483a600e42abaf5be4a9bb5863ea4bdaa3adf5
Review state: open
Reviewed content: none
Outcome: The next live build is cint-L11 (37483a60) with origin/w3-splitfix (d4d6c658) merged in by an ordinary merge. w3-splitfix was cut from 37483a60, so the merge is a fast-forward and adds exactly its reviewed commit: the two explicit-file vitest steps of `npm run test:durability` now run through scripts/vitest-split-step.mjs, so each half of INSTAR_TEST_PLATFORM_SPLIT runs only its own named files (or prints that the step was skipped), and tests/platform/gate-split.test.ts checks that every file an explicit-file step names runs exactly once across the two halves. With the split unset the same vitest arguments run the same files. No source was hand-edited. The desk chain ran as recorded for cint-L11: the inventory repin and the owner-reference rehash both refreshed nothing, and the register was regenerated with --replay at d4d6c658, which clears the one open lint finding w3-splitfix carried (the register-wiring source pin trailing package.json). w3-splitfix's own record (reviews/w3-splitfix-change-review.md) is carried intact.
Affected rules: 74 (this record; w3-splitfix's record carried intact), 37 (each half of the gate can be green; the new test keeps every explicit-file step non-empty and complete across halves), 2 (no named test file is silently dropped by the split; every skip is printed), 3 (evidence is the targeted runs and a real only-macos test:durability exit 0), 69 and 90 (register regenerated from committed sources with --replay, never hand-merged), 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: the combine adds only test-selection tooling and regenerated register files; no production source, prompt, parser or send path changes, and with the split unset the gate runs the same vitest arguments as before
Side effects: none while the split is unset; with the split set, a step whose files all belong to the other half prints its skip and exits 0, which is safe only because the other half runs those files (checked by tests/platform/gate-split.test.ts)
Undo and recovery: revert d4d6c658, the register regeneration commit and this record; nothing persistent is written by the change
Multi-machine posture: each host runs its half of every explicit-file step from the same checked-in list; the two halves together run each named file once
Layer below: reviews/cint-L11-change-review.md and reviews/cint-L11-freshness-change-review.md (the base, carried); reviews/w3-splitfix-change-review.md (carried); vitest.config.ts include/exclude and tests/platform/macos-only.txt with readList in tests/platform/macos-only.mjs (unchanged, the list the wrapper reads)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, package.json, scripts/vitest-split-step.d.mts, scripts/vitest-split-step.mjs, tests/platform/gate-split.test.ts

## Closing block

simplestRobustRoute: merge the reviewed unit as it is and regenerate the derived files with the standard desk tools; no checker edit and no new mechanism
80/20: 0 must-fixes, 1 note (the exclude-macos half of test:durability is not run here; the desk validates it on the Mama PC)
VERDICT: author submission; the independent verdict is recorded as a pass
