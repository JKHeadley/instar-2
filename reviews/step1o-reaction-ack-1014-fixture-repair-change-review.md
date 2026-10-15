# Change review — acknowledgement fixture contract repair

Subject base: 1eddd4ac58bebb7ed939f35778d1d7be5eb31980
Review state: open
Reviewed content: none
Outcome: The existing two-machine acknowledgement proof exercises definite reaction refusal and text fallback; the Telegram boundary inventory includes the two admitted acknowledgement methods while still excluding conversation creation.
Affected rules: Rules 26, 31, 34, 37, 42, 49, 53, 63, 74, 87, 101, 102, 105, 111, 113, 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing product checkpoints. Only the offline transport fixture and its boundary inventory test change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-fixture compatibility repair; no production behavior, model judgment, authority or persistence change.
Side effects: Cutover tests now model a chat where reactions are explicitly unsupported, so the existing fallback text is exercised. Typing receives a successful ephemeral receipt. Unexpected methods still throw. Real-HTTP tests separately cover successful reactions and explicit rejection; UNKNOWN tests retain the no-fallback assertion.
Undo and recovery: Revert these test changes to restore the old fixture; no live state or journal migration is involved. That fixture would again classify its missing reaction method as UNKNOWN and suppress text fallback.
Multi-machine posture: The two-machine proof retains real runners, authority, replicated journal, peer loss and recovery. Only the physical Telegram fixture gains explicit method responses. No owner claim, replica demand or stop behavior is changed.
Layer below: Inspected reactionAcknowledgement's distinction between explicit ok:false and a thrown transport, journal-agent's signed notice/dispatch path, the cutover fixture's method switch, and the bridge's exact allowlist. The failure came from an incomplete fixture, not a missing product retry. Inspected Rules 53 and 87: neither reaction nor typing creates a conversation.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model prompt, output parser, routing or accept/escalate/refuse judgment changes. Existing recorded-shape acknowledgement replays and real loopback bridge tests remain the evidence for product behavior.
Decision: step1o-fixture-contract | Return explicit unsupported-reaction failure and successful typing from the cutover fixture instead of adding a product fallback on UNKNOWN; preserve the no-duplicate floor. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1o-reaction-ack-1014-repair-183048-PROGRESS.md
Decision: step1o-boundary-inventory | Add the two existing non-conversation-creating methods to the exact boundary inventory; retain the prohibition assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1o-reaction-ack-1014-repair-183048-PROGRESS.md
Decision: step1o-smallest-repair | Keep this repair to the incomplete fixture and stale test inventory; preserve product reaction/typing ability and leave the byte-bound native certificate to the Studio contract owner. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1o-reaction-ack-1014-repair-183048-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: complete the existing fixture's protocol and update its consumer inventory, with no runtime machinery. A thrown reaction is genuinely ambiguous and must never enable fallback. Existing durable intake, owner/replica admission, stop and unique dispatch remain the start and limit guards; existing answer completion remains the end guard. No live deployment or unattended product-completion claim is made.
80/20: Run the named failing portable test and the two-machine proof, acknowledgement transport/replay tests, typecheck and cheap gates. The stale native macOS certificate is reported without editing its declaration. The desk owns full-suite and live acceptance evidence.
VERDICT: author submission for desk review; no independent convergence claimed
