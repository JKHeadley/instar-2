# Change review — retire cleanly when ownership expires at intake

Subject base: 3e1dc2de3d0ad5f29777d630875d00bf7bbb6889
Review state: open
Reviewed content: none
Outcome: A runner stalled after the post-poll check retires cleanly when intake refuses its expired ownership, retaining queued revival and the same no-send fence.
Affected rules: 26, 31, 34, 37, 42, 49, 63, 68, 70, 74, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — no credential or disclosure changes; spend cap — no calls or budgets added; stop — existing worker gate still refuses; no duplicate sends — ownership and dispatch claims unchanged; durable intake — current owner retains intake and replicated receipts, stale owner never advances the shared cursor.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: A single intake call reuses the existing untilStopped loop adapter; no authority, schema, model or effect policy changes. The mechanical suggestion sees the launcher file; the changed behavior is its exit classification.
Side effects: Adds one awaited microtask after synchronous intake, as with the existing minimal-path gate. A refusal while the loop is ended exits cleanly; a refusal without a stop condition is still rethrown. No failed poll is reclassified. Test-only injection pauses its own exact PID while reading returned poll bytes.
Undo and recovery: Revert this bounded change to restore the old exit classification. No state migration or record rewriting; queued revival, prior receipts and UNKNOWN dispatch identities remain authoritative.
Multi-machine posture: Expired owner retires and is queued as standby; successor owns intake and delivery. No new shared state. The fixture marker is machine-local test control only.
Layer below: Read worker intake and gate, stopped port binding, ownerHeld and shared lease fence, poll loop, untilStopped, ordinary lane, run-log finalization and replicated dispatch/receipt boundaries. The worker correctly refuses: the runner had failed to handle that refusal at intake.
Bug class: integration
Bug evidence: reproducer=tests/preview/two-machine-runner.test.ts
Hook bypass: none; core.hooksPath unset, common hooks directory inspected and contains sample hooks only.
Convergence: none
Decision: train-77-repair-poll-boundary | Reproduce the exact missed boundary by stalling the child while it consumes returned poll bytes, after receipt replication; preserve all assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-77-repair-205757-PROGRESS.md
Decision: train-77-repair-intake-stop | Reuse untilStopped for intake so lost ownership retires cleanly without relaxing worker admission. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-77-repair-205757-PROGRESS.md
Prompt review: No model-facing text, parser, routing or semantic judgment changes; only the caller of intake changes. Recorded model-shape replay is not needed for this ownership exit adapter.

Subject (4 paths): tests/preview/journal-agent.mjs, tests/preview/journal-cutover-ports.mjs, tests/preview/journal-due-loop.test.ts, tests/preview/two-machine-runner.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse untilStopped at the worker intake gate, exactly as existing minimal steps do. Start guard is current ownership; end is recorded retirement with queued revival; limits remain the existing stop, cap, replication and unique dispatch controls. No new mechanism, reduced ability or unattended deployed-completion claim.
80/20: Deterministic real-process regression plus existing helper neighbor controls and cheap gates; no full suite on Mama PC. Studio reruns the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
