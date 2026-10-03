# Change review — cint-L34 pipeline repair: type the renewal-result test's send port to the funnel's optional target

Subject base: 0e299f20ed24e26c023dc68146c7b103c4c9b600
Review state: open
Reviewed content: none
Outcome: The cint-L34 full test run stopped at typecheck: tests/preview/renewal-result-send-outcome.test.ts (added in c91ecc98) typed its stub send port's input as `{ target: string; ... }`, but PreviewPorts.send takes `target?: string`, so tsc refused both stubs (lines 56 and 115). The two stubs now accept `target?: string` and read `input.target ?? ''`; the assertions are unchanged. tsc exits 0; the test passes 3/3 (targeted run); lint, register:check exit 0. No source file changed.
Affected rules: 37 (fixed at its source, no quarantine), 74 (this record), 101 (plain commit, no hook bypass), 116 (a two-line type correction in the test only)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (the test still proves one extra dispatch only on a not-sent proof); durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: a test-only type correction; no runtime, send, approval or intake path changes
Side effects: none
Undo and recovery: revert the repair commit and this record
Multi-machine posture: unchanged
Layer below: reviews/cint-L34-change-review.md (the combine and the test it added)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

Subject (1 paths): tests/preview/renewal-result-send-outcome.test.ts

## Closing block

simplestRobustRoute: match the stub's parameter type to the port's declared optional target; no source, checker or assertion edit
80/20: 0 must-fixes, 1 note (targeted tests only; the full gate reruns on the Mama PC)
VERDICT: author submission; the independent verdict is recorded as a pass
