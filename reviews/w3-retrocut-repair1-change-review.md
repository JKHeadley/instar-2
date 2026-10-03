# Change review — w3-retrocut repair 1: register replay after the evidence correction

Subject base: f4e386a937eeb5cb9f8baa0d2b7b9f36a1809dd9
Review state: open
Reviewed content: none
Outcome: Astra's unit review of w3-retrocut returned NO on one must-fix: the review record and PROGRESS said the final new test file had 8 failing / 4 passing tests on parent 569bcf52, while an independent run of that exact revision on the parent gives 7 failing / 5 passing, one of the seven failing only because the new rowMissingReason helper is absent. f4e386a9 corrects that evidence in reviews/w3-retrocut-change-review.md (and adds the omitted Rules 104, 108 and 111, the reviewer's NOTE 1); the PROGRESS record is corrected outside the tree. This commit is the register replay that follows: the source wiring pin trailed tests/preview/retrospective.ts from ca4e87ff, so generated/ is regenerated with scripts/build-register.mjs --replay at f4e386a9. No source, test or prompt file changes.
Affected rules: 74 (this record), 37 (lint and register check green after the replay), 42 (the evidence now states what a run on the parent actually shows), 101 (no hook bypass), 116 (regenerated output only)
Affected floors: secrets — unchanged (generated register output only); spend cap — unchanged (no model call); stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: regenerated register output with no source change; the suggested tier reflects the generated files' paths, not a behavior change.
Side effects: none beyond the regenerated register pinning the current sources.
Undo and recovery: revert this commit and this record, then replay the register.
Multi-machine posture: unchanged.
Layer below: read and unchanged. scripts/build-register.mjs replay mode and scripts/check-register-wiring.mjs.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: the required behavior is a register that pins the committed sources; the simplest route is the existing replay command, run once, with no hand-edited pin.
80/20: 1 must-fix taken (the failing-on-parent evidence corrected to 7 failed / 5 passed, with the helper-availability failure distinguished), 0 residues.
VERDICT: author submission; the independent verdict is recorded as a pass
