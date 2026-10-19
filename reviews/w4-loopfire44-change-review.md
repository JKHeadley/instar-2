# Change review — w4-loopfire44: a loop the answer also declared as a promise is worked on its revisit (plan #461)

Subject base: c0b579258c0aeddd8c63d66ce3351fd6c64caded
Review state: open
Reviewed content: none
Outcome: On live cint-L44 (9ee1c2bd, room two, group D, 15-minute root proofroom2-dshort15-20261003-214951) the deferred d1 work never ran in the quiet window. Read-only decode of a copy of that journal: the answer to update 6232039 (row 286) and its intent (row 295) declared the one deferral sentence "I'll bring you that ranked answer in a later message." both as promises:[{quote}] and as loops:[{kind:promise, waitsOn:nothing}]. The intent projection writes the promise note first, then skipped the loop as a duplicate of the same sentence, so the reply commitment kept the promise's next-relevant-reply wait, which obligationSchedule never schedules; the summary's message-side commitment for the same request was recorded waitsOn operator (also unscheduled). On w3-loopfire's passing run (15:20 root) the answer declared the loop alone (promises []), so it waited on nothing and was worked at 16:15. The scheduling code is byte-identical between origin/w3-loopfire and L44/L45; the merge changed no obligation, scheduler or loop code. The model's output shape varied, and this latent duplicate-skip turned that into no work. nextWorkAt 22:39:54 was not moved by the inbound "hi": it was commitment:0 (the "— K" standing request), whose step failed at 22:24:54 and was rescheduled one revisit later, before the hi arrived (status-d1-wait at 22:32 already showed it). Fix: an undated promise note from the same reply takes the loop's declared owner, wait and kind (one commitment, not two), and the packet's commitment view reports that declared wait; a dated promise keeps its own date. Replaying the recorded journal through this tree makes commitment:2 due at 22:20:37 (frozen L44 tree: due none, nextWorkAt 22:39:54, exactly the live status). Across 208 recorded preview journals only two projections change: this root, and one proofroom2-q note whose declared wait is operator (its schedule is unchanged).
Affected rules: 8, 22, 92, 97, 102 (the open loop the agent declared is worked on its revisit with no inbound, and its result is held for the next message), 2 (a declared loop is no longer silently dropped as a duplicate), 83 (the commitment carries the owner and wait the answer declared), 46 and 64 (status shows the step due and scheduled), 106 and 36 (tests replay the recorded answer shape verbatim, plus a read-only replay of the recorded journals), 34 and 37 (both sides of the new branch tested; touched suites green), 74 (this record), 101 (plain commits), 116 (one projection branch; no prompt, scheduler or frame change)
Affected floors: secrets — unchanged; spend cap — unchanged (one scheduled step per revisit, the existing obligation capacity and call allowance still gate it); stop — unchanged; no duplicate sends — unchanged (the result is still held for the operator's next message under the reply-only grant; one commitment, not two); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: it changes which declared loops become scheduled work in the journal projection; no prompt, model parse, send or authority path changes.
Side effects: on replay of existing journals a reply promise that the same answer also declared as a loop gains owner, waitsOn and loop; where that wait is nothing the step becomes due one revisit after its source. Snapshots taken earlier keep their saved notes until the next replay from frames.
Undo and recovery: revert these commits and this record; no journal frame or file format changed.
Multi-machine posture: machine-local, unchanged (projection of the local journal).
Layer below: applyIntentObligations (intent projection), commitmentWaitsOn and obligationSchedule (unchanged; they read the note), and the packet commitment view in journal.ts.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: loopfire44-merge-not-duplicate | the loop's declared wait is written onto the existing promise note rather than adding a second commitment for the same sentence, so the packet and status show one obligation | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-loopfire44-PROGRESS.md
Decision: loopfire44-dated-keeps-date | a dated promise keeps its due date even if the loop says nothing, since the date comes from the sentence's own words | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-loopfire44-PROGRESS.md
Prompt review: no prompt text changed. Model-facing acceptance unchanged; what a recorded answer's declarations become changed. Replayed the real recorded answer/intent shape of update 6232039 (rows 286, 295 of proofroom2-dshort15-20261003-214951) verbatim in tests and as a read-only projection of a copy of that journal and of 208 recorded preview journals.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing wording in journal.ts, unchanged by this change

Subject (3 paths): reviews/w4-loopfire44-change-review.md, tests/preview/journal-loop-fire.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: the work never ran because one projection branch dropped the loop that would have scheduled it; that branch now keeps the declared wait on the note it already wrote, with no change to the scheduler, prompts or frames.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
