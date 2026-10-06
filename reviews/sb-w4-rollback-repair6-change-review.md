# Change review — sb-w4-rollback repair 6: scheduled work gets the summary's retained exact facts

Subject base: 676a3300e64d9cecb8ead070fb67540b3df4071a
Review state: open
Reviewed content: none
Outcome: Astra's round-4 must-fix 1 (Rule 96). The scheduled-work packet (`workObligations` in tests/preview/journal.ts) carried the newest summary's prose and the operator messages after its frontier, but not `latest.memoryItems`, although the summary instructions tell the summary writer those exact facts are kept separately and must not be repeated in prose. A fact the operator stated before the frontier therefore reached an answer but not the work about it. The answer projection's existing filter (drop an item a later correction or forget touched), source labels and redaction are extracted as one closure helper, `summaryMemoryItems`, and both the answer packet and the work packet now read it; the work question names `memoryItems` in its description of `packet.memory`. The existing size fallback is unchanged: the whole `memory` block is still dropped only when the packet would not fit. Astra's round-4 must-fix 2 is a report correction only: the bounded unmount wait added in repair 1 (6 attempts, 400 ms apart) adds 2 s of pauses, but each attempt is a synchronous `hdiutil detach` with a 60,000 ms timeout, so its configured worst-case synchronous wait is about 362 s (6 × 60 s + 2 s) against 60 s for the former single attempt. reviews/sb-w4-rollback-repair1-change-review.md's "about 2 s longer" side effect understated this; this record is the correction (the earlier record is kept as written), and the desk PROGRESS reports are corrected in place. No six-minute stall has been observed; it is the configured bound. No runtime unmount byte changes.
Affected rules: 4, 10, 13, 74, 96, 116
Affected floors: secrets — unchanged (the facts pass the same redact as the answer path); spend cap — unchanged (no new model call; the packet stays under its byte limit or drops memory as before); stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: carried from the build (the operator's conversation root and what scheduled work is told); this repair adds one input field to an existing packet through an existing projection.
Side effects: the work packet grows by the retained items (at most 20, each at most 300 bytes when written), under the same byte limit and fallback. The unmount bound is disclosed above; it is unchanged by this commit.
Undo and recovery: revert this commit and this record.
Multi-machine posture: unchanged; journal-local projection.
Layer below: reviews/sb-w4-rollback-repair1-change-review.md (the unmount wait whose cost claim is corrected here); the plan #510 work-memory packet.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: sb-w4-rollback-r6-work-memory-items | work reads the same filtered, sourced, redacted summary memoryItems projection as an answer, extracted once, because the summary writer is told those facts are kept there and not in prose; no new store, retrieval or model call | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rollback-PROGRESS.md
Prompt review: OBLIGATION_WORK_QUESTION's description of packet.memory now names "the exact facts it retains in memoryItems with their sources", and the work packet gains memory.memoryItems. The output protocol and its parser are unchanged, so the recorded work-step outputs (tests/preview/fixtures/obligation-step-outputs-live-2026-10-04.json via tests/preview/obligation-task-answer-live.test.ts) still settle as before; no recorded live journal holding a summary with memoryItems before an open obligation was available to replay, so the new input is shown by the extended plan #510 case (fails without the fix, passes with it), not by a live call.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: tests/preview/journal.ts:2176 | not-a-deferral=the obligation work question's wording about deferrals, unchanged apart from naming memoryItems in packet.memory

Subject (2 paths): tests/preview/journal-obligations.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: required outcome — scheduled work sees the exact facts the summary retained. Simplest robust route: reuse the answer path's projection in the work packet. Added machinery: none (one extracted helper).
80/20: `nice -n 10 npx vitest run tests/preview/journal-obligations.test.ts --maxWorkers 1` 31 passed; the new summarized case fails with the memoryItems line removed and passes with it; `npx tsc --noEmit -p .` exit 0.
VERDICT: author submission; the independent verdict is recorded as a pass
