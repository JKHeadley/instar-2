# Change review — Require complete continuity identities

Subject base: 4280e3e36db24a17bcc64ba787ca452e647aabe4
Review state: open
Reviewed content: none
Outcome: Move, restart and compaction receipts must contain two nonempty string identities that differ before any prompt is dispatched.
Affected rules: Rules 1, 4, 26, 37, 49, 70, 74, 95, 101, 102, 111, 113, 116.
Affected floors: Secrets, spend cap and stop remain host-enforced; no duplicate sends and durable intake retain their existing runner contracts. No floor changes.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Three existing exact evidence checks share a small identity predicate; no model prompt, response parser, production serving or host capability changes.
Side effects: Hosts providing missing, blank or non-string continuity identities now fail before dispatch rather than receiving false completed-stage credit. Evidenced unsupported boundaries remain available.
Undo and recovery: Revert this repair commit to restore prior checks; retain existing experiment records and reconcile unfinished intents without resending.
Multi-machine posture: Host-reported move evidence requires both machine identities, distinct, plus the existing destination-responder check. Experiment ledgers remain deliberately machine-local; no new shared state.
Layer below: Existing createDriver host boundary receipts and send admission, runner durable intents and unsupported handling, and the review counterexample in the repair brief. Constitution read in full and matches origin/main.
Bug class: unit
Bug evidence: reproducer=tests/harness-tax/runner.test.ts; exercises omitted, empty, whitespace and non-string identities on both sides, equal identities and valid distinct pairs for all three boundaries, asserting no dispatch on rejection.
Hook bypass: none; core.hooksPath unset and shared hooks directory contains samples only. Plain commits and pushes.
Convergence: none
Prompt review: No prompt or model-output parsing changes; the repair validates host transition receipts only. Existing archived-output replay remains in the targeted suite.
Decision: harness-tax-1022-repair-identities | Require nonempty string identities on both sides of the existing comparison; retain raw opaque identity comparison and evidenced unsupported outcomes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/harness-tax-1022-repair-114423-PROGRESS.md
simplestRobustRoute: Add one small predicate to the existing three pre-dispatch receipt checks. Missing prior identity falsely proves a transition today; checking both strings prevents that failure without another service, capability limit or approval. Existing target/floor preflight, bounded host calls and durable runner receipts remain the start, limit and end guards. Tests establish the adapter contract, not a live campaign outcome.
80/20: Targeted adapter/runner tests, typecheck and cheap architecture/register/review checks; no full suite or live channel sends. Independent re-review belongs to the desk.
VERDICT: author submission; no independent verdict asserted
