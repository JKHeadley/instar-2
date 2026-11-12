# Change review — scoped reservation settlement step-0 conflict

Subject base: e3cb0f08d3a74d70c9e059edbd64fc457492bfff
Subject scope: inherited live-burn diagnosis tests from b29f81631996e5efabed7894015dd9e47a7b1b7b, reviewed for settlement evidence; this unit adds only this record and claims no new test or product implementation.
Review state: open
Reviewed content: none
Outcome: record the task-mandated stop before implementation: the existing toolsreal-whole-liability decision explicitly retains the allowance even after completion because subscription charge remains unknown. No settlement repair or READY claim.
Affected rules: 49, 55, 60, 61, 70, 74, 75, 101, 102, 111, 113, 116, 123
Affected floors: secrets — metadata only; spend cap — full liability unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: whether to supersede the unconditional toolsreal-whole-liability decision with exact call-count settlement while monetary charge remains unknown. The specific task reserves this recorded-decision conflict for the operator.
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: a review record only; zero product or test changes.
Side effects: none in runtime behavior or journal replay. No new model prompts, parsers, settlement rows, dependencies or live writes.
Undo and recovery: revert this review record; there is no runtime rollback or migration.
Multi-machine posture: journal and ownership behavior are unchanged; all evidence work occurred read-only on the Studio.
Team posture: no roles, audience, sharing or standing change. Evidence excludes message bodies and credentials.
Layer below: projectToolTurn and its introducing commit 69d43f65431773afe2ff235ef0b2cb83c24dcd16; runToolTurn reservation/trace/child closure; production-provider aggregate usage projection; docs/09 resource settlement; Astra fulltool MF4; the inherited live-burn diagnosis.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: settlement-recorded-conflict | stop before changing accounting as the specific task requires when a recorded decision retains worst-case liability after completion; report the exact text and distinguish call-count proof from unknown monetary charge | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/reservation-settle-1112-build-report.md

Exact conflict: reviews/w4-toolsreal-change-review.md:22, introduced by 2f099b7c45e649b90ef726eb5fe1d49843645581: “a tool turn reserves maxTurns-1 model attempts beyond the answer's own reservation against the call cap before dispatch (journal row tool-turn/reserved) and never releases it, since the subscription charge is unknown (MF4)”. Current journal.ts:3934–3935 and tool-turn.test.ts:36 retain that behavior; the inherited diagnosis test retains 74 after complete outcomes with usage. Searches of the current reviews and history for the decision/projector text found no superseding settlement decision. This is not a claim that the constitution prohibits settlement: docs/09 says “Release requires settlement evidence or a conservative accounting write-off that counts the maximum as spent; neither enlarges the cap,” and Astra MF4 requires “attribution/settlement with unknown liability retained.”

Evidence limits: the inherited 11-12 metadata proves completed physical invocations, aggregate token usage and verified cleanup. It omits exact internal model counts and per-child usage/retirement certificates. production-provider.ts projects tokens, not num_turns; ToolChildEdge records states/results and budgets, not an exact child usage certificate. One physical invocation or one tool trace is not proof of one internal model call. Unknown, interrupted and recovery-held cases retain their liability. The existing root counter is unchanged; no settlement rows or historical reinterpretation were introduced.

1.x comparison: searched actual JKHeadley/instar origin/main db3ed6d3052cfcc24888b6c8bc86086abcfc2987 src/ and docs/specs/ plus git history (ab26b7ca36c1375d855f08c9a6a66e84e2b656e2). Read src/core/DriftSpendLedger.ts reserve/reconcile/tallySpent and docs/specs/PROJECT-SCOPE-SPEC.md:357. Their append-only reservation then actual-cost row is the reuse candidate; a missing reconciliation preserves estimated exposure. Their daily monetary estimate and ambient filesystem/time implementation do not establish 2.0 call counts or descendant retirement. ONEX-LESSONS.md sections 2/6 reinforce indeterminate versus dead, attempts versus actual outcomes, and physical-scope caps. No code copied because this task's stop condition fired.

Verification: source/history and inherited metadata inspection only. Required static/build checks and publication evidence are recorded in the Studio-readable report. No new red/green or model-facing replay claim; implementation and its requested acceptance tests are unperformed because of the explicit stop clause. Product lines changed: 0.

## Closing block

simplestRobustRoute: after resolution of the recorded-decision conflict, reuse the existing journal with an explicit settlement row tied to exhaustive call-count and retirement evidence, preserving old replay and retaining every unknown allowance. A second ledger is unnecessary. This record does not implement or approve that route, and claims no unattended shipped-path result.
80/20: the exact recorded decision and live projector establish the stop condition; no speculative accounting change is justified under the supplied instructions.
VERDICT: author submission; independent review has not occurred
