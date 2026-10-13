# Change review — Replay merged cancellation repair register

Subject base: 228067a63c7f047e4ed14a2692df46c2f216e229
Review state: open
Reviewed content: none
Outcome: Regenerate the register and derived capabilities from merged source commit 228067a63c7f047e4ed14a2692df46c2f216e229 using the established replay generator.
Affected rules: 37, 49, 69, 74, 90, 91, 101, 111, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain enforced by unchanged runtime code.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Generated publication only; no new behavior or governing authority.
Side effects: Derived generation IDs and source commit now match merged source; register population retains carried branch capabilities.
Undo and recovery: Replay publication from a reviewed source commit; do not hand-edit generated output or pins.
Multi-machine posture: Derived files travel with git; the same source produces the same publication on each machine.
Layer below: Successful compiled build, zero-change owner-manifest rehash and grounding repin, and build-register replay against the merged source ancestry.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->

Subject (8 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/shape.json, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the register generator with explicit merged source provenance. Existing register and architecture checks hold the start/end guard. No new runtime mechanism or live completion claim.
80/20: Only regenerated publication is authored. Targeted tests and cheap final checks are recorded in the Studio repair progress file; the pipeline owns full-suite evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
