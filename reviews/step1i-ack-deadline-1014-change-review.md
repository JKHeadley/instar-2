# Change review — acknowledgement receipt deadline

Subject base: d53ed65386a3c4d2be9069ce2b0b0752f0b1c944
Review state: open
Reviewed content: none
Outcome: Reserve three seconds inside the ten-second acknowledgement receipt target, replay the recorded copy-walk transport, and suppress the notice once the final answer dispatch is ready.
Affected rules: Rules 1, 13, 26, 34, 36, 49, 52, 63, 70, 74, 77, 87, 101, 102, 111, 113, 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing doorways. No new authority, model call, store, retry or queue mechanism.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Port only fault 8 of the reviewed ack-timing-1013 repair into the existing timer and journal projection. No prompt, parsing or judgment change.
Side effects: Slow requests acknowledge three seconds earlier and may use an existing notice allowance sooner. Final dispatch still cancels the timer and the existing current check refuses obsolete notices during admission. Pending review remains eligible because a raw answer is not yet dispatchable. New seven-second intents must reopen; old eight/ten-second intents remain readable. Existing per-turn deduplication, UNKNOWN handling, cap reservation, stop and disclosure checks remain. The send-stage regression expectation also carries c4e15118: its eight-second model path now crosses the seven-second notice deadline.
Undo and recovery: Restore the ten-second timer if necessary, while retaining the seven-second replay floor so already-written journals remain readable. Never delete history or resend an UNKNOWN notice or final answer.
Multi-machine posture: No new state. Timers remain local to the existing conversation owner and reconstruct from durable intake on restart; existing effect ownership and durable send intents remain authoritative across machines.
Layer below: Inspected the shipped journal-agent imports, startAcknowledgement, acknowledgeReply current predicate, final intent cancellation and held-notice projection. The prior repair also changes queued-message wording; those unrelated lines are excluded. Recorded callback-to-receipt time includes admission and transport, not merely model time.
Bug class: live-path
Bug evidence: reproducer=tests/preview/ack-deadline-rewalk.test.ts; live=tests/preview/fixtures/ack-deadline-rewalk-2026-10-14.json
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model-facing change. Recorded intake, final text and phase/receipt timing for updates 840342743, 840342744 and 840342745 replay through the shipped worker. Model/review duration is explicitly an injected slow dependency, not a claimed new judgment. Existing recorded-output acknowledgement tests additionally retain slow-review and restart coverage.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-attribution guidance in journal.ts is unchanged by the timer repair; the test phrase checks supplied evidence labels, not intent classification.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory rendering in journal.ts is unchanged; the literal represents the exact empty inventory state, not a keyword-based judgment.
Decision: step1i-deadline | Port the measured three-second margin only; use seven seconds for timer and journal admission/replay, preserving the existing acknowledgement text. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1i-ack-deadline-1014-PROGRESS.md
Decision: step1i-suppression | Keep final dispatch readiness as the suppression boundary; a raw answer awaiting review still needs a notice if review is slow. Verify fast dispatch and delayed admission neighbors. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1i-ack-deadline-1014-PROGRESS.md
Decision: step1i-evidence | Replay three captured copy-walk timelines including callback jitter, admission and transport; use injected fast neighbors and verify restart cannot duplicate either send. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1i-ack-deadline-1014-PROGRESS.md

Generated register: Shape-only replay from source commit 283281609a42f2070dbd4d3026d8c91d1a8dbc48; no runtime certificate changed.

simplestRobustRoute: This is the simplest robust route: change the existing deadline constant and its replay floor, retaining all send gates and suppression checks. The named failure is spending transport after the receipt deadline. The measured three-second reserve is the earlier reviewed repair, not a new estimator or scheduler. Start guards are durable verified intake and the existing authority, stop and cap checks; end guards are final dispatch suppression and durable send receipts. Offline recorded-timeline replay proves the bounded timing correction; no live walk, first-paint guarantee, or unattended product acceptance is claimed.
80/20: Targeted changed/direct-import tests, typecheck, architecture, lint, register, change-review and pinned READY checks; no full suite or load generation.
VERDICT: author submission for desk review; no independent convergence claimed
