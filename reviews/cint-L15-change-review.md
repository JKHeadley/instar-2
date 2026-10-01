# Change review — cint-L15: cint-L14 plus w3-k13a and w3-memmisfire

Subject base: ebaa3b171595de51468a133a7b045b8abfbabdf5
Review state: open
Reviewed content: none
Outcome: The next live build is cint-L14 (ebaa3b17) with origin/w3-k13a (b0c51f4e) and origin/w3-memmisfire (2c34e259) merged in that order by ordinary merges (b39f9ee3, 36407a71), both without conflict; tests/preview/journal.ts auto-merged (the two units touch different blocks: searchFor/searchGuidance for w3-k13a, the answer-decision block for w3-memmisfire). w3-k13a keeps a corrected-away value recallable as labelled history: a corrected memory-search item carries its corrected-away clause as `was` while its replacement is live, with a guidance sentence riding only when some item carries `was`; forgetting still withholds. w3-memmisfire stops an ordinary question being answered with the memory-change failure text: on an uncued, unedited turn, a prefer item that quotes only the agent's own reply is set aside and the model's answer is sent with one fixed not-saved line; cued and edited requests keep the hold. No source was hand-edited. The desk chain ran as recorded for cint-L14: the inventory repin refreshed nothing; tsc built clean; the owner-reference rehash refreshed nothing; the register was regenerated with --replay at the merge commit (b2903b07). The two units' own records are carried intact.
Affected rules: 74 (this record; the two unit records carried intact), 102 (w3-k13a's decisions reported: its Laptop report placed at lanes/w3-k13a-PROGRESS.md unchanged), 7 (the corrected-away value stays recallable as labelled history; forgetting still withholds; nothing written for a set-aside item), 78 and 84 (an ordinary capability question gets its answer), 85 (a genuine request is never a silent success: cued turns keep the hold, uncued ones get the not-saved line), 2 (nothing silently lost; each unit's tests re-run on the merged tree, including the recorded replays), 4, 10 and 11 (as in the carried records), 69 and 90 (register regenerated from committed sources with --replay, never hand-merged), 106, 116
Affected floors: secrets — unchanged (`was` passes the same redaction as quote); spend cap — unchanged (no new call); stop — unchanged; no duplicate sends — unchanged (one reply per turn); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: the combine carries two reviewed preview-journal units with a clean merge and a desk register regeneration; each unit is declared significant in its own record, and no send, intake, approval or authority path is changed by the merge
Side effects: as recorded in the two carried records (answer packets with a corrected item carry `was` as labelled history; an uncued echo-prefer turn is answered with the not-saved line instead of held); none added by the merge
Undo and recovery: revert the two merge commits, the register regeneration and this record; see each unit's record for its own undo notes
Multi-machine posture: machine-local, as in the carried records: the preview journal worker on the one preview machine
Layer below: reviews/cint-L14-change-review.md (the base, carried); reviews/w3-k13a-change-review.md and reviews/w3-memmisfire-change-review.md (carried)
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-memory-own-reply-echo.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/live-proof/results/K-proofroom-20260930-221200/reply-k1.json
Hook bypass: none
Convergence: none
Prompt review: the only prompt text in the subject is w3-k13a's CORRECTED_HISTORY_GUIDANCE, reviewed in its carried record; the merge changes no prompt text; the three existing journal.ts protocol literals are dispositioned as in the carried records
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (23 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/fixtures/proofroom-memory-misfire-715672853-2026-09-30.json, tests/preview/journal-awareness.test.ts, tests/preview/journal-conflicting-memory.test.ts, tests/preview/journal-corrected-history.test.ts, tests/preview/journal-correction-ack-diff.test.ts, tests/preview/journal-forget-property.test.ts, tests/preview/journal-memory-inventory.test.ts, tests/preview/journal-memory-own-reply-echo.test.ts, tests/preview/journal-memory-search.test.ts, tests/preview/journal-message-edit.test.ts, tests/preview/journal-test-worker.ts, tests/preview/journal.ts, tests/preview/realistic-recall.ts, tests/preview/recall-benchmark.ts, tests/preview/self-state.test.ts, tests/preview/self-state.ts

## Closing block

simplestRobustRoute: merge the reviewed units as they are and run the standard desk tools; no checker edit and no new mechanism
80/20: 0 must-fixes, 1 note (targeted tests only; the full gate runs elsewhere)
VERDICT: author submission; the independent verdict is recorded as a pass
