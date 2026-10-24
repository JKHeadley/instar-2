# Change review — train-145 launcher ordering check repair

Subject base: 2f68bacc7fbcc022b2fb431c8da2421cd4a5c9b4
Review state: open
Reviewed content: none
Outcome: Restore the immediate-dispatch wiring test after the accepted stale-owner intake guard, and refuse missing checkpoints explicitly.
Affected rules: 1, 26, 37, 46, 49, 63, 70, 74, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets and spend cap unchanged; stop retains guarded intake and read-ahead protection; no duplicate sends retains existing ownership and stop-confirmation checks; durable intake retains sync-before-wake ordering.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test assertion repair only; no launcher, model, authority or stored-state behavior changes.
Side effects: The check now explicitly rejects a missing intake anchor or checkpoint, and requires synchronization, read-ahead, minimal-path start, wake and minimal await in that order. Existing runtime tests remain intact.
Undo and recovery: Revert this test-only commit if needed; no data or deployment recovery is needed.
Multi-machine posture: Machine-local test execution deliberately; the test verifies the existing shared synchronization and ownership admission order without changing multi-machine behavior.
Layer below: Inspected the actual journal-agent poll/intake loop: ended after poll, untilStopped around intake, shared sync and owner recheck, read-ahead stop handling, minimal start, wake, minimal await. Read full constitution; it matches origin/main. Verified core.hooksPath unset and common hooks directory contains sample hooks only.
Bug class: unit
Bug evidence: reproducer=tests/preview/dispatch-now.test.ts
Hook bypass: none
Convergence: none
Decision: T145-dispatch-anchor | Match the accepted guarded intake and assert every ordering checkpoint exists; preserve production ownership repair and behavioral tests. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-repair-114440-PROGRESS.md
Prompt review: No model-facing change, parser or acceptance/escalation/refusal decision changes. No new recorded model-shape replay is required for this test-only repair.

simplestRobustRoute: This is the simplest robust route: update the existing source-order assertion to the actual guarded intake and reject absent positions rather than treating -1 as earlier. No production machinery added; existing admission, stop, durability and unique-send guards remain unchanged. No unattended deployment claim.
80/20: Reproduce the precise gate failure, verify the repaired test and missing-checkpoint negative controls, run cheap checks, and submit to the separate Studio full gate.
VERDICT: author submission; no independent convergence or live acceptance claimed
