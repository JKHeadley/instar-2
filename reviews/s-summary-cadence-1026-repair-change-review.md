# Change review — Consume summary format feedback at dispatch

Subject base: 8e2c8dd2584cd5334ad08a422caeb1b9db1eb8fc
Review state: open
Reviewed content: none
Outcome: Consume a malformed-summary retry marker when its packet is selected, allowing existing bounded recovery after that retry exceeds an output or prose bound.
Affected rules: 26, 36, 49, 55, 70, 74, 75, 96, 101, 102, 113, 116
Affected floors: secrets — existing redaction/encrypted journal unchanged; spend cap — existing dispatch gate, reservations and two-attempt/eight-pass bounds unchanged; stop — dispatch and post-review checks unchanged; no duplicate sends — send path unchanged; durable intake — original turns and failure records preserved.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs recovery on the rolling-summary path without changing prompts, limits or admission.
Side effects: Later fitting spans become eligible after a completed malformed retry fails its bound. The selected retry packet still carries format feedback once. UNKNOWN remains reserved and stops the pass. No new recovery mechanism or state format.
Undo and recovery: Revert this repair; no migration. Durable summaries, raw intake, failures and reservations retain their current format.
Multi-machine posture: Owner-local transient marker; the existing replicated journal holds durable accounting. No transport, ownership or authority change.
Layer below: Inspected packet selection/preparation, one-shot feedback insertion, dispatch gate, durable summary reservation and over-cap settlement, per-span attempt counting and summary review/admission. Constitution read in full and matches origin/main. Existing 1.x foundation assessed in the supplied independent review; no new mechanism ported.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/summary-cadence.test.ts; live=tests/preview/fixtures/summary-cadence-2026-10-26.json
Hook bypass: none
Convergence: none
Decision: consume-format-retry-on-dispatch | Consume feedback selection once the prepared packet is chosen; preserve ordinary bounded recovery for subsequent outcomes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-cadence-1026-repair-124904-PROGRESS.md
Prompt review: No question text, model routing or semantic gate changes. Feedback remains in the selected packet; the transient selector is consumed before dispatch. Recorded malformed bytes are parsed by readAnswer.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged protocol text, no new meaning decision — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged protocol text, no new meaning decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Unchanged protocol text, no new meaning decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged protocol text, no new meaning decision — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Evidence boundary: Mixed sequence is injected: malformed bytes at update 6236633, followed by the recorded physical output-cap outcome at 715672483. They are not claimed to have occurred consecutively live. Prose-bound probe repeats recorded prose synthetically; later larger-span answers/reviews are synthetic conservation checks. Existing tests replay recorded reviewer, Jev and delivered reply shapes.

Publication: Regenerated seven shape-only register outputs from committed source 7a07bfa37a4c451c3463e17065b78a03ab93454f with build-register --replay --commit; supplied owner/grounding repin tools found no changes. No declaration or authority was changed.

## Closing block

simplestRobustRoute: This is the simplest robust route: consume the existing one-shot marker after choosing its retry packet, so ordinary over-cap and prose-bound recovery can run. No added machinery or widened limit. Existing stop/spend/preparation guards admit calls, accounting bounds retries, and existing review guards summary acceptance. Offline regression evidence only; desk owns unattended live acceptance.
80/20: One state reset and four regression cases cover both compaction modes and both bound failures. No unrelated repairs or expanded engine.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
