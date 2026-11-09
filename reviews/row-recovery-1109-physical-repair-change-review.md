# Change review — Bind recovery physical outcomes to their reservation

Subject base: 5518d687dc11baa9128bd90b9c8b89d5c30135a6
Review state: open
Reviewed content: none
Outcome: Preserve successful recovery provider results and their durable physical diagnostics through the shipped observedSubscriptionIO wrapper.
Affected rules: 4, 26, 34, 36, 41, 46, 49, 55, 58, 68, 70, 74, 75, 101, 102, 113, 116.
Affected floors: secrets — normal diagnostic redaction and validation remain; spend cap — recovery requires the existing charged replacement; stop — dispatch/send checks unchanged; no duplicate sends — original unique final-send path unchanged; durable intake — original journal and outcome retained through restart.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Small validator repair at the durable model-result boundary.
Side effects: Recovery outcome IDs now validate only for a parent with reserved, answerReplaced and answerAccount. Other roles and arbitrary prefixed IDs remain refused; all outcome shape checks remain. No provider dispatch, tools, authority or cap changes.
Undo and recovery: Revert the validator branch only after stopping new recovery writes; retain a reader capable of replaying recovery call-outcome rows already recorded. Do not delete outcomes or reset reservations/send identities.
Multi-machine posture: Machine-local deliberately, within the existing owned encrypted journal; no lease or foreign-worker authority changes.
Layer below: Traced journal-agent modelRoute through observedSubscriptionIO append-before-return into validateCallOutcome and the answer-replace projection. Replacement reserve sets answerAccount only for recovery:true. Tested physical return, durable reopen, and refusal neighbors.
Bug class: integration
Bug evidence: reproducer=tests/preview/row-recovery.test.ts
Hook bypass: none
Convergence: none
Decision: recovery-physical-binding | Bind the distinct recovery invocation to its existing parent recovery replacement, without bypassing physical diagnostics. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/row-recovery-1109-repair-102054-PROGRESS.md
Prompt review: No prompt or output parser changes. Replay the existing recorded row03/08 interrupted shapes and negative model shapes; successful accounting prose is synthetic. The actual physical wrapper now exercises the missed durable boundary.
Prompt finding: 105c1569b6bb | quoted-evidence | Unchanged production wording from the base, tested verbatim; this repair changes only physical outcome reservation validation — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | quoted-evidence | Unchanged production wording from the base, tested verbatim; this repair changes only physical outcome reservation validation — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 7ef11b68103f | quoted-evidence | Unchanged production wording from the base, tested verbatim; this repair changes only physical outcome reservation validation — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | quoted-evidence | Unchanged production wording from the base, tested verbatim; this repair changes only physical outcome reservation validation — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | quoted-evidence | Unchanged production wording from the base, tested verbatim; this repair changes only physical outcome reservation validation — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | quoted-evidence | Unchanged production wording from the base, tested verbatim; this repair changes only physical outcome reservation validation — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | quoted-evidence | Unchanged production wording from the base, tested verbatim; this repair changes only physical outcome reservation validation — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | quoted-evidence | Unchanged production wording from the base, tested verbatim; this repair changes only physical outcome reservation validation — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject (2 paths): tests/preview/journal.ts, tests/preview/row-recovery.test.ts

1.x comparison (inherited and rechecked): actual JKHeadley/instar main6cbe44c819cd97aec1d9c7f470b04148fbca708d: src/monitoring/ResumeQueue.ts (durable bounded revival), src/core/PendingInjectStore.ts (intake custody, at-least-once injection), src/monitoring/CommitmentTracker.ts (durable promise ownership). Searched src/, docs/specs/, git history and read ONEX-LESSONS2/3/5, autonomous-run-outlives-session.eli16.md and restart-reply-order-and-loss.eli16.md. Reused durable identity/bounds and honest outcomes; direct transplantation would introduce at-least-once external effects. Existing 2.0 encrypted journal and send identity already hold stronger outbound uniqueness. History inspected:4018bf338,11d127b5e,1b4350998,e8576a096,28527b241.

## Closing block

simplestRobustRoute: Reuse the existing recovery replacement reservation at physical-outcome validation. A four-line branch retains distinct invocation identity without bypassing diagnostics or introducing a queue. Existing cap, stop, disclosure and unique-send guards remain; live acceptance remains desk work.
80/20: Fix the single reviewed boundary defect and test the authorized and unauthorized neighbors; row01 remains outside the accepted repair scope.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
