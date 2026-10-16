# Change review — Publish merged train-44 composition

Subject base: ff9179cc274082be3703b3a84484eb1f27ddaec7
Review state: open
Reviewed content: none
Outcome: Publish the source and native certificate from the reviewed live train-43 merge into train-44 through the existing register generator.
Affected rules: 1, 26, 37, 49, 74, 90, 101, 105, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain existing enforcement; this is shape-only generated publication.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Seven generated register artifacts; no additional runtime or policy edits.
Side effects: Register source pins and published native conformance now describe source commit ff9179cc274082be3703b3a84484eb1f27ddaec7. No new authority or grant.
Undo and recovery: Restore a matching source composition and regenerate from its exact commit; never edit generated hashes by hand.
Multi-machine posture: Shared deterministic publication; native conformance remains bound only to its declared Darwin runtime.
Layer below: Existing build-register replay, source exact-commit validation and unchanged exact native declaration. Canonical policy equality, complete native composition and recorded delta replays are recorded in the unit PROGRESS report.
Bug class: none
Bug evidence: Publication maintenance; register replay succeeded with 292 entries, 116 rules and 34 terms.
Hook bypass: none; plain git commands, core.hooksPath unset and hooks directory inspected as samples only.
Convergence: none
Prompt review: Generated publication only; individual historical prompt dispositions are in train-44-change-review.md and train43-strip-1015-change-review.md; actual prompt bytes match live.
Decision: train44-review-publication | Replay the register from the exact source commit after native contract verification; retain shape-only authority and existing source pin checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train44-review-1015-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: use the existing register generator after the verified source commit. No new machinery. Exact source pins are the start/end guard; final lint and register check must pass before READY. No live behavior claim.
80/20: Check generated publication, required pinned consumers and change-review integrity; the pipeline owns the full suite.
VERDICT: author submission; no independent convergence or live acceptance claim
