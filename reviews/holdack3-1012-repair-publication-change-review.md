# Change review — Publish repaired acknowledgement source

Subject base: d95451a8e9268235d673de4674356e0bb3cb8ea1
Review state: open
Reviewed content: none
Outcome: Generated register publication points at the committed acknowledgement repair and regenerated host-test owner pin.
Affected rules: Rules 49/69/74/90/101/111/113/116.
Affected floors: secrets — no credential changes; spend cap — no runtime change; stop — no runtime change; no duplicate sends — no runtime change; durable intake — no runtime change.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Generator output only; the critical runtime repair is reviewed in holdack3-1012-repair-change-review.md.
Side effects: Publication generation identity changes; checks and consumers continue to use the existing register format.
Undo and recovery: Revert source and regenerate publication using the same scripts. Never hand-edit a pin.
Multi-machine posture: Same committed publication on each installation; no new machine-local state.
Layer below: Desk owner rehash refreshed exactly one host-test hash; inventory repin changed no source. Register replay names d95451a8e9268235d673de4674356e0bb3cb8ea1, 289 entries, 116 rules, generation sha256:9994fd7235d4ee6d9f3a258994db320e5606cc5eef99e260d95b0e03de9c8588. Existing 48 glossary warnings and 108 authority prerequisites remain reported as shape-only authority.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Prompt review: No model-facing wording or parser change; only generated publication identities.
Deferral: generated/register.json:1 | not-a-deferral=Existing register entries serialized by the generator, no new deferred work.

## Closing block

simplestRobustRoute: This is the simplest robust route: run the existing delegated owner repin and register generator, without hand-editing hashes or adding machinery.
80/20: Source targeted regressions and real host pass; final publication gets lint, register consistency, change-review and selected READY checks. Full report remains the pipeline's responsibility.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
