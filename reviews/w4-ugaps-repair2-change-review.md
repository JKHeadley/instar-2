# Change review — w4-ugaps repair round 2: the blocking-site binding test types its fixtures as Json so the typecheck passes

Subject base: 11bf01470dfc64ef7d716940c89de82e3ea2b157
Review state: open
Reviewed content: none
Outcome: Unit review round 2 (Astra, VERDICT NO) named one must-fix: tests/preview/blocking-site-binding.test.ts typed its declaration facts, rungs and patches as `Record<string, unknown>`, which cannot satisfy the `Json` arguments of `bindPreviewBlockingSites`, so `tsc --noEmit` exited 2 (TS2345 at line 19, six TS2322). The test now imports the existing `Json` type and uses `Record<string, Json>` for those three places. Reproduced: the prior file fails tsc 5.9.3 with those errors; the fixed file passes tsc with exit 0 and the test's four cases pass. No production code, assertion or runtime behaviour changes.
Affected rules: 37 (the gate regression is fixed at its source; nothing quarantined), 34 (the binding test keeps both sides and now typechecks), 74 (this record), 101 (plain commit, no bypass), 116 (a type substitution, no new machinery)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: a test-only type annotation change; no source, declaration or register content changes.
Side effects: none outside the test file's types.
Undo and recovery: revert this commit and this record.
Multi-machine posture: machine-local, unchanged.
Layer below: the `Json` value type in src/types/values.ts, which `bindPreviewBlockingSites` already takes.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: not model-facing: no prompt, model-output parser, or decision on model output changes.

Subject (1 paths): tests/preview/blocking-site-binding.test.ts

## Closing block

simplestRobustRoute: substitute the existing `Json` type for `unknown` in the test's three fixture types, exactly the reviewer's smallest fix; no suppression, cast or API change.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
