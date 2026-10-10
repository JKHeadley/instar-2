# Change review — Merge recurring requests with group carry

Subject base: fad3b6941a91cb4e745deddb7fb1061cf67f6364
Review state: open
Reviewed content: none
Outcome: Merge live recurring build 398e732b into group carry with both histories retained. Resolve carried request lookup together with occurrence dates; accept daily/weekday carry metadata and advance the snapshot past predecessor-consumed occurrences.
Affected rules: 1, 4, 28, 29, 34, 36, 37, 49, 52, 55, 57, 60, 63, 69, 74, 90, 93, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — unchanged disclosure and scrubbing checkpoints; spend cap — unchanged shared allowances; stop — unchanged intake/dispatch stop; no duplicate sends — predecessor transfer fence plus preserved next occurrence and durable intent; durable intake — existing encrypted journals and replay.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of two existing user-facing capabilities affects scheduled sends and their exclusive execution owner.
Side effects: Preserves recurring calendar, guidance and tests from the live branch and group disclosure/carry from this branch. Carry snapshots now preserve the next unconsumed day rather than resetting a recurring series to its first day. Generated register and capability artifacts are replayed from the merged source; no new store, policy, scope or authority.
Undo and recovery: Revert the merge and generated replay only after withdrawing active recurring series or migrating them: old readers cannot interpret recurrence metadata. Existing transfer-first recovery reuses the predecessor record and never restores two execution owners. No live root was changed.
Multi-machine posture: Existing machine-local encrypted journal under single-owner admission; no new state surface or replication claim. Same recurring occurrence identity and transfer fence on every installation.
Layer below: Inspected activeRequests/requestByKey/requestSource, lastRecurringOccurrence, pendingRequests, signed action-due identity, durable intent and request-transfer snapshot construction. Verified calendar helper reuse and exact carry shape validation, and regenerated source bindings via desk tools.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: merge-recurring-carry | Combine occurrence-aware lookup with carried sources and retain the next unconsumed day; reuse existing calendar and durable journal evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-group-carry2-repair-PROGRESS.md
Prompt review: Carries existing recurring guidance unchanged. Recorded proof-room rows 715672479–715672500 replay uncertain summaries, Jev unsure/unavailable, reply reviews, memory undecided and delivered answers through group carry. Requested-action tests replay recorded summary uncertain 715672483, delivered 715672479 and empty reply context 715672550 through recurring scheduling. No new model instruction or output interpretation beyond the accepted recurring branch.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged journal instruction, unrelated to carry lookup or recurrence metadata — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: bd01de21286a | protocol-literal | Existing unchanged journal instruction, unrelated to carry lookup or recurrence metadata — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing unchanged journal instruction, unrelated to carry lookup or recurrence metadata — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"
Deferral: generated/register.json:1 | not-a-deferral=Generated quotation of governing rules, not deferred work

Subject (19 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/README.md, tests/preview/dated-memory.ts, tests/preview/group-carry-requests.test.ts, tests/preview/group-carry.ts, tests/preview/journal-requested-action.test.ts, tests/preview/journal.declarations.json, tests/preview/journal.ts, tests/preview/recall-latency.test.ts, tests/preview/recurring-calendar.test.ts, tests/preview/requested-action-live-test.md, tests/preview/selfdesc-abilities.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge, shared local-or-carried lookup, existing calendar next-day helper and existing durable predecessor occurrence records. Added compatibility prevents rejected recurring carries and duplicate already-sent days without a new ledger. Existing authority/disclosure, cap/stop and durable dispatch guards remain. No unattended live deployment claim is made; the pipeline and desk own that tier.
80/20: Targeted changed-file checks and integration replay cover the merge boundary; cheap gates and original saved gate evidence are checked before push. No full suite, quarantine or load burner.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
