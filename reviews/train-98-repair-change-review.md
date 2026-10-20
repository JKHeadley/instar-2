# Change review — Repair ended output-cap reply reviews

Subject base: 33d719af368d564d74184c0ef3812670fafc264e
Review state: open
Reviewed content: none
Outcome: Recover a conclusively ended over-cap reply review through the existing one-retry allowance, requiring a fresh full-context audience verdict before a group reply leaves.
Affected rules: 1, 4, 36, 41, 42, 49, 55, 57, 58, 60, 70, 74, 75, 77, 88, 95, 101, 102, 111, 113, 116
Affected floors: secrets — existing exact wall and audience verdict remain; spend cap — both calls reserved and all reported usage retained; stop — existing stop latch and shared deadline; no duplicate sends — no repeat of a reserved review or send after recovery; durable intake — original intake and failed-review evidence preserved.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Live group-reply recovery changes paid review admission and durable token accounting.
Side effects: One additional paid call only after an ended over-cap first review and only within existing caps/deadline; the output allowance is unchanged. Reported over-cap usage now remains visible, while unmeasured usage retains its reservation. Unknown failures still do not retry. Fresh verdicts remain subject to all existing disclosure checks.
Undo and recovery: Revert the repair and regenerate pins/register before deployment. Keep the journal; readers must understand the new output-cap reason on format-retry rows. Never repeat unknown provider effects or sends. Existing retry flag survives replay and compaction.
Multi-machine posture: No new local store or authority. Existing journal ownership and replication carry the retry, accounting and send intent; the owning worker alone dispatches. Both calls remain charged across replay and compaction.
Layer below: Inspected retained read-only copy update 367052411, physical final result/output-cap evidence, subscription uncertainty classification, reply-review parser, call/token reservations, group disclosure checkpoint, compaction/replay and exact send preparation.
Bug class: live-path
Bug evidence: reproducer=tests/preview/reply-review-overcap.test.ts; live=tests/preview/fixtures/reply-review-overcap-2026-10-20.json
Hook bypass: none; checked core.hooksPath (unset) and common hooks directory (sample files only).
Convergence: none
Prompt review: New reminder asks for a shorter verdict on the same candidate, full context and selected rules, without suggesting PASS or VIOLATION. Actual failed live update 367052411 is retained as red evidence; its diagnostic verdict bytes are replayed as a separate completed replacement, not promoted from the discarded call. Earlier real probe 969390374 and corpus updates 715672480, 715672483, 715672482, 969389570, 969389923, 715672479 and empty 715672550 are replayed. Targeted tests are offline evidence; desk must run fresh live acceptance.
Prompt finding: 0abb3dc96311 | protocol-literal | Existing unchanged protocol guidance checked by its regression tests, not a copied trigger or asserted verdict — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an unresolved date or unrecorded scheduling claim is no admitted reminder."
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol guidance checked by its regression tests, not a copied trigger or asserted verdict — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 5b486d8bd247 | protocol-literal | Existing unchanged protocol guidance checked by its regression tests, not a copied trigger or asserted verdict — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "prioritize verdicts; do not repeat rules or context."
Prompt finding: 5fa1a20c4031 | protocol-literal | Existing unchanged protocol guidance checked by its regression tests, not a copied trigger or asserted verdict — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an illustrative or quoted literal the verified operator explicitly requested or "
Prompt finding: 7c45ffbe90ad | protocol-literal | Existing unchanged protocol guidance checked by its regression tests, not a copied trigger or asserted verdict — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "loops the deferrals, judgments and promises it will track, dated this turn's adm"
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged protocol guidance checked by its regression tests, not a copied trigger or asserted verdict — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: aef7d91bef51 | protocol-literal | Existing unchanged protocol guidance checked by its regression tests, not a copied trigger or asserted verdict — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "give each listed rule, and no others, one verdict"
Prompt finding: b288d6ef1604 | protocol-literal | Existing unchanged protocol guidance checked by its regression tests, not a copied trigger or asserted verdict — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "keep reasoning under 400 characters and all json under 4000 so every verdict fit"
Prompt finding: e769ca9dd959 | protocol-literal | Existing unchanged protocol guidance checked by its regression tests, not a copied trigger or asserted verdict — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "pass means no breach; violation means a breach, named in its reason."
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol guidance checked by its regression tests, not a copied trigger or asserted verdict — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Prompt finding: f6d7f3274c85 | protocol-literal | Existing unchanged protocol guidance checked by its regression tests, not a copied trigger or asserted verdict — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "restating a recorded, still-open limit needs no duplicate record. a capability n"
Prompt finding: feadb66b8ad1 | protocol-literal | Existing unchanged protocol guidance checked by its regression tests, not a copied trigger or asserted verdict — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "any live authentication secret reaching anyone but the verified operator who sup"


Decision: train98-review-overcap | Extend the existing one paid review re-ask only for exact ended output-cap evidence; preserve its accounting and every send checkpoint. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-98-repair-PROGRESS.md
Verification: nice -n 10 npx tsc --noEmit; nice -n 10 npm run build; nice -n 10 npx vitest run --maxWorkers 1 tests/preview/reply-review-overcap.test.ts tests/preview/format-retry.test.ts; node scripts/check-architecture.mjs. All passed. Final lint/register/change-review and pushed-head evidence are in the lane report.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the one existing paid format retry for one more exact unusable-output case. Start guard: a recorded ended process with final result and output-cap; end guard: a new valid audience review; limit guards: original output allowance, call cap, shared deadline, stop, credential wall and unique send. No new service, background retry loop or capability restriction. No autonomous live success claimed.
80/20: Two targeted files (25 passing tests), typecheck/build, architecture and cheap final gates; no full suite or load test on the Studio.
VERDICT: author submission for the desk gate; no independent convergence or fresh live-answer claim.
