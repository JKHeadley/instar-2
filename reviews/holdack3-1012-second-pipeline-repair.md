# Change review — Restore carried-request and multi-machine acknowledgement proofs

Subject base: ba72a8dc67778973cd3d99c70882f8f7fc42db62
Review state: open
Reviewed content: none
Outcome: Carried-request tests collect against the shipped cancellation callback, and two-machine tests distinguish one final answer from its optional fixed acknowledgement without overlooking duplicate sends.
Affected rules: Rules 31/37/63/70/74/87/101/111/113/116.
Affected floors: secrets — runtime checks unchanged; spend cap — no additional model call or runtime change; stop — existing cancellation callback retained in extracted host; no duplicate sends — assert one answer per input and unique acknowledgement anchors; durable intake — peer-absent cursor and no-send assertions remain.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only source repair; no production behavior, model prompt, output parser, or admission policy changes.
Side effects: The cutover fixture records the existing reply anchor as optional metadata. Multi-machine status assertions account for acknowledgement intents and dispatch claims. Unknown outbound text still counts as an answer and fails the exact answer count.
Undo and recovery: Revert the three test/fixture edits and this record. No state migration or production recovery is required.
Multi-machine posture: Exercises the real owner, standby, replicated journal, ownership loss, takeover and hand-back paths. Nothing sends while the peer is absent; returned peers release one final answer and at most one anchored acknowledgement per input.
Layer below: Read journal.ts dispatch, acknowledgeReply, startAcknowledgement and held-notice-intent projection; read journal-agent.mjs send admission and replication fences, plus the two-machine and Telegram cutover harnesses. The old test mistook Checking that now. for a second answer. Replies counts durable intents; physical sends and shared claims are checked separately.
Bug class: integration
Bug evidence: reproducer=tests/preview/two-machine-runner.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: holdack3-second-consumer-repair | Keep the shipped eight-second acknowledgement and repair its consumers; record the existing reply anchor to prove per-input uniqueness rather than ignore acknowledgement sends. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-holdack3-1012-repair-PROGRESS.md
Prompt review: No model-facing behavior changes. The restored carried-request suite replays recorded answer 715672480 from proofroom-summary-cascade-stall-2026-09-30.json through the shipped model, subscription and send boundaries, with both refused and admitted controls.
Evidence: Targeted foreground tests cover both named failing files. Direct discriminator controls accept fast/acknowledged answers and reject duplicate/unanchored acknowledgements. Compiler, architecture, register and final gate results are recorded in the repair PROGRESS file. The original failed full-run report remains unmodified; the pipeline supplies the next full run.

## Closing block

simplestRobustRoute: This is the simplest robust route: update the stale extracted signature and test expectations while retaining the shipped acknowledgement and all checkpoint enforcement. Intake and ownership checks are start guards; replicated intent and dispatch claims are send guards; exact final-answer counts, unique acknowledgement anchors and no-send peer absence assertions are end and limit guards. No new runtime machinery or autonomous-completion claim.
80/20: Repair the two reported failures and verify their neighboring paths, compiler and required cheap gates; no full suite or quarantine.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
