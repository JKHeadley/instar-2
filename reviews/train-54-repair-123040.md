# Change review — terminal delivery notice phase timing

Subject base: 2eca63491fcafafb05c68f672b06856f09a047a7
Review state: open
Reviewed content: none
Outcome: Repair the stale phase-timing regression assertion to include the existing definite-failure notice and its independently bounded attempts.
Affected rules: 13, 37, 42, 49, 55, 61, 70, 74, 101, 102, 111, 113, 116.
Affected floors: secrets — outbound checking unchanged; spend cap — reservations unchanged; stop — admission unchanged; no duplicate sends — assert one UNKNOWN attempt and exactly two proven-not-sent attempts per distinct intent; durable intake — journal and replay unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test-only correction for accepted delivery-failure behavior; no model-facing or runtime change.
Side effects: The test now expects a separate definite-failure notice after two proven-not-sent answer attempts, and checks its own attempt counters restart at one. Exact send and measurement arrays after a second drain retain coverage against extra retries or recursively generated notices. UNKNOWN retains one attempt for each distinct intent and uncertain wording.
Undo and recovery: Revert the test and review record; no product state changes or migration. Reversion restores the stale failing assertion.
Multi-machine posture: Offline test-local journals and injected transport outcomes only; conversation ownership and replicated durable notice identity remain unchanged.
Layer below: Read journal.ts dispatch NOT_SENT_ATTEMPTS, send-outcome settlement, noticeFailedReplies and the delivery-failure-notice regression tests. The existing worker converts exhausted not-sent into refused and separately dispatches the durable notice through the same bounded send path.
Bug class: integration
Bug evidence: reproducer=tests/preview/phase-timing.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: train54-phase-notice-expectation | Correct the timing test to cover the accepted separate refusal notice and its counters, preserving exact UNKNOWN and not-sent retry bounds instead of changing runtime behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-54-repair-123040-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: update the stale exact expectations in one test, using existing notice constants and retaining both transport-outcome neighbors. The reproduced gate failure guards entry, exact per-intent attempts preserve the no-duplicate and bounded-action limits, and targeted regression plus required cheap checks guard submission. No new machinery or unattended live completion claim.
80/20: Repair the single demonstrated assertion failure with targeted red-to-green evidence; preserve the Studio full-suite gate and all retained release duties.
VERDICT: author submission; no independent verdict or live acceptance claimed
