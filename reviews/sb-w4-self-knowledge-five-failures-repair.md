# Change review — Laptop gate failure repair

Subject base: e3f70fbc68037f3824751628a7eded89c4d1d294
Review state: open
Reviewed content: none
Outcome: Restore split-gate evidence integrity, align historical prompt regression expectations, and keep bounded functional/crash tests responsive to the runner.
Affected rules: 1, 26, 34, 36, 37, 41, 49, 58, 60, 70, 74, 101, 102, 107, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing product checkpoints. Crash tests continue asserting persistent uncertainty and exact successor state.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: The only non-test behavior restores the full-suite driver's missing split refusal before evidence or effects. Product behavior, authority and model-facing instructions are unchanged.
Side effects: Independent append cuts become separately reported tests with the same contract IDs. Awaited child launches allow RPC servicing and keep a 30-second child bound. The 200-turn functional test permits up to 300 seconds, retaining every assertion. Split full-gate attempts now refuse before recording or deleting a report.
Undo and recovery: Revert these paths in a new commit; no data migration or production state mutation is involved.
Multi-machine posture: Gate evidence and temporary test journals are deliberately machine-local. Split reports still merge through the existing cross-machine checker; product ownership and replication are unchanged.
Layer below: Inspected gateRun's durable run-start and report deletion; journal capability wording and replyReviewQuestion; async-child's exact child SIGTERM deadline; the crash worker's exact-PID self-SIGKILL and persistent storage reconstruction.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: restore-split-refusal | Restore the admission check before any full-run evidence is recorded; existing tests prove both split refusals and unsplit admission. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-self-knowledge-repair-PROGRESS.md
Decision: recorded-prompt-compatibility | Update only historical normalization for the already-shipped compact reasoning request and the recall stub's current user-facing wording. Keep recorded bytes immutable and exact equality outside named protocol differences. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-self-knowledge-repair-PROGRESS.md
Decision: responsive-crash-tests | Reuse the existing awaited child helper, retaining all nine cuts, the exact successor control and all poison/torn recovery assertions; independent cuts get independent deadlines. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-self-knowledge-repair-PROGRESS.md
Decision: functional-conversation-budget | Apply the existing 2.4x observed-duration convention to 122.599 seconds, rounded to 300 seconds. This is a safety ceiling for functional coverage, not a latency or load-independence claim. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-self-knowledge-repair-PROGRESS.md
Prompt finding: bd01de21286a | quoted-evidence | The ablation test locates the actual instruction boundary; no runtime prompt is changed or trained on a fixture phrase.
Prompt finding: fb5fa7e706c8 | quoted-evidence | The existing instruction start locates the ablated span; it is not a new keyword decision in product code.

Validation: Typecheck passes. Five targeted files pass 41/41 with nice -n 10 and --maxWorkers 1, with no runner errors. The 200-turn test retains 200 sends, 52 summaries, 199 reviews and 3/3 early facts; max answer/review sizes 16478/26114 bytes remain below 32768. The captured self-description reviews replay both pass and violation neighbors (2026-10-03 update 6231439 and October 4 round-two captures). All nine physical crash cuts and completed successor control pass. Architecture and register wiring pass with issues=[], register check passes. No quarantine or full suite. All eleven saved-report contract commands were invoked, but the requested gate report and local report are absent; each reports ENOENT. The pipeline supplies full-suite evidence.

## Closing block

simplestRobustRoute: This is the simplest robust route: restore one existing boundary check, correct stale test expectations, reuse the awaited child helper, and give functional tests appropriate bounded scheduling. Start guard: split evidence cannot enter the full-gate driver. Limit guards: child and overall test deadlines, byte/call/send caps and unchanged durability checks. End state: exact recovered uncertainty or successor and all 200 delivered turns with early recall. No new runtime machinery or reduced agent ability; no autonomous live-completion claim is made.
80/20: Changes are confined to the reported failures, the related runner defect record and this review. Full gate and independent landing review belong to the pipeline.
VERDICT: author submission; the independent verdict is recorded as a pass
