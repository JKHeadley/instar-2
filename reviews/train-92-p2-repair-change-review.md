# Change review — Preserve historical train-12 prompt evidence

Subject base: 15a6bf0f5cb7eaac95e87e2db022eade541506cf
Review state: open
Reviewed content: none
Outcome: Replay the immutable train-12 captures against their historical system prompt while preserving the current removal of the one-machine send restriction.
Affected rules: 36, 37, 49, 58, 70, 74, 101, 103, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only historical expectation repair; no shipped prompt, parser, authority or runtime change.
Side effects: The replay now reconstructs the retired sentence at its original position. Exact equality still detects any other historical prompt drift, and a negative assertion prevents reintroducing the restriction into the current prompt. Captured failures and their judgments remain unchanged.
Undo and recovery: Revert this test-only commit; no state or installation migration is involved.
Multi-machine posture: Deterministic test behavior on every host; no new state, ownership or transport behavior.
Layer below: Compared the production tools prompt with both system strings in the immutable train-12 fixture. Inspected the existing requested-work guidance translations, readAnswer path and journal-rendered answer assertions.
Bug class: integration
Bug evidence: reproducer=tests/preview/train-12-capability-replay.test.ts
Hook bypass: none
Convergence: none

Subject: tests/preview/train-12-capability-replay.test.ts

Evidence: The targeted file reproduced the reported exact-prompt mismatch before repair and passed after repair (1 test). The replay runs recorded updates 715675606 and 840342414 through readAnswer and the journal worker, preserving the original paraphrase FAIL, malformed-key run 75 FAIL and structured-reply run 73 PASS. npm run build passed. No model-facing behavior changed and no new inference or live deployment acceptance is claimed.

## Closing block

simplestRobustRoute: Extend the existing historical expectation translation by the single retired sentence and assert its absence from today's prompt; this is the simplest robust route, with no runtime machinery and all safety floors untouched.
80/20: Reproduce the exact failure, rerun the touched replay file and TypeScript checks, then run the required cheap gates; the pipeline owns the full Studio run.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
