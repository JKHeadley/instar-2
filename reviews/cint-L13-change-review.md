# Change review — cint-L13: cint-L12 plus w3-cascadestall

Subject base: 59c66a48fa6aca275329c06fdfae303f30fa5358
Review state: open
Reviewed content: none
Outcome: The next live build is cint-L12 (59c66a48) with origin/w3-cascadestall (e9401715) merged in by an ordinary merge. w3-cascadestall was cut from 37483a60 and merged without conflict: the L12 repair in tests/preview/journal.ts (memoryFrom drops an ordinary turn's re-statement of a preference already on file) and w3-cascadestall's three cascade adjustments (the two-attempt budget counts failures since the last accepted summary via summarySpanFailures; under the over-cap ceiling the one-turn span keeps its second attempt; the over-cap proof is an ended process with a final output-cap result frame whatever its exit code) touch different functions and both are present in the merged file. No source was hand-edited. The desk chain ran as recorded for cint-L11: the inventory repin refreshed nothing; the owner-reference rehash refreshed one pin (register-source/owner-references/preview.json, tests/preview/journal-memory-correction.test.ts, changed by w3-cascadestall); the register was regenerated with --replay at that commit. w3-cascadestall's own record (reviews/w3-cascadestall-change-review.md) is carried intact.
Affected rules: 74 (this record; w3-cascadestall's record carried intact), 7 (the L12 memory validator is unchanged by the merge), 11/47/110 and 15/77 (the summary cascade converges again so the held room answers), 26 and 42 (the over-cap settlement stands only on the attempt's own ended-process outcome row; a call with no exit or no result frame stays UNKNOWN), 55/60/61/75 (attempt bounds unchanged in total), 2 and 3 (both units' tests re-run on the merged tree, including the recorded proof-room replays), 69 and 90 (register regenerated from committed sources with --replay, never hand-merged), 106, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged (retries stay inside maxCalls, eight per pass and two per span); stop — unchanged; no duplicate sends — unchanged (no send path touched); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: the combine carries w3-cascadestall's preview-journal cascade change (declared significant in its own record) onto cint-L12 with a clean merge and a desk repin; approval, send, intake and authority paths are untouched
Side effects: as recorded in reviews/w3-cascadestall-change-review.md (a frontier exhausted under an older base is offered again after an accepted summary; the one-turn span keeps a second attempt under the ceiling; an over-cap attempt ending with an error frame settles as summary-failed); none added by the merge
Undo and recovery: revert the merge commit, the pin refresh, the register regeneration and this record; see w3-cascadestall's record for the journal note on reverting after rows written under the fix
Multi-machine posture: machine-local, deliberately; the preview journal worker on the one preview machine
Layer below: reviews/cint-L12-change-review.md and reviews/w3-prefecho-change-review.md (the base, carried); reviews/w3-cascadestall-change-review.md (carried); tests/preview/call-diagnostics.mjs output-cap classification (unchanged)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed by the merge; the fixture-trigger and neutral-dispatch review of tests/preview/journal.ts is carried from reviews/w3-cascadestall-change-review.md and reviews/w3-prefecho-change-review.md (the summary question, review question, system prompt and Jev calibration are unchanged; the merge only combines which attempts reach them with the L12 memory validator)
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Deferral: tests/preview/fixtures/proofroom-summary-cascade-stall-2026-09-30.json:1 | not-a-deferral=verbatim recorded proof-room turns, replies and writer outputs replayed as test data, not a commitment by this change

Subject (15 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, reviews/w3-cascadestall-change-review.md, tests/preview/README.md, tests/preview/fixtures/proofroom-summary-cascade-stall-2026-09-30.json, tests/preview/journal-memory-correction.test.ts, tests/preview/journal.ts, tests/preview/summary-cascade-stall.test.ts, tests/preview/summary-overcap-cascade.test.ts

## Closing block

simplestRobustRoute: merge the reviewed unit as it is and run the standard desk tools; no checker edit and no new mechanism
80/20: 0 must-fixes, 1 note (targeted tests only; the full gate runs on the Mama PC)
VERDICT: author submission; the independent verdict is recorded as a pass
