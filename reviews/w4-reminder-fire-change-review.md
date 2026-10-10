# Change review — idle reminders after exhausted background memory

Subject base: 01279df4399297466caa0f72400cdfe1b1269a48
Review state: open
Reviewed content: none
Outcome: a due requested action can create its verified scheduler turn on an idle poll after background summary retries exhaust, without needing another operator message.
Affected rules: 29, 34, 36, 52, 57, 70, 74, 87, 93, 95, 101, 111, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends, durable intake remain enforced by the existing paths.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes when an explicitly requested user-facing reminder is admitted.
Side effects: idle polls now durably settle already exhausted memory judgments as undecided using the ordinary drain's existing predicate. Retryable judgments still hold; later unanswered operator turns still prevent reminders that they might withdraw. No model call, retry, timer, record kind or authority is added.
Undo and recovery: revert this change; the existing memory-undecided records replay on the prior build. No migration is needed.
Multi-machine posture: existing single-owner preview journal and verified scheduler writer; no new state store, ownership policy or transport.
Layer below: pendingMemory, settleExhaustedEdit, summaryFormatFailures, reminderUnsettled, actionAwaitingSend, systemWriter, and the runner's empty-poll dispatch.
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-reminder-idle.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-reminder-fire-replay-green.log
Hook bypass: none
Convergence: none
Prompt review: no prompt, parser, model routing or output interpretation changes; existing fixture literals and neutral dispatch remain unchanged.
Prompt finding: 849db3a6296a | protocol-literal | existing fixed reply for absent saved memory; this change leaves its text unchanged.
Prompt finding: bd01de21286a | protocol-literal | existing packet instruction to cite sourceLabel; unchanged by scheduling settlement.
Prompt finding: fb5fa7e706c8 | protocol-literal | existing packet instruction for questions about what the operator said; unchanged.


Root cause: scheduleRequests returned at unresolvedReminderMemory because background summary-failed records left older turns memoryPending. settleExhaustedEdit was reached only while processing an ordinary pending reply (or edit), so an idle chat had no route to record their already exhausted judgments. Run 1 held on updates 6233049 and 6233055; the inbound 6233068 settled both at 17:06:09. Run 2 held on 6233063 and 6233066. The earlier evening-summary request 6233050 had already settled undecided at 16:40:26 and was not the outstanding hold.

Validation: regression fails on the base and passes with the fix; complete encrypted-prefix replay on the base produces zero due turns and on this change produces one send for each reminder, with none repeated across restart. Replays at 16:49:30 and 17:18:30 use the recorded exhaustion evidence within each due minute. At the exact due second the recorded summary retries were still active, so that existing hold remains intentional. Thirteen targeted files pass (184 tests), with nice -n 10 and --maxWorkers 1, in the foreground. Typecheck and architecture pass. Register wiring reports only the permitted desk-owned source pin for tests/preview/journal.ts.

simplestRobustRoute: call the existing exhaustion settlement before the existing scheduler memory hold. This is the simplest route; no new mechanism. Stop and expiry precede settlement; spend, cancellation, aggregation, verified principal, durable intent and send guards remain. Both recorded reminders fire once in offline copies of their complete live journal prefixes, including after restart. Actual post-deployment Telegram proof belongs to the pipeline; the builder sent nothing into the room.
80/20: the existing settlement is reused; red/green recorded regressions, full-journal offline replay, 184 targeted tests, typecheck and architecture pass. Independent live pipeline gate remains required.
VERDICT: author submission; independent pipeline gate pending
