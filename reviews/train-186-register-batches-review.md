# Change review — finish bounded register fixture groups

Subject base: 6b60a7a466909c9f74f415bd8d8358b5fb4582c8
Review state: open
Reviewed content: none
Outcome: Retain every register assertion while separating the remaining cumulative workflow/holder batches and reusing the existing intake grouping repair.
Affected rules: 34, 36, 37, 49, 55, 60, 61, 70, 74, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — offline fixtures only; spend cap — no model call; stop — original child bounds preserved; no duplicate sends — no effect implementation change; durable intake — every owner/committed-source assertion retained
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test orchestration and retained defect evidence only, without runtime, model-facing, constitution, declaration or generated-output changes.
Side effects: Additional independent fixtures repeat setup, but each timer contains fewer full-graph builds. Bootstrap, normal/completion and governed ingestion perform at most seven builds each under the existing 300s bound. Holder/deadline/rung groups contain at most four CLI calls under 300s. Intake owner groups retain 120s and at most four calls. Every old assertion and child limit remains.
Undo and recovery: Revert this grouping change while retaining the gate red and open defect. No installed profile, journal or provider state changes.
Multi-machine posture: Host-local temporary repositories, foreground execution, nice 10 and one worker. No stress load or two-host operation claim.
Layer below: The pinned run timed out cumulative normal, holder/deadline and intake batches, with a hook timeout alongside the first unfinished body. The existing owner repair already establishes fresh independent groups as the source fix. Split remaining logically independent stages, retaining real builds and every refusal/acceptance control.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts; other=docs/defects/vitest-worker-rpc-timeouts.md
Hook bypass: none
Convergence: none
Decision: t186g-remaining | Reuse the exact intake patch from fc59bc2781552c86b08cc13093ae1b95489142c1 and extend owner 99db9a096's fresh-fixture pattern to the remaining normal and holder batches. Existing bridge-budget and offline-clock owners do not address the newly failing cases; those paths pass here. No watchdog increase or assertion removal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-186-repair-PROGRESS.md

1.x comparison inherited: actual JKHeadley/instar main bc4355b8075dad89e8667ab082c526c0460b0455, src/core/WorktreeManager.ts and src/core/hostTestRunnerSemaphore.ts, docs/specs/test-runner-concurrency-bound.md and docs/specs/doorway-scan-real-run.md; histories 5143e436f/35b02553b/269da957b and 1f90fa1a9/618560b3e/c91b8780e, ONEX-LESSONS section 6. Fit: bounded asynchronous physical work. The inspected 1.x worktree/limiter machinery does not implement these register fixtures; existing 2.0 owner grouping fits directly. Preserve the full feature and its checkpoints.

Evidence: train-186-register-ready-pinned.log retains 127 passed / 3 failed over eight files. The isolated 15/15 pass remains historical evidence, not exoneration. TypeScript passes after this change; AST comparison retains all 81 prior unique assertions and adds the owner's mutation-no-op control. The source changes add no prompt, output parser or model verdict; production CLI builds remain the actual system under test. Final checks and exact tested/pushed head are recorded in the canonical progress file. Full-suite execution remains pipeline-owned.

## Closing block

simplestRobustRoute: Apply the existing owner grouping pattern to the remaining long batches, keeping every assertion and existing limit. No new runner or runtime machinery.
80/20: One affected test file, typecheck, assertion-preservation comparison and the required pinned READY/cheap gates on the final candidate. Retain both reds and all independent acceptance/refusal controls.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
