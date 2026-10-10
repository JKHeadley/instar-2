# Change review — Regenerate register after retry source repair

Subject base: a4b1062e5e04586dab9420bb23f7098951b81338
Review state: open
Reviewed content: none
Outcome: Generated register and briefing pins match the committed retry source repair and inherited live briefing.
Affected rules: 26, 49, 69, 74, 78, 84, 101, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Generated metadata consumed by capability briefing and constitutional checks.
Side effects: Updates only generated source commit, generation and content hashes. No owner-manifest pins needed changes when the delegated repin scripts ran. No ability or authorization change.
Undo and recovery: Revert with the source repair, then regenerate from the intended source commit using the existing build-register command.
Multi-machine posture: Shared committed generated artifacts; each owning runner continues to project its own local resolved route.
Layer below: Existing build-register replay builder, source wiring checks and generated capability/source files.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/register.json:1 | not-a-deferral=Existing generated registry entries retain their recorded dispositions; this change only refreshes source metadata.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: regenerate through the existing register builder after committing the source. Start guard is committed source; end guard is register:check and lint; no new guard, state or authority.
80/20: Generated outputs only; final lint and register checks validate their source. Full-run proof artifacts remain the pipeline responsibility.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
