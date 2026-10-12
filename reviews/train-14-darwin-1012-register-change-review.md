# Change review — Publish refreshed native harness certificate

Subject base: 92848799c3c5d3265006dc920cbde3f42024f84a
Review state: open
Reviewed content: none
Outcome: Publish the native harness certificate verified in 92848799 through the existing replay register builder.
Affected rules: Rules 26, 45, 49, 69, 74, 90, 101, 111, 113, 115 and 116.
Affected floors: secrets — no new disclosure; spend cap — no execution changes; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Generated publication follows the supported harness certificate; no hand-edited pins or behavioral changes.
Side effects: Generated source metadata and harness conformance metric now reflect committed source 92848799c3c5d3265006dc920cbde3f42024f84a. Publication remains offline replay, not runtime authority.
Undo and recovery: Revert the source with its corresponding composition and regenerate publication from that committed source. Do not hand-edit generated evidence.
Multi-machine posture: Shared generated artifacts reflect the exact Darwin runtime certificate; no new supported platform or machine-local state.
Layer below: The unchanged register builder consumes the committed declaration and its version history. Native contract proof and composition/runtime checks are recorded in reviews/train-14-darwin-1012-change-review.md and the repair PROGRESS record.
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
