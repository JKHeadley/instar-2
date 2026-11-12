# Change review — Preserve replies while allowance observation warms up

Subject base: d23769678d469b03a9c067290111cd5868c7ddfc
Review state: open
Reviewed content: none
Outcome: A startup or post-idle burst remains visible in status but sends no burn warning until a full five-minute observation interval. A warning preserves reply room for accepted unanswered turns, including intake arriving during dispatch admission. Historical notice records keep their original replay and no-repeat semantics.
Affected rules: 2, 8, 13, 22, 26, 37, 46, 52, 54, 60, 69, 75, 86, 87, 89, 101, 102, 106, 112, 113, 116, 123
Affected floors: secrets — unchanged operator-private numeric notices and disclosure checkpoint; spend cap — existing caps plus preservation of pending answer slots; stop — existing dispatch recheck; no duplicate sends — same episode intent and shared claim, UNKNOWN never retried; durable intake — same journal, pending accepted turns retain reply room.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs outward notification admission and reply-budget interaction in the shipped journal worker.
Side effects: One optional timestamp in burn state, reconstructed from reservations and retained in compaction. A gap longer than the five-minute bucket window restarts warm-up. No model call, prompt, parsing, acceptance, cap, tool or service change. No new timer or process.
Undo and recovery: Reverting dispatch policy does not invalidate the additive timestamp or any historical burn frame. Retain the existing generation-7 reader and all intent/outcome history. Old snapshots without observation age warm from the next reservation; they never infer missing evidence.
Multi-machine posture: Observation age follows existing journal replication and replay; same exclusive writer and shared dispatch claims. No machine-local clock state or added peer dependency. Existing operator-private audience checks apply on each dispatch.
Layer below: Actual JKHeadley/instar origin/main db3ed6d3052cfcc24888b6c8bc86086abcfc2987: searched src/monitoring/BurnDetector.ts, docs/specs/token-burn-detection* and git history 5129779c3/ab26b7ca3. Inherits comparison of BurnThrottleRunbook.ts, BurnVerifier.ts, src/scaffold/templates.ts and df87e1630/d6b57c988/ccd775441/9d0088053 from the member review. Reuses recent activity, minimum baseline evidence and episode suppression; adapts token-cost observation to reserved attempts without importing throttle authority. The mismatch repaired is promotion of a startup or post-idle burst directly into an interrupting warning. ONEX-LESSONS 4/6: unavailable usage is not zero, and prove actual consumers. Inspected raw journal projection, snapshots, dispatch rechecks and reply-slot accounting.
Bug class: integration
Bug evidence: reproducer=tests/preview/burn-observation.test.ts
Failure evidence: Supplied train-241 full-gate assertions show extra warnings in seven conversation test files and native-harness-contract; self-state-launcher leaves update 2 pending. Results and intermediate failures are preserved in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-241-repair-PROGRESS.md. No full suite or saved full report was fetched or fabricated.
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample files. Ordinary git commits.
Convergence: none
Decision: T241-R1 | Require one full observation window, restart it after an idle gap, and retain reply space for all accepted unanswered turns at dispatch. Preserve historical burn frame validation rather than rewriting past admissions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-241-repair-PROGRESS.md
Team posture: Numeric allowance observations remain operator-private with the existing forum membership checkpoint; no member or guest receives new access. Team-of-one behavior is unchanged.
Prompt review: Numeric infrastructure dispatch admission only; model questions, output parsing and acceptance unchanged. The fixed notice text is unchanged for historical replay. The unchanged reply-acknowledgement suite replays recorded summary, uncertain, Jev, review, delivered and empty shapes; followup-deliver-launch replays update 46040219. Existing failing assertions remain intact.
Prompt finding: 105c1569b6bb | protocol-literal | Unchanged protocol/fixed notice wording; no model-facing source edited — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged protocol/fixed notice wording; no model-facing source edited — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 441c66bc033f | protocol-literal | Unchanged protocol/fixed notice wording; no model-facing source edited — fixture-phrase tests/preview/journal.ts <- tests/preview/burn-observation.test.ts: "you can ask me to pause optional work. existing limits are unchanged."
Prompt finding: 7ef11b68103f | protocol-literal | Unchanged protocol/fixed notice wording; no model-facing source edited — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged protocol/fixed notice wording; no model-facing source edited — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Unchanged protocol/fixed notice wording; no model-facing source edited — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | protocol-literal | Unchanged protocol/fixed notice wording; no model-facing source edited — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | protocol-literal | Unchanged protocol/fixed notice wording; no model-facing source edited — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged protocol/fixed notice wording; no model-facing source edited — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject (5 paths): tests/preview/burn-observation.test.ts, tests/preview/burn-observation.ts, tests/preview/journal-agent.test.ts, tests/preview/journal.ts, tests/preview/operator-approvals.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing bounded buckets, one observation timestamp, durable episodes and dispatch checkpoint. A full-window prerequisite prevents extrapolated startup bursts from interrupting; an idle-gap reset prevents an old burst from blessing a new one. Reply-room rechecks prevent a warning consuming capacity owed to accepted intake. Product changes total fewer than 30 lines. Added test coverage proves boundary, restart, historical replay and late-intake behavior; no new infrastructure.
80/20: Target the supplied failures and observer controls, then typecheck and cheap gates. Preserve original failing assertions; update only the two earlier member tests that had been changed to demand startup warnings. The pipeline owns the full suite and independent acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
