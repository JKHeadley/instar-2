# Change review — cint-L6: bound the round5 cut-worker children so a stalled spawn names its phase

Subject base: ea045a3054cc60e8ef2deddb2da9a101d3781ece
Review state: open
Reviewed content: none
Outcome: The cint-L6 gate on the Mama PC failed one case, A2-E2E R5-F02 unknown stream fsync:3 cut, with a 20 s test timeout. The same file passed in all seven earlier gates (slowest case 3.3 s), and the case passes alone in about 1.7 s, so a spawned vite-node child stalled under full-suite load. The test's run() helper waited on each child with no limit, so a stall produced an opaque timeout. Each child now has a 25 s deadline that SIGKILLs exactly that child and rejects with scenario, mode, cut and stderr. The case budget covers two serial children (55 s), in line with the suite's other spawn-heavy e2e cases, which take 50-150 s under load. Both sides are proven: with the deadline forced to 50 ms the case fails with "unknown-stream seed fsync:3 child stalled past 50ms"; at 25 s all 24 cases pass.
Affected rules: 2, 37, 74, 116 (37: source fix in the test harness, no quarantine; 116: one timer per child, no retry machinery)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: test-harness timing only; no src/ or production path change
Side effects: a truly hung child now fails in 25 s with its phase named instead of 20 s with no detail
Undo and recovery: revert the commit to restore the unbounded child wait and 20 s case timeout
Multi-machine posture: test-only; no shared state
Layer below: tests/harness-adapters/a2-round5-cut-worker.ts (unchanged)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed; the system prompt is unchanged

Subject (1 paths): tests/e2e/harness-adapters-round5-regression.test.ts

## Closing block

simplestRobustRoute: bound each spawned child with a named-phase deadline and size the case budget to two children; nothing else
80/20: 0 must-fix, 0 notes — one test-harness timing change
VERDICT: author submission; the independent verdict is recorded as a pass
