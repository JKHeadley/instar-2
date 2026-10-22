# Change review — Durable promises and due-time wake

Subject base: 588332d9d0839cd504bee2819e297cd6222a2ef9
Review state: open
Reviewed content: none
Outcome: the journal-backed promise projection and work schedule belong to the run-graph package. A disposable transport wake requests due work after restart without waiting on a poll; explicit requested-result delivery retains its existing durable identity and destination.
Affected rules: 4, 8, 10, 30, 31, 32, 34, 36, 49, 52, 55, 60, 63, 68, 70, 74, 83, 87, 92, 101, 111, 113, 115, 116, 117
Affected floors: secrets, spend caps, stop, duplicate-send prevention and durable intake remain at the existing journal/host boundaries. Timer callbacks authorize no effects.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: moves owned promise state/scheduling into core and wakes the shipped worker on durable deadlines.
Side effects: due work may begin during a slow poll, through the same bounded ordinary lane used before polling. Delivery still requires the successful-empty-poll withdrawal barrier. No prompt, parser, send permission, retry count or cadence changes. Resolved absolute deadlines retain seconds rather than rounding to calendar minutes.
Undo and recovery: revert code and regenerate the source register. The journal wire format is unchanged, so either version reads existing records. Timers carry no durable state.
Multi-machine posture: shared owner journal remains authoritative. The host checks current ownership and peer durability at every admission; machine-local timers are rebuilt after restart and cannot grant ownership.
Layer below: read the purpose and rules, D18 section 6, carry-over row 01, keep/cut table and the combined-contract report. The latter never landed; it explicitly leaves independent commitments work possible. The actual code already delivered explicitly requested results. Journal append validates on a copy, fsyncs, then changes its live projection. Existing ordinary-lane admission owns retries and current peer/owner checks.
1.x reuse: JKHeadley/instar origin/main 2d12a2a9a4fa2d0eb1280abdbd573234913ceb6b, src/monitoring/CommitmentTracker.ts owner/blockedOn and single-writer retained lifecycle, src/monitoring/PromiseBeacon.ts schedule/fire durable anchors, current-state reread and default internal follow-through. The existing 2.0 journal supplies serialized durability instead of adding a second CAS queue or filesystem store. Its stronger unknown-never-replay policy remains.
Contract gap: the signed RunGraph REGISTER/READ/CLOSE due-item contract described in D18 is still unlanded. This slice uses the existing journal admission/storage adapter and does not claim that larger contract. Six had durable nextWake and bounded scan records but no exported timer seam; the new injected helper only requests existing lane work.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/promise-wake.test.ts; live=tests/preview/fixtures/requested-report-proofroom4-2026-10-17.json
Hook bypass: none
Convergence: none
Decision: one-projection | retain the existing journal wire shape and move the promise projection and schedule into Five; no competing store | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step3-commitments-1022-PROGRESS.md
Decision: wake-is-a-hint | port PromiseBeacon's durable scheduling through injected Six ports and the existing bounded lane; no timer sends or private harness route | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step3-commitments-1022-PROGRESS.md
Decision: contract-gap | preserve constitution-compliant durable dispatch and existing requested-result authority while the larger signed due-item seam remains unlanded | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step3-commitments-1022-PROGRESS.md

simplestRobustRoute: use the existing encrypted journal, source-bound request, bounded worker lane and result/send receipts. This is the simplest robust route. The added timer prevents a due promise waiting for an unrelated poll; it is one disposable hint rather than a new queue or beacon service. Start guards are current owner, peer durability, stop, expiry and capacity. A work result does not close the promise; confirmed delivery or an admitted closure does. Unknown effects remain owned. Recorded proof-room update 46040219 is replayed through the shipped worker across a disk reopen, due wake and exact saved result delivery without another inbound. This is offline recorded-shape evidence, not a fresh live Telegram acceptance claim; the desk owns that gate.
80/20: targeted tests and pinned READY checks; full suite and live acceptance belong to the pipeline. No independent convergence claimed.

Verification: 148 targeted tests pass in ten files, including all recorded uncertain/undecided/empty shapes in owed-delivery. Typecheck and build pass. Restoring the old minute-rounded timing fails the new boundary assertion; the implemented absolute instant passes. The existing public run-graph export hashes are refreshed because that module now exports the promise projection. Architecture has only the charter-exempt native macOS composition certificate mismatch; its declaration remains untouched. Final pushed-head checks and exact outputs are recorded in PROGRESS.

Register replay: generated artifacts bind the committed source and refreshed existing export references; no authority declaration or conformance certificate was altered. The full historical review check reports three inherited prompt-disposition gaps in reviews/0095e19d-merge-live-ea75ce39-change-review.md and reviews/completion-guidance-1015-change-review.md, and no finding in this record. They are recorded for the desk rather than rewriting earlier authors' reviews.

Desk gate repair (after 5a19dc57864cfd9cc15fffe61815f3278308927e): the desk explicitly requested repair of R105 at its source. On the Studio, the native composition contract passed before changing the certificate (1 passed, 9 deselected, 21.06s). Re-declare only its conformance digest, computed by compositionClosure/compositionDigest across 270 files with the unchanged certified Node runtime. The new digest is sha256:6dea9a2cb255a03e40443fd960ab5b93a7af9abe37e455067951202c6926b121. This supersedes the earlier certificate exception and statement that the declaration was untouched. Rules 26/49/69/105/115: support is backed by the actual contract on the exact composition and runtime; no gate, supported status, authority or runtime behavior is relaxed. The full native contract file verifies the declaration after re-certification; final checks and register replay appear in PROGRESS.
Decision: certify-tested-composition | repair the stale supported certificate only after the Studio contract passes, then regenerate the register from committed source | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step3-commitments-1022-PROGRESS.md
