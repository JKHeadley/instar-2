# Change review — reply-noise-1108 repair register replay

Subject base: 4e584bd0bd8a22c5627253148256479609b1128c
Review state: open
Reviewed content: none
Outcome: The generated register is replayed from the committed sources at 4e584bd0 (node scripts/build-register.mjs --replay --commit), so its source pins follow tests/preview/harness-login-pool.mjs and tests/preview/journal.ts as reply-noise-1108 and its repair left them. Before this, lint and register:check failed only on "source pin trails tests/preview/harness-login-pool.mjs"; after it both exit 0. No generated file was hand-edited.
Affected rules: 69, 90 (register replayed from committed sources, never hand-edited), 74 (this record), 116
Affected floors: secrets — unchanged, generated output names no credential; spend cap — unchanged, no model call; stop — unchanged; no duplicate sends — unchanged, no send path; durable intake — unchanged, no intake or journal change
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Generated output only, produced by the existing replay tool from already-reviewed committed sources; it adds no behavior of its own.
Side effects: The register's commit and source digests now name 4e584bd0. The owner-reference manifests and the grounding inventory were re-run with the desk repin tools and needed no change.
Undo and recovery: Revert this commit and replay the register at the restored head.
Multi-machine posture: Machine-independent; generated files are deterministic from the committed sources.
Layer below: scripts/build-register.mjs --replay and scripts/check-register-wiring.mjs (the source pin comparison against register.commit); desk-rehash-owner-manifests.mjs and desk-repin-chain.sh from lanes (0 pins refreshed, inventory updated 0).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Prompt review: no prompt text changed.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: Replay the register with the existing tool from committed sources; nothing is hand-edited and no new machinery is added.
80/20: lint and register:check exit 0 after the replay; this record covers only generated output.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
