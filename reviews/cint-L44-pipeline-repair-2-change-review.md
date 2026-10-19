# Change review — cint-L44 pipeline repair 2: conversation-loop tests yield per turn so the runner RPC deadline is not starved

Subject base: 89acbb62d2f94128b1c45cca2a5c94804a4827fd
Review state: open
Reviewed content: none
Outcome: Plan row #435. The studio full run of cint-L44 at 89acbb62 passed every test (5820 passed, 194 skipped) but exited 1 on one unhandled runner error, "[vitest-worker]: Timeout calling onTaskUpdate". The earlier repair treated it as load-only; it recurred, so it was traced. A temporary worker-side stall probe (a 500 ms interval logging any gap over 4 s with the running test, never committed) over the files with the longest single cases reproduced the error: tests/preview/default-root-conversation.test.ts blocked the fork worker's event loop for 64 s in one stretch ("keeps the declaration duty in every packet of a default-size root under byte pressure") and 45 s in another, and that probed run ended with the same runner error. Every port in its conversation loop resolves as a microtask, so twenty-plus turns never reach the I/O phase and the task-update reply waits past birpc's fixed 60 s deadline. tests/preview/long-conversation-program.test.ts had the same shape (35 s over 200 turns). Both loops now await one real setImmediate turn (imported from node:timers) after each message. Re-probed: worst stall 8.4 s, no runner error, 7/7 pass. Other probed files stalled for at most 24 s: register, production-serving, renew-activation, renewal-predecessor-launch, journal-migrate, host-watch, round20, sequential-serving-admission, self-host-tools and production-boot shard 0. docs/defects/vitest-worker-rpc-timeouts.md records the third cause.
Affected rules: 37 (fixed at source; the defect record gains the cause and stays open until a full run is clean), 116 (one awaited yield per loop, the landed pattern of round20/round24/intake-owner), 74 (this record)
Affected floors: secrets, spend cap, stop, no duplicate sends, durable intake — all unchanged (test scheduling only; no runtime path changed)
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: test scheduling only; no assertion, timeout or runtime behaviour changes.
Side effects: none beyond a few milliseconds per test turn.
Undo and recovery: revert the repair commit.
Multi-machine posture: unchanged; no runtime path is touched.
Layer below: tests/setup/yield-worker.mjs (yields between cases only, which cannot help a single long case).
Bug class: none
Bug evidence: none
Hook bypass: none (plain commits; core.hooksPath is unset)
Convergence: none
Decision: cint-L44-pipeline-conversation-yield | yield a real event-loop turn per conversation message in the two microtask-only conversation loops instead of lowering workers or raising the runner deadline: the probe showed a 64 s single-case block, which load-tuning would only hide | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L44-PROGRESS.md
Prompt review: no model-facing text is added or changed.

Subject (3 paths): docs/defects/vitest-worker-rpc-timeouts.md, tests/preview/default-root-conversation.test.ts, tests/preview/long-conversation-program.test.ts

## Closing block

simplestRobustRoute: one awaited setImmediate per conversation turn in the two loops the probe named, matching the yields already landed in other long single-case files.
80/20: 0 must-fix, 1 note: targeted probe runs only (no full suite on this machine tonight); the pipeline reruns the full suite.
VERDICT: author submission; the independent verdict is recorded as a pass
