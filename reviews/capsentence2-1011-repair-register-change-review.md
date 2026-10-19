# Change review — Regenerate provenance after the capability replay repair

Subject base: 86310aad8c7ac7e93b90f611e5d0aaedf31238dc
Review state: open
Reviewed content: none
Outcome: Publish register provenance generated from the exact capability replay repair source commit 86310aad8c7ac7e93b90f611e5d0aaedf31238dc.
Affected rules: 49, 69, 74, 78, 84, 101, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Deterministic regeneration changes generation/source and entry base metadata only; no inventory, capability or authority change.
Side effects: Generated publications cite the new exact source commit. Their declared capabilities, authority and register inventory are unchanged.
Undo and recovery: Regenerate from the reverted source commit using the existing register builder; never hand-edit generated pins.
Multi-machine posture: The same source commit produces the same shared publications on every machine; no runtime state, ownership or replication change.
Layer below: Existing register-source and owner manifests; the build-register replay output; source instruction and fixture changes reviewed in capsentence2-1011-repair-change-review.md.
Bug class: none
Bug evidence: none
Hook bypass: none; plain git commit
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/register.json:1 | not-a-deferral=Generated register declarations preserve existing commitment vocabulary; this change defers no work.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: regenerate existing publications from the exact source commit and run existing wiring/register checks; no new mechanism.
80/20: Cheap checks and the required pinned targeted tests; the pipeline owns the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
