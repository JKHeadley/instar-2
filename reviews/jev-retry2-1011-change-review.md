# Change review — one bounded Jev reply retry

Subject base: 7002feeb7cd44c8ea2ec2500aa005999962ff3b1
Review state: open
Reviewed content: none
Outcome: Record content-free Jev failure causes and rescue one transient reply-check failure within a short budget, preserving the existing full subscription review after unsuccessful attempts.
Affected rules: Purpose least revelation and durable cause; Rules 1, 26, 34, 36, 39, 41, 49, 55, 58, 60, 63, 67, 70, 74, 75, 77, 95, 101, 102, 111, 113, 116.
Affected floors: secrets — diagnostic causes contain no response or exception text; spend cap — each retry reserves separately against the existing Jev allowance and retains unknown first-call spend; stop — the worker checks stop before the retry reservation; no duplicate sends — send intents and restart behavior remain; durable intake — the existing journal retains the turn and each reservation/check.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The reply-check retry touches a durable paid-call reservation and the latency before a user reply; parser acceptance, model prompts and full-review verdict semantics remain unchanged.
Side effects: One retry consumes a second unit of the existing maxReplies-bounded Jev call allowance, so later turns may fall back earlier when that allowance is exhausted. Unknown attempts remain unknown even after a successful retry. Every unavailable attempt adds a cause and remains in replyChecks, including rescued attempts. Each client call has an abortable deadline covering admission and response reading; a late admission cannot start a provider call. Slow admission outside the host client and synchronous journal work are not hard real-time guarantees. Summary and other Jev consumers retain their existing post-admission timeout and receive no new retry.
Undo and recovery: Prefer a forward correction that disables retry dispatch but retains the additive retry reservation reader. Do not downgrade a journal containing retry reservations to a reader that refuses duplicate Jev reservations. Restart records an interrupted retry as unavailable with cause other and never reissues an interrupted first or second attempt; it uses the existing contextual fallback. Existing journals lacking retry/cause fields remain readable.
Multi-machine posture: The retry belongs to the existing conversation owner and journal. It uses the same host peer/disclosure checks. No new store or replication path; the additive journal record follows existing replication and snapshots. Every reader of a journal containing retry rows must run the compatible reader.
Layer below: Inspected journal reservation admission, token reservation and settlement, unknown-call keys and cap write-off, stop/gate wrappers, restart handling, disclosure checks, model-call recording and reply-review fallback. A retry cannot share the first attempt's accounting key: doing so would erase uncertain spend. The existing reservation record carries a retry flag instead of introducing a separate queue or scheduler.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample hooks only.
Convergence: none
Decision: jev-bounded-retry | Use 850 ms per attempt, an 1800 ms elapsed Jev budget and at most one newly reserved retry of unavailable; valid unsure/violation verdicts keep the contextual route. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-retry2-1011-PROGRESS.md
Decision: jev-cause-and-accounting | Keep every unavailable attempt with a bounded cause and retain its unknown spend under a distinct retry reservation key; never infer the cause of the historical rows. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-retry2-1011-PROGRESS.md
Decision: jev-recorded-replay | Replay the desk's four content-free live rows and the existing recorded Jev pass through the shipped client and durable worker with injected transport failures; no live root or provider is needed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-retry2-1011-PROGRESS.md
Decision: jev-publication-pins | Regenerate the existing shape-only register from source commit 417c3f62a5fb0e23a9cfe624a0b124791b834696 without changing declarations or runtime authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/jev-retry2-1011-PROGRESS.md
Prompt review: No model prompt, accepted model-output shape, confidence threshold or reviewer rule selection changes. The real unavailable shapes at updates 969390355, 969390371, 969390389 and 969390397 and the Jev pass/delivered reply at 969390330 drive the new paths. Failure transport causes are labelled injected; those causes were absent from the live journal. Fixtures contain no expected answer in a dispatch prompt. Synthetic cases additionally cover all cause categories, malformed scores, unsure, stop, cap, crash and deadline boundaries.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory reply text in journal.ts, unchanged by the retry and not a model trigger.
Prompt finding: bd01de21286a | protocol-literal | Existing source-citation instruction in journal.ts, unchanged by this change and not a fixture-specific block.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing recall guidance in journal.ts, unchanged by this change and not a fixture-specific block.
Verification: The focused retry suite verifies successful rescue without fallback, double failure with exactly one contextual fallback, retained unknown spend across restart, no duplicate send, and no late dispatch after timed-out admission. Existing reply-check, cost, spend-cap and Jev-stage tests pass. Direct consumers and the required final READY checks are recorded in the builder report.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing client, reply-check cascade, journal reservation and contextual fallback. One optional retry flag and one accounting key prevent unreserved or erased spend; one abort deadline prevents an unavailable provider or admission from delaying the caller indefinitely. Start guards are stop, allowance and disclosure; end guards are the unchanged interpretation and fallback; limits are two attempts and the existing turn deadline. Offline shipped-client/worker replays establish this bounded behavior; this submission makes no live rollout or independent convergence claim.
80/20: The supplied failure shapes exercise both requested outcomes, with cause, budget, cap, stop and restart neighbors. No new retry service, telemetry store, model prompt or heuristic decision was introduced. Independent review and live rollout belong to the desk gate.
VERDICT: author submission; independent review is not claimed
