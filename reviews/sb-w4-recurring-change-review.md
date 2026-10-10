# Change review — sb-w4-recurring: reviewed recurring unit on the live base

Subject base: c54befc70b5802319236d4be42b83619be207d66
Review state: open
Reviewed content: none
Outcome: Combine live train-4 c54befc70b5802319236d4be42b83619be207d66 with reviewed w4-recurring 1f90ffbfa45a5c958d5f04cb4ce74b2b0ba7f6af by one ordinary merge. It fast-forwarded without conflicts. Daily/weekday requests retain cancellation, missed-day coalescence and durable per-occurrence fencing. The unit and its receipt repair are carried unchanged. Desk repair: the requested-actions one-line briefing text exceeded the 130-character briefing limit (282) and dropped the guarded 'answered once at that time' wording; it now reads 'an explicit later-time request is answered once at that time, or daily or weekdays until cancelled, with no new operator message.' and the recurring details (missed-occurrence coalescence, shared spend/stop/delivery limits) move to its README Details line.
Affected rules: 4, 10, 28, 29, 34, 36, 37, 49, 52, 55, 57, 62, 63, 66, 69, 74, 80, 84, 87, 90, 93, 101, 102, 111, 113, 116.
Affected floors: secrets — unchanged outbound scrub; spend cap — same shared allowances and unchanged default-context guard; stop — same scheduler/dispatch gates and cancellation; no duplicate sends — signed local-calendar occurrence plus intent/UNKNOWN fence; durable intake — existing encrypted journal, no new store.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carries the recurring unit critical tier: repeated operator-facing effects depend on exact authority, cancellation and durable dispatch.
Side effects: Unit calendar, model guidance, recurring receipt and capability changes are carried byte-for-byte. The only new generated changes are desk replay metadata/source binding at 1f90ffbf. The desk repair edits only tests/preview/README.md (briefing line and Details line), the matching expected string in tests/preview/selfdesc-abilities.test.ts, and the register output regenerated from that commit; no guard constant, governed document or runtime code changes.
Undo and recovery: Withdraw active recurring series before reverting the unit. Old code cannot interpret recurrence metadata/signatures; do not roll an active recurring journal back without migration. This build touches no live root.
Multi-machine posture: No new owner, store or replication claim. Series remain in the existing encrypted journal under existing conversation ownership and single-writer admission.
Layer below: Carried reviews/w4-recurring-change-review.md and reviews/w4-recurring-repair-030741-change-review.md; inspected calendar resolution, pendingRequests, action-due signatures, durable dispatch recovery and receipt construction. The desk chain recomputes owner-reference hashes and replays the register from committed source.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: sb-w4-recurring-unit | Ordinary merge of reviewed unit 1f90ffbf onto exact live base c54befc7, fast-forward with no conflicts; unit provenance is /Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-recurring-PROGRESS.md and its repair report. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-recurring-PROGRESS.md
Decision: sb-w4-recurring-desk | Reuse the cint-L37 desk chain: inventory repin, build, owner rehash and register replay at 1f90ffbf, preserving all unit source bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-recurring-PROGRESS.md
Decision: sb-w4-recurring-briefing-repair | Shorten the briefing line to one true sentence covering one-time and recurring requests (<=130 chars, keeps the reminder-words guard), keep the long explanation in the README Details line the briefing does not carry. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-recurring-PROGRESS.md
Prompt review: Only the accepted unit changes model guidance/recurring reminder fields. The desk repair shortens the capability-note line the answer model receives; it still states the capability with no denial, and the recorded live note shapes (fixtures/reminderwords-live-2026-10-02.json, selfdesc-2026-10-04/k11a-agentready-replays.json) are replayed by reminder-words and selfdesc-abilities. Checked-in real journal shapes are replayed through requested-action and summary/retrospective consumer tests; no new live-provider claim is made. default-context-floor retains its original guard.
Prompt finding: 849db3a6296a | protocol-literal | Existing journal protocol literal, unchanged by the unit or this combine.
Prompt finding: bd01de21286a | protocol-literal | Existing journal protocol literal, unchanged by the unit or this combine.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing journal protocol literal, unchanged by the unit or this combine.
Deferral: generated/register.json:1 | not-a-deferral=Generated quotation of governing rules, not deferred implementation.

Subject (17 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/README.md, tests/preview/dated-memory.ts, tests/preview/journal-requested-action.test.ts, tests/preview/journal.declarations.json, tests/preview/journal.ts, tests/preview/recall-latency.test.ts, tests/preview/recurring-calendar.test.ts, tests/preview/requested-action-live-test.md, tests/preview/selfdesc-abilities.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: fast-forward the accepted unit onto its exact live base, reuse the existing desk repin/build/rehash/replay tools, and run the brief-specific tests. No new machinery. Existing authority, intake, resource, stop and dispatch guards remain. Unattended live completion remains the desk procedure in tests/preview/requested-action-live-test.md and is not claimed here.
80/20: One unit, no conflict repair or source redesign. Run changed tests, register E2E, context floor and recorded-shape replays; the pipeline owns the full suite and live proof.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
