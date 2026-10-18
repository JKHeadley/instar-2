# Change review — w4-deliver49 repair round 2: no obligation settles under another's follow-up line (plan #492)

Subject base: 58c68e18a87ee5a94d79f37c3c636f39db2f3c8d
Review state: open
Reviewed content: none
Outcome: Astra's round-2 unit review (VERDICT NO) named one must-fix: the attachment loop let a pending result settle under a line already attached when it shared the originating turn and the result text. One message can open two loops ("Check whether Monday and Friday are free; answer both later."), both answered "Yes.", so only Monday's line was sent while both obligations settled. The shortcut is removed: every obligation now gets its own "Follow-up on" line and settles only on that line's receipt. A deferral recorded twice (message and reply) is now said twice with its two subjects rather than risk losing distinct work; that is truthful, bounded by the existing answer bound, and no result is lost. The reviewer's same-turn counterexample is added to journal-deliver-all beside the separate-turn case; it fails on the previous head and passes now. Five targeted files, 84 tests, pass; tsc, architecture, lint and register check pass.
Affected rules: 8, 46 (each obligation's result stays attributable and settles only when its own line is sent), 34 (the same-turn and separate-turn neighbours are both tested; the new test fails before the fix), 37 (fixed at source, nothing quarantined), 74 (this record), 101 (plain commits), 116 (a removal; no new mechanism)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (each result still binds to one reply and settles on its receipt; a twice-recorded deferral is two obligations, each named once); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes which results an operator reply carries and when obligations settle.
Side effects: a deferral recorded both from the message and from the reply now gets two follow-up lines with the same result.
Undo and recovery: revert these commits and this record; no journal frame or file format changed.
Multi-machine posture: machine-local, unchanged.
Layer below: pendingReports, the answer receipt validation, splitReply and MAX_ANSWER_BYTES, all unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: deliver49r2-no-shared-line | no result settles under another obligation's line: a shared source turn and identical text are not evidence of identical work, and a duplicated line is truthful where a missing one loses work | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-deliver49-PROGRESS.md
Prompt review: no model-facing text changed in this round (READY_RESULT and OBLIGATION_WORK_QUESTION are as in round 1). The change is in reply assembly after the model answers; the recorded L49 shapes replayed in round 1 (root proofroom2-dshort15-20261004-071729, updates 6232206-6232211) still pass in journal-deliver-all.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change (as dispositioned in reviews/cint-L49-change-review.md)
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in reviews/cint-L49-change-review.md)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in reviews/cint-L49-change-review.md)
Deferral: generated/register.json:1 | not-a-deferral=generated register content, regenerated after the fix
Deferral: tests/preview/journal-deliver-all.test.ts:131 | not-a-deferral=a test assertion on the delivered follow-up line
Deferral: tests/preview/journal-deliver-all.test.ts:132 | not-a-deferral=a test assertion on the delivered follow-up line

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-deliver-all.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: remove the same-source dedup so each obligation keeps its own line; no new machinery.
80/20: 1 must-fix fixed, 1 note (live-proof limits, D2 summary-inferred residue, overflow bound) carried.
VERDICT: author submission; the independent verdict is recorded as a pass
