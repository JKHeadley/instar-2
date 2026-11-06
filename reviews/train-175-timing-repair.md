# Change review — train-175 bounded fixture timing repair

Subject base: 31b3fc8c7748b6f3ddbed7c0d10e756420c7cf96
Review state: open
Reviewed content: none
Outcome: Keep crash-cut worker IPC responsive, separate independent crash proofs, and give launcher reconstruction and takeover fixtures their existing operational time bounds.
Affected rules: 26, 31, 34, 37, 55, 60, 63, 70, 74, 101, 112, 113, 116
Affected floors: secrets — no custody change; spend cap — no provider or budget change; stop — retain three-second signal response and explicit stopped-launch refusal; no duplicate sends — retain exact send accounting and stale-owner controls; durable intake — retain all crash cuts and replay assertions.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test orchestration only; no runtime prompt, parser, model judgment, authority, resource ceiling or delivery behavior changes.
Side effects: Awaited child processes let Vitest receive task updates and drain pipes. Each append cut is independently reported; poison scenarios are split by cut without dropping any history/loss combination. Startup and status reconstruction use the existing cutover fixture's 30-second ceiling. The owner-loss case uses the shipped authority's 30-second term instead of a shortened six-second term; explicit owner-loss and expiry assertions remain.
Undo and recovery: Revert this test-only commit. No installed state or migration changes. Old red gate evidence remains retained.
Multi-machine posture: Test orchestration is machine-local. The two-process fixture still proves shared ownership, replicated history, peer-loss send holds, takeover, hand-back and no duplicate sends; it is not a new physical multi-host proof.
Layer below: tests/e2e/async-child.ts child close/timeout behavior; tests/setup/yield-worker.mjs IPC yield; crash workers' durable append boundaries; journal-agent signal and status paths; createLeaseHolder's one-third safety margin and conversation-authority-server's default term.
Bug class: none
Bug evidence: Supplied fail-fast excerpt: six failed cases in four files plus one worker RPC timeout. The 66.7-second append-cut case was synchronous throughout, exceeding the 60-second case and RPC window. Launcher status/startup failures hit 10-second test-only ceilings. The owner-loss case passed unchanged in isolation; a passing rerun is not exoneration. The existing 4500ms sleeping transport reproduces failure with the old six-second term (71.17s, standby never holds the whole journal) and passes with the shipped 30-second term (66.81s). The exact gate survivor-read failure is not claimed reproduced. The delayed path is now a permanent parameterized case alongside the zero-delay case.
Hook bypass: none
Convergence: none
Prompt review: No prompt, output parser or acceptance rule changes. Canary inputs and all model/review assertions stay intact. This is not a model-facing change.

1.x FIRST: searched actual JKHeadley/instar origin/main 9b5790e8105f94c8ad6f13243d063e7c7efd23b6 src/ and docs/specs/ for event-loop, signal, subprocess and polling behavior. Read src/core/hostTestRunnerSemaphore.ts and docs/specs/test-runner-concurrency-bound.md; inspected history 1f90fa1a9, 618560b3e, c91b8780e, 681f86543 and e1a1b7218. Read ONEX-LESSONS section 6. Reuse bounded asynchronous waiting and real-state evidence as design principles. That host-wide semaphore does not repair an intra-worker blocking child matrix: existing 2.0 tests/e2e/async-child.ts is the direct code fit. No unrelated 1.x runtime code is transplanted. The additional supplied provider stack frames and session-host assertion inherit the repair comparison at 36290662ca8ace97def8a08874d087f8050860b8 in reviews/train-175-census-gate-repair.md; the current head's supplied gate explicitly reports those cases passing, so this repair does not duplicate that owning change.

Decision: train175-child-waits | Reuse the existing awaited child helper and independent case boundaries; retain real crashes, uncertainty and exact-successor controls. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md
Decision: train175-fixture-bounds | Use existing launcher reconstruction bounds and shipped lease term; preserve the separate signal-response and explicit stale-owner tests. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md

Verification: `nice -n 10 npx vitest run --maxWorkers 1 tests/e2e/harness-adapters-round7-regression.test.ts tests/preview/journal-agent.test.ts tests/preview/review-layers-canary.test.ts tests/preview/two-machine-runner.test.ts` passed all 43 tests in four files (560.78s), with no unhandled runner errors. This includes all nine append cuts, exact-successor control, pending/torn owner recovery, all twelve poison history/loss combinations, three signal pause/resume cases, all review canaries, both owner-loss delays and both stale-owner controls. `nice -n 10 npx tsc --noEmit` and `nice -n 10 npm run build` passed. Final committed-head cheap-check outputs and publication evidence are in the absolute lanes progress record. No full-suite result is asserted.

## Closing block

simplestRobustRoute: Correct the test drivers at their source using existing async children, independent cases and shipped timing contracts. No global serialization, quarantine, new service, product restriction or retry is added. The start guards remain fixture admission; end guards remain exact assertions; limits remain finite child deadlines, case deadlines and one foreground test worker.
80/20: Verify the four affected files and injected slow-path comparison, then typecheck and final cheap gates. The pipeline owns the next full-suite result; this record does not claim one.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
