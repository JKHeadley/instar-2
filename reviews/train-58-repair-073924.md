# Change review — train-58 explicit recall fixture compaction

Subject base: 7756e03663f277fc23677e713d9bba7d46566afe
Review state: open
Reviewed content: none
Outcome: Make the 200-turn recall/restart fixture explicitly establish the summarized prefix it tests, without depending on automatic compaction cadence at a frozen clock.
Affected rules: 7, 11, 26, 34, 37, 47, 49, 60, 70, 74, 96, 101, 102, 111, 112, 113, 116
Affected floors: secrets — no outbound/custody change; spend cap — existing fixture call cap retained; stop — unchanged; no duplicate sends — unchanged; durable intake — original journal and restarts retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test setup only. No runtime, prompt, parser, acceptance, budget, or authority change.
Side effects: The scenario now explicitly compacts through turn 198 before the final two-turn question. It proves post-compaction recall and bounded overhead, not automatic cadence. The separate proactive-compaction tests retain both cooldown refusal after restart and later automatic/forced progress. All original assertions and 9000-byte cap remain; an added assertion verifies the fixture boundary.
Undo and recovery: Revert this test-only commit. No durable production schema or state changes; preserve accepted parent history.
Multi-machine posture: Repository test change shared across hosts; temporary encrypted journal is deliberately local to each test. No production placement or replication change.
Layer below: Read recallFor selection, preparedFor packetDropped shedding, runSummary journal-derived cooldown and summarizeIfNeeded(force); reproduced exact-head assertion and observed selected update 3 shed at 8962 bytes with summary through 191. Purpose/rules read and byte-identical to origin/main.
Bug class: integration
Bug evidence: reproducer=tests/preview/memory-sentinel.test.ts
Hook bypass: none; core.hooksPath unset; common hooks directory contains only sample hooks.
Convergence: none
Decision: train58-repair-explicit-frontier | Force only the fixture compaction before the final two-turn question and assert its frontier, retaining the byte cap and all existing assertions; do not change production priority or repeat a budget increase. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-58-repair-073924-PROGRESS.md

Subject (1 paths): tests/preview/memory-sentinel.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: explicitly establish compaction with the existing API in the fixed-clock recall fixture, assert the frontier, and retain every recall/timing assertion. Start: durable 198-turn prefix; end: original source in the final bounded model packet after restart; limits: unchanged calls, replies, turns and bytes. No machinery added and no live unattended effectiveness claim.
80/20: Single test setup repair and review record. Targeted recall and cooldown tests plus required portable gates; full suite remains the Studio pipeline responsibility.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
