# Change review — retire a stale owner after an in-flight poll

Subject base: 61112bcf0893e03589972fd39a8b8ed3a20d1e88
Review state: open
Reviewed content: none
Outcome: Retire cleanly when ownership expires during a Telegram poll, before processing its response; remove the stale duplicate tool prompt size ceiling, leaving the exact 3275-byte growth measurement and real budgets with their existing owner test.
Affected rules: 26, 31, 37, 49, 63, 68, 70, 74, 101, 102, 111, 113, 116.
Affected floors: secrets — no new output or credential handling; spend cap — unchanged; stop — checked again after the awaited poll; no duplicate sends — the stale owner cannot reach intake or effects; durable intake — the shared cursor and successor retain pending input, with no local fallback.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: A three-line change at the multi-machine ownership boundary; verify real runner processes, authority, replication and the successor's exactly-once delivery.
Side effects: A stopped or stale runner discards an in-flight poll response before intake; its successor reads it from the shared cursor. The test-only held poll makes this timing repeatable without CPU load. Prompt bytes, model routing, tool availability, caps, packet budgets, receipt handling and history remain unchanged.
Undo and recovery: Revert this repair and regenerate the register from the resulting source commit. No journal schema, migration, capability or authority change; retain the journals and never repeat unknown effects.
Multi-machine posture: Only the current owner may process the returned poll. A stale owner records retirement and queues revival as the standby; the successor resumes from replicated history. Single-machine operation retains the existing local ownership fence.
Layer below: journal.ts intake calls gate(), which throws when ports.stopped() observes ownerHeld() false; the post-poll check previously omitted ownerHeld(), unlike the post-replication checks. Existing authority fences, shared cursor, durable receipts and retirement disposition remain authoritative.
Bug class: integration
Bug evidence: reproducer=tests/preview/two-machine-runner.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model-facing string, parser, verdict, policy or acceptance condition changes. Only the stale duplicate length assertion is removed; default-context-floor retains its exact byte measurement and total budgets; fixture triggers and model dispatch remain unchanged.
Decision: train-41-084602-owner | Reuse the existing ownerHeld checkpoint immediately after the awaited poll rather than catching or suppressing arbitrary worker errors. The controlled poll reproduces both stale exits on the old code. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-repair-084602-PROGRESS.md
Decision: train-41-084602-budget | Remove the duplicate historical size ceiling rather than repinning it again: default-context-floor already owns exact UTF-8 growth and unchanged real packet/answer-budget checks. All prompt bytes stay unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-repair-084602-PROGRESS.md
Decision: train-41-084602-pins | Use the delegated desk rehash and repin tools, then regenerate the register from the committed source; never hand-edit pins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-repair-084602-PROGRESS.md

Register publication: Replayed committed source 7e1177e03b8f7fdf1cf185cf96ba9938b79ebc81; generation sha256:ebb5bfa9c08998e4b0e25408087e5f06281ad919ab1527514fd79e083b24099d, 292 entries, shape-only replay. Desk rehash and repin changed zero pins.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing stop/ownership check at the one missing asynchronous boundary and remove the stale duplicate size assertion. No new product machinery, prompt, capability restriction, timer or recovery protocol. The test-only held poll selects the failing interleaving under its parent test watchdog and exact-PID cleanup; the original process assertions still require retirement, retained history and exactly-once successor delivery. No new autonomous-capability or live acceptance claim.
80/20: Keep the accepted composition and repair the demonstrated missing check; no broad refactor or timeout increase. The desk owns independent review, the Studio full-suite gate and carried live acceptance obligations.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
