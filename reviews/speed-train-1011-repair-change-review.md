# Change review — Align recorded canary replay with verified audience routing

Subject base: 2447ba448db9a076cc92bca75d6a8f5ad6c66297
Review state: open
Reviewed content: none
Outcome: Repair the stale canary replay expectation after verified operator-only Jev routing was merged; retain both captured completed reviewer outputs through the unverified-audience control.
Affected rules: 26, 28, 34, 36, 37, 49, 57, 70, 74, 86, 95, 101, 111, 112, 113, 116; purpose least revelation and checkpoint-preserved ability.
Affected floors: secrets — unchanged outbound guard; spend cap — unchanged reservations; stop — unchanged checkpoints; no duplicate sends — unchanged durable intents; durable intake — unchanged journal. Only test and review text change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only integration repair with no production code, prompt, parser, routing or fixture mutation.
Side effects: An accidental second reviewer call or reservation for the original verified audience now fails explicitly. Both captured seven-finding reviewer outputs still traverse escalation under explicitly changed audience standing. Malformed findings and extra known violations remain tested.
Undo and recovery: Revert this test/review commit. No runtime state, migration or deployment to undo.
Multi-machine posture: Test-only and machine-independent; no runtime state or ownership change. Verification logs remain deliberately desk-local.
Layer below: Inspected checkReply, confidentReplyNeedsReview, the captured audience and Jev scores, and operator-group-cascade tests. The exact true operatorOnlyVerified value on a telegram-group-topic admits a confident Jev pass; other audiences retain contextual sensitivity review.
Bug class: integration
Bug evidence: reproducer=tests/preview/canary-review-replay.test.ts; original run failed with Jev versus subscription mismatch; repaired run passes 10 tests.
Hook bypass: none; checked core.hooksPath (unset) and common hooks directory (sample files only).
Convergence: none

Subject (1 paths): tests/preview/canary-review-replay.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: correct the stale test and preserve the existing real-output parser exercise with a labeled audience control. No added runtime mechanism. Start guard is recorded audience and actual Jev scores; end guard asserts decision and zero extra calls; opposite standing still escalates. Existing secrets, cap, stop, duplicate-send and intake floors stay intact. No autonomous live-completion claim.
80/20: Fix the single reproduced source mismatch and verify its two audience branches, existing parser boundaries, compiler and required gates. Submit to independent pipeline review; no author convergence claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
