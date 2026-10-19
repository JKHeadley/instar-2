# Change review — Keep pipeline fixture watchdogs separate from behavioral evidence

Subject base: 4f5f1484892e4197cdcff064b22ea86bf7be4862
Review state: open
Reviewed content: none
Outcome: Keep gate fixture execution bounds separate from product behavior and leave the worker event loop responsive while real child processes run.
Affected rules: 26, 34, 37, 42, 49, 60, 70, 74, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — no production custody changes; spend cap — no production budgets changed; stop — unchanged and still asserted; no duplicate sends — assertions retained; durable intake — restart/cold-reader assertions retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test fixtures, scheduling and watchdogs only. No shipped source, prompt, semantic parser, production authority or runtime policy changes.
Side effects: Tests can occupy a worker longer before reporting a hang, but child waits yield IPC and remain finite. Existing async helper now pipes stdin and refuses a graceful zero exit after timeout; ignored TERM escalates on the exact child PID. Native host tests remain dependent on their actual host facilities.
Undo and recovery: Revert this repair and regenerate the source pins/register with the supplied tools. No runtime state or migration changes; all accepted and UNKNOWN effect records remain untouched.
Multi-machine posture: Deliberately machine-local fixture scheduling and child watchdogs. No agent ownership, replication or shared-state behavior changes; tests and documentation travel with the repository.
Layer below: Inspected Vitest fork IPC, the existing async and synchronous child helpers, provider admission versus HTTP driver timeout, the native limit shim, and supplied gate timings. The production shim refuses on WSL dash ulimit -u; no shim bypass is added.
Bug class: integration
Bug evidence: reproducer=tests/unit/async-child.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: train-77-repair-async-fixtures | Reuse async child waits and matrix yields to avoid worker IPC starvation without relaxing assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-77-repair-223823-PROGRESS.md
Decision: train-77-repair-watchdog-budgets | Use finite fixture budgets based on the supplied Studio timings; keep timeout, stop and cap subject limits intact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-77-repair-223823-PROGRESS.md
Decision: train-77-repair-provider-budget | Make admitted fixture execution timeout explicit and prove a delayed successful receipt before settlement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-77-repair-223823-PROGRESS.md
Decision: train-77-repair-timeout-refusal | Keep timeout red after graceful zero exit and kill only the exact child PID if TERM is ignored. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-77-repair-223823-PROGRESS.md
Skip: tests/e2e/session-restart-delivery.test.ts:18 | scope=Existing availability guard for the Studio tmux path is unchanged; this repair only makes its child wait asynchronous.

Subject (31 paths): tests/assembly/production-grounding-checker-round4b.test.ts, tests/conversation/telegram.round10.integration.test.ts, tests/conversation/telegram.round17.integration.test.ts, tests/conversation/telegram.round7.integration.test.ts, tests/e2e/async-child.ts, tests/e2e/rungraph-closure-review18.test.ts, tests/e2e/rungraph-closure-review21.test.ts, tests/e2e/rungraph-closure-review22.test.ts, tests/e2e/scheduled-package.test.ts, tests/e2e/scheduled-round6.test.ts, tests/e2e/scheduled-round9.test.ts, tests/e2e/session-restart-delivery.test.ts, tests/integration/provider-child-kill.test.ts, tests/model-provider/fixture.ts, tests/preview/channel-source-launcher.test.ts, tests/preview/channel-source.test.ts, tests/preview/held-reply-notice.test.ts, tests/preview/journal-compaction.test.ts, tests/preview/journal-memory-correction.test.ts, tests/preview/journal-reminder-launcher.test.ts, tests/preview/journal-requested-action.test.ts, tests/preview/journal-spend-cap.test.ts, tests/preview/media-understanding.test.ts, tests/preview/memory-export.test.ts, tests/preview/offline-canary.test.ts, tests/preview/reviewer-thinking-bound.test.ts, tests/preview/self-state-launcher.test.ts, tests/register/wiring.test.ts, tests/transport/settlement.test.ts, tests/unit/async-child.test.ts, tests/unit/model-provider-six-settlement.test.ts

Prompt review: No model-facing text, parser, decision policy or delivered output changed. Fixtures retain existing responses; no live recorded-shape replay is claimed or required for test scheduling.

Verification: Portable targeted evidence and host-dependent failures are reported separately in the operator report; no full-suite pass or independent convergence claimed.

Register refresh: The supplied desk rehash tool refreshed four preview source pins; the supplied repin chain changed no inventory or checker bytes. Generated publication is reproduced in shape-only replay mode from repair pin commit 9564c760a3c2cd23e3cc525b96bf728ae063fc53; no pin is hand-edited.
Deferral: generated/register.json:1 | not-a-deferral=Existing governed declaration text reproduced by the register generator; no work is deferred.

## Closing block

simplestRobustRoute: This is that route: reuse the existing async child helper, yield between existing matrix rows, and size finite fixture watchdogs from recorded gate failures. Start is the existing fixture admission; end is the actual child result plus unchanged assertions; limits are finite timeouts, exact-PID cleanup and one-worker targeted execution. Added timeout bookkeeping prevents graceful zero exits from falsely certifying expired runs. No unattended shipped-path completion is claimed.
80/20: Targeted files and direct fixture consumers plus cheap gates. No whole suite, second worktree, load generator or production-policy repair; Studio owns full-run closure.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
