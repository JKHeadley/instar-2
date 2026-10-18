# Change review — w4-deliver49: every finished result rides the operator's next message (plan #492)

Subject base: ddfc8f67f757097031716b75f64483d4229ecab0
Review state: open
Reviewed content: none
Outcome: On cint-L49 (ddfc8f67, room two, group D short, 15-minute root proofroom2-dshort15-20261004-071729) the deferred work ran on its revisit (D1b PASS) but D1c and D2 failed. Read-only journal dump (openPreviewJournal readOnly+strictReadOnly, no append, no send): before "hi" three results waited (commitment:0 library-card, commitment:1 "— K", commitment:2 the deferral) and status already said "3 finished results wait for your next message"; the reply to "hi" (update 6232211) carried commitments 0 and 1 and stopped, because the answer assembly attached at most two follow-ups, oldest first, inside one 3500-byte message. The deferral's own "result" was its holding reply verbatim ("Got it — I won't answer that now. I'm holding it as an open item…"), so it would have been delivered as the follow-up in place of the ranking; the same deferral was also recorded twice (message side and reply side) and both were worked; and the "hi" packet did not tell the answering model a result was ready, so it wrote "still queued" beside the results it carried. Fix: every waiting result follows the answer and its notice in schedule order, with no count cap and no one-message bound (since 2026-10-03 a long reply is split into ordered messages at send), bounded by the route's answer bound (MAX_ANSWER_BYTES, the size every split reply is derived to carry), the rest pending for the next message; a result whose text the reply already carries settles without being said twice; a commitment work report that only repeats the reply already sent to its source (repeatsSentReply) is recorded failed and retried on the revisit cadence, never a finished result; the work question says yourReply was already sent and that a deferral's report is the deferred answer; and the answer packet marks a commitment whose result rides this reply (READY_RESULT). D2's count of 3 came from two summary-inferred obligations (an already-refused request with no blocker, the D4 failure of the same run, and an acknowledgement of a standing directive), named in the PROGRESS report as a separate defect.
Affected rules: 8, 22, 92, 97, 102 (finished deferred work reaches the operator with their next message, all of it, in order), 46 and 64 (the waiting count stays reported and truthful while results wait), 42 (the effect refusal keeps its reserved room before any follow-up; a result past the answer bound stays pending, never dropped), 10 (a restatement of the sent reply is not accepted as completed work), 106 and 36 (tests replay the root's recorded report texts, sent replies and the "hi" body verbatim), 34 and 37 (both sides of each decision tested; 198 affected preview test files green), 74 (this record), 101 (plain commits), 116 (one loop edit at the one attachment site, one predicate at the one work-result site, one packet field)
Affected floors: secrets — unchanged (report text is the already-redacted work report; the reply still passes checkOutbound and every review before send); spend cap — unchanged (a rejected restatement is one failed step on the existing revisit cadence under the obligation capacity brake and call allowance); stop — unchanged; no duplicate sends — strengthened (a result the reply already says is not repeated, and a result is still bound to one reply and settled only on its receipt); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes model-facing text (the obligation work question and the answer packet) and which work outputs count as finished results, and it changes what an operator reply carries.
Side effects: a reply carrying several results can now be split into more than one Telegram message; an echoed work report now shows as a failed attempt in obligationWork and is retried at the next revisit.
Undo and recovery: revert these commits and this record; no journal frame or file format changed (answer.reports and obligation-result rows keep their shapes).
Multi-machine posture: machine-local, unchanged.
Layer below: splitReply and MAX_ANSWER_BYTES in reply-parts.ts (the bound now exported, unchanged), pendingReports and attachableReport in journal.ts (unchanged), obligationDecision (unchanged), the intent/answer report validation (unchanged: each report text must be in the sent text).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: deliver49-answer-bound | results attach up to the route's answer bound rather than without limit, so every reply stays inside what splitReply is derived to carry; anything past it waits for the next message | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-deliver49-PROGRESS.md
Decision: deliver49-echo-is-failed | a report that only repeats the sent reply is recorded failed (retried on the revisit cadence) rather than a new outcome kind, so no frame changes | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-deliver49-PROGRESS.md
Decision: deliver49-ready-in-item | the ready mark rides the commitment item, not the shared instruction, because the instruction sentence pushed bounded test packets past their byte budget (journal-commitments, journal-long-gap) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-deliver49-PROGRESS.md
Decision: deliver49-summary-obligations-out-of-scope | the two summary-inferred obligations behind D2's count of 3 are named for the desk, not changed here | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-deliver49-PROGRESS.md
Prompt review: OBLIGATION_WORK_QUESTION gains one sentence (yourReply was already sent; re-confirming it is not the work; a deferral's report is the deferred answer). The answer packet gains READY_RESULT on a commitment item whose finished result rides the reply. Replayed recorded shapes from root proofroom2-dshort15-20261004-071729: the work reports of commitments 0-3 (slots 1791124390865, 1791124467456, 1791124613003, 1791125576296), the sent replies of updates 6232206, 6232207 and 6232210, and the model body of the reply to 6232211; repeatsSentReply fires on the deferral's verbatim echo and not on the paraphrase, the acknowledgement-plus-note or the ranking. The new prompt's effect on a real model is not shown by these replays (no live call was made).
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change (as dispositioned in reviews/cint-L49-change-review.md)
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in reviews/cint-L49-change-review.md)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as dispositioned in reviews/cint-L49-change-review.md)
Deferral: tests/preview/journal-deliver-all.test.ts:2 | not-a-deferral=a comment describing the recorded live run's deferred work, not work this change defers
Deferral: tests/preview/journal-deliver-all.test.ts:113 | not-a-deferral=a test assertion on the product's fixed follow-up wording
Deferral: tests/preview/journal-deliver-all.test.ts:114 | not-a-deferral=a test assertion on the recorded deferral reply's wording
Deferral: tests/preview/journal-obligations.test.ts:1151 | not-a-deferral=a test title naming the follow-up report the product delivers
Deferral: tests/preview/journal.ts:2104 | not-a-deferral=the work question's wording about deferrals, which this change makes stricter
Deferral: tests/preview/journal.ts:2111 | not-a-deferral=the packet's ready-mark wording, saying a result is delivered, not deferred
Deferral: tests/preview/journal.ts:2114 | not-a-deferral=a comment describing the recorded live echo
Deferral: tests/preview/journal.ts:7419 | not-a-deferral=a comment on where follow-up reports are placed

Subject (5 paths): reviews/w4-deliver49-change-review.md, tests/preview/journal-deliver-all.test.ts, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts, tests/preview/reply-parts.ts

## Closing block

simplestRobustRoute: the cap of two and the one-message bound were the whole delivery defect; the existing ordered split already carries long replies, so the loop just stops capping. One predicate at the one work-result site stops an echo from posing as a result.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
