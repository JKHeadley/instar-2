# Change review — restore complete native turn grounding

Subject base: a1b59d03faad205e33fc33dc6915825abfecb635
Review state: open
Reviewed content: none
Outcome: Remove delta-turns-1015 product machinery and its delta-only tests; every continuing native turn receives its complete envelope through the existing packet-once path.
Affected rules: Rules 1, 29, 32, 36, 46, 47, 49, 58, 60, 70, 74, 75, 96, 101, 102, 110, 111, 113, 116; purpose constraint 2.
Affected floors: secrets — custody and scrubbing unchanged; spend cap — cumulative reservation and call limits unchanged; stop — admission, retirement and stop unchanged; no duplicate sends — operation identities, accepted-input replay refusal and result mapping unchanged; durable intake — original requests and dispatch custody unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Removes unsuccessful model-input optimization and its recovery cache. No new authority or policy; native composition certificate requires the desk's platform run.
Side effects: Continuing turns carry complete instructions and packets again. Larger input is expected; original full-envelope byte bound and batching stay intact. Remove the disposable snapshot writer, adapter recovery marker and added hook-size expansion together. Existing lifecycle hooks remain. No live root or model account is accessed.
Undo and recovery: Revert this commit to restore delta reuse. Existing durable requests, accepted deliveries and outcomes need no migration and are never replayed by this change. Old disposable snapshot files are unused, not deleted. The later topic-login-pool test loses only the import, injected helper and assertions for this removed snapshot API; all account isolation assertions remain.
Multi-machine posture: The removed cache was worker-local. All owners now construct complete input from existing durable custody; ownership, forwarding and grant checks are unchanged.
Layer below: Compared the complete native turn builder against train-46 d97249b5: exact source blob aa5781940b6f2d23fefa11edc5aa5e4d8c337eca. Inspected delta branch b4ba0fdf and its native snapshot/hook/adapter wiring. Kept packet-once, summary cut, reaction evidence, asynchronous review, receipt/banner fixes, class-scope resolution and removed COMPLETE_REQUESTED_STEPS guidance from train-44.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts; live=tests/preview/fixtures/packet-once-walk-2026-10-14.json
Hook bypass: none; checked core.hooksPath (unset) and common hooks directory (sample files only).
Convergence: none
Prompt review: Replay existing captured walk requests through single and batched native delivery on continuing and replaced workers. Baseline delivery digests were captured only after verifying the entire builder source equals train-46 d97249b5. Replay captured summary-writer, summary-uncertain, Jev undecided/unsure, reply-review, delivered-reply and empty-reply shapes on repeated and changed inputs, asserting each complete envelope survives every turn. No model quality or latency claim.
Decision: revert-delta-scope | Reverse b4ba0fdf product and delta-only test hunks, preserving later policy-pin repairs, historical review records and desk-owned certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-PROGRESS.md
Decision: revert-delta-replay | Use the brief's allowed existing recorded fixtures; compare delivery digests with the byte-identical train-46 builder and replay the seven captured model-output shapes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-PROGRESS.md

simplestRobustRoute: Restore the existing complete-input turn builder rather than refine an optimization with no measured speed gain. Remove its cache, snapshots and recovery capability marker together. Existing start/admission, durable dispatch, stop, result mapping, byte bound and allowance guards remain. This is offline revert verification; no autonomous shipped-path completion or live deployment is claimed.
80/20: Targeted changed/direct-consumer tests and pinned READY tests, typecheck, architecture, lint, register and change-review checks; no full suite or proof rooms.
VERDICT: author submission; no independent convergence or live acceptance claim
