# Change review — Daily and weekday requested actions

Subject base: c54befc70b5802319236d4be42b83619be207d66
Review state: open
Reviewed content: none
Outcome: Accepted daily and weekday requests produce one due turn per local occurrence; missed days coalesce, withdrawal closes the series, and replay never repeats an occurrence.
Affected rules: 4, 10, 29, 34, 36, 49, 52, 55, 57, 63, 74, 84, 87, 93, 101, 102, 113, 116.
Affected floors: secrets — existing outbound scrub; spend cap — existing shared call/reply allowance and runtime probe; stop — unchanged scheduler/dispatch gates; no duplicate sends — durable dated occurrence in the existing system-writer authorization; durable intake — existing encrypted journal, no new store.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Recurring operator-facing effects must retain existing authority, spend, cancellation and dispatch floors.
Side effects: The preview owner reference is repinned to the added delayed-intake and signature tests. Generated register and capability summaries are refreshed from committed source 49bd9388 (including the repaired prompt and authority tests). Calendar recall expands daily/weekday occurrences within its existing bounded window; open-request status continues to show the active series and advances its due date. One-time and weekly calendar items retain their prior behavior.
Undo and recovery: Revert the source change only after withdrawing active recurring series. Older code does not interpret the new recurrence metadata or occurrence signature; do not roll back a live root containing these frames without an explicit migration. No live root was changed by this builder.
Multi-machine posture: No new state store or owner. The encrypted journal carries the series and per-occurrence writer authorization. Existing conversation ownership and single-writer admission still apply; this change claims no new replication guarantee.
Layer below: Existing request intake, cancellation, signed system-writer authorization, action-due replay validation, shared allowance and outbound intent/receipt handling; dated-memory calendar parsing.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: Adds recurring date-phrase guidance and an honest series receipt with schedule, withdrawal instruction and lifetime limits. The model still decides meaning and the runner verifies the exact operator quote. Existing protocol literals below are unchanged.
Prompt finding: 849db3a6296a | protocol-literal | Existing journal protocol literal, unchanged by this recurrence change.
Prompt finding: bd01de21286a | protocol-literal | Existing journal protocol literal, unchanged by this recurrence change.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing journal protocol literal, unchanged by this recurrence change.

Decision: w4-recurring-calendar | Use daily or weekday local calendar days, one occurrence through DST; skip a missing clock minute until the first later poll. Ambiguous times remain unresolved. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-recurring-PROGRESS.md
Decision: w4-recurring-journal | Put the occurrence in the existing signed due-frame reference and retain series-level cancellation; replay derives progress without another store. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-recurring-PROGRESS.md
Decision: w4-recurring-recovery | Coalesce missed days using the latest due day and durable dispatch time, including recovery of an already queued occurrence; declare the standing series lifetime as unbounded until withdrawn, rather than falsely claiming a paired register bound; each dispatch retains the existing finite preview allowance and expiry. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-recurring-PROGRESS.md

Decision: w4-recurring-prompt-budget | Keep recurring guidance within the original instruction budget; do not grow the bounded packet to compensate for a verbose instruction. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-recurring-PROGRESS.md
Decision: w4-recurring-delayed-intake | A standing request accepted after its first due date catches up once; an expired one-time request is still refused. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-recurring-PROGRESS.md

Decision: w4-recurring-replay-contract | Preserve historical captures; compare the current briefing after only the declared audience/recurrence substitutions and restore the date instruction and its newly fitting third search item before checking both historical packet hashes. All other bytes remain equal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-recurring-PROGRESS.md

Decision: w4-recurring-test-yield | Yield between synchronous recall benchmark samples outside measured spans so Vitest can receive task updates; the passing 84-second case otherwise hit the runner RPC deadline. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-recurring-PROGRESS.md

Subject source paths: tests/preview/README.md, tests/preview/dated-memory.ts, tests/preview/journal-requested-action.test.ts, tests/preview/journal.ts, tests/preview/recurring-calendar.test.ts, tests/preview/requested-action-live-test.md, tests/preview/selfdesc-abilities.test.ts, tests/preview/recall-latency.test.ts. Capability declarations, owner pins and generated register files accompany the source.

## Closing block

simplestRobustRoute: This is the simplest robust route: retain the accepted dated request and existing scheduler, attach a local calendar-day occurrence to its existing due frame, and project progress from that durable frame. No timer service, new store, model call or worker is added. The occurrence prevents duplicate sends after a repeated local hour or restart. Dispatch time coalesces downtime after a queued turn. Start guards are verified operator requests, a settled local time and existing owner admission; end guards are durable dispatch and withdrawal; limits are existing calls, replies, turns, expiry and stop. This author submission makes no unattended live-completion claim.
80/20: Calendar and scheduler regression tests pass locally; broader direct-import checks and recorded-shape replays (including captured delivered, empty and uncertain outcomes through the new series path) are reported in the builder report. Independent landing and live proof remain the desk responsibility; no independent verdict is asserted.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
