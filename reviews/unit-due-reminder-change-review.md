# Change review — unit-due-reminder: a saved requested action fires at its due minute

Subject base: 422570a017df7f587d6b31193c53c829d3735a71
Review state: open
Reviewed content: none
Outcome: on Justin's preview (cint-L4 422570a0, 2026-09-29 14:42) "Remind me today at 2:45 pm to take a short walk" was saved (status.requestedActions.open listed it) but never fired: at 15:03 dueTurns was empty and intakeWriters.scheduler was 0. The due-turn scheduler (scheduleRequests) returned early whenever unresolvedReminderMemory() was true, and that was true whenever ANY verified-operator correction anywhere in the journal had settled as memory-undecided with no recorded decision; the live root carries three such old turns (969389571, 969389576, 969389653), so every requested action was held forever. An undecided correction can withdraw only a request made before it, so it is now judged per request inside reminderUnsettled (which already holds a request for unsettled later turns, and also gates the due turn's answer via actionBlocked); a correction still being decided (pendingMemory) keeps the global hold. Separately, an open requested action now counts as owned work and its future due time feeds loopHealth.nextWorkAt, so a runner exit with only a pending request records revival queued instead of none (Rule 68). Offline replay of the 15:03 live copy: the base build creates no due turn across two passes and a restart; this build creates one due turn written by preview-scheduler:8820318295 (kind system), makes one model call and one send, and a restart sends nothing more.
Affected rules: 10, 29, 37, 57, 68, 74, 93, 116
Affected floors: secrets — unchanged; spend cap — unchanged (the existing cap check in scheduleRequests still gates each due turn); stop — unchanged (stop/expiry checks unchanged); no duplicate sends — kept: one due turn per conversation while one awaits a send (existing actionAwaitingSend) and a dispatched request closes, proven across restart in the test and the replay; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: the requested-action send is a user-facing proactive message; the change narrows a hold on it
Side effects: a request made after an old undecided correction now fires at its due minute; a request made before an undecided correction stays held (unchanged safe side). The pull surface's ownedWork and nextWorkAt now include open requested actions, which can change a runner exit's revival from none to queued.
Undo and recovery: revert these commits; no new record kind, journals are readable by the prior build
Multi-machine posture: single-machine preview runner only; no shared state changed
Layer below: tests/preview/journal.ts unresolvedReminderMemory and reminderUnsettled (read by scheduleRequests and actionBlocked); tests/preview/obligations.ts loopHealth
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-correction-wedge.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/unit-due-reminder-evidence/replay.txt
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed; the system prompt, provider policy and invocationPolicyDigest are unchanged
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: generated/register.json:1 | not-a-deferral=regenerated register output for the changed test pins; nothing is postponed

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-correction-wedge.test.ts, tests/preview/journal.ts, tests/preview/obligations.ts

## Closing block

simplestRobustRoute: move the undecided-correction condition from a global hold into the existing per-request later-turn check (reminderUnsettled), and add open requests to the existing loopHealth owned-work and wake computation; no new record kind, timer, retry or quarantine (Rule 116; Rule 37 fixed at the source).
80/20: tsc --noEmit passes; the new reproducer fails on the base build and passes with the fix, and its neighbour proves the held side; eleven related preview test files pass (110 tests); the offline replay of the live copy fires exactly once and never again after restart (the live= file); the live-build answer check is the pipeline step after push.
VERDICT: author submission; the independent verdict is pending
