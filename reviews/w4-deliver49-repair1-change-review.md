# Change review — w4-deliver49 repair round 1: no text-overlap veto, a subject line per obligation, an honest ready mark (plan #492)

Subject base: 07110d716240ffb6b7c29532edef8249ac88d437
Review state: open
Reviewed content: none
Outcome: Astra's unit review (VERDICT NO) named three must-fixes, each fixed at its source. (1) repeatsSentReply turned a work report contained in the sent acknowledgement into a failed attempt, so a valid answer that repeats its words ("I'll check the notes and send Home later." then "Home") never reached the operator and each retry met the same veto. The veto and the predicate are removed; the work step's own full-context judgment decides, its packet already carrying yourReply and the improved question (kept) saying repeating it is not the work. (2) The attachment loop settled any result whose text the reply already contained without a subject line, so two deferred questions both answered "Yes." delivered one attributable answer and settled both. Now only a result with the same text from the same originating turn (one deferral recorded from both the message and the reply) shares a line already attached; every other obligation keeps its own "Follow-up on" line. pendingReports carries each item's source turn for that. (3) READY_RESULT promised "appended after your answer ... not pending" before the size bound decided attachment; it now says finished and awaiting delivery, following the answer when this reply has room, otherwise a later message. Targeted evidence: the recorded deferral (HOLD) step is shown to receive yourReply and the question clause; the "Home" neighbor stays a report and is delivered with its subject; Monday and Friday each get their own line; the overflow test asserts results left for the next message were marked with the non-promising wording. Five targeted files, 83 tests, pass; build, lint, register check pass.
Affected rules: 4, 10, 86 (no literal overlap decides completed work; the full-context step decides), 8, 46 (each obligation's result stays attributable and is settled only when its own line is sent), 64 (the packet states only known status), 92 (results still ride the next message in order), 34 (both sides of each decision tested), 37 (fixed at source, nothing quarantined), 74 (this record), 101 (plain commits), 116 (a removal, a narrowed dedup condition, a reworded constant)
Affected floors: secrets — unchanged; spend cap — improved (a valid repeated answer is no longer retried forever); stop — unchanged; no duplicate sends — unchanged (identical text from the same turn is still said once; each result still binds to one reply and settles on its receipt); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes model-facing packet text (READY_RESULT) and which work outputs count as results, and what an operator reply carries.
Side effects: a work step that echoes its acknowledgement is now delivered as that step's result (the model's judgment), as before this unit.
Undo and recovery: revert these commits and this record; no journal frame or file format changed.
Multi-machine posture: machine-local, unchanged.
Layer below: obligationDecision, attachableReport, the answer receipt validation (each report text must be in the sent text), splitReply and MAX_ANSWER_BYTES, all unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: deliver49r1-no-overlap-signal | no overlap signal is added to the work packet: it already carries yourReply beside the question that names it, so the full-context step has the information without a second mechanism | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-deliver49-PROGRESS.md
Decision: deliver49r1-same-source-dedup | sharing a line requires the same originating turn and identical text, the evidence that it is one piece of work recorded twice | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-deliver49-PROGRESS.md
Prompt review: READY_RESULT now reads "finished, result awaiting delivery: follows your answer when this reply has room, otherwise a later message; the work is done, not still to do". OBLIGATION_WORK_QUESTION is unchanged from the unit. Replayed recorded shapes from root proofroom2-dshort15-20261004-071729 (the deferral message, its sent holding reply of update 6232210, the reports of commitments 0 and 1, the "hi" body of 6232211). No live model call was made: the real model's response to the question and the mark is live-proof work.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change (as dispositioned in reviews/cint-L49-change-review.md)
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in reviews/cint-L49-change-review.md)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in reviews/cint-L49-change-review.md)
Deferral: generated/register.json:1 | not-a-deferral=generated register content, regenerated by the desk repin
Deferral: tests/preview/journal-deliver-all.test.ts:92 | not-a-deferral=a test assertion on the delivered follow-up line
Deferral: tests/preview/journal-deliver-all.test.ts:111 | not-a-deferral=a test assertion on the delivered follow-up line
Deferral: tests/preview/journal-deliver-all.test.ts:112 | not-a-deferral=a test assertion on the delivered follow-up line

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-deliver-all.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: remove the veto, narrow the dedup to same-turn identical text, reword one constant; no new machinery.
80/20: 3 must-fix fixed, 1 note (live-proof limits) carried.
VERDICT: author submission; the independent verdict is recorded as a pass
