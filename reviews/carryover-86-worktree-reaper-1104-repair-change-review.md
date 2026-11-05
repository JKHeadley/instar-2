# Change review — preserve checkout work at reaper eligibility checkpoints

Subject base: e788c8081949aea89ece29058260bf58bd7b5393
Review state: open
Reviewed content: none
Outcome: Correct all three independent review findings: ignored user files keep their checkout, expired action-time inventory refuses removal, and merged PR evidence must target the selected repository and default branch with an exact head match. Valid clean removals and squash-merge recognition remain available.
Affected rules: 2, 26, 70, 74, 95, 101, 102, 111, 113, 116
Affected floors: secrets — no credential reads or new outputs; spend cap — no model call; stop — existing checkpoints remain before observation, between candidates and before removal; no duplicate sends — no sends; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: Incorrect eligibility can destroy user work. Real temporary Git repositories exercise preservation and removal; production activation is outside this repair.
Side effects: The original submission decisions now reference the same Studio handoff report, which carries their inherited summaries. Generated register replay from committed source 2fbf3cdd1af1b388404e1779c0e93765b10f8c4b refreshes source wiring pins; owner-manifest and grounding repin tools found no changed pins. Porcelain includes ignored files and all untracked paths; ignored residue remains kept under the existing residue disposition. Forge lookup explicitly selects the remote repository supplying the base (origin for a local base), requests the base branch, validates returned baseRefName, and keys the existing TTL cache by destination. An unresolvable remote leaves cherry-only evidence. The unconstrained mergedHeads injection is replaced by the existing query port so tests exercise the destination checks.
Undo and recovery: Revert this repair commit if necessary while keeping the reaper disabled; reverting alone restores known deletion defects. No store migration or production composition change. Git branches and committed contents remain after eligible checkout removal.
Multi-machine posture: Deliberately machine-local; existing fresh same-machine process evidence and ownership checks remain. No new shared state or peer dependency.
Layer below: Actual Git ignored-status and non-forced removal semantics, remote get-url and resolved base refs; existing fresh predicate at its inclusive expiry boundary; forge query arguments and returned baseRefName through injected responses over real local feature commits absent from main.
Bug class: integration
Bug evidence: reproducer=tests/assembly/worktree-reaper.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt or model-facing change.
1.x reference: Inherited comparison: JKHeadley/instar f3f94826ae7c0ae6203c2651698c02b95b89ccfa src/monitoring/AgentWorktreeReaper.ts and src/monitoring/agentWorktreeGit.ts. Preserve gate order, bounded passes, breaker, initial pass, enumeration diagnostics and merge fallback. The ignored-file and PR-destination assumptions inherited from 1.x are corrected at their existing checkpoints. Additional local reference d5b30b1d7c059da68483caf15d7584aec0d7a325 confirms the plain porcelain assumption; inspected docs/specs/worktree-reaper-untracked-blindspot.md and docs/specs/worktree-reaper-squash-merge-blindness.md and agentWorktreeGit.ts history. No ONEX-LESSONS.md was found in the local workspace search.
Decision: C86-R1 | Include ignored files in the existing cleanliness observation and retain non-forced removal and residue-only KEEP; ignored user notes must survive. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-86-worktree-reaper-1104-repair-064616-PROGRESS.md
Decision: C86-R2 | Reuse fresh(sourceTime, freshForMs, now) on action-time inventory before eligibility can authorize removal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-86-worktree-reaper-1104-repair-064616-PROGRESS.md
Decision: C86-R3 | Bind the bounded forge query and cache to the resolved base remote repository and branch; validate baseRefName before exact-head admission. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-86-worktree-reaper-1104-repair-064616-PROGRESS.md

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/worktree-reaper-git.mjs, src/assembly/worktree-reaper.ts, tests/assembly/worktree-reaper.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: correct observations and predicates at the three existing checkpoints, using the existing clock, query port, bounded forge request and TTL cache. No new service, clock, gate or protocol. Existing start guards, stop, per-pass caps, breaker and non-forced operation remain; the end-state check now rejects expired checkout evidence. No unattended production result is claimed; row 86 remains open for composition and live proof.
80/20: The three demonstrated defects have focused neighboring tests, including real ignored-user-file preservation, expired/fresh inventory boundaries, staging/default merge evidence, upstream repository selection and destination cache invalidation. The port-only boundary remains as accepted by the review.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
