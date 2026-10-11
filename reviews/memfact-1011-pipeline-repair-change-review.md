# Change review — Refresh memory fact source wiring

Subject base: cf7e3138aaacebc6e523399390137792c07261ff
Review state: open
Reviewed content: none
Outcome: Refresh the generated source wiring from committed memfact source cf7e3138 so the existing lint and register checkpoints can verify the memory fact implementation.
Affected rules: 26, 37, 49, 69, 70, 74, 90, 101, 111, 112, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. Only generated provenance changes; no runtime behavior or authority changes.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: The critical suggestion comes from generated register paths. This repair changes generation and source-commit metadata only, with unchanged capabilities, entries, policies and implementation.
Side effects: The seven generated projections now identify the committed memory fact source graph instead of the preceding graph. Canonical owner manifests and the grounding support inventory already match their source bytes, as verified by the delegated repin tools. No manual pin edits, new dependencies or runtime changes.
Undo and recovery: Revert this generated-output commit together with the associated source change or regenerate against the chosen committed source revision. Reverting generated metadata alone deliberately restores the stale-pin failure; retain the checking boundary.
Multi-machine posture: The regenerated artifacts are repository state shared by every checkout; no new machine-local runtime state, ownership rule or replication dependency. Verification logs are deliberately machine-local desk evidence.
Layer below: Inspected check-register-wiring source-commit comparison, build-register replay, owner reference manifests and production grounding inventory; the delegated rehash and repin tools report zero stale hashes. The failure was generated/register.json naming e35efd06 instead of the already committed memory source.
Bug class: none
Bug evidence: none; generated publication only. The existing wiring checker reproduced the stale graph; the memory implementation and its reproducer remain covered by reviews/memfact-1011-change-review.md.
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only.
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=Unchanged generated prerequisite descriptions; regeneration changes only generation and source commit metadata.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: replay the existing register generator from the committed source graph and commit its derived outputs. The stale graph is the credible failure; no new machinery is needed. Start guard is the lint rejection, end guard is lint plus register freshness, and the unchanged checkpoints preserve all five floors. This maintenance repair makes no autonomous shipped-path completion claim.
80/20: Build and typecheck passed; the two focused memory regression files passed all 24 tests, including captured uncertain, undecided and empty-reply shapes. Final lint, register freshness, architecture, review and whitespace checks are recorded in the desk progress report after the final commit. No full suite is run here. The gate produced no saved full report because it stopped at lint; missing contract evidence is recorded honestly and the pipeline supplies the full run.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
