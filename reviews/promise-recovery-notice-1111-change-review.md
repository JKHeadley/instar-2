# Change review — Account once for interrupted promised work

Subject base: d3d563cd1c2396a72bf08fc08c7a7740be419ca8
Review state: open
Reviewed content: none
Outcome: Send one durable interruption account on the next obligation cycle for promised work held uncertain; keep the promise open and never repeat unknown effects.
Affected rules: 4, 8, 34, 42, 49, 52, 63, 68, 70, 74, 83, 84, 87, 89, 101, 102, 113, 116, 123.
Affected floors: secrets — fixed content-free wording plus existing outbound check; spend cap — no model call and existing reply cap; stop — existing dispatch and final current check; no duplicate sends — signed durable intent fences each source across replay, including UNKNOWN; durable intake — unchanged journal custody.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Small change at durable outbound and recovery boundaries; independent review required.
Side effects: One new infrastructure message for held promised work, aggregated by source conversation. Does not fulfill commitments, release holds or launch tools. Refused and unknown notice sends retain their outcomes; no additional notice is generated for notice failure. New notice bytes require a compatible reader.
Undo and recovery: Stop new notice production and revert producer only; retain the notice projection reader for journals already written. Never reset intent markers or delete journal evidence. Full old-reader rollback can refuse new notice records, so preserve the capable reader.
Multi-machine posture: Existing owner-fenced encrypted journal and signed dispatch remain the sole authority. Notice state travels with that journal and generic snapshots; no new local store, foreign worker inference or ownership grant. The owning runner sends; another machine must obtain the existing ownership and journal before acting.
Layer below: Read workObligations recovery/checkpoint projection, commitmentOpen, snapshot pack/unpack, dispatch/admit/current, physical shared send in journal-agent, outboundSubjectOf, sendTarget and sendOutcomeCounts. Independent review caught missing outcome/count/history wiring and post-reservation cancellation, all repaired.
Bug class: integration
Bug evidence: reproducer=tests/preview/row-recovery.test.ts
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No model prompt, parser or semantic admission change. Adds a labelled infrastructure notice/outcome to history. Existing captured row03/08, summary/Jev/review/empty-output fixtures replay through unchanged accounting. New tests replay the measured uncertain recoveryHeld cuts and exercise actual work consumer throw/uncertain outputs.
Prompt finding: 105c1569b6bb | quoted-evidence | Unchanged base prompt wording tested against its exact retained text; this change introduces no semantic keyword judgment — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | quoted-evidence | Unchanged base prompt wording tested against its exact retained text; this change introduces no semantic keyword judgment — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 7ef11b68103f | quoted-evidence | Unchanged base prompt wording tested against its exact retained text; this change introduces no semantic keyword judgment — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | quoted-evidence | Unchanged base prompt wording tested against its exact retained text; this change introduces no semantic keyword judgment — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | quoted-evidence | Unchanged base prompt wording tested against its exact retained text; this change introduces no semantic keyword judgment — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | quoted-evidence | Unchanged base prompt wording tested against its exact retained text; this change introduces no semantic keyword judgment — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | quoted-evidence | Unchanged base prompt wording tested against its exact retained text; this change introduces no semantic keyword judgment — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | quoted-evidence | Unchanged base prompt wording tested against its exact retained text; this change introduces no semantic keyword judgment — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject: tests/preview/journal.ts, tests/preview/row-recovery.test.ts, tests/preview/journal-obligations.test.ts; mechanical owner-reference and generated register pins.

Team posture: Only the verified source conversation receives the fixed content-free notice; no recipient or sharing scope changes. Existing disclosure and send admission still decide whether that conversation can receive it. No promise text or private source content is copied.
Decision: promise-notice-only | Retain unknown-effect hold and report interruption once through the existing send path, instead of building an unsafe automatic rerun. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/promise-recovery-notice-1111-PROGRESS.md
Decision: promise-notice-recheck | Revalidate eligibility after asynchronous admission and preserve refused/unknown outcomes and history awareness. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/promise-recovery-notice-1111-PROGRESS.md

1.x FIRST: JKHeadley/instar origin/main 3ae8208a69b027ad465dca78ec7db2eb2c16b66e, src/monitoring/PromiseBeacon.ts rung2Message/rung2 and src/monitoring/CommitmentTracker.ts pending/mutate lifecycle; searched src/, docs/specs/ and history (4018bf338, 7e8fde8e8, ff8344b4b, 11d127b5e, 1b4350998). Read PROMISE-BEACON-ESCALATION-SPEC.md sections 3.0–3.4 and ONEX-LESSONS sessions/recovery/shared-commitments areas. Reuses the truthful fixed fallback, open commitment and bounded conversation digest. Existing 2.0 intent-before-send and held-effect admission provide stronger uniqueness than copying the old beacon sender. Revival is not transplanted because this brief permits notice-only and unknown effects cannot be repeated.

Independent review: review_promise_notice read this diff and foundation, raised outcome/history and post-admission eligibility findings, and concurred after repairs. Findings and repair concurrence are included in the handoff report at /Users/dabombstudio/.instar/agents/echo/.instar/lanes/promise-recovery-notice-1111-PROGRESS.md; desk gate review remains independent acceptance.

Mechanical registration: The authenticated desk rehash script refreshed exactly one test-artifact hash in register-source/owner-references/preview.json after npm run build. The desk inventory repin script changed zero entries. Register replay pins source commit 986adb684c7cc4711c2fa3a40eec20a2703fae57, generation fd717d8f30318923212f73ed11547df4c0ca0f6c1d590486d7136ba57bc3b582; it is shape evidence, not native self-host certification.

## Closing block

simplestRobustRoute: Reuse the durable infrastructure notice doorway and existing obligation cycle; keep unknown-effect admission untouched. This is the simplest robust route allowed by the brief. No new worker, scheduler, storage or retry engine. Start guarded by verified delivered source and open held promise; end is recorded notice intent/receipt, never promise closure; stop, expiry, audience, ownership and reply cap remain. Live Studio acceptance remains for desk.
80/20: Notice-only is the explicitly accepted complete scope of this unit. Automatic safe resume is the next proposed unit, estimated 150–250 product lines plus tests for checkpoint/effect reconciliation; the desk owns admission of that separately.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
