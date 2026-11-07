# Change review — failed tool calls keep their result

Subject base: e8c2a0b156ae412bcdcb4e020dd2cd6ef4d9098d
Review state: open
Reviewed content: none
Outcome: A tool call that fails in a tool turn now keeps the harness's error text as its recorded result. A sandbox refusal is evidence in the admission record, the journal trace and the reply review, so the reply check no longer treats a true refusal as an unsupported claim.
Affected rules: 1, 2, 3, 36, 57, 58, 84, 101, 102, 106, 116
Affected floors: secrets — the failure row is clipped by the existing hook and passes the existing end-of-turn scrub, which cleans every row field; spend cap — no added model call; stop — unchanged, an interrupted call is a failure event with the same record; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repairs missing evidence on the tool boundary with a real harness envelope and the recorded proof shape. No new authority, effect or capability.
Side effects: Claude tool turns additionally register PostToolUseFailure on the existing post command. The tools class now requires that hook. toolTrace pairs a post-failure row with its admitted call as strictly as a post row, and leaves a failed helper's edge open. A failed call now counts as having a result, so a turn whose tools all ended and whose model failed settles on the existing T4 failure-notice path, and a completed worker whose tool failed is collected rather than left unknown. The generated tool settings are part of tools-guidance-only-v1 pins, so a grant of that class must be re-sealed before this build runs under it; exact-policy and full-tools-checkpointed-v1 grants are unaffected. The desk's T-trace.py must learn the post-failure phase before the first proof of this build.
Undo and recovery: Revert this commit to restore the prior settings and trace. Older records hold no failure rows and replay unchanged. No data migration, service, authority grant or journal schema is added.
Multi-machine posture: Machine-local turn state under the existing admission file; no new store or replication demand.
Layer below: Full constitution; T2c evidence in preswitch-train-199-d7a9666c-20261107-044803 (tools-t2.json, inspect-t2.json, turns-t2.json); a real Claude Code 2.1.319 turn captured 2026-11-07 showing a failed Bash fires PostToolUseFailure and not PostToolUse, and a hook denial fires neither; the session route's fix 7abeb1ae6; 1.x main 40a131d93 src/core/PostUpdateMigrator.ts:8408, which states a failed tool fires PostToolUseFailure.
Bug class: integration
Bug evidence: reproducer=tests/preview/tool-admission.test.ts
Hook bypass: none; ordinary commits, no bypass flag used.
Convergence: none
Decision: stale-checks-t2c-failure-result | Record a failed call's error as its result in the tool-turn trace, because the harness reports a failed call only through PostToolUseFailure. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stale-checks-1107-PROGRESS.md
Decision: stale-checks-t2c-scope | Change the product for T2c only. I4b and I7b are check and scheduling repairs proposed to the desk, because the product defers those cases durably within its pass bounds. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stale-checks-1107-PROGRESS.md
Deferral: tests/preview/tools-policy-class.ts:105 | not-a-deferral=The class check is tightened in this change; nothing is left for later.
Prompt review: No prompt text or parser changes. The reply review's existing toolAttempts packet now carries the error text where it carried null. The recorded t2 call (update 46040954) replays with a real-harness failure envelope through the executable hook into toolTrace. The live journals are not reachable from this host, so the summary-writer, Jev and delivered-reply recorded shapes were not replayed here; tool-failure-answer.test.ts replays the T4 capture and passes.

## Closing block

simplestRobustRoute: This is the simplest robust route: register the event the session route already uses on the tool-turn route, and pair its existing row in the existing trace reader. Treating a missing result as a refusal in the check would pass without evidence. A new row shape or field is not needed, because the error text is what the model saw.
80/20: Both new tests fail on the base sources and pass with the change. The tool admission, policy class, tool failure answer, persistence, paths and activity failure suites pass. Twelve provider and default-tools tests and one process-group stop test fail on this WSL host, the twelve identically on the base sources; the Studio gate decides those.
VERDICT: author submission; independent review pending
