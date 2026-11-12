# Change review — Bound retired context and preserve legacy correction work

Subject base: 21667c6351a95556479e15057b8021dda905ffa6
Review state: open
Reviewed content: none
Outcome: Ordinary replies remain reachable as the retired archive grows, and unresolved legacy rejected results remain owned correction work.
Affected rules: 4, 7, 8, 10, 11, 36, 44, 49, 52, 60, 63, 67, 70, 74, 77, 83, 87, 93, 97, 101, 102, 111, 113, 116, 123
Affected floors: secrets — existing redaction and source audience apply; spend cap — lookup uses the existing one-call reservation; stop — existing call and send checks remain; no duplicate sends — unchanged durable intent and notice binding; durable intake — unchanged encrypted journal admission
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Two narrow lifecycle/context repairs in the existing journal, with no new authority or store; retained lookup remains bounded by existing admission.
Side effects: Retired context participates in the existing whole-report fallback and explicitly counts omissions. Archived source subjects are eligible for the existing one-call lookup even before history compaction. Legacy withheld rows no longer retire on age/checklists alone; seven of the supplied eleven retire, four stay unresolved. Delivery-only deferrals still keep their ordinary report path.
Undo and recovery: Roll forward: reverting restores both demonstrated regressions. Existing journal ownership and snapshot format remain. This is a pre-landing repair of the rejected retirement writer; do not switch a live root that already contains retirement facts accepted only by the rejected legacy predicate without an explicit evidence-based recovery. No live root was mutated.
Multi-machine posture: The same journal owner prepares bounded per-turn context and appends retirement facts; shared history, ownership transfer, snapshots and send bindings retain their existing semantics. No machine-local lifecycle ledger.
Layer below: Inspected retirementCandidates, withheld/rework projection, later accounted result settlement, snapshot replay, packetFor/preparedFor, envelope fitting and lookupRecall. C1:34/92 and C2:42/43/51/94/157 retain visible undelivered state; C1:35/36/91 and C2:165 require closure evidence. The retained rejection is evidence that a pre-rejection checklist cannot discharge.
Bug class: integration
Bug evidence: reproducer=tests/preview/stale-results-retire.test.ts; recorded-shape replay=tests/preview/summary-cascade-stall.test.ts; base failure and final commands in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/stale-results-retire-1112-r2-repair-PROGRESS.md
Hook bypass: none; core.hooksPath unset; inspected hooks directory contains sample hooks only; plain git commit
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: Retired-result guidance discloses omission and the existing source-subject lookup. No keyword classifier, cap increase, archive deletion or new semantic disposition. Real summary writer/uncertain outputs, Jev unsure and subscription review outcomes replay; captured ordinary reply and empty-reply absence exercise bounded retired context. Empty absence is explicitly not claimed as a delivered bubble. No fresh live model claim.
Prompt finding: 105c1569b6bb | protocol-literal | Unchanged protocol guidance inherited from the reviewed base, not a new classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged protocol guidance inherited from the reviewed base, not a new classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 7ef11b68103f | protocol-literal | Unchanged protocol guidance inherited from the reviewed base, not a new classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged protocol guidance inherited from the reviewed base, not a new classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Unchanged protocol guidance inherited from the reviewed base, not a new classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | protocol-literal | Unchanged protocol guidance inherited from the reviewed base, not a new classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | protocol-literal | Unchanged protocol guidance inherited from the reviewed base, not a new classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged protocol guidance inherited from the reviewed base, not a new classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject (4 paths): tests/preview/README.md, tests/preview/journal.ts, tests/preview/stale-results-retire.test.ts, tests/preview/summary-cascade-stall.test.ts

Team posture: Only the verified operator in the source topic receives retired-result context or its lookup. A different topic sees no archive content/count/notice; the regression covers both sides. Existing team-of-one preview scope is unchanged.

1.x comparison: JKHeadley/instar origin/main db3ed6d3052cfcc24888b6c8bc86086abcfc2987 in the local source repository: src/monitoring/CommitmentTracker.ts reconcileGraveyard (1153–1195), expireSync (2291), autoExpiryDisposition (2315–2389); src/monitoring/PromiseBeacon.ts nonterminal risk; docs/specs/agent-owned-followthrough.md §4.5, auto-expiry-review-ledger.md and auto-expiry-holds-and-archive.md; git history 4018bf338, 1b4350998, e8576a096. Reuse evidence-gated closure, retained reason and active-work exclusions through the 2.0 journal; broad inactivity expiry does not fit. Read available canonical lanes/ONEX-LESSONS.md sections 2/3/5 (context wall, reachability fail direction, commitment coherence, correction verification). Reconciled design C1:34/92 and C2:42/43/51/94/157 retains visible undelivered state; C1:35/36/91 and C2:165 require evidenced closure.
Decision: repair-context | Reuse bounded whole-result fallback and disclose omissions; preserve source-scoped archive. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stale-results-retire-1112-r2-repair-PROGRESS.md
Decision: repair-legacy | Require a current unopposed report; missing new markers do not discharge a retained old objection. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stale-results-retire-1112-r2-repair-PROGRESS.md
Decision: repair-lookup | Use the existing one-call lookup for archived sources before or after compaction and prioritize its exact source matches. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stale-results-retire-1112-r2-repair-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse whole-report context fitting for the archive and require a current unopposed report before retirement. A withheld objection remains on the existing correction route until an accounted result replaces it. Start guards retain verified source, age, complete checklist, no active dependency/send/defect; end guards retain archive and notice binding; limits retain the same cap/stop and scoped one-call lookup. Synthetic unattended retirement plus recorded-room replay demonstrate writer mechanics, not a live deployment.
80/20: Both reproduced must-fixes repaired at source. Twenty-two touched-file tests cover bounded answers, full omission, retained lookup, source audience, current/legacy defects, corrected completion, once-only notice and recorded summary/review shapes. No broader redesign.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
