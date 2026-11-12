# Change review — Burn notice delivery counts

Subject base: 0b4f38762bbf6b90944a63d822c93cc23f01c787
Review state: open
Reviewed content: none
Outcome: Delivery summaries include every burn notice, preserving accepted, refused and UNKNOWN across restart, compaction and later episodes.
Affected rules: 13, 26, 39, 42, 49, 70, 74, 101, 102, 113, 116, 123
Affected floors: secrets — unchanged numeric notices and existing audience gate; spend cap — unchanged reservations and reply charging; stop — unchanged dispatch check; no duplicate sends — unchanged consumed intents; durable intake — unchanged journal writer.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Small repair to durable outbound evidence; no dispatch or authority change.
Side effects: Retain one minimal episode/receipt pair per superseded burn intent, within existing admitted reply accounting and journal capacity. Reuse sendOutcomeOf for refusal and unknown reasons. No new sends, timers, model calls, gates or retry. Prior notices carry no duplicate body text. Existing compact snapshots with only a latest notice cannot recover earlier receipts already discarded by the old projection; this unit is not a deployed history repair.
Undo and recovery: Retain the new projection when rolling back consumers; reverting the retention write would again lose later-episode history. Old raw burn frames replay into the new history; snapshots preserve the additive field. Existing rollback limitation for generation-7 burn writers remains. Do not erase old journals.
Multi-machine posture: Same replicated journal and single writer as the original slice. Snapshot transfer includes the prior intent/receipt list; no new machine-local store. Installed transfer proof remains combined-build work, not claimed here.
Layer below: Full purpose and rulebook; actual burn intent/receipt projection, shared sendOutcomeOf, snapshotOf spread and restore, existing send admission/stop/no-retry paths, status JSON unknownSends/sendOutcomes consumer. Real encrypted writer and child-process status tests.
Bug class: durability
Bug evidence: reproducer=tests/preview/burn-observation.test.ts; restart=tests/preview/burn-observation.test.ts
Hook bypass: none; core.hooksPath=.husky/_, directory absent; no hook installed or bypassed.
Convergence: none
Decision: burn-summary-history | Retain minimal prior episode/receipt pairs in existing BurnState; count prior and current notices through sendOutcomeOf so a new episode cannot erase counts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-52-burn-1112-p2-repair-041116-PROGRESS.md
Prompt review: No model-facing change. Added fixture text is the exact deterministic infrastructure notice needed to append a valid crash-gap intent through the real writer, not a model output or parser fixture. Existing prompt findings below are unchanged protocol text.
Prompt finding: 105c1569b6bb | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 7ef11b68103f | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Prompt finding: 441c66bc033f | protocol-literal | Exact unchanged infrastructure notice, used by the real writer to record a valid pre-outcome crash intent; not a model instruction or parser fixture.

1.x comparison: Inherits the reviewed db3ed6d3052cfcc24888b6c8bc86086abcfc2987 comparison (BurnDetector.ts, BurnThrottleRunbook.ts, BurnVerifier.ts), rechecked src, docs/specs/token-burn-detection-and-self-heal.md and history df87e1630/d6b57c988/9d0088053. Retains recent activity, episode suppression and honest missing baseline; allowance reservations remain this slice's measurement. 1.x transport/remediation is not needed for this 2.0 summary repair. ONEX-LESSONS 3/4/6: ambiguous delivery is not non-send; missing evidence is not zero; verify consumers.
Team posture: Same operator-private allowance summary and authenticated dashboard; forum audience masking and notice admission unchanged. No permission expansion.

## Closing block

simplestRobustRoute: This is the simplest robust route: enumerate current and prior burn intents using the existing outcome reader. The small prior list prevents loss when the latest notice is replaced. Existing journal capacity and reply cap bound writes; no competing delivery service or authority. Start, stop and end-of-episode guards stay unchanged. No unattended installed-path completion claim.
80/20: Five product lines plus focused real-writer regression assertions. Portable targeted tests and cheap gates only; combined installed acceptance and wider row-52 work remain as recorded by the independent review.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
