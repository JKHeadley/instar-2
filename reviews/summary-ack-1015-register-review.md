# Change review — summary acknowledgement register pins

Subject base: 8b43b7abbd9f43a05cb22225e3c3c70d8c0e6519
Review state: open
Reviewed content: none
Outcome: Generated register and capability provenance pin the committed summary acknowledgement repair.
Affected rules: 5, 26, 49, 69, 74, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; this offline replay publishes no runtime authority.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Deterministic source and generation references only, produced by the existing register generator.
Side effects: Generated artifacts name the new source commit and generation; capability wording and runtime behavior are unchanged.
Undo and recovery: Regenerate from the source commit selected for rollback; do not hand-edit a pin.
Multi-machine posture: All installations read the same committed generated artifacts; no new machine-local state.
Layer below: Existing build-register generator and committed source inventory; generated differences are commit/generation references only.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest route: regenerate the existing artifacts from the exact committed source so the existing wiring checks can validate it. No new machinery or authority, and no autonomous completion claim.
80/20: Inspect generated differences and run the existing lint, register and pinned-text checks. The desk owns independent acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
