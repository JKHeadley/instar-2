# Change review — restore register lifecycle worker progress

Subject base: ae959a2854681502c728f604a6961a4de6d1a1c2
Review state: open
Reviewed content: none
Outcome: Integrate owning repair 99db9a0967837d7d10527c457263b50383464952 so register CLI children yield to the test worker and independent fixture groups retain finite case budgets.
Affected rules: 37, 55, 60, 61, 70, 74, 101, 102, 107, 111, 113, 116
Affected floors: secrets — offline synthetic fixtures only; spend cap — no model calls or accounting change; stop — existing child ownership and finite timeouts; no duplicate sends — no runtime effect or retry change; durable intake — all committed-source and retained-output assertions remain.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test orchestration, generated source publication and evidence only; no product runtime, constitutional wording, prompt, authority or acceptance-rule change.
Side effects: The defaults batch becomes three independent fixtures with at most four CLI calls and the same 120s bound. Bridge coverage becomes four independent fixtures with at most two calls and the same 60s bound. Malformed-source coverage becomes three fixtures with at most nine builds and the same 300s bound. Children use the existing async helper and inherit the enclosing case timeout. Two positive builds support the independent wiring fixtures. All 76 original unique assertion expressions remain; the new file has 81. No skip, quarantine or higher deadline.
Undo and recovery: Revert this integration and regenerate source publication if required. Keep the supplied red and existing open RPC defect; no installed state needs recovery.
Multi-machine posture: Host-local workers and temporary repositories; real clone byte comparisons remain. This does not claim multi-host execution or bound other programs on the host.
Layer below: Inspected remaining spawnSync build/wiring sites, existing tests/e2e/async-child.ts spawn/close promise and exact-PID timeout, fixture setup/cleanup and all original assertion expressions. A synchronous child prevents worker RPC while running; an awaited async child services the event loop. The owner adds an actual CLI preload/parent barrier with released and unreleased neighbors, without a CPU burner.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts; other=docs/defects/vitest-worker-rpc-timeouts.md
Hook bypass: none
Convergence: none
Prompt review: No model-facing source change. The real source evidence is the supplied failing test tail and actual spawned register CLI; no model output replay is applicable.

Recorded failure: Supplied READY gate for ae959a2854681502c728f604a6961a4de6d1a1c2: defaults case at line 353 and bridge case at line 406 time out, with one unattributed onTaskUpdate error; 118 passed, two failed, one error across eight files in 1154.95s. No full saved report was fetched. The test file before this repair is byte-identical to the owning repair's parent. This closes the known blocking-child and oversized-batch paths; it does not attribute the untraced RPC error. Existing desk ownership and full-run closure of the RPC defect remain.

1.x comparison: Searched actual JKHeadley/instar origin/main 58d761ab84cd492db66897069ca9d9246dda76c2 src/core/WorktreeManager.ts and docs/specs/test-runner-concurrency-bound.md for asynchronous subprocess work; read promisified execFile and bounded host scheduling; history 5143e436f, 618560b3e, 269da957b, c91b8780e; ONEX-LESSONS section 6. Inherit owner's 9b5790e8105f94c8ad6f13243d063e7c7efd23b6 comparison and worktree history b227aed93/5143e436f/6fb1db837, limiter history 618560b3e/c91b8780e/681f86543. Reuse asynchronous child orchestration and bounded physical work. The worktree/semaphore subsystem does not implement register fixtures; reuse the existing 2.0 async-child helper and complete owning test file instead of copying unrelated machinery.

Decision: train190g-owner | Import complete owning test repair 99db9a0967837d7d10527c457263b50383464952 unchanged; retain every old assertion and deadline, the real-child progress controls, and the existing RPC defect closure condition. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-190-repair-PROGRESS.md

Evidence: docs/release-evidence/train-181-register-repair-report.md is unchanged historical owner evidence, not this branch's result. Current targeted validation and final-head cheap-gate output are recorded in the absolute lanes/train-190-repair-PROGRESS.md. Whole-file owner equality and 76/76 original assertion preservation were checked before execution. Typecheck passed. Delegated rehash/repin changed zero owner/inventory pins; register replay from b147255b37d04189cccaaaa015d1ea310f80f061 produced generation a03cfb4e46ad5e7ef9546e2d3fc488c004296cedd40bf6175fee25df2a114949 (298 entries, 121 rules).

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the whole existing owner repair, async-child helper and independent fixtures. It prevents a known worker starvation path and excessive batching without a new runner, looser guard, timeout extension or capability limit. Product checkpoints are unchanged.
80/20: Typecheck, the single affected test file, generated source evidence when required, and final cheap gates. Full-suite qualification stays with the pipeline; targeted green does not close the unattributed RPC defect.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
