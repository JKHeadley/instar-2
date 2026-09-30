# Change review — cint-L10: combine main (glossary revision 8), w3-holdblocker and w3-gatesplit onto cint-L9

Subject base: 12e9f1b471cc7c0265eebfdb65546044afe9b52e
Review state: open
Reviewed content: none
Outcome: The live build cint-L9 (12e9f1b4) gains three already-reviewed changes by merge, in order. origin/main 51c56ab9 carries the approved glossary revision 8; its changelog conflicts were resolved to main's approved form (the only difference was status draft to approved plus the approval record). origin/w3-holdblocker (d90a67c8) lets the reply reviewer count an open, settled blocker of the same limit, so a restated can't-do answer is sent instead of held; it merged with no conflict. origin/w3-gatesplit (8c4e3830) adds the INSTAR_TEST_PLATFORM_SPLIT switch in vitest.config.ts with its checked-in macOS-only list and guard test; it merged with no conflict. No source was hand-edited. The generated register was regenerated with --replay, and the desk rehash refreshed one owner-reference pin (tests/preview/journal-obligations.test.ts). Targeted runs: 16 files, 241 tests pass. The split lists 709 files unset, 702 for exclude-macos and 7 for only-macos. tsc, lint, architecture, register check and register wiring are clean.
Affected rules: 37 (every targeted file green; nothing quarantined; the split keeps every portable test in a half), 10, 12, 20, 21, 23, 99, 108 (carried unchanged from w3-holdblocker's reviewed prompt change), 26 (the macOS list is checked against what the files execute), 69 and 90 (register regenerated from committed sources, never hand-merged), 91 (glossary changelog carries main's approved revision record), 74 (this record), 116 (straight merges plus the standard regeneration; no new mechanism)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: w3-holdblocker changes what the live reply reviewer holds or sends
Side effects: none beyond the carried units' own reviewed side effects
Undo and recovery: revert the merge commits ddf29d11, 2c20e945 and a46ceb19, the pin refresh d9fd3d45, the register regeneration 1d73083d and this record
Multi-machine posture: machine-local; the test split is chosen per host by an environment variable, and the list is checked in so every machine reads the same one
Layer below: reviews/w3-holdblocker-change-review.md and reviews/w3-gatesplit-change-review.md (both carried intact); tests/preview/journal.ts declaredObligations, the source of the settled set
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: cint-L10-glossary-take-main | the glossary changelog conflict resolves to main's approved revision 8 record, since main is the approved source and the content otherwise matched | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L10-PROGRESS.md
Prompt review: the only prompt texts in this change are w3-holdblocker's reviewed reply-review and blocker-guidance texts, carried byte-for-byte from d90a67c8; the combine changes no prompt.
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Skip: tests/platform/macos-only.test.ts:42 | scope=fixture text written to a temporary file to prove detection of a darwin skipIf gate; no test in this repository is skipped

Subject (17 paths): docs/03-the-glossary.changelog.json, docs/03-the-glossary.changelog.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/platform/macos-only.mjs, tests/platform/macos-only.test.ts, tests/platform/macos-only.txt, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts, tests/preview/reply-check.ts, vitest.config.ts

## Closing block

simplestRobustRoute: merge the two reviewed units and the approved main as they are, and regenerate the derived files with the standard desk tools
80/20: 0 must-fixes, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
