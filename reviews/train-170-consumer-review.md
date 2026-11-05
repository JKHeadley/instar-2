# Change review — train-170 correction review consumer fixtures

Subject base: 5a9d2b1c20aa04116f452b499d049d91766b3d5b
Review state: open
Reviewed content: none
Outcome: Update three existing retrospective consumers for the reviewed row32 class-review requirement and added prompt clauses while preserving their original budget, historical-capture and promise-drain assertions.
Affected rules: 4, 26, 34, 36, 37, 42, 49, 70, 74, 85, 101, 102, 111, 113, 116
Affected floors: secrets — no production change; spend cap — existing bounds retained; stop — unchanged; no duplicate sends — unchanged and tested by recorded promise replay; durable intake — retained recorded journals and test-world persistence.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test fixture compatibility only; no runtime source, provider input, parser, admission rule, timeout or cap changes.
Side effects: Historical cap reconstruction removes only explicitly enumerated later clauses and still requires the original captured hash. The feedback test now uses a recorded correction and saved independent review; feedback alone is refused. The promise fixture supplies the new required class judgments and proves their absence remains owed.
Undo and recovery: Revert these three test edits to recover the old assumptions and their four reproduced failures; product behavior and stored journals are unaffected.
Multi-machine posture: Isolated test journals and recorded fixtures only; no new shared or local production state.
Layer below: Read row32 retrospective class-review validator and instance-fix admission, correctionWorld fixtures, actual captured October 17 prompt hashes and October 15 promise journal. Original historical capture bytes remain unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: tests/preview/retrospective-promises.test.ts:122 | not-a-deferral=assertion of the durable missing-class-review outcome; no repair work is postponed

Subject (3 paths): tests/preview/retrospective-cap.test.ts, tests/preview/retrospective-first-pass-fit.test.ts, tests/preview/retrospective-promises.test.ts

Decision: train-170-consumers | Adapt three older test producers and historical prompt reconstruction to the reviewed correction protocol; preserve negative cases and actual capture hashes, with no product-source edits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-170-PROGRESS.md

Validation: Four failing assertions in retrospective-cap, retrospective-first-pass-fit and retrospective-promises were reproduced in chunks 13b/14a. Typecheck passes; repaired files and final gate results are recorded in the progress report.

## Closing block

simplestRobustRoute: Update the existing three consumers to provide the reviewed protocol evidence and account for known prompt additions. This is the simplest robust route; it adds no runtime mechanism or weakened assertion. Negative review evidence stays refused, historical hashes stay exact, and resource guards are unchanged.
80/20: Keep the four observed failures as red evidence, rerun the three repaired files and required final gates, and retain the complete direct-consumer sweep.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
