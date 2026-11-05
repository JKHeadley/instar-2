# Change review — keep worktrees when merge verification outlives evidence

Subject base: 05ac3b6eaede521b1a62455075286d217be09965
Review state: open
Reviewed content: none
Outcome: Refuse reclamation when checkout or process observations expire during asynchronous merge verification; preserve removal at inclusive expiry.
Affected rules: 26, 70, 74, 95, 101, 102, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — no model calls; stop — existing checkpoints retained; no duplicate sends — no sends; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: Eligibility authorizes destructive checkout removal; stale observations must preserve work.
Side effects: Slow merge verification may now keep a checkout until another pass can obtain fresh evidence. The same race reason, cap, breaker and non-forced removal remain. Generated register source pins are replayed after the source commit.
Undo and recovery: Revert this repair while keeping the reaper disabled; a revert restores the demonstrated expiry gap. No migration or new state.
Multi-machine posture: Deliberately machine-local; freshness and complete same-machine process evidence stay required, with no new shared state.
Layer below: Existing inclusive fresh predicate and processCensusGap completeness/machine checks. Real reaper tests advance its injected clock during the second awaited merge verification. Existing real-Git tests verify non-forced removal and preservation.
Bug class: integration
Bug evidence: reproducer=tests/assembly/worktree-reaper.test.ts
Hook bypass: none
Convergence: none
1.x reference: Inherited JKHeadley/instar f3f94826ae7c0ae6203c2651698c02b95b89ccfa src/monitoring/AgentWorktreeReaper.ts and src/monitoring/agentWorktreeGit.ts retain classifier, bounded passes, breaker, initial pass, diagnostics and merge fallback. Additional local origin/main f5fe54444544f83a477dec909f990c848866ed3b search inspected reclaimRaceGuard, merged helper, docs/specs/agent-worktree-reaper.md and history ff8344b4b/6fb1db837/d5b30b1d7. The 1.x guard is synchronous; 2.0 asynchronous ports require expiry validation after merge verification. No ONEX-LESSONS.md found in workspace filename search.
Decision: C86-R5 | Reuse fresh and processCensusGap after the awaited evaluation, so expired evidence keeps the checkout while the inclusive boundary still permits removal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-86-worktree-reaper-1104-repair-075200-PROGRESS.md

Subject (2 paths): src/assembly/worktree-reaper.ts, tests/assembly/worktree-reaper.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: reapply existing freshness predicates after awaited evaluation, before eligibility returns. No new clock, service, protocol or restriction. Existing start, stop, cap and breaker guards remain; end-state evidence must still be fresh. Port-only scope: no autonomous completion or production activation claimed; row 86 remains open.
80/20: Both expiry regressions failed before the four-line source fix while the inclusive-boundary positive passed. All 91 reaper tests pass afterward. No broader production-integration claim.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
