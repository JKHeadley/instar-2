# Change review — w3-summaryfaith: the long-chat summary frontier slides past an undecided span; a summary hold is recoverable, not a byte cap

Subject base: 85b46430648ccb30cc58bac98ce0c03e9db821d4
Review state: open
Reviewed content: none
Outcome: The proof-room long chat stopped summarizing after one borderline faithfulness verdict (Jev 0.16 against the 0.15 pass bound on frontier #482). runSummary returned at the first frontier that had used its two attempts, and with no summary the widest prefix was always that frontier, so no summary was attempted for 175 more turns; packets grew until #655 was held as prompt overflow, status reported "bytes cap reached", and every drain re-prepared the held turn for ~22 s of synchronous CPU, starving the Telegram poll timer until the breaker ended the runner. Per D21 §6 the undecided span stays failed (no approval; originals stay in the journal and recall) and the bounded next action is another span. Fixes: the candidate window excludes exhausted frontiers; reachedJournalCap no longer counts `summary unavailable:` holds (bare context/prompt overflow and oversized-turn stay caps); an accepted summary clears `summary unavailable:` holds on replay as it already cleared bare overflow; a byte-held turn is re-prepared only when summaries or the byte cap change, or after HELD_REPREPARE_MS (5 min); a legacy bytes cap-report written beside such a hold still replays. Evidence: tests/preview/summary-frontier-recovery.test.ts (4 tests; 3 fail on the old code, the resume test is the positive neighbour, the throttle test fails with the throttle disabled, 154 preparations vs 10); a scratch copy of the proof-room journal now accepts 8 summaries, skips #482 and answers #655 with no cap; the targeted preview suite (12 files, 185 tests) passes.
Affected rules: 2 (no turn is dropped; the held turn stays visible and resumes), 11/47/110 (a long chat compacts instead of overflowing; the continuity disclosure path is unchanged), 15 (the re-preparation throttle removes the poll starvation that ended the runner), 26 (bytes cap reached now means real byte exhaustion), 74, 116 (a changed frontier filter, one cap predicate, one replay clearing and one in-memory throttle key; no new store or format)
Affected floors: secrets — unchanged; spend cap — unchanged (two attempts per frontier plus the existing call cap and 24 KiB summary prompt bound); stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged (undecided spans keep their originals; nothing is deleted)
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: preview journal worker only; the change narrows which frontiers are offered and when a held turn is re-prepared, and never treats an undecided verdict as a pass or touches send, intake or authority paths
Side effects: journals holding a `summary unavailable:` hold no longer report a bytes cap; such a hold now clears once any summary is accepted. A held turn is re-prepared at most every 5 minutes unless a summary lands or the cap changes.
Undo and recovery: revert the fix commit, the register regeneration and this record
Multi-machine posture: machine-local, deliberately; the preview journal worker on the one preview machine, and the throttle is per-process memory
Layer below: tests/preview/journal.ts runSummary (frontier selection and summaryFailures), reachedJournalCap, the replay clearing of held turns, and the drain's packet preparation
Bug class: integration
Bug evidence: reproducer=tests/preview/summary-frontier-recovery.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed; the summary and faithfulness prompts and the 0.15 Jev calibration are unchanged
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal.ts, tests/preview/summary-frontier-recovery.test.ts

## Closing block

simplestRobustRoute: skip exhausted frontiers in the existing candidate window, count only real byte exhaustion as the cap, clear the recoverable hold on the accepted-summary replay path that already existed, and key re-preparation on the two values that can release a hold. No new judge path, store, format or service.
80/20: 0 must-fix, 1 note (packet preparation near the byte bound is itself slow; a separate efficiency unit)
VERDICT: author submission; the independent verdict is recorded as a pass
