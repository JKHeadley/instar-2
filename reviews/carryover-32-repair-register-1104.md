# Change review — Refresh correction repair register pins

Subject base: 89f222804b04ee6d36c717ea5afb1825e9dd0303
Review state: frozen
Reviewed content: sha256:a10a3ce7e8557d794628805616bcca1624138a1e590671f9d66e46798915451c
Outcome: Regenerate the register from repair commit 89f222804b04ee6d36c717ea5afb1825e9dd0303 using build-register --replay; source pins now bind the repaired implementations.
Affected rules: 5, 49, 69, 74, 90, 101, 113, 116
Affected floors: secrets — no credential or lesson text added; spend cap — no runtime change; stop — no runtime change; no duplicate sends — no runtime change; durable intake — generated views only.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Mechanical source-pin regeneration only; register schema, population and authority remain unchanged.
Side effects: Generated register and document hashes change together with their source commit.
Undo and recovery: Regenerate against the reverted implementation; never edit pins by hand.
Multi-machine posture: Deterministic generated artifacts shared through git; no machine-local runtime state.
Layer below: Delegated desk owner-manifest rehash and repin scripts, build-register replay and register wiring checker.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/register.json:1 | not-a-deferral=generated register entry wording, not postponed repair work

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: Use the existing generator and replay check. This is the simplest route and adds no mechanism or runtime behavior.
80/20: The seven generated views bind one implementation commit; lint and register:check verify the pins.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
