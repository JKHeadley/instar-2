# Change review — cint-L4: the order test expects the held correction to settle as undecided after the wedge fix

Subject base: 1d1a0314e690c2ed5363c8cb58bfcc96a98dbf7e
Review state: open
Reviewed content: none
Outcome: tests/preview/journal-integration-order.test.ts no longer asserts the pre-fix forever-held correction turn; it asserts the merged wedge fix's behavior (memoryPending and memoryUndecided set, answered with MEMORY_UNDECIDED_REPLY). Its Astra int6 MUST-FIX 1 assertions (the later loss notice is sent once while the correction is pending) are unchanged. Targeted run: the order test and the wedge test pass.
Affected rules: 10, 14, 15, 37 (a source fix of a stale assertion, no quarantine)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (the loss notice is still asserted sent exactly once); durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: one test assertion updated to match already-reviewed behavior; no source or prompt change
Side effects: none
Undo and recovery: revert the commit
Multi-machine posture: single-machine preview runner test only
Layer below: tests/preview/journal.ts settleExhaustedEdit (reviewed in reviews/unit-a2-findings-change-review.md)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

Subject (1 paths): tests/preview/journal-integration-order.test.ts

## Closing block

simplestRobustRoute: update the one stale assertion to the reviewed behavior; nothing else
80/20: 0 must-fix, 0 notes — test assertion only
VERDICT: author submission; the independent verdict is recorded as a pass
