# Change review — Repair acknowledgement consumer expectations

Subject base: 4ceeadae6d1ee2ef97015bc672a5658434db9c84
Review state: open
Reviewed content: none
Outcome: Three consumer tests match the shipped eight-second fixed acknowledgement and cancellation before reply review; the reserve fallback remains covered when one reply slot prevents acknowledgement.
Affected rules: Rules 1/15/36/37/49/70/74/87/101/102/111/113/116.
Affected floors: secrets — existing checks unchanged; spend cap — one remaining reply slot suppresses acknowledgement; stop — unchanged, existing minimal stop tests exercised; no duplicate sends — no repeated acknowledgement or later limited reply, restart replay still checked; durable intake — existing journal-before-membership assertion retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair of stale expectations, with no runtime or model-facing change.
Side effects: Test counts gain one parameterized reserve-boundary case. Membership measurements now exclude obsolete acknowledgement probes; cold/warm cache coverage and final answer review remain.
Undo and recovery: Revert the three test edits and this record; no production state or schema is changed.
Multi-machine posture: Test-only, deliberately machine-local evidence. Runtime ownership, replication and durable acknowledgement intent remain unchanged.
Layer below: Inspected journal.ts acknowledgeReply, startAcknowledgement, limitedReason, minimal and answer-ready cancellation; fixed acknowledgements use held-notice intents and suppress duplicate limited responses. A clock-variable increment does not execute a real timer, and immediate settled answers cancel it before review.
Bug class: integration
Bug evidence: reproducer=tests/preview/minimal-responder.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: holdack3-consumer-expectations | Preserve shipped acknowledgement behavior and repair stale tests; cover both eight-second sides and the original reserve fallback with only one ordinary reply slot. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-holdack3-1012-repair-032851-PROGRESS.md
Prompt review: No prompt, parser or model decision changes. Existing recorded group replay and acknowledgement shape/timing replays are exercised unchanged.
Evidence: Five targeted files pass, 77 tests. The Studio saved full-report URL returns HTTP 404; no synthetic full-run report is supplied.

## Closing block

simplestRobustRoute: This is the simplest robust route: repair three consumer expectations, preserve runtime behavior, and retain both acknowledgement and limited-reserve coverage. Existing intake/admission, final-answer cancellation and durable send fences are the start, end and limit guards. No new machinery or autonomous capability is claimed.
80/20: Three named failing files plus the existing recorded acknowledgement replay files, compiler and cheap gates; no full suite or unrelated closure.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
