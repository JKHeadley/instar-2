# Change review — Keep register CLI lifecycle scenarios independently bounded

Subject base: 201270c8ba5c702376bbb57aaf3d2ec7fcc06382
Review state: open
Reviewed content: none
Outcome: Register CLI lifecycle acceptance and refusal neighbors run as separate named tests through the existing asynchronous child helper, so cumulative full-tree builds do not exhaust one case's budget or starve Vitest task-update IPC.
Affected rules: 26/34/37/42/60/70/74/101/102/109/113/116.
Affected floors: secrets — no product change; spend cap — no provider calls; stop — no product change; no duplicate sends — no effects; durable intake — journal and product state unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test scheduling repair with the same production CLI, real copied source graph, fixture clocks, hostile inputs and original per-test bounds.
Side effects: Four CLI batches become individually reported scenarios. Each keeps an isolated temporary repository and awaits one child at a time; each child has a finite 60-second wait through the existing helper. All positive, spoofed, stale, committed/ambient and byte-identical output assertions remain. No assertion is skipped or deadline increased.
Undo and recovery: Revert the test-only change and this record. Each scenario removes its own temporary repository; production and correction-review data are unchanged.
Multi-machine posture: The tests are machine-local fixtures over committed source; the same CLI and assertions run on every host. No shared runtime state or machine restriction is added.
Layer below: Inspected register build/readCommit/shipped graph/wiring scan, existing async-child helper, bound-children and yield-worker infrastructure; reproduced R2 timeout and RPC starvation with the actual CLI; profiled a real register build.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts
Hook bypass: none; plain commits, existing common hook directory has sample hooks only.
Convergence: none
Decision: C32-REG-1 | Split independent register CLI scenarios and await the existing child helper instead of accumulating synchronous builds under a single case deadline. Preserve the source checks and original case budgets. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-32-common-base-1105-repair-PROGRESS.md
Deferral: tests/e2e/register.test.ts:213 | not-a-deferral=The existing fixture's deferred-holder case is now named individually; no work is deferred by this repair.

1.x FIRST: Searched actual JKHeadley/instar locally recorded main b227aed934ce3c61cda09142f46de06834aacc9c src/, docs/specs/ and history. src/lifeline/TelegramLifeline.ts:2800 awaits execFile; docs/specs/CRASH-RECOVERY-UX-SPEC.md replaces synchronous subprocesses to prevent event-loop blocking. Source history includes e5f88b0fe, 9585a36e6 and 0ca2f6756. ONEX-LESSONS section 6 read (test concurrency and real assembly evidence). No 1.x constitutional-register fixture fits this 2.0-specific test; reuse its asynchronous subprocess design through existing tests/e2e/async-child.ts. The batched immutable blob read described by docs/specs/RELEASE-READINESS-VISIBILITY-SPEC.md already exists in scripts/register-source.mjs, so no new blob/cache machinery is introduced.

Evidence: At the previous pushed head, isolated R2 reproduced the 60-second case timeout and onTaskUpdate error (92.34 s run). Real register build CPU profile measured 31.249 s wall, 22.8 s in source scanning; six CLI invocations cannot fit reliably into one 60-second test. Final-byte register lifecycle tests pass 40/40 across two foreground chunks (25 in 506.41 s; 15 in 299.08 s), with zero unhandled errors. Committed equivalence also passes independently; original 60/120/300 s case bounds are unchanged. Typecheck and exact committed-head cheap gate results are recorded in the absolute PROGRESS record. This is test infrastructure only; the model-facing correction validator and all previously recorded replay evidence remain unchanged. Row 32's combined gate and installed-use acceptance remain desk-owned.

## Closing block

simplestRobustRoute: Use Vitest's existing parameterized tests and existing asynchronous child helper, retaining the real CLI and every boundary assertion. This prevents cumulative fixture timeouts and blocked IPC without changing production validation, adding a scheduler/cache or increasing case deadlines.
80/20: Repair the reproduced scheduling cause in its test source. No full suite, synthetic load burner, quarantine or fabricated full-run evidence; the desk reruns its combined gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
