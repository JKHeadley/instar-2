# Change review — Count pending acknowledgement intents in the two-machine stop proof

Subject base: f22f393619e6d32f20bb533d96f7dd3a8f4f6b5b
Review state: open
Reviewed content: none
Outcome: The stop proof exercises the acknowledgement timer deterministically and distinguishes durable reply intents from physical sends while a stopped peer cannot acknowledge replication.
Affected rules: Rules 13/26/31/37/42/63/70/74/87/101/102/111/113/116.
Affected floors: secrets — runtime secret checks unchanged; spend cap — assert no new paid calls after takeover; stop — stopped owner exits and cannot restart as a peer; no duplicate sends — exactly one initial answer, at most one anchored acknowledgement, and unchanged sends and claims after takeover; durable intake — second message remains recorded while replication is unavailable.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair of a reported integration assertion; no runtime, model prompt, parser, acceptance or refusal behavior changes.
Side effects: The initial exchange may include its permitted acknowledgement. Assertions still reject duplicate answers, duplicate acknowledgements, incorrect acknowledgement anchors and any post-stop send. The timer is awaited by its recorded outcome instead of a five-second sleep.
Undo and recovery: Revert the test change and this review. No persistent product state or migrations change.
Multi-machine posture: Real authority and two journal-agent processes prove owner stop, survivor takeover with durable intake, no additional spending or sends without the stopped replica, and inhibited restart of the stopped machine.
Layer below: Read journal.ts held-notice-intent projection and acknowledgeReply, journal-agent.mjs status projection and send replication admission, and two-machine-world.ts process harness. Replies counts durable intents before shared.admit waits for a peer; heldNotices reports UNKNOWN until the send settles. The neighboring two-machine-runner.test.ts already uses intent-aware counts.
Bug class: integration
Bug evidence: reproducer=tests/preview/two-machine-floors.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: d1c3-stop-intent-counter | Reuse the neighboring test's intent-aware count and wait for the blocked second acknowledgement, while checking physical sends and paid calls separately; preserve runtime safeguards and acknowledgement ability. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-d1c3-1012-repair-071706-PROGRESS.md
Prompt review: No model-facing change. This repair changes only integration assertions; it does not change model inputs, output parsing or accept/escalate/refuse decisions.
Evidence: The bounded Studio failure reports replies=2 with one physical send. Targeted foreground tests exercise peer loss and recovery, operator stop and relaunch, absent history, and invalid versus valid machine posture. Final command outputs are recorded in the repair report; no full-run report is fabricated.

## Closing block

simplestRobustRoute: This is the simplest robust route: repair the stale test counter using the existing status projection and assert the physical effects independently. Added runtime machinery is unnecessary. Ownership and durable intake are start guards, replication and dispatch claims are effect guards, and unchanged sends, calls, claims and inhibited restart are end and limit guards. No autonomous product-completion claim.
80/20: Repair the named assertion, run the affected file, compiler and mandated gates, then let the Studio pipeline produce the full-run evidence. No quarantine or full suite here.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
