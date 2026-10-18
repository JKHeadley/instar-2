# Change review — cint-L11: rebuild the batch (w3-holdblocker, w3-gatesplit, w3-cascadelive) on the promotion head

Subject base: f52c7214d96edd3ebc28c53296fa6dd97b4c0f55
Review state: open
Reviewed content: none
Outcome: The next live build is rebuilt on the promotion head promote-L9 (f52c7214: cint-L9 merged with current main, carrying main's approved glossary revision 8 changelog and its main-based review record). Three already-reviewed units are added by ordinary merge, in order, each without conflict: origin/w3-holdblocker (d90a67c8) lets the reply reviewer count an open, settled blocker of the same limit, so a restated can't-do answer is sent instead of held; origin/w3-gatesplit (8c4e3830) adds the INSTAR_TEST_PLATFORM_SPLIT switch in vitest.config.ts with its checked-in macOS-only list and guard test; origin/w3-cascadelive (1566b479) settles a summary attempt whose own physical outcome row proves a finished result over the output cap as summary-failed instead of an UNKNOWN latch, and offers a shorter span next, so the summary confidence cascade is reached live. No source was hand-edited, and the glossary changelog is byte-identical to the promotion head. The desk rehash refreshed one owner-reference pin (tests/preview/journal-obligations.test.ts) and the register was regenerated with --replay. Because the record base already carries the approved changelog, no Rule 90 finding arises; this replaces the blocked cint-L10 batch.
Affected rules: 74 (this record; the three unit records are carried intact), 37 (targeted files green; the split keeps every portable test in a half), 10, 12, 20, 21, 23, 99, 108 (w3-holdblocker's reviewed reviewer-prompt change carried byte-for-byte), 26 (the macOS list is checked against what the files execute; an over-cap settlement stands only on the attempt's own outcome row), 2, 42, 55, 57, 60, 61, 67, 75, 86, 95 (w3-cascadelive: a failed attempt is recorded with its reason, a real UNKNOWN stays UNKNOWN, retries stay inside the pass's eight attempts and maxCalls, the cascade itself is unchanged), 106 (w3-cascadelive's real recorded-shape replay is carried), 69 and 90 (register regenerated from committed sources, never hand-merged; the changelog is main's approved record, unchanged here), 91, 102 (decision cint-L11-base-on-promotion), 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged (a settled over-cap attempt was already charged; retries stay inside maxCalls and the eight-attempt pass; no charge is written off); stop — unchanged (the stop gate runs before every model call as before); no duplicate sends — unchanged (w3-holdblocker only changes whether a reviewed candidate is held or sent once; w3-cascadelive touches no send path); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: w3-holdblocker changes what the live reply reviewer holds or sends, and w3-cascadelive changes which summary attempts the live cascade reaches
Side effects: none beyond the carried units' own reviewed side effects (w3-cascadelive: summary-failed rows with reason "summary output over the cap" follow the four over-cap summary-uncertain rows already in the live journal on its next pass, and status gains lastSummaryFailure)
Undo and recovery: revert the merge commits fd873411, 7573a97a and d2a19101, the pin refresh b1e8f7d5, the register regeneration 03541c9b and this record; summary-failed rows already written stay valid history for the reverted code
Multi-machine posture: machine-local, deliberately; the preview journal worker runs on the one preview machine, and the test split is chosen per host by an environment variable with the list checked in so every machine reads the same one
Layer below: reviews/promote-L9-change-review.md (the base, with lanes/astra-line-delta-review.md VERDICT YES); reviews/w3-holdblocker-change-review.md, reviews/w3-gatesplit-change-review.md and reviews/w3-cascadelive-change-review.md (all carried intact); the provider's over-cap uncertain classification (src/assembly/production-provider.ts) is unchanged, and the journal's physical outcome row (tests/preview/call-diagnostics.mjs) is the settlement evidence
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: cint-L11-base-on-promotion | this batch is rebuilt on the promotion head, whose main-based record already carries the approved glossary changelog, so this record's base agrees with it and no Rule 90 finding arises; no checker edit and no approval acceptance of a finding | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L11-PROGRESS.md
Prompt review: no prompt text changes in the combine; w3-holdblocker's reviewed reply-review and blocker-guidance texts are carried byte-for-byte from d90a67c8, and w3-cascadelive changes no prompt (only which summary attempts reach the unchanged summary question, review question and Jev calibration).

Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:7 | not-a-deferral=a verbatim recorded proof-room reply or writer output replayed as test data (w3-cascadelive, observer #106), not a commitment by this change
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:17 | not-a-deferral=a verbatim recorded proof-room reply or writer output replayed as test data (w3-cascadelive, observer #106), not a commitment by this change
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:62 | not-a-deferral=a verbatim recorded proof-room reply or writer output replayed as test data (w3-cascadelive, observer #106), not a commitment by this change
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:72 | not-a-deferral=a verbatim recorded proof-room reply or writer output replayed as test data (w3-cascadelive, observer #106), not a commitment by this change
Deferral: tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json:189 | not-a-deferral=a verbatim recorded proof-room reply or writer output replayed as test data (w3-cascadelive, observer #106), not a commitment by this change
Skip: tests/platform/macos-only.test.ts:42 | scope=fixture text written to a temporary file to prove detection of a darwin skipIf gate; no test in this repository is skipped

Subject (19 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/platform/macos-only.mjs, tests/platform/macos-only.test.ts, tests/platform/macos-only.txt, tests/preview/README.md, tests/preview/fixtures/proofroom-summary-overcap-2026-09-30.json, tests/preview/journal-agent.mjs, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts, tests/preview/reply-check.ts, tests/preview/summary-overcap-cascade.test.ts, vitest.config.ts

## Closing block

simplestRobustRoute: rebuild on the promotion head so the record base carries the approved changelog, merge the three reviewed units as they are, and regenerate the derived files with the standard desk tools; no checker edit and no new mechanism
80/20: 0 must-fixes, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
