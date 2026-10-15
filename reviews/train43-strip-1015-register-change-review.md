# Change review — Publish restored train-43 policy composition

Subject base: fc517acbde867587cd1f6f4532b4d83d782c9878
Review state: open
Reviewed content: none
Outcome: Publish the source and native certificate from the scoped completion-guidance rollback through the existing register generator.
Affected rules: 1, 26, 37, 49, 74, 90, 101, 105, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain existing enforcement; this is shape-only generated publication.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Seven generated register artifacts; no additional runtime or policy edits.
Side effects: Register source pins and published native conformance now describe source commit fc517acbde867587cd1f6f4532b4d83d782c9878. No new authority or grant.
Undo and recovery: Restore a matching source composition and regenerate from its exact commit; never edit generated hashes by hand.
Multi-machine posture: Shared deterministic publication; native conformance remains bound only to its declared Darwin runtime.
Layer below: Existing build-register replay, source exact-commit validation and renewed native declaration. Owner-manifest rehash and grounding repin changed zero pins. Canonical policy equality and native 10/10 proof are recorded in the source change review.
Bug class: none
Bug evidence: Publication maintenance; register replay succeeded with 292 entries, 116 rules and 34 terms.
Hook bypass: none; plain git commands, core.hooksPath unset and hooks directory inspected as samples only.
Convergence: none
Prompt review: Generated publication only; source prompt rollback and real recorded replay evidence are in train43-strip-1015-change-review.md.
Decision: train43-strip-publication | Replay the register from the exact source commit after native contract renewal; retain shape-only authority and existing source pin checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train43-strip-1015-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: use the existing register generator after the verified source commit. No new machinery. Exact source pins are the start/end guard; final lint and register check must pass before READY. No live behavior claim.
80/20: Check generated publication, required pinned consumers and change-review integrity; the pipeline owns the full suite.
VERDICT: author submission; no independent convergence or live acceptance claim
