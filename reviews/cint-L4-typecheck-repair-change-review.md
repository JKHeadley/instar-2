# Change review — cint-L4 repair: backfill test fixture carries the full ModelUsage shape

Subject base: c97614ecc99832e3e418621f5c19abd8eed6b580
Review state: open
Reviewed content: none
Outcome: the Mama PC gate stopped at tsc: the lost-index-result test's fake model returned usage without the required charge field. The fixture now returns charge: null with a literal inputComplete, matching every other preview fixture and the journal's ModelUsage type. Test-only; no source, prompt or projection change.
Affected rules: 37, 74, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: one test fixture literal gains a field its declared type already requires
Side effects: none outside the test; the typecheck gate step passes again
Undo and recovery: revert this commit
Multi-machine posture: not applicable, test fixture only
Layer below: tests/preview/journal.ts ModelUsage type and the createJournalWorker model contract
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

Subject (1 paths): tests/preview/journal-meaning-backfill.test.ts

## Closing block

simplestRobustRoute: add the missing required field at the fixture; no type loosening or cast (Rule 116).
80/20: tsc --noEmit passes and the touched test file passes (3/3) under a targeted vitest run.
VERDICT: author submission; the independent verdict is pending
