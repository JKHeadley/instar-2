# Change review — train-45 merge live a1b59d03

Subject base: 7490eb8a4593f03ae3220f71edf2d7f0741a0148
Review state: open
Reviewed content: none
Outcome: Merge live delta-turn delivery while preserving train-45 completion guidance and its recorded fixtures.
Affected rules: 26, 34, 36, 37, 49, 69, 74, 90, 101, 102, 105, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain both inputs' existing checkpoints; this resolution changes no product authority or effect path.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Composition includes previously reviewed conversation delivery and prompt guidance; resolve their conflicting regression expectations without changing either implementation.
Side effects: Delta-turn grounding joins completion guidance. Policy tests bind the current policy to the captured completion policy and distinguish its predecessor. Restore the captured verification fixture still consumed by completion tests. Generated publication is replayed from merged sources.
Undo and recovery: Revert this merge with its first parent as mainline through the normal reviewed release path; retain journal receipts and do not repeat uncertain effects.
Multi-machine posture: Identical source on every host; current conversation ownership and durable journal transport remain unchanged. No new state or peer dependency.
Layer below: Reviewed both merge parents, prompt constants, captured guidance policies, completion replay consumers, delta-turn session tests, physical resource launcher and register generation. The Linux shell rejects the unchanged launcher's ulimit -u; macOS certificate renewal remains desk-owned.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample files.
Convergence: none
Prompt review: No prompt wording is authored by this repair. Preserve the two reviewed implementations and assert the complete current policy against recorded bytes. Fixture restoration preserves exact captured content.
Skip: tests/assembly/production-conversation-session.test.ts:660 | scope=Inherited live rewalk replay requires DELTA_TURNS_WALK_ROOT on the Studio; its conditional skip is unchanged by the merge resolution.
Decision: train-45-repair-171527-A | Keep completion guidance, assert its exact captured policy and inherited 508-character growth, retain the predecessor policy digest as historical evidence, and restore its consumed fixture. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-45-repair-171527-PROGRESS.md
Decision: train-45-repair-171527-B | Regenerate register output and derived owner pins with existing desk tools; retain the candidate macOS certificate unchanged for Studio renewal rather than declare unrun conformance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-45-repair-171527-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: an ordinary merge, one test conflict resolution preserving both policies, restoration of an existing fixture, and existing register generation. No new product machinery. Start from the assigned clean branch; validate targeted consumers and exact committed bytes; preserve all authority, resource, stop, intake and effect-uniqueness floors. No autonomous shipped-path completion is claimed.
80/20: Portable targeted tests and cheap checks only; the Studio owns full-suite proof, native certificate renewal and host-specific launch checks.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
