# Change review — honest failures on every answer attempt and retained active capacity alerts

Subject base: 4cccf736a35341ea701a1e1c60d1c0185f8d9f1b
Review state: open
Reviewed content: none
Outcome: Every answer invocation, including retry, timeout replacement and memory lookup, reaches the existing honest pre-launch/capacity hold and minimal responder. Prior launched/uncertain calls stay charged. The active capacity alert derives from retained episode facts until successful model recovery.
Affected rules: purpose 2/3; 1, 4, 14, 26, 34, 36, 37, 39, 42, 49, 52, 53, 60, 63, 70, 74, 75, 77, 87, 89, 95, 101, 111, 112, 113, 116
Affected floors: secrets — existing fixed text/outbound check; spend cap — preserve earlier usage/UNKNOWN and refund only the certified current invocation; stop — dispatch gate after disclosure; no duplicate sends — existing durable limited intent; durable intake — existing encrypted held turns retained
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes answer reservation settlement and user/desk failure reporting.
Side effects: Status capacityAlerts now lists the active episode rather than recent historical events. Historical events remain on the bounded recent display. Optional hold toolCalls binds the refund to the current invocation; old rows retain first-attempt replay behavior. Earlier correction consumption is preserved. No new provider prompts, retries, authority or stores.
Undo and recovery: Revert before rollout. After new hold rows or snapshots exist, keep this reader or a compatible replacement and retain the journal; do not replay unknown launches or sends. Failed original intake remains held and the existing reply explicitly requests resend.
Multi-machine posture: Existing exclusive journal writer and replication; active alert is a pure projection over retained turns. No separate machine-local state or authority.
Layer below: Checked format-retry/lookup settlement, answer-replace UNKNOWN token keys, launch certification, aggregate tool liability, hold replay, snapshot retention, limited-intent deduplication, disclosure/stop admission and actual status CLI projection.
Bug class: durability
Bug evidence: reproducer=tests/preview/journal-capacity.test.ts; restart=tests/preview/journal-capacity.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No prompt wording change. Replays all 384 proof-room rows at updates 715672479–715672500 including uncertain summaries, Jev/reply reviews and delivered replies; captured timeout at update 6230665 drives replacement holds. Recorded P4 lookup output for the room question at update 6230509 drives both lookup failures. Captured September 24 provider limit bytes drive the conversion; October 10 session envelope is reconstructed. Existing read-only inspection found no real empty delivered bubble and the desk recorded that absence; no synthetic capture is claimed.
Prompt finding: 849db3a6296a | protocol-literal | Existing memory-list or source-grounding protocol wording; unchanged by this repair.
Prompt finding: bd01de21286a | protocol-literal | Existing memory-list or source-grounding protocol wording; unchanged by this repair.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing memory-list or source-grounding protocol wording; unchanged by this repair.

Subject (4 paths): tests/preview/journal-agent.mjs, tests/preview/journal-capacity.test.ts, tests/preview/journal-recall-lookup.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: share one disposition at the existing invocation boundary, settle only its reservation, and derive the active alert from existing durable episode facts. The tool allowance delta prevents refunding earlier launched tool calls. No notification loop or store. Existing admission/stop/caps are start/limit guards, and durable limited intent is the send guard. Evidence is offline shipped-worker/status replay, not a production deployment claim.
80/20: Focused capacity/prelaunch/lookup regressions passed; final checks are recorded in the lane PROGRESS. Both reported failures are fixed at their sources. No quarantine, full suite or load test run on this machine. The specified saved gate report is absent, so post-test contract checks cannot consume it; the pushed pipeline owns that evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
