# Change review — w4-loopfire47 Astra repair: a deferral's acknowledgment is not its completion (plan #477)

Subject base: 78744541d6bce1f53094ac0621eb7445da052d6d
Review state: open
Reviewed content: none
Outcome: Astra unit review (round 1) MUST-FIX: the positive journey test used cint-L46's FIRST revisit (obligation:commitment:3:1791099042440), whose report only says it is holding the item and will think it over "next time", and called it the finished deferral; the earlier record's claim that L45/46's deferral was "twice, each a finished report" was also wrong (only the second step, commitment:3:1791099958095, is the answer). Repair, tests only: the success case now replays the substantive second step and asserts the three-item answer (garden, library card D-2, shopping-list instruction) is what reaches the operator with their next message, carries no "next time", and closes the commitment. The acknowledgment is a negative case through the EXISTING reply review: with the review naming its deferral (defers_work, a held class, in the claim-scoped floor's recorded reason shape), the floor removes exactly that sentence, so the report is not carried whole, sentObligations binds nothing, report.delivered stays unset and the commitment stays open (still in openLoops, awaitingDelivery 1). A companion case shows that without the review the same acknowledgment is delivered and closes the commitment, so the checkpoint is what prevents false completion. The checkpoint did not fail, so no production code changed. Honest residue: the acknowledgment stays the pending result and is offered and reviewed again with each next message; the step does not re-run while it waits. Unattended live completion stays unproven until the combined build's real Telegram check. L47's first step stays continue (correct parser behavior); this repair does not establish D2/D1c within the original 25-minute window.
Affected rules: 34 and 116 (evidence of the behavior claimed: completion is asserted on the answer's content, not on a report outcome), 8, 22, 92 (an unfinished deferral is not closed), 6, 20, 21, 23 (the existing defers_work floor is the checkpoint, unchanged), 36 (recorded model outputs replayed verbatim; observer #106 recorded-shape direction, not constitutional Rule 106, which the earlier record misattributed), 37 (fixed at source, no quarantine), 111 and 113 (layer below and machine-local posture below), 66, 69, 90 (register replayed, not hand-edited), 74 (this record), 101 (plain commits)
Affected floors: secrets — unchanged (no secret in any fixture or test); spend cap — unchanged, no model call or prompt added; stop — unchanged; no duplicate sends — unchanged, a report is still delivered only with the operator's next reply and a removed report settles nothing; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: carries the unit's significant tier; this repair changes tests and the regenerated register only.
Side effects: none in production; the register is regenerated from the new commit.
Undo and recovery: revert the repair commits (test, register replay, this record).
Multi-machine posture: machine-local preview runner, unchanged.
Layer below: reviews/w4-loopfire47-change-review.md (the unit, carried unchanged). Checked one layer down: settleDeliveredReply closes a commitment only for a report bound to the sent reply, and sentObligations binds a report only when the final reply contains its whole text, so the claim-scoped floor's excision is the existing checkpoint that keeps the commitment open.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: loopfire47-repair-no-checkpoint-change | the reply review's defers_work floor already keeps a delivered acknowledgment from closing its commitment, so no classifier, gate or forced continue was added; the re-offer residue is reported | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-loopfire47-PROGRESS.md
Prompt review: no prompt text changed; tests only. Replayed recorded obligation-step outputs from root proofroom2-dshort15-20261004-001216 (commitment:3:1791099042440 acknowledgment, commitment:3:1791099958095 report) and proofroom2-dshort15-20261004-022507 (commitment:3:1791107022571 continue, commitment:3:1791107941154 report). The reply review verdict is a stub in the claim-scoped floor's recorded reason shape; no recorded review of a follow-up deferral exists.
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Deferral: tests/preview/obligation-task-answer-live.test.ts:101 | not-a-deferral=a test comment describing the stubbed review of a recorded deferral, not work this change defers
Deferral: tests/preview/obligation-task-answer-live.test.ts:105 | not-a-deferral=test stub keyed on the product's fixed follow-up wording, not work this change defers
Deferral: tests/preview/obligation-task-answer-live.test.ts:107 | not-a-deferral=test stub review reason quoting a recorded deferral, not work this change defers
Deferral: tests/preview/obligation-task-answer-live.test.ts:109 | not-a-deferral=test stub review finding quoting a recorded deferral, not work this change defers
Deferral: tests/preview/obligation-task-answer-live.test.ts:161 | not-a-deferral=a test assertion on the product's fixed follow-up wording, not work this change defers

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/w4-loopfire47-astra-repair-change-review.md, tests/preview/obligation-task-answer-live.test.ts

## Closing block

simplestRobustRoute: assert completion on the delivered answer's content and prove the existing reply review keeps an acknowledgment's commitment open; no new machinery.
80/20: 1 must-fix fixed, 2 notes recorded (timing residue, rule attribution).
VERDICT: author submission; the independent verdict is recorded as a pass
