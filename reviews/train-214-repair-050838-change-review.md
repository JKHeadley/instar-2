# Change review — train-214 repair: derive the recovered resume's reservation pin from the tool limits

Subject base: b2df997e8ecdf8f29bb98bbd2ea8a72703886075
Review state: open
Reviewed content: none
Outcome: Repairs the one failure of train-214's m5pro full run (head b2df997e): tests/preview/tool-persist.test.ts "recovers the recorded zero-work rejected resume once" expected [15, 30, 46] calls at each invocation and saw [73, 146, 220]. Cause: helper-limits-1107 (8e80381b2) raised SUBSCRIPTION_TOOL_LIMITS.childMaxTurns from 4 to maxToolCalls + 1 = 33, so each tool turn reserves maxTurns-1 + maxChildren x childMaxTurns = 7 + 2 x 33 = 73 calls before dispatch (the recovery adds its own base call: 3 x 73 + 1 = 220). The live-build merge brought this test in still pinned on the old bound. The received values are exactly the intended reservation; the pin is now derived from SUBSCRIPTION_TOOL_LIMITS, as tool-turn.test.ts and native-loop.test.ts already are. No source file changes.
Affected rules: 37, 114, 116
Affected floors: secrets — unchanged; spend cap — unchanged, the test still asserts every invocation's whole liability is reserved before dispatch, now in terms of the limits it is computed from; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: a test expectation only; no source, prompt, policy or certificate changes.
Side effects: none at runtime; the test now follows any later change to maxTurns, maxChildren or childMaxTurns instead of breaking on it.
Undo and recovery: revert 7bea6b62c.
Multi-machine posture: machine-local; a test pin, no state or store.
Layer below: tests/preview/tool-turn.mjs runToolTurn's 'reserved' row (extra + children x childMaxTurns + recovery base) and toolChildrenFit, which holds two helpers at every invocation under this test's 400-call genesis allowance (third invocation: floor((400 - 146 - 1 - 14 - 1) / 33) = 7, capped at 2).
Bug class: unit
Bug evidence: reproducer=tests/preview/tool-persist.test.ts
Hook bypass: none
Convergence: none
Decision: t214r-derived-pin | express the reservation pin as liability, 2 x liability, 3 x liability + 1 from SUBSCRIPTION_TOOL_LIMITS rather than re-pinning [73, 146, 220], because helper-limits-1107 made the bound a derived number and the sibling tests already assert it that way | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-214-repair-050838-PROGRESS.md

1.x comparison: inherited from reviews/helper-limits-1107-change-review.md (JKHeadley/instar main 40676770f5d3, inspected 2026-11-07): 1.x src/core/SessionManager.ts launches Claude Code with no --max-turns or --agents bound, so 1.x has no per-turn call reservation to pin; this repair only aligns a 2.0 test with the 2.0 reservation that carryover introduced. 1.x main head on 2026-11-08 is 024bfde34dc4; a code search there for childMaxTurns returned no result.

Verification: tests/preview/tool-persist.test.ts 40 passed, 1 skipped (the skip is a different case); the repaired case run alone with -t passes; npx tsc --noEmit exit 0; git diff --check clean.

## Closing block

simplestRobustRoute: change one expectation to the formula the code computes; no source change, no quarantine.
80/20: the full run's only failure, fixed at its source (a stale pin), and protected against the next bound change.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
