# Change review — Combine T1 verified reports and T4 honest failure notice for copy trial

Subject base: 9e04f28e9ef5d7c623e43e3197fde4620d8bd5c8
Review state: open
Reviewed content: none
Outcome: Combined the two independently built small repairs on 9e04f28e9, then replayed the source register against the exact merged tree for an isolated five-task copy trial. No live switch is included.
Affected rules: 4, 8, 10, 26, 34, 36, 42, 46, 49, 55, 60, 63, 70, 74, 77, 83, 84, 89, 92, 95, 101, 102, 110, 111, 113, 116
Affected floors: secrets — existing redaction and outbound wall retained; spend cap — no additional model calls in either repair; stop — existing guard retained; no duplicate sends — existing receipt and send identity retained; durable intake — source journal unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The report-delivery contract and failure-notice path affect real replies and constitutional commitments, even though each production edit is under 100 lines.
Side effects: T1 admits explicit rejection only for exact offered current reports, returns rejected work to the existing correction loop, and tries each complete report through the actual envelope when large or escaped reports on either side do not fit. Omitted reports remain owed. T4 records a bounded count of returned tool results and sends the existing uncertain-answer notice with that count.
Undo and recovery: Revert this isolated candidate branch. Old journals require the rejection decoder to remain if new rejection rows were written; no live journal has been touched. No live journal, deployment, or schema migration is changed.
Multi-machine posture: Existing journal ownership and send receipts remain authoritative; this candidate adds no cross-machine state.
Layer below: T1 carries the 1.x CommitmentTracker invariant that unverified work stays pending; T4 reuses the existing 2.0 durable uncertainty notice instead of replaying a potentially effectful turn. Builder reports explain the 1.x source inspection.
Bug class: integration
Bug evidence: reproducer=tests/preview/astra-two-short-independent.test.ts; captured T1 and T4 transcripts are in lanes/real-task-baseline-20261027; focused combined regressions passed 70/70 at 22:58 PDT; typecheck and architecture are being rerun after the final simplification. Full suite and copy trial pending.
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/report-suite-repair-1027-PROGRESS.md that names the id> -->
Decision: real-task-merge-1027 | Merge the two small repairs only in an isolated worktree, replay the source register, and retain the reviewer repro; keep the live agent untouched until the five-task score improves. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/report-suite-repair-1027-PROGRESS.md
Decision: real-task-size-fit-1027 | Try each whole report through the actual envelope, newest first, before suffix and prefix fallbacks; count every omitted report as owed, never rejected. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/report-suite-repair-1027-PROGRESS.md
Prompt review: The generated register is a pinned description of the merged tree. The task prompts and regression fixture are quoted evidence, never instructions to the current answering mind. This merge adds no new prompt wording beyond the reviewed T1 and T4 units.
Prompt finding: 4106b49fff07 | protocol-literal | Preexisting topic-awareness test phrase, not an added behavioral instruction.
Prompt finding: 849db3a6296a | protocol-literal | Preexisting memory-list test phrase, not an added behavioral instruction.
Prompt finding: 85544c20941f | protocol-literal | Preexisting conversation-session test phrase, not an added behavioral instruction.
Prompt finding: e8708c7fea24 | protocol-literal | Preexisting hallucinated-memory-rate test phrase, not an added behavioral instruction.
Deferral: tests/preview/astra-two-short-independent.test.ts:76 | not-a-deferral=Regression assertion about pending delivery, not postponed work
Deferral: tests/preview/astra-fit-middle-independent.test.ts:76 | not-a-deferral=Regression assertion about pending delivery, not postponed work
Deferral: tests/preview/astra-repair-envelope-independent.test.ts:76 | not-a-deferral=Regression assertion about pending delivery, not postponed work
Deferral: tests/preview/astra-report-backlog-review.test.ts:65 | not-a-deferral=Regression assertion about pending delivery, not postponed work
Deferral: tests/preview/astra-t1-recovery-review.test.ts:92 | not-a-deferral=Regression assertion about pending delivery, not postponed work
Deferral: tests/preview/journal.ts:2673 | not-a-deferral=Protocol wording about pending reports, not postponed work
Deferral: generated/register.json:1 | not-a-deferral=Generated source register metadata, not postponed work.
Deferral: tests/preview/journal.ts:2672 | not-a-deferral=Protocol wording about pending report delivery, not a deferred builder task.
Deferral: tests/preview/t1-verified-answer.test.ts:72 | not-a-deferral=Regression assertion about pending report delivery, not a deferred builder task.

Subject (28 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/deferral-delivery.test.ts, tests/preview/deferral-finish.test.ts, tests/preview/fixtures/t1-verified-answer-20261027.json, tests/preview/fixtures/t4-tool-failure-answer-2026-10-27.json, tests/preview/journal-deliver-all-floor.test.ts, tests/preview/journal-deliver-all.test.ts, tests/preview/journal-due-loop.test.ts, tests/preview/journal-incoherent-results.test.ts, tests/preview/journal-loop-declared-wait.test.ts, tests/preview/journal-loop-fire.test.ts, tests/preview/journal-obligations.test.ts, tests/preview/journal-revision-keeps-results.test.ts, tests/preview/journal-send-outcome.test.ts, tests/preview/journal.ts, tests/preview/obligation-task-answer-live.test.ts, tests/preview/requested-report-live.test.ts, tests/preview/select-report-fixture.ts, tests/preview/t1-verified-answer.test.ts, tests/preview/tool-failure-answer.test.ts, tests/preview/tool-turn.mjs

## Closing block

simplestRobustRoute: Combine the two isolated fixes, replay the register, run the full gate, and measure the same five user tasks on fresh copies before any switch.
80/20: Two small production edits target the two observed failures; existing journal, notice, ownership, and send paths are reused.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

Candidate import: This source review was carried by the exact candidate-ca93.patch onto train-164 for report-suite-repair-1027. Original validation statements describe the source unit, not a fresh independent verdict on this branch. Decision reports are routed to this repair report; the repair review records current validation.
