# Change review — Interrupted answer recovery

Subject base: 0bde1fda553a2609382d221684b152aa71cdb634
Review state: open
Reviewed content: none
Outcome: Rows03/08 interrupted answers receive one bounded tool-free evidence account through the original final-send identity; ended failed invocations no longer silently strand the reservation. Row01 remains open with its separate incomplete-report design need, as the brief permits.
Affected rules: 4, 26, 34, 36, 43, 46, 49, 52, 55, 60, 62, 68, 70, 74, 75, 83, 101, 102, 113, 116.
Affected floors: secrets — existing redaction and outbound check; spend cap — preserve original UNKNOWN liability, reserve the accounting call separately under existing cap; stop — gate after disclosure immediately before provider dispatch and before send; no duplicate sends — existing durable intent, no original tool replay; durable intake — retain original intake and both attempts across compaction/restart.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: A narrow reversible repair nevertheless touches durable recovery and final messaging.
Side effects: One extra bounded model call only for interrupted tool work or verified ended workers; recovery output carries no new promises, memory declarations or fulfillment. Pending custody, unverified cleanup and later same-ID reservations retain their existing hold. Failed or unavailable accounting has a factual finished/unfinished account, not a fabricated result. No source outside the named journal path changes.
Undo and recovery: Disable new recovery writes while retaining the new projection reader. Do not run the old reader against journals containing recovery answer-replace after model-uncertain: that old transition validator rejects them. Existing reply intents/receipts, intake and charged unknown attempts must remain retained and never be reset.
Multi-machine posture: Machine-local deliberately: the existing owned encrypted journal and host worker remain the single writer. No foreign liveness inference, remote send, new store, lease or ownership authority is added.
Layer below: Audited answer-replace replay validation, tokenCurrent accounting, collectModel custody semantics, toolTurnEligible and conversation-session ID routing, stop/disclosure awaits, normal reply review and send intents. Cleanup proves ended process only, not absence of external effects.
Bug class: integration
Bug evidence: reproducer=tests/preview/row-recovery.test.ts
Hook bypass: none
Convergence: none
Decision: recovery-account | Use one no-tools account instead of rerunning uncertain external work; keep original spend charged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/row-recovery-1109-PROGRESS.md
Decision: promise-separate | Row01 needs an incomplete-report state that cannot fulfill an open promise; this repair prioritizes03/08 as explicitly permitted by the brief. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/row-recovery-1109-PROGRESS.md
Prompt review: The new no-tools prompt asks for an evidence-based finished/unfinished account by meaning; it does not infer success from returned tool results. Replay source: rowproof-1109 updates367056086/88/89, plus captured summary writer, Jev unsure/undecided, reply review, ordinary delivered text and empty field shapes in work-recovery-2026-10-15.json. Synthetic accounting replies are explicitly identified. No live Telegram evidence is claimed.
Prompt finding: 105c1569b6bb | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 7ef11b68103f | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

1.x comparison: actual JKHeadley/instar main6cbe44c819cd97aec1d9c7f470b04148fbca708d: src/monitoring/ResumeQueue.ts (durable bounded revival), src/core/PendingInjectStore.ts (intake custody, at-least-once injection), src/monitoring/CommitmentTracker.ts (durable promise ownership). Searched src/, docs/specs/, git history and read ONEX-LESSONS2/3/5, autonomous-run-outlives-session.eli16.md and restart-reply-order-and-loss.eli16.md. Reused durable identity/bounds and honest outcomes; direct transplantation would introduce at-least-once external effects. Existing 2.0 encrypted journal and send identity already hold stronger outbound uniqueness. History inspected:4018bf338,11d127b5e,1b4350998,e8576a096,28527b241.

Side-effects review: over-block — missing live custody evidence still holds execution; under-block — unobserved lost workers without an exact end record are not declared dead; signal/authority — exact stored outcomes authorize only accounting, never new tool authority; interaction — one replacement cap and original send identity prevent repeated accounting/sends; external surface — one factual final account can replace silence; rollback — disable new writes but retain compatible projection readers and durable history; posture — same owned local journal. Row01 remains OPEN under the specific task's03/08-first allowance.

Subject (5 paths): tests/preview/journal.ts, tests/preview/lost-answer.test.ts, tests/preview/row-recovery.test.ts, tests/preview/journal-requested-action.test.ts, tests/preview/self-state.test.ts

Direct-importer regression updates: a thrown launched call now records uncertainty and attempts its existing notice once. Requested-action restart asserts that one notice receipt rather than silence; self-state counts the UNKNOWN notice send rather than claiming no send was attempted.

Independent side-effects review: recovery_review inspected the implementation and tests, raised stop-race, stale-custody, fallback, route-exhaustion and rollback concerns, then concurred after their repair. This is an independent code/test review, not a live or desk gate verdict. Accepted limits are row01 and missing exact worker-end evidence.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the bounded answer replacement and unique-send machinery for one tool-free account, preserving unknown prior effects. A generic task rerun could duplicate external effects; a new queue or watcher is unnecessary. Stop, disclosure and call cap guard dispatch; an answer or factual incomplete account is the terminal user result. Studio live proof is still required.
80/20: Fix the two shared answer-path failures with a small product diff and bounded replay tests. The separately modeled promise-delivery failure stays open rather than falsely being declared fulfilled.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
