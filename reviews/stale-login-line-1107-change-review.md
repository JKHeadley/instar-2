# Change review — stale login line: one notice on the reply after a switch

Subject base: e8c2a0b156ae412bcdcb4e020dd2cd6ef4d9098d
Review state: open
Reviewed content: none
Outcome: A login switch is told at most once, on the reply that follows it. A reply on 11-07 said "I switched to the next approved login" about 36 hours after the last switch, because the pool offered one notice for every switch in its history and each reply spent one. The pool now offers only the latest switch, and only until a whole reply has been delivered after it.
Affected rules: 2, 8, 42, 44, 52, 54, 74, 76, 87, 88, 113, 116
Affected floors: secrets — no credential read, written or printed, and the line names no account; spend cap — no model call or retry added; stop — stop admission unchanged; no duplicate sends — fewer lines are offered, no send path changes, and journal keys still spend once; durable intake — no intake or journal row changes
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Accept the suggested tier. The change is two small edits on the reply notice path plus one read-only helper, and it touches the composition file that builds every reply's notices.
Side effects: Older unspent switch lines are never told; they stay in the pool's switches history and the status line reports the last switch. A notice displaced on the following reply, by a line ahead of it or a full 3500-byte answer, is dropped rather than carried forward. Any delivered reply after the switch ends the offer, including a probe or other non-operator reply, so such a reply can silence it. Notices after the login line in replyNotices, such as credential reminders and failing route checks, no longer wait behind a switch backlog, so a due reminder held back by that backlog can surface sooner. The unavailable-login notice is unchanged.
Undo and recovery: Revert the commit. The change writes no state: pool files and journal rows are read as before, and keys keep their shape. After a revert the old backlog would be offered again, except for keys already spent.
Multi-machine posture: Machine-local, deliberately. Each runner already keeps its own pool state and journal, and the time comparison uses that runner's own recorded times. No peer state or synchronization changes.
Layer below: Read createHarnessLoginPool and its switch writers in tests/preview/harness-login-pool.mjs, replyNotices in tests/preview/journal-agent.mjs, the one-notice-per-reply selection at tests/preview/journal.ts:9586, openReplyNotices and validAnswerNotices in tests/preview/credential-reminders.ts, and wholeReplySent and wholeReplySentAt in tests/preview/reply-parts.ts. Recorded answer notices are validated from the row alone, so old journals replay without calling this path. The live pool state file was not on this host; the 28-switch history in the test is built from the brief's facts.
Bug class: integration
Bug evidence: reproducer=tests/preview/harness-login-pool.test.ts
Hook bypass: none
Convergence: none
Decision: stale-login-keep-one-line | Keep one line on the following reply instead of removing it, because the brief's acceptance test requires a fresh switch to be noticed once and 1.x is not wholly quiet: its SessionMigrator path still announces a switch, though never inside a reply. Rule 88 and Rule 54 argue for removal, so the report flags this for the desk. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stale-login-line-1107-PROGRESS.md
Decision: stale-login-reply-boundary | Bound the offer by the last delivered reply rather than a time window, because the brief defines the notice by the reply that follows and a time window would need a tuned number and still repeat stale lines inside it. It also closes the upgrade case, where switch 28's own key was still unspent. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stale-login-line-1107-PROGRESS.md
Prompt review: No prompt or model-output parser changes. The line is runner text appended after the answer, and the model never decides it. The recorded live replies at updates 969390675 to 969390678 in tests/preview/fixtures/session-result-notice-969390679.json, each carrying the line, are replayed through the new path.

1.x comparison: Checked at JKHeadley/instar main 8c2a16e67b394990ea8a7fd761ede283fbc3900f, the local clone's ref dated 2026-11-06. src/core/ProactiveSwapMonitor.ts, the source of the 80% ceiling this pool ported, only logs and records evidence for a swap and tells the user nothing. src/monitoring/QuotaManager.ts:200 and :212 announce SessionMigrator switches through notify() at SUMMARY tier (src/commands/server.ts:8722), which is the notification batcher and never part of a reply. So 1.x does not put this line in a conversation reply, and is not wholly silent about switches. ONEX-LESSONS.md is not in that tree or found under this host's echo-compute directory, so no lessons area was read.

Subject (5 paths): reviews/stale-login-line-1107-change-review.md, tests/preview/credential-reminders.ts, tests/preview/harness-login-pool.mjs, tests/preview/harness-login-pool.test.ts, tests/preview/journal-agent.mjs

## Closing block

simplestRobustRoute: The required outcome is one line on the reply after a switch. This is the simplest robust route through existing mechanisms: the switch history already holds the time, the journal already holds delivery times and spent keys, and no state, field, timer or migration is added. The helper is one read-only fold. Start guard: only the latest non-member-unavailable switch. End state: spent key or a later delivered reply. Limit: at most one line per switch. This hand-off makes no unattended live-answer claim.
80/20: The three regressions failed for the behavioural reason before the fix (27 stale lines offered, 3 for one gap, 4 on each recorded reply) and pass after it. Touched and neighbouring tests, typecheck, architecture and register checks run here; the full suite and the live surface belong to the desk's gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
