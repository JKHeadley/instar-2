# Change review — bounded parallel tests with isolated heavy fixtures

Subject base: d936c5c6a90ee5d2ac5bc49dcede800b8d19574c
Review state: open
Reviewed content: none
Outcome: Restore bounded parallel execution of ordinary tests while serializing only the fourteen historically traced or measured heavy fixture files, each in a fresh process.
Affected rules: 26, 37, 49, 60, 70, 74, 101, 102, 108, 111, 112, 113, 116; purpose constraint 3.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; no product, credential, model or effect path changes and every existing assertion remains.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Test scheduling, regression coverage and defect documentation only; full Studio proof remains the qualification bar.
Side effects: Heavy fixtures now run successively after ordinary tests, so their runtimes add to the parallel phase. Every selected file retains a separate process, module isolation, setup and test deadline. No lock waiters occupy the pool. CLI file filters and platform splits still select exactly the requested tests. Host admission is separate and must still bound concurrent suites; the per-run cap cannot prevent external host saturation or a single blocking case exceeding the IPC deadline.
Undo and recovery: Revert this commit through git to restore the previous serial-all config. No installed state or migration changes.
Multi-machine posture: Machine-local per-run scheduling on every host, distributed by git. The existing platform split is retained. This adds no cross-machine coordination or product authority.
Layer below: Read the constitution, traced RPC defect and original repair review; inspected Vitest 3.2.7 forks pool and project group ordering. Per-project fileParallelism is not a pool bound in this version, and singleFork groups reuse process globals. Ordered one-file projects preserve the actual fresh-process boundary. Read 1.x hostTestRunnerSemaphore and setup admission/clamp seams; reuse separation of host suite admission and per-run workers rather than copying its implementation. Actual inventory and injected rendezvous tests exercise the real runner.
Bug class: unit
Bug evidence: reproducer=tests/unit/test-worker-limit.test.ts
Hook bypass: none; core.hooksPath is unset and common hooks contain sample files only.
Convergence: none
Prompt review: No production prompt or parsing decision changed. Generated test text exercises runner scheduling only.
Decision: test-parallel-D1 | Restore the bounded ordinary pool and use built-in ordered projects only for the fourteen recorded heavy fixtures, preserving separate process isolation without introducing a lock service. The list is evidence-scoped and does not attribute the later unattributed RPC errors. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/test-parallel-1026-PROGRESS.md

Evidence: The new worker-policy regression fails on the old config (expected six, received one). The real runner probe proves ordinary overlap, successive heavy fixtures and distinct process ids. Actual runner discovery matches all tracked tests exactly once and respects both platform halves. Targeted worker/split tests pass 9/9; build and typecheck pass. Complete proof results belong to the absolute progress record, with red results retained as red.

## Closing block

simplestRobustRoute: Use Vitest's existing bounded pool and sequence groups. This is the simplest robust route that restores ordinary parallelism while preserving fresh-process isolation for the recorded heavy fixtures. A singleFork project would weaken that isolation; a shared lock would add ownership, crash recovery and waiting workers. Start guard is the checked-in schedule and host admission; end guards are actual discovery, scheduling and complete-run evidence; limit guards remain worker caps, case deadlines and child bounds. No new scheduler service or unattended product-completion claim.
80/20: Narrow the scheduling change to measured fixture families, verify both overlap and exclusion with real workers, retain every semantic test, and submit complete-run evidence to the desk without claiming it identifies every historical cause.
VERDICT: author submission; no independent verdict asserted
