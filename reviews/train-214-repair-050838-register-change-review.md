# Change review — train-214 repair 050838: owner pins and register replayed at the repaired test

Subject base: 537e35c65707f5170c7435dd404be4961d51c58c
Review state: open
Reviewed content: none
Outcome: After the tool-persist reservation pin repair (7bea6b62c), lint reported "owner reference source pin trails tests/preview/tool-persist.test.ts" and register:check reported P3-NF-01 for the same file. The desk rehash (desk-rehash-owner-manifests.mjs) refreshed exactly the two register-source/owner-references/preview.json artifact hashes for tests/preview/tool-persist.test.ts; the repin chain (Linux sed form) updated 0 inventory entries. `node scripts/build-register.mjs --replay --commit 06e0709aa` then regenerated generated/; the diff is the source commit and generation stamps only: no rule, capability, term or coverage entry moved.
Affected rules: 48 and 74 (this record), 101 (plain commit, no bypass), 116 (tool-generated pins and output only)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged; generated pins and output only
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: tool-regenerated hashes and register stamps for one changed test file; no hand edit of any pin.
Side effects: none beyond the pins matching the committed test.
Undo and recovery: revert 06e0709aa and 07d41605a with this record, then re-run the rehash and replay.
Multi-machine posture: unchanged; generated files are identical on every machine for the same commit.
Layer below: scripts/build-register.mjs --replay and the desk rehash script (both unchanged).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no model-facing change.

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, reviews/train-214-repair-050838-register-change-review.md

## Closing block

simplestRobustRoute: required outcome: the owner and register pins match the committed test. Route: the delegated desk rehash and the standard replay, no hand edit.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
