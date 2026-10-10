# Change review — Media audit register replay

Subject base: d7cad8f32796dbb7fc3fbefb65c8d25b7ad5796a
Review state: open
Reviewed content: none
Outcome: Regenerate the existing register against source commit d7cad8f32796dbb7fc3fbefb65c8d25b7ad5796a so shipped wiring pins match the media audit repair.
Affected rules: 26, 45, 69, 74, 90, 101, 111, 112, 113, 116.
Affected floors: secrets — generated content only; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Mechanical output of the existing register replay; no source policy or runtime changes.
Side effects: Generated source/generation identities change to bind the existing source graph. Owner-manifest rehash and desk chain refresh changed no pins.
Undo and recovery: Revert the audit source if necessary and rerun the existing register generator; no journal migration or authority changes.
Multi-machine posture: Deterministic generated artifacts shared through git; no machine-local or replicated state added.
Layer below: Existing build-register replay, owner-reference manifests, source inventory and check-register-wiring; all output is generated from committed source.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/register.json:1 | not-a-deferral=Existing generated register descriptions retained by mechanical replay; this change adds no deferred work.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing desk rehash/repin tools and register replay rather than hand-editing any pin. No additional mechanism.
80/20: Only seven generated artifacts changed, reflecting the source/generation identities. Final lint, register and review-record checks verify consistency.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
