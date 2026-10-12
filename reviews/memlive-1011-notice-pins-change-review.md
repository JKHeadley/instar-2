# Change review — publish historical-notice compatibility source pins

Subject base: 4adcd102ba54e144554a5d8b183cf6f0a7aee61e
Review state: open
Reviewed content: none
Outcome: Publish the existing register generation from the historical-notice compatibility source commit so source wiring verifies the repaired journal.
Affected rules: Rules 26/37/49/69/74/90/101/111/112/113/116.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Generated provenance for the repaired runtime source; use the existing replay generator and verify exact source wiring.
Side effects: Seven generated publications change only their source commit, generation and source wiring digests. No declaration, authority, roster, capability or runtime behavior is added.
Undo and recovery: Regenerate publications from the reverted source commit if the associated source repair is reverted. Never hand-edit a pin.
Multi-machine posture: Versioned source publications are identical across machines; runtime ownership and replicated journal semantics remain unchanged.
Layer below: The delegated owner-manifest and assembly-chain tools reported zero changed pins. The existing build-register replay from 4adcd102ba54e144554a5d8b183cf6f0a7aee61e produced generation sha256:f2218f9bdc84e13adcd95d9c7231d8d2cb0f30224a30c9271a756f01bef43efc, with 289 entries, 116 rules and 34 terms. Source wiring and register checks validate the generated result.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=Unchanged registered prerequisite descriptions in generated source publication; this change adds no deferral.
Verification: Runtime regression and captured-shape replay passed 40 tests before publication. Final-head lint, register check, change-review check, pinned-text tests and whitespace checks are recorded in the absolute desk progress report. All eleven saved-result contract checks passed in their original gate worktree at 208a222111a384b04db9bff4ab7f02ba7d452703; copying that report to a different checkout cannot supply its root/revision-bound execution receipts. No fresh full-suite evidence is claimed.

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing register replay generator to publish source provenance. No manual pins or new machinery. The compatibility repair and its start, end and limit guards are reviewed in memlive-1011-notice-compat-change-review.md.
80/20: Only generated provenance needed by lint changes; the existing checks validate it. Independent acceptance and a fresh full gate remain with the pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
