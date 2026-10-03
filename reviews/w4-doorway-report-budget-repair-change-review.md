# Change review — w4-doorway repair: reserve the effect refusal before follow-up reports

Subject base: d68154295f1bbaf56efade7c889ff0b74c1b5c1a
Review state: open
Reviewed content: none
Outcome: Unit review round 2 (Astra) MUST-FIX on w4-doorway: the long-answer clip ran after completed follow-up reports were attached and their keys recorded, so clipping could cut a report's text while keeping its key, and the journal rejected the whole answer with "invalid obligation report" before anything was sent. The turn's notice is now chosen first; an `effect:` notice's bytes are reserved, the answer body is clipped within that allocation, a follow-up report is attached only whole in the remaining budget, and an omitted report stays pending under its existing owner for a later answer. Register regenerated at aa8016e9.
Affected rules: 8 (an owned follow-up report is never lost: it stays pending and rides the next answer whole), 42 (the refusal still reaches the operator in the same answer), 52 (still one bounded notice inside one answer), 100 (notice keys and dedup unchanged), 34 (test covers the pending-report case and its later delivery; it fails on the previous head with the reviewer's error and passes now), 74 (this record), 116 (reordering inside the existing answer composition; no new sender, queue or stage); Purpose: Part Twelve §3
Affected floors: secrets — unchanged; spend cap — unchanged, no new model call; stop — unchanged; no duplicate sends — unchanged: one send per answer, report keys recorded only for text actually carried; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a bounded ordering fix inside the existing answer-composition point of an already-reviewed critical unit; it changes only which optional report rides an over-long answer that carries its own refusal.
Side effects: when an answer carries its own effect refusal, a completed follow-up report that no longer fits in the remaining budget is deferred to the next operator answer instead of being cut. Answers without an effect notice are composed exactly as before (reports first, then an optional reminder line if room remains).
Undo and recovery: revert commits e8619b99, aa8016e9 and 27e9f256; no journal row shape changed, so no root needs restoring.
Multi-machine posture: unchanged; the decision is local to the worker composing the one answer.
Layer below: openReplyNotices (unchanged, now called before the report loop with the same inputs); pendingReports and the journal's obligation-report validation (unchanged); the worker's clip helper and the 3,500-byte answer budget.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: doorway-refusal-reserved-before-reports | the mandatory effect refusal's room is reserved before optional reports are fitted, so a report is either carried whole with its key or left pending; never cut with its key kept | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-doorway-PROGRESS.md
Prompt review: no model-facing text changed; the notice line, the report line and the deny reason are as reviewed. The test drives the worker with the recorded refused unsandboxed Bash trace shape, as in the reviewer's reproduction.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=regenerated register output, no deferred work
Deferral: tests/preview/journal-obligations.test.ts:1151 | not-a-deferral=test title describing a report kept pending by design, owned by the existing obligation owner
Deferral: tests/preview/journal.ts:6958 | not-a-deferral=comment describing that an omitted report stays pending under its existing owner (Rule 8), not deferred work

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: required outcome: the refusal and every owned report each reach the operator, and the recorded report keys match the sent text. The simplest robust route chooses the notice before the report loop, reserves its bytes, and lets the existing whole-report budget check leave a non-fitting report pending; nothing is added beyond a reorder and one reserved-byte term.
80/20: 0 must-fix, 1 note — a pending report waits for the next operator answer, which is the existing delivery path for reports.
VERDICT: author submission; the independent verdict is recorded as a pass
