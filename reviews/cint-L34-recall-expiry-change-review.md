# Change review — cint-L34 pipeline repair: the recall sample's trial end lies far past any real run

Subject base: fbb36b224b20c398ff7c12346ecc351f4edd73d6
Review state: open
Reviewed content: none
Outcome: Three cases in tests/preview/real-model-recall-sample.test.ts failed in the cint-L34 full run with 'preview stopped' (or no provider heartbeat, because the SIGTERM child exited on the same throw). Cause: the fixture journal's genesis set expires to NOW + 1_000_000_000 (2026-10-03T04:00Z) while the worker reads the wall clock, so once real time passed that instant every intake hit the journal's expiry gate. The genesis now uses a FAR_FUTURE end (NOW + 100 years); the fixture hash, assertions and journal gate are unchanged. tsc exits 0; the test file passes 4/4 (targeted run); lint and register:check exit 0. No src/ file changed.
Affected rules: 37 (fixed at its source, no quarantine), 74 (this record), 101 (plain commit, no hook bypass), 116 (one constant in the fixture)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged (the SIGTERM case again proves the provider child is reaped); no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: a test-fixture date correction; no runtime, send, approval or intake path changes
Side effects: none
Undo and recovery: revert the repair commit and this record
Multi-machine posture: unchanged
Layer below: reviews/cint-L34-pipeline-repair-change-review.md
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no model-facing text changes; the only hunk is the fixture genesis's expires value. The recall question text, packet builder and scoring are untouched, no phrase was copied from a test input into a prompt (fixture-trigger check), and dispatch stays neutral; no system prompt, provider policy or invocationPolicyDigest changed.

Subject (1 paths): tests/preview/real-model-recall-sample.ts

## Closing block

simplestRobustRoute: move the fixture's trial end beyond any plausible wall clock instead of injecting a fake clock into the worker
80/20: 0 must-fixes, 1 note (targeted tests only; the full gate reruns on the Mama PC)
VERDICT: author submission; the independent verdict is recorded as a pass
