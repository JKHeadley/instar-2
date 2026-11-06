# Change review — train-179 repaired register publication

Subject base: be9ab8e836bb1123d67ff0f06bdb0b4da88d2cea
Review state: open
Reviewed content: none
Outcome: Publish the existing register generator replay of the repaired source and exact native certificate.
Affected rules: 26, 37, 49, 74, 90, 91, 102, 105, 111, 115, 116
Affected floors: secrets — no credential change; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Derived register evidence binds the repaired owner source and Studio-tested native conformance; it confers no activation or approved entering-force history.
Side effects: Seven generated publications point to source be9ab8e836bb1123d67ff0f06bdb0b4da88d2cea and generation sha256:3c25480e7c99e1b2591643b4c77d807e153e510f45df55c9eb7bcaa0c0c0a8d4. Population remains 298 entries, 121 rules, 34 terms, 48 warnings and 113 prerequisites; authority remains shape-only.
Undo and recovery: Regenerate from the matching source commit when reverting; never restore stale pins over changed source.
Multi-machine posture: Replay is deterministic from the named commit. Native conformance is only the exact Darwin runtime measured by the desk contract; other host claims are unchanged.
Layer below: Existing build-register replay, generated/source.json source binding, desk owner rehash/chain repin and native before/after contract. Parent review and progress retain the original failures and targeted passing evidence.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: T179-P-EVIDENCE | Replay the register from the committed repair after actual native contract renewal and delegated rehash; retain shape-only authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-179-repair-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=mechanical replay preserves existing declaration text and open prerequisites; it adds no deferral

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

1.X FIRST: inherits reviews/train-179-pipeline-repair-change-review.md comparison against JKHeadley/instar main 154a09ffd44749ceac6205e4a95a9df4c56f4659, SessionManager.ts and unified-session-lifecycle-robustness.md plus ONEX-LESSONS sections 2/6. This publication reuses the 2.0 generator; it imports no additional 1.x behavior.

## Closing block

simplestRobustRoute: Use the existing generator on committed source; no manual publication edits, new authority or runtime behavior.
80/20: Publish verified repairs and run the three required cheap gates; the pipeline owns the fresh full-suite report.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
