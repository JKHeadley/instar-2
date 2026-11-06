# Change review — train-189 timeout evidence and handoff outcomes

Subject base: 7b509a7229b85c06115c3013f52405eb9be0949f
Review state: open
Reviewed content: none
Outcome: A clean multi-machine shutdown retries pending authority outcomes once before draining the journal and releasing the lease. Provider timeout tests distinguish invocation from server arrival.
Affected rules: 15, 26, 31, 34, 37, 42, 63, 70, 74, 101, 102, 111, 113, 116
Affected floors: secrets — unchanged references and ports; spend cap — maximum exposure retained on provider timeout; stop — bounded best-effort teardown always attempts release; no duplicate sends — outcomes retain their original claims, no send or claim retry is added; durable intake — existing replication and cursor barriers unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The runner's multi-machine shutdown and ownership handoff are production behavior even though the composition lives under tests/preview.
Side effects: Shutdown can perform one existing bounded authority request per queued outcome before its existing bounded peer drain. A still-unreachable authority keeps unresolved claims; this change does not manufacture a receipt or guarantee recovery from permanent loss.
Undo and recovery: Revert the repair commit and its generated register updates. No live installation, store or service is modified by this submission. Retain the failed gate evidence.
Multi-machine posture: The original claimant reports its outcome even after fence loss. Journal drain remains conditional on current ownership, and release still runs after failures. No local-durability fallback or second send is admitted.
Layer below: The runner settles its ordinary lane before shared.stop, but an outcome request can have returned unreachable and queued a retry. The polling sync no longer runs during teardown. The existing stop drained only journal bytes and released ownership, abandoning that queued outcome. The shared handoff helper invokes the existing flush once before those existing steps; it neither clears uncertainty nor waits for authority recovery indefinitely.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-replication.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt text, model output parser, model acceptance decision or model dispatch policy is changed. journal-agent.mjs only imports and calls the handoff helper after its ordinary lane has settled.

Decision: TRAIN189-TIMEOUT-OBSERVATION | Assert exactly one driver invocation across timeout and refused redispatch, allow zero or one observed HTTP arrivals, and force an already-elapsed signal to cover the previously failing boundary without widening timeouts or releasing exposure. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-189-repair-093005-PROGRESS.md
Decision: TRAIN189-HANDOFF-FLUSH | Reuse dispatch.flush once before journal drain and lease release; extract only this short lifecycle so actual queued outcomes and failure ordering are directly testable. Never erase unknown claims or resend. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-189-repair-093005-PROGRESS.md
Decision: TRAIN189-REGISTER | Regenerate the seven register outputs from source commit 971c1f6eebaa4fb3377c58cbfa407fe6be1138cf using the existing replay builder. Desk owner-manifest and grounding-chain refreshes changed no pins; do not hand-edit generated authority or pins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-189-repair-093005-PROGRESS.md

1.x comparison: Inspected actual JKHeadley/instar main 2bd3882dcdb7d1f56f66233b0cd377edaadf6b27: src/templates/scripts/telegram-reply.sh, src/core/shutdownDeadline.ts, src/core/hostTestRunnerSemaphore.ts; outbound-timeout-408-ambiguous and conformance-gate-timeout design documents; histories 52f21c89d, 5319c1689, 64e1641ee, 1f90fa1a9, 618560b3e; ONEX-LESSONS sections 1, 3, 6. Exact document paths are recorded in the cited progress report. Fit: ambiguous transport outcomes retain identity and graceful cleanup remains bounded. Mismatch: the 1.x server/relay lifecycle does not implement 2.0's replicated dispatch authority. Reuse the existing 2.0 flush and release, not the unrelated host scheduler or relay code.

Verification: Provider refusal integration, journal replication and direct importer live-sentinels tests; unchanged real two-machine runner lifecycle; typecheck/build; final lint, register and change-record checks. Deterministic regression uses the real authority log, lease and dispatch queue with a failed first outcome request, then both recovered and still-unreachable authority cases. Negative cleanup controls preserve stop and flush without a current fence. Runner wiring assertion locates the real handoff and settlement order. Exact results and host limits are in the report.

## Closing block

simplestRobustRoute: One bounded use of the existing outcome queue at the lifecycle boundary replaces losing the last outcome. The helper merely makes the existing three cleanup steps testable; no retry service, journal interpretation, new state or timeout increase is introduced. Provider tests measure the attempted call at its actual boundary and retain all exposure and pending-step checks.
80/20: Target the two reported failures and directly affected modules. The Studio owns the full suite and native certificate qualification.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
