# Change review — Publish register for the acknowledgement polling repair

Subject base: b2b72e145345d75f241ddb07bdf7f27b240c4538
Review state: open
Reviewed content: none
Outcome: Regenerate the seven publication artifacts from committed repair b2b72e145345d75f241ddb07bdf7f27b240c4538.
Affected rules: Rules 5/49/69/74/78/84/90/101/111/113/116.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. Publication-only change.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Mechanical publication of the reviewed source commit; no runtime changes.
Side effects: Generation and source wiring pin now name the repaired worker. Capability content remains unchanged.
Undo and recovery: Regenerate publications from the desired committed source; never hand-edit a pin.
Multi-machine posture: Publications identify the same committed source on each machine; no new machine-local state.
Layer below: Source repair review and successful generator using the unchanged approved conversion anchor and owner manifests.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=Existing declaration text mechanically republished from committed source; no implementation postponed by this change.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: Use the existing register generator against the committed source. No added machinery or guards; the existing source and owner pins hold publication consistency.
80/20: Generator plus final lint, register:check, change-review and focused checks; pipeline owns the fresh full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
