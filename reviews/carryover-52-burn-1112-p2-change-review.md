# Change review — Allowance burn observation

Subject base: d1823a36e8b0a3c155dbc723dd6aebc0666e9934
Review state: open
Reviewed content: none
Outcome: Observe a recent reservation rate, show cap/shed projections and send one infrastructure warning per durable episode without changing spending authority.
Affected rules: 1, 13, 26, 34, 39, 42, 49, 52, 53, 60, 63, 74, 75, 81, 84, 86, 87, 89, 101, 102, 113, 116, 117, 123
Affected floors: secrets — existing check and numeric fixed text; spend cap — unchanged reservation limit, notice charged to reply allowance leaving one slot; stop — checked at every dispatch; no duplicate sends — journal intent before existing signed owner/replication send; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Small observation-only addition touches durable outward notice evidence and the journal; no new model gate or throttle.
Side effects: One reply slot per episode; two transition frames plus intent/receipt. Bounded 300 second buckets, no extra model calls. Under-block: reservation rate is conservative liability rather than actual invoices; old snapshots warm up. Over-block: no work blocked by observer. The observer uses the existing minimal cycle and may await one bounded notice send. It preserves uncertainty rather than retrying.
Undo and recovery: Disable observer calls while retaining generation-7 burn reader and projections. Raw non-additive frames correctly refuse older readers; compact snapshots can be read by older readers but cannot be maintained by their writers. Do not roll back the writer to pre-burn code or erase evidence. Revert UI independently.
Multi-machine posture: Replicated journal state and existing execution owner/send claim; no separate store or network authority. One journal writer updates episodes; UNKNOWN intents remain consumed on restart and peer handoff.
Layer below: Read complete constitution; checked reservation accounting, project preflight/append/fsync, snapshot spreads, dispatch admission and physical owner/replication/stop rechecks, bound operator-only audience resolver, authenticated dashboard renderer.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is .husky/_ but .husky and that directory are absent in this worktree. Plain commits and push, no config changes.
Convergence: none
Decision: burn-rate | Use reserved attempts over five minutes, cap exhaustion within 30 minutes; shed is informational so crossing it cannot reset an unchanged episode. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-52-burn-1112-p2-PROGRESS.md
Decision: burn-durability | Use non-additive generation-7 episode/notice frames and keep this reader on rollback; intent conservatively consumes one reply before dispatch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-52-burn-1112-p2-PROGRESS.md
Decision: burn-audience | Budget observations are operator-private; forum notices require verified operator-only membership, forum status masks rate, authenticated dashboard retains it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-52-burn-1112-p2-PROGRESS.md
Prompt review: No model-facing contract, parser or accept/escalate decision changes. Fixed infrastructure observation and status only. Existing prompt scanner hits are unchanged source text; new tests use the journal own writer as expressly accepted by the brief.
Prompt finding: 105c1569b6bb | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 7ef11b68103f | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol wording, unrelated to numeric observation — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject (8 paths): scripts/operator-dashboard.mjs, tests/preview/README.md, tests/preview/burn-observation.test.ts, tests/preview/burn-observation.ts, tests/preview/journal-agent.mjs, tests/preview/journal.ts, tests/preview/operator-dashboard.ts, tests/preview/status-command.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse reservation deltas, encrypted journal projection, minimal polling, signed incident dispatch and existing status/dashboard. New bounded buckets prevent unbounded scan cost; durable episode intent prevents duplicate sends after crash. No throttle, kill, pricing or paid service. Start guards are owner/audience/stop; end guards are normal rate and cap exhaustion; existing caps remain. Real installed live-user proof remains the desk acceptance step, not asserted here.
80/20: One narrow module and existing wiring, within 250 product lines; targeted tests/direct importers, pinned READY files and required checks only. No full suite or base comparison tree.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

1.x comparison: JKHeadley/instar origin/main db3ed6d3052cfcc24888b6c8bc86086abcfc2987, src/monitoring/BurnDetector.ts, BurnThrottleRunbook.ts, BurnVerifier.ts, src/scaffold/templates.ts Token-Burn Alerts; history df87e1630, d6b57c988, ccd775441, 9d0088053. Carry recent activity, episode suppression and honest missing baseline; adapt from fresh token share to reserved call allowance with durable episodes. Throttle/verifier/buttons excluded by this explicitly observation-only slice, not claimed ported. ONEX-LESSONS sections 4/6: unknown is not zero; consumer wiring must be tested.

Team posture: Allowance belongs to the operator; no new member/guest permission. Forum chat status withholds it. Notice admission verifies operator-only audience and the host rechecks; no new topic. Operator dashboard retains its passkey/PIN gate.

Independent review: burn_review inspected the implementation twice. First pass found shed-boundary resets, stale dispatch text, missing-history zero and group disclosure. Those were repaired; the second pass accepted the non-additive rollback route provided snapshot limits and numeric availability are explicit, now recorded. No independent desk approval is claimed.
