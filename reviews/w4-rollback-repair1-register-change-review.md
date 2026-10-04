# Change review — w4-rollback repair 1: register replayed at the repaired source

Subject base: d8cd22af7572bf5f033ab9c8f2a2f85f31e7e7f4
Review state: open
Reviewed content: none
Outcome: The register's source pin trailed tests/preview/journal.ts after repair 1 (lint: "source wiring pin trails tests/preview/journal.ts"). The desk rehash and repin chain found nothing to change, and `node scripts/build-register.mjs --replay --commit d8cd22af` regenerated generated/. The diff is the source commit and register generation stamps only: no rule, capability, term or coverage entry moved.
Affected rules: 48 and 74 (this record), 101 (plain commit, no bypass), 116 (generated output only)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged; generated output only
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: regenerated output; the only differences are the source commit and generation hash lines, and no hand edit was made.
Side effects: none beyond the pin now matching the committed source.
Undo and recovery: revert the commit and this record, then re-run the replay.
Multi-machine posture: unchanged; generated files are identical on every machine for the same commit.
Layer below: scripts/build-register.mjs --replay (unchanged).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no model-facing change.

Subject (8 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/w4-rollback-repair1-register-change-review.md

## Closing block

simplestRobustRoute: required outcome: the register pin matches the committed source. Route: the standard replay, no hand edit.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
