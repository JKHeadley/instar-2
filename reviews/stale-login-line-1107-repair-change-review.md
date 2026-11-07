# Change review — stale login line repair: no reply line for a successful login switch

Subject base: ac2cceb4a29c259fc4505aee62937757afff2ca8
Review state: open
Reviewed content: none
Outcome: A successful model-login switch no longer adds any line to a reply, whether the switch is fresh or old. The unit review (Astra, VERDICT: NO) found that the retained one-time "I switched to the next approved login" line still pushed internal status into an ordinary answer: a successful switch needs no operator action and is not the task's result (Rules 87, 88, 54). The pool's notices() now offers only the actionable unavailable-member notice. Switching itself, the durable switches history and the status line ("Last switch: ...") are unchanged. The reply-time helper lastReplySentAt and the caller argument added in the previous round had no other consumer and are removed, so credential-reminders.ts and journal-agent.mjs are back to their pre-unit content.
Affected rules: 2, 42, 52, 54, 76, 87, 88, 113, 116
Affected floors: secrets — no credential read, written or printed, and the removed line named no account; spend cap — no model call or retry added; stop — stop admission unchanged; no duplicate sends — one fewer candidate line, no send path changes, and keys of other notices still spend once; durable intake — no intake or journal row changes
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Accept the suggested tier. The change deletes one notice source on the reply-notice composition path that every reply passes through.
Side effects: An operator no longer learns of a successful login switch from a reply; it is visible on the status pull surface and in the pool's switches history. Old journal rows that carried the line still replay, because recorded answer notices are validated from the row alone. The pool state field noticeIdentity is still written on legacy adoption and kept, so record shapes do not change, though no notice key reads it any more. A failed self-heal is still told: when no reviewed login remains, the existing outage reply (loginOutageReply) and the unavailable-member notice are unchanged. The generated/ register files were regenerated with build-register --replay from committed source 5c405e00b because the source wiring pin trailed harness-login-pool.mjs; the desk owner-manifest rehash and inventory repin chain changed zero pins, and no pin was hand-edited.
Undo and recovery: Revert the commits. It writes no state; pool files and journal rows are read as before. A revert would offer the latest switch line again on the next reply.
Multi-machine posture: Machine-local, deliberately, as before. Each runner keeps its own pool state and journal; no peer state or synchronization changes.
Layer below: Read createHarnessLoginPool's switch writers, notices(), outage() and harnessLoginPoolStatus in tests/preview/harness-login-pool.mjs; replyNotices in tests/preview/journal-agent.mjs; openReplyNotices and validAnswerNotices in tests/preview/credential-reminders.ts; and the launcher test's sends assertion in tests/preview/harness-login-launcher.test.ts, the only other consumer of the line's text.
Bug class: integration
Bug evidence: reproducer=tests/preview/harness-login-pool.test.ts
Hook bypass: none
Convergence: none
Decision: stale-login-no-success-line | Remove the successful-switch contribution from notices() entirely instead of keeping one line on the following reply, because the unit review ruled that line conflicts with Rules 87/88 (status belongs on a pull surface; the operator hears of an internal issue only after self-healing failed) and the charter puts the constitution ahead of the brief's one-fresh-line acceptance test. Supersedes stale-login-keep-one-line and stale-login-reply-boundary. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stale-login-line-1107-repair-085614-PROGRESS.md
Decision: stale-login-launcher-expect-none | Change the launcher end-to-end assertion from one success line in a pooled run to none, because it is the same behaviour checked through the shipped launcher; the switch itself stays asserted from the pool state file. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stale-login-line-1107-repair-085614-PROGRESS.md
Prompt review: No prompt or model-output parser changes. The removed line was runner text appended after the answer; the model never decided it. The recorded live replies at updates 969390675 to 969390678 in tests/preview/fixtures/session-result-notice-969390679.json, each carrying the line, are replayed and none is offered it now.

1.x comparison: Inherited from the unit record and confirmed by the unit review at JKHeadley/instar main 8c2a16e67b394990ea8a7fd761ede283fbc3900f: src/core/ProactiveSwapMonitor.ts records and logs a successful swap and tells the user nothing, which is the behaviour this repair now matches for replies. src/monitoring/QuotaManager.ts:200,212 announce SessionMigrator switches through notify() at SUMMARY tier (src/commands/server.ts:8722), never inside a reply; the review held that this older SUMMARY behaviour does not override the current constitution. No 1.x code is ported.

Subject (12 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/credential-reminders.ts, tests/preview/harness-login-launcher.test.ts, tests/preview/harness-login-pool.mjs, tests/preview/harness-login-pool.test.ts, tests/preview/journal-agent.mjs

## Closing block

simplestRobustRoute: Delete the success line's source and the helper only it used. No classifier, gate, field, timer or migration is added; switching, history, status and the actionable unavailable-member notice stay, so the agent's recovery ability is unchanged.
80/20: With the previous round's notices() restored, 7 pool tests fail (the success line reappears for fresh, old, adopted and recorded-reply cases); with this change all 155 tests in the five targeted files pass. Typecheck, architecture, register and change-review checks run here; the launcher end-to-end test and the full suite belong to the Studio gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
