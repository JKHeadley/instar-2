# Change review — Keep contextual reply reviews within their existing output budget

Subject base: 3a900ae4c46f3366f84df4bcbcdafe303eab82c3
Review state: open
Reviewed content: none
Outcome: The contextual reviewer receives a concise reasoning budget so it can return all requested verdicts within the existing 2048-token policy. The real failed forum request now gets a complete review and its answer can be delivered.
Affected rules: 4, 10, 12, 36, 37, 41, 49, 57, 58, 70, 74, 75, 77, 86, 95, 101, 111, 112, 113, 116
Affected floors: secrets — exact secret checks and mandatory group disclosure review unchanged; spend cap — existing provider output ceiling and call reservations unchanged; stop — existing checks unchanged; no duplicate sends — worker restart replay confirms one send; durable intake — existing journal intake and reservations unchanged
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: Changes the prompt of the contextual review that determines whether a real forum reply may leave.
Side effects: Reply-review reasoning is requested in at most 400 characters using the existing taskFields parameter. The initial question and format reminder no longer invite unlimited reasoning. Every selected rule, full context, per-rule reason limit, verdict parser and fail direction stays intact. No tools, network access, MCP, persistence, sessions or subagents are removed. Test fixture records the actual original output-cap failure and a real model replay, without credentials. The delegated desk rehash refreshed one preview owner-reference pin; register replay binds source c20fd033b71e219d03f81a7356460458f7ff3cdc and generation sha256:6ac6b75346a5b4bce85f373066fc6449eeb95d8fb6bb7e6687d5248f4ebb623c. Generated artifacts were committed in 44c3cf2e; no pins were edited by hand.
Undo and recovery: Revert this change to restore the old prompt. Existing journal records need no migration. Unknown prior reviews remain unknown and are never reissued; this change applies to newly admitted reviews. Preserve the original evidence and any already delivered intent.
Multi-machine posture: Each serving host uses the same prompt through its existing subscription route. No new state, replication protocol, ownership rule or peer dependency; evidence artifacts are deliberately machine-local during diagnosis.
Layer below: Read-only journal and physical call-outcome for forum update 715675404; provider result-token enforcement in src/assembly/production-provider.ts; call diagnostics retaining output-cap classification; actual stored harness profile, executable digest and activation; taskFields, readAnswer, per-rule verdict parser, group hold and send deduplication.
Bug class: live-path
Bug evidence: reproducer=tests/preview/reply-review-budget.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-harness-logins-repair-PROGRESS.md
Hook bypass: none
Convergence: none
Decision: REVIEW-BUDGET-1 | Bound review reasoning through the existing taskFields parameter and preserve all verdict questions and enforced floors. The actual failure was 2421 output tokens against 2048, not unavailable custody or malformed verdict syntax. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-harness-logins-repair-PROGRESS.md
Prompt review: The prompt judges meaning, contains no canary phrase, and keeps every selected question. The real recorded review envelope was replayed with only its question replaced; all five verdicts including sensitive_disclosure returned PASS in 282 output tokens. The uncertain original remains held on the group path, a missing rule still refuses, and the recorded privacy violation still yields sensitive_disclosure. Recorded summary writer, uncertain summary, undecided/unsure Jev, review, delivered reply and empty-context shapes remain data through the new review question; source update ids are in PROGRESS and the fixture. No independent review or new forum deployment is claimed.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing reasoningChars prompt parameter to leave output room for all verdicts. The old prompt explicitly invited unbounded reasoning despite a fixed provider ceiling. There is no new parser, gate, retry, policy change or state. Existing activation and reservation checks guard the start; output, time, stop and secret limits remain enforced; the real reviewer replay and worker delivery/restart test supply local end-state evidence. The pipeline owns the next live forum answer check.
80/20: 70 targeted tests pass across the two changed test files; typecheck passes; real recorded request replay completes. Architecture passes. Register pins and generated register are refreshed through the delegated desk tools; final committed-tree cheap checks are recorded in PROGRESS. Saved full-gate results are absent, so no fresh full-suite or post-test contract success is claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
