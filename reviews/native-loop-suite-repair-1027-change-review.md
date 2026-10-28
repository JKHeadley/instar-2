# Change review — Preserve native stop outcomes

Subject base: 9e04f28e9ef5d7c623e43e3197fde4620d8bd5c8
Review state: open
Reviewed content: none
Outcome: Preserve the exact native stopped result through the T4 failure-notice wrapper on the exact applied candidate; keep failed model/tool notices and all original admission, durability and uniqueness checks.
Affected rules: 4, 26, 34, 36, 42, 49, 70, 74, 101, 102, 107, 111, 113, 115, 116
Affected floors: secrets — no new output fields; spend cap — no extra model or tool invocation; stop — native stopped outcome is not normalized into tool-check failure; no duplicate sends — no new sends or replay; durable intake — original trace is still appended before return and survives reopen.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs classification at the stop boundary of the existing critical tool runner.
Side effects: Only native ended=stopped is excluded from the new T4 normalization. Wrapper stop checks remain; model failures with paired results still produce the existing notice. No parser, prompt, tool admission, cleanup, session or journal schema changes.
Undo and recovery: Revert the added native terminal guard and portable regression. The supplied candidate remains separately identifiable by the downloaded exact patch. No state migration or replay is needed.
Multi-machine posture: Machine-local tool invocation outcome is preserved under the current conversation owner. No new state, cross-machine authority or sends. Existing journal ownership and durable traces retain their scope.
Layer below: Read runNativeLoop finish and stop branches, runToolTurn trace consistency and cleanup, plus the actual captured interrupted Bash result. The wrapper callback is optional and the existing native tests supply only the inner callback; the terminal native outcome is therefore independently necessary. No 1.x subsystem transplant is needed for this exact 2.0 result-preservation defect.
Bug class: integration
Bug evidence: reproducer=tests/preview/native-stop-outcome.test.ts
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: native-stop-terminal | Preserve an explicit native stopped result even when the optional wrapper callback is false; keep the original safety and notice paths. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/native-loop-suite-repair-1027-PROGRESS.md
Prompt review: No prompt or parser changes in the repair. Portable test replays recorded native stop state and admission bytes from fixtures/native-loop/live-2026-10-03/stop.json, update 1; it does not claim macOS cleanup evidence. T4 tests replay update 46040734 and the recorded summary, Jev, review and reply shapes named in the inherited T4 review. Existing native-loop suites remain unchanged for the Studio gate.
Prompt finding: 4106b49fff07 | protocol-literal | Inherited candidate protocol wording — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Inherited candidate protocol wording — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Inherited candidate protocol wording — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Inherited candidate protocol wording — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: generated/register.json:1 | not-a-deferral=Inherited candidate protocol or assertion about owed work, not deferred builder work
Deferral: tests/preview/astra-fit-middle-independent.test.ts:76 | not-a-deferral=Inherited candidate protocol or assertion about owed work, not deferred builder work
Deferral: tests/preview/astra-repair-envelope-independent.test.ts:76 | not-a-deferral=Inherited candidate protocol or assertion about owed work, not deferred builder work
Deferral: tests/preview/astra-report-backlog-review.test.ts:65 | not-a-deferral=Inherited candidate protocol or assertion about owed work, not deferred builder work
Deferral: tests/preview/astra-t1-recovery-review.test.ts:92 | not-a-deferral=Inherited candidate protocol or assertion about owed work, not deferred builder work
Deferral: tests/preview/astra-two-short-independent.test.ts:89 | not-a-deferral=Inherited candidate protocol or assertion about owed work, not deferred builder work
Deferral: tests/preview/journal.ts:2673 | not-a-deferral=Inherited candidate protocol or assertion about owed work, not deferred builder work
Deferral: tests/preview/t1-verified-answer.test.ts:72 | not-a-deferral=Inherited candidate protocol or assertion about owed work, not deferred builder work

Subject (34 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/astra-fit-middle-independent.test.ts, tests/preview/astra-repair-envelope-independent.test.ts, tests/preview/astra-repair-send-independent.test.ts, tests/preview/astra-report-backlog-review.test.ts, tests/preview/astra-t1-recovery-review.test.ts, tests/preview/astra-two-short-independent.test.ts, tests/preview/deferral-delivery.test.ts, tests/preview/deferral-finish.test.ts, tests/preview/fixtures/t1-verified-answer-20261027.json, tests/preview/fixtures/t4-tool-failure-answer-2026-10-27.json, tests/preview/journal-deliver-all-floor.test.ts, tests/preview/journal-deliver-all.test.ts, tests/preview/journal-due-loop.test.ts, tests/preview/journal-incoherent-results.test.ts, tests/preview/journal-loop-declared-wait.test.ts, tests/preview/journal-loop-fire.test.ts, tests/preview/journal-obligations.test.ts, tests/preview/journal-revision-keeps-results.test.ts, tests/preview/journal-send-outcome.test.ts, tests/preview/journal.ts, tests/preview/obligation-task-answer-live.test.ts, tests/preview/requested-report-live.test.ts, tests/preview/select-report-fixture.ts, tests/preview/t1-verified-answer.test.ts, tests/preview/tool-failure-answer.test.ts, tests/preview/tool-turn.mjs

## Closing block

simplestRobustRoute: This IS the simplest robust route: one exact native terminal-state exclusion in the existing failure-notice condition, preserving the result unchanged. It prevents the demonstrated stop-to-failure misclassification without another model, scheduler, retry or policy. Existing admission, cap, stop, trace and unique-send guards remain. No unattended live product completion is claimed.
80/20: One condition fixes the shared seven-failure cause. Portable recorded replay proves red then green; the unchanged macOS suites remain the host gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
