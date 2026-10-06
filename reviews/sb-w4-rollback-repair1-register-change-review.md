# Change review — sb-w4-rollback repair 1: register replayed at the repaired source

Subject base: 8ef4fa6f85929aac5b194f39ee56ce268a1cf903
Review state: open
Reviewed content: none
Outcome: The register's source pin trailed scripts/resource-owner.mjs after repair 1 (`npm run register:check`: "P3-NF-01: source pin trails scripts/resource-owner.mjs; commit source changes and regenerate"). The desk owner-manifest rehash refreshed 0 pins in every manifest and the repin chain updated 0 inventory entries, so no owner reference moved; `node scripts/build-register.mjs --replay --commit 8ef4fa6f85929aac5b194f39ee56ce268a1cf903` regenerated generated/ and `--check` is now true (generation sha256:4d21b69c1ab5928ffbb8e9f656762f13caedd4e95242ef9e4f1ddef47a3437c5, 281 entries, 116 rules). The diff is the source commit and generation stamps only: no rule, capability, term or coverage entry moved.
Affected rules: 48 and 74 (this record), 101 (plain commit, no bypass), 116 (generated output only)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged; generated output only
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: regenerated output; the only differences are the source commit and generation hash lines, and no hand edit was made.
Side effects: none beyond the pin now matching the committed source.
Undo and recovery: revert the commit and this record, then re-run the replay.
Multi-machine posture: unchanged; generated files are identical on every machine for the same commit.
Layer below: scripts/build-register.mjs --replay (unchanged); reviews/sb-w4-rollback-repair1-change-review.md.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no model-facing change.

Subject (8 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/sb-w4-rollback-repair1-register-change-review.md

## Closing block

simplestRobustRoute: required outcome: the register pin matches the committed source. Route: the delegated desk rehash and repin chain, then the standard replay; no hand edit.
80/20: register:check true; 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
