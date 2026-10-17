# Change review — train-58 commitment compaction fixture repair

Subject base: 315d1c94cd06d542f8bdcc8615d26ab36bb58926
Review state: open
Reviewed content: none
Outcome: Restore the commitments live-script regression after automatic summary pacing changed; preserve the real envelope and all recall assertions.
Affected rules: 26, 34, 37, 47, 49, 70, 74, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing checks; no runtime change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test fixture explicitly requests compaction, matching the existing people-memory fixture. No runtime or model-facing change.
Side effects: The test exercises forced compaction rather than automatic cooldown. The existing proactive-compaction tests verify cooldown and forced recovery on both sides; all original commitment, continuity and instruction assertions remain.
Undo and recovery: Revert this test-only change; no runtime state or journal migration.
Multi-machine posture: Repository test applies across hosts. No runtime state, replication or ownership changes; Studio runs the full gate.
Layer below: Full purpose and rules match origin/main. Read runSummary, summarizeIfNeeded, packet evidence selection and the existing people-memory live fixture; reproduced the empty commitments on unchanged head.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-commitments.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample hooks.
Convergence: none

Subject (1 path): tests/preview/journal-commitments.test.ts

Decision: train58-060731-explicit-compaction | Request explicit summary between fixture turns to test post-compaction recall without waiting ten real minutes, preserving the 32768-byte envelope and all existing assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-58-repair-060731-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing explicit compaction entry point in the fixture, as the neighboring people-memory test already does. No new machinery, budget increase or softened assertion. Existing caps and send guards remain; exit is the original persisted-prompt assertions passing.
80/20: Targeted commitment, cooldown and recorded memory tests, typecheck and cheap gate checks; full suite belongs to Studio.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
