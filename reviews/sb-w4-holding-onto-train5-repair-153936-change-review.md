# Change review — group audience launcher fixture repair

Subject base: 907af02f46ea78e5f63409c44fa8c967fae35442
Review state: open
Reviewed content: none
Outcome: Restore the queued group-turn launcher proof with session work both disabled and enabled, and expose child startup failures without a secondary diagnostic error.
Affected rules: 26, 34, 37, 46, 49, 70, 74, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — the real group-disclosure checkpoint remains in the test; spend cap — no production change; stop — no production change; no duplicate sends — the test still requires exactly one topic-bound send; durable intake — the test still verifies the reserved and sent journal facts
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Repair one process-level test fixture and its failure diagnostics; no production behavior, prompt, parser, or authority change.
Side effects: The fixture now re-exports the shipped requireGroupDisclosureFor checkpoint instead of failing module instantiation. Its loader redirects only the launcher's membership import, allowing the fixture to import the original module without recursion. Missing run logs yield empty diagnostic context while the exit-status assertion still fails with the child's stderr.
Undo and recovery: Revert this test-only change to restore the old fixture; that also restores the two deterministic startup failures. No migration or durable state change.
Multi-machine posture: Deliberately machine-local test scaffolding. The child launcher uses the same real disclosure checkpoint on each host; no shared state or ownership protocol changes.
Layer below: Read journal-cutover-harness.mjs, journal-cutover-loader.mjs, and group-membership-io.mjs. Reproduced both failures, then exposed the actual missing-export SyntaxError by fixing the diagnostic read. The re-export uses the real checkpoint rather than a permissive stub. Existing assertions exercise a single thread-bound send and journal reservation/delivery.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-session-work-launch.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only
Convergence: none
Decision: holding-train5-153936-fixture-export | Re-export the real disclosure checkpoint and scope the loader replacement to the launcher so the original module remains importable; retain the delayed membership reader for the interleaving proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-holding-onto-train5-repair-153936-PROGRESS.md
Decision: holding-train5-153936-startup-diagnostic | Treat an absent runs.jsonl as empty diagnostic context, preserving the failing exit-status assertion and startup stderr instead of masking them with ENOENT. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-holding-onto-train5-repair-153936-PROGRESS.md
Prompt review: No model-facing source changes or new model fixtures. This repairs the test module's export surface and diagnostic read only; no claim of new live-journal replay evidence.

Subject (outside reviews): tests/preview/journal-session-work-launch.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: keep the existing interleaving fixture, re-export its missing real checkpoint, and let diagnostics reveal early child failure. No added runtime machinery or weakened checkpoint. Start guard is real module instantiation and disclosure admission; end guards remain a successful child exit, one send to thread 3, and reserved/sent journal facts; existing child timeout and test deadline bound execution. No autonomous-completion claim.
80/20: Repair the deterministic source defect, run the entire touched test file plus typecheck and cheap gates, and submit the pushed result for independent gate-host review. No full suite, load burner, quarantine, or production change.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
