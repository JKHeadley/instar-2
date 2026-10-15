# Change review — Publish train-31 Darwin conformance

Subject base: e4b0f85c5a23b1e9eccd7652c05cdd9caef784bd
Review state: open
Reviewed content: none
Outcome: Publish the native harness certificate verified in 1942ffe2 and the existing owning deadline repair through the replay register builder, resolving the stale source pin that failed the READY gate.
Affected rules: Rules 26, 37, 45, 49, 69, 72, 73, 74, 90, 101, 111, 113, 115 and 116.
Affected floors: secrets — no new disclosure; spend cap — no execution changes; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Generated publication follows the supported harness certificate; no hand-edited pins or behavioral changes.
Side effects: Generated source metadata and harness conformance metric now reflect committed source e4b0f85c5a23b1e9eccd7652c05cdd9caef784bd. Publication remains offline replay, not runtime authority.
Undo and recovery: Revert the source with its corresponding composition and regenerate publication from that committed source. Do not hand-edit generated evidence.
Multi-machine posture: Shared generated artifacts reflect the exact Darwin runtime certificate; no new supported platform or machine-local state.
Layer below: The unchanged register builder consumes the committed declaration and its version history. The single-owner step-check repair 6b2e6452 was integrated as e4b0f85c5a23b1e9eccd7652c05cdd9caef784bd with no source changes; the feature stays dark and its fail-closed deadline check remains enforced. Architecture still verifies the unchanged native composition certificate. Native contract proof and composition/runtime checks are recorded in reviews/train-31-darwin-1014-change-review.md and the repair PROGRESS record.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=Inherited register descriptions are mechanically replayed; this publication introduces no deferred work.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest route: regenerate dependent publication using the existing --replay --commit builder after the source contract repair. No added machinery or authority. Exact source-pin checks guard publication and native contract assertions guard the supported claim.
80/20: Only generated artifacts and this required review record change; validate lint, register check and change-review against the final committed head.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
