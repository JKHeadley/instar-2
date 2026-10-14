# Change review — train-30 repair register publication

Subject base: 5365f0697e3adf166575ed4918ba737bd87973e6
Review state: open
Reviewed content: none
Outcome: Replay the generated register against the committed acknowledgement-test owner pin.
Affected rules: Rules 26, 37, 49, 69, 74, 90, 101, 102, 111, 112, 113 and 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement; generated shape-only publication grants no authority.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Generated publication only, following a test fixture pin refresh.
Side effects: Publication source and generation hashes change to bind the committed source; entries and authority remain unchanged.
Undo and recovery: Revert the test repair and owner pin together, then regenerate with the existing builder. No production state is changed.
Multi-machine posture: Shared generated records bind identical committed bytes on every machine; no machine-local authority is introduced.
Layer below: Existing build-register replay consumer binds the source commit and owner references; register:check verifies generated publication.
Bug class: none
Bug evidence: Generated pin maintenance only; no independent product bug claim.
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains samples only.
Convergence: none

Decision: train-30-repair-100322-publication | Regenerate shape-only publication with the existing builder after committing the owner pin, preserving reproducible source binding. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-30-repair-100322-PROGRESS.md

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: Use the existing register replay builder against committed source; this is the simplest route, adds no machinery and makes no runtime or live-user completion claim.
80/20: Verify the generated publication through register:check and lint; retain shape-only status and existing prerequisites.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
