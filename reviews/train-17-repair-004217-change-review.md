# Change review — train-17 stalled-owner pipeline repair

Subject base: 9d294f90d65365201544f9e95ba8db9edde0781b
Review state: open
Reviewed content: none
Outcome: Make the stalled-owner regression enter its declared completed-exchange state before suspending the owner; exercise both immediate and slow physical send returns.
Affected rules: Purpose 2/3; Rules 26, 31, 37, 49, 63, 70, 74, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — no credential or runtime change; spend cap — existing reservations unchanged; stop — ownership-loss retirement assertions retained; no duplicate sends — exact answer counts and stale-owner send fencing retained; durable intake — shared cursor and peer receipt evidence remain required.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Test-only repair of an asynchronous setup race; no shipped prompt, parser, authority, configuration or runtime behavior changes.
Side effects: An opt-in physical Telegram fixture delay blocks only the selected child for 1500ms without burning CPU. It defaults to zero for all other consumers. The stale-owner scenario now runs twice and waits for accepted receipts and the matching epoch-one standby copy before SIGSTOP, then checks the successor actually inherited accepted receipts without UNKNOWN sends. Test runtime increases by one bounded scenario. No test is skipped or quarantined.
Undo and recovery: Revert this test-only commit. No migration, live-state repair or deployment rollback is needed.
Multi-machine posture: Real local authority and runner processes model two machines over real HTTP; ownership transfer, replication, exact-PID stall/retirement, standby return and exactly-once reply assertions remain. The additional waits establish the completed-exchange premise on slow hosts. Production cross-machine behavior is unchanged.
Layer below: Inspected journal-agent shared.noteIntake/shared.sync and physical send/outcome ordering, createReplicatedDispatch admission, the signed replica copy state, and the adjacent owner-loss and stop-floor regressions. Intake replication settles the cursor before the physical send's receipt exists; a sent intent adopted without its receipt legitimately stays UNKNOWN. A plain send count or cursor is therefore not the premise this scenario needs.
Bug class: integration
Bug evidence: reproducer=tests/preview/two-machine-runner.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory has only sample hooks. Ordinary git commit is used.
Convergence: none
Decision: train-17-repair-004217-receipts | Reuse the adjacent scenario's accepted-receipt and complete-copy waits before suspending the owner; verify accepted receipts and zero UNKNOWN sends at the successor rather than weakening reply-count or ownership assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-17-repair-004217-PROGRESS.md
Decision: train-17-repair-004217-slow-return | Exercise immediate and 1500ms physical transport returns using an opt-in fixture delay, not CPU load or a larger timeout; with only the delay and no receipt wait the regression observed three non-acknowledgement sends instead of two. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-17-repair-004217-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: establish the existing completed-exchange precondition at the test's fault-injection boundary. The adjacent owner-loss scenario already uses it. No runtime machinery or weaker safeguards are introduced. The opt-in transport delay prevents a fast test host from concealing the receipt race; the start guard is accepted receipts in the matching peer copy, the end guard is stale retirement plus exactly one successor reply, and existing test deadlines and exact-PID cleanup remain. This is test evidence, not a claim of autonomous deployment.
80/20: Run the changed regression file, typecheck, architecture/register checks, change-review check and the required portable pinned tests; the Studio owns the full suite. No second base worktree, full suite or quarantine.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
