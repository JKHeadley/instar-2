# Change review — cint-L19: cint-L18 plus w3-retro

Subject base: c0e1dcdeda17a3a3fc33ab8a6c4c3a565d20bc87
Review state: open
Reviewed content: none
Outcome: The next live build is cint-L18 (c0e1dcde, held for the operator's Rule 101 disposition on w3-fulfills) with origin/w3-retro merged by an ordinary merge (84dc8532). The plan named w3-retro at 7b7fc285; the branch was force-updated to 58cd7fe4 before this run, and 58cd7fe4 is the head the unit's report ends READY on, so 58cd7fe4 is what was merged. w3-retro was built on cint-L16 30bda628, so this was a true merge. It applied with no conflict (tests/preview/journal.ts auto-merged), and nothing was edited by hand. w3-retro makes the live retrospective review completable: its required answer was always over the subscription route's 2048-token output cap, so every pass ended `uncertain` and recorded `unknown`. The plan now bounds a pass by the answer it asks for as well as the packet it reads, deferring cases that do not fit and keeping them owed. The question states that budget. A pass whose own recorded call-outcome row proves an over-cap result frame is settled `failed` with a named reason, and the next pass's budget is halved (floor one case). The one src/ edit names the existing 2048 as `SUBSCRIPTION_MAX_OUTPUT_TOKENS`, and both policy digests stay byte-identical. The desk chain ran as recorded for cint-L18: the inventory repin refreshed nothing, tsc built clean, and the owner-reference rehash refreshed nothing. The register was regenerated with --replay at 84dc8532, giving 519fd7b9, which clears the "source pin trails src/assembly/production-provider.ts" item the unit left for the desk. The unit's report lives on the Mama PC. The desk downloaded it (HTTP 200, 207 lines, ends READY 58cd7fe4) and placed it unchanged at lanes/w3-retro-PROGRESS.md. The unit's record carries no Decision lines, so nothing was repointed. Its record is carried intact. The cint-L18 record and every record it carries, including the w3-fulfills Rule 101 violation that awaits the operator's disposition, are carried unchanged.
Affected rules: 74 (this record; the w3-retro record and the cint-L18 record carried), 24, 50, 51, 2, 42, 26, 95 and 13 (as in the carried w3-retro record), 101 (the w3-retro record states `Hook bypass: none` and its report discloses no bypass; this desk run bypassed no hook; the w3-fulfills violation carried from cint-L18 still awaits the operator, and this merge neither resolves nor waives it), 69 and 90 (register regenerated from committed sources with --replay, never hand-merged), 106 (the unit's recorded-shape replay, tests/preview/retrospective-over-cap.test.ts over the 2026-09-29 proof-room rows, re-run on the merged tree), 116
Affected floors: secrets — unchanged (no new egress); spend cap — as recorded in the carried w3-retro record: per pass unchanged, more passes per day once passes complete (1 h interval instead of the 6 h failure backoff), all inside the unchanged existing admission with the 20% reply reserve; stop — unchanged; no duplicate sends — unchanged (the retrospective sends nothing); durable intake — unchanged (a deferred case is recorded with its reason and stays owed)
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: the combine carries one reviewed preview unit, declared significant in its own record, plus the register regeneration, on top of the reviewed cint-L18 build. The merge changes no decision logic, send, intake, approval or authority path beyond what that record reviewed, and the one src/ change is value-identical with byte-identical policy digests.
Side effects: as recorded in the carried w3-retro record. A pass covers fewer cases and the backlog drains across passes; an over-cap pass reads as refused with a named reason rather than UNKNOWN; `RETROSPECTIVE_QUESTION` changed, so the discipline and reply-context digests change (no promoted benchmark case exists to rerun). The merge adds no side effects.
Undo and recovery: revert the merge of 58cd7fe4, the register regeneration 519fd7b9 and this record to return to cint-L18 c0e1dcde; the unit's record has its own undo notes (a partial undo by raising RETRO_ANSWER_RESERVE and RETRO_ANSWER_BYTES_PER_TOKEN)
Multi-machine posture: machine-local, as in the carried record: the single preview journal worker, with its narrowing state replayed from the journal's own records
Layer below: reviews/cint-L18-change-review.md (the base, carried, with the records it carries); reviews/w3-retro-change-review.md (carried)
Bug class: integration
Bug evidence: reproducer=tests/preview/retrospective-over-cap.test.ts
Hook bypass: none
Convergence: none
Prompt review: the only prompt change is the carried unit's: `RETROSPECTIVE_QUESTION` gains one instruction stating the answer budget and the per-field lengths it implies, interpolated from the constant, with no expected answer and no fixture phrase (as reviewed in the carried record). The merge changes no prompt text.
Prompt finding: 450c79237a95 | protocol-literal | existing conversation system-prompt wording in production-provider.ts, unchanged by this change (as dispositioned in the carried w3-retro record)
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change (as dispositioned in the carried records)
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in the carried records)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in the carried records)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Deferral: tests/preview/retrospective-over-cap.test.ts:198 | not-a-deferral=the asserted omission reason for a case the answer budget defers to a later review pass, which stays owed (as dispositioned in the carried record)
Deferral: tests/preview/retrospective-over-cap.test.ts:199 | not-a-deferral=a comment on the next assertion, that a later review pass picks the deferred cases up; it commits nothing
Deferral: tests/preview/retrospective.test.ts:186 | not-a-deferral=a comment naming the accounting population of a pass, which includes the cases the pass itself deferred
Deferral: tests/preview/retrospective.ts:431 | not-a-deferral=a comment on the answer bound, saying a case over it is deferred to a later pass and stays owed
Deferral: tests/preview/retrospective.ts:438 | not-a-deferral=the recorded omission reason for such a case, read back by the status line and the review record

Subject (12 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/production-provider.ts, tests/preview/journal.ts, tests/preview/retrospective-over-cap.test.ts, tests/preview/retrospective.test.ts, tests/preview/retrospective.ts

## Closing block

simplestRobustRoute: merge the reviewed unit as it is and run the standard desk tools; no checker edit and no new mechanism
80/20: 0 must-fixes, 1 note (targeted tests only; tests/preview/successive.test.ts, which the unit could not run under WSL, is left to the full gate elsewhere)
VERDICT: author submission; the independent verdict is recorded as a pass
