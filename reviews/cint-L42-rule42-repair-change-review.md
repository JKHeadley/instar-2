# Change review — cint-L42 repair: the effect-refusal reservation shortens only the model body

Subject base: 5540344c4866ea71324ab8535c224c6bdb99c561
Review state: open
Reviewed content: none
Outcome: Integration review round 1 (Astra) MUST-FIX 1 on cint-L42: reserving room for the turn's effect refusal clipped the whole composed answer, including runner-authored outcome lines appended after the model's body (the rejected-standing-instruction correction, date and cancellation outcomes), so a required refusal could be cut while the model's false "I saved" claim stayed. The worker now records the model-authored body before any runner line is appended (reset where the runner replaces the answer: unread action, invalid date, invalid undo) and, when the reservation is needed, shortens only that body and keeps the runner's outcome lines whole. Register regenerated at a02ce7e6.
Affected rules: 42 (a refusal stays a refusal: every runner refusal and the effect refusal both reach the operator in the one answer), 8 (follow-up reports still ride only whole or stay pending; unchanged), 52 (one bounded answer), 34 (the regression drives the real worker on both sides: without an effect refusal and with the recorded refused unsandboxed-Bash trace; it fails on the previous head and passes now), 74 (this record), 116 (one tracked string and a split at the existing clip point; no new sender, queue, gate or stage); Purpose: Part Twelve §3
Affected floors: secrets — unchanged; spend cap — unchanged, no new model call; stop — unchanged; no duplicate sends — unchanged: one send per answer; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a bounded fix inside the existing answer-composition point of an already-reviewed critical unit; it only changes which part of an over-long answer is shortened when the turn carries its own effect refusal.
Side effects: an over-long answer carrying an effect refusal now loses more of the model's body when runner outcome lines are present, so those lines survive. If the runner lines alone leave no room for the body, the previous whole-answer clip is used as before.
Undo and recovery: revert commits 73cca0fd, a02ce7e6 and 31e2f4a1; no journal row shape changed, so no root needs restoring.
Multi-machine posture: unchanged; the decision is local to the worker composing the one answer.
Layer below: the worker's clip helper and the 3,500-byte answer budget; openReplyNotices and the effect notice line (unchanged); the directive validation that produces the invalidDirective refusal (unchanged).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: effect-reservation-clips-model-body-only | runner-authored outcome text is kept whole and only the model's body is shortened to reserve the effect refusal's room, so no required refusal is cut | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L42-PROGRESS.md
Prompt review: no model-facing text changed; the notice lines, the directive refusal and the model question are as reviewed. The test drives the worker with the recorded refused unsandboxed Bash trace shape and the reviewer's nonmatching-directive reproduction.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=regenerated register output, no deferred work
Deferral: tests/preview/journal.ts:6967 | not-a-deferral=comment describing that an omitted report stays pending under its existing owner (Rule 8), not deferred work

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: required outcome: the effect refusal and every runner-authored refusal each reach the operator in the same answer. The simplest robust route remembers where the model's body ends and shortens only it at the existing clip point; nothing else is added.
80/20: 0 must-fix, 1 note — when runner lines alone exceed the room, the old whole-answer clip remains the fallback; runner lines are short and bounded, so this is not reached in practice.
VERDICT: author submission; the independent verdict is recorded as a pass
