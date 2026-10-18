# Change review — train-47 pipeline test repair

Subject base: 318b769a33cca369f2cf9430ec16d685ca218f8c
Review state: open
Reviewed content: none
Outcome: Exercise refused allocation refunds at the shipped maintenance ceiling and restore exact macOS test inventory.
Affected rules: 15, 26, 37, 49, 60, 61, 70, 74, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain unchanged runtime owners; capacity and answer reserve are exercised through the real allocation adapter.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test and platform inventory repair only; no runtime, prompt, authority or policy changes.
Side effects: Allocation regression runs at three and nine slots, with two refused attempts each; agent-paths joins the existing macOS test partition because it contains actual Darwin-only CLI checks.
Undo and recovery: Revert this repair commit; no data migration or uncertain effect replay is involved.
Multi-machine posture: Test fixtures are machine-local temporary stores. The inventory routes Darwin checks to macOS; production multi-machine ownership and transport are unchanged.
Layer below: Inspected RESOURCE_CEILINGS (nine total, one reserved), hostResourcePolicies and reserve/refund implementation, and actual Darwin-gated agent-paths tests plus inventory detection.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample files only.
Convergence: none
Prompt review: No model-facing text, parsing or decision path changes. Recorded model-shape replay is not applicable.
Decision: train47-repair-capacity | Exercise both a small three-slot fixture and the shipped ceiling, fill maintenance capacity before repeated refusal, and prove the answer remains admissible; preserve runtime capacity. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-repair-152104-PROGRESS.md
Decision: train47-repair-platform | Add agent-paths to the sorted macOS inventory because actual CLI cases gate on Darwin; retain the detector and every test. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-47-repair-152104-PROGRESS.md

Subject (2 paths): tests/integration/resource-owner.test.ts, tests/platform/macos-only.txt

simplestRobustRoute: This is the simplest robust route: repair the stale test setup and existing platform inventory without new runtime machinery. Start at the named failed head; prove admitted maintenance, repeated refused allocation refunds and preserved answer admission; retain the existing capacity floors. Exit is pushed test repair with targeted and cheap-gate evidence, with Studio retaining full-suite qualification.
80/20: Exercise the exact failed assertions and portable inventory checks, then required typecheck, architecture, register, change-review and pinned-text checks; no full suite on WSL.
VERDICT: author submission; no independent acceptance or live deployment claim
