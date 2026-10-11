# Change review — Keep recorded self-description replay aligned with the review reasoning budget

Subject base: e86ab199ac88bc22fe39b2202c87e1ce753cee63
Review state: open
Reviewed content: none
Outcome: The recorded self-description replay compares its historical review prompt against the current bounded-reasoning protocol without changing recorded rules, packet contents or verdict assertions.
Affected rules: 36, 37, 49, 70, 74, 101, 111, 112, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged, existing review reasoning budget retained; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. This is a test-only repair.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Updates two historical prompt-protocol translations in one existing regression test; no runtime change.
Side effects: Historical prompt replay now accounts for the concise reasoning instruction and the existing 400-character taskFields parameter. Exact prompt equality continues checking every rule and guide; fixture bytes and pass/violation neighbors remain unchanged.
Undo and recovery: Revert this commit to restore the previous assertion; no state or data migration is involved.
Multi-machine posture: Machine-independent test assertions over committed captures; no runtime behavior or shared state changes.
Layer below: Inspected replyReviewQuestion, taskFields, REPLY_REVIEW_REASONING_CHARS, recorded round-two input/output pairs, and the prior review-budget repair. The mismatch is solely the test adapter omitting the already-shipped reasoning-budget protocol.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

Subject (1 paths): tests/preview/selfdesc-limits.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: update the existing historical protocol translation and reuse the exported budget constant. No helper, new gate, fixture rewrite, skip or runtime mechanism is needed. The existing exact equality is the end-state guard; recorded pass and violation neighbors preserve the semantic limits.
80/20: All six affected tests pass with one worker at nice 10. TypeScript and final committed-tree cheap-gate evidence are recorded in the absolute lanes PROGRESS; the automatic pipeline owns the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
