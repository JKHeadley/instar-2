# Change review — Publish register from merged Jev and live memory sources

Subject base: b3fc1a0440774f7c76e74e5ca71571037f883a37
Review state: open
Reviewed content: none
Outcome: Regenerate all seven register publications from merge b3fc1a0440774f7c76e74e5ca71571037f883a37 so both Jev admission and live journal compatibility are pinned.
Affected rules: Rules 26, 37, 49, 69, 74, 90, 101, 111, 112, 113 and 116.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Generated governance publications bind the exact merged source; existing generator and register check validate them.
Side effects: Derived source hashes and generation metadata advance together; capabilities, rules and authority remain unchanged.
Undo and recovery: Regenerate publications after reverting the associated source change; never hand-edit a pin.
Multi-machine posture: Repository publication only; every checkout uses the same source-bound register. No runtime state, ownership or replication change.
Layer below: Existing build-register replay, register-source declarations and owner manifests. Delegated rehash and repin scripts reported zero owner and inventory changes. Regeneration from the committed two-parent merge covers both source histories.
Bug class: none
Bug evidence: none
Hook bypass: none; checked core.hooksPath unset and shared hooks directory sample files only.
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/register.json:1 | not-a-deferral=Existing registered document prose serialized by the generator; this publication adds no deferred work.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: regenerate derived publications with the existing generator after merging source. It prevents stale source bindings without new machinery. Start guard is committed source; end guard is lint and register verification; no safety floor or capability changes.
80/20: Only the seven generated publications and this author review change. The final cheap checks validate source coherence; the pipeline supplies independent acceptance and the full run.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
