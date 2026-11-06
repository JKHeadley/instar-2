# Change review — train-179 READY register CLI scheduling repair

Subject base: df9744d9e6a6a6eb7723a3c5ee84803904f5c280
Review state: open
Reviewed content: none
Outcome: Keep the register fixture worker responsive during every Node CLI call and independently prove absent and committed bridge behavior within the existing per-case deadline.
Affected rules: 26, 36, 37, 55, 60, 70, 74, 102, 111, 116
Affected floors: secrets — no runtime or credential change; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: significant
Tier rationale: Test harness scheduling changes affect gate evidence, including negative CLI assertions. No production code, constitutional wording, authority, timeout increase or quarantine.
Side effects: Each Node CLI invocation yields to worker IPC and has an explicit 60-second child deadline. A signalled child fails before a negative admission assertion can mistake infrastructure failure for refusal. The independent bridge cases retain their existing 60-second case bounds and all six CLI invocations.
Undo and recovery: Revert this test-only change if necessary. No installation, persistent product state, register declaration or generated publication changes.
Multi-machine posture: Uses the existing portable Node async child helper. No host-wide semaphore or load generator; targeted verification on Studio does not certify the full pipeline.
Layer below: Inspected tests/e2e/async-child.ts and the existing cint-5 trace in docs/defects/vitest-worker-rpc-timeouts.md. The helper uses spawn, pipes output, signals its exact child on timeout and resolves only on close; its timeout is optional, so this caller now supplies it. Previously remaining spawnSync calls froze the worker within each CLI and the R2 case combined six real CLI operations under one 60-second case ceiling. Each new pair still compares the same pinned revision with a clean clone; absent bridges refuse with and without an ambient file, committed bridges generate byte-identical register/source, and wiring accepts before refusing an untracked roster addition.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts
Hook bypass: none
Convergence: none

Subject (1 paths): tests/e2e/register.test.ts

1.X FIRST: actual JKHeadley/instar origin/main 36290662ca8ace97def8a08874d087f8050860b8; searched src/ and docs/specs/ for onTaskUpdate/task-update RPC/worker RPC, with no matches. Read src/core/hostTestRunnerSemaphore.ts, docs/specs/test-runner-concurrency-bound.md, history 1f90fa1a9/618560b3e/e1a1b7218 and ONEX-LESSONS.md section 6. Reuse its physical-scope bounded-testing lesson. The host-wide semaphore does not cure one worker blocked in synchronous child calls; reuse 2.0's existing tests/e2e/async-child.ts instead of importing unrelated machinery.

Decision: T179-R2-ASYNC | Complete this file's existing async Node CLI migration, explicitly bound each child and refuse any signalled child before checking expected nonzero exits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-179-repair-PROGRESS.md
Decision: T179-R2-CASES | Split absent and committed bridge proofs into independent roots; each compares its pinned revision with a clean clone and retains the original success/refusal and byte-equality assertions. Keep the 60-second case ceiling. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-179-repair-PROGRESS.md

Evidence: the desk's bounded red excerpt retains the original 66,007 ms timeout and onTaskUpdate error. The isolated bridge pair passes both cases (12.2 s absent, 49.5 s committed). The injected 250 ms slow child requires runner timer progress; a separate 50 ms deadline must reject with SIGTERM, so neither blocking execution nor killed-child-as-refusal can silently pass. No CPU burner or full suite is used. The complete changed file passes all 8 tests in 606.70 s with no RPC error: bridge cases 8.49/27.06 s, slow-child/deadline proof 348 ms. Typecheck passes. Final committed-head gate results are retained in the progress record.

Model-facing boundary: no model prompt, parser, acceptance, escalation or delivered reply changes. This repair changes test execution only; no new live-model result is claimed. Inherited constitutional blockers remain open.

## Closing block

simplestRobustRoute: Finish using the file's existing async helper and split independent bridge proofs. Preserve every neighbor and finite bound without new production machinery or a larger global timeout.
80/20: Repair the demonstrated worker-blocking path, exercise both bridge states plus slow-child and deadline controls, then run the touched file, typecheck and required cheap gates. Full-suite qualification remains the pipeline's separate condition.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
