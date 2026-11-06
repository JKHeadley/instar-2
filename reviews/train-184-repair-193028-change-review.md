# Change review — Repair train-184 child lifecycle test evidence

Subject base: f64f917a274dfcc9dec84db08bd7a3c460d591f3
Review state: open
Reviewed content: none
Outcome: Make the five reported gate failures test their intended process boundaries without event-loop starvation or a false HTTP invocation marker.
Affected rules: 26, 34, 37, 42, 55, 60, 70, 74, 95, 101, 102, 111, 113, 116
Affected floors: secrets — synthetic local credentials only; spend cap — unchanged; stop — unchanged, child waits bounded; no duplicate sends — restart assertions retained; durable intake — persistent uncertainty assertions retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test infrastructure repair only. Production source, policy and authority are untouched; real process, HTTP and durable-state assertions remain.
Side effects: Round7 reports separate boundary cases; asynchronous waits allow the worker RPC to run. Crash fixture can explicitly request a larger coordinated test-only invocation window; other tests retain the 100ms default. Real audio test allows the existing decoder chain to finish.
Undo and recovery: Revert this repair commit to restore earlier test drivers. No production data or schema changes; disposable test roots retain crash evidence.
Multi-machine posture: Machine-local disposable test processes and synthetic credentials. WSL runs portable checks; Studio supplies installed media tooling and native host checks. No Studio writes.
Layer below: Inspected cutoverHarness async runLive/statusOf, local-transcriber 30s/90s subprocess limits, provider invocation bounds/uncertain observation handling, and the signed owner append crash workers.
Bug class: integration
Bug evidence: reproducer=tests/e2e/model-provider-path.test.ts
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->

## 1.x comparison

Actual JKHeadley/instar main 9b5790e8105f94c8ad6f13243d063e7c7efd23b6 was searched in src/, docs/specs/ and history. src/core/SessionLivenessOracle.ts uses bounded asynchronous probes and retains indeterminate on timeout. docs/specs/unified-session-lifecycle-robustness.md records the nine-live-session false-death incident; docs/specs/test-runner-concurrency-bound.md and history 618560b3e/c91b8780e/2aaac4288 identify aggregate concurrency pressure. ONEX-LESSONS.md lifecycle and resource/testing areas were read. Reuse the async bounded observation and truthful uncertainty behavior, not the unrelated session oracle implementation. Existing 2.0 runLive/statusOf are the matching implementation.

Decision: train184-repair-async | Await child completion and separate independent crash cuts so worker reporting remains live; reject watchdog expiry instead of treating it as an intentional crash. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-193028-PROGRESS.md
Decision: train184-repair-http | Use a coordinated 10s fixture invocation window for crash tests, retain 100ms defaults elsewhere, and require an observed response before printing the crash marker; cover a slow response and a timed-out response. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-193028-PROGRESS.md
Decision: train184-repair-media | Give the real decoder test 150s to cover its existing 30s and 90s children plus cleanup; do not alter production timeouts or skip the proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-193028-PROGRESS.md

Subject (6 paths): tests/e2e/harness-adapters-round7-regression.test.ts, tests/e2e/model-provider-path.test.ts, tests/model-provider/crash-worker.mjs, tests/model-provider/fixture.ts, tests/preview/media-understanding.test.ts, tests/preview/proofs-launcher.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: use existing async harness APIs, await bounded child completion, split independent crash cases, and align fixture budgets with their child operations. Require actual HTTP response evidence before claiming the crash point. No production machinery or new service. Start guards are existing admissions, end guards are child close plus assertions, and limit guards retain finite timeouts. No autonomous-completion claim.
80/20: Repair the four named test files and their two direct provider helpers, keeping all persistence/refusal assertions. Run only affected checks; full gate and native evidence remain the desk responsibility.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
