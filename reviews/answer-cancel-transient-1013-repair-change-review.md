# Change review — complete cancellation evidence and durable replacement ownership

Subject base: 106912624df1e2edaa63eb6324261a12d5bc2cc7
Review state: open
Reviewed content: none
Outcome: Unavailable, malformed or clipped tool/egress records cannot authorize a cancellation replacement. A replacement records its owned recovery before dispatch; an exception, another UNKNOWN diagnostic or a restart cannot erase it. A delivered answer closes it; failure and loss notices do not.
Affected rules: 1, 4, 8, 26, 41, 49, 55, 58, 60, 70, 74, 75, 83, 84, 95, 101, 102, 111, 113, 116; purpose constraints 2 and 3.
Affected floors: secrets — no raw record errors or new output fields exposed; spend cap — original and replacement UNKNOWN reservations retained separately; stop — existing admission and stop gates run before replacement, notice and obligation work; no duplicate sends — existing send intent fence and complete read-only replay proof; durable intake — original request and pre-dispatch recovery ownership remain in the encrypted journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: repairs exact-effect evidence and durable ownership at the paid answer replacement boundary.
Side effects: older tool traces lacking affirmative completeness cannot authorize new cancellation replacements. The runner initializes its private egress record before serving requests; admission files remain owned by the harness, and missing records remain unknown. A successful replacement now leaves a closed recovery commitment as evidence. Recovery uses existing cadence, caps, tools and reply-only delivery. No authority or capability is narrowed.
Undo and recovery: revert this repair with its generated pins. Preserve the journal, its commitments, and both UNKNOWN reservations. Do not replay uncertain effects. Existing replacement rows replay their historical read-only decision while all new dispatch uses completeness; optional fields leave existing records readable; no commitment is retroactively inserted into an older answer-replace row, preserving recorded commitment indices.
Multi-machine posture: process traces are read on the owning machine; their evidence and recovery obligation enter the existing journal before replacement dispatch. Existing writer ownership and send-intent fences govern restart and handoff. No new store, service or peer dependency.
Layer below: readToolTrace, readEgressRecord, traceRow clipping, projectToolTurn evidence, answer-replace reservation projection, model-uncertain projection, delivered reply settlement, obligationSchedule and restart drain.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/answer-cancel-recovery.test.ts; live=tests/preview/answer-cancel-recovery.test.ts; restart=tests/preview/answer-cancel-recovery.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks.
Convergence: none
Decision: cancel-repair-complete-evidence | carry explicit completeness through the existing trace readers and producer; unknown, malformed or clipped evidence retains owned reconciliation rather than licensing another answer | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/answer-cancel-transient-1013-repair-085656-PROGRESS.md
Decision: cancel-repair-durable-owner | attach the existing recovery commitment to the replacement reservation before dispatch, deduplicate the uncertain-result projection and close only on recorded delivered answer resolution | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/answer-cancel-transient-1013-repair-085656-PROGRESS.md
Decision: cancel-repair-legacy-replay | validate an already recorded pre-repair replacement against its historical trace contract without inserting commitments or authorizing a fresh dispatch from incomplete evidence | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/answer-cancel-transient-1013-repair-085656-PROGRESS.md
Prompt review: No prompt wording changes. Existing uncertainty context remains available to owned scheduled recovery (Rules 58/84). The captured empty SIGKILL diagnostic from update 715675816 drives the real journal worker with production trace readers; captured summary, Jev, reply-review and delivered/empty shapes remain negative cancellation controls. Successful answer and transport failure responses are test doubles, not new live evidence.
Prompt finding: 849db3a6296a | protocol-literal | existing memory-list protocol text is unchanged
Prompt finding: e8708c7fea24 | protocol-literal | existing source-label guidance is unchanged
Deferral: tests/preview/journal.ts:4625 | not-a-deferral=the implemented durable recovery commitment, not deferred engineering

Deferral: generated/register.json:1 | not-a-deferral=generated projection of implemented declarations

## Closing block

simplestRobustRoute: This is the simplest robust route: distinguish observed-empty evidence from unreadability in existing producers, and persist recovery with the existing replacement reservation and commitment scheduler. The completeness bit prevents unavailable or clipped earlier write evidence from granting replay; the pre-dispatch commitment prevents a thrown or differently diagnosed replacement from losing ownership. Existing start/admission, stop, one-replacement, spend and send guards remain. Resolution is a recorded delivered answer or existing owned reconciliation; no separate retry service or new model call route. Offline recorded-shape replay proves the repaired branches; no new live unattended completion is claimed.
80/20: Repair addresses both review must-fixes; 24 cancellation tests and 14 timeout/lost-answer tests pass, as do 14 egress and five notice tests and seven selected producer tests. Coverage includes production readers, restart, UNKNOWN accounting, legacy replay and both incomplete/complete neighbors. Independent acceptance belongs to the desk; this is author evidence only.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
