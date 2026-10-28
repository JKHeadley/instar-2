# Change review — Repair report-delivery suite model stand-ins

Subject base: 9e04f28e9ef5d7c623e43e3197fde4620d8bd5c8
Review state: open
Reviewed content: none
Outcome: Import the exact supplied candidate, then migrate three delivery-mechanics stand-ins to explicit current report selection while retaining every original assertion and adding omission/reopen neighbors.
Affected rules: 4, 8, 10, 26, 34, 36, 42, 46, 49, 55, 60, 63, 70, 74, 77, 83, 84, 89, 92, 95, 101, 102, 110, 111, 113, 116
Affected floors: secrets — existing redaction and outbound wall retained; spend cap — no additional model calls in either repair; stop — existing guard retained; no duplicate sends — existing receipt and send identity retained; durable intake — source journal unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The report-delivery contract and failure-notice path affect real replies and constitutional commitments, even though each production edit is under 100 lines.
Side effects: No production changes beyond the supplied candidate. Three test stand-ins explicitly select offered reports; recorded output bytes remain unchanged and synthetic selection is labeled. Negative neighbors prove omission retains owed reports across reopen.
Undo and recovery: Revert this isolated candidate branch. Old journals require the rejection decoder to remain if new rejection rows were written; no live journal has been touched. No live journal, deployment, or schema migration is changed.
Multi-machine posture: Existing journal ownership and send receipts remain authoritative; this candidate adds no cross-machine state.
Layer below: T1 carries the 1.x CommitmentTracker invariant that unverified work stays pending; T4 reuses the existing 2.0 durable uncertainty notice instead of replaying a potentially effectful turn. Builder reports explain the 1.x source inspection.
Bug class: integration
Bug evidence: reproducer=tests/preview/astra-two-short-independent.test.ts; captured T1 and T4 transcripts are in lanes/real-task-baseline-20261027; focused combined regressions passed 70/70 at 22:58 PDT; typecheck and architecture are being rerun after the final simplification. Full suite and copy trial pending.
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/report-suite-repair-1027-PROGRESS.md that names the id> -->
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

Decision: report-suite-fixture-selection | Reuse the candidate selection fixture for three stale delivery-mechanics model stand-ins; do not restore unconditional production attachment or weaken any original assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/report-suite-repair-1027-PROGRESS.md
Decision: report-suite-omission-neighbors | Exercise recorded unselected replies and repaired-but-unselected reports across reopen, proving omission neither delivers nor rejects. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/report-suite-repair-1027-PROGRESS.md
Decision: report-suite-import-pins | Rebind imported review metadata to the isolated base/report and regenerate register output from an available local commit because the supplied patch pins an unpublished Studio commit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/report-suite-repair-1027-PROGRESS.md

Validation: Before repair the exact candidate reproduced 9 failures in 27 tests in the three assigned files. After repair the three files plus T1 and archived Astra envelope/rejection/restart cases pass 80/80. Typecheck and architecture pass. Register regenerated in shape-only replay mode from 16213229be07687c10c3422b70044ca9d9af6fae; final pinned checks and change-review output are recorded in the builder report.

simplestRobustRoute: This is the simplest robust route: update stale test model stand-ins to the existing explicit-selection protocol, preserving the runtime unchanged. The credible failure avoided is silently restoring automatic attachment of unsupported reports to satisfy obsolete model stubs. The exact offered/current checks, omission debt, correction, size bounds and send receipts remain held. No live or autonomous completion is claimed.
80/20: Nine reproduced failures repaired with zero additional production lines, every prior assertion retained, and two negative restart neighbors added. Independent landing review and full suite remain desk-owned.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
