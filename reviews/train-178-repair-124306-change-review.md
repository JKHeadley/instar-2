# Change review — train-178 main merge repair

Subject base: 50fdb3cef77bf3c42d2c9c3f1948c155d6d6af84
Review state: open
Reviewed content: none
Outcome: Merge main c20b68d1d into train-178 while retaining candidate behavior and both histories; regenerate the conversion publication from merged source bytes.
Affected rules: 26, 33, 37, 69, 70, 74, 90, 91, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing owners; no runtime authority or source path changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of governed rule inventory and derived register publication; no new constitutional wording authored.
Side effects: Rule count advances to 121 from approved main; conversion pin must bind the merged anchor rather than either parent anchor. Runtime source remains byte-identical to the candidate.
Undo and recovery: Reject this candidate before landing or revert the repair as a reviewed change. Preserve both Git parents and all durable runtime records.
Multi-machine posture: Repository evidence is shared through Git; no machine-local runtime state added. Studio alone runs its platform-dependent checks.
Layer below: Read full purpose/rules on current main, both parent register builders, merged bootstrap anchor, register-source canonical hashing and replay admission, and inherited train-178 review. Verified owner-reference hashes with the authorized desk tool.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/conversion.json:1 | not-a-deferral=generated rule inventory preserves existing text; no new work is deferred

Subject (7 paths): docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/conversion.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, tests/e2e/register.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge, derive the merged anchor pin using the existing canonical hash, and run existing publication regeneration. No new mechanism, safeguard bypass, or runtime ability restriction.
80/20: Bound validation to typecheck, relevant register/briefing tests and cheap gate checks; submit full-suite and host-specific evidence to the Studio pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

1.x first: searched actual JKHeadley/instar origin/main ab256f684cda141db19abe8bba5300b980e1025b src/, docs/specs/ and history. Read src/core/StandardsRegistryParser.ts, docs/specs/06-state-detector-registry.md and history d5b30b1d7; these preserve constitutional article coverage and distinguish provenance from enforcement. The 2.0 conversion-pin conflict has no direct equivalent in those inspected references: reuse the existing 2.0 generator rather than port the 1.x parser. Read ONEX-LESSONS.md section 6 (testing, bounded concurrency, maintenance). Inherit the whole-feature 1.x comparisons recorded in reviews/train-178-change-review.md.

Decision: train-178-repair-main | Merge exact main c20b68d1d and derive the conversion pin from merged anchor bytes, preserving both histories and all candidate runtime behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-178-repair-124306-PROGRESS.md
Decision: train-178-repair-publication | Regenerate the register using existing tools; keep platform-only and Studio-local evidence checks explicit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-178-repair-124306-PROGRESS.md
