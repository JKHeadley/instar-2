# Change review — Refresh retry capability source

Subject base: 68b6663a47e5cb730cadd8e7aee3f78ea9fa0824
Review state: open
Reviewed content: none
Outcome: Format retries and timeout replacements refresh the capability-note source and its provenance from the current per-turn source builder when re-resolving their tool route.
Affected rules: 1, 26, 34, 36, 37, 45, 49, 70, 74, 78, 84, 101, 111, 113, 116
Affected floors: secrets — existing source custody/redaction; spend cap — existing reservations and complete-envelope bound; stop — existing retry guards; no duplicate sends — existing durable delivery identity; durable intake — journal unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs source content supplied to the model on an existing retry or timeout replacement.
Side effects: Only the capability-note object is replaced; other sources and already-fitted context stay intact. Per-turn builder receives the same Turn as initial preparation. Both dynamic and static source ports retain their API. Existing preparation rejects an overflowing refreshed source before a new reservation or model call. Source and generated register pins are refreshed together. No new tool restriction, model call, authority, store, schema or retry.
Undo and recovery: Revert source, regression tests and regenerated pins together. No durable data migration; historical packets are retained.
Multi-machine posture: Machine-local deliberately: each conversation owner refreshes its own resolved runtime facts. No new state or cross-machine coordination.
Layer below: ports.sources and sourcePacket preserve full provenance; toolPacketFits and toolRoute resolve availability; prepareJournalEnvelope enforces complete packet bounds; retry/replacement journal records retain the replacement prompt and existing call reservations.
Bug class: integration
Bug evidence: reproducer=tests/preview/selfdesc-live.test.ts
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No prompt wording or parser changes. Real worker route-withdrawal and stable-route pairs verify format retry and timeout replacement, complete source provenance, fitted envelope, persisted prompt and single delivery. Oversized refreshed-source pairs prove preparation still refuses before reserving/calling. Recorded live answer 969390342 and timeout outcome 6230665 run through the new path. Existing summary, uncertain/undecided judgment, reply-review and synthetic empty-output replay tests pass. Replaying old answers does not establish fresh-model or real-channel improvement; that remains the combined-build proof.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged prompt/fixture contract, unrelated to this source-object refresh — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: bd01de21286a | protocol-literal | Existing unchanged prompt/fixture contract, unrelated to this source-object refresh — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing unchanged prompt/fixture contract, unrelated to this source-object refresh — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"

Subject (2 paths): tests/preview/journal.ts, tests/preview/selfdesc-live.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: refresh the existing note in the existing routedContext consumer, using the existing source builder and envelope checks. The named failure is contradictory prose after the route changes. Start guards: existing retry eligibility, grant, cap and stop; end guard: replacement source/provenance persisted and asserted; limit guard: existing complete-envelope fit rejects oversize. No new gate or ability restriction. No unattended live-model improvement claim.
80/20: The independent reproducer fails before and passes after; targeted recorded-shape and bound checks pass. No full suite was run; pipeline owns fresh full-run and live-channel evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
