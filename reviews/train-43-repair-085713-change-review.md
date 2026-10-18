# Change review — train-43 pipeline repair

Subject base: 4fd9966634aada3f6b256a822addb8c3194201b8
Review state: open
Reviewed content: none
Outcome: Restore the assembly prompt-size assertion after inherited verification guidance added 508 characters, retaining the same 33-character headroom.
Affected rules: 13, 26, 37, 49, 70, 74, 101, 102, 111, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; only a test allowance changes, not a runtime limit.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test assertion and its explanatory comment; no product or model-facing change.
Side effects: The test now permits the reviewed 508-character instruction. Unexplained growth still exceeds the retained headroom; the separate context-floor test pins exact bytes and verifies the actual runtime budget boundary.
Undo and recovery: Revert this test-only commit to restore the old assertion; no state or migration changes.
Multi-machine posture: Test-only and identical on every host. Existing owner, durability and send protocols are untouched.
Layer below: Read production-provider.ts tool prompt composition, tool-answer-guidance.ts COMPLETE_REQUESTED_STEPS, and default-context-floor.test.ts exact growth and runtime-boundary assertions. The inherited guidance is 508 characters; total growth is 3275, formerly 2767.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and shared hooks directory contains sample files only.
Convergence: none
Prompt review: No prompt, parser, acceptance decision or fixture changes. This repairs test accounting for already-reviewed instructions; it claims no new live model behavior.
Decision: train-43-repair-085713-allowance | Add exactly 508 to the existing 2800-character assembly-test allowance, retaining 33 characters of headroom and every runtime ceiling. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-43-repair-085713-PROGRESS.md

simplestRobustRoute: Correct the one stale test allowance and retain existing exact-byte and runtime-boundary tests; this is the simplest robust route, with no new machinery or product changes. Start from the named failing head; finish with targeted evidence and a pushed repair for the Studio gate.
80/20: Verify the failing assertion and its context-floor neighbor, then the required cheap and pinned-text gates; leave unchanged physical-host tests to the Studio.
VERDICT: author submission; no independent convergence or live acceptance claim
