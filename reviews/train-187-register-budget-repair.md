# Change review — reuse cumulative register wiring budget repair

Subject base: 8a5f382f13890728ded6cc68b8fb911eeef1c305
Review state: open
Reviewed content: none
Outcome: Apply existing owner 7b78ea24249e1a6e5ab79fec987dac5b23e81c6d's 120s cumulative case budget to the four isolated bridge groups while keeping each CLI child bounded to 60s.
Affected rules: 37, 55, 60, 61, 70, 74, 101, 102, 107, 116
Affected floors: secrets — offline temporary fixtures only; spend cap — no model requests; stop — every child retains exact-child SIGTERM at 60s; no duplicate sends — no effects changed; durable intake — all existing register/owner assertions remain.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test fixture execution budget and existing helper reuse; no product latency, runtime authority, prompts or selection changes.
Side effects: A bridge group can run for 120s, including two sequential CLI scans and setup/cleanup. Each child remains bounded at 60s. The imported four-group isolation and all acceptance/refusal assertions remain intact. Other test deadlines are unchanged.
Undo and recovery: Revert this narrow test adjustment while retaining the failed run and open defect record. No runtime state or installation changes.
Multi-machine posture: Same one-worker, finite local fixtures on each host; no host-wide scheduler or concurrency change.
Layer below: The first train-187 run passed 14 cases but clean wiring exceeded its cumulative 60s budget at 60008ms. Existing owner 7b78ea242's independent review had already observed the same valid/refusing two-scan problem (52387ms valid, 60013ms timeout). Both real CLI scans remain required. The newer runNode takes its timeout from the enclosing case, so its two bridge call sites use the same underlying runChild helper with an explicit 60000ms child bound.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts; other=docs/defects/vitest-worker-rpc-timeouts.md
Hook bypass: none
Convergence: none
Decision: train187g-budget | Reuse the existing cumulative-budget owner over 99db9a096's complete async/group repair, retaining every scan and 60s child waits; avoid new fixture machinery or weakening production checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-PROGRESS.md

1.x comparison: inherit this repair's actual JKHeadley/instar main 79d83ec93a399c0cd5896871e3e8e29d83d3fc5c research: src/core/WorktreeManager.ts asynchronous execFile, docs/specs/test-runner-concurrency-bound.md, history 5143e436f and ONEX-LESSONS section 6. The bounded async mechanism fits; 1.x worktree/host concurrency does not supply the register fixture's cumulative timer. Existing 2.0 owner 7b78ea242 and tests/e2e/async-child.ts supply the whole fitting correction. Its owner review is reviews/carryover-32-register-budget-repair.md at that commit; no inherited independent verdict is claimed for train-187.

Retained evidence: train-187-register-targeted.log in canonical lanes records 14 passed, one failed, 770.58s, no unhandled RPC error. Current-time register replay/check/tamper refusal and both parent-release controls passed. The failure remains red. Targeted bridge validation, child completion/timeout controls and final cheap gates are recorded in canonical lanes/train-187-repair-PROGRESS.md and the subsequent register publication review. The RPC defect remains OPEN for full pipeline qualification.

Integration into train-175: complete owning adaptation 094e204ea0d1991577070ad9c1191774c67c4664, preserving historical train-187 evidence above. Only this open author record's base is rebound; no independent verdict is inherited. The new desk red on 8a5f382f1 is clean wiring at 60018ms, with the other 16 register cases passing. Rechecked actual 1.x main bc4355b8075dad89e8667ab082c526c0460b0455: src/core/hostTestRunnerSemaphore.ts and docs/specs/test-runner-concurrency-bound.md unchanged from previously researched 9b5790e8105f94c8ad6f13243d063e7c7efd23b6; history 1f90fa1a9/618560b3e/c91b8780e and ONEX-LESSONS section 6 re-read. Bounded async waits fit, host semaphore machinery does not repair the two-scan fixture budget. Final local verification and publication are recorded in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md. All other test logic and assertions are unchanged from the prior 17/17 local pass and supplied desk run.
Decision: train175-bridge-budget | Reuse this complete owning adaptation, including explicit 60s child limits and the cumulative 120s case budget. Preserve the red, test all four affected groups, and run final committed-head cheap gates. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md

## Closing block

simplestRobustRoute: Reuse the already reviewed cumulative fixture correction with explicit original child bounds. No new runner, cache, scheduler or product change.
80/20: Re-run the four affected bridge groups and typecheck; retain the other fourteen passing cases from this source-identical run and let the desk perform full qualification.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
