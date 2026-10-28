# Change review — Revert transient T4 diagnostic placement

Subject base: a4fde3712ece2c0f93cd762329c6f2e7b279f3c3
Review state: open
Reviewed content: none
Outcome: The T4 diagnostic commit was briefly applied in the r3 worktree while creating r4, then immediately reverted before any trial used it. The net diff from the subject base is empty. The diagnostic is isolated in r4; r3's user-facing behavior and generated register match the prior reviewed candidate. This record covers both commits honestly.
Affected rules: 4, 70, 74, 102, 107
Affected floors: secrets — no net change to redaction; spend cap — no net change to model calls; stop — no net change; no duplicate sends — no net change; durable intake — no net change
Operator questions: none
Suggested tier: ordinary
Declared tier: significant
Tier rationale: A transient diagnostic change touched provider output handling during a full suite; the final tree has no code difference, but the placement and revert must be traceable.
Side effects: None remain in the r3 tree. The in-progress full gate crossed the brief commit window and cannot alone certify a stable r3 head.
Undo and recovery: The revert commit restores the exact subject-base file contents. A new full gate on a stable r3 head is required before any switch.
Multi-machine posture: No live agent, copied journal, or account state was changed by these source commits.
Layer below: The existing redaction and bounded excerpt implementation remains in r3; r4 separately contains the diagnostic change.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: real-task-r3-transient-diagnostic-1028 | Revert the accidentally placed diagnostic from r3 and rerun the full gate on a stable head before any switch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/real-task-candidate-20261027/PROGRESS.md
Prompt review: No operator-facing prompt text changed. The synthetic failure line in the briefly placed test was removed by the paired revert.

Subject (2 paths): tests/preview/call-diagnostics.mjs, tests/preview/call-diagnostics.test.ts

## Closing block

simplestRobustRoute: Keep the diagnostic in r4, rerun r3 gates on a stable head, and use the measured five-task count for the switch decision.
80/20: Record the transient source history and verify the restored r3 tree rather than hiding the mistake.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
